export { clearPathCache, searchPath }

'use strict'

import { getMapDimensions } from 'dimensions'
import gameState from "state"

/**
 * Choose the pathfinding algorithm: [aStar, bestFirstSearch]
 * The searchPath function is a proxy to the real pathfinding algorithm
 */
const searchPath = aStar

const pathCache = new Map()
const PATH_CACHE_MAX_SIZE = 2500
// const { width: MAP_WIDTH, height: MAP_HEIGHT, maxWeight: MAX_WEIGHT } = getMapDimensions()

/**
 * Function to create a unique cache key from start and end points
 * This key is used to store complete paths in a cache
 */
const getCacheKey = (startX, startY, endX, endY) => {
  return `${startX},${startY}-${endX},${endY}`;
}

/** Clean the paths cache stored in a Map */
function clearPathCache() {
  pathCache.clear();
}

/** Returns a unique cache key for the specified coordinates */
const getNodeKey = (x, y) => y * getMapDimensions().width + x | 0

/** Simple Manhattan distance heuristic */
const getHeuristic = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

/** Check if coords are in bounds */
const isInBounds = (x, y) => x >= 0 && x < getMapDimensions().width && y >= 0 && y < getMapDimensions().height

/** Check if a cell is a wall */
const isWall = (x, y) => {
  if (!isInBounds(x, y)) return true

  // Only consider maximum weight as walls, not buildings (2047) or trees (255)
  return (gameState.map[x][y]?.weight || 0) === getMapDimensions().maxWeight
}

/**
 * A* pathfinding algorithm implementation
 * Finds the shortest path between two points on the map accounting for obstacles and terrain costs.
 * Uses a binary heap for performance optimization and caches results for repeated queries.
 * 
 * @param {number} startX - Starting X coordinate
 * @param {number} startY - Starting Y coordinate
 * @param {number} endX - Destination X coordinate
 * @param {number} endY - Destination Y coordinate
 * @returns {Array|null} Array of path nodes or null if no path found
 */
function aStar(startX, startY, endX, endY) {
  // Check cache first
  const cacheKey = getCacheKey(startX, startY, endX, endY);
  if (pathCache.has(cacheKey)) {
    return [...pathCache.get(cacheKey)]; // Return a copy to prevent modification
  }

  // Early exit
  if(isWall(startX, startY) || isWall(endX, endY)) return

  // // For straight line paths, try to use direct path
  // if (startX === endX || startY === endY) {
  //   // Check if there are any obstacles between start and end
  //   let hasObstacle = false

  //   // Check points along the line between start and end
  //   const dx = endX - startX
  //   const dy = endY - startY
  //   const steps = Math.max(Math.abs(dx), Math.abs(dy))
    
  //   if (steps > 1) {
  //     for (let i = 1; i < steps; i++) {
  //       const x = Math.floor(startX + dx * (i / steps))
  //       const y = Math.floor(startY + dy * (i / steps))
        
  //       if ((gameState.map[x][y]?.weight || 0) > 10) {
  //         hasObstacle = true
  //         break
  //       }
  //     }
  //   }
    
  //   // Only use direct path if there are no obstacles
  //   if (!hasObstacle) {
  //     return [
  //       { x: startX, y: startY, weight: gameState.map[startX][startY].weight },
  //       { x: endX, y: endY, weight: gameState.map[endX][endY].weight }
  //     ]
  //   }
  // }
  
  // Binary heap helper functions
  const heapPush = (heap, node) => {
    heap.push(node)
    let current = heap.length - 1

    while (current > 0) {
      const parent = Math.floor((current - 1) / 2)
      if (heap[parent].f <= heap[current].f) break
      [heap[parent], heap[current]] = [heap[current], heap[parent]]
      current = parent
    }
  }

  const heapPop = (heap) => {
    const result = heap[0]
    const last = heap.pop()
    if (heap.length === 0) return result

    heap[0] = last
    let current = 0

    while (true) {
      let smallest = current
      const left = 2 * current + 1
      const right = 2 * current + 2

      if (left < heap.length && heap[left].f < heap[smallest].f) smallest = left
      if (right < heap.length && heap[right].f < heap[smallest].f) smallest = right

      if (smallest === current) break
      [heap[current], heap[smallest]] = [heap[smallest], heap[current]]
      current = smallest
    }

    return result
  }

  const neighbors = (x, y) => {
    let neighbors = [
      { x: x + 1, y: y },
      { x: x - 1, y: y },
      { x: x, y: y - 1 },
      { x: x, y: y + 1 },
    ] // E W N S

    // if ((x + y) % 2 == 0) neighbors.reverse() // S N W E

    return neighbors.filter(
      (neighbor) => {
        if (isWall(neighbor.x, neighbor.y)) return false
        return !closedList[getNodeKey(neighbor.x, neighbor.y)]
      }
    )
  }

  const mapSize = getMapDimensions().width * getMapDimensions().height
  const openList = []
  const closedList = new Uint8Array(mapSize)
  const gScores = new Uint32Array(mapSize)
  gScores.fill(getMapDimensions().maxWeight) // Max value for Uint32Array represents "infinity"

  let startNode = { x: startX, y: startY }
  let endNode = { x: endX, y: endY }
  startNode.g = 0
  startNode.h = getHeuristic(startNode, endNode)
  startNode.f = startNode.g + startNode.h

  // Initialize search
  heapPush(openList, startNode)
  gScores[getNodeKey(startX, startY)] = startNode.g

  while (openList.length > 0 && openList.length < mapSize) {
    const current = heapPop(openList)

    if (current.x === endX && current.y === endY) {
      let path = []
      let node = current

      while (node) {
        path.unshift({ x: node.x, y: node.y, weight: gameState.map[node.x][node.y].weight })
        node = node.parent
      }

      // If a path is found, cache it before returning
      if (path) {
        // Manage cache size
        if (pathCache.size >= PATH_CACHE_MAX_SIZE) {
          // Remove oldest entry
          const firstKey = pathCache.keys().next().value;
          pathCache.delete(firstKey);
        }
        
        pathCache.set(cacheKey, [...path]); // Store a copy
      }

      return path
    }
    
    const currentKey = getNodeKey(current.x, current.y)

    // If already processed, skip
    if (closedList[currentKey]) continue

    // Mark as closed
    closedList[currentKey] = 1

    // Calculate heuristic when adding neighbors
    const currentNeighbors = neighbors(current.x, current.y)
    for (let neighbor of currentNeighbors) {
        const gScore = current.g + (gameState.map[neighbor.x][neighbor.y]?.weight || 1) | 0
        const nodeKey = getNodeKey(neighbor.x, neighbor.y)

        if (gScore < gScores[nodeKey]) {
            gScores[nodeKey] = gScore

            // Update neighbor node
            neighbor.g = gScore
            neighbor.h = getHeuristic(neighbor, endNode)
            neighbor.f = neighbor.g + neighbor.h
            neighbor.parent = current

            // Add to open list
            heapPush(openList, neighbor)
        }
    }
  }

  return null // no path found
}


/**
 * @deprecated
 * BestFirstSearch pathfinding algorithm implementation
 * A greedy algorithm that explores paths that appear closest to the goal first.
 * Less accurate than A* but can be faster in some scenarios.
 * 
 * This is not optimized at all - and maybe not functionnal anymore
 * 
 * @param {number} startX - Starting X coordinate
 * @param {number} startY - Starting Y coordinate
 * @param {number} endX - Destination X coordinate
 * @param {number} endY - Destination Y coordinate
 * @returns {Array|null} Array of path nodes or null if no path found
 */
function bestFirstSearch(startX, startY, endX, endY) {
  const startTime = performance.now()
  const mapSize = MAP_HEIGHT * MAP_WIDTH
  const openList = []
  const closedList = new Map()

  // Early exits
  if(!isInBounds(startX, startY) || !isInBounds(endX, endY)) return
  if(isWall(startX, startY) || isWall(endX, endY)) return

  // Binary heap helper functions
  const heapPush = (heap, node) => {
    heap.push(node)
    let current = heap.length - 1

    while (current > 0) {
      const parent = Math.floor((current - 1) / 2)
      if (heap[parent].h <= heap[current].h) break
      [heap[parent], heap[current]] = [heap[current], heap[parent]]
      current = parent
    }
  }

  const heapPop = (heap) => {
    const result = heap[0]
    const last = heap.pop()
    if (heap.length === 0) return result

    heap[0] = last
    let current = 0

    while (true) {
      let smallest = current
      const left = 2 * current + 1
      const right = 2 * current + 2

      if (left < heap.length && heap[left].h < heap[smallest].h) smallest = left
      if (right < heap.length && heap[right].h < heap[smallest].h) smallest = right

      if (smallest === current) break
      [heap[current], heap[smallest]] = [heap[smallest], heap[current]]
      current = smallest
    }

    return result
  }

  const neighbors = (x, y) => {
    let neighbors = [
      { x: x + 1, y: y },
      { x: x - 1, y: y },
      { x: x, y: y - 1 },
      { x: x, y: y + 1 },
    ] // E W N S

    if ((x + y) % 2 == 0) neighbors.reverse() // S N W E

    return neighbors.filter(
      (neighbor) =>
        isInBounds(neighbor.x, neighbor.y) &&
        !isWall(neighbor.x, neighbor.y) &&
        !closedList.has(getNodeKey(neighbor.x, neighbor.y))
    )
  }

  let startNode = { x: startX, y: startY }
  let endNode = { x: endX, y: endY }
  startNode.h = getHeuristic(startNode, endNode)
  heapPush(openList, startNode)

  while (openList.length > 0 && openList.length < mapSize) {
    const current = heapPop(openList)

    if (current.x === endX && current.y === endY) {
      let path = [current]

      while (path[0].x !== startX || path[0].y !== startY) {
        for (let [_, node] of closedList) {
          if (getHeuristic(node, path[0]) === 1) {
            path.unshift({ x: node.x, y: node.y, weight: gameState.map[node.x][node.y].weight })
            break
          }
        }
      }

      return path
    }

    closedList.set(getNodeKey(current.x, current.y), current)

    // Calculate heuristic when adding neighbors
    const newNeighbors = neighbors(current.x, current.y)
    for (let neighbor of newNeighbors) {
      neighbor.h = getHeuristic(neighbor, endNode)
      heapPush(openList, neighbor)
    }
  }

  console.log("No path found - time spent " + (performance.now() - startTime) + "ms")
  return null
}