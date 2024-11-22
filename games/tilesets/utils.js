'use strict'

const loadAndSplitImage = (url, spriteSize) => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'

    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height

      const ctx = canvas.getContext('2d')
      ctx.drawImage(image, 0, 0)

      const spriteSheet = ctx.getImageData(0, 0, image.width, image.height)
      const sprites = Array.from({ length: Math.round(image.width/spriteSize) }, (_, i) => Array.from({ length: Math.round(image.height/spriteSize) }, (_, j) => 0))

      // Split the image into smaller subimages of spriteSizexspriteSize pixels
      for (let x = 0; x < image.width / spriteSize; x++) {
        for (let y = 0; y < image.height / spriteSize; y++) {
          sprites[x][y] = ctx.getImageData(x * spriteSize, y * spriteSize, spriteSize, spriteSize)
        }
      }

      resolve(sprites/*.filter(sprite => sprite.data.reduce((r, c) => r + c))*/)
    }

    image.onerror = reject
    image.src = url
  })
}