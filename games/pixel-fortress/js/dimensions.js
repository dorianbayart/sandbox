export {
    getCanvasDimensions,
    getMapDimensions,
    getTileSize,
    initMapDimensions,
    updateDimensions
}
  
'use strict'

import gameState from 'state'

// Constants
const SPRITE_SIZE = 16 // Base sprite size in pixels
const MAX_WEIGHT = 0x7FFFFFFF // Very large but safe value

// Map dimensions in tiles
let MAP_WIDTH = 0
let MAP_HEIGHT = 0

// Canvas dimensions in pixels
let canvasWidth = 0
let canvasHeight = 0

// Device pixel ratio
let dpr = 1

/**
 * Initialize map dimensions based on viewport size
 * Should only be called when creating a new map
 */
const initMapDimensions = () => {
    // Get map size setting
    const mapSize = gameState.settings?.mapSize || 'medium'

    // Set map dimensions based on size
    switch (mapSize) {
        case 'small':
            MAP_WIDTH = 40
            MAP_HEIGHT = 80
            break
        case 'large':
            MAP_WIDTH = 80
            MAP_HEIGHT = 160
            break
        case 'medium':
        default:
            MAP_WIDTH = 60
            MAP_HEIGHT = 120
            break
    }

    // Log new map dimensions
    console.log(`Map initialized: ${MAP_WIDTH} x ${MAP_HEIGHT} tiles (${mapSize} size)`)
}

/**
 * Update dimensions based on current window/viewport size
 * This should be called on resize events
 */
const updateDimensions = async () => {
    dpr = (window.devicePixelRatio || 1)

    // Store canvas dimensions in pixels
    canvasWidth = window.innerWidth
    canvasHeight = window.innerHeight

    // Log new dimensions for debugging
    console.log(`Canvas: ${canvasWidth} x ${canvasHeight} pixels`)
    console.log(`Viewport: ${window.innerWidth} x ${window.innerHeight} pixels (DPR: ${dpr})`)
    
    return { width: canvasWidth, height: canvasHeight, dpr: dpr }
}

/**
 * Get current map dimensions in tiles
 * @returns {Object} Object with width and height properties
 */
const getMapDimensions = () => {
    return {
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
        maxWeight: MAX_WEIGHT
    }
}

/**
 * Get current canvas dimensions in pixels
 * @returns {Object} Object with width, height, and dpr properties
 */
const getCanvasDimensions = () => {
    return {
        width: canvasWidth,
        height: canvasHeight,
        dpr: dpr
    }
}

/**
 * Get the tile size in pixels
 * @returns {number} Tile size in pixels
 */
const getTileSize = () => {
    return SPRITE_SIZE
}