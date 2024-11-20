'use strict'


const setupCanvas = (canvas, canvasRef) => {
  // Get the device pixel ratio, falling back to 1.
  var dpr = window.devicePixelRatio || 1;

  if(canvasRef) {
    canvas.width = canvasRef.width;
    canvas.height = canvasRef.height;
  } else {
    // Get the size of the canvas in CSS pixels.
    var rect = (canvasRef ?? canvas).getBoundingClientRect();
    // Give the canvas pixel dimensions of their CSS
    // size * the device pixel ratio.
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
  }

  var ctx = canvas.getContext('2d');
  // Scale all drawing operations by the dpr, so you
  // don't have to worry about the difference.
  ctx.scale(dpr, dpr);
  return ctx;
}
