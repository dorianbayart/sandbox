# Neural Lab

A lab to watch a genetic algorithm train small neural networks to drive, and to see how
the network size changes the learning. Same idea as [Neural Race 2](../04/), rewritten
from scratch as a training tool.

## How it learns

- **A car**: rays measure how close the road borders and the traffic are, plus the car's
  own speed. In front, a fan of 7 to 15 rays, like an eye: long (880 px) and close
  together in the middle to see far ahead, short (220 px) and further apart on the sides,
  where they only need to see the next lanes. Far ahead, they stay about one lane apart.
  Plus 8 short rays: ±90° (70 px) and ±120° (85 px) for the blind spots, a traffic car
  alongside or catching up while the AI slows down (they reach the far side of the next
  lane and no further: longer, they would mostly see the road border, which the fan
  already sees); ±160° (100 px) and ±175° (150 px) behind, to reverse safely.
- **Cut-ins**: two inputs read the traffic indicators, like a driver who sees the car in
  front about to change lane: a traffic car in the next lane on the left (or right),
  alongside or up to 500 px ahead, signalling towards the AI's lane or already moving into
  it. The value is how close it is (1 alongside, 0 at 500 px or none). Their weights start
  at 0 in a new training, so that mutations bring them in only when they help.
  A first version gave each ray the indicator of the car it hit (15 inputs): the networks
  did not learn to use them in 60 generations, and drove less well than networks that
  could not see the indicators at all (validation −15%).
- **Outputs**: throttle, brake (stopped, holding the brake reverses; the throttle then
  brakes) and steering. The AIs are racers: no indicator of their own.
- **Memory** (0 to 3 neurons): extra outputs fed back as inputs at the next step. Nothing
  tells the network what to keep there; evolution finds out (a trend, a state…).
- **A race**: the whole population starts together on the same road with the same
  traffic (both generated from a seed), driving through each other. A car is out when
  it leaves the road, touches a traffic car (any contact, even a traffic car running into
  it from behind: traffic ignores the AIs, so a car that lags gets caught up and must keep
  up or move aside), makes no progress for 3 s, or averages under 15% of
  its max speed over 5 s. These last two rules are lenient on purpose: slowing down to get
  round a group of cars stays possible, and different driving styles can appear. The race
  has a fixed length, so a slow car already scores less.
- **Fitness**: the distance reached, averaged over the tracks of the generation.
- **Validation**: the best car of each generation also drives alone on 3 fixed tracks
  never used for training (the same for every training). A car can be the best of its
  generation just because its track was easy; the validation score tells how well it
  drives anywhere. It picks the champion, and it is the curve to compare trainings with.
  There is one champion per track difficulty (a score on easy tracks says nothing about
  hard ones); the display and `Export` show the one of the selected difficulty.
- **Next generation**: the best ones are kept unchanged (elites), the others are
  children of two parents picked by tournament (best of 3 at random), mixing their
  parameters (uniform crossover), then mutated: a few parameters (*changes per child*, on
  average) move by a gaussian step of *size*. The size starts big to explore, decreases
  at each generation to fine-tune, and stops at a minimum so evolution never freezes.

## Things to try

- **Network size** (default `8, 8, 6`, 9 rays in front, 2 memory neurons, population 300,
  10 elites, 10 changes per child): compare with `8, 6`, no hidden layer, `3`, `16` or `32, 32`, on the
  same seed. The chart keeps the validation of your previous trainings as dashed lines. On this task the
  small networks learn faster: every extra parameter makes the search space bigger.
- **Same tracks every generation**: the fitness climbs more smoothly, but an exported
  champion may then drive badly on new tracks (overfitting).
- **Mutation**: the `?` buttons explain both settings. Changes per child: about 3 to 10;
  the rate (changes ÷ parameters) follows the network size. To fine-tune an exported
  champion, import it with a small size (0.1) and no decrease.
- **Population and elites**: bigger populations explore more but each generation takes
  longer; with 0 elites, the best brain can be lost.
- **Track difficulty** (above the track): every road has two long, wide bends (waves of
  320 and 170 px over about 10,000 and 5,000 px) under its smaller curves; then *easy*
  (gentle curves), *medium*, *hard*
  (tight curves, twisty stretches, lanes from 46 to 66 px wide instead of 56) or
  *progressive* (easy, then medium from 3,000 px, hard from 8,000 px). It applies from the
  next race, validation included, without restarting: train on easy, then switch to hard.
  The run label lists the difficulties used.

## Display

- The champion (green car) drives every training race with the generation, to compare
  them on the same road and traffic. It is not part of the population and the race does
  not wait for it; *Champion, this race* shows how far it got.
- `+` next to the generation: runs at full speed to the start of the next generation
  (click several times to skip several), even while paused.
- Zoom with the mouse wheel or a two-finger pinch, from ×4 down to the whole race (start
  to race limit); double-click resets it. Zoomed out, the camera no longer slides sideways
  (it stays on the middle of the road) and cars become dots.

## Simulation

- Fixed time step: one step = 1/60 s of simulation, whatever the screen refresh rate.
  ×1 is real time; ×10, ×100 and Max run more steps per frame (Max ≈ 100× real time). Hide the track at high speed: all the time then goes to training.
- The simulation (`js/road.js`, `traffic.js`, `car.js`, `network.js`, `genetics.js`,
  `race.js`, `trainer.js`) does not touch the page: it can run headless in Node or a Web Worker.
- Winding road (sum of sines), 5 lanes, traffic generated row by row, denser with
  distance. Rows appear far ahead, and also enter from behind the start: a car slower
  than the traffic gets caught up and never ends up alone on an empty road. Each traffic car has its own speed (dark red = slow, light red = fast), sorted
  by lane: slow cars on the outer lanes, fast ones in the middle. It slows down behind a
  slower car, overtakes towards the centre lane when there is room, then goes back to
  its lane. Every 10 to 30 s (per driver), it also changes lane for no visible reason, and
  stays there 5 to 10 s: surprises for the AIs. Before any lane change, a traffic car turns
  its indicator on for 2 to 3.5 s (each driver its own delay, plus about 1 s during the
  move), then moves if there is still room, or gives up 3 s later.
  Where more than 6 cars share 1,000 px, the oldest car of an outer lane takes
  an exit (indicator on first): it leaves the road on its side and fades out on the roadside (cars never
  vanish on the road), so no long platoons build up late in the race.
  Traffic never closes all 5 lanes, and it ignores the AI cars: it only depends on the
  seed and the time, so every AI of a race meets the same traffic.

## Exported brains

`Export` saves the champion as JSON:

```json
{
  "format": "neural-race-brain", "version": 1, "physics": "lab05-8",
  "inputs": {
    "rays": 9, "sideRays": 8,
    "rayAngles": [-3.0543, -2.7925, -2.0944, -1.5708, -1.0472, -0.6421, -0.3223, ...],
    "rayLengths": [150, 100, 85, 70, 220, 319, 536, ...],
    "speed": true, "cutIns": ["cut-in left", "cut-in right"], "memory": 2
  },
  "outputs": ["throttle", "brake", "steering", "memory1", "memory2"], "activation": "tanh",
  "shape": [22, 8, 8, 6, 5], "fitness": 9000, "validationDifficulty": "medium", "generation": 30,
  "genome": [ ... ]
}
```

Ray angles are in radians from left to right, relative to the car. The inputs are the rays,
the speed, the two `cutIns`, then the `memory` values (the memory outputs of the previous step, 0 at the start).
`fitness` is the average distance on the validation tracks, of the difficulty
`validationDifficulty`. The genome lists, layer by layer, the weights (`weights[out * inputs + in]`) then the
biases. A brain only drives well in the simulation that trained it: `physics` changes
whenever the physics, sensors or inputs change, and `Import` refuses another version.

## Run

Any static server from the repository root, e.g. `python3 -m http.server`, then
http://localhost:8000/games/road/05/.
