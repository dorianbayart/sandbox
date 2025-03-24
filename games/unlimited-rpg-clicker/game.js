"use strict";

import { Application, Assets, Graphics, Sprite, Text, TextStyle } from "./pixi.min.mjs";

(async () => {
  // Initialize PixiJS
  const app = new Application();
  await app.init({
    width: 800, // Width of the canvas
    height: 600, // Height of the canvas
    backgroundColor: 0xffffff, // Background color (same as CSS)
    antialias: true, // Disable anti-aliasing for pixel art
    resolution: 1, // Set to 1 for pixel-perfect rendering
    resizeTo: window,
    roundPixels: false,
  });

  // Use the native window resolution as the default resolution
  //PIXI.settings.RESOLUTION = window.devicePixelRatio;
  // Disable interpolation when scaling, will make texture be pixelated
  //PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

  // Add canvas to DOM body
  document.body.appendChild(app.canvas);

  // --- Textures ---
  let enemyTexture;

  // --- Game Variables ---
  let clicks = 0;
  const numberOfEnemies = 5;
  const enemies = []; // Array to hold enemy sprites
  const playerSpeed = 60; // Adjust for player movement speed
  const playerAttack = 15;
  const playerAttackSpeed = 0.4; // Attack every 0.2 seconds
  let playerAttackLoader = 0; // Attack charger - 0 is ready to attack
  let attackRange = 100; // Distance within which player can attack
  let currentNearestEnemy = null; // Track the current nearest enemy
  const damageNumberPool = []; // Object pool for damage numbers (optimization later if needed)
  const activeDamageNumbers = []; // Array to hold currently animating damage numbers

  // --- Player Stats ---
  let playerBaseDamage = 10; // Initial base damage
  let playerAttackSpeedMultiplier = 1; // Initial attack speed multiplier (for future use)
  let playerRangeMultiplier = 1; // Initial range multiplier
  let playerCurrency = 0;

  // --- Upgrade Costs ---
  const upgradeCosts = {
    damage: 50,
    range: 80,
    speed: 120,
  };

  // --- UI elements ---
  let statsContainer;
  let currencyText;
  let damageUpgradeButton;
  let rangeUpgradeButton;
  let speedUpgradeButton;
  const uiBackgroundColor = 0x222222; // Darker UI background color
  const uiTextColor = 0xeeeeee; // Light text color

  // --- Load Player Sprite ---
  let playerSprite;
  try {
    console.log("Attempting to load player.png");
    const playerTexture = await Assets.load("https://img.icons8.com/led/32/tank-top-view.png");
    console.log("player.png texture loaded successfully");
    playerSprite = new Sprite(playerTexture); // Create a sprite from the texture
    playerSprite.anchor.set(0.5); // Center the sprite
    playerSprite.x = app.screen.width / 2; // Center horizontally
    playerSprite.y = app.screen.height / 2; // Center vertically
    app.stage.addChild(playerSprite); // Add to the stage
    console.log("Player sprite added to stage");
  } catch (e) {
    console.error("Failed to load player.png:", e);
    // Fallback: if loading fails, use the Graphics object (square) as before
    const player = new Graphics();
    player.beginFill(0x00ff00);
    player.drawRect(0, 0, 32, 32);
    player.endFill();
    player.x = app.screen.width / 2 - 16;
    player.y = app.screen.height / 2 - 16;
    app.stage.addChild(player);
    playerSprite = player; // Assign fallback for click events
    console.log("Fallback player (green square) added to stage");
  }

  // --- Load Enemy Sprite and Create Enemies ---
  try {
    console.log("Attempting to load enemy.png");
    enemyTexture = await Assets.load("https://img.icons8.com/led/32/naval-mine.png");
    console.log("enemy.png texture loaded successfully");

    // for (let i = 0; i < numberOfEnemies; i++) {
    //   popEnemy();
    // }
  } catch (e) {
    console.error("Failed to load enemy.png:", e);
  }

  function popEnemy() {
    const enemySprite = new Sprite(enemyTexture);
    enemySprite.anchor.set(0.5);

    // Randomly position enemies on the canvas, avoiding player for now
    enemySprite.x = (Math.random() * app.screen.width) | 0;
    enemySprite.y = (Math.random() * app.screen.height) | 0;

    // Add some basic properties to each enemy (for future use in combat, etc.)
    enemySprite.health = 100; // Example: Set initial health to 100
    enemySprite.attack = 2;
    enemySprite.isEnemy = true;

    enemies.push(enemySprite); // Add to the enemies array
    app.stage.addChild(enemySprite); // Add to the stage for rendering
    console.log(`Enemy sprite added to stage`);
  }

  function destroyEnemy(enemyToRemove) {
    if (!enemyToRemove) return;

    // 1. Remove from stage (make it invisible and stop rendering)
    app.stage.removeChild(enemyToRemove);

    // 2. Remove from the enemies array
    const index = enemies.indexOf(enemyToRemove);
    if (index > -1) {
      enemies.splice(index, 1);
    }

    // --- Award Currency to Player ---
    playerCurrency += 10; // Example: 10 currency per enemy, adjust as needed
    updateCurrencyDisplay(); // Update UI

    console.log("Enemy destroyed!");
  }

  // --- createDamageNumber Function (new function to create damage text) ---
  function createDamageNumber(damage, x, y) {
    const damageText = new Text(damage, {
      fontFamily: "system-ui, Arial", // Or your pixel font if you load one
      fontSize: 12,
      fill: 0xff0000, // Red color for damage
      align: "center",
    });
    damageText.x = x;
    damageText.y = y - 20; // Position above the enemy
    damageText.anchor.set(0.5); // Center anchor for better positioning
    app.stage.addChild(damageText);

    // --- Animation Properties ---
    damageText.velocityY = -1; // Move upwards
    damageText.alphaFadeSpeed = 0.02; // Fade out speed
    activeDamageNumbers.push(damageText); // Add to active damage numbers array
  }

  // --- Helper Functions ---

  // Function to calculate distance between two sprites
  function distanceBetweenSprites(sprite1, sprite2) {
    const dx = sprite2.x - sprite1.x;
    const dy = sprite2.y - sprite1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Function to find the nearest enemy to the player
  function findNearestEnemy(player, enemies) {
    let nearestEnemy = null;
    let minDistance = Infinity; // Start with a very large distance

    for (const enemy of enemies) {
      if (enemy.health > 0) {
        // Only consider enemies that are alive
        const distance = distanceBetweenSprites(player, enemy);
        if (distance < minDistance) {
          minDistance = distance;
          nearestEnemy = enemy;
        }
      }
    }
    return nearestEnemy;
  }

  // Function to move sprite towards a target sprite
  function moveTowardsSprite(movingSprite, targetSprite, speed) {
    if (!targetSprite) return; // No target to move to

    const angle = Math.atan2(targetSprite.y - movingSprite.y, targetSprite.x - movingSprite.x);
    movingSprite.x += Math.cos(angle) * speed;
    movingSprite.y += Math.sin(angle) * speed;
    movingSprite.rotation = angle + Math.PI / 2;
  }

  /**
   *  UI
   */

  // --- updateCurrencyDisplay Function (new function to update currency UI) ---
  function updateCurrencyDisplay() {
    if (currencyText) {
      currencyText.text = `$ ${playerCurrency}`;
    }
  }

  // --- updateStatsDisplay Function (new function to update stats UI) ---
  function updateStatsDisplay() {
    if (statsContainer) {
      statsContainer.removeChildren(); // Clear existing stats display
      createStatsDisplayContent(); // Re-create content with updated stats
    }
  }

  // --- createStatsDisplay Function (new function to create the UI container) ---
  function createStatsDisplay() {
    statsContainer = new Graphics();
    statsContainer.beginFill(uiBackgroundColor);
    statsContainer.drawRect(0, 0, 200, 200); // Adjust size as needed
    statsContainer.endFill();
    statsContainer.x = 10; // Position from top-left
    statsContainer.y = 10;
    app.stage.addChild(statsContainer);
    statsContainer.interactive = true; // Make container interactive for events to pass through

    createStatsDisplayContent(); // Create the text and buttons inside the container
  }

  // --- createStatsDisplayContent Function (new function to add text and buttons to stats UI) ---
  function createStatsDisplayContent() {
    if (!statsContainer) return;

    let yOffset = 10; // Vertical spacing for text elements
    const textStyle = new TextStyle({
      fontFamily: "monospace, system-ui, Arial",
      fontSize: 14,
      padding: 25,
      fill: uiTextColor,
    });
    const buttonTextStyle = new TextStyle({
      fontFamily: "monospace, system-ui, Arial",
      fontSize: 12,
      fill: 0x000000, // Black text for buttons
      padding: 25,
      fontWeight: "",
    });

    // --- Currency Display ---
    currencyText = new Text(`$ ${playerCurrency}   `, textStyle);
    currencyText.x = 10;
    currencyText.y = yOffset;
    statsContainer.addChild(currencyText);
    yOffset += 25;

    // --- Damage Stat and Upgrade Button ---
    const damageStatText = new Text(`Damage: ${playerBaseDamage}`, textStyle);
    damageStatText.x = 10;
    damageStatText.y = yOffset;
    statsContainer.addChild(damageStatText);

    damageUpgradeButton = createUpgradeButton("Damage", upgradeCosts.damage, buttonTextStyle);
    damageUpgradeButton.x = 10;
    damageUpgradeButton.y = yOffset + 20;
    statsContainer.addChild(damageUpgradeButton);
    yOffset += 50; // Increase offset for next stat

    // --- Range Stat and Upgrade Button ---
    const rangeStatText = new Text(`Range: ${attackRange}`, textStyle); // Display current range
    rangeStatText.x = 10;
    rangeStatText.y = yOffset;
    statsContainer.addChild(rangeStatText);

    rangeUpgradeButton = createUpgradeButton("Range", upgradeCosts.range, buttonTextStyle);
    rangeUpgradeButton.x = 10;
    rangeUpgradeButton.y = yOffset + 20;
    statsContainer.addChild(rangeUpgradeButton);
    yOffset += 50;

    // --- Speed Stat and Upgrade Button (Example - Not fully functional yet) ---
    const speedStatText = new Text(`Speed: x${playerAttackSpeedMultiplier.toFixed(1)}`, textStyle);
    speedStatText.x = 10;
    speedStatText.y = yOffset;
    statsContainer.addChild(speedStatText);

    speedUpgradeButton = createUpgradeButton("Speed", upgradeCosts.speed, buttonTextStyle);
    speedUpgradeButton.x = 10;
    speedUpgradeButton.y = yOffset + 20;
    statsContainer.addChild(speedUpgradeButton);
    yOffset += 50;
  }

  // --- createUpgradeButton Function (new function to create upgrade buttons) ---
  function createUpgradeButton(statName, cost, textStyle) {
    const button = new Graphics();
    button.beginFill(0xaaaaaa); // Light gray button color
    button.drawRoundedRect(0, 0, 180, 20, 5); // Rounded button shape
    button.endFill();
    button.interactive = true; // Make button interactive
    button.cursor = "pointer"; // Change cursor on hover

    const buttonText = new Text(`Upgrade ${statName} - $${cost}`, textStyle);
    buttonText.x = 10;
    buttonText.y = 4;
    button.addChild(buttonText);

    button.on("pointerdown", () => {
      handleUpgradeClick(statName, cost);
    });

    return button;
  }

  // --- handleUpgradeClick Function (new function to handle upgrade button clicks) ---
  function handleUpgradeClick(statName, cost) {
    if (playerCurrency >= cost) {
      playerCurrency -= cost;
      updateCurrencyDisplay();

      if (statName === "Damage") {
        playerBaseDamage += 5; // Increase damage by 5, adjust as needed
        upgradeCosts.damage = Math.ceil(upgradeCosts.damage * 1.5); // Increase cost by 50%
      } else if (statName === "Range") {
        attackRange += 10; // Increase range by 10, adjust as needed
        playerRangeMultiplier += 0.1; // Example of range multiplier (can be used later)
        upgradeCosts.range = Math.ceil(upgradeCosts.range * 1.6); // Increase cost by 60%
      } else if (statName === "Speed") {
        playerAttackSpeedMultiplier += 0.05; // Example: Increase speed slightly (not yet used in attack logic)
        upgradeCosts.speed = Math.ceil(upgradeCosts.speed * 1.7); // Increase cost by 70%
      }

      updateStatsDisplay(); // Update the stats UI after upgrade
      console.log(
        `Upgraded ${statName}! New ${statName}:`,
        statName === "Damage" ? playerBaseDamage : statName === "Range" ? attackRange : playerAttackSpeedMultiplier
      );
    } else {
      console.log("Not enough currency to upgrade!");
      // TODO: Visual feedback for not enough currency (e.g., button flash red briefly)
    }
  }

  // --- Create Stats UI ---
  createStatsDisplay();
  updateCurrencyDisplay(); // Initial currency display

  // --- Add Mouse Click Interaction ---
  app.view.addEventListener("click", onClick);
  app.view.addEventListener("touchstart", onClick); // For touch events

  function onClick() {
    clicks++;
    console.log(`Clicks: ${clicks}`);
    // In the future, we'll trigger game actions here
  }

  // --- Game Loop (for future animations or updates) ---
  app.ticker.add(gameLoop);

  function gameLoop(deltatime) {
    /*
        deltatime : {
            autoStart: false
            deltaMS: 16.59999999999991
            deltaTime: 0.9959999999999946
            elapsedMS: 16.59999999999991
            lastTime: 3493.98
            speed: 1
            started: true
        }
    */

    // 1. Find Nearest Enemy (every frame)
    const nearestEnemy = findNearestEnemy(playerSprite, enemies);
    currentNearestEnemy = nearestEnemy; // Update current nearest enemy

    const delta = deltatime.deltaMS / 1000;
    playerAttackLoader -= delta;

    if (nearestEnemy) {
      // 2. Range Check
      const distanceToEnemy = distanceBetweenSprites(playerSprite, nearestEnemy);
      if (distanceToEnemy <= attackRange * playerRangeMultiplier) {
        if (playerAttackLoader < 0) {
          playerAttackLoader = playerAttackSpeed / playerAttackSpeedMultiplier;
          nearestEnemy.health -= playerBaseDamage;

          createDamageNumber(
            playerBaseDamage.toFixed(0),
            nearestEnemy.x + (nearestEnemy.width * Math.cos(deltatime.lastTime / 100)) / 5,
            nearestEnemy.y
          ); // Create damage number

          nearestEnemy.flashTimer = nearestEnemy.flashTimer || 0; // Initialize timer if needed
          nearestEnemy.isFlashing = true; // Flag enemy as flashing
        }
      } else {
        moveTowardsSprite(playerSprite, nearestEnemy, playerSpeed * delta); // Use delta for smooth speed
      }

      if (nearestEnemy.health <= 0) {
        destroyEnemy(nearestEnemy);
      }
    }

    // --- Handle Enemy Flashing ---
    for (const enemy of enemies) {
      if (enemy.isFlashing) {
        enemy.flashTimer += delta;
        enemy.visible = false;
        if (enemy.flashTimer >= 0.1) {
          // Flash duration (0.1 seconds)
          enemy.visible = true;
        }
        if (enemy.flashTimer >= 0.2) {
          enemy.isFlashing = false;
          enemy.flashTimer = 0;
        }
      }
    }

    // --- Animate Damage Numbers ---
    for (let i = activeDamageNumbers.length - 1; i >= 0; i--) {
      // Loop backwards for safe removal
      const dmgText = activeDamageNumbers[i];
      dmgText.y += dmgText.velocityY * delta * 60; // Move upwards (adjust speed multiplier as needed)
      //dmgText.x += Math.cos(deltatime.lastTime/100)/3;
      dmgText.alpha -= dmgText.alphaFadeSpeed * delta * 60; // Fade out

      if (dmgText.alpha <= 0) {
        // Remove faded out damage number
        app.stage.removeChild(dmgText);
        activeDamageNumbers.splice(i, 1); // Remove from active array
        dmgText.destroy(); // Clean up resources (optional for simple text, but good practice)
      }
    }

    if(enemies.length < numberOfEnemies) {
        popEnemy()
    }
  }

  console.log(
    "Game initialized!",
    app.renderer.name,
    app.renderer.context.webGLVersion,
    app.renderer.context.canvas.width,
    app.renderer.context.canvas.height
  );
})();
