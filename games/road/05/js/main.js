// Neural Lab: settings, fixed-step loop, display, history of trainings, export/import
import { Trainer } from './trainer.js';
import { Network } from './network.js';
import { PHYSICS_VERSION, MAX_SPEED, OUTPUTS, CUT_IN_INPUTS, rayLayout, inputCount, networkShape } from './car.js';
import { drawTrack, drawNetwork, drawChart, zoomRange, RUN_COLORS } from './render.js';

const $ = id => document.getElementById(id);
const STEPS_PER_SECOND = 60;   // Simulated steps per second at ×1
const FRAME_BUDGET_MS = 12;    // Simulation time allowed per displayed frame
const FRAME_BUDGET_MAX_MS = 40; // At "Max": the display only needs a few frames per second
const RUNS_KEY = "neuralLab05.runs2"; // runs2: concentrated rays and validation
const MAX_RUNS = 8;

let trainer = null;
let currentRun = null;
let runs = loadRuns();
let speed = 1;                 // Steps ×1, ×10, ×100, or Infinity for "Max"
let paused = false;
let skipTo = 0;                // "+": run at full speed up to this generation
let zoom = 1;                  // Track view: 1 = normal, smaller = zoomed out

// ---------- Settings ----------
function parseHidden(text) {
    const parts = text.split(/[\s,;]+/).filter(Boolean);
    if (parts.length > 4) throw new Error("At most 4 hidden layers.");
    const sizes = parts.map(Number);
    if (sizes.some(n => !Number.isInteger(n) || n < 1 || n > 64)) {
        throw new Error("Hidden layers: whole numbers between 1 and 64, separated by commas.");
    }
    return sizes;
}

function intField(id, min, max) {
    const value = Number($(id).value);
    if (!Number.isFinite(value) || value < min || value > max) {
        throw new Error(`${$(id).closest("label").firstChild.textContent.trim()}: between ${min} and ${max}.`);
    }
    return value;
}

function readConfig() {
    const populationSize = Math.round(intField("population", 10, 300));
    return {
        hidden: parseHidden($("hidden").value),
        rays: Number($("rays").value),
        memory: Number($("memory").value),
        populationSize,
        elites: Math.min(Math.round(intField("elites", 0, 20)), populationSize),
        changesPerChild: intField("changesPerChild", 0.5, 100),
        sigmaStart: intField("sigmaStart", 0.05, 3),
        sigmaDecay: intField("sigmaDecay", 0, 50) / 100,
        sigmaMin: intField("sigmaMin", 0, 3),
        tracksPerGeneration: Number($("tracks").value),
        sameTracks: $("sameTracks").checked,
        episodeSteps: Math.round(intField("episodeSeconds", 10, 300) * STEPS_PER_SECOND),
        seed: Math.round(intField("seed", 1, 2 ** 31)),
        difficulty: $("difficulty").value,
    };
}

function updatePreview() {
    try {
        const shape = networkShape(Number($("rays").value), parseHidden($("hidden").value), Number($("memory").value));
        const params = Network.paramCount(shape);
        $("shapePreview").textContent = shape.join("→");
        $("paramPreview").textContent = params;
        const rate = Math.min(1, Number($("changesPerChild").value) / params);
        $("ratePreview").textContent = Number.isFinite(rate) ? rate.toPrecision(2) : "?";
        $("sigmaPreview").textContent = sigmaSummary();
        $("error").textContent = "";
    } catch (e) {
        $("shapePreview").textContent = "?";
        $("paramPreview").textContent = "?";
        $("ratePreview").textContent = "?";
        $("error").textContent = e.message;
    }
}

// "0.5 → 0.25 at gen 24 → minimum 0.05 from gen 76"
function sigmaSummary() {
    const start = Number($("sigmaStart").value), decay = Number($("sigmaDecay").value) / 100, min = Number($("sigmaMin").value);
    if (!(start > 0) || !(decay >= 0) || !(min >= 0)) return "";
    if (decay === 0 || min >= start) return `Constant: ${Math.max(start, min)}`;
    const genAt = size => 1 + Math.ceil(Math.log(size / start) / Math.log(1 - decay));
    const half = `${+(start / 2).toPrecision(2)} at gen ${genAt(start / 2)}`;
    return min > 0 ? `${start} → ${half} → minimum ${min} from gen ${genAt(min)}` : `${start} → ${half}`;
}

function runLabel(config, shape) {
    const hidden = config.hidden.length ? `[${config.hidden.join(",")}]` : "[none]";
    return `${hidden} ${config.rays}+8 rays · mem ${config.memory} · ${Network.paramCount(shape)} params · pop ${config.populationSize}` +
        ` · ${config.changesPerChild} chg · σ ${config.sigmaStart}→${config.sigmaMin}`;
}

const difficultyName = value => $("difficulty").querySelector(`option[value="${value}"]`).textContent;

// The label ends with the track difficulties used, in order: "· Medium → Hard"
function updateRunLabel() {
    currentRun.label = `${currentRun.baseLabel} · ${currentRun.difficulties.map(difficultyName).join(" → ")}`;
}

// ---------- Training ----------
function startTraining(importedGenome = null) {
    let config;
    try {
        config = readConfig();
    } catch (e) {
        $("error").textContent = e.message;
        return;
    }
    $("error").textContent = "";

    trainer = new Trainer(config, importedGenome);
    const usedColors = runs.map(r => r.color);
    skipTo = 0;
    currentRun = {
        baseLabel: runLabel(config, trainer.shape) + (importedGenome ? " · imported" : ""),
        difficulties: [config.difficulty],
        color: RUN_COLORS.find(c => !usedColors.includes(c)) || RUN_COLORS[runs.length % RUN_COLORS.length],
        history: trainer.history,
    };
    runs.push(currentRun);
    updateRunLabel();
    while (runs.length > MAX_RUNS) runs.shift();

    trainer.onUpdate(() => {
        saveRuns();
        refreshChart();
    });
    refreshChart();
}

// ---------- Main loop: fixed steps, as many as the speed asks and the frame budget allows ----------
let lastFrame = performance.now();
let pendingSteps = 0;
let stepsCounted = 0;
let stepsPerSecond = 0;
let rateTimer = performance.now();

function frame(now) {
    const elapsed = Math.min(100, now - lastFrame);
    lastFrame = now;

    if (trainer && trainer.generation < skipTo) {
        // "+": as fast as possible up to the next generation, even while paused
        const deadline = performance.now() + FRAME_BUDGET_MAX_MS;
        do {
            trainer.tick();
            stepsCounted++;
        } while (trainer.generation < skipTo && performance.now() < deadline);
        pendingSteps = 0;
    } else if (trainer && !paused) {
        const deadline = performance.now() + (speed === Infinity ? FRAME_BUDGET_MAX_MS : FRAME_BUDGET_MS);
        if (speed === Infinity) {
            do {
                trainer.tick();
                stepsCounted++;
            } while (performance.now() < deadline);
        } else {
            pendingSteps += elapsed / 1000 * STEPS_PER_SECOND * speed;
            while (pendingSteps >= 1) {
                trainer.tick();
                stepsCounted++;
                pendingSteps--;
                if (performance.now() > deadline) {
                    pendingSteps = 0; // Too slow for this speed: drop the backlog
                    break;
                }
            }
        }
    }

    if (now - rateTimer >= 1000) {
        stepsPerSecond = stepsCounted * 1000 / (now - rateTimer);
        stepsCounted = 0;
        rateTimer = now;
    }

    render();
    requestAnimationFrame(frame);
}

function render() {
    if (!trainer) return;
    const leader = trainer.leader();
    const drawIt = $("draw").checked;
    $("hiddenTrack").hidden = drawIt;
    if (drawIt) {
        const limit = raceLimit();
        zoom = clampZoom(zoom, limit);
        drawTrack($("track"), trainer, leader, zoom, limit);
    }

    const { rays, memory } = trainer.config;
    const memoryLabels = Array.from({ length: memory }, (_, m) => `mem ${m + 1}`);
    const angles = Array.from(rayLayout(rays).angles, a => `${Math.round(a * 180 / Math.PI)}°`);
    const inputLabels = angles.concat("speed", ["cut-in L", "cut-in R"], memoryLabels);
    drawNetwork($("network"), leader && leader.network, inputLabels, OUTPUTS.concat(memoryLabels));
    renderStats(leader);
}

const STAT_NAMES = ["Generation", "Track", "Difficulty", "Race time", "Alive", "Leader", "Champion, this race",
    "Champion (validation)",
    "Mutation σ · rate", "Network", "Parameters", "Speed (steps)", "Zoom"];

// Built once: the values change, the "+" button next to the generation stays
function buildStats() {
    $("stats").innerHTML = STAT_NAMES.map((name, i) => i === 0
        ? `<div><dt>${name}</dt><dd><button id="nextGen" class="next-gen" type="button" title="Skip to the next generation"
            aria-label="Skip to the next generation">+</button><span data-stat="0"></span></dd></div>`
        : `<div><dt>${name}</dt><dd data-stat="${i}"></dd></div>`).join("");
    $("nextGen").addEventListener("click", () => {
        if (trainer) skipTo = Math.max(skipTo, trainer.generation) + 1;
    });
}

function renderStats(leader) {
    const c = trainer.config;
    const champion = trainer.champion;
    const values = [
        skipTo > trainer.generation ? `${trainer.generation} → ${skipTo}` : trainer.generation,
        `${trainer.trackIndex + 1}/${c.tracksPerGeneration}`,
        difficultyName(trainer.road.difficulty),                // Of the current race
        `${(trainer.step / STEPS_PER_SECOND).toFixed(1)}/${c.episodeSteps / STEPS_PER_SECOND}s`,
        `${trainer.aliveCount()}/${c.populationSize}`,
        `${Math.round(leader ? leader.distance : 0)}px`,
        ghostStat(),
        champion ? `${Math.round(champion.fitness)}px · gen ${champion.generation}` : "–",
        `σ ${trainer.mutationSigma.toFixed(3)} · ${trainer.mutationRate.toPrecision(2)}`,
        `${trainer.shape.join("→")}`,
        trainer.paramCount,
        `${Math.round(stepsPerSecond)}/s (×${(stepsPerSecond / STEPS_PER_SECOND).toFixed(1)})`,
        `×${zoom < 0.1 ? zoom.toFixed(3) : zoom.toFixed(2)}`,
    ];
    $("stats").querySelectorAll("[data-stat]").forEach(el => {
        const text = String(values[el.dataset.stat]);
        if (el.textContent !== text) el.textContent = text;
    });
}

// The champion racing with the generation: its distance, or where it went out
function ghostStat() {
    const ghost = trainer.ghost;
    if (!ghost) return "– (none yet)";
    const d = `${Math.round(ghost.distance)}px`;
    return ghost.alive ? `${d} · gen ${trainer.ghostGeneration}` : `out at ${d}`;
}

// ---------- Zoom: mouse wheel, pinch, double-click to reset ----------
function raceLimit() {
    return MAX_SPEED * (trainer ? trainer.config.episodeSteps : 3600);
}

function clampZoom(value, limit = raceLimit()) {
    const [min, max] = zoomRange($("track").clientHeight || 1, limit);
    return Math.max(min, Math.min(max, value));
}

function setupZoom(canvas) {
    canvas.addEventListener("wheel", event => {
        event.preventDefault();
        const lines = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
        // Trackpad pinch arrives as a wheel event with ctrlKey and small deltas
        const sensitivity = event.ctrlKey ? 0.01 : 0.0015;
        zoom = clampZoom(zoom * Math.exp(-event.deltaY * lines * sensitivity));
    }, { passive: false });
    canvas.addEventListener("dblclick", () => { zoom = 1; });
    canvas.addEventListener("mousedown", event => { if (event.detail > 1) event.preventDefault(); }); // No text selection

    // Two fingers zoom; one finger still scrolls the page
    let pinch = null;
    const spread = touches => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    canvas.addEventListener("touchstart", event => {
        if (event.touches.length === 2) {
            event.preventDefault();
            pinch = { spread: spread(event.touches) || 1, zoom };
        }
    }, { passive: false });
    canvas.addEventListener("touchmove", event => {
        if (!pinch || event.touches.length !== 2) return;
        event.preventDefault();
        zoom = clampZoom(pinch.zoom * spread(event.touches) / pinch.spread);
    }, { passive: false });
    const endPinch = event => { if (event.touches.length < 2) pinch = null; };
    canvas.addEventListener("touchend", endPinch);
    canvas.addEventListener("touchcancel", endPinch);
}

// ---------- Chart and history of trainings ----------
function refreshChart() {
    const raceLimit = trainer ? MAX_SPEED * trainer.config.episodeSteps : 0;
    drawChart($("chart"), runs, runs.indexOf(currentRun), raceLimit);
    $("runs").innerHTML = runs.slice().reverse().map(run => {
        const best = run.history.reduce((m, h) => Math.max(m, h.validation || 0), 0);
        const current = run === currentRun;
        const color = current ? "#4ade80" : run.color;
        return `<li class="${current ? "current" : ""}">
            <span class="swatch" style="border-color:${color}"></span>
            <span class="label">${run.label}${current ? " (current)" : ""}</span>
            <span class="score">val ${Math.round(best)}px · ${run.history.length} gen</span>
        </li>`;
    }).join("");
}

function loadRuns() {
    try {
        const saved = JSON.parse(localStorage.getItem(RUNS_KEY));
        return Array.isArray(saved) ? saved.filter(r => r && Array.isArray(r.history)) : [];
    } catch {
        return [];
    }
}

function saveRuns() {
    try {
        localStorage.setItem(RUNS_KEY, JSON.stringify(runs.filter(r => r.history.length > 0)));
    } catch {
        // Storage full or disabled: the history simply won't survive a reload
    }
}

// ---------- Export / import of the champion ----------
function exportChampion() {
    const champion = trainer && trainer.champion;
    if (!champion) {
        $("error").textContent = "No champion for this difficulty yet: wait for the next validation (it ends during the next generation).";
        return;
    }
    const layout = rayLayout(trainer.config.rays);
    const data = {
        format: "neural-race-brain",
        version: 1,
        physics: PHYSICS_VERSION,
        inputs: {
            rays: trainer.config.rays,                                  // Rays in the front fan
            sideRays: layout.angles.length - trainer.config.rays,       // Short rays on the sides and towards the back
            rayAngles: Array.from(layout.angles, a => +a.toFixed(4)),   // Radians, from left to right
            rayLengths: Array.from(layout.lengths, l => Math.round(l)), // Pixels
            speed: true,
            cutIns: CUT_IN_INPUTS,                                      // Traffic about to come into the lane, from the left, from the right
            memory: trainer.config.memory,                              // Memory values fed back from the previous step
        },
        outputs: OUTPUTS.concat(Array.from({ length: trainer.config.memory }, (_, m) => `memory${m + 1}`)),
        activation: "tanh",
        shape: trainer.shape,
        fitness: Math.round(champion.fitness),          // Average distance on the validation tracks…
        validationDifficulty: champion.difficulty,      // …of this difficulty
        generation: champion.generation,
        genome: Array.from(champion.genome),
    };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `neural-race-${trainer.shape.join("-")}-gen${champion.generation}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
}

async function importChampion(file) {
    try {
        const data = JSON.parse(await file.text());
        if (data.format !== "neural-race-brain" || !Array.isArray(data.shape) || !Array.isArray(data.genome)) {
            throw new Error("This file is not an exported Neural Lab brain.");
        }
        if (data.physics !== PHYSICS_VERSION) {
            throw new Error(`This brain was trained with another simulation (${data.physics}), it would not drive here.`);
        }
        const memory = data.inputs ? data.inputs.memory || 0 : 0;
        if (!data.inputs || inputCount(data.inputs.rays, memory) !== data.shape[0] ||
            data.shape[data.shape.length - 1] !== OUTPUTS.length + memory ||
            data.genome.length !== Network.paramCount(data.shape)) {
            throw new Error("The parameters do not match the network shape.");
        }
        // Settings follow the imported network
        $("rays").value = String(data.inputs.rays);
        $("memory").value = String(memory);
        $("hidden").value = data.shape.slice(1, -1).join(", ");
        updatePreview();
        startTraining(Float64Array.from(data.genome));
    } catch (e) {
        $("error").textContent = e.message;
    }
}

// ---------- Wiring ----------
$("settings").addEventListener("submit", event => {
    event.preventDefault();
    startTraining();
});
$("hidden").addEventListener("input", updatePreview);
$("rays").addEventListener("change", updatePreview);
$("memory").addEventListener("change", updatePreview);
for (const id of ["changesPerChild", "sigmaStart", "sigmaDecay", "sigmaMin"]) $(id).addEventListener("input", updatePreview);

// "?" buttons: show or hide the explanation they point to
document.querySelectorAll(".help-toggle").forEach(button => {
    button.addEventListener("click", event => {
        event.preventDefault(); // Inside a label: don't focus the field
        const help = $(button.getAttribute("aria-controls"));
        help.hidden = !help.hidden;
        button.setAttribute("aria-expanded", String(!help.hidden));
    });
});

document.querySelectorAll(".speeds button").forEach(button => {
    button.addEventListener("click", () => {
        speed = button.dataset.speed === "max" ? Infinity : Number(button.dataset.speed);
        document.querySelectorAll(".speeds button").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
        // At high speed, drawing the track is mostly wasted time
        $("draw").checked = speed <= 10;
    });
});
$("pause").addEventListener("click", () => {
    paused = !paused;
    $("pause").textContent = paused ? "Resume" : "Pause";
});
$("export").addEventListener("click", exportChampion);
$("import").addEventListener("change", event => {
    if (event.target.files[0]) importChampion(event.target.files[0]);
    event.target.value = "";
});
$("clearRuns").addEventListener("click", () => {
    runs = currentRun ? [currentRun] : [];
    saveRuns();
    refreshChart();
});
window.addEventListener("resize", refreshChart);

// Track difficulty: applies from the next race, without restarting the training
$("difficulty").addEventListener("change", () => {
    if (!trainer) return;
    trainer.config.difficulty = $("difficulty").value;
    if (currentRun.difficulties.at(-1) !== trainer.config.difficulty) {
        currentRun.difficulties.push(trainer.config.difficulty);
        updateRunLabel();
        saveRuns();
        refreshChart();
    }
});
setupZoom($("track"));
buildStats();

updatePreview();
startTraining();
requestAnimationFrame(frame);
