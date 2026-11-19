// Neural Race 2: a winding procedural road, 5 lanes, and AI cars that must overtake

// ---------- Helpers ----------
function lerp(A, B, t) {
    return A + (B - A) * t;
}

function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

function getIntersection(A, B, C, D) {
    const den = (A.x - B.x) * (C.y - D.y) - (A.y - B.y) * (C.x - D.x);
    if (den == 0) {
        return null;
    }

    const t = ((A.x - C.x) * (C.y - D.y) - (A.y - C.y) * (C.x - D.x)) / den;
    const u = -((A.x - B.x) * (A.y - C.y) - (A.y - B.y) * (A.x - C.x)) / den;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
            x: A.x + (B.x - A.x) * t,
            y: A.y + (B.y - A.y) * t,
            offset: t
        }
    }
    return null;
}

function polysIntersect(poly1, poly2) {
    for (let i = 0; i < poly1.length; i++) {
        for (let j = 0; j < poly2.length; j++) {
            const touch = getIntersection(
                poly1[i],
                poly1[(i + 1) % poly1.length],
                poly2[j],
                poly2[(j + 1) % poly2.length]
            );
            if (touch) {
                return true;
            }
        }
    }
    return false;
}

// Small seeded random generator, so a road can be replayed with ?seed=123
function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ---------- Road ----------
// The road goes up (towards negative y). Its centre line is a sum of sines with
// unrelated wavelengths: smooth, infinite, never repeating, and nothing to store.
class Road {
    constructor(laneCount, laneWidth, seed) {
        this.laneCount = laneCount;
        this.laneWidth = laneWidth;
        this.width = laneCount * laneWidth;

        const rand = mulberry32(seed);
        this.waves = [
            { amp: 110, len: 1900, phase: rand() * Math.PI * 2 },
            { amp: 50, len: 830, phase: rand() * Math.PI * 2 },
            { amp: 18, len: 370, phase: rand() * Math.PI * 2 }
        ];
    }

    // Curves fade in over the first ROAD_STRAIGHT_START px: the race starts straight
    centerX(y) {
        const distance = Math.max(0, -y);
        const ramp = distance >= ROAD_STRAIGHT_START ? 1 : smoothstep(distance / ROAD_STRAIGHT_START);
        let x = 0;
        for (const w of this.waves) {
            x += w.amp * (Math.sin(y / w.len * Math.PI * 2 + w.phase) - Math.sin(w.phase));
        }
        return x * ramp;
    }

    // Angle a car must have to follow the road at this y (same convention as Car.angle)
    headingAt(y) {
        return Math.atan((this.centerX(y + 1) - this.centerX(y - 1)) / 2);
    }

    leftX(y) {
        return this.centerX(y) - this.width / 2;
    }

    rightX(y) {
        return this.centerX(y) + this.width / 2;
    }

    laneCenter(lane, y) {
        return this.leftX(y) + this.laneWidth * (lane + 0.5);
    }

    // Border segments between yMin and yMax, on a fixed grid so they are the same for everyone
    bordersNear(yMin, yMax) {
        const segments = [];
        const first = Math.floor(yMin / ROAD_SEGMENT);
        const last = Math.ceil(yMax / ROAD_SEGMENT);
        for (let i = first; i < last; i++) {
            const y0 = i * ROAD_SEGMENT;
            const y1 = y0 + ROAD_SEGMENT;
            const c0 = this.centerX(y0);
            const c1 = this.centerX(y1);
            const h = this.width / 2;
            segments.push([{ x: c0 - h, y: y0 }, { x: c1 - h, y: y1 }]);
            segments.push([{ x: c0 + h, y: y0 }, { x: c1 + h, y: y1 }]);
        }
        return segments;
    }

    draw(ctx, yMin, yMax) {
        const step = 20;
        const ys = [];
        for (let y = Math.floor(yMin / step) * step; y <= yMax + step; y += step) {
            ys.push(y);
        }

        // Road surface
        ctx.fillStyle = "#444";
        ctx.beginPath();
        ys.forEach((y, i) => i ? ctx.lineTo(this.leftX(y), y) : ctx.moveTo(this.leftX(y), y));
        for (let i = ys.length - 1; i >= 0; i--) {
            ctx.lineTo(this.rightX(ys[i]), ys[i]);
        }
        ctx.fill();

        // Lane markings, then borders
        ctx.lineWidth = 4;
        ctx.strokeStyle = "white";
        for (let lane = 0; lane <= this.laneCount; lane++) {
            const isBorder = lane === 0 || lane === this.laneCount;
            ctx.setLineDash(isBorder ? [] : [20, 20]);
            ctx.lineWidth = isBorder ? 5 : 3;
            ctx.beginPath();
            ys.forEach((y, i) => {
                const x = this.leftX(y) + lane * this.laneWidth;
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            });
            ctx.stroke();
        }
        ctx.setLineDash([]);
    }
}

// ---------- Controls ----------
class Controls {
    constructor(controlType) {
        this.forward = false;
        this.left = false;
        this.right = false;
        this.reverse = false;

        switch (controlType) {
            case "PLAYER":
                this.addKeyboardListeners();
                break;
            case "DUMMY":
                this.forward = true;
                break;
            case "AI":
                break;
        }
    }

    addKeyboardListeners() {
        const keys = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "forward", ArrowDown: "reverse" };
        document.addEventListener("keydown", event => {
            if (keys[event.key]) {
                this[keys[event.key]] = true;
                playerActive = true; // The camera now follows the player
            }
        });
        document.addEventListener("keyup", event => {
            if (keys[event.key]) this[keys[event.key]] = false;
        });
    }
}

// ---------- Sensor ----------
class Sensor {
    constructor(car) {
        this.car = car;
        this.rayCount = 7;
        this.rayLength = 220;
        this.raySpread = Math.PI * 2 / 3; // 60 degrees each side: sees the neighbouring lanes

        this.rays = [];
        this.readings = [];
    }

    update(borders, obstacles) {
        this.castRays();
        this.readings = this.rays.map(ray => this.getReading(ray, borders, obstacles));
    }

    getReading(ray, borders, obstacles) {
        let closest = null;
        const consider = touch => {
            if (touch && (!closest || touch.offset < closest.offset)) closest = touch;
        };

        for (const border of borders) {
            consider(getIntersection(ray[0], ray[1], border[0], border[1]));
        }
        for (const obstacle of obstacles) {
            const poly = obstacle.polygon;
            for (let j = 0; j < poly.length; j++) {
                consider(getIntersection(ray[0], ray[1], poly[j], poly[(j + 1) % poly.length]));
            }
        }
        return closest;
    }

    castRays() {
        this.rays = [];
        for (let i = 0; i < this.rayCount; i++) {
            const rayAngle = lerp(
                this.raySpread / 2,
                -this.raySpread / 2,
                this.rayCount == 1 ? 0.5 : i / (this.rayCount - 1)
            ) + this.car.angle;

            const start = { x: this.car.x, y: this.car.y };
            const end = {
                x: this.car.x - Math.sin(rayAngle) * this.rayLength,
                y: this.car.y - Math.cos(rayAngle) * this.rayLength
            };
            this.rays.push([start, end]);
        }
    }

    draw(ctx) {
        for (let i = 0; i < this.rays.length; i++) {
            const [start, rayEnd] = this.rays[i];
            const end = this.readings[i] || rayEnd;

            ctx.lineWidth = 2;
            ctx.strokeStyle = "yellow";
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();

            ctx.strokeStyle = "black";
            ctx.beginPath();
            ctx.moveTo(rayEnd.x, rayEnd.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        }
    }
}

// ---------- Car ----------
class Car {
    constructor(x, y, controlType, maxSpeed = CAR_MAX_SPEED, lane = null) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 50;
        this.controlType = controlType;
        this.lane = lane; // Traffic only: the lane it follows

        this.speed = 0;
        this.acceleration = 0.3;
        this.maxSpeed = maxSpeed;
        this.friction = 0.15;
        this.turnRate = 0.05;
        this.angle = 0;
        this.damaged = false;
        this.age = 0; // Frames since spawn
        this.generation = 1; // Lineage depth of its brain (parent's generation + 1)
        this.avgSpeed = maxSpeed; // Moving average, starts optimistic so a new car has time to speed up

        if (controlType != "DUMMY") {
            this.sensor = new Sensor(this);
            // Inputs: one per ray + the car's own speed
            this.brain = new NeuralNetwork(BRAIN_SHAPE);
        }
        this.controls = new Controls(controlType);
        this.polygon = this.createPolygon();
    }

    // Phase 1 of a frame: move once and rebuild the polygon
    step() {
        if (!this.damaged || this.controlType === "PLAYER") {
            this.move();
            if (this.controlType === "DUMMY") {
                // Traffic simply follows its lane along the curves
                this.x = road.laneCenter(this.lane, this.y);
                this.angle = road.headingAt(this.y);
            }
        }
        this.polygon = this.createPolygon();
        this.age++;
        this.avgSpeed += (this.speed - this.avgSpeed) / SLOW_WINDOW_FRAMES;
    }

    // Phase 2 of a frame, once every car has moved: collisions, sensors, decision
    sense(obstacles) {
        if (this.controlType === "DUMMY" || (this.damaged && this.controlType !== "PLAYER")) {
            return;
        }
        const reach = this.sensor.rayLength + ROAD_SEGMENT;
        const near = obstacles.filter(o => Math.abs(o.y - this.y) < reach);

        if (!this.damaged) {
            this.damaged = this.assessDamage(near);
        }
        this.sensor.update(road.bordersNear(this.y - reach, this.y + reach), near);
        if (!this.damaged && this.controlType === "AI") {
            this.think();
        }
    }

    think() {
        const inputs = this.sensor.readings.map(s => s == null ? 0 : 1 - s.offset);
        inputs.push(this.speed / this.maxSpeed);
        const outputs = NeuralNetwork.feedForward(inputs, this.brain);

        this.controls.forward = outputs[0] > -0.00001;
        this.controls.left = outputs[1] > 0.0002;
        this.controls.right = outputs[2] > 0.0002;
        this.controls.reverse = outputs[3] > 0.000075;

        // Add bias: AI should prefer moving forward
        if (!this.controls.forward && !this.controls.reverse) {
            this.controls.forward = true;
        }

        // Prevent simultaneous left/right conflicts
        if (this.controls.left && this.controls.right) {
            if (Math.abs(outputs[1]) > Math.abs(outputs[2])) {
                this.controls.right = false;
            } else {
                this.controls.left = false;
            }
        }
    }

    assessDamage(obstacles) {
        const borders = road.bordersNear(this.y - this.height, this.y + this.height);
        for (const border of borders) {
            if (polysIntersect(this.polygon, border)) {
                return true;
            }
        }
        for (const other of obstacles) {
            // AI cars don't die when colliding with the PLAYER
            if (this.controlType === "AI" && other.controlType === "PLAYER") {
                continue;
            }
            if (polysIntersect(this.polygon, other.polygon)) {
                return true;
            }
        }
        return false;
    }

    createPolygon() {
        const points = [];
        const rad = Math.hypot(this.width, this.height) / 2;
        const alpha = Math.atan2(this.width, this.height);
        for (const a of [this.angle - alpha, this.angle + alpha, Math.PI + this.angle - alpha, Math.PI + this.angle + alpha]) {
            points.push({
                x: this.x - Math.sin(a) * rad,
                y: this.y - Math.cos(a) * rad
            });
        }
        return points;
    }

    move() {
        if (this.controls.forward) {
            this.speed += this.acceleration;
        }
        if (this.controls.reverse) {
            this.speed -= this.acceleration;
        }

        if (this.speed > this.maxSpeed) {
            this.speed = this.maxSpeed;
        }
        if (this.speed < -this.maxSpeed / 2) {
            this.speed = -this.maxSpeed / 2;
        }

        if (this.speed > 0) {
            this.speed -= this.friction;
        }
        if (this.speed < 0) {
            this.speed += this.friction;
        }
        if (Math.abs(this.speed) < this.friction) {
            this.speed = 0;
        }

        if (this.speed != 0) {
            const flip = this.speed > 0 ? 1 : -1;
            if (this.controls.left) {
                this.angle += this.turnRate * flip;
            }
            if (this.controls.right) {
                this.angle -= this.turnRate * flip;
            }
        }

        this.x -= Math.sin(this.angle) * this.speed;
        this.y -= Math.cos(this.angle) * this.speed;
    }

    draw(ctx, color, withSensor = false) {
        ctx.fillStyle = this.damaged ? "gray" : color;
        ctx.beginPath();
        ctx.moveTo(this.polygon[0].x, this.polygon[0].y);
        for (let i = 1; i < this.polygon.length; i++) {
            ctx.lineTo(this.polygon[i].x, this.polygon[i].y);
        }
        ctx.fill();

        if (withSensor && this.sensor) {
            this.sensor.draw(ctx);
        }
    }
}

// ---------- Neural network ----------
class NeuralNetwork {
    constructor(neuronCounts) {
        this.levels = [];
        for (let i = 0; i < neuronCounts.length - 1; i++) {
            this.levels.push(new Level(
                neuronCounts[i],
                neuronCounts[i + 1]
            ));
        }
    }

    static feedForward(givenInputs, network) {
        let outputs = Level.feedForward(
            givenInputs,
            network.levels[0]
        );

        for (let i = 1; i < network.levels.length; i++) {
            outputs = Level.feedForward(
                outputs,
                network.levels[i]
            );
        }
        return outputs;
    }

    static mutate(network, amount = 1) {
        network.levels.forEach(level => {
            for (let i = 0; i < level.biases.length; i++) {
                level.biases[i] = lerp(
                    level.biases[i],
                    Math.random() * 2 - 1,
                    amount
                )
            }
            for (let i = 0; i < level.weights.length; i++) {
                for (let j = 0; j < level.weights[i].length; j++) {
                    level.weights[i][j] = lerp(
                        level.weights[i][j],
                        Math.random() * 2 - 1,
                        amount
                    )
                }
            }
        });
    }
}

class Level {
    constructor(inputCount, outputCount) {
        this.inputs = new Array(inputCount);
        this.outputs = new Array(outputCount);
        this.biases = new Array(outputCount);

        this.weights = [];
        for (let i = 0; i < inputCount; i++) {
            this.weights[i] = new Array(outputCount);
        }

        Level.randomize(this);
    }

    static randomize(level) {
        for (let i = 0; i < level.inputs.length; i++) {
            for (let j = 0; j < level.outputs.length; j++) {
                level.weights[i][j] = Math.random() * 2 - 1;
            }
        }

        for (let i = 0; i < level.biases.length; i++) {
            level.biases[i] = Math.random() * 2 - 1;
        }
    }

    static feedForward(givenInputs, level) {
        for (let i = 0; i < level.inputs.length; i++) {
            level.inputs[i] = givenInputs[i];
        }

        for (let i = 0; i < level.outputs.length; i++) {
            let sum = 0;
            for (let j = 0; j < level.inputs.length; j++) {
                sum += level.inputs[j] * level.weights[j][i];
            }
            level.outputs[i] = Math.tanh(sum + level.biases[i]);
        }

        return level.outputs;
    }
}

// ---------- Saved brain ----------
function loadBrain() {
    try {
        const brain = JSON.parse(localStorage.getItem(BRAIN_STORAGE_KEY));
        // Only keep a brain that has the current network shape
        const ok = brain && brain.levels.length === BRAIN_SHAPE.length - 1 &&
            brain.levels.every((l, i) => l.weights.length === BRAIN_SHAPE[i] && l.biases.length === BRAIN_SHAPE[i + 1]);
        return ok ? brain : null;
    } catch {
        return null;
    }
}

function storeBrain(car) {
    localStorage.setItem(BRAIN_STORAGE_KEY, JSON.stringify(car.brain));
    localStorage.setItem(GENERATION_STORAGE_KEY, String(car.generation));
}

function save() {
    const car = recordHolder || bestCar;
    if (car && car.brain) {
        storeBrain(car);
        console.log("💾 Brain saved manually");
    }
}

function discard() {
    localStorage.removeItem(BRAIN_STORAGE_KEY);
    localStorage.removeItem(GENERATION_STORAGE_KEY);
    console.log("🗑️ Saved brain discarded");
}

// ---------- Traffic ----------
// 0 at the start, 1 after DIFFICULTY_DISTANCE: denser rows, closer together
function difficultyAt(y) {
    return Math.min(1, Math.max(0, -y) / DIFFICULTY_DISTANCE);
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// A row blocks a few lanes, never all of them, and keeps one of its free lanes
// next to (or equal to) a free lane of the previous row: always passable
function spawnTrafficRow(y, previousFreeLanes) {
    const lanes = [...Array(road.laneCount).keys()];
    const maxBlocked = 1 + Math.round(difficultyAt(y) * (TRAFFIC_MAX_BLOCKED - 1));
    const blockedCount = 1 + Math.floor(Math.random() * maxBlocked);

    let blocked = [];
    let free = lanes;
    for (let attempt = 0; attempt < 30; attempt++) {
        blocked = shuffle([...lanes]).slice(0, blockedCount);
        free = lanes.filter(l => !blocked.includes(l));
        const reachable = !previousFreeLanes ||
            free.some(b => previousFreeLanes.some(a => Math.abs(a - b) <= 1));
        if (reachable) break;
        blocked = [];
        free = lanes;
    }

    for (const lane of blocked) {
        const car = new Car(road.laneCenter(lane, y), y, "DUMMY", TRAFFIC_SPEED, lane);
        car.angle = road.headingAt(y);
        car.polygon = car.createPolygon();
        traffic.push(car);
    }
    return free;
}

// Highest (furthest) traffic car; traffic all drives at the same speed, so the
// spacing between rows set at spawn time is kept
function trafficTopY() {
    return traffic.reduce((top, c) => Math.min(top, c.y), Infinity);
}

function updateTrafficSpawning() {
    const leadY = Math.min(playerCar.y, bestCar.y);
    const topY = trafficTopY();

    // Keep traffic up to TRAFFIC_SPAWN_DISTANCE ahead, spawned off-screen, one row at a time
    if (topY > leadY - TRAFFIC_SPAWN_DISTANCE) {
        const d = difficultyAt(leadY);
        const gap = lerp(TRAFFIC_ROW_GAP_EASY, TRAFFIC_ROW_GAP_HARD, d) + Math.random() * 80;
        const y = Math.min(topY - gap, leadY - TRAFFIC_SPAWN_DISTANCE);
        // Far enough from the previous row to reach any lane: no constraint needed
        const constraint = topY - y > gap + 400 ? null : lastRowFreeLanes;
        lastRowFreeLanes = spawnTrafficRow(y, constraint);
    }

    // Remove traffic far behind the AI lead and far from the player (camera follows the player)
    for (let i = traffic.length - 1; i >= 0; i--) {
        const t = traffic[i];
        const farBehindLead = t.y > bestCar.y + TRAFFIC_REMOVE_DISTANCE;
        const farFromPlayer = Math.abs(t.y - playerCar.y) > TRAFFIC_REMOVE_DISTANCE;
        if (farBehindLead && farFromPlayer) {
            traffic.splice(i, 1);
        }
    }
}

// ---------- AI population ----------
// Find a free spot just behind the lead car (spawning ahead of it would make every
// other car "too far behind"), never on top of a traffic car
function findSpawnPoint() {
    const baseY = cars.length > 0 ? Math.min(...cars.map(c => c.y)) + 120 : playerCar.y;
    for (const dy of [0, 150, 300]) {
        for (const lane of SPAWN_LANE_ORDER) {
            const y = baseY + dy;
            const blocked = traffic.some(t => t.lane === lane && Math.abs(t.y - y) < SPAWN_CLEARANCE);
            if (!blocked) return { x: road.laneCenter(lane, y), y };
        }
    }
    return null;
}

function newAICar(x, y, parentBrain, parentGeneration) {
    const car = new Car(x, y, "AI");
    car.angle = road.headingAt(y);
    car.polygon = car.createPolygon();
    if (parentBrain) {
        car.brain = JSON.parse(JSON.stringify(parentBrain));
        car.generation = parentGeneration + 1;

        // Stratégie de mutation variée
        const rand = Math.random();
        if (rand < 0.05) {
            // 5% élite: pas de mutation
        } else if (rand < 0.30) {
            NeuralNetwork.mutate(car.brain, 0.05); // 25% mutation légère
        } else if (rand < 0.70) {
            NeuralNetwork.mutate(car.brain, 0.15); // 40% mutation moyenne
        } else if (rand < 0.90) {
            NeuralNetwork.mutate(car.brain, 0.35); // 20% mutation forte
        } else {
            NeuralNetwork.mutate(car.brain, 0.7); // 10% exploration extrême
        }
    }
    totalCarsSpawned++;
    return car;
}

function spawnNewCar() {
    const spot = findSpawnPoint();
    if (!spot) return null; // No free spot this frame, try again on the next one
    const parent = globalBestBrain || loadBrain();
    return newAICar(spot.x, spot.y, parent, recordHolder ? recordHolder.generation : generation);
}

// ---------- Main loop ----------
function animate() {
    // Phase 1: everybody moves once
    playerCar.step();
    traffic.forEach(t => t.step());
    cars.forEach(c => c.step());

    // Phase 2: collisions, sensors and decisions (AI cars do not see each other)
    // The player and the AI cars drive through each other: only traffic and borders hurt
    const obstacles = traffic.concat([playerCar]);
    playerCar.sense(traffic);
    cars.forEach(c => c.sense(obstacles));

    // Lead car: the furthest AI car still alive (single pass)
    bestCar = cars.reduce(
        (best, c) => !c.damaged && (!best || c.y < best.y) ? c : best,
        null
    ) || cars[0] || bestCar;

    // Update best brain ever (a car still in its spawn grace period has proven nothing yet)
    if (!bestCar.damaged && bestCar.age > SPAWN_GRACE_FRAMES) {
        const currentBestDistance = -bestCar.y;
        if (currentBestDistance > bestDistance) {
            bestDistance = currentBestDistance;
            // A brain never changes during a car's life: copy and save it only when
            // a new car takes the record
            if (bestCar !== recordHolder) {
                recordHolder = bestCar;
                globalBestBrain = JSON.parse(JSON.stringify(bestCar.brain));
                storeBrain(bestCar);
                if (bestCar.generation > generation) {
                    generation = bestCar.generation;
                    console.log(`🏆 New generation ${generation}: ${currentBestDistance.toFixed(0)}px (car #${totalCarsSpawned})`);
                }
            }
        }
    }

    // Selection: a car dies if it crashed, fell too far behind, stopped,
    // or stayed too slow for a while (e.g. stuck behind a traffic car instead of overtaking)
    for (const car of cars) {
        if (car.damaged) continue;
        const tooFarBehind = car.y - bestCar.y > MAX_LAG_DISTANCE;
        const stalled = car.age > SPAWN_GRACE_FRAMES && Math.abs(car.speed) < 0.05;
        const tooSlow = car.age > SPAWN_GRACE_FRAMES && car.avgSpeed < SLOW_RATIO * car.maxSpeed;
        if (tooFarBehind || stalled || tooSlow) {
            car.damaged = true;
            if (tooSlow && !stalled) slowDeaths++;
        }
    }

    // Continuous learning: replace dead cars
    for (let i = cars.length - 1; i >= 0; i--) {
        if (cars[i].damaged) {
            cars.splice(i, 1);
        }
    }
    while (cars.length < N) {
        const newCar = spawnNewCar();
        if (!newCar) break;
        cars.push(newCar);
    }

    updateTrafficSpawning();
    render();

    requestAnimationFrame(animate);
}

function render() {
    canvas.height = window.innerHeight;
    // The camera follows the AI lead until the player takes the wheel
    const target = playerActive ? playerCar : bestCar;
    cameraX = lerp(cameraX, road.centerX(target.y), 0.1);
    const top = target.y - canvas.height * 0.7;
    const bottom = target.y + canvas.height * 0.3;

    ctx.fillStyle = "#2b3a2b"; // Grass
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2 - cameraX, -top);

    road.draw(ctx, top, bottom);
    traffic.forEach(t => t.draw(ctx, "red"));

    ctx.globalAlpha = 0.35;
    cars.forEach(c => c !== bestCar && c.draw(ctx, "darkblue"));
    ctx.globalAlpha = 1;
    if (cars.includes(bestCar)) bestCar.draw(ctx, "darkblue", true);
    playerCar.draw(ctx, "blue", true);

    ctx.restore();

    document.getElementById('generation').textContent = generation;
    document.getElementById('bestDistance').textContent = bestDistance.toFixed(0);
    document.getElementById('alive').textContent = `${cars.filter(c => !c.damaged).length}/${N}`;
    document.getElementById('tried').textContent = totalCarsSpawned;
}

// ---------- Setup ----------
const ROAD_LANES = 5;
const ROAD_LANE_WIDTH = 56;
const ROAD_SEGMENT = 30; // Border segment length used for collisions and sensors
const ROAD_STRAIGHT_START = 1500; // Curves fade in over this distance

const CAR_MAX_SPEED = 5;
const TRAFFIC_SPEED = 2.5;
const N = 25; // Number of AI cars
const BRAIN_SHAPE = [7 + 1, 8, 6, 4]; // 7 rays + own speed → 4 controls
const BRAIN_STORAGE_KEY = "neuralRace04.bestBrain";
const GENERATION_STORAGE_KEY = "neuralRace04.generation";

const TRAFFIC_SPAWN_DISTANCE = 1000; // Spawn traffic this far ahead
const TRAFFIC_REMOVE_DISTANCE = 1800; // Remove traffic this far behind
const TRAFFIC_ROW_GAP_EASY = 320; // Distance between two rows at the start…
const TRAFFIC_ROW_GAP_HARD = 200; // …and once the difficulty is maxed out
const TRAFFIC_MAX_BLOCKED = 3; // Max lanes blocked by one row (out of 5)
const DIFFICULTY_DISTANCE = 20000; // Distance at which traffic reaches its max density

const MAX_LAG_DISTANCE = 700; // Max distance behind the lead before being eliminated
const SPAWN_GRACE_FRAMES = 60; // ~1s for a new car to start before it can be judged
const SPAWN_CLEARANCE = 150; // Min distance to traffic in the lane where a new AI car appears
const SPAWN_LANE_ORDER = [2, 1, 3, 0, 4]; // Middle lanes first
const SLOW_WINDOW_FRAMES = 120; // Speed is averaged over ~2s…
const SLOW_RATIO = 0.6; // …and must stay above 60% of the max speed

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed")) || Math.floor(Math.random() * 1e9);
console.log(`🛣️ Road seed: ${seed} (replay it with ?seed=${seed})`);

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const CANVAS_MAX_WIDTH = 640;
canvas.width = Math.min(window.innerWidth - 20, CANVAS_MAX_WIDTH);
window.onresize = () => {
    canvas.width = Math.min(window.innerWidth - 20, CANVAS_MAX_WIDTH);
};

const road = new Road(ROAD_LANES, ROAD_LANE_WIDTH, seed);
let cameraX = 0;
let playerActive = false; // Becomes true on the first arrow key

const traffic = [];
let lastRowFreeLanes = null;

const playerCar = new Car(road.laneCenter(2, 0), 0, "PLAYER");
const savedBrain = loadBrain();
let generation = savedBrain ? Number(localStorage.getItem(GENERATION_STORAGE_KEY)) || 1 : 1;
let bestDistance = 0;
let totalCarsSpawned = 0;
let globalBestBrain = null;
let recordHolder = null; // Car whose brain is the current best one
let slowDeaths = 0; // Cars eliminated for driving too slowly (debug/stats)

// First population: around the middle lane, from the saved brain if there is one
const cars = [];
for (let i = 0; i < N; i++) {
    const car = newAICar(road.laneCenter(2, 0) + (i - N / 2) * 2, 0, savedBrain, generation - 1);
    if (savedBrain && i === 0) car.brain = JSON.parse(JSON.stringify(savedBrain)); // Keep one exact copy
    cars.push(car);
}
let bestCar = cars[0];

// Initial traffic, starting a little ahead of the start line
let initialRowY = -300;
for (let i = 0; i < 4; i++) {
    lastRowFreeLanes = spawnTrafficRow(initialRowY, lastRowFreeLanes);
    initialRowY -= TRAFFIC_ROW_GAP_EASY;
}

animate();
