'use strict'

import { Neuron } from "neuron"

class Network {

	constructor(inputsNumber, hiddensNumber = [4], outputsNumber) {
		this.iterations = 0
		
		this.inputs = Array.from(Array(inputsNumber), () => new Neuron()) // Input Layer
		this.hiddens = Array.from(Array(hiddensNumber.length), (n, i) => Array.from(Array(hiddensNumber[i]), () => new Neuron())) // Hidden Layer
		this.outputs = Array.from(Array(outputsNumber), () => new Neuron()) // Output Layer

		// Connect Input Layer to first Hidden Layer
		this.inputs.forEach(neuron => this.hiddens[0].forEach(hidden => neuron.connect(hidden)))

		// Connect Hidden Layer to next Hidden Layer
		for (let layer = 0; layer < this.hiddens.length - 1; layer++) {
			this.hiddens[layer].forEach(hiddenIn => this.hiddens[layer + 1].forEach(hiddenOut => hiddenIn.connect(hiddenOut)))
		}

		// Connect last Hidden Layer to Output Layer
		this.hiddens[this.hiddens.length - 1].forEach(hidden => this.outputs.forEach(output => hidden.connect(output)))
	}

	neuronsNumber = () => {
		return this.inputs.length + this.hiddens.reduce((acc, layer) => layer.length + acc, 0) + this.outputs.length
	}

	activate = (input) => {
		this.inputs.forEach((neuron, i) => neuron.activate(input[i]))
		this.hiddens.forEach(hiddensLayer => hiddensLayer.forEach(neuron => neuron.activate()))
		return this.outputs.map(neuron => neuron.activate())
	}

	propagate = (target) => {
		this.outputs.forEach((neuron, t) => neuron.propagate(target[t]))
		for (let layer = this.hiddens.length - 1; layer > -1; layer--) {
			this.hiddens[layer].forEach(neuron => neuron.propagate())
		}
		return this.inputs.forEach(neuron => neuron.propagate())
	}

	train = async (dataset, iterations) => {
		if(iterations) this.iterations += iterations

		while(this.iterations > 0) {
			dataset.map(datum => {
				this.activate(datum.inputs)
				this.propagate(datum.outputs)
			})

			this.iterations--
		}
	}
}

export { Network }
