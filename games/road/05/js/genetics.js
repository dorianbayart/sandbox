// Genetic algorithm on flat genomes: elitism, tournament selection, uniform crossover,
// gaussian mutation
import { gaussian } from './rng.js';

// Best of k individuals drawn at random: good ones win more often, weak ones still have a chance
function tournament(population, k) {
    let best = null;
    for (let i = 0; i < k; i++) {
        const candidate = population[Math.floor(Math.random() * population.length)];
        if (!best || candidate.fitness > best.fitness) best = candidate;
    }
    return best;
}

// Each parameter comes from one parent or the other
function crossover(a, b) {
    const child = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) child[i] = Math.random() < 0.5 ? a[i] : b[i];
    return child;
}

// Each parameter has a `rate` chance to move by a gaussian step of size `sigma`
function mutate(genome, rate, sigma) {
    for (let i = 0; i < genome.length; i++) {
        if (Math.random() < rate) genome[i] += gaussian() * sigma;
    }
}

// population: [{ genome, fitness }] → genomes of the next generation (elites first)
export function nextGeneration(population, { size, elites, mutationRate, mutationSigma, tournamentSize = 3, crossoverRate = 0.7 }) {
    const ranked = population.slice().sort((a, b) => b.fitness - a.fitness);
    const next = [];
    for (let i = 0; i < Math.min(elites, ranked.length, size); i++) {
        next.push(Float64Array.from(ranked[i].genome)); // Unchanged copy of the best ones
    }
    while (next.length < size) {
        const a = tournament(ranked, tournamentSize);
        const b = tournament(ranked, tournamentSize);
        const child = Math.random() < crossoverRate ? crossover(a.genome, b.genome) : Float64Array.from(a.genome);
        mutate(child, mutationRate, mutationSigma);
        next.push(child);
    }
    return next;
}

// Population started from an imported brain: one exact copy, the others mutated
export function populationFrom(genome, size, mutationRate, mutationSigma) {
    const population = [Float64Array.from(genome)];
    while (population.length < size) {
        const child = Float64Array.from(genome);
        mutate(child, mutationRate, mutationSigma);
        population.push(child);
    }
    return population;
}
