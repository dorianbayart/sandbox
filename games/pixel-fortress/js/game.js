export { TERRAIN_TYPES, ZOOM, gameLoop, initGame, updateSprite }

'use strict'

import { Building } from 'building'
import { getMapDimensions, getTileSize } from 'dimensions'
import { renderFog, updateVisibility } from 'fogOfWar'
import { drawBack, isDrawBackRequested } from 'globals'
import { updateAllParticles } from 'particles'
import { clearPathCache, searchPath } from 'pathfinding'
import { Player, PlayerType } from 'players'
import { drawBackground, drawMain } from 'renderer'
import { offscreenSprite, sprites } from 'sprites'
import gameState from 'state'
import { handleMouseInteraction, updateUI } from 'ui'
import { PerlinNoise } from 'utils'

// Zoom configuration
const ZOOM = {
  FACTOR: 1.1,
  MAX: 1.4,
  MIN: 1,
  current: 1
}

const TERRAIN_TYPES = {
  WATER: { type: 'WATER', weight: 5, spriteRange: { x: [0, 0], y: [17, 17] } },
  ROCK: { type: 'ROCK', weight: getMapDimensions().maxWeight, spriteRange: { x: [0], y: [26] } },
  GOLD: { type: 'GOLD', weight: getMapDimensions().maxWeight, spriteRange: { x: [1], y: [26] } },
  TREE: { type: 'TREE', weight: 1024, spriteRange: { x: [2, 3], y: [26, 27] } },
  DEPLETED_TREE: { type: 'DEPLETED_TREE', weight: 2.5, spriteRange: { x: [1], y: [27] } },
  GRASS: { type: 'GRASS', weight: 1, spriteRange: { x: [0, 2], y: [0, 2] } },
  SAND: { type: 'SAND', weight: 1.75, spriteRange: { x: [3, 3], y: [3, 3] } },
  BUILDING: { type: 'BUILDING', weight: Building.WEIGHT }
}

// Game timing variables
let elapsed = -5000
let elapsedBack = -5000
let fps = new Array(100).fill(50)
let delays = new Array(100).fill(50)

// Initialize the game
const initGame = async () => {
  // Create players
  new Player(PlayerType.HUMAN)
  new Player(PlayerType.AI)
  
  // Generate map until we get a valid one
  let i = 0
  let isMapCorrect = true
  do {
    if(!isMapCorrect) gameState.mapSeed = null
    await generateMap()
    isMapCorrect = placeTents()
  } while(!isMapCorrect && ++i < 150)

  await assignSpritesOnMap()

  elapsedBack = elapsed = performance.now()

  return isMapCorrect
}


/**
 * Generate the game map using Perlin noise
 * Creates a natural-looking terrain with water, rocks, trees, grass, and sand.
 * The map is stored in the global game state and contains:
 * - Terrain type
 * - Movement cost (weight)
 * - Resource information for harvestable tiles
 * 
 * TODO: needs to add gold
 * 
 * @returns {Promise<void>}
 */
const generateMap = async () => {
  // Clean the pathfinding algorithm
  clearPathCache()

  // Get map dimensions
  const { width: MAP_WIDTH, height: MAP_HEIGHT, maxWeight: MAX_WEIGHT } = getMapDimensions()

  // Create the map structure
  gameState.map = new Array(MAP_WIDTH).fill(null).map(() => new Array(MAP_HEIGHT).fill(null))
  gameState.mapSeed  = gameState.mapSeed ?? Math.floor(Math.random() * 10000)

  const noise = new PerlinNoise(gameState.mapSeed)

  const NOISE_SCALE = 0.08; // Controls terrain smoothness
  const TERRAIN_THRESHOLD = {
    WATER: 0.33,
    ROCK: 0.34,
    TREE_NEXT_TO_WATER: 0.35,
    GRASS_NEXT_TO_WATER: 0.45,
    SAND: 0.47,
    GRASS: 0.56,
    GOLD: 0.8,
    TREE: 1,
  }

  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
        const noiseValue = (noise.noise(x * NOISE_SCALE, y * NOISE_SCALE) + 1) / 2
        
        let terrainType = TERRAIN_TYPES.GRASS

        if (noiseValue < TERRAIN_THRESHOLD.WATER) terrainType = TERRAIN_TYPES.WATER
        else if (noiseValue < TERRAIN_THRESHOLD.ROCK) terrainType = TERRAIN_TYPES.ROCK
        else if (noiseValue < TERRAIN_THRESHOLD.TREE_NEXT_TO_WATER) terrainType = TERRAIN_TYPES.TREE
        else if (noiseValue < TERRAIN_THRESHOLD.GRASS_NEXT_TO_WATER) terrainType = TERRAIN_TYPES.GRASS
        else if (noiseValue < TERRAIN_THRESHOLD.SAND) terrainType = TERRAIN_TYPES.SAND
        else if (noiseValue < TERRAIN_THRESHOLD.GRASS) terrainType = TERRAIN_TYPES.GRASS
        else if (noiseValue < TERRAIN_THRESHOLD.TREE) terrainType = TERRAIN_TYPES.TREE

        if (terrainType.type === 'GRASS') {  // Only place on grass to avoid confusion with actual sand
          // Use a different offset and scale for secondary noise to get different distribution
          const goldNoise = (noise.noise((x + 500) * NOISE_SCALE * 3, (y + 500) * NOISE_SCALE * 3) + 1) / 2
          
          // Only place gold if secondary noise is above threshold (making it rare)
          if (goldNoise > TERRAIN_THRESHOLD.GOLD) {
            terrainType = TERRAIN_TYPES.GOLD
          }
        }

        if (terrainType.type === 'TREE') {
          gameState.map[x][y] = {
            uid: y * MAP_WIDTH + x,
            type: terrainType.type,
            weight: terrainType.weight,
            lifeRemaining: 50 // Each tree can produce 50 wood
          }
        } else {
          gameState.map[x][y] = {
            uid: y * MAP_WIDTH + x,
            type: terrainType.type,
            weight: terrainType.weight,
          }
        }
        
      }
  }
}

/**
 * Place starting tents for human and AI players
 * Creates bases at opposite sides of the map (human at bottom, AI at top).
 * Ensures there's a valid path between bases and clears terrain around them.
 * 
 * @returns {boolean} True if tents were successfully placed with a valid path between them
 */
const placeTents = () => {
  const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()
  
  // Find suitable locations for tents
  const humanY = MAP_HEIGHT * 19 / 20 // Near bottom for player
  const aiY = MAP_HEIGHT / 20 // Near top for AI

  const centerX = MAP_WIDTH / 2


  for (let x = centerX - 2; x <= centerX + 2; x++) {
    for (let y = -2; y <= 2; y++) {
      if(
        (x === centerX - 2 && y === -2)
        || (x === centerX - 2 && y === 2)
        || (x === centerX + 2 && y === -2)
        || (x === centerX + 2 && y === 2)
      ) continue

      // Clean the zone around human tent
      gameState.map[x][humanY + y] = {
        uid: (humanY + y) * MAP_WIDTH + x,
        type: TERRAIN_TYPES.GRASS.type,
        weight: TERRAIN_TYPES.GRASS.weight
      }

      // Clean the zone around AI tent
      gameState.map[x][aiY + y] = {
        uid: (aiY + y) * MAP_WIDTH + x,
        type: TERRAIN_TYPES.GRASS.type,
        weight: TERRAIN_TYPES.GRASS.weight
      }
    }
  }

  const path = searchPath(centerX, humanY, centerX, aiY)
  const weight = path?.reduce((p, c) => p + c.weight, 0)

  if(path?.length && weight < 2 * (MAP_WIDTH + MAP_HEIGHT)) {
    console.log('Path between the 2 tents:', path, weight)

    // Create actual tent buildings
    gameState.humanPlayer.addBuilding(centerX, humanY, Building.TYPES.TENT)
    gameState.aiPlayers[0].addBuilding(centerX, aiY, Building.TYPES.TENT)

    return true
  }

  return false
}

// Assign sprites to map tiles
const assignSpritesOnMap = async () => {
  const { width: MAP_WIDTH, height: MAP_HEIGHT, maxWeight: MAX_WEIGHT } = getMapDimensions()
  const SPRITE_SIZE = getTileSize()

  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      const terrainType = TERRAIN_TYPES[gameState.map[x][y].type]
      const grassSprite =
        sprites[
          Math.floor(Math.random() * (TERRAIN_TYPES.GRASS.spriteRange.x[1] - TERRAIN_TYPES.GRASS.spriteRange.x[0] + 1)) +
            TERRAIN_TYPES.GRASS.spriteRange.x[0]
        ][
          Math.floor(Math.random() * (TERRAIN_TYPES.GRASS.spriteRange.y[1] - TERRAIN_TYPES.GRASS.spriteRange.y[0] + 1)) +
            TERRAIN_TYPES.GRASS.spriteRange.y[0]
        ]
      let spriteX, spriteY
      switch (gameState.map[x][y].type) {
        case TERRAIN_TYPES.GRASS.type:
          spriteX = Math.floor(Math.random() * 
              (terrainType.spriteRange.x[1] - terrainType.spriteRange.x[0] + 1)) + 
              terrainType.spriteRange.x[0]
          spriteY = Math.floor(Math.random() * 
              (terrainType.spriteRange.y[1] - terrainType.spriteRange.y[0] + 1)) + 
              terrainType.spriteRange.y[0]
          gameState.map[x][y].sprite = offscreenSprite(sprites[spriteX][spriteY], SPRITE_SIZE)
          break
        case TERRAIN_TYPES.TREE.type:
          spriteX = Math.floor(Math.random() * 
              (terrainType.spriteRange.x[1] - terrainType.spriteRange.x[0] + 1)) + 
              terrainType.spriteRange.x[0]
          spriteY = Math.floor(Math.random() * 
              (terrainType.spriteRange.y[1] - terrainType.spriteRange.y[0] + 1)) + 
              terrainType.spriteRange.y[0]
          gameState.map[x][y].sprite = offscreenSprite(sprites[spriteX][spriteY], SPRITE_SIZE)
          gameState.map[x][y].back = offscreenSprite(grassSprite, SPRITE_SIZE)
          break
        case TERRAIN_TYPES.ROCK.type:
          spriteX = terrainType.spriteRange.x[0]
          spriteY = terrainType.spriteRange.y[0]
          gameState.map[x][y].sprite = offscreenSprite(sprites[spriteX][spriteY], SPRITE_SIZE)
          gameState.map[x][y].back = offscreenSprite(grassSprite, SPRITE_SIZE)
          break
        case TERRAIN_TYPES.GOLD.type:
          spriteX = terrainType.spriteRange.x[0]
          spriteY = terrainType.spriteRange.y[0]
          const goldRawCanvas = offscreenSprite(sprites[spriteX][spriteY], SPRITE_SIZE, 'gold_raw')
          goldRawCanvas.getContext('2d').globalCompositeOperation = 'source-atop'
          goldRawCanvas.getContext('2d').fillStyle = 'rgba(255, 215, 0, 0.5)' // Gold color with 50% opacity
          goldRawCanvas.getContext('2d').fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE)
          const goldSpriteData = goldRawCanvas.getContext('2d').getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE)
          gameState.map[x][y].sprite = offscreenSprite(goldSpriteData, SPRITE_SIZE, 'gold')
          gameState.map[x][y].back = offscreenSprite(grassSprite, SPRITE_SIZE)
          break
        case TERRAIN_TYPES.SAND.type:
          spriteX = Math.floor(Math.random() * 
              (terrainType.spriteRange.x[1] - terrainType.spriteRange.x[0] + 1)) + 
              terrainType.spriteRange.x[0]
          spriteY = Math.floor(Math.random() * 
              (terrainType.spriteRange.y[1] - terrainType.spriteRange.y[0] + 1)) + 
              terrainType.spriteRange.y[0]
          gameState.map[x][y].sprite = offscreenSprite(sprites[spriteX][spriteY], SPRITE_SIZE)
          break
        case TERRAIN_TYPES.WATER.type:
          spriteX = Math.floor(Math.random() * 
              (terrainType.spriteRange.x[1] - terrainType.spriteRange.x[0] + 1)) + 
              terrainType.spriteRange.x[0]
          spriteY = Math.floor(Math.random() * 
              (terrainType.spriteRange.y[1] - terrainType.spriteRange.y[0] + 1)) + 
              terrainType.spriteRange.y[0]
          gameState.map[x][y].sprite = offscreenSprite(sprites[spriteX][spriteY], SPRITE_SIZE)
          break
        default:
          gameState.map[x][y].back = offscreenSprite(grassSprite, SPRITE_SIZE)
          break
      }
    }
  }
}

// Update the sprite on the map at specified coords
const updateSprite = async (x, y) => {
  const terrainType = TERRAIN_TYPES[gameState.map[x][y].type]
  let spriteX, spriteY
  switch (gameState.map[x][y].type) {
    case TERRAIN_TYPES.DEPLETED_TREE.type:
      spriteX = terrainType.spriteRange.x[0]
      spriteY = terrainType.spriteRange.y[0]
      gameState.map[x][y].sprite = offscreenSprite(sprites[spriteX][spriteY], getTileSize())
      break
    case TERRAIN_TYPES.GRASS.type:
    case TERRAIN_TYPES.TREE.type:
    case TERRAIN_TYPES.ROCK.type:
    case TERRAIN_TYPES.SAND.type:
    case TERRAIN_TYPES.WATER.type:
    default:
      break
  }

  drawBack()
} 

// Main game loop
const gameLoop = () => {
  const now = performance.now()
  const delay = now - elapsed | 0
  elapsed = now

  if(gameState.gameStatus === 'paused') {
    requestAnimationFrame(gameLoop)
    return
  }

  if(gameState.gameStatus === 'menu') {
    return
  }

  // Handle keyboard movement
  gameState.UI?.mouse?.applyKeyboardMovement(delay)
  // Handle drag momentum
  gameState.UI?.mouse?.applyDragMomentum(delay)

  // Handle mouse interaction
  handleMouseInteraction(gameState.map, gameState.humanPlayer)

  // Background rendering
  if(isDrawBackRequested() && now - elapsedBack > 40 || now - elapsedBack > 400) {
    elapsedBack = now
    drawBackground(gameState.map)
  }
  
  // Track FPS
  if(gameState.debug) {
    fps.push(delay)
    fps.shift()
  }
  
  
  // Update players and units
  const timingStart = performance.now()
  if(gameState.humanPlayer) gameState.humanPlayer.update(delay, gameState.map)
  const timing = performance.now() - timingStart
  
  // Update AI players
  gameState.aiPlayers.forEach(ai => {
    ai.update(delay, gameState.map)
  })

  // Update particles
  updateAllParticles(delay)
  
  // Update fog of war
  if (gameState.settings.fogOfWar) {
    updateVisibility(delay)
  }
  
  // Render game
  drawMain(gameState.humanPlayer, gameState.aiPlayers)
  
  // Render fog of war
  if (gameState.settings.fogOfWar) {
    renderFog(delay)
  }

  // Render UI
  updateUI(fps)
  
  
  requestAnimationFrame(gameLoop)

  if(gameState.debug && Math.random() > 0.9975) console.log(`Game Loop: ${fps.reduce((a, b) => a + b, 0) / fps.length} ms`)


  if(gameState.debug) {
    delays.push(timing)
    delays.shift()
    if(Math.random() > 0.993) console.log(`Human Player Updating took: ${delays.reduce((a, b) => a + b, 0) / delays.length} ms`)
  }
}

