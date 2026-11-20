// Traffic: cars with their own speed, which slow down behind a slower car and change lane
// to overtake it. It only depends on the seed and the time, never on the AI cars: every
// AI of a race, and every race on the same seed, meets exactly the same traffic.
// Lanes are sorted by speed: slow cars on the outer lanes, fast ones in the middle. A car
// overtakes towards the centre lane, then goes back to its own lane when there is room.
// Where too many cars gather, one of them takes an exit: it leaves the road by the outer
// lane and fades out on the roadside (never vanishes on the road).
// Before changing lane or taking an exit, a car turns its indicator on for a moment (each
// driver its own delay), then moves if there is still room. The AIs see the indicators.
// Now and then, a driver also changes lane for no visible reason (a whim): a surprise for
// an AI that does not read the indicators.
import { mulberry32 } from './rng.js';
import { carPolygon, lerp } from './geometry.js';
import { CAR_WIDTH, CAR_LENGTH, MAX_SPEED } from './car.js';

export const TRAFFIC_MIN_SPEED = 1.5;   // 30% of the AI max speed
export const TRAFFIC_MAX_SPEED = 3.5;   // 70%
const AVERAGE_SPEED = (TRAFFIC_MIN_SPEED + TRAFFIC_MAX_SPEED) / 2;
const FIRST_ROW = 350;
const REAR_FIRST_ROW = -400;            // Rows also enter from behind the start, out of sight:
                                        // a car slower than the traffic gets caught up, it never
                                        // ends up alone on an empty road
const SPAWN_AHEAD = 1200;               // New rows appear this far ahead of the fastest possible AI
const DIFFICULTY_DISTANCE = 10000;      // Rows get denser and closer together up to this distance
const MAX_BLOCKED = 3;                  // Max lanes taken by a new row (out of 5)
const ROW_GAP_EASY = 320;
const ROW_GAP_HARD = 200;

const LOOK_AHEAD = 300;                 // How far a car looks for the car in front
const FOLLOW_GAP = 25;                  // Bumper to bumper gap kept behind a slower car
const OVERTAKE_GAP = 110;               // Closer than this behind a slower car: try to overtake
const LANE_CHANGE_SLOPE = 0.4;          // Sideways speed / forward speed while changing lane (≈ 22°)
const LANE_CHANGE_COOLDOWN = 90;        // Steps before a car may change lane again
const GROUP_WINDOW = 150;               // Cars closer than this form a group…
const ALL_LANES_BLOCKED_MASK = 0b11111; // …which must always leave a lane free
const RETURN_CLEAR = 300;
const SIGNAL_TIME = [120, 210];         // Steps of indicator before moving (2 to 3.5 s, per driver); it
                                        // stays on during the move (about 1 s more)
const SIGNAL_GIVE_UP = 180;             // Still no room 3 s after: gives up and turns it off
const WHIM_EVERY = [600, 1800];         // Steps between two lane changes for no reason (10 to 30 s, per driver)
const WHIM_STAY = [300, 600];           // Then stays at least 5 to 10 s in its new lane               // Back to its own lane only if no slower car this close ahead in it

// Speed range by distance to the centre lane: outer lanes slow, centre lane fast
const LANE_SPEEDS = [[2.7, 3.5], [2.1, 2.9], [1.5, 2.3]];

// Too many cars close together: one leaves the road
const DENSITY_WINDOW = 1000;            // px of road…
const DENSITY_MAX = 6;                  // …holding more cars than this: the oldest car of an outer lane takes an exit
const DENSITY_CHECK_EVERY = 60;         // Steps between two checks (1 s)
const EXIT_FADE = [1.1, 2];             // Lanes beyond the border: fades out between these, then removed
const ACCEL = 0.03;
const DECEL = 0.12;

export class Traffic {
    constructor(road, seed) {
        this.road = road;
        this.rand = mulberry32(seed);
        this.cars = [];          // Sorted by distance d, from the back to the front
        this.time = 0;
        // Next row of each stream, in the frame that moves at the average speed (a conveyor
        // belt): ahead of the start, and behind it
        this.front = { nextRow: FIRST_ROW, previousFree: null };
        this.rear = { nextRow: REAR_FIRST_ROW, previousFree: null };
        this.active = [];        // Traffic cars near the population, for the sensors and collisions
        this.centreLane = (road.laneCount - 1) / 2;
        this.exits = 0;          // Cars that took an exit, for statistics

        // The start of the road is filled at once, then rows appear far ahead as time goes on
        while (this.front.nextRow < SPAWN_AHEAD) {
            this.addRow(this.front, this.front.nextRow, this.front.nextRow);
            this.front.nextRow += this.rowGap(this.front.nextRow);
        }
    }

    rowGap(position) {
        const difficulty = Math.min(1, Math.abs(position) / DIFFICULTY_DISTANCE);
        return lerp(ROW_GAP_EASY, ROW_GAP_HARD, difficulty) + this.rand() * 80;
    }

    // A new row at distance d never blocks every lane, and one of its free lanes is next to
    // (or equal to) a free lane of the previous row of its stream. Each car gets its own
    // speed. `position` (in the conveyor frame) sets the difficulty: rows further from the
    // start, ahead or behind, meet the AIs later in the race and are denser.
    addRow(stream, d, position) {
        const lanes = [...Array(this.road.laneCount).keys()];
        const difficulty = Math.min(1, Math.abs(position) / DIFFICULTY_DISTANCE);
        const maxBlocked = 1 + Math.round(difficulty * (MAX_BLOCKED - 1));
        const count = 1 + Math.floor(this.rand() * maxBlocked);

        let blocked = [];
        for (let attempt = 0; attempt < 30; attempt++) {
            const candidate = this.shuffle(lanes.slice()).slice(0, count);
            const free = lanes.filter(l => !candidate.includes(l));
            if (!stream.previousFree || free.some(b => stream.previousFree.some(a => Math.abs(a - b) <= 1))) {
                blocked = candidate;
                break;
            }
        }
        stream.previousFree = lanes.filter(l => !blocked.includes(l));

        for (const lane of blocked) {
            if (this.cars.some(c => Traffic.sameLane(c, lane) && Math.abs(c.d - d) < CAR_LENGTH * 2)) continue;
            const [slow, fast] = LANE_SPEEDS[Math.abs(lane - this.centreLane)];
            const speed = lerp(slow, fast, this.rand());
            this.cars.push({
                d, lane, targetLane: lane, home: lane, speed, cruise: speed,
                prefersLeft: this.rand() < 0.5, cooldown: 0, born: this.time, exiting: 0,
                signal: 0,               // Indicator: -1 left, 0 off, 1 right
                pending: null,           // Move announced by the indicator: { side, kind, wait }
                signalTime: Math.round(lerp(SIGNAL_TIME[0], SIGNAL_TIME[1], this.rand())),
                whimEvery: Math.round(lerp(WHIM_EVERY[0], WHIM_EVERY[1], this.rand())),
                nextWhim: 0,
                x: 0, y: 0, heading: 0, poly: null,
            });
        }
        this.cars.sort((a, b) => a.d - b.d);
    }

    // Fisher-Yates shuffle with the seeded generator (same seed, same traffic)
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(this.rand() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Lanes taken by a car, as a bit mask: two lanes while it changes lane (none once off the road)
    static laneMask(car) {
        const bit = lane => (lane >= 0 && lane <= 4 ? 1 << lane : 0);
        return bit(Math.floor(car.lane)) | bit(Math.ceil(car.lane));
    }

    // Two cars overlap sideways (with a margin) when their lanes are less than ~0.9 apart
    static sameLane(a, laneB) {
        return Math.abs(a.lane - laneB) < 0.9;
    }

    // Cars whose distance is within `range` of cars[i] (cars are sorted by distance)
    *around(i, range) {
        const d = this.cars[i].d;
        for (let j = i + 1; j < this.cars.length && this.cars[j].d - d < range; j++) yield this.cars[j];
        for (let j = i - 1; j >= 0 && d - this.cars[j].d < range; j--) yield this.cars[j];
    }

    // The closest car ahead of cars[i] that overlaps one of its lanes, within LOOK_AHEAD
    carAhead(i) {
        const car = this.cars[i];
        for (let j = i + 1; j < this.cars.length && this.cars[j].d - car.d < LOOK_AHEAD; j++) {
            const other = this.cars[j];
            if (Traffic.sameLane(other, car.lane) || Traffic.sameLane(other, car.targetLane)) return other;
        }
        return null;
    }

    // Can cars[i] move to the lane next to it, on the `side` (-1 left, +1 right)? To overtake,
    // the target lane must leave more room ahead than the current gap; to go back to its own
    // lane (`currentGap` null), it must have no slower car close ahead.
    canChangeLane(i, side, currentGap) {
        const car = this.cars[i];
        const target = car.lane + side;
        if (target < 0 || target >= this.road.laneCount) return false;

        let mask = (1 << target) | (1 << car.lane);
        for (const other of this.around(i, LOOK_AHEAD)) {
            if (Math.abs(other.d - car.d) < GROUP_WINDOW) mask |= Traffic.laneMask(other);
            if (!Traffic.sameLane(other, target)) continue;
            const gap = other.d - car.d;
            if (gap >= 0) {
                if (currentGap === null) {
                    if (gap - CAR_LENGTH < 40 || (gap < RETURN_CLEAR && other.speed < car.cruise - 0.1)) return false;
                } else if (gap - CAR_LENGTH < currentGap + 40) {
                    // In front in the target lane: must leave more room than the current lane
                    return false;
                }
            } else {
                // Behind in the target lane: must have room to brake, more if it is faster
                const room = -gap - CAR_LENGTH;
                if (room < 40 + Math.max(0, other.speed - car.speed) * 40) return false;
            }
        }
        // Never complete a wall across the road
        return mask !== ALL_LANES_BLOCKED_MASK;
    }

    // One fixed simulation step
    step() {
        this.time++;
        // Rows are laid out as if they all drove at the average speed (like a conveyor belt),
        // and appear well ahead of where the fastest AI could be: never in sight, and
        // independent of the AIs
        const shift = AVERAGE_SPEED * this.time;
        const spawnD = SPAWN_AHEAD + MAX_SPEED * this.time;
        while (this.front.nextRow + shift < spawnD) {
            this.addRow(this.front, this.front.nextRow + shift, this.front.nextRow);
            this.front.nextRow += this.rowGap(this.front.nextRow);
        }
        // Behind: each row enters the road when its place on the belt reaches the rear line
        while (this.rear.nextRow + shift >= REAR_FIRST_ROW) {
            this.addRow(this.rear, REAR_FIRST_ROW, this.rear.nextRow);
            this.rear.nextRow -= this.rowGap(this.rear.nextRow);
        }

        if (this.time % DENSITY_CHECK_EVERY === 0) this.thinOut();

        // From the front to the back: each car reacts to the cars ahead, already moved
        for (let i = this.cars.length - 1; i >= 0; i--) this.drive(i);

        // Cars that took an exit are gone once well beyond the road border
        if (this.cars.some(car => this.beyondBorder(car) >= EXIT_FADE[1])) {
            this.cars = this.cars.filter(car => this.beyondBorder(car) < EXIT_FADE[1]);
        }

        // Keep the order by distance (almost sorted: insertion sort)
        const cars = this.cars;
        for (let i = 1; i < cars.length; i++) {
            const car = cars[i];
            let j = i - 1;
            while (j >= 0 && cars[j].d > car.d) {
                cars[j + 1] = cars[j];
                j--;
            }
            cars[j + 1] = car;
        }
    }

    // How many lanes beyond the road border a car is (0 while on the road)
    beyondBorder(car) {
        return Math.max(0, Math.abs(car.lane - this.centreLane) - this.centreLane - 0.5);
    }

    // Opacity for the display: fades out once off the road after taking an exit
    opacity(car) {
        const beyond = this.beyondBorder(car);
        return beyond <= EXIT_FADE[0] ? 1 : Math.max(0, (EXIT_FADE[1] - beyond) / (EXIT_FADE[1] - EXIT_FADE[0]));
    }

    // Wherever more than DENSITY_MAX cars share DENSITY_WINDOW px, the car of an outer lane
    // that has been on the road the longest takes an exit
    thinOut() {
        const cars = this.cars, outer = this.road.laneCount - 1;
        let j = 0;
        for (let i = 0; i < cars.length; i++) {
            while (j < cars.length && cars[j].d - cars[i].d < DENSITY_WINDOW) j++;
            let count = 0, oldest = null;
            for (let k = i; k < j; k++) {
                const car = cars[k];
                if (car.exiting || (car.pending && car.pending.kind === "exit")) continue;
                count++;
                if ((car.lane === 0 || car.lane === outer) && car.lane === car.targetLane && !car.pending &&
                    (!oldest || car.born < oldest.born)) oldest = car;
            }
            if (count > DENSITY_MAX && oldest) {
                this.announce(oldest, oldest.lane === 0 ? -1 : 1, "exit");
                this.exits++;
                i = j - 1; // One exit per crowded stretch and per check
            }
        }
    }

    // Indicator on: the move itself starts after the driver's delay (see drive)
    announce(car, side, kind) {
        car.pending = { side, kind, wait: 0 };
        car.signal = side;
    }

    drive(i) {
        const car = this.cars[i];
        if (car.cooldown > 0) car.cooldown--;
        const changing = car.lane !== car.targetLane;
        const busy = car.exiting || changing || car.pending;

        // Slower car in front: overtake towards the centre lane if possible, else follow it
        const ahead = this.carAhead(i);
        let wanted = car.cruise;
        if (ahead) {
            const gap = ahead.d - car.d - CAR_LENGTH;
            if (!busy && car.cooldown === 0 && gap < OVERTAKE_GAP && ahead.speed < car.cruise - 0.2) {
                const towardsCentre = Math.sign(this.centreLane - car.lane);
                const sides = towardsCentre ? [towardsCentre] : (car.prefersLeft ? [-1, 1] : [1, -1]);
                const side = sides.find(s => this.canChangeLane(i, s, gap));
                if (side) this.announce(car, side, "overtake");
            }
            if (gap < FOLLOW_GAP + 60) wanted = Math.min(wanted, ahead.speed + (gap - FOLLOW_GAP) * 0.05);
        }

        // Overtaking done: back towards its own (outer) lane when there is room
        if (!busy && car.cooldown === 0 && car.lane !== car.home &&
            !(ahead && ahead.d - car.d - CAR_LENGTH < OVERTAKE_GAP)) {
            const side = Math.sign(car.home - car.lane);
            if (this.canChangeLane(i, side, null)) this.announce(car, side, "return");
        }

        // A lane change for no reason, to a lane next to it where there is room
        if (car.nextWhim === 0) car.nextWhim = this.time + car.whimEvery;
        if (!busy && !car.pending && car.cooldown === 0 && this.time >= car.nextWhim) {
            car.nextWhim = this.time + car.whimEvery;
            const sides = [-1, 1].filter(s => this.canChangeLane(i, s, null));
            if (sides.length) this.announce(car, sides[Math.floor(this.rand() * sides.length)], "whim");
        }

        // Indicator on for long enough: move if there is still room (and, to overtake, still a
        // reason to); otherwise keep waiting a little, then give up
        if (car.pending && ++car.pending.wait >= car.signalTime) {
            const { side, kind, wait } = car.pending;
            let go, stillWanted = true;
            if (kind === "exit") {
                go = true;
            } else if (kind === "overtake") {
                const gap = ahead ? ahead.d - car.d - CAR_LENGTH : Infinity;
                stillWanted = ahead && gap < OVERTAKE_GAP + 60 && ahead.speed < car.cruise - 0.2;
                go = stillWanted && this.canChangeLane(i, side, gap);
            } else {
                go = this.canChangeLane(i, side, null);
            }
            if (go) {
                if (kind === "exit") car.exiting = side;
                else car.targetLane = car.lane + side;
                car.pending = null;
                car.cooldown = kind === "whim"
                    ? Math.round(lerp(WHIM_STAY[0], WHIM_STAY[1], this.rand()))
                    : LANE_CHANGE_COOLDOWN;
            } else if (!stillWanted || wait > car.signalTime + SIGNAL_GIVE_UP) {
                car.pending = null;
                car.signal = 0;
                car.cooldown = LANE_CHANGE_COOLDOWN;
            }
        }

        // Never close a wall across the road: hold back behind a group that already takes 4 lanes
        let groupMask = Traffic.laneMask(car) | Traffic.laneMask({ lane: car.targetLane });
        let groupSpeed = Infinity;
        for (let j = i + 1; j < this.cars.length && this.cars[j].d - car.d < GROUP_WINDOW + 20; j++) {
            groupMask |= Traffic.laneMask(this.cars[j]);
            groupSpeed = Math.min(groupSpeed, this.cars[j].speed);
        }
        if (groupMask === ALL_LANES_BLOCKED_MASK) wanted = Math.min(wanted, groupSpeed);

        wanted = Math.max(0, wanted);
        car.speed += Math.max(-DECEL, Math.min(ACCEL, wanted - car.speed));
        car.d += car.speed;
        if (ahead) car.d = Math.min(car.d, ahead.d - CAR_LENGTH - 4); // Never through the car in front

        // Sideways move during a lane change, or towards the roadside when taking an exit
        let slope = 0;
        if (car.exiting) {
            car.lane += car.exiting * Math.max(0.3, car.speed * LANE_CHANGE_SLOPE) / this.road.laneWidth(car.d);
            car.targetLane = car.lane;
            slope = car.exiting * Math.atan(LANE_CHANGE_SLOPE);
        } else if (car.lane !== car.targetLane) {
            const sideways = Math.max(0.3, car.speed * LANE_CHANGE_SLOPE) / this.road.laneWidth(car.d);
            const direction = Math.sign(car.targetLane - car.lane);
            car.lane += direction * sideways;
            if ((car.targetLane - car.lane) * direction <= 0) car.lane = car.targetLane;
            else slope = direction * Math.atan(LANE_CHANGE_SLOPE);
        }
        if (!car.exiting && !car.pending && car.lane === car.targetLane) car.signal = 0; // Lane change done
        car.heading = this.road.heading(car.d) + slope;
        car.x = this.road.laneX(car.lane, car.d);
        car.y = -car.d;
        car.poly = null; // Computed only when needed
    }

    // The traffic cars between dMin and dMax, for the sensors, collisions and display
    collect(dMin, dMax) {
        let lo = 0, hi = this.cars.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (this.cars[mid].d < dMin) lo = mid + 1; else hi = mid;
        }
        this.active = [];
        for (let i = lo; i < this.cars.length && this.cars[i].d <= dMax; i++) {
            const car = this.cars[i];
            if (!car.poly) car.poly = carPolygon(car.x, car.y, car.heading, CAR_WIDTH, CAR_LENGTH);
            this.active.push(car);
        }
    }
}
