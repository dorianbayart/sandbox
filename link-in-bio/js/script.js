'use strict'



document.addEventListener('DOMContentLoaded', () => {
  // Update the footer with the current year date
  const currentYear = new Date().getFullYear()
  document.getElementById('footer').innerHTML = `&copy; ${currentYear} - Made with &#9829; by <a href="https://github.com/dorianbayart" rel="me" title="DorianBayart on GitHub" target="_blank">0xDBA</a>`
})
