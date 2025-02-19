import RaceAIUtils from './raceAIUtils.js';


// Neural Network structure
const NN = {
    inputLayer: 8,  // Number of inputs
    hiddenLayer: 12, // Can be adjusted
    outputLayer: 2,  // Angle and speed
    weights1: null,  // Weights between input and hidden
    weights2: null,  // Weights between hidden and output
};

// Initialize random weights
function initializeNN() {
    NN.weights1 = new Array(NN.inputLayer).fill(0)
        .map(() => new Array(NN.hiddenLayer).fill(0)
        .map(() => Math.random() * 2 - 1));
    
    NN.weights2 = new Array(NN.hiddenLayer).fill(0)
        .map(() => new Array(NN.outputLayer).fill(0)
        .map(() => Math.random() * 2 - 1));
}

// Activation function (ReLU)
function relu(x) {
    return Math.max(0, x);
}

// Forward propagation
function forwardPropagate(inputs) {
    // Hidden layer
    const hidden = NN.weights1.map(row => 
        inputs.reduce((sum, input, i) => sum + input * row[i], 0)
    ).map(relu);
    
    // Output layer
    const outputs = NN.weights2.map(row =>
        hidden.reduce((sum, h, i) => sum + h * row[i], 0)
    ).map(Math.tanh);  // Use tanh for -1 to 1 range
    
    return outputs;
}

// Update AI using neural network
function updateNeuralAI(car, deltaTime) {
    const inputs = RaceAIUtils.getNeuralNetworkInputs(car, road, allCars);
    const [targetAngle, targetSpeed] = forwardPropagate(inputs);
    
    // Apply outputs
    car.targetAngle = targetAngle * (Math.PI / 3);  // Max 60 degrees
    car.speed = car.minSpeed + (targetSpeed * (car.maxSpeed - car.minSpeed));
}