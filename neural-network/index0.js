'use strict'

import { v4 as uuidv4 } from 'uuid'
import { Blob } from "blob"
import { Grid } from "grid"
import { Mouse } from "mouse"
import { Network } from "network"
import { genColor } from "utils"


let dataset = [], blobs = [], grid, canvas, ctx, mouse, clock = performance.now(), fps, times = [], houses = []

let translateSpeed = 125 // pixels / second

const blobNumber = 3, inputsSize = 3, hiddensSize = [6, 4], outputsSize = 2
const fontSize = 16, fontFamily = 'monospace', fontStats = `${fontSize}px ${fontFamily}`

const TITLE = 'Neural Driving Blobs',
      DESCRIPTION = 'Blobs are progressively learning how to drive, their goal is to reach the cursor.',
      SUB_DESCRIPTION = 'Each blob has its own neurons and its own learnings.'


class House {
  constructor(x, y) {
    this.x = x
    this.y = y
  }

  translate = (x, y) => {
		this.x += x
		this.y += y
	}

  randomizePosition = (canvas) => {
		if(this.x < -50) {
			this.x += Math.floor(canvas.width + Math.random() * canvas.width/3),
			this.y = Math.floor(Math.random()*canvas.height)
		}
	}

  draw = (ctx) => {
    ctx.strokeStyle = '#222b'

    // Set line width
    ctx.lineWidth = 2

    // Wall
    ctx.strokeRect(this.x + 7.5, this.y + 14, 15, 11)

    // Door
    ctx.fillRect(this.x + 13, this.y + 19, 4, 6)

    // Roof
    ctx.beginPath()
    ctx.moveTo(this.x + 5, this.y + 14)
    ctx.lineTo(this.x + 15, this.y + 6)
    ctx.lineTo(this.x + 25, this.y + 14)
    ctx.closePath()
    ctx.stroke()
  }
}


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
	ctx.fillStyle = 'hsla(40, 100%, 50%, 75%)'
	ctx.font = '28px fantasy'
	ctx.textAlign = 'center'
	ctx.textBaseline = 'top'
	ctx.fillText(TITLE, canvas.width/2, 15)

  // Draw Description
	ctx.fillStyle = 'hsla(40, 100%, 50%, 75%)'
	ctx.font = fontStats
	ctx.textAlign = 'right'
	ctx.textBaseline = 'middle'
	ctx.fillText(DESCRIPTION, canvas.width - 50, canvas.height - 50)

  if(SUB_DESCRIPTION?.length) {
    ctx.fillStyle = 'hsla(40, 100%, 50%, 75%)'
    ctx.font = fontStats
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(SUB_DESCRIPTION, canvas.width - 50, canvas.height - 25)
  }

  updates(newClock - clock)

  houses.forEach(house => house.draw(ctx))

  // Draw Blobs
	blobs.forEach((blob, i) => {
		blob.adapt(blobs, mouse)
		blob.move(newClock - clock, mouse, blobs)
		blob.draw(ctx, newClock - clock, mouse)
		blob.drawStats(ctx, i)
	})

  // Draw Mouse
	mouse.draw(ctx)

  // Draw Stats
	ctx.fillStyle = 'hsla(40, 100%, 50%, 75%)'
	ctx.font = fontStats
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
	ctx.fillText(`FPS: ${Math.round(fps)}`, 50, canvas.height - 50)

	requestAnimationFrame(draw)
	clock = newClock
}

const updates = (delta) => {
  // Blob is Near the mouse ?
  const winners = blobs.filter(blob => blob.isNear(mouse) > .5)
  winners.forEach(blob => blob.score++)

  // Update Mouse
  if(mouse.x < canvas.width / 5 || winners.length > 0) mouse.randomizePosition(canvas)

  // Update Houses
  houses.forEach(house => house.randomizePosition(canvas))

  // Translate objects
  blobs.forEach(blob => blob.translate(-translateSpeed * delta/1000, 0))
  houses.forEach(house => house.translate(-translateSpeed * delta/1000, 0))
  mouse.translate(-translateSpeed * delta/1000, 0)
}



const main = async () => {
	mouse = new Mouse()

	for(let i = 0; i < blobNumber; i++) {
		blobs.push(new Blob(blobs, inputsSize, hiddensSize, outputsSize, fontStats, fontSize))
	}
	console.log(`${blobs.length} blobs created`)

  houses.push(
    new House(Math.floor(Math.random() * window.innerWidth), Math.floor(Math.random() * window.innerHeight)),
    new House(Math.floor(Math.random() * window.innerWidth) + window.innerWidth, Math.floor(Math.random() * window.innerHeight)),
    new House(Math.floor(Math.random() * window.innerWidth) + window.innerWidth/3, Math.floor(Math.random() * window.innerHeight))
  )

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
window.addEventListener('mousemove', mouseEvent)


main()
