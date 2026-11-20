// Drawing: the track, the network of the followed car, the fitness chart
import { TRAFFIC_MIN_SPEED, TRAFFIC_MAX_SPEED } from './traffic.js';
import { CAR_WIDTH, CAR_LENGTH } from './car.js';
import { carPolygon } from './geometry.js';

export const RUN_COLORS = ["#f59e0b", "#a78bfa", "#f472b6", "#38bdf8", "#fb7185", "#facc15", "#2dd4bf", "#c084fc"];

// Sizes the canvas to its CSS box, sharp on high-density screens; returns its CSS size
export function fitCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(width * dpr)), h = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width, height };
}

function fillPolygon(ctx, poly) {
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fill();
}

// ---------- Track ----------
const VIEW_MARGIN = 300;       // Road shown before the start and after the race limit
const MAX_ZOOM = 4;
const DOT_ZOOM = 0.3;          // Zoomed out further: cars become dots, easier to see
let cameraX = 0;
let cameraRoad = null;
const roadMiddles = new WeakMap();

// Middle of the road's sideways extent over the whole race: the fixed camera position when zoomed out
function roadMiddle(road, raceLimit) {
    let cached = roadMiddles.get(road);
    if (!cached || cached.limit !== raceLimit) {
        let min = Infinity, max = -Infinity;
        for (let d = 0; d <= raceLimit; d += 50) {
            const x = road.centerX(d);
            min = Math.min(min, x);
            max = Math.max(max, x);
        }
        cached = { limit: raceLimit, x: (min + max) / 2 };
        roadMiddles.set(road, cached);
    }
    return cached.x;
}

// Zoom limits for a canvas of this height: the most zoomed-out view shows the whole race,
// from the start to the furthest distance a car can reach
export function zoomRange(height, raceLimit) {
    return [Math.min(1, height / (raceLimit + 2 * VIEW_MARGIN)), MAX_ZOOM];
}

function fillDot(ctx, x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}

// raceLimit: furthest distance a car can reach; zoom: 1 = one pixel per world unit
export function drawTrack(canvas, trainer, followed, zoom, raceLimit) {
    const { ctx, width, height } = fitCanvas(canvas);
    const road = trainer.road;
    const px = 1 / zoom;                       // One screen pixel, in world units

    // Visible distances (d = -y): the followed car low on the screen, to see ahead; never
    // much before the start or after the race limit; the whole race when zoomed out enough
    const viewLength = height * px;
    const low = -VIEW_MARGIN, high = raceLimit + VIEW_MARGIN;
    const carD = followed ? followed.distance : 0;
    let dBottom = viewLength >= high - low
        ? (low + high - viewLength) / 2
        : Math.max(low, Math.min(high - viewLength, carD - viewLength * 0.25));
    const dTop = dBottom + viewLength;
    // Sideways: follows the car at normal zoom and closer; zoomed out, stays still on the road's middle
    const targetX = zoom >= 1 ? road.centerX(Math.max(dBottom, Math.min(dTop, carD))) : roadMiddle(road, raceLimit);
    if (road !== cameraRoad && zoom < 1) cameraX = targetX;   // New race while zoomed out: no slide
    else cameraX += (targetX - cameraX) * 0.15;
    cameraRoad = road;

    ctx.fillStyle = "#1f2b22";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height);
    ctx.scale(zoom, zoom);
    ctx.translate(-cameraX, dBottom);

    // Road surface and markings, sampled about every 2 screen pixels
    const stepD = Math.max(10, Math.min(60, 2 * px));
    const ds = [];
    for (let d = Math.floor((dBottom - 50) / stepD) * stepD; d <= dTop + 50; d += stepD) ds.push(d);
    const centres = ds.map(d => road.centerX(d));
    const laneWidths = ds.map(d => road.laneWidth(d));
    const half = road.laneCount / 2;
    ctx.fillStyle = "#3d4148";
    ctx.beginPath();
    ds.forEach((d, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, centres[i] - laneWidths[i] * half, -d));
    for (let i = ds.length - 1; i >= 0; i--) ctx.lineTo(centres[i] + laneWidths[i] * half, -ds[i]);
    ctx.fill();

    ctx.strokeStyle = "#e6edf3";
    for (let lane = 0; lane <= road.laneCount; lane++) {
        const border = lane === 0 || lane === road.laneCount;
        if (!border && zoom < 0.2) continue;   // Lane markings would only blur the view
        ctx.lineWidth = border ? Math.max(4, px) : 2;
        ctx.setLineDash(border ? [] : [18, 18]);
        ctx.beginPath();
        ds.forEach((d, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, centres[i] + (lane - half) * laneWidths[i], -d));
        ctx.stroke();
    }
    ctx.setLineDash([]);

    // Traffic: dark red for the slow cars, light red for the fast ones. Every car in view,
    // not only those near the AIs
    const dots = zoom < DOT_ZOOM;
    for (const t of trainer.traffic.cars) {
        if (t.d <= dBottom - 50 || t.d >= dTop + 50) continue;
        const k = (t.cruise - TRAFFIC_MIN_SPEED) / (TRAFFIC_MAX_SPEED - TRAFFIC_MIN_SPEED);
        ctx.fillStyle = `rgb(${Math.round(150 + 100 * k)}, ${Math.round(30 + 90 * k)}, ${Math.round(30 + 90 * k)})`;
        ctx.globalAlpha = trainer.traffic.opacity(t);   // Fades out on the roadside after an exit
        if (dots) {
            fillDot(ctx, t.x, t.y, 2 * px);
        } else {
            if (!t.poly) t.poly = carPolygon(t.x, t.y, t.heading, CAR_WIDTH, CAR_LENGTH);
            fillPolygon(ctx, t.poly);
        }
    }
    ctx.globalAlpha = 1;

    // Population: faded, elites (unchanged best of the previous generation) in gold
    for (const car of trainer.cars) {
        if (!car.alive || car === followed) continue;
        ctx.globalAlpha = car.isElite ? 0.8 : (dots ? 0.5 : 0.3);
        ctx.fillStyle = car.isElite ? "#facc15" : "#60a5fa";
        if (dots) fillDot(ctx, car.x, car.y, 2.5 * px);
        else fillPolygon(ctx, car.polygon);
    }
    ctx.globalAlpha = 1;

    // The champion, driving the same race for comparison: green, outlined
    const ghost = trainer.ghost;
    if (ghost) {
        ctx.fillStyle = ghost.alive ? "#4ade80" : "rgba(74, 222, 128, 0.35)";
        ctx.strokeStyle = "#0d1117";
        ctx.lineWidth = 1.5 * px;
        if (dots) {
            fillDot(ctx, ghost.x, ghost.y, 3.5 * px);
            ctx.stroke();
        } else {
            fillPolygon(ctx, ghost.polygon);
            ctx.stroke();
        }
    }

    if (followed) {
        // Its rays: yellow up to what they hit
        ctx.lineWidth = 1.5 * px;
        for (let k = 0; k < followed.rayCount; k++) {
            const a = followed.rayAngle(k);
            const len = followed.rayLength(k) * followed.rayHits[k];
            ctx.strokeStyle = followed.rayHits[k] < 1 ? "#fde047" : "rgba(253, 224, 71, 0.35)";
            ctx.beginPath();
            ctx.moveTo(followed.x, followed.y);
            ctx.lineTo(followed.x + Math.sin(a) * len, followed.y - Math.cos(a) * len);
            ctx.stroke();
        }
        ctx.fillStyle = followed.alive ? "#2563eb" : "#6b7280";
        ctx.strokeStyle = "#e6edf3";
        ctx.lineWidth = 1.5 * px;
        if (dots) {
            ctx.beginPath();
            ctx.arc(followed.x, followed.y, 4 * px, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        } else {
            fillPolygon(ctx, followed.polygon);
            ctx.beginPath();
            followed.polygon.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, p.x, p.y));
            ctx.closePath();
            ctx.stroke();
        }
    }
    // Indicators of the traffic cars: orange corners on the side they are about to move to
    // (corners: front-left, front-right, rear-right, rear-left)
    if (!dots && Math.floor(trainer.step / 20) % 2 === 0) {
        ctx.fillStyle = "#fb923c";
        for (const t of trainer.traffic.cars) {
            if (!t.signal || t.d <= dBottom - 50 || t.d >= dTop + 50) continue;
            if (!t.poly) t.poly = carPolygon(t.x, t.y, t.heading, CAR_WIDTH, CAR_LENGTH);
            ctx.globalAlpha = trainer.traffic.opacity(t);
            for (const corner of t.signal < 0 ? [0, 3] : [1, 2]) fillDot(ctx, t.poly[corner].x, t.poly[corner].y, Math.max(5, 3 * px));
        }
        ctx.globalAlpha = 1;
    }
    ctx.restore();
}

// ---------- Network ----------
// Positive values in orange, negative in blue; line width and opacity follow the weight
function signedColor(value, alpha) {
    return value >= 0 ? `rgba(251, 146, 60, ${alpha})` : `rgba(96, 165, 250, ${alpha})`;
}

export function drawNetwork(canvas, network, inputLabels, outputLabels) {
    const { ctx, width, height } = fitCanvas(canvas);
    ctx.clearRect(0, 0, width, height);
    if (!network) return;

    const shape = network.shape;
    const padLeft = 46, padRight = 62, padY = 14;
    const colX = l => padLeft + (width - padLeft - padRight) * (shape.length === 1 ? 0.5 : l / (shape.length - 1));
    const rowY = (n, i) => padY + (height - 2 * padY) * (n === 1 ? 0.5 : i / (n - 1));
    const maxNodes = Math.max(...shape);
    const radius = Math.max(2, Math.min(8, (height - 2 * padY) / maxNodes / 2.6));

    // Connections
    network.layers.forEach((layer, l) => {
        for (let o = 0; o < layer.nOut; o++) {
            for (let i = 0; i < layer.nIn; i++) {
                const w = layer.weights[o * layer.nIn + i];
                const strength = Math.min(1, Math.abs(w));
                ctx.strokeStyle = signedColor(w, 0.08 + strength * 0.6);
                ctx.lineWidth = 0.4 + strength * 2;
                ctx.beginPath();
                ctx.moveTo(colX(l), rowY(layer.nIn, i));
                ctx.lineTo(colX(l + 1), rowY(layer.nOut, o));
                ctx.stroke();
            }
        }
    });

    // Neurons, filled with their current value
    shape.forEach((n, l) => {
        for (let i = 0; i < n; i++) {
            const v = network.activations[l][i];
            const x = colX(l), y = rowY(n, i);
            ctx.fillStyle = "#0d1117";
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = signedColor(v, Math.min(1, Math.abs(v)));
            ctx.fill();
            ctx.strokeStyle = "#8b949e";
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    });

    // Labels
    ctx.fillStyle = "#8b949e";
    ctx.font = "10px ui-monospace, monospace";
    ctx.textBaseline = "middle";
    if (shape[0] <= 24) {
        ctx.textAlign = "right";
        inputLabels.forEach((label, i) => ctx.fillText(label, colX(0) - radius - 4, rowY(shape[0], i)));
    }
    ctx.textAlign = "left";
    const last = shape.length - 1;
    outputLabels.forEach((label, i) => ctx.fillText(label, colX(last) + radius + 4, rowY(shape[last], i)));
}

// ---------- Fitness chart ----------
// runs: [{ label, color, history: [{generation, best, mean, validation}] }]
// raceLimit: furthest distance a car can reach in one race of the current training
export function drawChart(canvas, runs, currentIndex, raceLimit = 0) {
    const { ctx, width, height } = fitCanvas(canvas);
    ctx.clearRect(0, 0, width, height);
    const pad = { left: 44, right: 10, top: 10, bottom: 22 };
    const plotW = width - pad.left - pad.right, plotH = height - pad.top - pad.bottom;

    const all = runs.flatMap(r => r.history);
    const maxGen = Math.max(10, ...runs.map(r => r.history.length));
    const maxFit = Math.max(1000, raceLimit, ...all.map(h => Math.max(h.best, h.validation || 0))) * 1.08;
    const x = g => pad.left + plotW * (g - 1) / Math.max(1, maxGen - 1);
    const y = f => pad.top + plotH * (1 - f / maxFit);

    // Grid and axes
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillStyle = "#6e7681";
    ctx.strokeStyle = "#21262d";
    ctx.lineWidth = 1;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
        const f = maxFit * i / 4;
        ctx.beginPath();
        ctx.moveTo(pad.left, y(f));
        ctx.lineTo(width - pad.right, y(f));
        ctx.stroke();
        ctx.fillText(f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)}k` : f.toFixed(0), pad.left - 6, y(f));
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("generation", pad.left + plotW / 2, height - 12);
    ctx.textAlign = "left";
    ctx.fillText("1", pad.left, height - 12);
    ctx.textAlign = "right";
    ctx.fillText(String(maxGen), width - pad.right, height - 12);

    if (raceLimit > 0) {
        ctx.strokeStyle = "#6e7681";
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(pad.left, y(raceLimit));
        ctx.lineTo(width - pad.right, y(raceLimit));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText("race limit", pad.left + 4, y(raceLimit) - 2);
    }

    const line = (allHistory, key, color, lineWidth, dash = []) => {
        const history = allHistory.filter(h => Number.isFinite(h[key])); // Validation arrives a bit later
        if (history.length === 0) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash(dash);
        ctx.beginPath();
        history.forEach((h, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x(h.generation), y(h[key])));
        if (history.length === 1) ctx.arc(x(history[0].generation), y(history[0][key]), 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    };

    runs.forEach((run, i) => {
        if (i !== currentIndex) line(run.history, "validation", run.color || RUN_COLORS[i % RUN_COLORS.length], 1.5, [4, 3]);
    });
    const current = runs[currentIndex];
    if (current) {
        line(current.history, "mean", "#8b949e", 1.5);
        line(current.history, "best", "#4ade80", 2);
        line(current.history, "validation", "#e6edf3", 2.5);
    }
}
