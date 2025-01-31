import levels from "./levels.js"; // Import the levels array
import tutorialSteps from "./tutorial.js"; // Import tutorial instructions

const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");
let DPR = 1,
  drawMultiplierRatio = 1;
const TOUCHEVENT_MARGIN = 1.2;

let gamePaused = false;

const players = [
  { color: "blue" }, // Player 0
  { color: "red" }, // Player 1
  { color: "green" }, // Player 2
  { color: "yellow" }, // Player 3
];

const aiLevels = [
  {
    name: "Easy",
    actionTime: 12500,
  },
  {
    name: "Normal",
    actionTime: 8500,
  },
  {
    name: "Hard",
    actionTime: 2500,
  },
];

let towers = [];
let links = [];
let units = [];
let explosions = [];

let levelStartTime;
let currentStep = 0;
let currentLevelIndex = 0,
  aiLevel = aiLevels[0];

let dragStartX, dragStartY;
let isDragging = false;
let startTower = null,
  endTower = null;

let performancePrevious = performance.now();

function loadLevel(levelIndex) {
  currentStep = (levelIndex === 0 ? 0 : Infinity);
  currentLevelIndex = levelIndex;
  towers = JSON.parse(JSON.stringify(levels[currentLevelIndex].towers));
  links = JSON.parse(JSON.stringify(levels[currentLevelIndex].links));
  units = []; // Reset units when loading a new level
  explosions = []; // Reset explosions
  gamePaused = false;
  drawMultiplierRatio = calculateDisplayRatio();
  performancePrevious = levelStartTime = performance.now();
  lastAITime = performancePrevious - 1000;

  // Start the Game loop
  gameLoop();

  // Start the AI loop
  aiLoop();
}

function resizeCanvas() {
  DPR = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * DPR;
  canvas.height = window.innerHeight * DPR;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.scale(DPR, DPR);
  drawMultiplierRatio = calculateDisplayRatio();
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Force landscape orientation
screen.orientation.lock("landscape").catch(function () {
  // If lock fails, use alternative method
  const portrait = window.matchMedia("(orientation: portrait)");
  if (portrait.matches) {
    // Show a message or rotate the canvas
    // alert("Please rotate your device to landscape mode.");
    // or: ctx.rotate(Math.PI / 2);
  }
});

function calculateDisplayRatio() {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  towers.forEach((tower) => {
    minX = Math.min(minX, tower.x - tower.radius);
    minY = Math.min(minY, tower.y - tower.radius);
    maxX = Math.max(maxX, tower.x + tower.radius);
    maxY = Math.max(maxY, tower.y + tower.radius);
  });

  const levelWidth = maxX + minX; //+ 4 * towers[0]?.radius;
  const levelHeight = maxY + minY; //+ 4 * towers[0]?.radius;
  const canvasRatio = canvas.width / canvas.height;
  const levelRatio = levelWidth / levelHeight;

  if (canvasRatio > levelRatio) return canvas.height / levelHeight / DPR; // Canvas is wider than level, fit by height
  return canvas.width / levelWidth / DPR; // Canvas is taller than level, fit by width
}

function displayTutorialInstruction(step) {
    ctx.font = `${1.75 * drawMultiplierRatio}px Arial`;
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(step.text, canvas.width / 2 / DPR, (towers[0].y - 4) * drawMultiplierRatio / DPR);
  }

function drawTower(tower) {
  // Add shadow effect
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = 3 * drawMultiplierRatio;
  ctx.shadowColor = tower.player >= 0 ? players[tower.player].color : "gray";

  ctx.beginPath();
  ctx.lineWidth = 0.1 * drawMultiplierRatio;
  ctx.arc(tower.x * drawMultiplierRatio, tower.y * drawMultiplierRatio, tower.radius * drawMultiplierRatio, 0, 2 * Math.PI);
  ctx.fillStyle = tower.player >= 0 ? players[tower.player].color : "gray";
  ctx.fill();

  if (startTower === tower || endTower === tower) {
    ctx.beginPath();
    ctx.lineWidth = 0.2 * drawMultiplierRatio;
    ctx.arc(
      tower.x * drawMultiplierRatio,
      tower.y * drawMultiplierRatio,
      tower.radius * drawMultiplierRatio * TOUCHEVENT_MARGIN,
      0,
      2 * Math.PI
    );
    ctx.strokeStyle = players[startTower?.player].color;
    ctx.stroke();
  }

  // Reset shadow properties
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = 0;

  // Display tower level
  ctx.font = `${2 * drawMultiplierRatio}px Arial`;
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tower.level < 100 ? tower.level : "Max", tower.x * drawMultiplierRatio, tower.y * drawMultiplierRatio);
}

function isPointInTower(x, y, tower) {
  const dx = x - tower.x;
  const dy = y - tower.y;
  return Math.sqrt(dx * dx + dy * dy) <= tower.radius * TOUCHEVENT_MARGIN;
}

function linkExists(from, to) {
  return links.some((link) => link.from === from && link.to === to);
}

function removeLink(from, to) {
  links = links.filter(
    (link) =>
      !(
        (link.from === from && link.to === to) //|| (link.from === to && link.to === from)
      )
  );

  // Remove units associated with the removed link
  units = units.filter((unit) => !(unit.target === to && unit.from === from));
}

function drawLink(link) {
  const dx = link.to.x - link.from.x;
  const dy = link.to.y - link.from.y;
  const angle = Math.atan2(dy, dx);
  const distance = Math.sqrt(dx * dx + dy * dy) * drawMultiplierRatio;

  // Check if there is a reverse link
  const reverseLink = links.find((l) => l.from === link.to && l.to === link.from);

  let endX, endY;
  if (reverseLink) {
    // If there is a reverse link, draw only half the distance
    const halfDistance = distance / 2;
    endX = link.from.x * drawMultiplierRatio + halfDistance * Math.cos(angle);
    endY = link.from.y * drawMultiplierRatio + halfDistance * Math.sin(angle);
  } else {
    // Otherwise, draw the full line
    endX = link.to.x * drawMultiplierRatio;
    endY = link.to.y * drawMultiplierRatio;
  }

  // Add shadow effect
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = 1 * drawMultiplierRatio;
  ctx.shadowColor = players[link.from.player].color;

  ctx.beginPath();
  ctx.lineWidth = 0.25 * drawMultiplierRatio;
  ctx.moveTo(link.from.x * drawMultiplierRatio, link.from.y * drawMultiplierRatio);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = players[link.from.player].color;
  ctx.stroke();

  // Draw moving arrowhead
  const arrowheadSize = 0.75 * drawMultiplierRatio; // Adjust size as needed
  const arrowheadPosition = ((performance.now() / 5000) % 1) * distance; // Calculate position based on time

  // Calculate arrowhead coordinates
  const arrowX = link.from.x * drawMultiplierRatio + arrowheadPosition * Math.cos(angle);
  const arrowY = link.from.y * drawMultiplierRatio + arrowheadPosition * Math.sin(angle);

  // Rotate the canvas to draw the arrowhead
  ctx.save();
  ctx.translate(arrowX, arrowY);
  ctx.rotate(angle);

  // Draw the arrowhead (triangle)
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-arrowheadSize, -arrowheadSize / 2);
  ctx.lineTo(-arrowheadSize, arrowheadSize / 2);
  ctx.closePath();
  ctx.fillStyle = players[link.from.player].color;
  ctx.fill();

  ctx.restore();

  // Reset shadow properties
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = 0;
}

function doIntersect(p1, q1, p2, q2) {
  // Calculate the orientation of points using the following function
  function orientation(p, q, r) {
    const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (val === 0) return 0; // Collinear
    return val > 0 ? 1 : 2; // Clockwise or counterclockwise
  }

  // Find the orientations of the four points formed by the line segments
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  // Check for general cases of intersection
  if (o1 !== o2 && o3 !== o4) return true;

  // Check for special cases where line segments overlap or share endpoints
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;

  return false; // No intersection
}

// Function to check if a point lies on a line segment
function onSegment(p, q, r) {
  return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
}

function checkCollision(unit1, unit2) {
  const dx = unit1.x - unit2.x;
  const dy = unit1.y - unit2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < (unit1.radius + unit2.radius) / 2;
}

function createUnit(tower, link) {
  if (!link) return;

  // Basic unit object with properties for position, movement, etc.
  const unit = {
    x: tower.x,
    y: tower.y,
    radius: 1,
    speed: 17.5, // the map is 100 in height
    from: tower,
    target: link.to, // Target tower
    player: tower.player, // the owner
  };
  units.push(unit);
}

function updateUnit(unit, delay) {
  // Calculate direction vector towards the target tower
  const dx = unit.target.x - unit.x;
  const dy = unit.target.y - unit.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Move the unit towards the target
  unit.x += (dx / distance) * unit.speed * (delay / 1000);
  unit.y += (dy / distance) * unit.speed * (delay / 1000);

  // Check if the unit reached the target tower
  if (distance < unit.radius) {
    if (unit.target.player !== unit.player) {
      // Target tower not owned by player 0
      if (unit.target.level === 0) {
        unit.target.player = unit.player; // Convert ownership
        links.filter((link) => link.from === unit.target).forEach((link) => removeLink(link.from, link.to));
      } else {
        unit.target.level--; // Decrease level
      }
      explosions.push(createExplosion(unit.x, unit.y)); // Add explosion
    } else {
      // Target tower and unit have same ownership
      if (unit.target.level < 100) {
        unit.target.level++; // Increase level
      } else {
        const outgoingLinks = links.filter((link) => link.from === unit.target);
        createUnit(unit.target, outgoingLinks[(Math.random() * outgoingLinks.length) | 0]);
      }
    }
    // Remove the unit or perform other actions upon reaching the target
    units.splice(units.indexOf(unit), 1);
  }
}

function drawUnit(unit) {
  // Add shadow effect
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = 2 * drawMultiplierRatio;
  ctx.shadowColor = players[unit.player].color;

  // Draw a simple representation of the unit
  ctx.beginPath();
  ctx.lineWidth = 0.1 * drawMultiplierRatio;
  ctx.arc(unit.x * drawMultiplierRatio, unit.y * drawMultiplierRatio, unit.radius * drawMultiplierRatio, 0, 2 * Math.PI); // Example radius
  ctx.fillStyle = players[unit.player].color;
  ctx.fill();

  // Reset shadow properties
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = 0;
}

function createExplosion(x, y) {
  const particles = [];
  for (let i = 0; i < 25; i++) {
    particles.push({
      x: x,
      y: y,
      angle: Math.random() * Math.PI * 2,
      speed: Math.random() * 6,
      size: Math.random() * 0.075 + 0.025,
      life: Math.random() * 800 + 600, // Lifetime in milliseconds
    });
  }

  return {
    size() {
      return particles.length;
    },

    update(delay) {
      particles.forEach((particle) => {
        particle.x += Math.cos(particle.angle) * particle.speed * (delay / 1000);
        particle.y += Math.sin(particle.angle) * particle.speed * (delay / 1000);
        particle.life -= delay;
      });

      // Remove dead particles
      particles.splice(0, particles.length, ...particles.filter((particle) => particle.life > 0));
    },

    draw() {
      particles.forEach((particle) => {
        ctx.beginPath();
        ctx.arc(particle.x * drawMultiplierRatio, particle.y * drawMultiplierRatio, particle.size * drawMultiplierRatio, 0, 2 * Math.PI);
        ctx.fillStyle = "orange";
        ctx.fill();
      });
    },
  };
}

function getNearestTowerToConquest(playerTower) {
  let nearestTower = null;
  let nearestDistance = Infinity;

  towers.forEach((tower) => {
    if (tower.player !== playerTower.player && !linkExists(playerTower, tower)) {
      const dx = tower.x - playerTower.x;
      const dy = tower.y - playerTower.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < nearestDistance) {
        nearestTower = tower;
        nearestDistance = distance;
      }
    }
  });

  if (!nearestTower && aiLevel !== aiLevels[0]) {
    towers.forEach((tower) => {
      if (tower.player === playerTower.player && !linkExists(playerTower, tower) && !linkExists(tower, playerTower)) {
        const dx = tower.x - playerTower.x;
        const dy = tower.y - playerTower.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < nearestDistance) {
          nearestTower = tower;
          nearestDistance = distance;
        }
      }
    });
  }

  return nearestTower;
}

function performAIAction(playerIndex) {
  let actionDone = false;

  // Find all towers owned by the player, shuffled
  const playerTowers = towers.filter((tower) => tower.player === playerIndex).sort((a, b) => Math.random() - 0.5);

  playerTowers.forEach((playerTower) => {
    if (actionDone) return;

    // Find the nearest tower to conquest
    const nearestTower = getNearestTowerToConquest(playerTower);

    // If a tower is found, create a link to it
    if (nearestTower && !linkExists(playerTower, nearestTower)) {
      const outgoingLinks = links.filter((link) => link.from === playerTower);
      if (
        (playerTower.level < 15 && outgoingLinks.length >= 1) ||
        (playerTower.level < 40 && outgoingLinks.length >= 2) ||
        (playerTower.level < 75 && outgoingLinks.length >= 3)
        /*|| playerTower.level < 90 && outgoingLinks.length >= 4*/
      ) {
        return; // this tower is already full of outgoing links
      } else {
        links.push({ from: playerTower, to: nearestTower, lastUnitCreationTime: performance.now() });
        actionDone = true;
      }
    }
  });
}

// AI loop for players 1, 2, and 3
let lastAITime = -1000;
function aiLoop(timestamp) {
  if (gamePaused) return;

  if (timestamp - lastAITime >= aiLevel.actionTime) {
    for (let i = 1; i <= 3; i++) {
      // For players 1, 2, and 3
      performAIAction(i);
    }
    lastAITime = timestamp;
  }
  setTimeout(() => requestAnimationFrame(aiLoop), 400);
}

canvas.addEventListener("mousedown", downEvent);

canvas.addEventListener("mouseup", upEvent);

canvas.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  else moveEvent(e);
  e.preventDefault();
});

// canvas.addEventListener('touchstart', (e) => {});

canvas.addEventListener("touchend", (e) => {
  if (isDragging) {
    e = e.changedTouches[0];
    upEvent(e);
  }
});

canvas.addEventListener("touchmove", (e) => {
  if (!isDragging) {
    downEvent(e.touches[0]);
  } else {
    moveEvent(e.touches[0]);
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && gamePaused) {
    gamePaused = false;
    performancePrevious = performance.now(); // Reset lastUpdateTime to avoid a large "jump" when resuming
    gameLoop(); // Restart the game loop
  } else {
    gamePaused = true;
  }
});

// Add event listeners to the buttons
document.getElementById('startGameButton').addEventListener('click', startGame);
document.getElementById('aboutButton').addEventListener('click', showAbout);
document.getElementById('rulesButton').addEventListener('click', showRules);
document.getElementById('optionsButton').addEventListener('click', showOptions);
document.getElementById('hideAbout').addEventListener('click', hideAbout);
document.getElementById('hideRules').addEventListener('click', hideRules);
document.getElementById('hideOptions').addEventListener('click', hideOptions);

function downEvent(e) {
  const x = e.clientX / drawMultiplierRatio;
  const y = e.clientY / drawMultiplierRatio;

  isDragging = true;
  startTower = null;

  dragStartX = x;
  dragStartY = y;

  towers
    .filter((tower) => tower.player === 0)
    .forEach((tower) => {
      if (isPointInTower(x, y, tower)) {
        startTower = tower;

        const outgoingLinks = links.filter((link) => link.from === startTower);
        if (
          (startTower.level < 15 && outgoingLinks.length >= 1) ||
          (startTower.level < 40 && outgoingLinks.length >= 2) ||
          (startTower.level < 75 && outgoingLinks.length >= 3)
          // || startTower.level < 90 && outgoingLinks.length >= 4
        ) {
          startTower = null;
          isDragging = false;
          return;
        }
      }
    });
}

function moveEvent(e) {
  const x = e.clientX / drawMultiplierRatio;
  const y = e.clientY / drawMultiplierRatio;

  if (!startTower) return;

  endTower = null;

  towers.forEach((tower) => {
    if (tower !== startTower && isPointInTower(x, y, tower)) {
      endTower = tower;
    }
  });
}

function upEvent(e) {
  if (!isDragging) return;
  const x = e.clientX / drawMultiplierRatio;
  const y = e.clientY / drawMultiplierRatio;

  // Check if the drag-end position intersects with any existing link
  if (!startTower) {
    links
      .filter((link) => link.from.player === 0)
      .forEach((link) => {
        const startPoint = { x: link.from.x, y: link.from.y };
        const endPoint = { x: link.to.x, y: link.to.y };
        const draggedLine = {
          start: { x: dragStartX, y: dragStartY },
          end: { x: x, y: y },
        };
        if (doIntersect(startPoint, endPoint, draggedLine.start, draggedLine.end)) {
          removeLink(link.from, link.to);
        }
      });
  }

  // Add a new link if the drag-end position is on a tower and there's no existing link
  if (endTower && !linkExists(startTower, endTower)) {
    if (linkExists(endTower, startTower) && endTower.player === 0) {
      removeLink(endTower, startTower);
    }
    links.push({ from: startTower, to: endTower, lastUnitCreationTime: performance.now() });
  }

  isDragging = false;
  startTower = null;
  endTower = null;
}

function showMenu() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Populate level selector
  const levelSelect = document.getElementById("levelSelect");
  levelSelect.innerHTML = ""; // Clear previous options
  for (let i = 0; i < levels.length; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.text = `Level ${i + 1}`;
    levelSelect.add(option);
  }
  levelSelect.value = currentLevelIndex;

  // Populate AI level selector
  const aiLevelSelect = document.getElementById("aiLevelSelect");
  aiLevelSelect.innerHTML = ""; // Clear previous options
  for (let i = 0; i < aiLevels.length; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.text = `${aiLevels[i].name}`;
    aiLevelSelect.add(option);
  }
  aiLevelSelect.value = aiLevels.findIndex((ai) => ai.name === aiLevel.name);

  document.getElementById("menu").style.display = "flex";
}

function hideMenu() {
  document.getElementById("menu").style.display = "none";
}

function startGame() {
  const levelIndex = document.getElementById("levelSelect").value;
  aiLevel = aiLevels[document.getElementById("aiLevelSelect").value];
  loadLevel(parseInt(levelIndex));
  hideMenu();
}

function showAbout() {
    document.getElementById("menu").style.display = "none";
  document.getElementById("aboutContent").style.display = "flex";
}

function hideAbout() {
    document.getElementById("menu").style.display = "flex";
  document.getElementById("aboutContent").style.display = "none";
}

function showRules() {
    document.getElementById("menu").style.display = "none";
  document.getElementById("rulesContent").style.display = "flex";
}

function hideRules() {
    document.getElementById("menu").style.display = "flex";
  document.getElementById("rulesContent").style.display = "none";
}

function showOptions() {
    document.getElementById("menu").style.display = "none";
  document.getElementById("optionsContent").style.display = "flex";
}

function hideOptions() {
    document.getElementById("menu").style.display = "flex";
  document.getElementById("optionsContent").style.display = "none";
}

function checkEndGame() {
  for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
    const allTowersOwned = towers.every((tower) => tower.player === playerIndex);
    if (allTowersOwned) {
      console.log(`Player ${playerIndex} wins!`);
      gamePaused = true;

      // Display the winning message
      ctx.font = `${5 * drawMultiplierRatio}px Arial`; // Large font size for the message
      ctx.fillStyle = "antiquewhite";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const text = playerIndex === 0 ? "You win!" : `Player ${players[playerIndex].color} wins!`;
      ctx.fillText(text, canvas.width / 2 / DPR, canvas.height / 2 / DPR);

      if (playerIndex === 0 && currentLevelIndex < levels.length - 1) setTimeout(() => showMenu(), 5000);
      else setTimeout(() => showMenu(), 5000);
      return true;
    }
  }
  return false;
}

// Your game loop and rendering logic here
function gameLoop() {
  if (gamePaused) return; // Don't update if the game is paused

  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const currentTime = performance.now();
  const delay = currentTime - performancePrevious;

  // Tutorial logic
  if (currentStep < tutorialSteps.length) {
    displayTutorialInstruction(tutorialSteps[currentStep]);
    if (tutorialSteps[currentStep].condition({ levelStartTime, towers, links, explosions })) {
      currentStep++;
    }
  }

  // Draw links
  links.forEach(drawLink);

  // Towers are creating units
  towers.forEach((tower) => {
    if (tower.level < 1) return; // Tower with level 0 cannot create unit

    // Find all links starting from this tower
    const outgoingLinks = links.filter((link) => link.from === tower);

    outgoingLinks.forEach((link) => {
      if (currentTime - link.lastUnitCreationTime >= 1250 - 2 * tower.level) {
        createUnit(tower, link);
        link.lastUnitCreationTime = currentTime;
      }
    });
  });

  // Update and draw units
  units.forEach((unit) => updateUnit(unit, delay));
  // Check for collisions between units of different players
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const unit1 = units[i];
      const unit2 = units[j];
      if (unit1.player !== unit2.player && checkCollision(unit1, unit2)) {
        // Destroy both units and create explosions
        explosions.push(createExplosion(unit1.x, unit1.y));
        explosions.push(createExplosion(unit2.x, unit2.y));
        units.splice(j, 1); // Remove unit2 first to avoid index issues
        units.splice(i, 1);
        i--; // Decrement i to account for the removed unit
        break; // Exit the inner loop since unit1 is already removed
      }
    }
  }
  units.forEach(drawUnit);

  // Draw towers
  towers.forEach(drawTower);

  // Update and draw explosions
  explosions.forEach((explosion) => explosion.update(delay));
  explosions.forEach((explosion) => explosion.draw());
  explosions = explosions.filter((explosion) => explosion.size() > 0);

  requestAnimationFrame(gameLoop);
  performancePrevious = currentTime;

  checkEndGame(); // Stop the game loop if the game has ended
}

// Show the menu initially
showMenu();

// Load the first level
//loadLevel(0);

// Start the Game loop
// gameLoop(); // Useless, it is included in the loadLevel()
