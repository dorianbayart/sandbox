// An AI car: sensors → network → throttle, brake, steering → physics → judged by the distance reached.
// Two more inputs read the indicators of the traffic, like a driver who sees the car in front
// about to change lane: is a car about to cut into its lane, from the left, from the right?
// Memory: the network may have a few extra outputs, fed back as inputs at the next step. Nothing
// tells it what to keep there: evolution finds out (a trend, "I am overtaking", a timer…).
import { carPolygon, segmentHit, polygonsIntersect } from './geometry.js';
import { SEGMENT } from './road.js';

export const CAR_WIDTH = 30;
export const CAR_LENGTH = 50;
export const MAX_SPEED = 5;           // px per step
// Sensors: one fan of rays, close together and long in the middle, further apart and
// shorter on the sides (like an eye: sharp in the centre). Far ahead, the rays stay about
// one lane apart; on the sides, they only need to see the next lanes.
export const RAY_SPREAD = Math.PI * 2 / 3;  // 120° from the leftmost ray to the rightmost one
export const RAY_NEAR = 220;                // Length of the outer rays of the fan
export const RAY_FAR = 880;                 // Length of the middle ray
const RAY_CONCENTRATION = 1.7;              // > 1: rays closer together in the middle
// Bump this when the physics, sensors or inputs change: brains are only valid in the simulation that trained them
export const PHYSICS_VERSION = "lab05-8";

// Network outputs, then the memory outputs
export const OUTPUTS = ["throttle", "brake", "steering"];

// Short rays on each side and behind, outside the fan, on both sides:
// - 90° and 120°: the blind spots, e.g. a traffic car alongside or catching up while the
//   AI slows down. They reach the far side of the next lane, no further: longer, they would
//   mostly see the road border, which the fan already sees.
// - 160° and 175°: behind, to reverse safely and see traffic coming up the same lane.
const DEG = Math.PI / 180;
export const SIDE_RAY_ANGLES = [90 * DEG, 120 * DEG, 160 * DEG, 175 * DEG];
export const SIDE_RAY_LENGTHS = [70, 85, 100, 150];

// Angle (relative to the car, from left to right) and length of each ray: the side rays
// on the left, the fan of `fanCount` rays, then the side rays on the right
export function rayLayout(fanCount) {
    const angles = [], lengths = [];
    for (let i = SIDE_RAY_ANGLES.length - 1; i >= 0; i--) {
        angles.push(-SIDE_RAY_ANGLES[i]);
        lengths.push(SIDE_RAY_LENGTHS[i]);
    }
    for (let k = 0; k < fanCount; k++) {
        const t = fanCount === 1 ? 0 : -1 + 2 * k / (fanCount - 1);     // -1 … 1
        const side = Math.sign(t) * Math.abs(t) ** RAY_CONCENTRATION;   // Still -1 … 1, denser near 0
        angles.push(side * RAY_SPREAD / 2);
        const centre = 1 - Math.abs(side);                              // 1 in the middle, 0 on the sides
        lengths.push(RAY_NEAR + (RAY_FAR - RAY_NEAR) * centre * centre);
    }
    SIDE_RAY_ANGLES.forEach((angle, i) => {
        angles.push(angle);
        lengths.push(SIDE_RAY_LENGTHS[i]);
    });
    return { angles: Float64Array.from(angles), lengths: Float64Array.from(lengths) };
}

// Cut-in inputs, left then right: a traffic car in the next lane, alongside or up to
// CUT_IN_RANGE ahead, with its indicator towards the AI's lane (or already moving into it).
// The value is how close it is: 1 alongside, 0 at CUT_IN_RANGE or no such car.
export const CUT_IN_INPUTS = ["cut-in left", "cut-in right"];
const CUT_IN_RANGE = 500;

// Network inputs: every ray, the speed, the two cut-in inputs, then the memory fed back from
// the previous step
export function inputCount(fanCount, memory = 0) {
    return fanCount + 2 * SIDE_RAY_ANGLES.length + 1 + CUT_IN_INPUTS.length + memory;
}

// Network shape for these sensors, hidden layers and memory
export function networkShape(fanCount, hidden, memory) {
    return [inputCount(fanCount, memory), ...hidden, OUTPUTS.length + memory];
}

const ACCELERATION = 0.2;
const BRAKING = 0.35;
const FRICTION = 0.04;
const TURN_RATE = 0.05;      // rad per step at full steering
// Lenient on purpose: slowing down to get round a group of cars must stay possible. The race
// has a fixed length, so a slow car already scores less; these rules only stop parked cars.
const STALL_STEPS = 180;     // No progress for 3s: eliminated
const GRACE_STEPS = 60;      // Time to speed up before the speed is judged
const SLOW_WINDOW = 300;     // Speed averaged over ~5s…
const SLOW_RATIO = 0.15;     // …must stay above 15% of the max speed

export class Car {
    constructor(network, fanCount, x) {
        this.network = network;
        this.memorySize = network.shape[network.shape.length - 1] - OUTPUTS.length;
        const layout = rayLayout(fanCount);
        this.rayCount = layout.angles.length;
        this.rayAngles = layout.angles;
        this.rayLengths = layout.lengths;
        this.x = x;
        this.y = 0;
        this.heading = 0;
        this.speed = 0;
        this.throttle = 0;
        this.brake = 0;
        this.steering = 0;
        this.alive = true;
        this.deathCause = null;
        this.age = 0;
        this.bestD = 0;           // Fitness: furthest distance reached
        this.lastProgress = 0;
        this.avgSpeed = MAX_SPEED; // Starts optimistic, so a new car has time to speed up
        this.memoryStart = this.rayCount + 1 + CUT_IN_INPUTS.length;
        this.inputs = new Float64Array(this.memoryStart + this.memorySize);
        this.rayHits = new Float64Array(this.rayCount); // Hit fraction of each ray (1 = nothing seen)
        this.polygon = carPolygon(x, 0, 0, CAR_WIDTH, CAR_LENGTH);
    }

    get distance() {
        return -this.y;
    }

    rayAngle(k) {
        return this.heading + this.rayAngles[k];
    }

    rayLength(k) {
        return this.rayLengths[k];
    }

    step(road, traffic) {
        if (!this.alive) return;

        this.sense(road, traffic);
        const out = this.network.forward(this.inputs);
        this.throttle = out[0];
        this.brake = out[1];
        this.steering = out[2];
        // Memory: written now, read back at the next step
        for (let m = 0; m < this.memorySize; m++) this.inputs[this.memoryStart + m] = out[OUTPUTS.length + m];
        this.move();
        this.polygon = carPolygon(this.x, this.y, this.heading, CAR_WIDTH, CAR_LENGTH);

        this.age++;
        this.avgSpeed += (this.speed - this.avgSpeed) / SLOW_WINDOW;
        if (this.distance > this.bestD + 0.5) {
            this.bestD = this.distance;
            this.lastProgress = this.age;
        }

        if (this.polygon.some(p => road.isOffRoad(p.x, p.y))) this.die("road");
        else if (this.hitsTraffic(traffic)) this.die("traffic");
        else if (this.age - this.lastProgress > STALL_STEPS) this.die("stall");
        else if (this.age > GRACE_STEPS && this.avgSpeed < SLOW_RATIO * MAX_SPEED) this.die("slow");
    }

    die(cause) {
        this.alive = false;
        this.deathCause = cause;
    }

    // Inputs: how close an obstacle is on each ray (0 = nothing, 1 = touching), the speed, then
    // the cut-in inputs (see CUT_IN_RANGE)
    sense(road, traffic) {
        const near = traffic.active.filter(t => Math.abs(t.y - this.y) < RAY_FAR + CAR_LENGTH);

        for (let k = 0; k < this.rayCount; k++) {
            const a = this.rayAngle(k), length = this.rayLengths[k];
            const ex = this.x + Math.sin(a) * length;
            const ey = this.y - Math.cos(a) * length;
            let hit = 1;
            const rayMinX = Math.min(this.x, ex), rayMaxX = Math.max(this.x, ex);

            // Road borders: only the segments between the car and the end of the ray, and
            // only those that reach the ray sideways (most rays stay far from the borders)
            const first = Math.floor(Math.min(-this.y, -ey) / SEGMENT);
            const last = Math.floor(Math.max(-this.y, -ey) / SEGMENT);
            for (let i = first; i <= last; i++) {
                const { left, right } = road.segment(i);
                if (Math.max(left[0], left[2]) >= rayMinX) {
                    const tl = segmentHit(this.x, this.y, ex, ey, left[0], left[1], left[2], left[3]);
                    if (tl >= 0 && tl < hit) hit = tl;
                }
                if (Math.min(right[0], right[2]) <= rayMaxX) {
                    const tr = segmentHit(this.x, this.y, ex, ey, right[0], right[1], right[2], right[3]);
                    if (tr >= 0 && tr < hit) hit = tr;
                }
            }

            // Traffic: only the cars near the ray's bounding box
            const minX = rayMinX - CAR_LENGTH, maxX = rayMaxX + CAR_LENGTH;
            const minY = Math.min(this.y, ey) - CAR_LENGTH, maxY = Math.max(this.y, ey) + CAR_LENGTH;
            for (const t of near) {
                if (t.x < minX || t.x > maxX || t.y < minY || t.y > maxY) continue;
                const p = t.poly;
                for (let j = 0; j < 4; j++) {
                    const a1 = p[j], b1 = p[(j + 1) % 4];
                    const th = segmentHit(this.x, this.y, ex, ey, a1.x, a1.y, b1.x, b1.y);
                    if (th >= 0 && th < hit) hit = th;
                }
            }
            this.rayHits[k] = hit;
            this.inputs[k] = 1 - hit;
        }
        this.inputs[this.rayCount] = this.speed / MAX_SPEED;
        this.senseCutIns(road, near);
    }

    // Traffic cars about to come into the AI's lane, from each side
    senseCutIns(road, near) {
        const d = this.distance;
        const lane = (this.x - road.centerX(d)) / road.laneWidth(d) + road.laneCount / 2; // Lane k: k…k+1
        let left = 0, right = 0;
        for (const t of near) {
            const ahead = t.d - d;
            if (ahead < -CAR_LENGTH || ahead > CUT_IN_RANGE) continue;
            const offset = t.lane + 0.5 - lane;                  // Lanes, > 0 = on the right
            if (Math.abs(offset) < 0.4 || Math.abs(offset) > 1.6) continue;
            const towards = -Math.sign(offset);                  // Side it must move to, to come into the lane
            const moving = t.lane !== t.targetLane && Math.sign(t.targetLane - t.lane) === towards;
            if (t.signal !== towards && !moving) continue;
            const closeness = 1 - Math.max(0, ahead) / CUT_IN_RANGE;
            if (offset < 0) left = Math.max(left, closeness);
            else right = Math.max(right, closeness);
        }
        this.inputs[this.rayCount + 1] = left;
        this.inputs[this.rayCount + 2] = right;
    }

    // Throttle and brake count from 0 to 1 (negative outputs = pedal released). Moving
    // forward, the brake slows down to a stop; stopped, holding the brake drives backwards,
    // and then the throttle is the one that brakes. Steering turns, more at speed.
    move() {
        const throttle = Math.max(0, this.throttle), brake = Math.max(0, this.brake);
        if (this.speed > 0 || (this.speed === 0 && throttle >= brake)) {
            this.speed = Math.max(0, this.speed + throttle * ACCELERATION - brake * BRAKING);
        } else {
            this.speed = Math.min(0, this.speed - brake * ACCELERATION + throttle * BRAKING);
        }

        if (this.speed > 0) this.speed = Math.max(0, this.speed - FRICTION);
        else if (this.speed < 0) this.speed = Math.min(0, this.speed + FRICTION);
        this.speed = Math.max(-MAX_SPEED / 3, Math.min(MAX_SPEED, this.speed));

        const grip = Math.min(1, Math.abs(this.speed) / 2);
        this.heading += this.steering * TURN_RATE * grip * Math.sign(this.speed);

        this.x += Math.sin(this.heading) * this.speed;
        this.y -= Math.cos(this.heading) * this.speed;
    }

    // Any contact eliminates the AI, whoever runs into whom: it must avoid every collision,
    // including traffic coming from behind (keep up with it, or move aside)
    hitsTraffic(traffic) {
        for (const t of traffic.active) {
            if (Math.abs(t.y - this.y) < CAR_LENGTH && Math.abs(t.x - this.x) < CAR_LENGTH &&
                polygonsIntersect(this.polygon, t.poly)) return true;
        }
        return false;
    }
}
