// Game setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Time management
let lastTime = 0;
let deltaTime = 0;

// Game state
const state = {
    racers: {
        player: {
            name: 'YOU',
            color: '#ff0000',
            darkColor: '#990000',
            x: canvas.width / 2,
            y: canvas.height / 3,
            worldY: 0,  // Absolute position in world
            width: 40,
            height: 60,
            speed: 0,
            minSpeed: 27.777, // 10 km/h
            maxSpeed: 833.333, // 300 km/h
            acceleration: 200,
            deceleration: 300,
            brakeDeceleration: 600,
            turnSpeed: 300,
            baseSpeed: 400,
            angle: 0,
            targetAngle: 0,
            rotationSpeed: 5,
            distanceTraveled: 0
        },
        ai1: {  // AI-1
            name: 'AI-1',
            color: '#0066cc',
            darkColor: '#003366',
            x: canvas.width / 2,
            y: canvas.height / 3 - 100,  // Start slightly ahead
            worldY: 100,  // Absolute position in world
            yMargin: 0.45,
            width: 40,
            height: 60,
            speed: 0,
            minSpeed: 27.777, // 10 km/h
            maxSpeed: 750,  // Slightly slower than player
            speedMargin: 1.01,
            acceleration: 150,
            deceleration: 300,
            turnSpeed: 300,
            baseSpeed: 400,
            angle: 0,
            targetAngle: 0,
            rotationSpeed: 5,
            distanceTraveled: 0,
            lookAheadPoints: 7,     // How many road segments to look ahead
            
        },
        ai2: {  // AI-2
            name: 'AI-2',
            color: '#6666cc',
            darkColor: '#663366',
            x: canvas.width / 2,
            y: canvas.height / 3 - 80,  // Start slightly ahead
            worldY: 80,  // Absolute position in world
            yMargin: 0.4,
            width: 40,
            height: 60,
            speed: 0,
            minSpeed: 27.777, // 10 km/h
            maxSpeed: 750,  // Slightly slower than player
            speedMargin: 1.008,
            acceleration: 180,
            deceleration: 280,
            turnSpeed: 200,
            baseSpeed: 200,
            angle: 0,
            targetAngle: 0,
            rotationSpeed: 4,
            distanceTraveled: 0,
            lookAheadPoints: 4,     // How many road segments to look ahead
            
        },
        ai3: {  // AI-3
            name: 'AI-3',
            color: '#6600cc',
            darkColor: '#330066',
            x: canvas.width / 2,
            y: canvas.height / 3 - 40,  // Start slightly ahead
            worldY: 40,  // Absolute position in world
            yMargin: 0.55,
            width: 40,
            height: 60,
            speed: 0,
            minSpeed: 27.777, // 10 km/h
            maxSpeed: 750,  // Slightly slower than player
            speedMargin: 1.004,
            acceleration: 120,
            deceleration: 400,
            turnSpeed: 100,
            baseSpeed: 100,
            angle: 0,
            targetAngle: 0,
            rotationSpeed: 2,
            distanceTraveled: 0,
            lookAheadPoints: 2,     // How many road segments to look ahead
            
        },
    },
    road: {
        points: [],
        width: 200,
        segmentLength: 50,
        curveAmount: 0,
        targetCurve: 0
    },
    camera: { 
        y: 0,
        target: 'player'  // Camera follows player
    },
    game: {
        score: 0,
        distance: 0,
        startTime: performance.now(),
        elapsedTime: 0,
        isOnRoad: true,
        scoreMultiplier: 1,
        raceProgress: 0,  // Progress difference between player and AI (-1 to 1)
    }
};

function updateAI(ai, deltaTime) {
    // Find road center at look-ahead distance
    const targetWorldY = ai.worldY + ai.lookAheadPoints * state.road.segmentLength;
    
    // Find the road points that contain our target Y
    let targetX = ai.x;
    for (let i = 0; i < state.road.points.length - 1; i++) {
        const p1 = state.road.points[i];
        const p2 = state.road.points[i + 1];
        
        if (p1.y <= targetWorldY && p2.y > targetWorldY) {
            // Interpolate road position at target Y
            const t = (targetWorldY - p1.y) / (p2.y - p1.y);
            targetX = p1.x + t * (p2.x - p1.x);
            break;
        }
    }
    
    // Calculate steering based on distance from target
    const distanceFromTarget = targetX - ai.x;
    
    // Simple proportional steering
    const steerAmount = distanceFromTarget * 0.05;
    const maxSteerAngle = Math.PI / 6; // 30 degrees
    
    // Apply steering
    const turnMultiplier = ai.speed / ai.baseSpeed;
    ai.x += steerAmount * ai.turnSpeed * deltaTime * turnMultiplier;
    
    // Update angle smoothly
    ai.targetAngle = Math.max(-maxSteerAngle, Math.min(maxSteerAngle, steerAmount));
    const angleDiff = ai.targetAngle - ai.angle;
    ai.angle += angleDiff * ai.rotationSpeed * deltaTime;
    
    // Always accelerate when on road
    if (Math.abs(distanceFromTarget) < state.road.width * 0.4 && (canvas.height - ai.y)/canvas.height > ai.yMargin ) {
        // On road - accelerate
        ai.speed = Math.min(
            ai.speed + ai.acceleration * deltaTime,
            ai.maxSpeed
        );
    } else {
        // Off road - slow down
        ai.speed = Math.max(
            ai.minSpeed,
            ai.speed - ai.deceleration * deltaTime
        );
    }

    ai.maxSpeed = (9 * ai.maxSpeed + state.racers.player.speed) / 10 * ai.speedMargin;
    
    // Keep AI on screen
    const margin = ai.width/2 + 10;
    ai.x = Math.max(margin, Math.min(canvas.width - margin, ai.x));

    // Update absolute position
    ai.worldY += ai.speed * deltaTime;
    
    // Calculate screen Y position based on camera
    ai.y = ai.worldY - state.camera.y;
    
    // Update distance
    ai.distanceTraveled += ai.speed * deltaTime;
}

// Initialize road
function initRoad() {
    for (let y = -10*state.road.segmentLength; y < canvas.height + 1000; y += state.road.segmentLength) {
        state.road.points.push({
            x: canvas.width / 2,
            y: y
        });
    }
}

// Check if car is on road
function isCarOnRoad() {
    const carWorldY = state.camera.y + state.racers.player.y;
    let p1, p2;
    
    for (let i = 0; i < state.road.points.length - 1; i++) {
        if (state.road.points[i].y <= carWorldY && state.road.points[i + 1].y > carWorldY) {
            p1 = state.road.points[i];
            p2 = state.road.points[i + 1];
            break;
        }
    }
    
    if (!p1 || !p2) return false;
    
    const t = (carWorldY - p1.y) / (p2.y - p1.y);
    const roadX = p1.x + t * (p2.x - p1.x);
    
    return Math.abs(state.racers.player.x - roadX) < state.road.width / 2;
}

// Generate new road segments
function generateRoad() {
    state.road.curveAmount += (state.road.targetCurve - state.road.curveAmount) * 0.1;
    
    if (state.road.points[0].y - state.camera.y > -1000) {
        const lastPoint = state.road.points[state.road.points.length - 1];
        let newX = lastPoint.x + state.road.curveAmount;
        
        const margin = state.road.width / 2 + 20;
        if (newX - margin < 0) {
            newX = margin;
            state.road.targetCurve = Math.abs(state.road.targetCurve);
        } else if (newX + margin > canvas.width) {
            newX = canvas.width - margin;
            state.road.targetCurve = -Math.abs(state.road.targetCurve);
        }
        
        state.road.points.push({
            x: newX,
            y: lastPoint.y + state.road.segmentLength
        });
        
        if (Math.random() < 0.05) {
            const maxCurve = 15;
            if (newX < canvas.width * 0.3) {
                state.road.targetCurve = Math.random() * maxCurve;
            } else if (newX > canvas.width * 0.7) {
                state.road.targetCurve = -Math.random() * maxCurve;
            } else {
                state.road.targetCurve = (Math.random() - 0.5) * maxCurve;
            }
        }
    }
    
    while (state.road.points[0].y - state.camera.y < -state.road.segmentLength) {
        state.road.points.shift();
    }
}

// Draw road
function drawRoad() {
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(state.road.points[0].x - state.road.width/2, state.road.points[0].y - state.camera.y);
    
    for (let i = 1; i < state.road.points.length; i++) {
        ctx.lineTo(state.road.points[i].x - state.road.width/2, state.road.points[i].y - state.camera.y);
    }
    
    for (let i = state.road.points.length - 1; i >= 0; i--) {
        ctx.lineTo(state.road.points[i].x + state.road.width/2, state.road.points[i].y - state.camera.y);
    }
    
    ctx.fill();

    // Road markings
    ctx.strokeStyle = '#FFF';
    ctx.setLineDash([30, 30]);
    ctx.beginPath();
    for (let i = 0; i < state.road.points.length - 1; i++) {
        ctx.moveTo(state.road.points[i].x, state.road.points[i].y - state.camera.y);
        ctx.lineTo(state.road.points[i + 1].x, state.road.points[i + 1].y - state.camera.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
}

// Draw car
function drawCar(car) {
    // Only draw if car is visible on screen
    if (car.y < -car.height || car.y > canvas.height + car.height) return;

    ctx.save();
    
    ctx.translate(car.x, car.y - car.height/2);
    ctx.rotate(-car.angle);
    
    const gradient = ctx.createLinearGradient(
        -car.width/2,
        -car.height/2,
        car.width/2,
        car.height/2
    );

    gradient.addColorStop(1, car.color);
    gradient.addColorStop(0, car.darkColor);
    
    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.roundRect(
        -car.width/2,
        -car.height/2,
        car.width,
        car.height,
        5
    );
    ctx.fill();
    ctx.stroke();
    
    // Car details
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(-car.width/4, -car.height/3, car.width/2, car.height/6);
    ctx.fillRect(-car.width/4, car.height/6, car.width/2, car.height/6);
    
    ctx.restore();
}

// Update race progress calculation (normalize to -1...1 range)
// function updateRaceProgress() {
//     const maxDiff = 2000;
//     const progressDiff = state.racers.player.worldY - state.racers.ai.worldY;
//     state.game.raceProgress = Math.max(-1, Math.min(1, progressDiff / maxDiff));
// }
function updateRaceProgress() {
    const maxDiff = 2000;
    const racers = Object.values(state.racers);
    
    // Find the leading and trailing racers
    const leadingWorldY = Math.max(...racers.map(r => r.worldY));
    const trailingWorldY = Math.min(...racers.map(r => r.worldY));
    
    // Calculate normalized positions for all racers (0 to 1)
    const positions = racers.map(racer => {
        const relativePosition = (racer.worldY - trailingWorldY) / (leadingWorldY - trailingWorldY || 1);
        return {
            name: racer.name,
            color: racer.color,
            position: Math.max(0, Math.min(1, relativePosition))
        };
    });

    state.game.racePositions = positions;
}

// Add race progress indicator to HUD
function drawRaceProgress() {
    const progressWidth = 200;
    const progressHeight = 20;
    const x = (canvas.width - progressWidth) / 2;
    const y = 20;
    
    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(x, y, progressWidth, progressHeight, 5);
    ctx.fill();

    // Draw each racer's position
    state.game.racePositions.forEach(racer => {
        const xPos = x + (progressWidth*0.9 * racer.position) + progressWidth*0.05;
        
        ctx.fillStyle = racer.color;
        ctx.beginPath();
        ctx.arc(xPos, y + progressHeight/2, 5, 0, Math.PI * 2);
        ctx.fill();
    });
}

// Get racer's current position (1st, 2nd, etc.)
function getRacerPosition(racer) {
    const positions = Object.values(state.racers)
        .sort((a, b) => b.worldY - a.worldY)
        .map(r => r.name);
    return positions.indexOf(racer.name) + 1;
}

// Get position suffix (1st, 2nd, 3rd, etc.)
function getPositionSuffix(position) {
    const suffixes = ['st', 'nd', 'rd'];
    const specialSuffix = position <= 3 ? suffixes[position - 1] : 'th';
    return `${position}${specialSuffix}`;
}

// Get color for speed bar
function getRacerSpeedColor(percent) {
    if (percent < 0.3) return '#4CAF50';
    if (percent < 0.6) return '#FFC107';
    if (percent < 0.8) return '#FF9800';
    return '#F44336';
}

// Draw positions chart
function drawPositionsChart() {
    const width = 60;
    const height = 200;
    const x = canvas.width - width - 10;
    const y = (canvas.height - height) / 2;
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 10);
    ctx.fill();

    // Sort racers by position
    const racers = Object.values(state.racers)
        .sort((a, b) => b.worldY - a.worldY);

    // Draw position indicators
    const spacing = height / (racers.length + 1);
    racers.forEach((racer, index) => {
        const racerY = y + spacing * (index + 1);
        
        // Racer dot
        ctx.fillStyle = racer.color;
        ctx.beginPath();
        ctx.arc(x + width/2, racerY, 8, 0, Math.PI * 2);
        ctx.fill();

        // Racer name
        ctx.font = '12px system-ui, "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(racer.name, x + width/2, racerY + 20);
    });
}

//Generic function to draw racer HUD
function drawRacerHUD(racer, position, index) {
    const padding = 10;
    const width = 200;
    const height = 90;
    const x = position === 'left' ? padding : canvas.width - width - padding;
    const y = padding + (height + padding) * index;

    // HUD background with gradient
    const hudGradient = ctx.createLinearGradient(x, y, x, y + height);
    hudGradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
    hudGradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
    
    ctx.fillStyle = hudGradient;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 10);
    ctx.fill();

    // Racer name with colored indicator
    ctx.fillStyle = racer.color;
    ctx.beginPath();
    ctx.arc(x + 15, y + 20, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 16px system-ui, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(racer.name, x + 30, y + 20);

    // Speed
    const speedKmh = Math.round(racer.speed * 0.36);
    ctx.font = 'bold 24px system-ui, "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${speedKmh}`, x + 15, y + 50);
    ctx.font = '14px system-ui, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('km/h', x + 80, y + 50);

    // Position indicator
    const positionSuffix = getPositionSuffix(getRacerPosition(racer));
    ctx.font = 'bold 20px system-ui, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'right';
    ctx.fillText(positionSuffix, x + width - 15, y + 20);

    // Speed bar
    const barWidth = width - 30;
    const barHeight = 8;
    const barX = x + 15;
    const barY = y + height - 15;
    
    // Bar background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, 4);
    ctx.fill();
    
    // Speed indicator
    const speedPercent = (racer.speed - racer.minSpeed) / (racer.maxSpeed - racer.minSpeed);
    ctx.fillStyle = getRacerSpeedColor(speedPercent);
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth * speedPercent, barHeight, 4);
    ctx.fill();
}

// Handle keyboard input
let keys = {};
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

// Handle touch input
let touchStartX = null;
let isTouching = false;

window.addEventListener('touchstart', handleTouchStart);
window.addEventListener('touchmove', handleTouchMove);
window.addEventListener('touchend', handleTouchEnd);

function handleTouchStart(event) {
    touchStartX = event.touches[0].clientX;
    isTouching = true;
}

function handleTouchMove(event) {
    if (!touchStartX) return;
    
    const touchX = event.touches[0].clientX;
    const diffX = touchX - touchStartX;
    
    touchStartX = touchX;
    
    state.racers.player.x += diffX;
    state.racers.player.targetAngle = (diffX / 100) * Math.PI / 6;
}

function handleTouchEnd() {
    touchStartX = null;
    isTouching = false;
    state.racers.player.targetAngle = 0;
}

// Update game state
function update(deltaTime) {
    state.game.isOnRoad = isCarOnRoad();
    state.game.scoreMultiplier = state.game.isOnRoad ? 1 : 0.5;

    if (keys['ArrowUp'] || isTouching) {
        state.racers.player.speed = Math.min(
            state.racers.player.speed + state.racers.player.acceleration * deltaTime,
            state.racers.player.maxSpeed
        );
    } else if (keys['ArrowDown']) {
        state.racers.player.speed = Math.max(
            state.racers.player.minSpeed,
            state.racers.player.speed - state.racers.player.brakeDeceleration * deltaTime
        );
    } else {
        state.racers.player.speed = Math.max(
            state.racers.player.minSpeed,
            state.racers.player.speed - state.racers.player.deceleration * deltaTime
        );
    }

    const turnMultiplier = state.racers.player.speed / state.racers.player.baseSpeed;
    if (keys['ArrowLeft']) {
        state.racers.player.x -= state.racers.player.turnSpeed * deltaTime * turnMultiplier;
        state.racers.player.targetAngle = -Math.PI / 6;
    } else if (keys['ArrowRight']) {
        state.racers.player.x += state.racers.player.turnSpeed * deltaTime * turnMultiplier;
        state.racers.player.targetAngle = Math.PI / 6;
    } else if (!isTouching) {
        state.racers.player.targetAngle = 0;
    }
    
    const angleDiff = state.racers.player.targetAngle - state.racers.player.angle;
    state.racers.player.angle += angleDiff * state.racers.player.rotationSpeed * deltaTime;
    
    state.racers.player.x = Math.max(state.racers.player.width/2, Math.min(canvas.width - state.racers.player.width/2, state.racers.player.x));
    
    // Update absolute position
    state.racers.player.worldY += state.racers.player.speed * deltaTime;
    
    // Update camera to follow player
    state.camera.y = state.racers.player.worldY - state.racers.player.y;
    //state.camera.y += state.racers.player.speed * deltaTime;

    state.game.elapsedTime = (performance.now() - state.game.startTime) / 1000;
    state.game.distance += state.racers.player.speed * deltaTime / 10; // 1 pixel = 1 cm
    state.game.score += (state.racers.player.speed / state.racers.player.baseSpeed) * deltaTime * 10 * state.game.scoreMultiplier;
    
    generateRoad();
}

function drawHUD() {
    // Draw individual racer HUDs
    Object.values(state.racers).forEach((racer, index) => {
        drawRacerHUD(racer, index % 2 === 0 ? 'left' : 'right', Math.floor(index/2));
    });

    // Draw positions chart
    drawPositionsChart();
}

// Game loop
function gameLoop(currentTime) {
    deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    
    ctx.fillStyle = '#85C1E9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    update(deltaTime);

    Object.values(state.racers).filter(racer => racer.name !== 'YOU').forEach(racer => {
        updateAI(racer, deltaTime);
    });

    updateRaceProgress();

    drawRoad();

    Object.values(state.racers).reverse().forEach(drawCar);
    drawHUD();

    drawRaceProgress();
    
    requestAnimationFrame(gameLoop);
}

// Start game
initRoad();
requestAnimationFrame(gameLoop);