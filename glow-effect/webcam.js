(async () => {
  'use strict'

  const stream = async () => {
    const media = navigator.mediaDevices
    const videoElement = document.getElementById('webcam')
    if(!videoElement) return

    try {
      const stream = await media.getUserMedia({ video: true })
      videoElement.srcObject = stream
      videoElement.play()
    } catch(error) {
      console.log("Error accessing webcam:", error)
    }
  }

  stream()
})()
