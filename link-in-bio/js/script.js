'use strict'



document.addEventListener('DOMContentLoaded', () => {
  // Defer the loading of the profile picture video
  const profilePic = document.getElementById('profilePictureWebm')
  profilePic.setAttribute('src', profilePic.getAttribute('data-src'))
  setTimeout(() => document.getElementById('profilePicture').load(), 750)

  // Update the footer with the current year date
  const currentYear = new Date().getFullYear()
  document.getElementById('footer').innerHTML = `&copy; ${currentYear} - Made with &#9829; by <a href="https://github.com/dorianbayart" rel="me" title="DorianBayart on GitHub" target="_blank">0xDBA</a>`
})
