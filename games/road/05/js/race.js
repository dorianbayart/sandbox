// One race: a road and its traffic from a seed, and cars driven by networks, all starting
// together. They drive through each other: each car's result depends only on its brain.
// An optional ghost (the champion) drives the same race for comparison: it is not one of
// the cars, and the race does not wait for it.
import { Road } from './road.js';
import { Traffic } from './traffic.js';
import { Car, RAY_FAR } from './car.js';
import { hashSeed } from './rng.js';

export class Race {
    constructor(seed, networks, fanCount, maxSteps, difficulty, ghostNetwork = null) {
        this.road = new Road(seed, difficulty);
        this.traffic = new Traffic(this.road, hashSeed(seed, 7));
        this.cars = networks.map(network => new Car(network, fanCount, this.road.laneX(2, 0)));
        this.ghost = ghostNetwork ? new Car(ghostNetwork, fanCount, this.road.laneX(2, 0)) : null;
        this.maxSteps = maxSteps;
        this.step = 0;
        this.done = false;
    }

    // One fixed simulation step; sets `done` when every car is out or the time is up
    tick() {
        if (this.done) return;
        let minD = Infinity, maxD = -Infinity, alive = 0;
        for (const car of this.cars) {
            if (!car.alive) continue;
            alive++;
            minD = Math.min(minD, car.distance);
            maxD = Math.max(maxD, car.distance);
        }
        if (alive === 0 || this.step >= this.maxSteps) {
            this.done = true;
            return;
        }
        const ghost = this.ghost && this.ghost.alive ? this.ghost : null;
        if (ghost) {
            minD = Math.min(minD, ghost.distance);
            maxD = Math.max(maxD, ghost.distance);
        }

        // Traffic moves on its own; only the cars around the population (and ahead of the
        // leader, for the display) are handed to the sensors
        this.traffic.step();
        this.traffic.collect(minD - 300, maxD + RAY_FAR + 300);
        for (const car of this.cars) car.step(this.road, this.traffic);
        if (ghost) ghost.step(this.road, this.traffic);
        this.step++;
    }
}
