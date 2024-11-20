'use strict'



const fetchList = async () => {
  const data = await(await fetch('list.json')).json()
  return { list: data.svg, link: data.link }
}

const displaySvgs = async (svgs) => {
  for (const [i, svg] of svgs.entries()) {
    setTimeout(() => displaySvg(svg), i * 125)
  }
}

const displaySvg = async (svg) => {
  const div = document.getElementById('svg-list')
  const img = document.createElement('img')
  img.src = `assets/${svg.link}`
  img.alt = svg.name
  img.title = svg.name
  div.appendChild(img)
}

const displayLink = async (link) => {
  const div = document.getElementById('svg-link')
  const a = document.createElement('a')
  a.href = link
  a.innerHTML = 'Link to SVG Repo'
  a.target = '_blank'
  div.appendChild(a)
}

(async () => {
  const { list, link } = await fetchList()
  console.log(list, link)

  displaySvgs(list)
  displayLink(link)
})()
