'use strict'

class Mouse {
	RADIUS = 10
	PERIMETER = 2.5 * this.RADIUS
	COLOR = 'hsla(40, 100%, 50%, 75%)'

	constructor() {
		this.x = window.innerWidth / 2
		this.y = window.innerHeight / 2
	}

	draw = (ctx, font) => {
		ctx.beginPath()
		ctx.arc(this.x, this.y, this.RADIUS, 0, Math.PI * 2, false)
		ctx.fillStyle = this.COLOR
		ctx.fill()
		ctx.closePath()

		ctx.beginPath()
		ctx.arc(this.x, this.y, this.PERIMETER, 0, Math.PI * 2, false)
		ctx.strokeStyle = this.COLOR
		ctx.stroke()
		ctx.closePath()

		ctx.beginPath()
		ctx.fillStyle = this.COLOR
		ctx.font = font
		ctx.fillText(`Cursor: ${Math.round(this.x)},${Math.round(this.y)}`, 50, window.innerHeight - 25)
		ctx.closePath()
	}

	randomizePosition = (canvas) => {
		this.x = Math.floor(Math.random()*canvas.width * 9/10 + canvas.width/5),
		this.y = Math.floor(Math.random()*canvas.height)
	}

	translate = (x, y) => {
		this.x += x
		this.y += y
	}
}

export { Mouse }
