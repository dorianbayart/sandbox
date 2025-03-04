export { Mouse }

'use strict'

import { getCanvasDimensions, getTileSize } from 'dimensions'
import { app } from 'renderer'
import { loadAndSplitImage, offscreenSprite } from 'sprites'


const ZOOM = {
  FACTOR: 0.066,
  MAX: 4,
  MIN: 1,
  initial: 2
}

class Mouse {
  constructor(xPixels = 0, yPixels = 0) {
    this.xPixels = xPixels
    this.yPixels = yPixels
    this.x = null
    this.y = null
    this.worldX = 0 // World coordinates (accounting for zoom/pan)
    this.worldY = 0
    this.canvas = null
    this.isDragging = false
    this.isPinching = false
    this.clicked = false
    this.dragStartX = 0
    this.dragStartY = 0
    this.lastX = 0
    this.lastY = 0
    this.prevDistance = 0 // distance between fingers
    this.scale = ZOOM.initial
    this.sprite = null
    this.zoomChanged = false

    // Store view transformation for zoom calculation
    this.viewTransform = {
      scale: ZOOM.initial,
      x: 0,
      y: 0
    }

    // Track if initial position has been set
    this.initialPositionSet = false

    // Map boundaries in world coordinates
    this.mapBounds = {
      minX: 0,
      minY: 0,
      maxX: getCanvasDimensions().width,
      maxY: getCanvasDimensions().height
    }
  }

  async initMouse(canvas) {
    this.canvas = canvas

    // Set initial camera position after a short delay to ensure renderer is ready
    setTimeout(() => this.setInitialCameraPosition(), 100)

    // Load cursor sprite
    const mouseSprite = (await loadAndSplitImage('assets/ui/crosshair.png', 9))[0][0]
    this.sprite = offscreenSprite(mouseSprite, 9, 'cursor')
  
    // Use this method to update mouse position from event handlers
    this.updatePosition = (clientX, clientY) => {
      if (!this._canvasRect || this._rectUpdateNeeded) {
        this._canvasRect = app.canvas.getBoundingClientRect()
        this._rectUpdateNeeded = false
        
        // Also cache view dimensions
        this._viewWidth = parseInt(app.canvas.style.width)
        this._viewHeight = parseInt(app.canvas.style.height)
      }

      // Screen coordinates
      this.xPixels = (clientX - this._canvasRect.left)
      this.yPixels = (clientY - this._canvasRect.top)

      // Only calculate world coordinates when needed (not for every cursor update)
      if (this._needWorldCoords) {
        // Convert to normalized coordinates (0-1 across canvas)
        const normalizedX = this.xPixels / this._viewWidth
        const normalizedY = this.yPixels / this._viewHeight
        
        // Convert to world coordinates based on current view
        this.worldX = ((normalizedX * app.renderer.width / this.viewTransform.scale) + this.viewTransform.x)
        this.worldY = ((normalizedY * app.renderer.height / this.viewTransform.scale) + this.viewTransform.y)
        
        // Convert to grid coordinates
        this.x = Math.floor(this.worldX / getTileSize())
        this.y = Math.floor(this.worldY / getTileSize())

        this._needWorldCoords = false
      }
    }
  
    const distanceBetweenTouches = (touch1, touch2) => {
      const dx = touch1.clientX - touch2.clientX
      const dy = touch1.clientY - touch2.clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    // Setup event listeners for Pixi.js view
    const pixiView = app.canvas;
    
    pixiView.addEventListener('pointerdown', (e) => {
      if (e.button === 0) { // Primary button
        this.isDragging = true
        this.dragStartX = e.clientX
        this.dragStartY = e.clientY
        this._needWorldCoords = true
        this.updatePosition(e.clientX, e.clientY)
      }
    })

    pixiView.addEventListener('pointerup', (e) => {
      if (e.button === 0) { // Primary button
          // If barely moved, treat as a click
          const dx = Math.abs(e.clientX - this.dragStartX)
          const dy = Math.abs(e.clientY - this.dragStartY)
          if (dx < 5 && dy < 5) {
              this.clicked = true
          }
          
        this.isDragging = false
        this._needWorldCoords = true
        this.updatePosition(e.clientX, e.clientY)
      }
    })

    pixiView.addEventListener('wheel', (e) => {
      e.preventDefault()
      
      // Update position first
      this._needWorldCoords = true
      this.updatePosition(e.clientX, e.clientY)
      
      // Calculate zoom direction
      const zoomDirection = e.deltaY < 0 ? 1 : -1
      const zoomFactor = ZOOM.FACTOR * zoomDirection
      
      // Calculate new scale
      const newScale = Math.max(
        ZOOM.MIN, 
        Math.min(ZOOM.MAX, this.viewTransform.scale * (1 + zoomFactor))
      )
      
      // If scale changed, update transforms
      if (newScale !== this.viewTransform.scale) {
        // Store mouse world position before zoom
        const mouseWorldX = this.worldX
        const mouseWorldY = this.worldY
        
        // Calculate scale ratio
        const scaleRatio = newScale / this.viewTransform.scale
        
        // Calculate new offsets to keep mouse position fixed
        this.viewTransform.scale = newScale

        // Adjust view transform to keep the mouse position fixed in world space
        this.viewTransform.x = mouseWorldX - ((mouseWorldX - this.viewTransform.x) / scaleRatio)
        this.viewTransform.y = mouseWorldY - ((mouseWorldY - this.viewTransform.y) / scaleRatio)
        
        // Apply boundary constraints after zoom
        this.applyBoundaryConstraints()

        // Set flag for renderer to update
        this.zoomChanged = true
      }
    })

    // Mouse move event
    pixiView.addEventListener('pointermove', (e) => {
      // Handle dragging (panning the view)
      if (this.isDragging) {
        const dx = (e.clientX - this.lastX) / this.viewTransform.scale
        const dy = (e.clientY - this.lastY) / this.viewTransform.scale
        
        // Update view offset
        this.viewTransform.x -= dx
        this.viewTransform.y -= dy
        
        // Apply boundary constraints
        this.applyBoundaryConstraints()

        // Flag that zoom/pan changed
        this.zoomChanged = true
        this._needWorldCoords = true
      }
      
      // Store current position for next move event
      this.lastX = e.clientX
      this.lastY = e.clientY
      
      // Update mouse position
      this.updatePosition(e.clientX, e.clientY)
    })

    // Touch start event
  pixiView.addEventListener('touchstart', (e) => {
      e.preventDefault()
      
      if (e.touches.length === 1) { // Single finger touch
        this.isDragging = true
        this.dragStartX = e.touches[0].clientX
        this.dragStartY = e.touches[0].clientY
        this.lastX = e.touches[0].clientX
        this.lastY = e.touches[0].clientY
        this._needWorldCoords = true
        this.updatePosition(e.touches[0].clientX, e.touches[0].clientY)
      } else if (e.touches.length === 2) { // Two fingers (pinch)
        this.isPinching = true
        this.isDragging = false
        this.prevDistance = distanceBetweenTouches(e.touches[0], e.touches[1])
        
        // Calculate pinch center
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2
        this._needWorldCoords = true
        this.updatePosition(centerX, centerY)
      }
    })

    // Touch move event
    pixiView.addEventListener('touchmove', (e) => {
      e.preventDefault()
      
      if (e.touches.length === 1 && this.isDragging) { // Single finger move
        // Calculate drag distance
        const dx = (e.touches[0].clientX - this.lastX) / this.viewTransform.scale
        const dy = (e.touches[0].clientY - this.lastY) / this.viewTransform.scale
        
        // Update view offset
        this.viewTransform.x -= dx
        this.viewTransform.y -= dy
        
        // Apply boundary constraints
        this.applyBoundaryConstraints()

        // Store current position
        this.lastX = e.touches[0].clientX
        this.lastY = e.touches[0].clientY
        
        // Update mouse position and flag changes
        this._needWorldCoords = true
        this.updatePosition(e.touches[0].clientX, e.touches[0].clientY)
        this.zoomChanged = true
      } else if (e.touches.length === 2 && this.isPinching) { // Pinch zoom
        // Calculate new distance between touches
        const currentDistance = distanceBetweenTouches(e.touches[0], e.touches[1])
        const scaleChange = currentDistance / this.prevDistance
        this.prevDistance = currentDistance
        
        // Calculate pinch center
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2
        this._needWorldCoords = true
        this.updatePosition(centerX, centerY)
        
        // Store world position before zoom
        const pinchWorldX = this.worldX
        const pinchWorldY = this.worldY
        
        // Calculate new scale
        const newScale = Math.max(
          ZOOM.MIN,
          Math.min(ZOOM.MAX, this.viewTransform.scale * scaleChange)
        )
        
        // Calculate scale ratio
        const scaleRatio = newScale / this.viewTransform.scale

        // Apply new scale
        this.viewTransform.scale = newScale
        
        // Adjust view transform like we do for mouse wheel zoom
        this.viewTransform.x = pinchWorldX - ((pinchWorldX - this.viewTransform.x) / scaleRatio)
        this.viewTransform.y = pinchWorldY - ((pinchWorldY - this.viewTransform.y) / scaleRatio)
        
        // Apply boundary constraints
        this.applyBoundaryConstraints()

        // Flag that zoom changed
        this.zoomChanged = true
      }
    })

    // Touch end event
    pixiView.addEventListener('touchend', (e) => {
      e.preventDefault()
      
      if (e.touches.length < 2) {
        this.isPinching = false
      }
      
      if (e.touches.length === 0) {
        // If barely moved, treat as a click
        if (e.changedTouches.length > 0) {
          const dx = Math.abs(e.changedTouches[0].clientX - this.dragStartX)
          const dy = Math.abs(e.changedTouches[0].clientY - this.dragStartY)
          if (dx < 10 && dy < 10) {
            this.clicked = true
            this._needWorldCoords = true
            this.updatePosition(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
          }
        }
        this.isDragging = false
      }
    })

    // Prevent context menu
    pixiView.addEventListener('contextmenu', (e) => {
      e.preventDefault()
    })
  }

  // Apply constraints to keep the map within view bounds
  applyBoundaryConstraints() {
    const viewWidth = app.renderer.width / this.viewTransform.scale
    const viewHeight = app.renderer.height / this.viewTransform.scale
    
    // If zoomed out enough to see entire map width, center it
    if (viewWidth >= this.mapBounds.maxX) {
      this.viewTransform.x = (this.mapBounds.maxX - viewWidth) / 2
    } else {
      // Otherwise, prevent scrolling past map edges
      this.viewTransform.x = Math.max(
        0, 
        Math.min(this.viewTransform.x, this.mapBounds.maxX - viewWidth)
      )
    }
    
    // If zoomed out enough to see entire map height, center it
    if (viewHeight >= this.mapBounds.maxY) {
      this.viewTransform.y = (this.mapBounds.maxY - viewHeight) / 2
    } else {
      // Otherwise, prevent scrolling past map edges
      this.viewTransform.y = Math.max(
        0, 
        Math.min(this.viewTransform.y, this.mapBounds.maxY - viewHeight)
      )
    }
  }
  
  // Set the initial camera position to the bottom center of the map
  setInitialCameraPosition() {
    if (this.initialPositionSet || !app.renderer) return
    
    // Calculate visible view dimensions in world space at current scale
    const viewWidth = app.renderer.width / this.viewTransform.scale
    const viewHeight = app.renderer.height / this.viewTransform.scale
    
    // Set x position to center the view horizontally on the map
    this.viewTransform.x = (getCanvasDimensions().width - viewWidth) / 2
    
    // Set y position to show the bottom of the map
    this.viewTransform.y = getCanvasDimensions().height - viewHeight
    
    // Apply constraints to ensure valid position
    this.applyBoundaryConstraints()
    
    // Mark as set and trigger redraw
    this.initialPositionSet = true
    this.zoomChanged = true
    
    console.log("Initial camera position set to bottom center")
  }
  // Method to get current view transform for renderer
  getViewTransform() {
    return { ...this.viewTransform };
  }
}