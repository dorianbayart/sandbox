export { getTile, getTileSize, MAP_HEIGHT, MAP_WIDTH, MAX_WEIGHT }

'use strict'

import { SPRITE_SIZE } from 'sprites'


//const MAP_WIDTH = (globalThis.innerWidth > globalThis.innerHeight ? globalThis.innerWidth / SPRITE_SIZE * 1.25 : globalThis.innerHeight /1.5 / SPRITE_SIZE) / 2 | 0
// const MAP_WIDTH = window.innerWidth > window.innerHeight ? 48 : 24
// const MAP_HEIGHT = MAP_WIDTH * window.innerHeight / window.innerWidth | 0
const MAP_WIDTH = window.innerWidth * (window.devicePixelRatio || 1) / SPRITE_SIZE | 0
const MAP_HEIGHT = window.innerHeight * (window.devicePixelRatio || 1) / SPRITE_SIZE | 0
const MAX_WEIGHT = 99999999

console.log(`Map: ${MAP_WIDTH} x ${MAP_HEIGHT}`)

/**
 * Returns the tile at the specified coordinates.
 */
const getTile = (x, y) => map[x]?.[y]

/**
 * Returns the size of a tile in pixels.
 */
const getTileSize = () => SPRITE_SIZE

