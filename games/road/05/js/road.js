// A winding road generated from a seed. Positions along the road are measured by
// the distance d = -y. The centre line is a sum of sines with unrelated wavelengths:
// smooth, infinite, never repeating, and nothing to store.
// The difficulty sets the shape of the curves: wide and gentle, medium, or tight with
// twisty stretches and a road that gets narrower and wider. "Progressive" starts easy,
// then turns medium, then hard along the race.
import { mulberry32, hashSeed } from './rng.js';
import { smoothstep } from './geometry.js';

export const LANE_COUNT = 5;
export const LANE_WIDTH = 56;          // Normal lane width; "hard" roads vary around it
export const SEGMENT = 30;             // Border segment length used by sensors
const SEGMENT_OFFSET = 64;             // Segments behind the start (rays looking back) are cached too
const STRAIGHT_START = 1500;           // Curves fade in over this distance
const TAU = Math.PI * 2;

export const DIFFICULTIES = ["easy", "medium", "hard", "progressive"];

// waves: [amplitude, wavelength] of the centre line. twist: the shortest wave of "hard"
// comes and goes, giving calm stretches and twisty ones. width: [relative change,
// wavelength] of the lane width.
// Every difficulty also gets two long waves of big amplitude: wide sweeping bends under
// the smaller curves. Long enough to stay gentle (they add little steepness).
const BIG_WAVES = [[320, 10000], [170, 5200]];
const SHAPES = {
    easy: { waves: [...BIG_WAVES, [90, 2600], [40, 1300]], twist: 0, width: [] },
    medium: { waves: [...BIG_WAVES, [110, 1900], [50, 830], [18, 370]], twist: 0, width: [] },
    hard: { waves: [...BIG_WAVES, [110, 2000], [50, 750], [20, 300]], twist: 3200, width: [[0.12, 1700], [0.06, 650]] },
};

// "Progressive": the distances where the road is easy, then medium, then hard
// (with smooth transitions in between)
const PROGRESSIVE_MEDIUM = [3000, 5000];   // Easy → medium between these distances
const PROGRESSIVE_HARD = [8000, 10000];    // Medium → hard

class Shape {
    constructor(definition, rand) {
        this.waves = definition.waves.map(([amp, length]) => ({
            amp,
            length: length * (0.85 + rand() * 0.3),
            phase: rand() * TAU,
        }));
        this.twist = definition.twist ? { length: definition.twist * (0.85 + rand() * 0.3), phase: rand() * TAU } : null;
        this.width = definition.width.map(([amp, length]) => ({
            amp,
            length: length * (0.85 + rand() * 0.3),
            phase: rand() * TAU,
        }));
    }

    x(d) {
        let x = 0;
        const last = this.waves.length - 1;
        for (let i = 0; i <= last; i++) {
            const w = this.waves[i];
            let amp = w.amp;
            if (i === last && this.twist) {
                amp *= 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(d / this.twist.length * TAU + this.twist.phase));
            }
            x += amp * (Math.sin(d / w.length * TAU + w.phase) - Math.sin(w.phase));
        }
        return x;
    }

    // Relative change of the lane width (0 = normal width)
    widthChange(d) {
        let change = 0;
        for (const w of this.width) change += w.amp * Math.sin(d / w.length * TAU + w.phase);
        return change;
    }
}

function blend(d, [from, to]) {
    if (d <= from) return 0;
    if (d >= to) return 1;
    return smoothstep((d - from) / (to - from));
}

export class Road {
    constructor(seed, difficulty = "medium") {
        this.seed = seed;
        this.difficulty = DIFFICULTIES.includes(difficulty) ? difficulty : "medium";
        this.laneCount = LANE_COUNT;
        // "medium" draws from the seed itself, the others from a seed of their own
        const shape = name => new Shape(SHAPES[name],
            name === "medium" ? mulberry32(seed) : mulberry32(hashSeed(seed, DIFFICULTIES.indexOf(name) + 101)));
        if (this.difficulty === "progressive") {
            this.easy = shape("easy");
            this.medium = shape("medium");
            this.hard = shape("hard");
        } else {
            this.single = shape(this.difficulty);
        }
        this.segments = [];        // Border segments, computed once per road (index i + SEGMENT_OFFSET)
    }

    centerX(d) {
        if (d <= 0) return 0;
        const ramp = d >= STRAIGHT_START ? 1 : smoothstep(d / STRAIGHT_START);
        if (this.single) return this.single.x(d) * ramp;
        const toMedium = blend(d, PROGRESSIVE_MEDIUM), toHard = blend(d, PROGRESSIVE_HARD);
        let x;
        if (toHard > 0) x = (1 - toHard) * this.medium.x(d) + toHard * this.hard.x(d);
        else if (toMedium < 1) x = (1 - toMedium) * this.easy.x(d) + toMedium * this.medium.x(d);
        else x = this.medium.x(d);
        return x * ramp;
    }

    // Lane width at distance d
    laneWidth(d) {
        const hard = this.single ? (this.difficulty === "hard" ? this.single : null) : this.hard;
        if (!hard || d <= 0) return LANE_WIDTH;
        const weight = (this.single ? 1 : blend(d, PROGRESSIVE_HARD)) * (d >= STRAIGHT_START ? 1 : smoothstep(d / STRAIGHT_START));
        return weight > 0 ? LANE_WIDTH * (1 + weight * hard.widthChange(d)) : LANE_WIDTH;
    }

    halfWidth(d) {
        return this.laneCount * this.laneWidth(d) / 2;
    }

    // Heading a car needs to follow the road at distance d
    heading(d) {
        return Math.atan((this.centerX(d + 1) - this.centerX(d - 1)) / 2);
    }

    laneX(lane, d) {
        return this.centerX(d) + this.laneWidth(d) * (lane + 0.5 - this.laneCount / 2);
    }

    isOffRoad(x, y) {
        return Math.abs(x - this.centerX(-y)) > this.halfWidth(-y);
    }

    // Left and right border segments number i, i.e. between d = i*SEGMENT and (i+1)*SEGMENT
    segment(i) {
        let seg = this.segments[i + SEGMENT_OFFSET];
        if (!seg) {
            const d0 = i * SEGMENT, d1 = d0 + SEGMENT;
            const c0 = this.centerX(d0), c1 = this.centerX(d1);
            const h0 = this.halfWidth(d0), h1 = this.halfWidth(d1);
            seg = {
                left: [c0 - h0, -d0, c1 - h1, -d1],
                right: [c0 + h0, -d0, c1 + h1, -d1],
            };
            if (i + SEGMENT_OFFSET >= 0) this.segments[i + SEGMENT_OFFSET] = seg;
        }
        return seg;
    }
}
