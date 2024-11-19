'use script'

const backCanvas = document.getElementById('backCanvas')
const backCtx = backCanvas.getContext('2d')
const mainCanvas = document.getElementById('mainCanvas')
const mainCtx = mainCanvas.getContext('2d')
const uiCanvas = document.getElementById('uiCanvas')
const uiCtx = uiCanvas.getContext('2d')

const spriteSize = 16
const MAP_WIDTH = backCanvas.width / spriteSize
const MAP_HEIGHT = backCanvas.height / spriteSize
const map = new Array(MAP_WIDTH).fill(null).map(() =>
  new Array(MAP_HEIGHT).fill(null)
  )

let sprites, elapsed = elapsedBack = elapsedUI = Date.now(), fps = 50, speed = 25

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
            if(Math.random() < 0.75) {
                map[x][y] = {
                    weight: 1,
                    sprite: sprites[Math.floor(Math.random()*3)][Math.floor(Math.random()*3)],
                    back: null
                }
            } else {
                map[x][y] = {
                    weight: 99999999,
                    sprite: sprites[Math.floor(Math.random()*2+2)][Math.floor(Math.random()*2)+26],
                    back: sprites[Math.floor(Math.random()*3)][Math.floor(Math.random()*3)]
                }
            }
        }
    }
}

const drawMain = (delay) => {
  mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

}


const drawBack = (delay) => {
    const offCanvas = document.createElement('canvas')
    const offCtx = offCanvas.getContext('2d')
    offCanvas.width = backCanvas.width
    offCanvas.height = backCanvas.height
    
    backCtx.clearRect(0, 0, backCanvas.width, backCanvas.height)

    for (let x = 0; x < MAP_WIDTH; x++) {
        for (let y = 0; y < MAP_HEIGHT; y++) {
            if(map[x][y].back) backCtx.putImageData(map[x][y].back, x * spriteSize, y * spriteSize)
                offCtx.putImageData(map[x][y].sprite, x * spriteSize, y * spriteSize)
        }
    }
    backCtx.drawImage(offCanvas, 0, 0)
}

const ui = (delay) => {
    document.getElementById('stats').innerHTML = `FPS: ${fps}`
}

const gameLoop = () => {
  requestAnimationFrame(gameLoop);

  const now = Date.now()
  const delay = now - elapsed
  elapsed = now

  if(now - elapsedBack > 400) {
    elapsedBack = now
    drawBack(now - elapsedBack)
}

if(now - elapsedUI > 150) {
    elapsedUI = now
    fps = Math.round((fps*49 + 1000/delay)) / 50
    ui(now - elapsedUI)
}

}


loadAndSplitImage('./punyworld-overworld-tileset.png'/*, 432, 1040*/)
.then(spritesArray => {
    sprites = spritesArray

    //map = Array.from({ length: Math.round(canvasFront.width/cellSize) }, (_, i) => Array.from({ length: Math.round(canvasFront.height/cellSize) }, (_, j) => new Cell(i, j)))
    generateMap()

    gameLoop()
})
.catch(error => {
    console.error('Error loading and splitting image:', error)
})