const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { performance } = require('perf_hooks');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json()); // Enable parsing JSON request bodies

// In-memory game data (replace with Redis later)
const gameData = {};

// Function to calculate resource generation based on elapsed time
function calculateResources(player) {
    const now = performance.now();
    const lastUpdate = gameData[playerResources].lastUpdate;
    const elapsedSeconds = (now - lastUpdate) / 1000;

    const { buildings, villagers } = gameData[player];
    gameData[player].gold = villagers.assigned.mine * 1 * elapsedSeconds; // Example: 1 gold per active mine per second
    gameData[player].wood = villagers.assigned.lumberMill * 1 * elapsedSeconds; // Example: 1 wood per active lumber mill per second
    gameData[player].food = villagers.assigned.farm * 1 * elapsedSeconds; // Example: 1 food per active farm per second

    gameData[playerResources].lastUpdate = now;
    return gameData[player];
}

// WebSocket connection handling
wss.on('connection', ws => {
    console.log('Client connected');

    ws.on('message', message => {
        try {
            const data = JSON.parse(message);
            const { player, action, buildingType, quantity } = data;
            console.log('Received:', data);

            // Handle different actions
            switch (data.action) {
                case 'register':
                    if (!gameData[player]) {
                        gameData[player] = {
                            gold: 0,
                            wood: 0,
                            food: 0,
                            population: 1, // Total population
                            villagers: {
                                available: 1, // Villagers not assigned to a building
                                assigned: {
                                    // Villagers assigned to a building
                                    mine: 0,
                                    lumberMill: 0,
                                    farm: 0,
                                    barracks: 0,
                                },
                            },
                            soldiers: {
                                available: 0,
                                assigned: 0,
                            },
                            buildings: {
                                mine: 0,
                                lumberMill: 0,
                                farm: 0,
                                housing: 1,
                                barracks: 0,
                                market: 0,
                                temple: 0,
                            },
                            lastUpdate: performance.now()
                        };
                        ws.send(JSON.stringify({ success: true, message: 'Registration successful', playerData: gameData[player] }));
                    } else {
                        ws.send(JSON.stringify({ success: false, message: 'Username already exists' }));
                    }

                    break;
                case 'upgradeBuilding':
                    const cost = {
                        mine: { gold: 50 },
                        lumberMill: { gold: 75, wood: 25 },
                        // ...other building costs
                    };
                    if(gameData[player].gold >= cost[buildingType].gold && (cost[buildingType].wood === undefined || gameData[player].wood >= cost[buildingType].wood)){
                        gameData[player].gold -= cost[buildingType].gold;
                        if(cost[buildingType].wood !== undefined) gameData[player].wood -= cost[buildingType].wood;
                        gameData[player].buildings[buildingType]++;
                        ws.send(JSON.stringify({ success: true, message: `${buildingType} upgraded`, playerData: gameData[player] }));

                    } else {
                        ws.send(JSON.stringify({ success: false, message: `Not enough resources to upgrade ${buildingType}` }));
                    }
                    break;
                
                case 'assignVillager':
                    if (gameData[player].villagers.available >= quantity &&
                            gameData[player].buildings[buildingType] - gameData[player].villagers.assigned[buildingType] >= quantity) {
                        gameData[player].villagers.available -= quantity;
                        gameData[player].villagers.assigned[buildingType] += quantity;
                        ws.send(JSON.stringify({ success: true, message: `${quantity} villagers assigned to ${buildingType + (quantity > 1 ? 's' : '')}`, playerData: gameData[player] }));
                    } else {
                        ws.send(JSON.stringify({ success: false, message: 'Not enough available villagers' }));
                    }
                    break;
                
                case 'unassignVillager':
                    
                    break;
                case 'getResources':
                    ws.send(JSON.stringify({ success: true, playerData: calculateResources(player) }));
                    break;
                default:
                    ws.send(JSON.stringify({ success: false, message: 'Invalid action' }));
            }
        } catch (error) {
            console.error('Error parsing message:', error);
            ws.send(JSON.stringify({ success: false, message: 'Invalid message format' }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.on('error', error => {
        console.error('WebSocket error:', error);
    });
});

// Start the server
const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});