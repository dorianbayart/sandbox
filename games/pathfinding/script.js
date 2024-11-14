'use script'

const canvasFront = document.createElement("canvas")
canvasFront.style = "z-index: -1"
const ctxFront = canvasFront.getContext('2d')

const canvasBack = document.createElement("canvas")
canvasBack.style = "z-index: -2"
const ctxBack = canvasBack.getContext('2d')

var devicePixelRatio = 1, elapsed = elapsedForBackground = Date.now() - 100, lastMapUpdate = 0

var mouse = {
  x: 10,
  y: 10
}

var map = [], visited = [], toVisit = [], blobs = []
const maxBlobs = 75, cellSize = 8

function Cell (x, y) {
  this.x = x
  this.y = y
  this.weight = -1

  this.updatePath = (weight) => {
    this.weight = weight
    visited[this.x][this.y] = true

    if(this.x > 0 && !visited[this.x-1][this.y]) {
      toVisit.push({ x: this.x-1, y: this.y, w: this.weight+1 })
      visited[this.x-1][this.y] = true
    }
    if(this.x < map.length - 1 && !visited[this.x+1][this.y]) {
      toVisit.push({ x: this.x+1, y: this.y, w: this.weight+1 })
      visited[this.x+1][this.y] = true
    }
    if(this.y > 0 && !visited[this.x][this.y-1]) {
      toVisit.push({ x: this.x, y: this.y-1, w: this.weight+1 })
      visited[this.x][this.y-1] = true
    }
    if(this.y < map[0].length - 1 && !visited[this.x][this.y+1]) {
      toVisit.push({ x: this.x, y: this.y+1, w: this.weight+1 })
      visited[this.x][this.y+1] = true
    }

    if(this.x > 0 && this.y > 0 && !visited[this.x-1][this.y-1]) {
      toVisit.push({ x: this.x-1, y: this.y-1, w: this.weight+1.42 })
      visited[this.x-1][this.y-1] = true
    }
    if(this.x > 0 && this.y < map[0].length - 1 && !visited[this.x-1][this.y+1]) {
      toVisit.push({ x: this.x-1, y: this.y+1, w: this.weight+1.42 })
      visited[this.x-1][this.y+1] = true
    }
    if(this.x < map.length - 1 && this.y < map[0].length - 1 && !visited[this.x+1][this.y+1]) {
      toVisit.push({ x: this.x+1, y: this.y+1, w: this.weight+1.42 })
      visited[this.x+1][this.y+1] = true
    }
    if(this.x < map.length - 1 && this.y > 0 && !visited[this.x+1][this.y-1]) {
      toVisit.push({ x: this.x+1, y: this.y-1, w: this.weight+1.42 })
      visited[this.x+1][this.y-1] = true
    }
  }
}

function Blob (x, y, i) {
  this.x = x
  this.y = y
  this.c = `hsl(${Math.round(Math.random() * 360) % 360}, 100%, 45%)`
  this.distance = canvasFront.width * canvasFront.height
  this.life = Math.round(Math.random() * 30 + 5) * 1000

  this.update = (delay) => {
    this.life -= delay
    if(this.life < 0) return

    this.distance = map[this.x] && map[this.x][this.y] ? map[this.x][this.y].weight : 0
    if(this.distance < 2) return
    const rand = Math.random()
    if(rand > .75 && this.x > 0 && map[this.x-1][this.y]?.weight < this.distance && blobs.findIndex(blob => blob.x === this.x-1 && blob.y === this.y) < 0) {
      this.x -= 1
      return
    }
    if(rand > .5 && this.x < map.length - 1 && map[this.x+1][this.y]?.weight < this.distance && blobs.findIndex(blob => blob.x === this.x+1 && blob.y === this.y) < 0) {
      this.x += 1
      return
    }
    if(rand > .25 && this.y > 0 && map[this.x][this.y-1]?.weight < this.distance && blobs.findIndex(blob => blob.x === this.x && blob.y === this.y-1) < 0) {
      this.y -= 1
      return
    }
    if(this.y < map[0].length - 1 && map[this.x][this.y+1]?.weight < this.distance && blobs.findIndex(blob => blob.x === this.x && blob.y === this.y+1) < 0) {
      this.y += 1
      return
    }

    if(rand > .75 && this.x > 0 && this.y > 0 && map[this.x-1][this.y-1]?.weight <= this.distance && blobs.findIndex(blob => blob.x === this.x-1 && blob.y === this.y-1) < 0) {
      this.x -= 1
      this.y -= 1
      return
    }
    if(rand > .5 && this.x < map.length - 1 && this.y > 0 && map[this.x+1][this.y-1]?.weight <= this.distance && blobs.findIndex(blob => blob.x === this.x+1 && blob.y === this.y-1) < 0) {
      this.x += 1
      this.y -= 1
      return
    }
    if(rand > .25 && this.x < map.length - 1 && this.y < map[0].length - 1 && map[this.x+1][this.y+1]?.weight <= this.distance && blobs.findIndex(blob => blob.x === this.x+1 && blob.y === this.y+1) < 0) {
      this.x += 1
      this.y += 1
      return
    }
    if(this.x > 0 && this.y < map[0].length - 1 && map[this.x-1][this.y+1]?.weight <= this.distance && blobs.findIndex(blob => blob.x === this.x-1 && blob.y === this.y+1) < 0) {
      this.x -= 1
      this.y += 1
      return
    }
  }
}

const resizeEvent = async () => {
  devicePixelRatio = 'ontouchstart' in window || navigator.msMaxTouchPoints ? window.devicePixelRatio : 1
  canvasFront.width = innerWidth * devicePixelRatio
  canvasFront.height = innerHeight * devicePixelRatio
  canvasFront.style.width = (canvasFront.width / devicePixelRatio) + 'px'
  canvasFront.style.height = (canvasFront.height / devicePixelRatio) + 'px'
  canvasBack.width = innerWidth * devicePixelRatio
  canvasBack.height = innerHeight * devicePixelRatio
  canvasBack.style.width = (canvasBack.width / devicePixelRatio) + 'px'
  canvasBack.style.height = (canvasBack.height / devicePixelRatio) + 'px'
}

const cycleUpdate = (delay) => {
  if(map.length < Math.round(canvasFront.width/cellSize)) {
    map.push(Array.from({ length: Math.round(canvasFront.height/cellSize) }, (_, j) => new Cell(map.length, j)))
  }

  if(map.length > Math.round(canvasFront.width/cellSize)) {
    map.splice(map.length - 1, 1)
  }

  if(map[0].length < Math.round(canvasFront.height/cellSize)) {
    for (var i = 0; i < map.length; i++) {
      map[i].splice(map[i].length - 1, 1)
    }
  }

  if(map[0].length > Math.round(canvasFront.height/cellSize)) {
    for (var i = 0; i < map.length; i++) {
      map[i].push(new Cell(map.length, i))
    }
  }

  if(blobs.length < maxBlobs) {
    blobs.push(new Blob(Math.round(Math.random()*map.length), Math.round(Math.random()*map[0].length), blobs.length))
  }

  if(Date.now() - lastMapUpdate > 75) {
    // update pathfinding
    if(map[Math.round(mouse.x/cellSize)][Math.round(mouse.y/cellSize)]?.weight !== 0) {
      visited = Array.from({ length: map.length }, (_, i) => Array.from({ length: map[0].length }, (_, j) => false))
      if(mouse.x > 0 && Math.round(mouse.x/cellSize) < map.length - 1 && mouse.y > 0 && Math.round(mouse.y/cellSize) < map[0].length - 1) {
        map[Math.round(mouse.x/cellSize)][Math.round(mouse.y/cellSize)].updatePath(0)
        while (toVisit.length > 0 && toVisit.length < map.length * map[0].length) {
          map[toVisit[0].x][toVisit[0].y].updatePath(toVisit[0].w)
          toVisit.splice(0, 1)
        }
      }
    }
    lastMapUpdate = Date.now()
  }

  blobs.sort((a, b) => a.distance - b.distance)
  let blobsNewState = blobs
  for (var i = 0; i < blobsNewState.length; ) {
    blobsNewState[i].update(delay)
    if(blobsNewState[i].life <= 0) {
      blobsNewState.splice(i, 1)
    } else {
      i++
    }
  }
  blobs = blobsNewState

}

const draw = async () => {
  requestAnimationFrame(draw)

  const now = Date.now()
  const delay = now - elapsed
  elapsed = now

  cycleUpdate(delay)

  ctxFront.clearRect(0, 0, canvasFront.width, canvasFront.height)

  ctxFront.beginPath()
  ctxFront.arc(mouse.x, mouse.y, 25, 0, 2 * Math.PI)
  ctxFront.strokeStyle = `hsl(250, 100%, 45%)`
  ctxFront.stroke()

  for (var i = 0; i < blobs.length; i++) {
    ctxFront.beginPath()
    ctxFront.arc(blobs[i].x*cellSize + cellSize/2, blobs[i].y*cellSize + cellSize/2, cellSize/2, 0, 2 * Math.PI)
    ctxFront.fillStyle = blobs[i].c
    ctxFront.fill()
  }

}

const drawBackground = async () => {
  requestAnimationFrame(drawBackground)

  const now = Date.now()
  const delay = now - elapsedForBackground

  if(delay > 100) {
    if(('ontouchstart' in window || navigator.msMaxTouchPoints) && Math.random() > 0.975) {
      mouse.x = Math.round(Math.random() * canvasBack.width)
      mouse.y = Math.round(Math.random() * canvasBack.height)
    }

    elapsedForBackground = now
    ctxBack.clearRect(0, 0, canvasBack.width, canvasBack.height)

    for (var i = 0; i < map.length; i++) {
      for (var j = 0; j < map[0].length; j++) {
        ctxBack.beginPath()
        ctxBack.rect(i*cellSize, j*cellSize, cellSize, cellSize)
        ctxBack.strokeStyle = `hsl(${(map[i][j]?.weight*1.75) % 360}, 100%, 45%)`
        ctxBack.stroke()
      }
    }
  }
}

const init = async () => {
  await resizeEvent()
  document.body.appendChild(canvasBack)
  document.body.appendChild(canvasFront)

  map = Array.from({ length: Math.round(canvasFront.width/cellSize) }, (_, i) => Array.from({ length: Math.round(canvasFront.height/cellSize) }, (_, j) => new Cell(i, j)))

  draw()
  drawBackground()
}

init()

// Events
window.addEventListener('resize', resizeEvent)

window.addEventListener('mousemove', (event) => {
  mouse.x = event.x * devicePixelRatio
  mouse.y = event.y * devicePixelRatio
})
