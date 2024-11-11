'use strict'



document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => document.querySelectorAll('body')[0].style.opacity = '1', 250)
  //document.querySelectorAll('body')[0].style.opacity = '1'

  const profilePicture = document.getElementById('profilePicture')
  profilePicture.addEventListener('canplay', () => {
    profilePicture.style.opacity = '1'
  }, true)
  profilePicture.addEventListener('loadedmetadata', () => {
    profilePicture.style.opacity = '1'
  }, true)

  const source = document.querySelectorAll('#profilePicture source')[0]
  source.addEventListener('error', () => {
    const img = document.querySelectorAll('#profilePicture img')[0]
    img.addEventListener('load', () => {
      img.parentElement.style.opacity = '1'
    }, true)
  }, true)


  const currentYear = new Date().getFullYear()
  document.getElementById('footer').innerHTML = `&copy; ${currentYear} - Made with &#9829; by <a href="https://github.com/dorianbayart" title="DorianBayart on GitHub">0xDBA</a>`
})
