'use strict'

import { v4 as uuidv4 } from 'uuid'
import { Blob } from "blob"
// import { Grid } from "grid"
import { House } from "house"
import { Mouse } from "mouse"
import { Network } from "network"
import { genColor } from "utils"


let dataset = [], blobs = [], grid, canvas, ctx, mouse, clock = performance.now(), fps, times = [], houses = []

let translateSpeed = 80 // pixels / second

const blobNumber = 3, inputsSize = 9, hiddensSize = [6, 4], outputsSize = 2
const fontSize = 16, fontFamily = 'monospace', fontStats = `${fontSize}px ${fontFamily}`
const TITLE_COLOR = 'hsla(40, 100%, 50%, 75%)',
      TITLE_FONT = '28px fantasy'
const TITLE = 'Neural Driving Blobs',
      DESCRIPTION = 'Blobs are progressively learning how to drive, their goal is to reach the cursor.',
      SUB_DESCRIPTION = 'Each blob has its own neurons and its own learnings.'

const draw = async () => {
	ctx.clearRect(0, 0, canvas.width, canvas.height)

	// Calculate stats
  const newClock = performance.now()
  while (times.length > 0 && times[0] <= newClock - 1000) {
    times.shift();
  }
  times.push(newClock);
  fps = times.length;

  // Draw Title
  ctx.beginPath()
	ctx.fillStyle = TITLE_COLOR
	ctx.font = TITLE_FONT
	ctx.textAlign = 'center'
	ctx.textBaseline = 'top'
	ctx.fillText(TITLE, canvas.width/2, 15)

  // Draw Description
	ctx.fillStyle = TITLE_COLOR
	ctx.font = fontStats
	ctx.textAlign = 'right'
	ctx.textBaseline = 'middle'
	ctx.fillText(DESCRIPTION, canvas.width - 50, canvas.height - 50)

  if(SUB_DESCRIPTION?.length) {
    ctx.fillStyle = TITLE_COLOR
    ctx.font = fontStats
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(SUB_DESCRIPTION, canvas.width - 50, canvas.height - 25)
  }
  ctx.closePath()

  updates(newClock - clock)

  houses.forEach(house => house.draw(ctx))

  // Draw Blobs
	blobs.forEach((blob, i) => {
    const otherBlobs = blobs.filter(otherBlob => otherBlob.id !== blob.id)
		blob.adapt(otherBlobs, mouse, houses)
		blob.move(newClock - clock, mouse, otherBlobs, houses)
		blob.draw(ctx, newClock - clock, mouse)
		blob.drawStats(ctx, i)
	})

  // Draw Mouse
	mouse.draw(ctx)

  // Draw Stats
  ctx.beginPath()
	ctx.fillStyle = TITLE_COLOR
	ctx.font = fontStats
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
	ctx.fillText(`FPS: ${Math.round(fps)}`, 50, canvas.height - 50)
  ctx.closePath()

	requestAnimationFrame(draw)
	clock = newClock
}

const updates = (delta) => {
  // Blob is Near the mouse ?
  const winners = blobs.filter(blob => blob.isNear(mouse) > .5)
  winners.forEach(blob => blob.score++)

  // Update Mouse
  if(mouse.x < 0 || winners.length > 0) mouse.randomizePosition(canvas)

  // Update Houses
  houses.forEach(house => house.randomizePosition(canvas))

  // Translate objects
  blobs.forEach(blob => blob.translate(-translateSpeed * delta/1000, 0))
  houses.forEach(house => house.translate(-translateSpeed * delta/1000, 0))
  mouse.translate(-translateSpeed * delta/1000, 0)
}



const main = async () => {
	mouse = new Mouse()

  houses.push(
    new House(Math.floor(Math.random() * window.innerWidth), Math.floor(Math.random() * window.innerHeight)),
    new House(Math.floor(Math.random() * window.innerWidth) + window.innerWidth, Math.floor(Math.random() * window.innerHeight)),
    new House(Math.floor(Math.random() * window.innerWidth) + window.innerWidth/3, Math.floor(Math.random() * window.innerHeight))
  )

	for(let i = 0; i < blobNumber; i++) {
		blobs.push(new Blob(blobs, inputsSize, hiddensSize, outputsSize, fontStats, fontSize, houses))
	}
	console.log(`${blobs.length} blobs created`)

	console.log('Start drawing scene')
	canvas = document.getElementById("canvas")
	ctx = canvas.getContext("2d")
	ctx.font = fontStats
	await onResize()
	draw()
}

const onResize = async () => {
	canvas.width = window.innerWidth
	canvas.height = window.innerHeight
}

const clickEvent = async (e) => {
	if(mouse && blobs.length > 0) {
		blobs.forEach(async (blob, i) => {
      blob.x = mouse.x
      blob.y = mouse.y
    })
	}
}

const mouseEvent = async (e) => {
	if(e && mouse) {
		mouse.x = e.clientX
		mouse.y = e.clientY
	}
}



window.addEventListener('resize', onResize)
window.addEventListener('click', clickEvent)
// window.addEventListener('mousemove', mouseEvent)


main()
