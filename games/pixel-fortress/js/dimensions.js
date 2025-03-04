export {
    getCanvasDimensions,
    getMapDimensions,
    getTileSize,
    initDimensions,
    initMapDimensions,
    updateDimensions
}
  
  'use strict'
  
  // Constants
  const SPRITE_SIZE = 16 // Base sprite size in pixels
  const MAX_WEIGHT = 99999999 // For pathfinding
  
  // Map dimensions in tiles
  let MAP_WIDTH = 0
  let MAP_HEIGHT = 0
  
  // Canvas dimensions in pixels
  let canvasWidth = 0
  let canvasHeight = 0
  
  // Device pixel ratio
  let dpr = 1
  
  /**
   * Initialize dimensions system
   * Should be called once at startup
   */
  function initDimensions() {
    // Get the device pixel ratio
    dpr = window.devicePixelRatio || 1
    
    // Initialize map dimensions
    initMapDimensions()
    
    // Set initial dimensions
    updateDimensions()
  }
  
  /**
 * Initialize map dimensions based on viewport size
 * Should only be called when creating a new map
 */
function initMapDimensions() {
    // Get the visual viewport dimensions
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight

    // Calculate how many tiles we can fit on screen
    // We divide by SPRITE_SIZE to convert pixels to tiles
    // We account for device pixel ratio to ensure consistent sizing
    MAP_WIDTH = Math.ceil(viewportWidth * dpr / SPRITE_SIZE)
    MAP_HEIGHT = Math.ceil(viewportHeight * dpr / SPRITE_SIZE)

    // Log new map dimensions
    console.log(`Map initialized: ${MAP_WIDTH} x ${MAP_HEIGHT} tiles`)
}

/**
 * Update dimensions based on current window/viewport size
 * This should be called on resize events
 */
function updateDimensions() {
    // Get the visual viewport dimensions if available, otherwise use window
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight

    // Set CSS variables for layout
    document.documentElement.style.setProperty('--app-width', `${viewportWidth}px`)
    document.documentElement.style.setProperty('--app-height', `${viewportHeight}px`)

    // Store canvas dimensions in pixels
    canvasWidth = MAP_WIDTH * SPRITE_SIZE
    canvasHeight = MAP_HEIGHT * SPRITE_SIZE

    // Log new dimensions for debugging
    console.log(`Canvas: ${canvasWidth} x ${canvasHeight} pixels`)
    console.log(`Viewport: ${viewportWidth} x ${viewportHeight} pixels (DPR: ${dpr})`)
}

/**
 * Get current map dimensions in tiles
 * @returns {Object} Object with width and height properties
 */
function getMapDimensions() {
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
function getCanvasDimensions() {
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
function getTileSize() {
    return SPRITE_SIZE
}