(async () => {
  'use strict'

  const canvas = document.getElementById('sierpinski')
  if(!canvas) return
  const ctx = canvas.getContext('2d')

  const padding = 4

  //ctx.beginPath()
  ctx.fillStyle = 'transparent'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const sierpinski = async (Ax, Ay, Bx, By, Cx, Cy, d) => {
    if(d > 0) {
        sierpinski(Ax,Ay, (Ax + Cx) / 2, (Ay + Cy) / 2, (Ax + Bx) / 2,(Ay + By) / 2, d-1)
        sierpinski((Ax + Bx) / 2, (Ay + By) / 2, (Bx + Cx) / 2, (By + Cy) / 2, Bx, By, d-1)
        sierpinski((Ax + Cx) / 2, (Ay + Cy) / 2, (Bx + Cx) / 2, (By + Cy) / 2, Cx, Cy, d-1)
    }
    else {
        ctx.moveTo(Ax, Ay)
        ctx.lineTo(Bx, By)
        ctx.lineTo(Cx, Cy)
        ctx.lineTo(Ax, Ay)
    }
  }

  // Draw the Sierpinski triangle
  sierpinski(padding, canvas.height - padding, canvas.width - padding, canvas.height - padding, (canvas.width - padding)/2, padding, 8)

  ctx.fillStyle = 'white'
  ctx.fill()
  ctx.strokeStyle = 'darkolivegreen'
  ctx.lineWidth = .5
  ctx.stroke()
})()
