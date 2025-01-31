"use strict";

const levels = [
  // Level 1: Tutorial level (no AI)
  {
    description: 'Tutorial',
    towers: [
      { x: 20, y: 15, radius: 2.5, level: 5, player: 0 },
      { x: 40, y: 20, radius: 2.5, level: 15 },
      { x: 60, y: 40, radius: 2.5, level: 15 },
      { x: 65, y: 18, radius: 2.5, level: 15 },
      { x: 85, y: 25, radius: 2.5, level: 25 },
      { x: 80, y: 35, radius: 2.5, level: 25 },
    ],
    links: [],
  },

  // Level 2: Easy level (1 AI player)
  {
    description: '1 AI Player',
    towers: [
      { x: 10, y: 10, radius: 2.5, level: 5, player: 0 },
      { x: 50, y: 10, radius: 2.5, level: 5, player: 1 },
      { x: 25, y: 30, radius: 2.5, level: 2 },
      { x: 35, y: 35, radius: 2.5, level: 2 },
    ],
    links: [],
  },

  // Level 3: Easy level (1 AI player)
  {
    towers: [
      { x: 5, y: 5, radius: 2.5, level: 10, player: 0 },
      { x: 25, y: 10, radius: 2.5, level: 5 },
      { x: 15, y: 15, radius: 2.5, level: 5 },
      { x: 45, y: 5, radius: 2.5, level: 5, player: 1 },
      { x: 35, y: 20, radius: 2.5, level: 5 },
    ],
    links: [],
  },

  // Level 4: Easy level (1 AI player)
  {
    towers: [
      { x: 10, y: 10, radius: 2.5, level: 5, player: 0 },
      { x: 50, y: 10, radius: 2.5, level: 5 },
      { x: 30, y: 20, radius: 2.5, level: 5 },
      { x: 30, y: 40, radius: 2.5, level: 5, player: 1 },
    ],
    links: [],
  },

  // Level 5: Easy level (1 AI player)
  {
    towers: [
      { x: 10, y: 10, radius: 2.5, level: 5, player: 0 },
      { x: 90, y: 10, radius: 2.5, level: 5, player: 1 },
      { x: 50, y: 20, radius: 2.5, level: 5 },
      { x: 10, y: 50, radius: 2.5, level: 5 },
      { x: 90, y: 50, radius: 2.5, level: 5 },
      { x: 50, y: 40, radius: 2.5, level: 5 },
    ],
    links: [],
  },

  // Level 6: Medium level (1 AI player)
  {
    towers: [
      { x: 10, y: 10, radius: 2.5, level: 5, player: 0 },
      { x: 90, y: 10, radius: 2.5, level: 5, player: 1 },
      { x: 50, y: 20, radius: 2.5, level: 5 },
      { x: 10, y: 50, radius: 2.5, level: 5 },
      { x: 90, y: 50, radius: 2.5, level: 5, player: 1 },
      { x: 50, y: 40, radius: 2.5, level: 5 },
    ],
    links: [],
  },

  // Level 7: Medium level (1 AI player)
  {
    towers: [
      { x: 10, y: 10, radius: 2.5, level: 5, player: 0 },
      { x: 90, y: 10, radius: 2.5, level: 5, player: 1 },
      { x: 50, y: 20, radius: 2.5, level: 5 },
      { x: 10, y: 50, radius: 2.5, level: 5 },
      { x: 90, y: 50, radius: 2.5, level: 2 },
      { x: 50, y: 40, radius: 2.5, level: 2 },
    ],
    links: [],
  },

  // Level 8: Medium level (1 AI player)
  {
    towers: [
      { x: 10, y: 10, radius: 2.5, level: 5, player: 0 },
      { x: 90, y: 10, radius: 2.5, level: 10, player: 1 },
      { x: 50, y: 20, radius: 2.5, level: 5 },
      { x: 10, y: 50, radius: 2.5, level: 5 },
      { x: 90, y: 50, radius: 2.5, level: 5 },
      { x: 50, y: 40, radius: 2.5, level: 5 },
    ],
    links: [],
  },

  // Level 9: Medium level (1 AI player)
  {
    towers: [
      { x: 10, y: 10, radius: 2.5, level: 5, player: 0 },
      { x: 90, y: 10, radius: 2.5, level: 25, player: 1 },
      { x: 50, y: 20, radius: 2.5, level: 5 },
      { x: 10, y: 50, radius: 2.5, level: 5 },
      { x: 90, y: 50, radius: 2.5, level: 5 },
      { x: 50, y: 40, radius: 2.5, level: 5 },
    ],
    links: [],
  },

  // Level 10: Medium level (2 AI players)
  {
    description: '2 AI players',
    towers: [
      { x: 10, y: 10, radius: 2.5, level: 5, player: 0 },
      { x: 90, y: 10, radius: 2.5, level: 5, player: 1 },
      { x: 50, y: 20, radius: 2.5, level: 10, player: 2 },
      { x: 10, y: 50, radius: 2.5, level: 5 },
      { x: 90, y: 50, radius: 2.5, level: 5 },
      { x: 50, y: 40, radius: 2.5, level: 5 },
    ],
    links: [],
  },

  // Level 7: Hard level (2 AI players)
  {
    towers: [
      { x: 5, y: 10, radius: 2.5, level: 10, player: 0 },
      { x: 25, y: 25, radius: 2.5, level: 5 },
      { x: 70, y: 30, radius: 2.5, level: 5 },
      { x: 30, y: 60, radius: 2.5, level: 5 },
      { x: 80, y: 70, radius: 2.5, level: 5 },
      { x: 100, y: 55, radius: 2.5, level: 5 },
      { x: 135, y: 65, radius: 2.5, level: 10, player: 1 },
      { x: 45, y: 95, radius: 2.5, level: 1 },
      { x: 95, y: 15, radius: 2.5, level: 5, player: 2 },
      { x: 110, y: 80, radius: 2.5, level: 5 },
    ],
    links: [],
  },
];

export default levels;
