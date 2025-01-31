"use strict";

const tutorialSteps = [
  {
    text: "Welcome to Minimalist Tower War !",
    condition: ({ levelStartTime }) => performance.now() - levelStartTime > 4000, // Wait for 4 seconds
  },
  {
    text: "Drag-and-drop from your blue tower to a free tower to send units and capture it !",
    condition: ({ links }) => links.length > 0, // Check if a link has been created
  },
  {
    text: "Great ! Units will now move along the path and attack the enemy tower.",
    condition: ({ towers }) =>
        towers.some(tower => tower.player !== 0 && tower.level === 8) // A free tower level has decreased to 8
        || towers.filter(tower => tower.player === 0).length > 1, // or a tower has been captured
  },
  {
    text: "Drag-and-drop across a path to delete it.",
    condition: ({ links }) => links.length === 0, // Check if Player deleted all links
  },
  {
    text: "Awesome ! Create paths to capture other towers.",
    condition: ({ links }) => links.length > 0, // Check if a link has been created
  },
  {
    text: "Your units are attacking the tower to capture it ! Watch the tower level decrease !",
    condition: ({ towers, links }) => links.length > 0 && towers.filter(tower => tower.player === 0).length > 1, // A tower has been captured and links exist
  },
  {
    text: "Congrats ! Be the first to capture all the towers on the map !",
    condition: ({ towers }) => towers.some(tower => tower.player === 0 && tower.level >= 15), // A tower reaches level 15
  },
  {
    text: "A tower has reached level 15 ! Create a second path from it !",
    condition: ({ towers }) => towers.some(tower => tower.player === 0 && tower.level >= 40), // A tower reaches level 40
  },
  {
    text: "The higher the level, the greater the number of paths allowed from a tower.",
    condition: ({ towers }) => towers.some(tower => tower.player === 0 && tower.level >= 60), // A tower reaches level 60
  },
  // End of tutorial
];

export default tutorialSteps;
