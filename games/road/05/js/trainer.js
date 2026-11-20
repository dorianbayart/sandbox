// Training loop, independent of the display: one call to tick() = one fixed simulation step.
// A generation = the whole population races on the same track(s) and traffic; its fitness is
// the average distance reached; the genetic algorithm then builds the next generation.
// Validation: the best car of each generation also drives alone on fixed tracks never used
// for training. That score tells how well it drives anywhere, not just on lucky tracks, and
// it picks the champion.
import { Race } from './race.js';
import { Network } from './network.js';
import { nextGeneration, populationFrom } from './genetics.js';
import { hashSeed } from './rng.js';
import { networkShape, rayLayout, CUT_IN_INPUTS } from './car.js';

export const VALIDATION_TRACKS = 3;
const VALIDATION_SEED = 20261120;      // Same validation tracks for every training: scores compare
const VALIDATION_STEPS_PER_TICK = 3;   // Runs alongside the next generation

// Drives one genome on the validation tracks, a few steps at a time
class Validation {
    constructor(generation, genome, shape, rayCount, maxSteps, difficulty) {
        this.generation = generation;
        this.difficulty = difficulty;
        this.genome = genome;
        this.shape = shape;
        this.rayCount = rayCount;
        this.maxSteps = maxSteps;
        this.track = 0;
        this.sum = 0;
        this.done = false;
        this.score = 0;
        this.startRace();
    }

    startRace() {
        const network = new Network(this.shape, this.genome);
        this.race = new Race(hashSeed(VALIDATION_SEED, this.track), [network], this.rayCount, this.maxSteps, this.difficulty);
    }

    advance(steps) {
        for (let s = 0; s < steps && !this.done; s++) {
            this.race.tick();
            if (!this.race.done) continue;
            this.sum += this.race.cars[0].bestD;
            this.track++;
            if (this.track < VALIDATION_TRACKS) {
                this.startRace();
            } else {
                this.done = true;
                this.score = this.sum / VALIDATION_TRACKS;
            }
        }
    }
}

export class Trainer {
    // config: { hidden: [8, 6], rays, memory, populationSize, elites, changesPerChild, sigmaStart, sigmaDecay,
    //           sigmaMin, tracksPerGeneration, sameTracks, episodeSteps, seed, difficulty }
    // The difficulty may change during the training: it applies from the next race.
    constructor(config, importedGenome = null) {
        this.config = config;
        this.shape = networkShape(config.rays, config.hidden, config.memory); // Rays, speed, cut-ins, memory → pedals, steering, memory
        this.paramCount = Network.paramCount(this.shape);
        // Chance for each parameter to change, so that a child gets about `changesPerChild` changes
        this.mutationRate = Math.min(1, config.changesPerChild / this.paramCount);

        this.generation = 1;
        this.genomes = importedGenome
            ? populationFrom(importedGenome, config.populationSize, this.mutationRate, this.mutationSigma)
            : Array.from({ length: config.populationSize }, () => Network.randomGenome(this.shape, Math.random, this.cutInInputs()));

        this.history = [];      // { generation, best, mean, validation, sigma } per generation
        this.champions = {};    // Per difficulty, the best validation score: { genome, fitness, generation, difficulty }
        this.validation = null;
        this.totalSteps = 0;
        this.listeners = [];
        this.startGeneration();
    }

    // The champion of the current difficulty: scores on different difficulties don't compare
    get champion() {
        return this.champions[this.config.difficulty] || null;
    }

    // Cut-in inputs (after the rays and the speed): their weights start at 0 (see Network.randomGenome)
    cutInInputs() {
        const first = rayLayout(this.config.rays).angles.length + 1;
        return CUT_IN_INPUTS.map((_, i) => first + i);
    }

    // Mutation size of the current generation: big steps first, then finer and finer, never below the minimum
    get mutationSigma() {
        const { sigmaStart, sigmaDecay, sigmaMin } = this.config;
        return Math.max(sigmaMin, sigmaStart * (1 - sigmaDecay) ** (this.generation - 1));
    }

    // Called at the end of each generation and of each validation
    onUpdate(listener) {
        this.listeners.push(listener);
    }

    notify() {
        this.listeners.forEach(listener => listener());
    }

    trackSeed(trackIndex) {
        const { seed, sameTracks } = this.config;
        return sameTracks ? hashSeed(seed, trackIndex) : hashSeed(seed, this.generation, trackIndex);
    }

    startGeneration() {
        this.fitnessSum = new Float64Array(this.genomes.length);
        this.trackIndex = 0;
        this.startEpisode();
    }

    startEpisode() {
        const networks = this.genomes.map(genome => new Network(this.shape, genome));
        // The champion of this difficulty drives the race too, to compare with the generation
        const champion = this.champion;
        this.race = new Race(this.trackSeed(this.trackIndex), networks, this.config.rays, this.config.episodeSteps,
            this.config.difficulty, champion ? new Network(this.shape, champion.genome) : null);
        this.ghostGeneration = champion ? champion.generation : null;
        this.race.cars.forEach((car, i) => { car.isElite = i < this.config.elites && this.generation > 1; });
    }

    // What the display shows
    get road() { return this.race.road; }
    get traffic() { return this.race.traffic; }
    get cars() { return this.race.cars; }
    get step() { return this.race.step; }
    get ghost() { return this.race.ghost; }

    tick() {
        if (this.validation) {
            this.validation.advance(VALIDATION_STEPS_PER_TICK);
            if (this.validation.done) this.endValidation();
        }
        this.race.tick();
        this.totalSteps++;
        if (this.race.done) this.endEpisode();
    }

    endEpisode() {
        this.race.cars.forEach((car, i) => { this.fitnessSum[i] += car.bestD; });
        this.trackIndex++;
        if (this.trackIndex < this.config.tracksPerGeneration) {
            this.startEpisode();
        } else {
            this.endGeneration();
        }
    }

    endGeneration() {
        const tracks = this.config.tracksPerGeneration;
        const population = this.genomes.map((genome, i) => ({ genome, fitness: this.fitnessSum[i] / tracks }));
        const fitnesses = population.map(p => p.fitness);
        const best = Math.max(...fitnesses);
        const mean = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
        const bestIndividual = population[fitnesses.indexOf(best)];
        this.history.push({ generation: this.generation, best, mean, validation: null, sigma: this.mutationSigma });

        // The previous validation must end first (short generations), then the best one is validated
        if (this.validation) {
            this.validation.advance(Infinity);
            this.endValidation();
        }
        this.validation = new Validation(this.generation, Float64Array.from(bestIndividual.genome),
            this.shape, this.config.rays, this.config.episodeSteps, this.config.difficulty);

        this.genomes = nextGeneration(population, {
            size: this.config.populationSize,
            elites: this.config.elites,
            mutationRate: this.mutationRate,
            mutationSigma: this.mutationSigma,
        });
        this.generation++;
        this.notify();
        this.startGeneration();
    }

    endValidation() {
        const { generation, genome, score, difficulty } = this.validation;
        this.validation = null;
        const entry = this.history.find(h => h.generation === generation);
        if (entry) entry.validation = score;
        const best = this.champions[difficulty];
        if (!best || score > best.fitness) {
            this.champions[difficulty] = { genome, fitness: score, generation, difficulty };
        }
        this.notify();
    }

    // The car to follow: the furthest one still alive, or the furthest one
    leader() {
        let best = null;
        for (const car of this.race.cars) {
            if (!best || (car.alive && !best.alive) || (car.alive === best.alive && car.distance > best.distance)) best = car;
        }
        return best;
    }

    aliveCount() {
        return this.race.cars.reduce((n, car) => n + (car.alive ? 1 : 0), 0);
    }
}
