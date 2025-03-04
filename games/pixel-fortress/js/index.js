'use strict'

import { handleWindowResize, initializeGame } from 'init'
import { setupViewportHandling } from 'viewport'

// Initialize on load
window.addEventListener('load', initializeGame)

// Set up window event handlers
window.onrotate = window.onresize = handleWindowResize

setupViewportHandling()