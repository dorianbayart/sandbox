'use strict'

const fps = 25, fpsInverse = 1/fps
let lastUpdate = performance.now(), now

const bubbleSort = (arr) => {
  let len = arr.length;
  for (let i = 0; i < len; i++) {
    for (let j = 0; j < len - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        let temp = arr[j]
        arr[j] = arr[j + 1]
        arr[j + 1] = temp
        if(j % 5 === 0) {
          now = performance.now()
          if(now - lastUpdate > fpsInverse * 1000) {
            postMessage(arr)
            lastUpdate = now
          }
        }
      }
    }
  }

  return arr
}

self.onmessage = (event) => {
  const { data, operation } = event.data

  if (operation === 'bubbleSort') {
    postMessage(bubbleSort(data))
    postMessage('end')
  }
}
