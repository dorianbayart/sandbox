// Utils - Calculate a Hash of a String
const hashCode = (str) => {
	let hash = 0
	for (var i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash)
	}
	return hash
}

// Generate a HSL color using the Hash
const getColorFromString = (str) => {
	return `hsl(${hashCode(str) % 360}, 100%, 45%)`
}

// Generate a HSLA color using the Hash - with a transparency parameter [0, 1]
const getColorFromStringWithTransparency = (str, transparency) => {
	return `hsla(${hashCode(str) % 360}, 100%, 45%, ${transparency ?? 0.75})`
}

const getMousePos = (canvas, evt) => {
  var rect = canvas.getBoundingClientRect(), // abs. size of element
    scaleX = canvas.width / rect.width,    // relationship bitmap vs. element for x
    scaleY = canvas.height / rect.height;  // relationship bitmap vs. element for y

  return {
    x: (evt.clientX - rect.left) * scaleX,   // scale mouse coordinates after they have
    y: (evt.clientY - rect.top) * scaleY     // been adjusted to be relative to element
  }
}
