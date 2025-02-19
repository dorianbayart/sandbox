import RaceAIUtils from "./raceAIUtils.js";
import { RacingNeuralNetwork } from "./neuralNetwork.js";

class AITrainingSystem {
  constructor(layers) {
    this.populationSize = 1;
    this.generation = 1;
    this.networks = [];
    this.fitnessScores = new Map(); // Network -> Score
    this.evaluationTime = 4000; // 5 seconds per evaluation
    this.lastEvaluationTime = performance.now() - this.evaluationTime;
    this.bestNetwork = null;
    this.bestScore = -Infinity;

    // Initialize population
    for (let i = 0; i < this.populationSize; i++) {
      this.networks.push(new RacingNeuralNetwork(layers));
    }
  }

  /**
   * Update fitness scores for each AI
   * @param {Object} racers - The racers object containing AI cars
   * @param {Object} road - The road
   */
  updateFitness(racers, road) {
    Object.entries(racers).forEach(([id, racer]) => {
      if (id === "player") return; // Skip player

      const network = racer.network;
      if (!network) return;

      // Get current state
      const distanceFromCenter = Math.abs(RaceAIUtils.getDistanceFromCenter(racer, road));
      const isOnRoad = distanceFromCenter < road.width / 2;

      // Calculate fitness components
      const speedScore = (racer.speed / racer.maxSpeed) * 100;
      const centeringScore = Math.max(0, 1 - distanceFromCenter / (road.width*2)) * 100;
      const distanceScore = racer.distanceTraveled * 0.1;

      // Heavy penalties for being off road
      const roadMultiplier = isOnRoad ? 1 : 0;

      // Combine scores with weights
      let fitness =
        (speedScore * 0.35 + // 35% weight for speed
          centeringScore * 0.60 + // 60% weight for staying centered
          distanceScore * 0.05) * // 5% weight for distance
        roadMultiplier; // Major penalty for off-road

      //if(racer.name === 'AI-1') console.log(fitness, speedScore, centeringScore)

      // Store the highest fitness for this network
      const currentFitness = this.fitnessScores.get(network) || 0;
      this.fitnessScores.set(network, Math.max(currentFitness, fitness));
    });
  }

  /**
   * Select best networks for next generation
   * @returns {Array} Selected networks
   */
  selectBestNetworks() {
    const sortedNetworks = [...this.fitnessScores.entries()].sort((a, b) => b[1] - a[1]).map((entry) => entry[0]);

    // Update best network if we found a better one
    if (this.fitnessScores.get(sortedNetworks[0]) > this.bestScore) {
      this.bestNetwork = sortedNetworks[0].clone();
      this.bestScore = this.fitnessScores.get(sortedNetworks[0]);
    }

    // Select top half of networks
    return sortedNetworks.slice(0, Math.ceil(this.populationSize / 2));
  }

  /**
   * Create next generation of networks
   */
  createNextGeneration() {
    const bestNetworks = this.selectBestNetworks();
    const newNetworks = [];

    // Keep best network unchanged
    if (bestNetworks.length < 1) return;
    newNetworks.push(bestNetworks[0].clone());

    // Fill rest with mutations and crossovers
    while (newNetworks.length < this.populationSize) {
      if (Math.random() < 0.3 && bestNetworks.length >= 2) {
        // Crossover between two random best networks
        const parent1 = bestNetworks[Math.floor(Math.random() * bestNetworks.length)];
        const parent2 = bestNetworks[Math.floor(Math.random() * bestNetworks.length)];
        const child = parent1.crossover(parent2);
        child.mutate(0.1); // Small mutation after crossover
        newNetworks.push(child);
      } else {
        // Mutate a random best network
        const parent = bestNetworks[Math.floor(Math.random() * bestNetworks.length)];
        const child = parent.clone();
        child.mutate(0.2); // Larger mutation for diversity
        newNetworks.push(child);
      }
    }

    this.networks = newNetworks;
    this.fitnessScores.clear();
    this.generation++;
  }

  /**
   * Assign networks to AI racers
   * @param {Object} racers - The racers object containing AI cars
   */
  assignNetworksToRacers(racers) {
    let networkIndex = 0;
    Object.entries(racers).forEach(([id, racer]) => {
      if (id === "player") return; // Skip player
      if (networkIndex < this.networks.length) {
        racer.network = this.networks[networkIndex++];
      }
    });
  }

  /**
   * Update training system
   * @param {Object} racers - The racers object containing AI cars
   */
  update(racers, road) {
    this.updateFitness(racers, road);

    // Check if it's time for next generation
    const currentTime = performance.now();
    if (currentTime - this.lastEvaluationTime > this.evaluationTime) {
      this.createNextGeneration();
      this.assignNetworksToRacers(racers);
      this.lastEvaluationTime = currentTime;

      // Log training progress
      const fitnessValues = [...this.fitnessScores.values()];
    //   console.log(`Generation ${this.generation}:`, {
    //     bestScore: this.bestScore,
    //     averageScore: fitnessValues.length > 0 ? fitnessValues.reduce((a, b) => a + b, 0) / fitnessValues.length : 0,
    //     totalNetworks: this.networks.length,
    //     activeScores: this.fitnessScores.size,
    //   });
    }
  }

  /**
   * Get training stats for display
   * @returns {Object} Training statistics
   */
  getStats() {
    return {
      generation: this.generation,
      bestScore: this.bestScore,
      timeLeft: Math.max(0, this.evaluationTime - (performance.now() - this.lastEvaluationTime)) / 1000,
    };
  }
}

export default AITrainingSystem;
