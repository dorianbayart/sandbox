'use strict'



document.addEventListener('DOMContentLoaded', () => {

  // Reveal hidden items progressively
  document.querySelectorAll('*[style="opacity: 0"]').forEach((item, i) => {
    setTimeout(() => revealObject(item), (i+1) * 75)
  })
  

  // Update the footer with the current year date
  const currentYear = new Date().getFullYear()
  document.getElementById('footer').innerHTML = `&copy; ${currentYear} - Made with &#9829; by <a href="https://github.com/dorianbayart" title="DorianBayart on GitHub">0xDBA</a>`
})

// Reveal function
const revealObject = async (htmlObject) => {
  htmlObject.style.opacity = '1'
}

const profilePicture = document.getElementById('profilePicture')

// Periodically check the Video state object to reveal it when it's ready
const timer = setInterval(() => {
  if(profilePicture.currentTime > 0 || profilePicture.readyState > 0) {
    revealObject(profilePicture)
    clearInterval(timer)
  }
}, 400)

const source = document.querySelectorAll('#profilePicture source')[0]
source.addEventListener('error', () => {
  console.debug('Error Event')
  const img = document.querySelectorAll('#profilePicture img')[0]
  img.addEventListener('load', () => {
    console.debug('Img Loaded Event')
    revealObject(img.parentElement)
  })
})

source.addEventListener('stalled', () => {
  console.debug('Stalled Event')
  const img = document.querySelectorAll('#profilePicture img')[0]
  img.addEventListener('load', () => {
    console.debug('Img Loaded Event')
    revealObject(img.parentElement)
  })
})