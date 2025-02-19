class NeuralNetwork {
    /**
     * Create a new neural network
     * @param {number[]} layers - Array of layer sizes (e.g., [8, 12, 2] for 8 inputs, 12 hidden, 2 outputs)
     */
    constructor(layers) {
        this.layers = layers;
        this.weights = [];
        this.biases = [];
        
        // Initialize weights and biases
        for (let i = 0; i < layers.length - 1; i++) {
            this.weights.push(this.#createMatrix(layers[i + 1], layers[i]));
            this.biases.push(this.#createMatrix(layers[i + 1], 1));
        }
    }

    /**
     * Create a matrix filled with random values
     * @param {number} rows - Number of rows
     * @param {number} cols - Number of columns
     * @returns {number[][]} Matrix with random values between -1 and 1
     */
    #createMatrix(rows, cols) {
        return new Array(rows).fill(0)
            .map(() => new Array(cols).fill(0)
            .map(() => Math.random() * 2 - 1));
    }

    /**
     * Activation function (ReLU)
     * @param {number} x - Input value
     * @returns {number} Activated value
     */
    #relu(x) {
        return Math.max(0, x);
    }

    /**
     * Hyperbolic tangent activation function
     * @param {number} x - Input value
     * @returns {number} Activated value between -1 and 1
     */
    #tanh(x) {
        return Math.tanh(x);
    }

    /**
     * Forward propagate input through the network
     * @param {number[]} inputs - Array of input values
     * @returns {number[]} Array of output values
     */
    predict(inputs) {
        let current = inputs;

        // Process through hidden layers with ReLU
        for (let i = 0; i < this.weights.length - 1; i++) {
            current = this.#forwardLayer(current, this.weights[i], this.biases[i], this.#relu);
        }

        // Process output layer with tanh for -1 to 1 range
        return this.#forwardLayer(
            current, 
            this.weights[this.weights.length - 1],
            this.biases[this.weights.length - 1],
            this.#tanh
        );
    }

    /**
     * Process one layer of the network
     * @param {number[]} inputs - Input values
     * @param {number[][]} weights - Weight matrix
     * @param {number[][]} biases - Bias matrix
     * @param {Function} activation - Activation function
     * @returns {number[]} Output values
     */
    #forwardLayer(inputs, weights, biases, activation) {
        return weights.map((row, i) => {
            const sum = row.reduce((sum, weight, j) => sum + weight * inputs[j], 0);
            return activation(sum + biases[i][0]);
        });
    }

    /**
     * Create a copy of this neural network
     * @returns {NeuralNetwork} New neural network with same structure
     */
    clone() {
        const clone = new NeuralNetwork(this.layers);
        clone.weights = this.weights.map(layer => 
            layer.map(row => [...row])
        );
        clone.biases = this.biases.map(layer => 
            layer.map(row => [...row])
        );
        return clone;
    }

    /**
     * Mutate the network weights and biases
     * @param {number} rate - Mutation rate (0 to 1)
     * @param {number} amount - Maximum amount to mutate by
     */
    mutate(rate = 0.1, amount = 0.1) {
        const mutateValue = (value) => {
            if (Math.random() < rate) {
                return value + (Math.random() * 2 - 1) * amount;
            }
            return value;
        };

        this.weights = this.weights.map(layer =>
            layer.map(row => row.map(mutateValue))
        );
        this.biases = this.biases.map(layer =>
            layer.map(row => row.map(mutateValue))
        );
    }

    /**
     * Crossover this network with another network
     * @param {NeuralNetwork} other - Other network to crossover with
     * @returns {NeuralNetwork} New network with mixed weights
     */
    crossover(other) {
        if (JSON.stringify(this.layers) !== JSON.stringify(other.layers)) {
            throw new Error('Networks must have the same structure');
        }

        const child = new NeuralNetwork(this.layers);

        child.weights = this.weights.map((layer, i) =>
            layer.map((row, j) =>
                row.map((weight, k) =>
                    Math.random() < 0.5 ? weight : other.weights[i][j][k])
            )
        );

        child.biases = this.biases.map((layer, i) =>
            layer.map((row, j) =>
                row.map((bias, k) =>
                    Math.random() < 0.5 ? bias : other.biases[i][j][k])
            )
        );

        return child;
    }

    /**
     * Export network to JSON string
     * @returns {string} JSON representation of network
     */
    serialize() {
        return JSON.stringify({
            layers: this.layers,
            weights: this.weights,
            biases: this.biases
        });
    }

    /**
     * Create network from JSON string
     * @param {string} json - JSON representation of network
     * @returns {NeuralNetwork} New network from JSON
     */
    static deserialize(json) {
        const data = JSON.parse(json);
        const network = new NeuralNetwork(data.layers);
        network.weights = data.weights;
        network.biases = data.biases;
        return network;
    }

    static fromNetwork(network) {
        const newNetwork = new this(network.layers);
        newNetwork.weights = network.weights.map(layer => 
            layer.map(row => [...row])
        );
        newNetwork.biases = network.biases.map(layer => 
            layer.map(row => [...row])
        );
        return newNetwork;
    }
}

// Example usage for racing game:
class RacingNeuralNetwork extends NeuralNetwork {
    constructor(layers = [10, 12, 2]) {
        super(layers);
    }

    clone() {
        return RacingNeuralNetwork.fromNetwork(this);
    }

    crossover(other) {
        const child = super.crossover(other);
        return RacingNeuralNetwork.fromNetwork(child);
    }

    /**
     * Get car control outputs from neural network
     * @param {Array} inputs - Normalized inputs from RaceAIUtils
     * @returns {Object} Car control values
     */
    getCarControls(inputs) {
        const [steering, speed] = this.predict(inputs);
        return {
            targetAngle: steering * (Math.PI / 3), // Convert to radians (-60 to +60 degrees)
            targetSpeed: speed // Already normalized -1 to 1
        };
    }
}

export { NeuralNetwork, RacingNeuralNetwork };