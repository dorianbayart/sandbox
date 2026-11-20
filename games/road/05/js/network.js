// A small fully connected neural network (tanh everywhere).
// All its parameters live in one flat array, the "genome": genetics works on it directly.
import { gaussian } from './rng.js';

export class Network {
    // shape: neurons per layer, e.g. [8, 8, 6, 2] = 8 inputs, two hidden layers, 2 outputs
    constructor(shape, genome = null) {
        this.shape = shape.slice();
        this.genome = genome || Network.randomGenome(shape);
        if (this.genome.length !== Network.paramCount(shape)) {
            throw new Error(`Genome size ${this.genome.length} does not match shape ${shape}`);
        }

        // Each layer reads its weights and biases straight from the genome
        this.layers = [];
        let offset = 0;
        for (let l = 0; l < shape.length - 1; l++) {
            const nIn = shape[l], nOut = shape[l + 1];
            const weights = this.genome.subarray(offset, offset + nIn * nOut); // weights[out * nIn + in]
            offset += nIn * nOut;
            const biases = this.genome.subarray(offset, offset + nOut);
            offset += nOut;
            this.layers.push({ nIn, nOut, weights, biases });
        }
        // Last values of every neuron, kept for the visualisation
        this.activations = shape.map(n => new Float64Array(n));
    }

    static paramCount(shape) {
        let count = 0;
        for (let l = 0; l < shape.length - 1; l++) {
            count += (shape[l] + 1) * shape[l + 1]; // Weights + one bias per neuron
        }
        return count;
    }

    // Weights scaled by 1/sqrt(inputs) (Xavier-like) so tanh does not saturate at first.
    // quietInputs: inputs whose weights start at 0, so that they change nothing at first and
    // mutations bring them in only if they help (rare, noisy inputs would otherwise make
    // every new network react at random to them)
    static randomGenome(shape, rand = Math.random, quietInputs = []) {
        const genome = new Float64Array(Network.paramCount(shape));
        const quiet = new Set(quietInputs);
        let offset = 0;
        for (let l = 0; l < shape.length - 1; l++) {
            const nIn = shape[l], nOut = shape[l + 1];
            const scale = 1 / Math.sqrt(nIn);
            for (let i = 0; i < nIn * nOut; i++) {
                genome[offset++] = l === 0 && quiet.has(i % nIn) ? 0 : gaussian(rand) * scale;
            }
            for (let i = 0; i < nOut; i++) genome[offset++] = gaussian(rand) * 0.1;
        }
        return genome;
    }

    forward(inputs) {
        const acts = this.activations;
        acts[0].set(inputs);
        for (let l = 0; l < this.layers.length; l++) {
            const { nIn, nOut, weights, biases } = this.layers[l];
            const input = acts[l], output = acts[l + 1];
            for (let o = 0; o < nOut; o++) {
                let sum = biases[o];
                const row = o * nIn;
                for (let i = 0; i < nIn; i++) sum += input[i] * weights[row + i];
                output[o] = Math.tanh(sum);
            }
        }
        return acts[acts.length - 1];
    }
}
