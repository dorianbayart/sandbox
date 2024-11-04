'use script'

const canvas = document.querySelector('canvas')
canvas.width = window.innerWidth
canvas.height = window.innerHeight

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

// for (var i = 0; i < 3; i++) {
//   var x = Math.random() * window.innerWidth
//   var y = Math.random() * window.innerHeight
//   var color = Math.random() * 360
//   c.beginPath()
//   c.arc(x, y, 30, 0, Math.PI * 2, false)
//   c.strokeStyle = `hsl(${color}, 80%, 50%, 75%)`
//   c.stroke()
// }


var mouse = {
  x: undefined,
  z: undefined
}

var maxRadius = 40

var colorArray = [
  '#542773',
  '#BFF272',
  '#F2E5A0',
  '#D9923B',
  '#D93E30'
]

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  maxCircles = Math.round(canvas.width * canvas.height / 4000)
})

window.addEventListener('mousemove', (event) => {
  mouse.x = event.x
  mouse.y = event.y
})

window.addEventListener('touchstart', (event) => {
  mouse.x = event.x
  mouse.y = event.y
})

window.addEventListener('touchmove', (event) => {
  mouse.x = event.x
  mouse.y = event.y
})



function Circle(x, y, dx, dy, radius, color, life) {
  this.x = x
  this.y = y
  this.dx = dx
  this.dy = dy
  this.minRadius = radius
  this.radius = radius
  this.color = color
  this.life = life

  this.draw = () => {
    c.beginPath()
    c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false)
    c.fillStyle = this.color
    c.fill()
  }

  this.update = (delay) => {
    if(this.x + this.radius > innerWidth || this.x - this.radius < 0) {
      this.dx = -this.dx
    }
    if(this.y + this.radius > innerHeight || this.y - this.radius < 0) {
      this.dy = -this.dy
    }
    this.x += this.dx
    this.y += this.dy

    // interactivity
    if(mouse.x - this.x < 50 && mouse.x - this.x > -50 &&
      mouse.y - this.y < 50 && mouse.y - this.y > -50
    ) {
      if(this.radius < maxRadius) this.radius += 1
    } else if (this.radius > this.minRadius) {
      this.radius -= 1
    }

    this.life -= delay / 1000

    this.draw()
  }
}



const createCircle = () => {
  var radius = Math.round(Math.random() * 8 + 2)
  var x = Math.random() * (window.innerWidth - 2 * radius) + radius
  var y = Math.random() * (window.innerHeight - 2 * radius) + radius
  // var color = `hsl(${Math.random() * 360}, 80%, 40%, 85%)`
  var color = colorArray[Math.floor(Math.random() * colorArray.length)]
  var dx = (Math.random() - 0.5) * 3
  var dy = (Math.random() - 0.5) * 3
  var life = Math.random() * 20 + 2

  circleArray.push(new Circle(x, y, dx, dy, radius, color, life))
}


var circleArray = [], elapsed = Date.now()
var maxCircles = 85

const init = () => {
  circleArray = []

  for (var i = 0; i < maxCircles; i++) {
    createCircle()
  }
}


const animate = () => {
  requestAnimationFrame(animate)
  c.clearRect(0, 0, innerWidth, innerHeight)

  const delay = Date.now() - elapsed
  circleArray.forEach((circle, i) => {
    circle.update(delay)
    if(circle.life < 0) {
      circleArray.splice(i, 1)
    }
  })

  if(circleArray.length < maxCircles) createCircle()
  elapsed = Date.now()
}

init()
animate()