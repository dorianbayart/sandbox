'use script'

const backCanvas = document.getElementById('backCanvas')
const backCtx = setupCanvas(backCanvas)
const mainCanvas = document.getElementById('mainCanvas')
const mainCtx = setupCanvas(mainCanvas)
const uiCanvas = document.getElementById('uiCanvas')
const uiCtx = setupCanvas(uiCanvas)

const offCanvas = document.createElement('canvas')
const offCtx = setupCanvas(offCanvas, backCanvas)


/****************/
/*  DEBUG MODE  */
/****************/
const DEBUG = true


const SPRITE_SIZE = 16
const MAP_WIDTH = 40
const MAP_HEIGHT = 40
const MAX_WEIGHT = 99999999
const map = new Array(MAP_WIDTH).fill(null).map(() => new Array(MAP_HEIGHT).fill(null))

let sprites, elapsed = elapsedBack = elapsedUI = 0, fps = 60
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
    this.move(delay)
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

    if(Math.hypot(this.nextNode.x*SPRITE_SIZE - this.x, this.nextNode.y*SPRITE_SIZE - this.y) < SPRITE_SIZE/4) {
      this.currentNode.x = this.nextNode.x
      this.currentNode.y = this.nextNode.y
    }

  }
}

const loadAndSplitImage = (url) => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'

    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height

      const ctx = canvas.getContext('2d')
      ctx.drawImage(image, 0, 0)

      const spriteSheet = ctx.getImageData(0, 0, image.width, image.height)
      const sprites = Array.from({ length: Math.round(image.width/SPRITE_SIZE) }, (_, i) => Array.from({ length: Math.round(image.height/SPRITE_SIZE) }, (_, j) => 0))

      // Split the image into smaller subimages of SPRITE_SIZExSPRITE_SIZE pixels
      for (let x = 0; x < image.width / SPRITE_SIZE; x++) {
        for (let y = 0; y < image.height / SPRITE_SIZE; y++) {
          sprites[x][y] = ctx.getImageData(x * SPRITE_SIZE, y * SPRITE_SIZE, SPRITE_SIZE, SPRITE_SIZE)
        }
      }

      resolve(sprites/*.filter(sprite => sprite.data.reduce((r, c) => r + c))*/)
    }

    image.onerror = reject
    image.src = url
  })
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
  mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

  units.forEach((unit, i) => {
    // Display the unit
    mainCtx.putImageData(unit.sprite, Math.round(unit.x), Math.round(unit.y))
  })

}


const drawBack = (delay) => {
  backCtx.clearRect(0, 0, backCanvas.width, backCanvas.height)
  offCtx.clearRect(0, 0, backCanvas.width, backCanvas.height)

  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      if(map[x][y].back) backCtx.putImageData(map[x][y].back, x * SPRITE_SIZE, y * SPRITE_SIZE)
      offCtx.putImageData(map[x][y].sprite, x * SPRITE_SIZE, y * SPRITE_SIZE)
    }
  }

  backCtx.drawImage(offCanvas, 0, 0, backCanvas.width, backCanvas.height)

  if(DEBUG) { // Display paths of the all units
    offCtx.clearRect(0, 0, backCanvas.width, backCanvas.height)
    units.forEach((unit, i) => {
      for (var i = 1; i < (unit.path || []).length; i++) {
        offCtx.putImageData(sprites[spriteCoords_Path.x][spriteCoords_Path.y], unit.path[i].x * SPRITE_SIZE, unit.path[i].y * SPRITE_SIZE)
      }
    })
    backCtx.drawImage(offCanvas, 0, 0, backCanvas.width, backCanvas.height)
  }

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
  onresize()

  loadAndSplitImage('./assets/punyworld-overworld-tileset.png')
    .then(spritesArray => {
      sprites = spritesArray

      generateMap()

      gameLoop()
    })
    .catch(error => {
      console.error('Error loading and splitting image:', error)
    })

};

onresize = onrotate = () => {
  // scale canvas to fit screen while maintaining aspect ratio
  // scaleToFit = Math.min(innerWidth / mainCanvas.width, innerHeight / mainCanvas.height)
  //
  // mainCanvas.width = mainCanvas.width * scaleToFit
  // mainCanvas.height = mainCanvas.height * scaleToFit
  // backCanvas.width = mainCanvas.width
  // backCanvas.height = mainCanvas.height
  // uiCanvas.width = mainCanvas.width
  // uiCanvas.height = mainCanvas.height
  // offCanvas.width = mainCanvas.width
  // offCanvas.height = mainCanvas.height
  const pixels = Math.max(innerWidth, innerHeight)
  mainCanvas.width = mainCanvas.height = pixels
  backCanvas.width = backCanvas.height = pixels
  uiCanvas.width = uiCanvas.height = pixels
  offCanvas.width = offCanvas.height = pixels

  // disable smoothing on image scaling
  mainCtx.imageSmoothingEnabled = backCtx.imageSmoothingEnabled = uiCtx.imageSmoothingEnabled = offCtx.imageSmoothingEnabled = false

  isDrawBackRequested = true

  // fix key events not received on itch.io when game loads in full screen
  window.focus()
};
