'use strict'

import { v4 as uuidv4 } from 'uuid'

function Neuron(bias, rate) {
  this.id = uuidv4()

  this.bias = bias ?? Math.random() * 2 - 1 // [-1 ; 1]
  this.rate = rate ?? Math.random() * 0.15 + 0.05 // [0.05 ; 0.20]
  this.squash
  this.cost

  this.sigmoidParameter = 1

  this.incoming = {
    targets: {},
    weights: {}
  }
  this.outgoing = {
    targets: {},
    weights: {}
  }

  this._output // f'(x)
  this.output // f(x)
  this.error // E'(f(x))
  this._error// E(f(x))

  this.connect = function(neuron, weight) {
    this.outgoing.targets[neuron.id] = neuron
    neuron.incoming.targets[this.id] = this
    this.outgoing.weights[neuron.id] = neuron.incoming.weights[this.id] = weight ?? Math.random() * 2 - 1
  }

  this.activate = function(input) {
  	const sigmoidParameter = this.sigmoidParameter
    const self = this

    function sigmoid(x) { return 1 / (1 + Math.exp(-x/sigmoidParameter)) } // f(x)
    function _sigmoid(x) { return sigmoid(x) * (1 - sigmoid(x)) } // f'(x)

    if(input != undefined) {
      this._output = 1 // f'(x)
      this.output = input // f(x)
    } else {
      // Σ (x • w)
      const sum = Object.keys(this.incoming.targets).reduce(function(total, target, index) {
        return total += self.incoming.targets[target].output * self.incoming.weights[target]
      }, this.bias)

      this._output = _sigmoid(sum) // f'(x)
      this.output = sigmoid(sum) // f(x)
    }

    return this.output
  }

  this.propagate = function(target, rate = this.rate) {
    const self = this

    //𝛿E /𝛿squash
    const sum = target == undefined ? Object.keys(this.outgoing.targets).reduce(function(total, target, index) {
        // Δweight
        self.outgoing.targets[target].incoming.weights[self.id] = self.outgoing.weights[target] -= rate * self.outgoing.targets[target].error * self.output

        return total += self.outgoing.targets[target].error * self.outgoing.weights[target]
      }, 0) : this.output - target

    // 𝛿squash/𝛿sum
    this.error = sum * this._output

    // Δbias
    this.bias -= rate * this.error

    return this.error
  }
}

export { Neuron }
