'use strict'

let canvas, ctx

const canvasInitialization = async (arrayToSort) => {
  canvas = document.getElementById('canvas')
  ctx = canvas.getContext('2d')

  draw(arrayToSort)
}

const draw = async (array = []) => {
  ctx.fillStyle = '#EFEFEF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  array.forEach((bar, i) => {
    ctx.fillStyle = `hsl(${bar * 360 / array.length}, 100%, 45%)`
    ctx.fillRect(i * canvas.width / array.length, 0, 1 + canvas.width / array.length, bar * canvas.height / array.length)
  })
}
