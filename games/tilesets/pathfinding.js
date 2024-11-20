'use strict'

const bestFirstSearch = (map, startX, startY, endX, endY) => {
  const openList = []
  const closedList = []
  const weights = [1]

  const getHeuristic = (a, b) => {
    // Manhattan distance heuristic
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
  }

  const isInBounds = (x, y) => {
    return x >= 0 && x < map.length && y >= 0 && y < map[0].length
  }

  const isWall = (x, y) => {
    return map[x][y]?.weight === 99999999
  }

  const neighbors = (x, y) => {
    let neighbors = [
      { x: x+1, y: y, weight: map[x+1] ? map[x+1][y].weight : null },
      { x: x-1, y: y, weight: map[x-1] ? map[x-1][y].weight : null },
      { x: x, y: y-1, weight: map[x][y-1]?.weight },
      { x: x, y: y+1, weight: map[x][y+1]?.weight }
    ] // E W N S
    if ((x + y) % 2 == 0) neighbors.reverse() // S N W E
    neighbors = neighbors.filter(neighbor => isInBounds(neighbor.x, neighbor.y))
    neighbors = neighbors.filter(neighbor => !isWall(neighbor.x, neighbor.y))
    neighbors = neighbors.filter(neighbor => !closedList.some(node => node.x === neighbor.x && node.y === neighbor.y))
    return neighbors
  }

  let startNode = { x: startX, y: startY, weight: map[startY][startX].weight }
  let endNode = { x: endX, y: endY, weight: map[endY][endX].weight }

  openList.push(startNode)

  while (openList.length > 0 && openList.length < map.length * map[0].length) {
    let current = openList[0]

    for (let i = 1; i < openList.length; i++) {
      if (getHeuristic(openList[i], endNode) < getHeuristic(current, endNode)) {
        current = openList[i]
      }
    }

    if (current.x === endX && current.y === endY) {
      let path = [current]

      while (path[0].weight !== startNode.weight) {
        let index = -1

        for (let i = 0; i < openList.length; i++) {
          if (openList[i].x === path[0].x && openList[i].y === path[0].y) {
            index = i
            break
          }
        }

        path.unshift(openList[index])
      }

      return path
    }

    openList.splice(openList.indexOf(current), 1)
    closedList.push(current)

    openList.push(...neighbors(current.x, current.y))

    // for (let x = -1; x <= 1; x++) {
    //   for (let y = -1; y <= 1; y++) {
    //     let nx = current.x + x
    //     let ny = current.y + y
    //
    //     if (isInBounds(nx, ny) && !isWall(nx, ny)) {
    //       let weight = map[ny][nx].weight
    //
    //       if (!closedList.some(node => node.x === nx && node.y === ny)) {
    //         openList.push({ x: nx, y: ny, weight: weight })
    //       }
    //     }
    //   }
    // }
  }

  console.log(openList)
  return null
}
