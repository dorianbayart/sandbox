'use script'

const canvas = document.createElement("canvas")
const ctx = canvas.getContext('2d')

var devicePixelRatio = 1

var mouse = {
  x: 0,
  y: 0
}


const resizeEvent = async () => {
  devicePixelRatio = 'ontouchstart' in window || navigator.msMaxTouchPoints ? window.devicePixelRatio : 1
  canvas.width = innerWidth * devicePixelRatio
  canvas.height = innerHeight * devicePixelRatio
  canvas.style.width = (canvas.width / devicePixelRatio) + 'px'
  canvas.style.height = (canvas.height / devicePixelRatio) + 'px'
}

const draw = async () => {
  requestAnimationFrame(draw)
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.beginPath()
  ctx.arc(mouse.x, mouse.y, 25, 0, 2 * Math.PI)
  ctx.fillStyle = `hsl(${(mouse.x + mouse.y) % 360}, 100%, 45%)`
  ctx.fill()
}

const init = async () => {
  await resizeEvent()
  document.body.appendChild(canvas)

  draw()
}

init()

// Events
window.addEventListener('resize', resizeEvent)

window.addEventListener('mousemove', (event) => {
  mouse.x = event.x * devicePixelRatio
  mouse.y = event.y * devicePixelRatio
})
