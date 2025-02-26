export { ZOOM, gameLoop, initGame }

'use strict'

import { isDrawBackRequested } from 'globals'
import { MAP_HEIGHT, MAP_WIDTH, MAX_WEIGHT } from 'maps'
import { searchPath } from 'pathfinding'
import { Player, PlayerType } from 'players'
import { drawBackground, drawMain } from 'renderer'
import { SPRITE_SIZE, offscreenSprite } from 'sprites'
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
  
  // Game timing variables
  let elapsed = -5000
  let elapsedBack = -5000
  let elapsedUI = -5000
  let fps = new Array(50).fill(100)
  let timings = new Array(50).fill(10)
  let drawMainTimings = new Array(50).fill(10)
  
  // Generate the game map using Perlin noise
  const generateMap = async () => {
    // Create the map structure
    gameState.map = new Array(MAP_WIDTH).fill(null).map(() => new Array(MAP_HEIGHT).fill(null))
    
    // Generate a random seed
    gameState.mapSeed = Math.floor(Math.random() * 10000)
    
    const noise = new PerlinNoise(gameState.mapSeed)
    
    const TERRAIN_TYPES = {
      WATER: { type: 'WATER', weight: MAX_WEIGHT, spriteRange: { x: [0, 0], y: [17, 17] } },
      ROCK: { type: 'ROCK', weight: MAX_WEIGHT, spriteRange: { x: [0, 1], y: [26, 26] } },
      TREE: { type: 'TREE', weight: MAX_WEIGHT, spriteRange: { x: [2, 3], y: [26, 27] } },
      GRASS: { type: 'GRASS', weight: 1, spriteRange: { x: [0, 2], y: [0, 2] } },
      SAND: { type: 'SAND', weight: 1, spriteRange: { x: [3, 3], y: [3, 3] } },
    }
  
    const NOISE_SCALE = 0.14; // Controls terrain smoothness
    const TERRAIN_THRESHOLD = {
      WATER: 0.33,
      ROCK: 0.34,
      TREE_NEXT_TO_WATER: 0.35,
      GRASS_NEXT_TO_WATER: 0.45,
      SAND: 0.47,
      GRASS: 0.56,
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
  
          gameState.map[x][y] = {
              type: terrainType.type,
              weight: terrainType.weight,
          }
        }
    }
  }
  
  // Assign sprites to map tiles
  const assignSpritesOnMap = async (sprites) => {
    // Terrain type parameters
    const TERRAIN_TYPES = {
      WATER: { type: 'WATER', spriteRange: { x: [0, 0], y: [17, 17] } },
      ROCK: { type: 'ROCK', spriteRange: { x: [0, 1], y: [26, 26] } },
      TREE: { type: 'TREE', spriteRange: { x: [2, 3], y: [26, 27] } },
      GRASS: { type: 'GRASS', spriteRange: { x: [0, 2], y: [0, 2] } },
      SAND: { type: 'SAND', spriteRange: { x: [3, 3], y: [3, 3] } },
    }
  
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
            break;
          case TERRAIN_TYPES.TREE.type:
            spriteX = Math.floor(Math.random() * 
                (terrainType.spriteRange.x[1] - terrainType.spriteRange.x[0] + 1)) + 
                terrainType.spriteRange.x[0]
            spriteY = Math.floor(Math.random() * 
                (terrainType.spriteRange.y[1] - terrainType.spriteRange.y[0] + 1)) + 
                terrainType.spriteRange.y[0]
            gameState.map[x][y].sprite = offscreenSprite(sprites[spriteX][spriteY], SPRITE_SIZE)
            gameState.map[x][y].back = offscreenSprite(grassSprite, SPRITE_SIZE)
            break;
          case TERRAIN_TYPES.ROCK.type:
            spriteX = Math.floor(Math.random() * 
                (terrainType.spriteRange.x[1] - terrainType.spriteRange.x[0] + 1)) + 
                terrainType.spriteRange.x[0]
            spriteY = Math.floor(Math.random() * 
                (terrainType.spriteRange.y[1] - terrainType.spriteRange.y[0] + 1)) + 
                terrainType.spriteRange.y[0]
            gameState.map[x][y].sprite = offscreenSprite(sprites[spriteX][spriteY], SPRITE_SIZE)
            gameState.map[x][y].back = offscreenSprite(grassSprite, SPRITE_SIZE)
            break;
          case TERRAIN_TYPES.SAND.type:
            spriteX = Math.floor(Math.random() * 
                (terrainType.spriteRange.x[1] - terrainType.spriteRange.x[0] + 1)) + 
                terrainType.spriteRange.x[0]
            spriteY = Math.floor(Math.random() * 
                (terrainType.spriteRange.y[1] - terrainType.spriteRange.y[0] + 1)) + 
                terrainType.spriteRange.y[0]
            gameState.map[x][y].sprite = offscreenSprite(sprites[spriteX][spriteY], SPRITE_SIZE)
            break;
          case TERRAIN_TYPES.WATER.type:
            spriteX = Math.floor(Math.random() * 
                (terrainType.spriteRange.x[1] - terrainType.spriteRange.x[0] + 1)) + 
                terrainType.spriteRange.x[0]
            spriteY = Math.floor(Math.random() * 
                (terrainType.spriteRange.y[1] - terrainType.spriteRange.y[0] + 1)) + 
                terrainType.spriteRange.y[0]
            gameState.map[x][y].sprite = offscreenSprite(sprites[spriteX][spriteY], SPRITE_SIZE)
            break;
          default:
            break;
        }
      }
    }
  }
  
  // Check if there's a valid path between top and bottom of map
  const isMapCorrect = () => {
    let isValid = false
    for (let i = 0; i < MAP_WIDTH; i++) {
      if(gameState.map[i][MAP_HEIGHT-1].weight < MAX_WEIGHT) {
        for (let j = 0; j < MAP_WIDTH; j++) {
          if(gameState.map[j][0].weight < MAX_WEIGHT) {
            isValid = searchPath(gameState.map, i, MAP_HEIGHT-1, j, 0)?.length > 0
            if(isValid === false) return isValid
          }
        }
      }
    }
    return isValid
  }
  
  // Main game loop
  const gameLoop = () => {
    const now = performance.now()
    const delay = now - elapsed
    elapsed = now
  
    // Background rendering
    if(isDrawBackRequested() && now - elapsedBack > 50) {
      elapsedBack = now
      drawBackground(gameState.map)
    }
  
    // Handle mouse interaction
    handleMouseInteraction(gameState.map, gameState.humanPlayer)
  
    // Track FPS
    if(delay) {
      fps.push(delay)
      fps.shift()
    }
  
    // Update players and units
    gameState.humanPlayer.update(delay, gameState.map)
    gameState.aiPlayers.forEach(ai => {
      ai.update(delay, gameState.map)
    })
    
    // Render game
    drawMain(gameState.humanPlayer, gameState.aiPlayers)
    updateUI(fps)
    
    requestAnimationFrame(gameLoop)
    timings.push((performance.now() - elapsed) | 0)
    timings.shift()
  }
  
  // Initialize the game
  const initGame = async (sprites, mouse) => {
    // Create players
    new Player(PlayerType.HUMAN)
    new Player(PlayerType.AI)
    
    // Set game state to playing
    gameState.gameStatus = 'playing'
    
    // Generate map until we get a valid one
    do {
      await generateMap()
    } while(isMapCorrect() === false)
    
    await assignSpritesOnMap(sprites)
  }