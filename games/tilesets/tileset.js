'use script'

const backCanvas = document.getElementById('backCanvas')
const backCtx = setupCanvas(backCanvas)
const mainCanvas = document.getElementById('mainCanvas')
const mainCtx = setupCanvas(mainCanvas)
const uiCanvas = document.getElementById('uiCanvas')
const uiCtx = setupCanvas(uiCanvas)

const offCanvas = document.createElement('canvas')
const offCtx = setupCanvas(offCanvas, backCanvas)

const spriteSize = 16
const MAP_WIDTH = 40
const MAP_HEIGHT = 40
const MAX_WEIGHT = 99999999
const map = new Array(MAP_WIDTH).fill(null).map(() => new Array(MAP_HEIGHT).fill(null))

let sprites, elapsed = elapsedBack = elapsedUI = performance.now(), fps = 50, speed = 25

let spriteCoords_Start = { x: 21, y: 5 }
let spriteCoords_End = { x: 22, y: 4 }
let spriteCoords_Path = { x: 22, y: 5 }

const units = []
const MAX_UNITS = 4
const enemies = []

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
      //console.log(canvas.toDataURL())
      const sprites = Array.from({ length: Math.round(image.width/spriteSize) }, (_, i) => Array.from({ length: Math.round(image.height/spriteSize) }, (_, j) => 0))

      // Split the image into smaller subimages of spriteSizexspriteSize pixels
      for (let x = 0; x < image.width / spriteSize; x++) {
        for (let y = 0; y < image.height / spriteSize; y++) {
          sprites[x][y] = ctx.getImageData(x * spriteSize, y * spriteSize, spriteSize, spriteSize)
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
    // Display path of the unit
    (unit.path || []).forEach((path, i) => {
      mainCtx.putImageData(sprites[spriteCoords_Path.x][spriteCoords_Path.y], path.x * spriteSize, path.y * spriteSize)
    })
  })
  units.forEach((unit, i) => {
    // Display the unit
    mainCtx.putImageData(unit.sprite, unit.x * spriteSize, unit.y * spriteSize)
  })

}


const drawBack = (delay) => {
  backCtx.clearRect(0, 0, backCanvas.width, backCanvas.height)
  offCtx.clearRect(0, 0, backCanvas.width, backCanvas.height)

  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      if(map[x][y].back) backCtx.putImageData(map[x][y].back, x * spriteSize, y * spriteSize)
      offCtx.putImageData(map[x][y].sprite, x * spriteSize, y * spriteSize)
    }
  }

  backCtx.drawImage(offCanvas, 0, 0, backCanvas.width, backCanvas.height)
}

const ui = (delay) => {
  document.getElementById('stats').innerHTML = `FPS: ${fps}`
}

const createUnit = () => {
  let x = Math.floor(Math.random()*MAP_WIDTH)
  while(map[x][MAP_HEIGHT-1].weight === MAX_WEIGHT) {
    x = Math.floor(Math.random()*MAP_WIDTH)
  }



  units.push({
    x: x,
    y: MAP_HEIGHT-1,
    sprite: sprites[spriteCoords_Start.x][spriteCoords_Start.y],
    path: []
  })
}

const gameLoop = () => {
  requestAnimationFrame(gameLoop);

  for (var i = 0; i < units.length; i++) {
    const unit = units[i]
    let path, pathLength = MAP_WIDTH * MAP_HEIGHT
    enemies.forEach((enemy, i) => {
      const temp = bestFirstSearch(map, unit.x, unit.y, enemy.x, enemy.y)
      if(temp?.length < pathLength) {
        path = temp
        pathLength = path.length
      }
    })
    unit.path = path
    if(!path || path.length === 1) {
      units.splice(i, 1)
      i--
    } else {
      unit.x = path[1].x
      unit.y = path[1].y
    }
  }


  const now = performance.now()
  const delay = now - elapsed
  elapsed = now
  drawMain(delay)

  if(now - elapsedBack > 400) {
    elapsedBack = now
    drawBack(now - elapsedBack)

    if((units.length < MAX_UNITS && Math.random() > 0.5) || units.length === 0) {
      createUnit()
    }
  }

  if(now - elapsedUI > 150) {
    elapsedUI = now
    fps = Math.round((fps*49 + 1000/delay)) / 50
    ui(now - elapsedUI)
  }

}


// the real "main" of the game
onload = async (e) => {
  onresize()

  loadAndSplitImage('./punyworld-overworld-tileset.png')
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

  // fix key events not received on itch.io when game loads in full screen
  window.focus()
};
