'use strict'

const workerThread = async (array) => {
  const worker = new Worker('worker.js')

  worker.postMessage({ data: array, operation: 'bubbleSort' })

  worker.onmessage = (event) => {
    if(event.data === 'end') return
    requestAnimationFrame(() => draw(event.data))
  }
}

document.getElementById('startBtn').addEventListener('click', () => {
  const n = parseInt(document.getElementById('lengthParameter').value)
  const arrayToSort = [...Array(n)].map(() => Math.round(Math.random() * n))

  if (window.Worker) {
    canvasInitialization(arrayToSort)
    setTimeout(() => workerThread(arrayToSort), 500)
  } else {
    document.getElementById('result').innerHTML = 'HTML5 web workers are not supported on this browser.'
  }
})
