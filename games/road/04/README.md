# Neural Race 2

Self-driving cars learn to race and overtake on a winding, procedurally generated road.
A follow-up of [Neural Race](../03/): same custom neural network and genetic learning,
on a harder track.

## What's new compared to version 3

**Road**
- 5 lanes instead of 3.
- Winding road: the centre line is a sum of sines with unrelated wavelengths, so it is
  smooth, infinite, never repeating and nothing has to be stored. A new road on every
  load; replay one with `?seed=123` (the seed is printed in the console).
- The first 1500px are straight, curves fade in after that.

**Traffic**
- Generated row by row: a row never blocks every lane, and one of its free lanes is
  always next to a free lane of the previous row, so the road is always passable.
- Rows get denser and closer together with distance (max difficulty at 20000px).
- Traffic follows its lane along the curves.

**AI**
- 7 rays with a 120° spread (sees the neighbouring lanes), 220px long.
- The network also gets the car's own speed: 8 inputs → 8 → 6 → 4 outputs.
- Selection pressure to overtake: a car whose average speed (over ~2s) drops under
  60% of its max speed is eliminated, so cars that stay stuck behind traffic do not
  pass their brain on.
- Continuous learning: a dead car is replaced at once by a mutated copy of the best
  brain, spawned just behind the lead car on a free spot.
- "Generation" is the lineage depth of the current best brain.

**Game**
- The camera follows the AI lead until an arrow key is pressed, then the blue car.
- The player and the AI cars drive through each other; only traffic and borders hurt.
- Every car moves once per frame (version 3 moved them twice).
- The best brain is saved in `localStorage` (`neuralRace04.*`, separate from version 3,
  whose network has another shape). 💾 Save / 🗑️ Discard work as before.

## Run

Open `index.html` through any static server, e.g. `python3 -m http.server` from the
repository root, then http://localhost:8000/games/road/04/.
