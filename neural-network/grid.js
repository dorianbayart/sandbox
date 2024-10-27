'use strict'

import { genColor } from "utils"

class Wall {
	COLOR = '#fa8072dd'

	constructor(m, n, w, h) {
		this.m = m // column
		this.n = n // line
		this.w = w // pixels
		this.h = h // pixels
	}

	draw = (ctx) => {
		ctx.beginPath()
		ctx.rect(this.m * this.w, this.n * this.h, this.w, this.h)
		ctx.fillStyle = this.COLOR
		ctx.fill()
		ctx.closePath()
	}
}

class Grid {

	constructor(m, n, nb) {
		this.m = m // column
		this.n = n // line

		this.walls = []

		this.wallsInitialize(nb)
	}

	wallsInitialize = (nb) => {
		let i = 0
		while(i < nb) {
			const x = Math.floor(Math.random() * this.m)
			const y = Math.floor(Math.random() * this.n)
			if(this.walls.filter(wall => wall.m === x && wall.n === y).length === 0) {
				this.walls.push(new Wall(x, y, window.innerWidth / this.m, window.innerHeight / this.n))
				i++
			}
		}
	}

	hasWallAround = (x, y, d = 1) => {
		// Search for walls around the (x, y) position in pixels
		// d is the distance detection in pixels
		// return an array [left, top, right, bottom] of 0 or 1 value
		d *= 1.1
		const left = this.walls.find(wall => x - d > (wall.m)*wall.w && x - d <= (wall.m + 1)*wall.w && y >= wall.n*wall.h && y < (wall.n + 1)*wall.h) ? .95 : .05
		const right = this.walls.find(wall => x + d >= (wall.m)*wall.w && x + d < (wall.m + 1)*wall.w && y >= wall.n*wall.h && y < (wall.n + 1)*wall.h) ? .95 : .05
		const bottom = this.walls.find(wall => x >= (wall.m)*wall.w && x < (wall.m + 1)*wall.w && y + d >= wall.n*wall.h && y + d < (wall.n + 1)*wall.h) ? .95 : .05
		const top = this.walls.find(wall => x >= (wall.m)*wall.w && x < (wall.m + 1)*wall.w && y - d > wall.n*wall.h && y - d <= (wall.n + 1)*wall.h) ? .95 : .05
		return [left, top, right, bottom]
	}

	draw = (ctx) => {
		this.walls.forEach(wall => wall.draw(ctx))
	}


}

export { Grid }
