// Helper functions
function lerp(A, B, t) {
    return A + (B - A) * t;
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

function getRGBA(value) {
    const alpha = Math.abs(value);
    const R = value < 0 ? 0 : 255;
    const G = R;
    const B = value > 0 ? 0 : 255;
    return "rgba(" + R + "," + G + "," + B + "," + alpha + ")";
}

// Class definitions
class Road {
    constructor(x, width, laneCount = 3) {
        this.x = x;
        this.width = width;
        this.laneCount = laneCount;

        this.left = x - width / 2;
        this.right = x + width / 2;

        const infinity = 1000000;
        this.top = -infinity;
        this.bottom = infinity;

        const topLeft = { x: this.left, y: this.top };
        const topRight = { x: this.right, y: this.top };
        const bottomLeft = { x: this.left, y: this.bottom };
        const bottomRight = { x: this.right, y: this.bottom };
        this.borders = [
            [topLeft, bottomLeft],
            [topRight, bottomRight]
        ];
    }

    getLaneCenter(laneIndex) {
        const laneWidth = this.width / this.laneCount;
        return this.left + laneWidth / 2 + 
            Math.min(laneIndex, this.laneCount - 1) * laneWidth;
    }

    draw(ctx) {
        ctx.lineWidth = 5;
        ctx.strokeStyle = "white";

        for (let i = 1; i <= this.laneCount - 1; i++) {
            const x = lerp(
                this.left,
                this.right,
                i / this.laneCount
            );

            ctx.setLineDash([20, 20]);
            ctx.beginPath();
            ctx.moveTo(x, this.top);
            ctx.lineTo(x, this.bottom);
            ctx.stroke();
        }

        ctx.setLineDash([]);
        this.borders.forEach(border => {
            ctx.beginPath();
            ctx.moveTo(border[0].x, border[0].y);
            ctx.lineTo(border[1].x, border[1].y);
            ctx.stroke();
        });
    }
}

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
        console.log("Adding keyboard listeners for PLAYER controls.");
        document.onkeydown = (event) => {
            console.log(`Key Down: ${event.key}`)
            switch (event.key) {
                case "ArrowLeft":
                    this.left = true;
                    break;
                case "ArrowRight":
                    this.right = true;
                    break;
                case "ArrowUp":
                    this.forward = true;
                    break;
                case "ArrowDown":
                    this.reverse = true;
                    break;
            }
        }
        document.onkeyup = (event) => {
            console.log(`Key Up: ${event.key}`)
            switch (event.key) {
                case "ArrowLeft":
                    this.left = false;
                    break;
                case "ArrowRight":
                    this.right = false;
                    break;
                case "ArrowUp":
                    this.forward = false;
                    break;
                case "ArrowDown":
                    this.reverse = false;
                    break;
            }
            
        }
    }
}

class Sensor {
    constructor(car) {
        this.car = car;
        this.rayCount = 5;
        this.rayLength = 150;
        this.raySpread = Math.PI / 2; // 45 degrees each side

        this.rays = [];
        this.readings = [];
    }

    update(roadBorders, traffic) {
        this.castRays();
        this.readings = [];
        for (let i = 0; i < this.rays.length; i++) {
            this.readings.push(
                this.getReading(this.rays[i], roadBorders, traffic)
            );
        }
    }

    getReading(ray, roadBorders, traffic) {
        let touches = [];

        for (let i = 0; i < roadBorders.length; i++) {
            const touch = getIntersection(
                ray[0],
                ray[1],
                roadBorders[i][0],
                roadBorders[i][1]
            );
            if (touch) {
                touches.push(touch);
            }
        }

        for (let i = 0; i < traffic.length; i++) {
            const poly = traffic[i].polygon;
            for (let j = 0; j < poly.length; j++) {
                const value = getIntersection(
                    ray[0],
                    ray[1],
                    poly[j],
                    poly[(j + 1) % poly.length]
                );
                if (value) {
                    touches.push(value);
                }
            }
        }

        if (touches.length == 0) {
            return null;
        } else {
            const offsets = touches.map(e => e.offset);
            const minOffset = Math.min(...offsets);
            return touches.find(e => e.offset == minOffset);
        }
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
        for (let i = 0; i < this.rayCount; i++) {
            let end = this.rays[i][1];
            if (this.readings[i]) {
                end = this.readings[i];
            }

            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "yellow";
            ctx.moveTo(
                this.rays[i][0].x,
                this.rays[i][0].y
            );
            ctx.lineTo(
                end.x,
                end.y
            );
            ctx.stroke();

            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "black";
            ctx.moveTo(
                this.rays[i][1].x,
                this.rays[i][1].y
            );
            ctx.lineTo(
                end.x,
                end.y
            );
            ctx.stroke();
        }
    }
}

class Car {
    constructor(x, y, width, height, controlType, maxSpeed = 3) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.controlType = controlType;

        this.speed = 0;
        this.acceleration = 0.15;
        this.maxSpeed = maxSpeed;
        this.friction = 0.075;
        this.angle = 0;
        this.damaged = false;
        this.age = 0; // Frames since spawn
        this.generation = 1; // Lineage depth of its brain (parent's generation + 1)

        if (controlType != "DUMMY") {
            this.sensor = new Sensor(this);
            this.brain = new NeuralNetwork(
                [this.sensor.rayCount, 6, 6, 4]
            );
        }
        this.controls = new Controls(controlType);
    }

    update(roadBorders, traffic, doDamageAssessment = true) {
        if (!this.damaged || this.controlType === 'PLAYER') {
            this.move();
            this.polygon = this.createPolygon();
            if (doDamageAssessment) {
                this.damaged = this.assessDamage(roadBorders, traffic);
            }
        } else {
            this.polygon = this.createPolygon();
        }
        if (this.sensor) {
            this.sensor.update(roadBorders, traffic);
            if (!this.damaged && doDamageAssessment && this.controlType === "AI") {
                const offsets = this.sensor.readings.map(
                    s => s == null ? 0 : 1 - s.offset
                );
                const outputs = NeuralNetwork.feedForward(offsets, this.brain);
                
                // For binary activation
                // this.controls.forward = outputs[0];
                // this.controls.left = outputs[1];
                // this.controls.right = outputs[2];
                // this.controls.reverse = outputs[3];

                // For Tanh activation
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
        }
    }

    assessDamage(roadBorders, traffic) {
        for (let i = 0; i < roadBorders.length; i++) {
            if (polysIntersect(this.polygon, roadBorders[i])) {
                return true;
            }
        }
        for (let i = 0; i < traffic.length; i++) {
            if (polysIntersect(this.polygon, traffic[i].polygon)) {
                // DUMMY cars never die from car collisions
                if (this.controlType === "DUMMY") {
                    continue;
                }

                // AI cars don't die when colliding with PLAYER
                if (this.controlType === "AI" && traffic[i].controlType === "PLAYER") {
                    continue;
                }

                // All other collisions are fatal
                return true;
            }
        }
        return false;
    }

    createPolygon() {
        const points = [];
        const rad = Math.hypot(this.width, this.height) / 2;
        const alpha = Math.atan2(this.width, this.height);
        points.push({
            x: this.x - Math.sin(this.angle - alpha) * rad,
            y: this.y - Math.cos(this.angle - alpha) * rad
        });
        points.push({
            x: this.x - Math.sin(this.angle + alpha) * rad,
            y: this.y - Math.cos(this.angle + alpha) * rad
        });
        points.push({
            x: this.x - Math.sin(Math.PI + this.angle - alpha) * rad,
            y: this.y - Math.cos(Math.PI + this.angle - alpha) * rad
        });
        points.push({
            x: this.x - Math.sin(Math.PI + this.angle + alpha) * rad,
            y: this.y - Math.cos(Math.PI + this.angle + alpha) * rad
        });
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
                this.angle += 0.03 * flip;
            }
            if (this.controls.right) {
                this.angle -= 0.03 * flip;
            }
        }

        this.x -= Math.sin(this.angle) * this.speed;
        this.y -= Math.cos(this.angle) * this.speed;
    }

    draw(ctx, color) {
        if (this.damaged) {
            ctx.fillStyle = "gray";
        } else {
            ctx.fillStyle = color;
        }
        if(!this.polygon) return;
        ctx.beginPath();
        ctx.moveTo(this.polygon[0].x, this.polygon[0].y);
        for (let i = 1; i < this.polygon.length; i++) {
            ctx.lineTo(this.polygon[i].x, this.polygon[i].y);
        }
        ctx.fill();

        if (this.sensor) {
            this.sensor.draw(ctx);
        }
    }
}

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
            // if (i === 0) {
            //     // Bias positif pour la première sortie (forward)
            //     level.biases[i] = Math.random() * 0.5;
            // } else {
            //     level.biases[i] = Math.random() * 2 - 1;
            // }
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

            // Binary function
            // if (sum > level.biases[i]) {
            //     level.outputs[i] = 1;
            // } else {
            //     level.outputs[i] = 0;
            // }

            // Tanh function
            level.outputs[i] = Math.tanh(sum + level.biases[i]);
        }

        return level.outputs;
    }
}

// Function definitions
function save() {
    if (bestCar && bestCar.brain) {
        localStorage.setItem("bestBrain", JSON.stringify(bestCar.brain));
        console.log("💾 Brain saved manually");
    }
}

function discard() {
    localStorage.removeItem("bestBrain");
}

function generateCars(N) {
    const cars = [];
    for (let i = 1; i <= N; i++) {
        cars.push(new Car(road.getLaneCenter(1) + 2*i - N, canvas.height - 100, 30, 50, "AI"));
    }
    return cars;
}

// Every pattern must stay passable: never 3 lanes blocked on the same row, and
// at least TRAFFIC_ROW_GAP between two rows so a car (50px long) has room to
// change lanes between them. Offsets are multiples of that gap.
function generateTrafficPattern() {
    const g = TRAFFIC_ROW_GAP;
    const patterns = [
        // Une voie libre - facile
        [{ lane: 0, offset: 0 }, { lane: 1, offset: 0 }], // droite libre
        [{ lane: 1, offset: 0 }, { lane: 2, offset: 0 }], // gauche libre
        [{ lane: 0, offset: 0 }, { lane: 2, offset: 0 }], // milieu libre
        
        // Chicanes - moyen
        [{ lane: 0, offset: 0 }, { lane: 2, offset: -120 }], // slalom droite
        [{ lane: 2, offset: 0 }, { lane: 0, offset: -120 }], // slalom gauche
        [{ lane: 1, offset: 0 }, { lane: 0, offset: -g }, { lane: 2, offset: -2 * g }], // S

        // Passages étroits - difficile
        [{ lane: 0, offset: 0 }, { lane: 1, offset: -g }, { lane: 2, offset: 0 }], // passage central
        [{ lane: 0, offset: -g }, { lane: 1, offset: 0 }, { lane: 2, offset: -g }], // passage central inversé

        // Dense mais passage en diagonale - très difficile
        [{ lane: 0, offset: 0 }, { lane: 1, offset: -g }, { lane: 2, offset: -2 * g }],
        [{ lane: 2, offset: 0 }, { lane: 1, offset: -g }, { lane: 0, offset: -2 * g }],

        // Murs décalés avec gap - expert
        [{ lane: 0, offset: 0 }, { lane: 1, offset: 0 }, { lane: 2, offset: -g }],
        [{ lane: 0, offset: -g }, { lane: 1, offset: 0 }, { lane: 2, offset: 0 }]
    ];
    
    return patterns[Math.floor(Math.random() * patterns.length)];
}

function spawnTraffic(baseY) {
    const pattern = generateTrafficPattern();
    const newCars = [];
    
    pattern.forEach(({ lane, offset }) => {
        newCars.push(
            new Car(
                road.getLaneCenter(lane), 
                baseY + offset, 
                30, 
                50, 
                "DUMMY", 
                1.5
            )
        );
    });
    
    return newCars;
}

// Highest (furthest) traffic car; traffic all drives at the same speed, so the
// spacing between groups set at spawn time is kept
function trafficTopY() {
    return traffic.reduce((top, c) => Math.min(top, c.y), Infinity);
}

function updateTrafficSpawning() {
    const leadY = Math.min(playerCar.y, bestCar.y);
    const topY = trafficTopY();

    // Keep traffic up to TRAFFIC_SPAWN_DISTANCE ahead, spawned off-screen and
    // always TRAFFIC_GROUP_GAP above the previous group so groups never merge into a wall
    if (topY > leadY - TRAFFIC_SPAWN_DISTANCE) {
        const spawnY = Math.min(topY - TRAFFIC_GROUP_GAP, leadY - TRAFFIC_SPAWN_DISTANCE);
        traffic.push(...spawnTraffic(spawnY));
    }
    
    // Remove traffic far behind the AI lead and far from the player (camera follows
    // the player): otherwise it piles up when the AI cars race away from a stopped player
    for (let i = traffic.length - 1; i >= 0; i--) {
        const t = traffic[i];
        const farBehindLead = t.y > bestCar.y + TRAFFIC_REMOVE_DISTANCE;
        const farFromPlayer = Math.abs(t.y - playerCar.y) > TRAFFIC_REMOVE_DISTANCE;
        if (farBehindLead && farFromPlayer) {
            traffic.splice(i, 1);
        }
    }
}

/** Deprecated */
function resetGeneration() {
    // Find best car: furthest distance + bonus for being alive
    bestCar = cars.reduce((best, current) => {
        const bestScore = -best.y + (best.damaged ? 0 : 300) + (best.damaged ? 0 : Math.abs(best.speed) * 50);
        const currentScore = -current.y + (current.damaged ? 0 : 300) + (current.damaged ? 0 : Math.abs(current.speed) * 50);
        return currentScore > bestScore ? current : best;
    });
    
    const bestDistance = -bestCar.y;
    if (bestDistance > generationBestDistance) {
        generationBestDistance = bestDistance;
        localStorage.setItem("bestBrain", JSON.stringify(bestCar.brain));
        console.log(`🏆 New record! Generation ${generation}: ${bestDistance.toFixed(0)}px`);
    }
    
    // Create new generation from best car
    for (let i = 0; i < cars.length; i++) {
        cars[i].brain = JSON.parse(JSON.stringify(bestCar.brain));
        cars[i].damaged = false;
        cars[i].x = road.getLaneCenter(1) + 2*i - cars.length;
        cars[i].y = canvas.height + playerCar.y + 250;
        cars[i].speed = 0;
        cars[i].angle = 0;
        
        if (i == 0) {
            // Élite: pas de mutation
        } else if (i < 3) {
            NeuralNetwork.mutate(cars[i].brain, 0.02);
        } else if (i < 10) {
            NeuralNetwork.mutate(cars[i].brain, 0.1);
        } else if (i < 18) {
            NeuralNetwork.mutate(cars[i].brain, 0.25);
        } else {
            NeuralNetwork.mutate(cars[i].brain, 0.5); // Forte exploration
        }
    }
    
    // traffic.length = 0;
    // lastTrafficSpawnY = canvas.height - 100;
    
    // for (let i = 0; i < 5; i++) {
    //     const spawnY = lastTrafficSpawnY - (i + 1) * TRAFFIC_SPAWN_INTERVAL;
    //     traffic.push(...spawnTraffic(spawnY));
    //     lastTrafficSpawnY = spawnY;
    // }
    
    generation++;
}

// Find a free spot just behind the lead car: spawning ahead of it would make every
// other car "too far behind" (endless kill/respawn cascade), and spawning on top
// of a traffic car kills the new car on its first frame
function findSpawnPoint() {
    const baseY = cars.length > 0 ? Math.min(...cars.map(c => c.y)) + 100 : playerCar.y - 100;
    for (const dy of [0, 150, 300]) {
        for (const lane of [1, 0, 2]) {
            const x = road.getLaneCenter(lane);
            const y = baseY + dy;
            const blocked = traffic.some(t => Math.abs(t.x - x) < 30 && Math.abs(t.y - y) < SPAWN_CLEARANCE);
            if (!blocked) return { x, y };
        }
    }
    return null;
}

function spawnNewCar() {
    const spot = findSpawnPoint();
    if (!spot) return null; // No free spot this frame, try again on the next one
    totalCarsSpawned++;

    // Déterminer le cerveau de départ
    let brain;
    if (globalBestBrain) {
        brain = JSON.parse(JSON.stringify(globalBestBrain));
    } else if (localStorage.getItem("bestBrain")) {
        brain = JSON.parse(localStorage.getItem("bestBrain"));
    } else {
        brain = null;
    }
    
    const newCar = new Car(spot.x, spot.y, 30, 50, "AI");
    
    // Assigner et muter le cerveau si disponible
    if (brain) {
        newCar.brain = brain;
        newCar.generation = (recordHolder ? recordHolder.generation : 1) + 1;

        // Stratégie de mutation variée
        const rand = Math.random();
        if (rand < 0.05) {
            // 5% élite: pas de mutation
        } else if (rand < 0.30) {
            // 25% mutation légère
            NeuralNetwork.mutate(newCar.brain, 0.05);
        } else if (rand < 0.70) {
            // 40% mutation moyenne
            NeuralNetwork.mutate(newCar.brain, 0.15);
        } else if (rand < 0.90) {
            // 20% mutation forte
            NeuralNetwork.mutate(newCar.brain, 0.35);
        } else {
            // 10% exploration extrême
            NeuralNetwork.mutate(newCar.brain, 0.7);
        }
    }
    
    return newCar;
}

function animate() {
    // Pass 1: Update movement and create polygons for all cars
    playerCar.update(road.borders, [], false);
    for (let i = 0; i < traffic.length; i++) {
        traffic[i].update(road.borders, [], false); 
    }
    for (let i = 0; i < cars.length; i++) {
        cars[i].update(road.borders, [], false);
        cars[i].age++;
    }

    // Pass 2: Update sensors and assess damage for all cars
    playerCar.update(road.borders, traffic.concat(cars), true);
    for (let i = 0; i < traffic.length; i++) {
        traffic[i].update(road.borders, cars.concat([playerCar]), true); 
    }
    for (let i = 0; i < cars.length; i++) {
        // AI cars do not see each other (add the other AI cars here to change that)
        cars[i].update(road.borders, traffic.concat([playerCar]), true);
    }

    // Lead car: the furthest AI car still alive (single pass)
    bestCar = cars.reduce(
        (best, c) => !c.damaged && (!best || c.y < best.y) ? c : best,
        null
    ) || cars[0] || bestCar;

    // Update best brain ever (a car still in its spawn grace period has proven nothing yet)
    if (!bestCar.damaged && bestCar.age > SPAWN_GRACE_FRAMES) {
        const currentBestDistance = -bestCar.y;
        if (currentBestDistance > generationBestDistance) {
            generationBestDistance = currentBestDistance;
            // A brain never changes during a car's life: copy and save it only when
            // a new car takes the record
            if (bestCar !== recordHolder) {
                recordHolder = bestCar;
                globalBestBrain = JSON.parse(JSON.stringify(bestCar.brain));
                localStorage.setItem("bestBrain", JSON.stringify(bestCar.brain));
                if (bestCar.generation > generation) {
                    generation = bestCar.generation;
                    console.log(`🏆 New generation ${generation}: ${currentBestDistance.toFixed(0)}px (car #${totalCarsSpawned})`);
                }
            }
        }
    }

    // Cars are damaged if too far behind, or stalled once their spawn grace period is over
    for (let i = 0; i < cars.length; i++) {
        const car = cars[i];
        if (car.damaged) continue;
        const tooFarBehind = car.y - bestCar.y > MAX_LAG_DISTANCE;
        const stalled = car.age > SPAWN_GRACE_FRAMES && Math.abs(car.speed) < 0.05;
        if (tooFarBehind || stalled) {
            car.damaged = true;
        }
    }

    // Continuous learning: replace died cars
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

    // Manage dynamic traffic spawning
    updateTrafficSpawning();

    // // Check if all AI cars are damaged OR if generation has stalled
    // const allDamaged = cars.every(c => c.damaged);
    // const bestStuck = bestCar.damaged || Math.abs(bestCar.speed) < 0.1;
    // const aliveCount = cars.filter(c => !c.damaged).length;

    // // Reset after a timeout even if some cars are alive but stuck
    // if (allDamaged || (aliveCount < 2 && bestStuck)) {
    //     resetGeneration();
    // }

    ctx.save();
    
    canvas.height = window.innerHeight;

    ctx.translate(0, -playerCar.y + canvas.height * 0.7);

    road.draw(ctx);
    for (let i = 0; i < traffic.length; i++) {
        traffic[i].draw(ctx, "red");
    }
    for (let i = 0; i < cars.length; i++) {
        cars[i].draw(ctx, "darkblue");
    }
    playerCar.draw(ctx, "blue"); // Draw player car in blue

    ctx.restore();

    // Update UI
    document.getElementById('generation').textContent = generation;
    document.getElementById('bestDistance').textContent = generationBestDistance.toFixed(0);
    document.getElementById('alive').textContent = `${cars.filter(c => !c.damaged).length}/${N}`;

    requestAnimationFrame(animate);
}

// Main game setup and variable initializations
const canvas = document.getElementById("gameCanvas");
canvas.width = 200;
window.onresize = () => {
    canvas.height = window.innerHeight;
};

const ctx = canvas.getContext("2d");

const road = new Road(canvas.width / 2, canvas.width * 0.9);

const N = 25; // Number of AI cars
const playerCar = new Car(road.getLaneCenter(1), canvas.height - 100, 30, 50, "PLAYER");
const cars = generateCars(N);
let bestCar = cars[0];
let generation = 1;
let generationBestDistance = 0;
let totalCarsSpawned = 0;
let globalBestBrain = null;
let recordHolder = null; // Car whose brain is the current best one

// Traffic spawning configuration
const TRAFFIC_SPAWN_DISTANCE = 1000; // Spawn traffic this far ahead
const TRAFFIC_REMOVE_DISTANCE = 1800; // Remove traffic this far behind
const TRAFFIC_ROW_GAP = 170; // Min distance between two rows inside a pattern
const TRAFFIC_GROUP_GAP = 260; // Min distance between two traffic groups
const MAX_LAG_DISTANCE = 600; // Max distance before behing damaged
const SPAWN_GRACE_FRAMES = 60; // ~1s for a new car to start before it can be judged
const SPAWN_CLEARANCE = 150; // Min distance to traffic in the lane where a new AI car appears

if (localStorage.getItem("bestBrain")) {
    for (let i = 0; i < cars.length; i++) {
        cars[i].brain = JSON.parse(
            localStorage.getItem("bestBrain")
        );
        if (i != 0) {
            if (i < 3) {
                NeuralNetwork.mutate(cars[i].brain, 0.02); // Mutation légère
            } else if (i < 10) {
                NeuralNetwork.mutate(cars[i].brain, 0.1);  // Mutation moyenne
            } else {
                NeuralNetwork.mutate(cars[i].brain, 0.3);  // Exploration
            }
        }
    }
}

bestCar = cars[0];

const traffic = [];

// Spawn initial traffic, starting a group gap above the player
let initialSpawnY = playerCar.y - TRAFFIC_GROUP_GAP;
for (let i = 0; i < 5; i++) {
    traffic.push(...spawnTraffic(initialSpawnY));
    initialSpawnY = trafficTopY() - TRAFFIC_GROUP_GAP;
}

animate();