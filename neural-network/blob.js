'use strict'

import { genColor } from "utils"
import { Network } from "network"

const BLOB_MAX_SPEED = 400 // pixels / seconds
const BLOB_ACCELERATION = BLOB_MAX_SPEED / 3 // pixels / seconds / seconds
const BLOB_DIRECTION_SPEED = Math.PI // radians / seconds
const DATASET_SIZE = 400, TRAINING_ITERATIONS = 800

const INITIAL_TRAINING = false, DEBUG = false, DRAW_SENSORS = false

const SENSOR_LEFT_ANGLE = -Math.PI/2.5,
			SENSOR_RIGHT_ANGLE = Math.PI/2.5,
			SENSOR_FRONT_LEFT_ANGLE = -Math.PI/6,
			SENSOR_FRONT_RIGHT_ANGLE = Math.PI/6,
			SENSOR_FRONT_FRONT_LEFT_ANGLE = -Math.PI/20,
			SENSOR_FRONT_FRONT_RIGHT_ANGLE = Math.PI/20

class Blob {
	RADIUS = 15

	constructor(otherBlobs, inputsSize, hiddensSize, outputsSize, font, fontSize, houses = []) {
		this.id = otherBlobs.length + 1
		this.COLOR = genColor(this.id * 2 + '0')
		this.font = font
		this.fontSize = fontSize

		this.maxSpeed = Math.floor(Math.random()*(BLOB_MAX_SPEED*.25) + BLOB_MAX_SPEED*.75)

		this.x = Math.floor(Math.random() * window.innerWidth)
		this.y = Math.floor(Math.random() * window.innerHeight)
		this.moveX = 0
		this.moveY = 0
		this.direction = Math.random() * Math.PI * 2 - Math.PI
		this.speed = 0
		this.sensors = [
			{
				angle: SENSOR_LEFT_ANGLE,
				distance: this.RADIUS * 4,
				detection: .05
			},
			{
				angle: SENSOR_RIGHT_ANGLE,
				distance: this.RADIUS * 4,
				detection: .05
			},
			{
				angle: SENSOR_FRONT_LEFT_ANGLE,
				distance: this.RADIUS * 6,
				detection: .05
			},
			{
				angle: SENSOR_FRONT_RIGHT_ANGLE,
				distance: this.RADIUS * 6,
				detection: .05
			},
			{
				angle: SENSOR_FRONT_FRONT_LEFT_ANGLE,
				distance: this.RADIUS * 8,
				detection: .05
			},
			{
				angle: SENSOR_FRONT_FRONT_RIGHT_ANGLE,
				distance: this.RADIUS * 8,
				detection: .05
			}]

		this.score = 0

		this.dataset = []
		this.trainingIterations = 0

		this.delta = {x: 0, y: 0}

		this.network = new Network(inputsSize, hiddensSize, outputsSize)

		if(INITIAL_TRAINING) {
			for(let i = -1, l = (DATASET_SIZE > 300 ? 100 : DATASET_SIZE / 2); ++i < l; ) {
				this.direction = Math.random() * Math.PI * 2 - Math.PI
				this.addData(otherBlobs, {x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight}, houses)
			}
			this.train(TRAINING_ITERATIONS > 300 ? 100 : (TRAINING_ITERATIONS / 2))
		}
	}

	toString = () => `${this.id} | ${this.dataset.length} dataset size | Training: ${this.trainingIterations} iterations | Speed: ${Math.round(this.speed)} | Score: ${this.score}`

	isNear = (goal) => (goal.x - this.x)*(goal.x - this.x) + (goal.y - this.y)*(goal.y - this.y) < (this.RADIUS + (goal.PERIMETER ?? 0)) * (this.RADIUS + (goal.PERIMETER ?? 0)) ? 0.99 : 0.01

	addData = (blobs, mouse, houses) => {
		function sigmoid(x) { return 1 / (1 + Math.exp(-x)) }

		let x = this.x
		let y = this.y
		let deltaX = (mouse.x - x)/window.innerWidth
		let deltaY = (mouse.y - y)/window.innerHeight

		while (deltaX > 1 || deltaY > 1) {
			deltaX *= .9
			deltaY *= .9
		}

		let normalisedSpeed = sigmoid(5*Math.sqrt(deltaX*deltaX + deltaY*deltaY)) * 2 - 1

		const sensors = this.getSensors(blobs, houses)

		let directionGoal = Math.atan2(deltaY, deltaX)
		let deltaDirection = (directionGoal - this.direction)
		if(deltaDirection < -Math.PI) deltaDirection += 2*Math.PI
		else if(deltaDirection > Math.PI) deltaDirection -= 2*Math.PI

		sensors.forEach(sensor => {
			if(sensor.detection > .5) {
				deltaDirection += -sensor.angle * 1.25 //(Math.random()/2 + .75)
				normalisedSpeed *= Math.sin(Math.abs(sensor.angle))
				//normalisedSpeed *= 0.75
			}
		})

		let commandDirection = sigmoid(deltaDirection)

		this.dataset.push({
			inputs: [
				deltaX,
				deltaY,
				this.direction / (2 * Math.PI) + .5,
				...this.sensors.map(sensor => sensor.detection)
			],
			outputs: [
				commandDirection,
				normalisedSpeed
			]
		})
		if(this.dataset.length > DATASET_SIZE) this.dataset = this.dataset.slice(1)
	}

	getSensors = (blobs, houses) => {
		const sensors = this.sensors
		sensors.forEach(sensor => {
			sensor.detection = .05

			for(let i = -1, n = 4; ++i < n;) {
				const sensorX = this.x + sensor.distance * Math.cos(this.direction + sensor.angle) / i
				const sensorY = this.y + sensor.distance * Math.sin(this.direction + sensor.angle) / i

				blobs/*.filter(blob => blob.id !== this.id)*/.forEach(blob => {
					const d = Math.sqrt((blob.x - sensorX)*(blob.x - sensorX) + (blob.y - sensorY)*(blob.y - sensorY))
					if(d <= blob.RADIUS * Math.sqrt(2)) sensor.detection = .95
				})
				houses.forEach(house => {
					const d = Math.sqrt((house.x - sensorX)*(house.x - sensorX) + (house.y - sensorY)*(house.y - sensorY))
					if(d <= house.RADIUS * Math.sqrt(2)) sensor.detection = .95
				})
			}
		})

		return sensors
	}

	train = async (iterations) => {
		if(iterations) this.trainingIterations += iterations
		this.network.train(this.dataset, iterations)
	}

	adapt = async (blobs, mouse, houses) => {
		const random = Math.random()
		if(random > (this.trainingIterations < TRAINING_ITERATIONS ? 0.25 : .05)) return

		this.addData(blobs, mouse, houses)
		if(this.network.iterations === 0) this.train(Math.ceil(random*5))
	}

	translate = (x, y) => {
		this.x += x
		this.y += y
	}

	move = (delta, mouse, blobs, houses) => {
		this.sensors = this.getSensors(blobs, houses)

		const movement = this.network.activate(
			[
				(mouse.x - this.x)/window.innerWidth,
				(mouse.y - this.y)/window.innerHeight,
				this.direction / (2 * Math.PI) + .5,
				...this.sensors.map(sensor => sensor.detection)
			]
		)

		this.speed = /*(movement[1] - 0.5) * 2*/ movement[1] * this.maxSpeed
		//if(this.speed < 0) this.speed = 0

		let commandDirection = (movement[0] - 0.5) * 2
		this.direction += ((Math.abs(commandDirection) > BLOB_DIRECTION_SPEED * delta / 1000) ? Math.sign(commandDirection) * BLOB_DIRECTION_SPEED * delta / 1000 : commandDirection) * this.speed/this.maxSpeed
		if(this.direction > Math.PI) this.direction -= 2 * Math.PI
		if(this.direction < -Math.PI) this.direction += 2 * Math.PI

		this.delta.x = Math.cos(this.direction) * this.speed * delta / 1000
		this.delta.y = Math.sin(this.direction) * this.speed * delta / 1000

		this.x += this.delta.x
		this.y += this.delta.y
	}

	draw = (ctx, delta, mouse) => {
		ctx.lineWidth = 1


		ctx.save()
		ctx.translate(this.x, this.y);
    ctx.rotate(this.direction);
    ctx.fillStyle = this.COLOR // body car
		ctx.fillRect(-this.RADIUS, -this.RADIUS * 0.6, this.RADIUS * 2, this.RADIUS * 2 * 0.6)
		ctx.fillStyle = '#222b' // wheels
		ctx.fillRect(-this.RADIUS - this.RADIUS/3, -this.RADIUS * 0.6 - this.RADIUS/3, this.RADIUS/1.5, this.RADIUS/1.8) // rear left
		ctx.fillRect(this.RADIUS - this.RADIUS/3, -this.RADIUS * 0.6 - this.RADIUS/3, this.RADIUS/1.5, this.RADIUS/1.8) // front left
		ctx.fillRect(this.RADIUS - this.RADIUS/3, this.RADIUS * 0.6 - this.RADIUS/3, this.RADIUS/1.5, this.RADIUS/1.8) // front right
		ctx.fillRect(-this.RADIUS - this.RADIUS/3, this.RADIUS * 0.6 - this.RADIUS/3, this.RADIUS/1.5, this.RADIUS/1.8) // rear right
		ctx.fill()
		ctx.restore()
		ctx.closePath()

		// Draw sensors
		if(DRAW_SENSORS) {
			this.sensors.forEach(sensor => {
				ctx.beginPath()
				ctx.moveTo(this.x, this.y)
				ctx.lineTo(this.x + sensor.distance * Math.cos(this.direction + sensor.angle), this.y + sensor.distance * Math.sin(this.direction + sensor.angle))
				ctx.strokeStyle = sensor.detection > .5 ? '#dddb' : '#222b'
				ctx.stroke()
				ctx.closePath()
			})
		}

		if(DEBUG) {
			let x = this.x
			let y = this.y
			let direction = this.direction
			let sensors = this.sensors

			ctx.beginPath()
			ctx.moveTo(x, y)

			for(let j = -1, l = 50000/this.maxSpeed; ++j < l; ) {
				const movement = this.network.activate(
					[
						(mouse.x - x)/window.innerWidth,
						(mouse.y - y)/window.innerHeight,
						direction / (2 * Math.PI) + .5,
						...sensors.map(sensor => sensor.detection)
					]
				)
				let speed = (movement[1] - 0.5) * 2 * this.maxSpeed
				if(speed < 0) speed = 0

				let commandDirection = (movement[0] - 0.5) * 2
				direction += ((Math.abs(commandDirection) > BLOB_DIRECTION_SPEED * delta / 1000) ? Math.sign(commandDirection) * BLOB_DIRECTION_SPEED * delta / 1000 : commandDirection) * speed/this.maxSpeed
				if(direction > Math.PI) direction -= 2 * Math.PI
				if(direction < -Math.PI) direction += 2 * Math.PI

				let deltaX = Math.cos(direction) * speed * delta / 1000
				let deltaY = Math.sin(direction) * speed * delta / 1000

				x += deltaX
				y += deltaY

				ctx.lineTo(x + deltaX * this.RADIUS, y + deltaY * this.RADIUS)
			}

			ctx.strokeStyle = '#222b'
			ctx.stroke()
			ctx.closePath()
		}

		ctx.beginPath()
		ctx.fillStyle = '#222b'
		ctx.font = this.font
		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'
		ctx.fillText(this.id, this.x, this.y + this.fontSize/10)
		ctx.closePath()
	}

	drawStats = (ctx, i) => {
		ctx.beginPath()
		ctx.fillStyle = this.COLOR
		ctx.font = this.font
		ctx.textAlign = 'left'
		ctx.textBaseline = 'center'
		ctx.fillText(this.toString(), 50, 75 + (this.fontSize + 8)*i)
		ctx.closePath()
	}
}

export { Blob }
