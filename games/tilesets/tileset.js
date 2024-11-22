'use script'

const backCanvas = document.getElementById('backCanvas')
const backCtx = backCanvas.getContext('2d')
const mainCanvas = document.getElementById('mainCanvas')
const mainCtx = mainCanvas.getContext('2d')
const uiCanvas = document.getElementById('uiCanvas')
const uiCtx = uiCanvas.getContext('2d')

// Off Canvas
const offCanvas1 = document.createElement('canvas')
const offCtx1 = offCanvas1.getContext('2d')
const offCanvas2 = document.createElement('canvas')
const offCtx2 = offCanvas2.getContext('2d')


/****************/
/*  DEBUG MODE  */
/****************/
const DEBUG = true

const SPRITE_SIZE = 16
const MAP_WIDTH = 40
const MAP_HEIGHT = 40
const MAX_WEIGHT = 99999999
const map = new Array(MAP_WIDTH).fill(null).map(() => new Array(MAP_HEIGHT).fill(null))

let canvasWidth = 0
let canvasHeight = 0
const desiredAspectRatio = MAP_WIDTH / MAP_HEIGHT
let dpr = globalThis.devicePixelRatio || 1

let sprites, elapsed = elapsedBack = elapsedUI = 0, fps = 0
let isDrawBackRequested = true

let spriteCoords_Start = { x: 21, y: 5 }
let spriteCoords_End = { x: 22, y: 4 }
let spriteCoords_Path = { x: 22, y: 5 }

const units = []
const MAX_UNITS = 10
const enemies = []

class Unit {
  constructor(x, y, sprite) {
    if(x) {
      this.x = x
    } else {
      this.x = Math.floor(Math.random()*MAP_WIDTH)
      while(map[this.x][MAP_HEIGHT-1].weight === MAX_WEIGHT) {
        this.x = Math.floor(Math.random()*MAP_WIDTH)
      }
      this.x *= SPRITE_SIZE
    }

    this.y = y ?? ((MAP_HEIGHT-1) * SPRITE_SIZE)
    this.currentNode = { x: this.x/SPRITE_SIZE, y: this.y/SPRITE_SIZE }
    this.nextNode = { x: this.x/SPRITE_SIZE, y: this.y/SPRITE_SIZE }
    this.sprite = sprite ?? sprites[spriteCoords_Start.x][spriteCoords_Start.y]
    this.path = this.pathToNearestEnemy()
    this.lastMoveUpdate = 0
    this.lastPathUpdate = 0
    this.goal = null
    this.life = 1
    this.speed = 8 + (this.x + this.y)%10
  }

  update(delay) {
    const time = performance.now()

    // Update Path
    if((this.currentNode.x === this.nextNode.x && this.currentNode.y === this.nextNode.y)) {
      if(time - this.lastPathUpdate > 1000) {
        this.lastPathUpdate = time

        this.path = this.pathToNearestEnemy()
        if(!this.path || this.path.length === 1) {
          this.life = 0
          return
        }

        this.nextNode.x = this.path[1].x
        this.nextNode.y = this.path[1].y
      } else {
        const i = this.path?.findIndex(node => node.x === this.currentNode.x && node.y === this.currentNode.y)
        if(this.path[i+1]) {
          this.nextNode.x = this.path[i + 1].x
          this.nextNode.y = this.path[i + 1].y
        }
      }

      isDrawBackRequested = true
    }

    this.lastMoveUpdate = time
    this.move(Math.min(delay, 40))
  }

  pathToNearestEnemy() {
    let path, pathLength = MAP_WIDTH * MAP_HEIGHT
    enemies.forEach((enemy, i) => {
      const temp = bestFirstSearch(map, this.currentNode.x, this.currentNode.y, enemy.x, enemy.y)
      if(temp?.length < pathLength) {
        path = temp
        pathLength = path.length
        this.goal = enemy
      }
    })
    return path
  }

  move(delay) {
    this.x += (this.nextNode.x * SPRITE_SIZE - this.x) / 2 * this.speed * (delay/1000)
    this.y += (this.nextNode.y * SPRITE_SIZE - this.y) / 2 * this.speed * (delay/1000)

    if(Math.hypot(this.nextNode.x*SPRITE_SIZE - this.x, this.nextNode.y*SPRITE_SIZE - this.y) < SPRITE_SIZE/3) {
      this.currentNode.x = this.nextNode.x
      this.currentNode.y = this.nextNode.y
    }

  }
}

const generateMap = () => {
  for (var x = 0; x < MAP_WIDTH; x++) {
    for (var y= 0; y < MAP_HEIGHT; y++) {
      const random = Math.random()
      if(y === 0 && random > 0.85) {
        map[x][y] = {
          weight: -2,
          sprite: sprites[spriteCoords_End.x][spriteCoords_End.y],
          back: sprites[Math.floor(Math.random()*3)][Math.floor(Math.random()*3)]
        }
        enemies.push({x: x, y: y})
      }
      else if(random > 0.25) {
        map[x][y] = {
          weight: 1,
          sprite: sprites[Math.floor(Math.random()*3)][Math.floor(Math.random()*3)],
          back: null
        }
      } else {
        map[x][y] = {
          weight: MAX_WEIGHT,
          sprite: sprites[Math.floor(Math.random()*2+2)][Math.floor(Math.random()*2)+26],
          back: sprites[Math.floor(Math.random()*3)][Math.floor(Math.random()*3)]
        }
      }
    }
  }
}

const drawMain = (delay) => {
  units.forEach((unit, i) => {
    // Display the unit
    offCtx1.putImageData(unit.sprite, Math.round(unit.x), Math.round(unit.y))
  })
  mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height)
  mainCtx.drawImage(offCanvas1, 0, 0, mainCanvas.width, mainCanvas.height)

  // clear the offCanvas1 at the end
  offCtx1.clearRect(0, 0, mainCanvas.width, mainCanvas.height)
}


const drawBack = (delay) => {
  backCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height)

  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      if(map[x][y].back) offCtx2.putImageData(map[x][y].back, x * SPRITE_SIZE, y * SPRITE_SIZE)
      offCtx1.putImageData(map[x][y].sprite, x * SPRITE_SIZE, y * SPRITE_SIZE)
    }
  }

  backCtx.drawImage(offCanvas2, 0, 0, mainCanvas.width, mainCanvas.height)
  backCtx.drawImage(offCanvas1, 0, 0, mainCanvas.width, mainCanvas.height)

  if(DEBUG) { // Display paths of the all units
    offCtx1.clearRect(0, 0, mainCanvas.width, mainCanvas.height)
    units.forEach((unit, i) => {
      for (var i = 1; i < (unit.path || []).length; i++) {
        offCtx1.putImageData(sprites[spriteCoords_Path.x][spriteCoords_Path.y], unit.path[i].x * SPRITE_SIZE, unit.path[i].y * SPRITE_SIZE)
      }
    })
    backCtx.drawImage(offCanvas1, 0, 0, mainCanvas.width, mainCanvas.height)
  }

  // clear the offCanvas1 at the end
  offCtx1.clearRect(0, 0, mainCanvas.width, mainCanvas.height)
  offCtx2.clearRect(0, 0, mainCanvas.width, mainCanvas.height)
}

const ui = (delay) => {
  document.getElementById('stats').innerHTML = `FPS: ${fps.toFixed(1)}`
}

const gameLoop = () => {
  requestAnimationFrame(gameLoop);

  const now = performance.now()
  const delay = now - elapsed
  elapsed = now


  if(now - elapsedBack > 1000 || isDrawBackRequested) {
    isDrawBackRequested = false
    elapsedBack = now
    drawBack(now - elapsedBack)
  }

  

  // Update units
  for (var i = 0; i < units.length; i++) {
    units[i].update(delay)
    if(units[i].life === 0) {
      units.splice(i, 1)
      i--
    }
  }

  // Create new units if needed
  if((units.length < MAX_UNITS && Math.random() > 0.99) || units.length === 0) {
    units.push(new Unit())
  }






  //if(now - elapsedUI > 150) {
    elapsedUI = now
    fps = Math.round((fps*99 + 1000/delay)) / 100
    ui(now - elapsedUI)
  //}

  drawMain(delay)
}


// the real "main" of the game
onload = async (e) => {
  await onresize()

  loadAndSplitImage('./assets/punyworld-overworld-tileset.png', SPRITE_SIZE)
    .then(spritesArray => {
      sprites = spritesArray

      generateMap()

      gameLoop()
    })
    .catch(error => {
      console.error('Error loading and splitting image:', error)
    })

};

onresize = onrotate = async () => {
  // Calculate new dimensions while maintaining aspect ratio
  const screenWidth = globalThis.innerWidth || 800
  const screenHeight = globalThis.innerHeight || 800
  const screenAspectRatio = screenWidth / screenHeight

  if (screenAspectRatio > desiredAspectRatio) {
      // Screen is wider than our aspect ratio, set height to match screen and calculate width
      canvasHeight = screenHeight
      canvasWidth = canvasHeight * desiredAspectRatio
  } else {
      // Screen is taller than our aspect ratio, set width to match screen and calculate height
      canvasWidth = screenWidth
      canvasHeight = canvasWidth / desiredAspectRatio
  }

  // Account for Device Pixel Ratio (DPR)
  dpr = globalThis.devicePixelRatio || 1; // Fallback for older browsers
  mainCanvas.width = backCanvas.width = uiCanvas.width = offCanvas1.width = offCanvas2.width = MAP_WIDTH * SPRITE_SIZE * dpr
  mainCanvas.height = backCanvas.height = uiCanvas.height = offCanvas1.height = offCanvas2.height = MAP_HEIGHT * SPRITE_SIZE * dpr

  // To ensure proper scaling (no blurriness), scale the context
  mainCtx.scale(dpr, dpr)
  backCtx.scale(dpr, dpr)
  uiCtx.scale(dpr, dpr)
  offCtx1.scale(dpr, dpr)
  offCtx2.scale(dpr, dpr)

  // Now, update your canvas to fit the screen visually (CSS pixels)
  mainCanvas.style.width = backCanvas.style.width = uiCanvas.style.width = `${canvasWidth}px`
  mainCanvas.style.height = backCanvas.style.height = uiCanvas.style.height = `${canvasHeight}px`

  // disable smoothing on image scaling
  mainCtx.imageSmoothingEnabled = backCtx.imageSmoothingEnabled = uiCtx.imageSmoothingEnabled = offCtx1.imageSmoothingEnabled = offCtx2.imageSmoothingEnabled = false

  isDrawBackRequested = true

  // fix key events not received on itch.io when game loads in full screen
  window.focus()
};
