// AI Utility functions adjusted for infinite road
class RaceAIUtils {
    /**
     * Get distance from car to road edge
     * @param {Object} car - The car object with x, y, worldY properties
     * @param {Object} road - The state.road object with points and width
     * @param {string} side - 'left' or 'right'
     * @returns {number} Distance to edge
     */
    static getDistanceToEdge(car, road, side) {
        // Find current road segment
        const currentSegment = this.getCurrentRoadSegment(car, road.points);
        if (!currentSegment) return 0;

        const { p1, p2, t } = currentSegment;
        
        // Get road center at car's position
        const roadCenterX = p1.x + t * (p2.x - p1.x);
        
        // Calculate distance to edge based on side
        return side === 'left' ? 
            Math.abs(car.x - (roadCenterX - road.width/2)) :
            Math.abs((roadCenterX + road.width/2) - car.x);
    }

    /**
     * Get distance from car to road center
     * @param {Object} car - The car object
     * @param {Object} road - The state.road object
     * @returns {number} Distance from center, positive is right, negative is left
     */
    static getDistanceFromCenter(car, road) {
        const currentSegment = this.getCurrentRoadSegment(car, road.points);
        if (!currentSegment) return 0;

        const { p1, p2, t } = currentSegment;
        const roadCenterX = p1.x + t * (p2.x - p1.x);
        
        return car.x - roadCenterX;
    }

    /**
     * Get intensity of next curve
     * @param {Object} car - The car object
     * @param {Object} road - The state.road object
     * @param {number} lookAheadPoints - Number of points to analyze
     * @returns {number} Curve intensity (-1 to 1, negative for left curves)
     */
    static getNextCurveIntensity(car, road, lookAheadPoints = 5) {
        const currentSegment = this.getCurrentRoadSegment(car, road.points);
        if (!currentSegment) return 0;

        const currentIndex = road.points.indexOf(currentSegment.p1);
        if (currentIndex === -1) return 0;

        let totalCurve = 0;
        const pointsToCheck = Math.min(lookAheadPoints, road.points.length - currentIndex - 1);
        
        for (let i = currentIndex; i < currentIndex + pointsToCheck; i++) {
            const curve = road.points[i + 1].x - road.points[i].x;
            totalCurve += curve;
        }

        // Normalize by road width and number of points checked
        return (totalCurve / pointsToCheck) / (road.width/2);
    }

    /**
     * Get nearest car distances in different directions
     * @param {Object} car - The car object
     * @param {Array} allCars - Array of all cars in race
     * @returns {Object} Distances to nearest cars
     */
    static getNearestCarDistances(car, allCars) {
        const distances = {
            front: Infinity,
            frontLeft: Infinity,
            frontRight: Infinity
        };

        allCars.forEach(otherCar => {
            if (otherCar === car) return;

            const dx = otherCar.x - car.x;
            const dy = otherCar.worldY - car.worldY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Only consider cars ahead of us (lower y value on screen)
            if (dy < 0) {
                if (Math.abs(dx) < car.width) {
                    distances.front = Math.min(distances.front, distance);
                } else if (dx < 0) {
                    distances.frontLeft = Math.min(distances.frontLeft, distance);
                } else {
                    distances.frontRight = Math.min(distances.frontRight, distance);
                }
            }
        });

        return distances;
    }

    /**
     * Get the current road segment the car is on
     * @param {Object} car - The car object
     * @param {Array} roadPoints - Array of road points
     * @returns {Object|null} Current segment information or null
     */
    static getCurrentRoadSegment(car, roadPoints) {
        const carWorldY = car.worldY;
        
        for (let i = 0; i < roadPoints.length - 1; i++) {
            const p1 = roadPoints[i];
            const p2 = roadPoints[i + 1];
            
            if (p1.y <= carWorldY && p2.y > carWorldY) {
                const t = (carWorldY - p1.y) / (p2.y - p1.y);
                return { p1, p2, t };
            }
        }
        return null;
    }

    /**
     * Get all inputs for neural network
     * @param {Object} car - The car object
     * @param {Object} road - The state.road object
     * @param {Array} allCars - Array of all cars
     * @returns {Array} Array of normalized inputs for neural network
     */
    static getNeuralNetworkInputs(car, road, allCars) {
        const carDistances = this.getNearestCarDistances(car, allCars);
        
        return [
            car.speed / car.maxSpeed,  // Current speed (normalized)
            car.angle / (Math.PI / 2),  // Current angle (normalized)
            this.getDistanceToEdge(car, road, 'left') / road.width,  // Left edge distance
            this.getDistanceToEdge(car, road, 'right') / road.width,  // Right edge distance
            this.getNextCurveIntensity(car, road),  // Next curve intensity
            Math.min(1, carDistances.front / 200),  // Front car distance
            Math.min(1, carDistances.frontLeft / 200),  // Front-left car distance
            Math.min(1, carDistances.frontRight / 200),  // Front-right car distance
            this.getDistanceFromCenter(car, road) / (road.width/2),  // Distance from center
            car.speed > car.minSpeed ? 1 : 0  // Is moving (binary)
        ];
    }
}

export default RaceAIUtils;