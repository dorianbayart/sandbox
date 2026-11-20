// Geometry helpers. World axes: x to the right, y down (the road goes towards negative y).
// A heading of 0 points up, a positive heading turns to the right.

// Where segment AB crosses segment CD, as a fraction of AB (0..1), or -1 if they don't cross
export function segmentHit(ax, ay, bx, by, cx, cy, dx, dy) {
    const rx = bx - ax, ry = by - ay;
    const sx = dx - cx, sy = dy - cy;
    const den = rx * sy - ry * sx;
    if (den === 0) return -1;
    const qx = cx - ax, qy = cy - ay;
    const t = (qx * sy - qy * sx) / den;
    const u = (qx * ry - qy * rx) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : -1;
}

// The 4 corners of a car (front-left, front-right, rear-right, rear-left)
export function carPolygon(x, y, heading, width, length) {
    const s = Math.sin(heading), c = Math.cos(heading);
    const fx = s * length / 2, fy = -c * length / 2; // Half length, forward
    const rx = c * width / 2, ry = s * width / 2;    // Half width, to the right
    return [
        { x: x + fx - rx, y: y + fy - ry },
        { x: x + fx + rx, y: y + fy + ry },
        { x: x - fx + rx, y: y - fy + ry },
        { x: x - fx - rx, y: y - fy - ry },
    ];
}

export function polygonsIntersect(p, q) {
    for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        for (let j = 0; j < q.length; j++) {
            const c = q[j], d = q[(j + 1) % q.length];
            if (segmentHit(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y) >= 0) return true;
        }
    }
    return false;
}

export function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}
