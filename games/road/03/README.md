# Neural Race

A self-driving car simulation game where AI agents learn to navigate traffic using a custom neural network implementation.

## Overview

Neural Race demonstrates machine learning through genetic algorithms. AI-controlled cars use neural networks to process sensor data and learn optimal driving strategies through mutation and natural selection.

## Architecture

### Core Components

**Neural Network** (`NeuralNetwork` class)
- Feedforward architecture: 5 inputs → 8 hidden → 6 hidden → 4 outputs
- Inputs: 5 raycasting sensors detecting obstacles
- Outputs: forward, left, right, reverse controls
- Mutation via linear interpolation between current weights and random values

**Sensor System** (`Sensor` class)
- 5 rays with 90° spread (π/2 radians)
- 150px detection range
- Detects road borders and traffic cars
- Returns normalized distance offsets

**Car Types**
- `PLAYER`: Keyboard-controlled (arrow keys)
- `AI`: Neural network controlled with mutation
- `DUMMY`: Simple forward movement (traffic obstacles)

**Collision Detection**
- Polygon-based intersection testing
- Two-pass update cycle: movement → sensor/damage assessment
- Prevents false collisions between simultaneously moving entities

## Game Loop
```javascript
// Pass 1: Physics updates (no collision checks)
playerCar.update(road.borders, [], false);
traffic[i].update(road.borders, [], false);
cars[i].update(road.borders, [], false);

// Pass 2: Sensor updates and damage assessment
playerCar.update(road.borders, traffic.concat(cars), true);
traffic[i].update(road.borders, cars.concat([playerCar]), true);
cars[i].update(road.borders, traffic.concat([playerCar]), true);
```

## Genetic Algorithm

1. **Generation**: Spawn N AI cars (default: 3)
2. **Selection**: Best car = minimum Y position (furthest forward)
3. **Persistence**: Save best brain to `localStorage`
4. **Mutation**: Clone best brain with 10% mutation rate for all except first car
```javascript
if (localStorage.getItem("bestBrain")) {
    cars[i].brain = JSON.parse(localStorage.getItem("bestBrain"));
    if (i != 0) {
        NeuralNetwork.mutate(cars[i].brain, 0.1);
    }
}
```

## Controls

**Player Car**
- ↑: Accelerate
- ↓: Reverse
- ←/→: Steer

**Training Controls**
- 💾 Save: Store best neural network
- 🗑️ Discard: Clear saved network

## Installation
```bash
npm install
npm start
```

Opens at `http://localhost:8080`

## Configuration

**Adjustable Parameters** (in `game.js`):
```javascript
const N = 3;                    // Number of AI cars
const rayCount = 5;             // Sensor rays
const rayLength = 150;          // Detection distance
const raySpread = Math.PI / 2;  // Sensor angle
const neuronCounts = [5, 6, 4]; // Network architecture
const mutationAmount = 0.1;     // Mutation rate
```

**Traffic Patterns**:
```javascript
const traffic = [
    new Car(road.getLaneCenter(2), -100, 30, 50, "DUMMY", 2),
    // Add more obstacles...
];
```

## Technical Details

- **Canvas**: 200px wide, viewport height
- **Camera**: Follows player car at 70% viewport height
- **Road**: 3 lanes, infinite vertical scrolling
- **Physics**: Simple acceleration/friction model with angle-based steering
- **Activation**: Binary threshold activation function in neural network

## Storage

Uses `localStorage` for persistence:
- Key: `"bestBrain"`
- Value: JSON-serialized neural network weights and biases