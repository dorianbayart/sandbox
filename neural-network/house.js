'use strict'

import { genColor } from "utils"

class House {
  RADIUS = 36

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
    ctx.beginPath()
    ctx.strokeStyle = '#222b'
    ctx.fillStyle = '#222b'

    // Set line width
    ctx.lineWidth = 2

    // Wall
    ctx.strokeRect(this.x - this.RADIUS/2 + this.RADIUS/8, this.y - this.RADIUS/4, this.RADIUS - this.RADIUS/4, this.RADIUS * 3/4)

    // Door
    ctx.strokeRect(this.x - this.RADIUS/6, this.y, this.RADIUS/3, this.RADIUS/2)

    // Roof
    ctx.moveTo(this.x - this.RADIUS/2, this.y - this.RADIUS/4)
    ctx.lineTo(this.x, this.y - this.RADIUS/2)
    ctx.lineTo(this.x + this.RADIUS/2, this.y - this.RADIUS/4)
    ctx.fill()
    ctx.closePath()

  }
}

export { House }
