'use strict';

function generateMap(numAIPlayers, towersPerPlayer) {
  const numPlayers = parseInt(numAIPlayers) + 1; // +1 for the human player
  const totalTowers = Math.ceil(1.5 * numPlayers + parseInt(towersPerPlayer) * (Math.random() + 0.75));

  // Calculate map dimensions based on the number of towers.  Adjust these
  // multipliers and additions to fine-tune the map size.
  const mapWidth = Math.max(80, Math.ceil(totalTowers * 12.5));
  const mapHeight = Math.round(mapWidth * 9 / 16)// Math.max(50, Math.ceil(totalTowers / (mapWidth / 20)) * 20);

  const towers = [];

  // Place player starting towers
  for (let i = 0; i < numPlayers; i++) {
    // Distribute starting towers relatively evenly around the map edges.
    let x, y;
    if (i === 0) { // Human player, top left
        x = Math.floor(Math.random() * mapWidth * 0.2) + 10;
        y = Math.floor(Math.random() * mapHeight * 0.2) + 10;
    } else if (i === 1) { // AI Player 1, bottom right
        x = Math.floor(Math.random() * mapWidth * 0.2) + mapWidth * 0.8;
        y = Math.floor(Math.random() * mapHeight * 0.2) + mapHeight * 0.8;
    } else if (i === 2) { // AI Player 2, top right
        x = Math.floor(Math.random() * mapWidth * 0.2) + mapWidth * 0.8;
        y = Math.floor(Math.random() * mapHeight * 0.2) + 10;
    } else if (i === 3) { // AI Player 3, bottom left
        x = Math.floor(Math.random() * mapWidth * 0.2) + 10;
        y = Math.floor(Math.random() * mapHeight * 0.2) + mapHeight * 0.8;
    }
    towers.push({ x, y, radius: 2.5, level: 5, player: i });
  }

  // Generate remaining towers
  for (let i = towers.length; i < totalTowers; i++) {
    let x, y;
    let attempts = 0;
    const MAX_ATTEMPTS = 250; // Limit attempts to prevent infinite loops

    do {
      x = Math.floor(Math.random() * mapWidth) + 10;
      y = Math.floor(Math.random() * mapHeight) + 10;
      attempts++;
    } while (isTooCloseToOtherTowers(x, y, towers) && attempts < MAX_ATTEMPTS);

    if (attempts >= MAX_ATTEMPTS) {
      console.warn("Max attempts reached, placing tower at a less ideal spot.");
       x = Math.floor(Math.random() * mapWidth) + 10;
       y = Math.floor(Math.random() * mapHeight) + 10;
    }


    towers.push({ x, y, radius: 2.5, level: Math.floor(Math.random()*12) + 1 }); // Random level between 1 and 20
  }

  return {
    // width: mapWidth,
    // height: mapHeight,
    towers: towers,
    links: [], // You'll likely add links later
  };
}


function isTooCloseToOtherTowers(x, y, towers) {
    const MIN_DISTANCE = 10; // Adjust as needed
    for (const tower of towers) {
        const dx = x - tower.x;
        const dy = y - tower.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < MIN_DISTANCE) {
            return true;
        }
    }
    return false;
}

export default generateMap;