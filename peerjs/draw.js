'use strict'

let canvas, ctx

const canvasInitialization = async () => {
  canvas = document.getElementById('canvas')
  if(!canvas) return
  ctx = canvas.getContext('2d')

  draw()
}

const draw = async () => {
  // ctx.fillStyle = 'transparent'
  ctx.fillStyle = '#EFEFEF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  listUsers.forEach((user, i) => {
    ctx.beginPath()
    ctx.arc(user.x, user.y, 10, 0, 2 * Math.PI)
    ctx.fillStyle = user.color
    ctx.fill()
  })

  requestAnimationFrame(draw)
}
