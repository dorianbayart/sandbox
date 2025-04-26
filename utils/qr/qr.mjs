'use strict'

let qrCode
const qrParams = {
  level: 'L',
  size: 180,
  value: ''
}

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('qr-value').value = window.location

  qrParams.level = document.getElementById('qr-error-correction').value
  qrParams.size = document.getElementById('qr-size').value
  qrParams.value = document.getElementById('qr-value').value

  document.getElementById('qr-error-correction').addEventListener('change', (e) => {
    qrCode.level = document.getElementById('qr-error-correction').value
    exportQr()
  })

  document.getElementById('qr-size').addEventListener('keyup', (e) => {
    qrCode.size = document.getElementById('qr-size').value
    exportQr()
  })

  document.getElementById('qr-size').addEventListener('change', (e) => {
    qrCode.size = document.getElementById('qr-size').value
    exportQr()
  })

  document.getElementById('qr-value').addEventListener('keyup', (e) => {
    qrCode.value = document.getElementById('qr-value').value
    exportQr()
  })

  document.getElementById('qr-value').addEventListener('change', (e) => {
    qrCode.value = document.getElementById('qr-value').value
    exportQr()
  })

  qrCode = new QRious({
    element: document.getElementById('qr'),
    level: qrParams.level,
    size: qrParams.size,
    value: qrParams.value
  })

  exportQr()
})

const exportQr = async () => {
  try {

    const data = qr.toDataURL() // => "data:image/png;base64,iVBOR...Fz6l6nn0AAAAAElFTkSuQmCC"
    // const data = document.getElementById('qr').toDataURL('image/png') 
    // console.log(data)

    setTimeout(exportQrAsSvg, 40)

  } catch(e) {
    console.log(e)
  }
}

const exportQrAsSvg = async () => {
  const canvas = document.getElementById('qr')
  const ctx = canvas.getContext('2d')
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = new Uint32Array(imageData.data)

  // Assume black pixels are module boundaries
  let svgString = `<svg width="${canvas.width}" height="${canvas.height}">`

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const index = (y * canvas.width + x) * 4 // 4 bytes per pixel (RGBA)
      if (data[index] === 0) { // Black pixel (assuming black is 0)
        // Draw a path for the module boundary
        svgString += `<path d="M ${x} ${y} L ${x} ${y + 1} L ${x + 1} ${y} L ${x} ${y + 1} Z" fill="none" stroke="black" stroke-width="1"/>`
      }
    }
  }

  svgString += `</svg>`

  // Draw SVG on HTML
  document.getElementById('svg-content').innerHTML = svgString
}