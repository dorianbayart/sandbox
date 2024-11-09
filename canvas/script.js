'use script'

const canvas = document.createElement("canvas")
const c = canvas.getContext('2d')

// Rectangle
// c.fillStyle = 'rgba(255, 0, 0, 0.5)'
// c.fillRect(100, 100, 100, 100)
// c.fillStyle = 'rgba(0, 255, 0, 0.5)'
// c.fillRect(400, 100, 100, 100)
// c.fillStyle = 'rgba(0, 0, 255, 0.5)'
// c.fillRect(300, 300, 100, 100)

// Line
// c.beginPath()
// c.moveTo(50, 300)
// c.lineTo(300, 100)
// c.lineTo(400, 300)
// c.strokeStyle = 'purple'
// c.stroke()

// Arc / Circle
// c.beginPath()
// c.arc(300, 300, 30, 0, Math.PI * 2, false)
// c.strokeStyle = 'darkblue'
// c.stroke()


var mouse = {
  x: undefined,
  y: undefined
}
var devicePixelRatio = 1

var fps = 60, ballsAverage = 0
var maxCircles = 10, circleArray = [], elapsed = Date.now() - 1

const maxRadius = 40
const gravity = 0.12
const xFriction = 0.95, yFriction = 0.85

var colorArray = [
  '#542773',
  '#BFF272',
  '#F2E5A0',
  '#D9923B',
  '#D93E30'
]



function Circle(x, y, dx, dy, radius, color, life) {
  this.x = x
  this.y = y
  this.dx = dx
  this.dy = dy
  this.minRadius = radius
  this.radius = radius
  this.color = color
  this.life = life
  this.opacity = 0

  this.draw = () => {
    c.globalAlpha = this.opacity
    c.beginPath()
    c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false)
    c.fillStyle = this.color
    c.fill()
    c.strokeStyle = this.color
    // c.stroke()
    c.closePath()
    c.globalAlpha = 1
  }

  this.update = async (delay) => {
    // Inverse movement on edges
    if(this.x + this.radius >= canvas.width || this.x - this.radius <= 0) {
      this.dx = -this.dx * xFriction
    }
    if(this.y + this.radius >= canvas.height) {
      this.dy = -this.dy * yFriction
      this.dx = this.dx * xFriction
    }
    // Add gravity
    this.dy += gravity
    // Move the ball
    this.x += this.dx
    this.y += this.dy

    // Fix edges stuck balls
    if(this.x + this.radius > canvas.width) this.x = canvas.width - this.radius
    if(this.x - this.radius < 0) this.x = this.radius
    if(this.y + this.radius > canvas.height) this.y = canvas.height - this.radius

    // Mouse Interactivity
    if(mouse.x - this.x < 50 && mouse.x - this.x > -50 &&
      mouse.y - this.y < 50 && mouse.y - this.y > -50
    ) {
      if(this.radius < maxRadius) this.radius += 1
    } else if (this.radius > this.minRadius) {
      this.radius -= 1
    }

    // Reduce Life
    this.life -= delay / 1000

    // Manage Opacity
    if(this.life > 1) this.opacity += delay / 1000
    else this.opacity -= delay / 1000
    if(this.opacity > 0.995) this.opacity = 1
    if(this.life < 1 && this.opacity < 0.005) this.opacity = 0

    this.draw()
  }
}

const createCircle = () => {
  var radius = Math.round(Math.random() * 8 + 2)
  var x = Math.random() * (canvas.width - 2 * radius) + radius
  var y = Math.random() * (canvas.height/2 - 2 * radius) + radius
  // var color = `hsl(${Math.random() * 360}, 80%, 40%, 85%)`
  var color = colorArray[Math.floor(Math.random() * colorArray.length)]
  var dx = (Math.random() - 0.5) * 5
  var dy = (Math.random() - 1.5) * 3
  var life = Math.random() * 15 + 5

  circleArray.push(new Circle(x, y, dx, dy, radius, color, life))
}



const resizeEvent = async () => {
  devicePixelRatio = 'ontouchstart' in window || navigator.msMaxTouchPoints ? window.devicePixelRatio : 1
  canvas.width = innerWidth * devicePixelRatio
  canvas.height = innerHeight * devicePixelRatio
  canvas.style.width = (canvas.width / devicePixelRatio) + 'px'
  canvas.style.height = (canvas.height / devicePixelRatio) + 'px'
  maxCircles = Math.round(canvas.width * canvas.height / 2000)

  document.getElementById('resolution').innerHTML = `${canvas.width}x${canvas.height} (DPR: ${Math.round(devicePixelRatio*1000)/1000})`
}

const init = async () => {
  await resizeEvent()
  circleArray = []

  for (var i = 0; i < maxCircles / 40; i++) {
    createCircle()
  }

  document.body.appendChild(canvas)

  animate()
}

const animate = async () => {
  requestAnimationFrame(animate)
  c.clearRect(0, 0, canvas.width, canvas.height)

  const now = Date.now()
  const delay = now - elapsed
  elapsed = now

  for (var i = 0; i < circleArray.length; ) {
    circleArray[i].update(delay)

    if(circleArray[i].life <= 0) {
      circleArray.splice(i, 1)
    } else {
      i++
    }
  }

  fps = Math.round((fps * 59 + 1000/(delay)) / 60 * 10) / 10
  document.getElementById('fps').innerHTML = `${fps} FPS`

  ballsAverage = Math.round((ballsAverage * 99 + circleArray.length) / 100)
  document.getElementById('stats').innerHTML = `${ballsAverage} balls`

  if(circleArray.length < maxCircles) createCircle()
}

init()

// Events
window.addEventListener('resize', resizeEvent)

window.addEventListener('mousemove', (event) => {
  mouse.x = event.x * devicePixelRatio
  mouse.y = event.y * devicePixelRatio
})

window.addEventListener('touchstart', (event) => {
  mouse.x = event.x * devicePixelRatio
  mouse.y = event.y * devicePixelRatio
})

window.addEventListener('touchmove', (event) => {
  mouse.x = event.x * devicePixelRatio
  mouse.y = event.y * devicePixelRatio
})
