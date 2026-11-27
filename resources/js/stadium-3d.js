/**
 * High-Detail Interactive 3D Stadium Engine with:
 * - Smooth articulated 22-player + referee animated football match (cylinders & spheres, non-blocky)
 * - Curved molded 3D bucket seats, overhanging upper balcony, VIP glass skyboxes, handrails & vomitories
 * - Lively seated & cheering crowd across all 12 sectors
 * - Volumetric 3D drifting cloud clusters & animated falling rain streaks
 * - Real-time Time-of-Day (Siang 14:00, Sore 17:30, Malam 19:30) & Weather (Cerah, Mendung, Hujan) simulation
 */

const DEG_TO_RAD = Math.PI / 180;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function lerpVec3(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function hexToRgbNorm(hex, fallback = [0.85, 0.2, 0.16]) {
    if (!hex || typeof hex !== 'string') {
        return fallback;
    }
    const clean = hex.replace('#', '');
    if (clean.length !== 6) {
        return fallback;
    }
    const num = parseInt(clean, 16);
    if (Number.isNaN(num)) {
        return fallback;
    }
    return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

export function stadiumContourPoint(angleDeg, offsetFromPitch, y = 0) {
    const rad = angleDeg * DEG_TO_RAD;
    const ux = Math.sin(rad);
    const uz = -Math.cos(rad);
    const p = 3.4;
    const denom = Math.pow(Math.pow(Math.abs(ux), p) + Math.pow(Math.abs(uz), p), 1 / p) || 1;
    const scale = 1 / denom;

    const halfWidth = 42 + offsetFromPitch;
    const halfLength = 60 + offsetFromPitch;

    return [ux * scale * halfWidth, y, uz * scale * halfLength];
}

/**
 * Computes exact 3D seat eye position with overhanging 2nd tier geometry.
 */
export function seatWorldPosition(sector, rowNumber, seatNumber) {
    const totalRows = Math.max(1, Number(sector.rows_count) || 20);
    const totalSeats = Math.max(1, Number(sector.seats_per_row) || 30);
    const row = clamp(Number(rowNumber) || 1, 1, totalRows);
    const seat = clamp(Number(seatNumber) || 1, 1, totalSeats);

    const angleSpan = Number(sector.angle_end) - Number(sector.angle_start);
    const seatFraction = (seat - 0.5) / totalSeats;
    const angleDeg = Number(sector.angle_start) + angleSpan * seatFraction;

    const lowerTierEnd = Math.ceil(totalRows * 0.5);
    let radialDistance;
    let seatY;

    if (row <= lowerTierEnd) {
        radialDistance = 2.0 + (row - 1) * 1.15;
        seatY = 2.1 + (row - 1) * 0.65;
    } else {
        // Upper balcony overhangs slightly forward over back of lower tier
        const upperIdx = row - lowerTierEnd - 1;
        const lowerEndD = 2.0 + lowerTierEnd * 1.15;
        const lowerEndY = 2.1 + lowerTierEnd * 0.65;
        radialDistance = (lowerEndD - 1.6) + upperIdx * 1.15;
        seatY = (lowerEndY + 3.2) + upperIdx * 0.72;
    }

    const pos = stadiumContourPoint(angleDeg, radialDistance, seatY);

    return {
        position: [pos[0], pos[1] + 1.42, pos[2]],
        seatBase: pos,
        angleDeg,
        isUpperTier: row > lowerTierEnd,
    };
}

function mat4Perspective(fovDeg, aspect, near, far) {
    const f = 1 / Math.tan((fovDeg * DEG_TO_RAD) / 2);
    const nf = 1 / (near - far);

    return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0,
    ]);
}

function mat4LookAt(eye, target, up = [0, 1, 0]) {
    let zx = eye[0] - target[0];
    let zy = eye[1] - target[1];
    let zz = eye[2] - target[2];
    const zLen = Math.hypot(zx, zy, zz) || 1;
    zx /= zLen;
    zy /= zLen;
    zz /= zLen;

    let xx = up[1] * zz - up[2] * zy;
    let xy = up[2] * zx - up[0] * zz;
    let xz = up[0] * zy - up[1] * zx;
    const xLen = Math.hypot(xx, xy, xz) || 1;
    xx /= xLen;
    xy /= xLen;
    xz /= xLen;

    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;

    return new Float32Array([
        xx, yx, zx, 0,
        xy, yy, zy, 0,
        xz, yz, zz, 0,
        -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
        -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
        -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
        1,
    ]);
}

function createArrayBucket() {
    return { positions: [], normals: [], colors: [], uvs: [], aos: [] };
}

function pushQuad(
    arrays,
    p1,
    p2,
    p3,
    p4,
    color,
    uv1 = [0, 0],
    uv2 = [1, 0],
    uv3 = [1, 1],
    uv4 = [0, 1],
    ao = [1, 1, 1, 1],
) {
    const ux = p2[0] - p1[0];
    const uy = p2[1] - p1[1];
    const uz = p2[2] - p1[2];
    const vx = p4[0] - p1[0];
    const vy = p4[1] - p1[1];
    const vz = p4[2] - p1[2];

    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;

    const verts = [
        [p1, uv1, ao[0]],
        [p2, uv2, ao[1]],
        [p3, uv3, ao[2]],
        [p1, uv1, ao[0]],
        [p3, uv3, ao[2]],
        [p4, uv4, ao[3]],
    ];

    for (const [p, uv, vAo] of verts) {
        arrays.positions.push(p[0], p[1], p[2]);
        arrays.normals.push(nx, ny, nz);
        arrays.colors.push(color[0], color[1], color[2]);
        arrays.uvs.push(uv[0], uv[1]);
        arrays.aos.push(vAo);
    }
}

function pushSmoothQuad(arrays, p1, n1, p2, n2, p3, n3, p4, n4, color, ao = [1, 1, 1, 1]) {
    const verts = [
        [p1, n1, ao[0]],
        [p2, n2, ao[1]],
        [p3, n3, ao[2]],
        [p1, n1, ao[0]],
        [p3, n3, ao[2]],
        [p4, n4, ao[3]],
    ];
    for (const [p, n, vAo] of verts) {
        arrays.positions.push(p[0], p[1], p[2]);
        arrays.normals.push(n[0], n[1], n[2]);
        arrays.colors.push(color[0], color[1], color[2]);
        arrays.uvs.push(0, 0);
        arrays.aos.push(vAo);
    }
}

function pushTri(arrays, p1, p2, p3, c1, c2, c3, ao = 1.0) {
    const ux = p2[0] - p1[0];
    const uy = p2[1] - p1[1];
    const uz = p2[2] - p1[2];
    const vx = p3[0] - p1[0];
    const vy = p3[1] - p1[1];
    const vz = p3[2] - p1[2];

    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;

    const items = [
        [p1, c1],
        [p2, c2],
        [p3, c3],
    ];
    for (const [p, c] of items) {
        arrays.positions.push(p[0], p[1], p[2]);
        arrays.normals.push(nx, ny, nz);
        arrays.colors.push(c[0], c[1], c[2]);
        arrays.uvs.push(0, 0);
        arrays.aos.push(ao);
    }
}

function pushBox(arrays, cx, cy, cz, sx, sy, sz, color, ao = 1.0, yaw = 0, pitch = 0) {
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);

    const transform = (lx, ly, lz) => {
        const py = ly * cosP - lz * sinP;
        const pz = ly * sinP + lz * cosP;
        const rx = lx * cosY + pz * sinY;
        const rz = -lx * sinY + pz * cosY;
        return [cx + rx, cy + py, cz + rz];
    };

    const p000 = transform(-hx, -hy, -hz);
    const p100 = transform(hx, -hy, -hz);
    const p110 = transform(hx, hy, -hz);
    const p010 = transform(-hx, hy, -hz);
    const p001 = transform(-hx, -hy, hz);
    const p101 = transform(hx, -hy, hz);
    const p111 = transform(hx, hy, hz);
    const p011 = transform(-hx, hy, hz);

    const aoArr = [ao, ao, ao, ao];
    pushQuad(arrays, p011, p111, p110, p010, color, [0, 0], [1, 0], [1, 1], [0, 1], aoArr);
    pushQuad(arrays, p000, p100, p101, p001, color, [0, 0], [1, 0], [1, 1], [0, 1], aoArr);
    pushQuad(arrays, p001, p101, p111, p011, color, [0, 0], [1, 0], [1, 1], [0, 1], aoArr);
    pushQuad(arrays, p100, p000, p010, p110, color, [0, 0], [1, 0], [1, 1], [0, 1], aoArr);
    pushQuad(arrays, p000, p001, p011, p010, color, [0, 0], [1, 0], [1, 1], [0, 1], aoArr);
    pushQuad(arrays, p101, p100, p110, p111, color, [0, 0], [1, 0], [1, 1], [0, 1], aoArr);
}

/**
 * Smooth tapered 3D cylinder between point A and point B (for limbs, torsos, posts, poles).
 */
function pushCylinder(arrays, pA, pB, rA, rB, segs, color, ao = 1.0) {
    const dx = pB[0] - pA[0];
    const dy = pB[1] - pA[1];
    const dz = pB[2] - pA[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    const dir = [dx / len, dy / len, dz / len];

    // Orthonormal basis perpendicular to axis
    const ref = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let u = [
        ref[1] * dir[2] - ref[2] * dir[1],
        ref[2] * dir[0] - ref[0] * dir[2],
        ref[0] * dir[1] - ref[1] * dir[0],
    ];
    const uLen = Math.hypot(u[0], u[1], u[2]) || 1;
    u = [u[0] / uLen, u[1] / uLen, u[2] / uLen];
    const v = [
        dir[1] * u[2] - dir[2] * u[1],
        dir[2] * u[0] - dir[0] * u[2],
        dir[0] * u[1] - dir[1] * u[0],
    ];

    for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2;
        const a1 = ((i + 1) / segs) * Math.PI * 2;
        const c0 = Math.cos(a0);
        const s0 = Math.sin(a0);
        const c1 = Math.cos(a1);
        const s1 = Math.sin(a1);

        const n0 = [u[0] * c0 + v[0] * s0, u[1] * c0 + v[1] * s0, u[2] * c0 + v[2] * s0];
        const n1 = [u[0] * c1 + v[0] * s1, u[1] * c1 + v[1] * s1, u[2] * c1 + v[2] * s1];

        const pA0 = [pA[0] + n0[0] * rA, pA[1] + n0[1] * rA, pA[2] + n0[2] * rA];
        const pA1 = [pA[0] + n1[0] * rA, pA[1] + n1[1] * rA, pA[2] + n1[2] * rA];
        const pB1 = [pB[0] + n1[0] * rB, pB[1] + n1[1] * rB, pB[2] + n1[2] * rB];
        const pB0 = [pB[0] + n0[0] * rB, pB[1] + n0[1] * rB, pB[2] + n0[2] * rB];

        pushSmoothQuad(arrays, pA0, n0, pA1, n1, pB1, n1, pB0, n0, color, [ao, ao, ao, ao]);
    }
}

/**
 * Smooth ellipsoid / sphere (for heads, shoulders, ball, puffy 3D clouds).
 */
function pushSphere(arrays, cx, cy, cz, rx, ry, rz, latSegs, lonSegs, color, ao = 1.0) {
    for (let i = 0; i < latSegs; i++) {
        const phi0 = -Math.PI / 2 + (i / latSegs) * Math.PI;
        const phi1 = -Math.PI / 2 + ((i + 1) / latSegs) * Math.PI;
        for (let j = 0; j < lonSegs; j++) {
            const th0 = (j / lonSegs) * Math.PI * 2;
            const th1 = ((j + 1) / lonSegs) * Math.PI * 2;

            const vert = (phi, th) => {
                const nx = Math.cos(phi) * Math.cos(th);
                const ny = Math.sin(phi);
                const nz = Math.cos(phi) * Math.sin(th);
                return [
                    [cx + nx * rx, cy + ny * ry, cz + nz * rz],
                    [nx, ny, nz],
                ];
            };

            const [p00, n00] = vert(phi0, th0);
            const [p10, n10] = vert(phi0, th1);
            const [p11, n11] = vert(phi1, th1);
            const [p01, n01] = vert(phi1, th0);

            const aoBot = i === 0 ? ao * 0.85 : ao;
            pushSmoothQuad(arrays, p00, n00, p10, n10, p11, n11, p01, n01, color, [aoBot, aoBot, ao, ao]);
        }
    }
}

/**
 * Smooth contoured stadium bucket seat (curved shell backrest + contoured pan + pedestal).
 */
function pushCurvedSeat(arrays, pos, seatColor) {
    const yaw = Math.atan2(-pos[0], -pos[2]);
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const at = (lx, ly, lz) => [pos[0] + lx * cosY + lz * sinY, pos[1] + ly, pos[2] - lx * sinY + lz * cosY];

    const legCol = [0.22, 0.25, 0.30];
    const shadeCol = [seatColor[0] * 0.9, seatColor[1] * 0.9, seatColor[2] * 0.9];

    // Under-seat pedestal
    pushCylinder(arrays, at(0, 0, -0.04), at(0, 0.3, -0.02), 0.08, 0.09, 5, legCol, 0.8);

    // Rounded contoured seat cushion
    pushSphere(arrays, ...at(0, 0.33, 0.1), 0.31, 0.075, 0.27, 3, 8, seatColor, 0.98);

    // 3-panel curved ergonomic backrest wrapping softly around user's back
    const panels = [
        [-0.22, -0.13, 0.35],
        [0.0, -0.18, 0.0],
        [0.22, -0.13, -0.35],
    ];
    for (const [px, pz, tiltY] of panels) {
        const panelYaw = yaw + tiltY;
        const pCenter = at(px, 0.65, pz);
        pushBox(arrays, pCenter[0], pCenter[1], pCenter[2], 0.22, 0.64, 0.075, px === 0 ? seatColor : shadeCol, 1.0, panelYaw, -0.16);
    }
    // Rounded backrest top crest
    pushSphere(arrays, ...at(0, 0.96, -0.22), 0.28, 0.06, 0.06, 2, 6, seatColor, 1.0);
}

/**
 * Smooth seated spectator on the stands (curved shoulders + spherical head, colorful match jersey).
 */
function pushSmoothSpectator(arrays, pos, shirtCol, skinCol) {
    const yaw = Math.atan2(-pos[0], -pos[2]);
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const at = (lx, ly, lz) => [pos[0] + lx * cosY + lz * sinY, pos[1] + ly, pos[2] - lx * sinY + lz * cosY];

    // Seated thighs & torso
    pushCylinder(arrays, at(0, 0.32, 0.05), at(0, 0.42, 0.26), 0.22, 0.19, 5, [0.18, 0.22, 0.30], 0.9);
    pushCylinder(arrays, at(0, 0.38, 0.0), at(0, 0.92, -0.04), 0.22, 0.25, 6, shirtCol, 0.98);
    // Shoulders & head
    pushSphere(arrays, ...at(0, 0.90, -0.04), 0.28, 0.11, 0.15, 2, 6, shirtCol, 1.0);
    pushSphere(arrays, ...at(0, 1.14, -0.02), 0.15, 0.16, 0.15, 3, 6, skinCol, 1.0);
}

/**
 * Smooth articulated 3D football player (cylindrical limbs, spherical joints/head, jersey, shorts, socks, boots).
 */
function pushSmoothPlayer(arrays, x, z, yaw, stridePhase, speedFactor, jerseyCol, shortsCol, sockCol, skinCol) {
    const legSwing = Math.sin(stridePhase) * 0.42 * speedFactor;
    const armSwing = -legSwing * 0.85;
    const bounce = Math.abs(Math.cos(stridePhase)) * 0.07 * speedFactor;

    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const at = (lx, ly, lz) => [x + lx * cosY + lz * sinY, ly + bounce, z - lx * sinY + lz * cosY];

    // Soft circular ground shadow
    pushCylinder(arrays, [x, 0.02, z], [x, 0.035, z], 0.46, 0.46, 8, [0.14, 0.30, 0.12], 0.7);

    // Legs (Shorts thigh -> Socks calf -> Cleats)
    for (const [sideSign, swing] of [
        [-1, legSwing],
        [1, -legSwing],
    ]) {
        const lx = sideSign * 0.15;
        const hip = at(lx, 0.82, 0);
        const knee = at(lx, 0.46, Math.sin(swing) * 0.36);
        const ankle = at(lx, 0.10, Math.sin(swing) * 0.65);
        const toe = at(lx, 0.08, Math.sin(swing) * 0.65 + 0.18);

        pushCylinder(arrays, hip, knee, 0.12, 0.095, 6, shortsCol, 0.96);
        pushCylinder(arrays, knee, ankle, 0.08, 0.06, 6, sockCol, 0.96);
        pushCylinder(arrays, ankle, toe, 0.065, 0.055, 5, [0.10, 0.11, 0.14], 0.95);
    }

    // Tapered athletic torso & shoulders
    pushCylinder(arrays, at(0, 0.78, 0), at(0, 1.38, 0), 0.20, 0.27, 7, jerseyCol, 1.0);
    pushSphere(arrays, ...at(0, 1.35, 0), 0.31, 0.11, 0.16, 3, 7, jerseyCol, 1.0);

    // Swinging smooth arms (sleeve + forearm)
    for (const [sideSign, swing] of [
        [-1, armSwing],
        [1, -armSwing],
    ]) {
        const shoulder = at(sideSign * 0.29, 1.32, 0);
        const elbow = at(sideSign * 0.33, 1.06, Math.sin(swing) * 0.22);
        const hand = at(sideSign * 0.32, 0.86, Math.sin(swing) * 0.45);
        pushCylinder(arrays, shoulder, elbow, 0.075, 0.06, 5, jerseyCol, 0.98);
        pushCylinder(arrays, elbow, hand, 0.055, 0.045, 5, skinCol, 0.98);
    }

    // Neck, smooth spherical head & hair cap
    pushCylinder(arrays, at(0, 1.38, 0), at(0, 1.50, 0), 0.07, 0.07, 5, skinCol, 0.98);
    pushSphere(arrays, ...at(0, 1.62, 0.01), 0.15, 0.17, 0.16, 4, 7, skinCol, 1.0);
    pushSphere(arrays, ...at(0, 1.69, -0.02), 0.155, 0.10, 0.16, 3, 7, [0.16, 0.13, 0.11], 1.0);
}

/**
 * Silver metallic safety handrail segment between two points.
 */
function pushHandrailSegment(arrays, pStart, pEnd, height = 1.0) {
    const railCol = [0.84, 0.87, 0.91];
    const topA = [pStart[0], pStart[1] + height, pStart[2]];
    const topB = [pEnd[0], pEnd[1] + height, pEnd[2]];
    const midA = [pStart[0], pStart[1] + height * 0.55, pStart[2]];
    const midB = [pEnd[0], pEnd[1] + height * 0.55, pEnd[2]];

    pushCylinder(arrays, topA, topB, 0.036, 0.036, 5, railCol, 1.0);
    pushCylinder(arrays, midA, midB, 0.024, 0.024, 5, railCol, 0.95);

    const totalLen = Math.hypot(pEnd[0] - pStart[0], pEnd[1] - pStart[1], pEnd[2] - pStart[2]) || 1;
    const posts = Math.max(2, Math.round(totalLen / 1.9));
    for (let i = 0; i <= posts; i++) {
        const t = i / posts;
        const px = lerp(pStart[0], pEnd[0], t);
        const py = lerp(pStart[1], pEnd[1], t);
        const pz = lerp(pStart[2], pEnd[2], t);
        pushCylinder(arrays, [px, py, pz], [px, py + height, pz], 0.028, 0.028, 5, railCol, 0.92);
    }
}

function pushLowPolyTree(arrays, x, z, scale = 1.0, variant = 'round') {
    const trunkCol = [0.54, 0.36, 0.24];
    const leafCol = [0.45, 0.68, 0.25];

    if (variant === 'cypress') {
        const trunkH = 1.8 * scale;
        pushCylinder(arrays, [x, 0, z], [x, trunkH, z], 0.36 * scale, 0.25 * scale, 6, trunkCol, 0.85);
        pushCylinder(arrays, [x, trunkH * 0.85, z], [x, trunkH + 7.2 * scale, z], 1.85 * scale, 0.1 * scale, 7, [0.35, 0.58, 0.22], 0.95);
        return;
    }

    const trunkH = 3.2 * scale;
    pushCylinder(arrays, [x, 0, z], [x, trunkH, z], 0.42 * scale, 0.28 * scale, 6, trunkCol, 0.85);
    pushSphere(arrays, x, trunkH + 2.4 * scale, z, 3.0 * scale, 2.7 * scale, 3.0 * scale, 4, 7, leafCol, 0.98);
}

/**
 * 3D Volumetric Fluffy Cloud Cluster floating above the stadium rim.
 */
function buildCloudsMesh(gl) {
    const clouds = createArrayBucket();
    const cloudDefs = [
        [-115, 62, -145, 1.45],
        [-52, 74, -162, 1.75],
        [20, 68, -158, 1.55],
        [92, 64, -138, 1.4],
        [148, 66, -78, 1.35],
        [156, 76, 18, 1.55],
        [124, 65, 126, 1.4],
        [45, 78, 162, 1.7],
        [-45, 66, 154, 1.45],
        [-125, 70, 110, 1.38],
        [-156, 72, 12, 1.5],
        [-142, 68, -82, 1.42],
        [-22, 86, -65, 1.25],
        [52, 84, 58, 1.2],
        [-68, 82, 48, 1.28],
    ];

    const puffs = [
        [0, 0, 0, 15, 6.2, 11],
        [-12, -1.0, 2, 11, 5.2, 8.5],
        [12, -0.8, -2, 12, 5.5, 9],
        [-5, 3.2, -1, 10, 5.0, 8],
        [6, 2.8, 2, 9.2, 4.6, 7.5],
    ];

    for (const [cx, cy, cz, s] of cloudDefs) {
        for (const [ox, oy, oz, rx, ry, rz] of puffs) {
            pushSphere(clouds, cx + ox * s, cy + oy * s, cz + oz * s, rx * s, ry * s, rz * s, 5, 10, [1, 1, 1], 1.0);
        }
    }

    return createMeshBuffers(gl, clouds);
}

function createSkyTextureCanvas() {
    const w = 1024;
    const h = 512;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, '#1c539c');
    grad.addColorStop(0.45, '#468bd4');
    grad.addColorStop(0.78, '#95c9f4');
    grad.addColorStop(1.0, '#d8eeff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // High painted wispy clouds across sky dome
    for (let i = 0; i < 48; i++) {
        const cx = ((i * 211) % w);
        const cy = 150 + ((i * 89) % 210);
        const rx = 54 + ((i * 31) % 68);
        const ry = 14 + ((i * 13) % 18);
        const cGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, rx);
        cGrad.addColorStop(0, 'rgba(255, 255, 255, 0.56)');
        cGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.22)');
        cGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = cGrad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    return canvas;
}

function createPitchTextureCanvas(homeColor, awayColor) {
    const size = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#4c8e35';
    ctx.fillRect(0, 0, size, size);

    const padX = 148;
    const padY = 108;
    const fieldW = size - padX * 2;
    const fieldH = size - padY * 2;

    const stripes = 18;
    const stripeH = fieldH / stripes;
    for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#55a53c' : '#63b447';
        ctx.fillRect(padX, padY + i * stripeH, fieldW, stripeH + 1);
    }

    for (let i = 0; i < 4500; i++) {
        const rx = padX + ((i * 7919) % fieldW);
        const ry = padY + ((i * 104729) % fieldH);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(22,68,14,0.045)';
        ctx.fillRect(rx, ry, 3, 4);
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.lineWidth = 8.5;

    ctx.strokeRect(padX, padY, fieldW, fieldH);

    const midX = padX + fieldW / 2;
    const midY = padY + fieldH / 2;
    ctx.beginPath();
    ctx.moveTo(padX, midY);
    ctx.lineTo(padX + fieldW, midY);
    ctx.stroke();

    const circleR = fieldW * 0.135;
    ctx.beginPath();
    ctx.arc(midX, midY, circleR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(midX, midY, 10, 0, Math.PI * 2);
    ctx.fill();

    const boxW = fieldW * 0.59;
    const boxH = fieldH * 0.157;
    const goalBoxW = fieldW * 0.27;
    const goalBoxH = fieldH * 0.052;
    const penSpotDist = fieldH * 0.105;

    ctx.strokeRect(midX - boxW / 2, padY, boxW, boxH);
    ctx.strokeRect(midX - goalBoxW / 2, padY, goalBoxW, goalBoxH);
    ctx.beginPath();
    ctx.arc(midX, padY + penSpotDist, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(midX, padY + penSpotDist, circleR, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();

    ctx.strokeRect(midX - boxW / 2, padY + fieldH - boxH, boxW, boxH);
    ctx.strokeRect(midX - goalBoxW / 2, padY + fieldH - goalBoxH, goalBoxW, goalBoxH);
    ctx.beginPath();
    ctx.arc(midX, padY + fieldH - penSpotDist, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(midX, padY + fieldH - penSpotDist, circleR, 1.2 * Math.PI, 1.8 * Math.PI);
    ctx.stroke();

    const cornerR = 30;
    ctx.beginPath();
    ctx.arc(padX, padY, cornerR, 0, 0.5 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(padX + fieldW, padY, cornerR, 0.5 * Math.PI, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(padX + fieldW, padY + fieldH, cornerR, Math.PI, 1.5 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(padX, padY + fieldH, cornerR, 1.5 * Math.PI, 2 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = homeColor || '#d92d20';
    ctx.fillRect(padX, padY - 26, fieldW, 10);
    ctx.fillStyle = awayColor || '#1d4ed8';
    ctx.fillRect(padX, padY + fieldH + 16, fieldW, 10);

    return canvas;
}

function createSeatsTextureCanvas() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#3b3d44';
    ctx.fillRect(0, 0, size, size);

    const cols = 16;
    const rows = 8;
    const cw = size / cols;
    const rh = size / rows;

    for (let r = 0; r < rows; r++) {
        ctx.fillStyle = '#5a5f69';
        ctx.fillRect(0, r * rh, size, rh * 0.26);

        for (let c = 0; c < cols; c++) {
            const x = c * cw + 3;
            const y = r * rh + rh * 0.28;
            const w = cw - 6;
            const h = rh * 0.66;
            const tone = ((r * 23 + c * 13) % 4) * 9;
            ctx.fillStyle = `rgb(${215 + tone}, ${215 + tone}, ${218 + tone})`;
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, 5);
            ctx.fill();

            ctx.fillStyle = 'rgba(20, 20, 24, 0.24)';
            ctx.fillRect(x + 2, y + h * 0.56, w - 4, h * 0.22);
        }
    }

    return canvas;
}

function createLedBoardTextureCanvas(homeTeam, awayTeam, stadiumName) {
    const w = 1024;
    const h = 128;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#141a24';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#eab348';
    ctx.fillRect(0, 0, w, 10);
    ctx.fillRect(0, h - 10, w, 10);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${homeTeam}  vs  ${awayTeam}   ·   ${stadiumName.toUpperCase()}`, w / 2, h / 2);

    return canvas;
}

function createJumbotronTextureCanvas(homeShort, awayShort, homeColor, awayColor, stadiumName) {
    const w = 512;
    const h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#eab348';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    ctx.fillStyle = homeColor || '#d92d20';
    ctx.fillRect(46, 54, 118, 92);
    ctx.fillStyle = awayColor || '#1d4ed8';
    ctx.fillRect(w - 164, 54, 118, 92);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(homeShort, 105, 102);
    ctx.fillText(awayShort, w - 105, 102);

    ctx.fillStyle = '#eab348';
    ctx.font = '700 44px monospace';
    ctx.fillText('LIVE', w / 2, 100);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 18px sans-serif';
    ctx.fillText(stadiumName.toUpperCase(), w / 2, 198);

    return canvas;
}

function tierSeatColor(isUpperTier, isHighlightedSector) {
    if (isHighlightedSector) {
        return [0.95, 0.72, 0.24];
    }
    if (isUpperTier) {
        return [0.78, 0.75, 0.72];
    }
    return [0.71, 0.21, 0.19];
}

function buildStadiumGeometry(sectors, highlightSectorCode, activeSeatCoord, cameraMode, homeRgb, awayRgb) {
    const world = createArrayBucket();
    const sky = createArrayBucket();
    const pitch = createArrayBucket();
    const seats = createArrayBucket();
    const leds = createArrayBucket();
    const jumbotron = createArrayBucket();

    // 1. Sky Dome (320m radius)
    const skySegs = 40;
    const skyRings = 8;
    const skyRadius = 320;
    for (let r = 0; r < skyRings; r++) {
        const phi0 = -0.12 + (r / skyRings) * (Math.PI * 0.56);
        const phi1 = -0.12 + ((r + 1) / skyRings) * (Math.PI * 0.56);
        const y0 = Math.sin(phi0) * skyRadius;
        const y1 = Math.sin(phi1) * skyRadius;
        const rad0 = Math.cos(phi0) * skyRadius;
        const rad1 = Math.cos(phi1) * skyRadius;
        const v0 = 1.0 - r / skyRings;
        const v1 = 1.0 - (r + 1) / skyRings;

        for (let s = 0; s < skySegs; s++) {
            const a0 = (s / skySegs) * Math.PI * 2;
            const a1 = ((s + 1) / skySegs) * Math.PI * 2;
            const u0 = s / skySegs;
            const u1 = (s + 1) / skySegs;
            const p00 = [Math.cos(a0) * rad0, y0, Math.sin(a0) * rad0];
            const p10 = [Math.cos(a1) * rad0, y0, Math.sin(a1) * rad0];
            const p11 = [Math.cos(a1) * rad1, y1, Math.sin(a1) * rad1];
            const p01 = [Math.cos(a0) * rad1, y1, Math.sin(a0) * rad1];

            pushQuad(sky, p00, p10, p11, p01, [1, 1, 1], [u0, v0], [u1, v0], [u1, v1], [u0, v1]);
        }
    }

    // 2. Pitch plane
    const pw = 40;
    const pl = 58.5;
    pushQuad(
        pitch,
        [-pw, 0, -pl],
        [pw, 0, -pl],
        [pw, 0, pl],
        [-pw, 0, pl],
        [1, 1, 1],
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
    );

    // 3. Track apron & outer sunlit park surround
    const trackColor = [0.22, 0.25, 0.29];
    const parkGrass = [0.56, 0.77, 0.36];
    for (let deg = 0; deg < 360; deg += 5) {
        const a0 = deg;
        const a1 = deg + 5;
        const i0 = stadiumContourPoint(a0, -2, -0.04);
        const i1 = stadiumContourPoint(a1, -2, -0.04);
        const o0 = stadiumContourPoint(a0, 34, -0.04);
        const o1 = stadiumContourPoint(a1, 34, -0.04);
        pushQuad(world, i0, i1, o1, o0, trackColor);

        const p0 = stadiumContourPoint(a0, 56, -0.2);
        const p1 = stadiumContourPoint(a1, 56, -0.2);
        pushQuad(world, o0, o1, p1, p0, parkGrass);

        const pb0 = stadiumContourPoint(a0, 56, -4.5);
        const pb1 = stadiumContourPoint(a1, 56, -4.5);
        pushQuad(world, p0, p1, pb1, pb0, [0.84, 0.79, 0.73]);
    }

    // South entrance gate & trees
    pushBox(world, 0, -0.1, 114, 24, 0.3, 28, [0.92, 0.88, 0.83]);
    pushBox(world, -9.5, 4.2, 102, 4.2, 8.4, 4.2, [0.90, 0.85, 0.79]);
    pushBox(world, 9.5, 4.2, 102, 4.2, 8.4, 4.2, [0.90, 0.85, 0.79]);
    pushBox(world, 0, 8.8, 102, 25, 1.8, 5.4, [0.94, 0.90, 0.85]);

    for (const [tx, tz, ts, tv] of [
        [-68, -76, 1.35, 'round'],
        [-58, -88, 1.0, 'cypress'],
        [-42, -96, 1.25, 'round'],
        [44, -96, 1.3, 'round'],
        [62, -84, 1.05, 'cypress'],
        [74, -68, 1.4, 'round'],
        [86, -24, 1.2, 'round'],
        [88, 0, 1.05, 'cypress'],
        [86, 26, 1.35, 'round'],
        [72, 74, 1.3, 'round'],
        [56, 88, 1.0, 'cypress'],
        [38, 96, 1.2, 'round'],
        [-40, 96, 1.25, 'round'],
        [-60, 86, 1.0, 'cypress'],
        [-74, 70, 1.35, 'round'],
        [-86, 24, 1.2, 'round'],
        [-88, -2, 1.05, 'cypress'],
        [-86, -28, 1.3, 'round'],
    ]) {
        pushLowPolyTree(world, tx, tz, ts, tv);
    }

    // 4. Goals (smooth cylindrical white goalposts + net)
    const goalWhite = [0.99, 0.99, 1.0];
    const netTint = [0.85, 0.90, 0.96];
    for (const sign of [-1, 1]) {
        const gz = sign * 52.5;
        const backZ = gz + sign * 2.3;
        const postX = 3.66;
        const height = 2.44;

        pushCylinder(world, [-postX, 0, gz], [-postX, height, gz], 0.08, 0.08, 6, goalWhite);
        pushCylinder(world, [postX, 0, gz], [postX, height, gz], 0.08, 0.08, 6, goalWhite);
        pushCylinder(world, [-postX, height, gz], [postX, height, gz], 0.08, 0.08, 6, goalWhite);

        pushBox(world, -postX, height / 2, backZ, 0.08, height, 0.08, netTint);
        pushBox(world, postX, height / 2, backZ, 0.08, height, 0.08, netTint);
        pushBox(world, 0, height, backZ, postX * 2, 0.07, 0.07, netTint);
        pushBox(world, -postX, height, (gz + backZ) / 2, 0.07, 0.07, 2.3, netTint);
        pushBox(world, postX, height, (gz + backZ) / 2, 0.07, 0.07, 2.3, netTint);

        for (let nx = -3.2; nx <= 3.2; nx += 0.8) {
            pushBox(world, nx, height / 2, backZ, 0.025, height, 0.025, netTint);
        }
        for (let ny = 0.6; ny < height; ny += 0.6) {
            pushBox(world, 0, ny, backZ, postX * 2, 0.025, 0.025, netTint);
        }
    }

    // Sleek team dugouts
    for (const zCenter of [-15, 15]) {
        pushBox(world, -38.2, 0.85, zCenter, 1.9, 1.7, 9.2, [0.14, 0.16, 0.20], 0.9);
        pushBox(world, -38.1, 1.75, zCenter, 2.1, 0.18, 9.4, [0.24, 0.27, 0.32], 1.0);
    }

    // Corner flags
    for (const [cx, cz] of [
        [-34, -52.5],
        [34, -52.5],
        [34, 52.5],
        [-34, 52.5],
    ]) {
        pushCylinder(world, [cx, 0, cz], [cx, 1.6, cz], 0.04, 0.035, 5, [0.98, 0.98, 1.0]);
        pushBox(world, cx + 0.24, 1.44, cz, 0.44, 0.28, 0.04, [0.94, 0.3, 0.2]);
    }

    // 5. Animated LED Advertising Perimeter Boards
    for (let deg = -45; deg < 315; deg += 15) {
        const a0 = deg;
        const a1 = deg + 15;
        const b0 = stadiumContourPoint(a0, -0.45, 0.02);
        const b1 = stadiumContourPoint(a1, -0.45, 0.02);
        const t0 = stadiumContourPoint(a0, -0.45, 1.05);
        const t1 = stadiumContourPoint(a1, -0.45, 1.05);
        const u0 = ((deg + 45) % 60) / 60;
        const u1 = u0 + 0.25;
        pushQuad(leds, b0, b1, t1, t0, [1, 1, 1], [u0, 1], [u1, 1], [u1, 0], [u0, 0]);
    }

    // 6. Nearby sectors get smooth 3D curved seats; all sectors get lively spectators
    const activeIndex = sectors.findIndex((s) => s.code === activeSeatCoord?.sectorCode);
    const totalSectors = sectors.length;
    const isNearCameraSector = (idx) => {
        if (cameraMode !== 'seat' || activeIndex < 0) {
            return false;
        }
        const diff = Math.abs(idx - activeIndex);
        return diff <= 1 || diff >= totalSectors - 1;
    };

    const shirtPalette = [
        homeRgb,
        awayRgb,
        [0.95, 0.95, 0.97],
        [0.92, 0.72, 0.24],
        [0.86, 0.26, 0.22],
        [0.24, 0.44, 0.80],
    ];
    const skinPalette = [
        [0.92, 0.75, 0.62],
        [0.82, 0.62, 0.48],
        [0.65, 0.46, 0.35],
    ];

    // 7. Multi-Tier Stadium Bowl with Overhanging 2nd Tier, Curved Seats, Handrails & Crowd
    for (let sIdx = 0; sIdx < totalSectors; sIdx++) {
        const sector = sectors[sIdx];
        const isHighlighted = sector.code === highlightSectorCode;
        const nearCamera = isNearCameraSector(sIdx);

        const aStart = Number(sector.angle_start) + 0.65;
        const aEnd = Number(sector.angle_end) - 0.65;
        const totalRows = Math.max(1, Number(sector.rows_count) || 20);
        const lowerRows = Math.ceil(totalRows * 0.5);

        const riserColor = [0.24, 0.27, 0.31];
        const concreteStep = [0.30, 0.33, 0.38];
        const stairColor = [0.42, 0.45, 0.50];

        const w0 = stadiumContourPoint(aStart, 1.4, 0);
        const w1 = stadiumContourPoint(aEnd, 1.4, 0);
        const wt0 = stadiumContourPoint(aStart, 1.4, 2.1);
        const wt1 = stadiumContourPoint(aEnd, 1.4, 2.1);
        pushQuad(world, w0, w1, wt1, wt0, [0.20, 0.22, 0.26], [0, 0], [1, 0], [1, 1], [0, 1], [0.76, 0.76, 0.96, 0.96]);
        pushHandrailSegment(world, wt0, wt1, 0.92);

        const subSteps = 8;
        const stepAngle = (aEnd - aStart) / subSteps;

        const lowerEndD = 2.0 + lowerRows * 1.15;
        const lowerEndY = 2.1 + lowerRows * 0.65;
        const upperStartD = lowerEndD - 1.6;
        const upperStartY = lowerEndY + 3.2;

        for (let r = 1; r <= totalRows; r++) {
            const isUpper = r > lowerRows;
            let d0;
            let yBase;
            let yTop;

            if (!isUpper) {
                d0 = 2.0 + (r - 1) * 1.15;
                yBase = 2.1 + (r - 1) * 0.65;
                yTop = yBase + 0.65;
            } else {
                const upperIdx = r - lowerRows - 1;
                d0 = upperStartD + upperIdx * 1.15;
                yBase = upperStartY + upperIdx * 0.72;
                yTop = yBase + 0.72;
            }
            const d1 = d0 + 1.14;

            const rowAo = !isUpper && r > lowerRows - 2 ? 0.78 : isUpper ? lerp(0.98, 0.80, (r - lowerRows) / Math.max(1, totalRows - lowerRows)) : 0.98;
            const baseSeatCol = tierSeatColor(isUpper, isHighlighted);
            const rowShade = r % 2 === 0 ? 1.0 : 0.93;
            const seatCol = [
                clamp(baseSeatCol[0] * rowShade, 0, 1),
                clamp(baseSeatCol[1] * rowShade, 0, 1),
                clamp(baseSeatCol[2] * rowShade, 0, 1),
            ];

            for (let s = 0; s < subSteps; s++) {
                const sa0 = aStart + s * stepAngle;
                const sa1 = sa0 + stepAngle;

                const rb0 = stadiumContourPoint(sa0, d0, yBase);
                const rb1 = stadiumContourPoint(sa1, d0, yBase);
                const rt0 = stadiumContourPoint(sa0, d0, yTop);
                const rt1 = stadiumContourPoint(sa1, d0, yTop);
                pushQuad(world, rb0, rb1, rt1, rt0, riserColor, [0, 0], [1, 0], [1, 1], [0, 1], [rowAo * 0.82, rowAo * 0.82, rowAo, rowAo]);

                const st0 = stadiumContourPoint(sa0, d0, yTop);
                const st1 = stadiumContourPoint(sa1, d0, yTop);
                const sb0 = stadiumContourPoint(sa0, d1, yTop);
                const sb1 = stadiumContourPoint(sa1, d1, yTop);

                if (nearCamera) {
                    pushQuad(world, st0, st1, sb1, sb0, concreteStep, [0, 0], [1, 0], [1, 1], [0, 1], [rowAo, rowAo, rowAo * 0.92, rowAo * 0.92]);
                } else {
                    const u0 = (s / subSteps) * 2.2;
                    const u1 = ((s + 1) / subSteps) * 2.2;
                    const v0 = (r - 1) * 0.125;
                    const v1 = r * 0.125;
                    pushQuad(seats, st0, st1, sb1, sb0, seatCol, [u0, v0], [u1, v0], [u1, v1], [u0, v1], [rowAo, rowAo, rowAo * 0.92, rowAo * 0.92]);
                }
            }

            const seatsPerRow = Math.max(1, Number(sector.seats_per_row) || 30);
            const span = Number(sector.angle_end) - Number(sector.angle_start);

            if (nearCamera) {
                for (let seatNum = 1; seatNum <= seatsPerRow; seatNum++) {
                    const isCameraSeat =
                        activeSeatCoord &&
                        activeSeatCoord.sectorCode === sector.code &&
                        activeSeatCoord.rowNumber === r &&
                        activeSeatCoord.seatNumber === seatNum;
                    if (isCameraSeat) {
                        continue;
                    }
                    const seatFrac = (seatNum - 0.5) / seatsPerRow;
                    const sAngle = Number(sector.angle_start) + span * seatFrac;
                    const sp = stadiumContourPoint(sAngle, d0 + 0.54, yTop);
                    pushCurvedSeat(world, sp, seatCol);

                    // Add seated fans on ~45% of nearby seats (keeping +-3 seats beside user open so view stays unobstructed)
                    const distFromUser =
                        activeSeatCoord && activeSeatCoord.sectorCode === sector.code
                            ? Math.abs(activeSeatCoord.rowNumber - r) + Math.abs(activeSeatCoord.seatNumber - seatNum)
                            : 99;
                    const fanHash = (sIdx * 31 + r * 17 + seatNum * 13) % 11;
                    if (distFromUser > 3 && fanHash < 5) {
                        pushSmoothSpectator(
                            world,
                            sp,
                            shirtPalette[(sIdx + r + seatNum) % shirtPalette.length],
                            skinPalette[(r + seatNum) % skinPalette.length],
                        );
                    }
                }
            } else {
                // Lively crowd density across opposite stands so stadium feels packed and vibrant
                for (let seatNum = 1; seatNum <= seatsPerRow; seatNum += 2) {
                    const fanHash = (sIdx * 29 + r * 19 + seatNum * 7) % 5;
                    if (fanHash > 2) {
                        continue;
                    }
                    const seatFrac = (seatNum - 0.5) / seatsPerRow;
                    const sAngle = Number(sector.angle_start) + span * seatFrac;
                    const sp = stadiumContourPoint(sAngle, d0 + 0.54, yTop);
                    pushSmoothSpectator(
                        world,
                        sp,
                        shirtPalette[(sIdx + seatNum + r) % shirtPalette.length],
                        skinPalette[(seatNum + r) % skinPalette.length],
                    );
                }
            }
        }

        // Overhanging 2nd Tier Balcony Fascia, Dark Soffit & VIP Skybox Windows
        const rBal0 = stadiumContourPoint(aStart, upperStartD, upperStartY);
        const rBal1 = stadiumContourPoint(aEnd, upperStartD, upperStartY);
        pushHandrailSegment(world, rBal0, rBal1, 0.92);

        for (let s = 0; s < subSteps; s++) {
            const sa0 = aStart + s * stepAngle;
            const sa1 = sa0 + stepAngle;

            // Recessed VIP glass skybox wall behind lower tier
            const g0 = stadiumContourPoint(sa0, lowerEndD, lowerEndY);
            const g1 = stadiumContourPoint(sa1, lowerEndD, lowerEndY);
            const gt0 = stadiumContourPoint(sa0, lowerEndD, upperStartY);
            const gt1 = stadiumContourPoint(sa1, lowerEndD, upperStartY);
            const glassCol = s % 2 === 0 ? [0.22, 0.35, 0.44] : [0.14, 0.21, 0.28];
            pushQuad(world, g0, g1, gt1, gt0, glassCol, [0, 0], [1, 0], [1, 1], [0, 1], [0.68, 0.68, 0.88, 0.88]);

            // Overhang soffit connecting lower back wall forward to 2nd tier lip
            const u0 = stadiumContourPoint(sa0, upperStartD, upperStartY);
            const u1 = stadiumContourPoint(sa1, upperStartD, upperStartY);
            pushQuad(world, gt0, gt1, u1, u0, [0.18, 0.20, 0.24], [0, 0], [1, 0], [1, 1], [0, 1], [0.7, 0.7, 0.9, 0.9]);
        }

        // Recessed Dark Vomitory Tunnel Mouth
        const midAng = (aStart + aEnd) / 2;
        const vomD = upperStartD + 3 * 1.15;
        const vomY = upperStartY + 3 * 0.72;
        const vL = stadiumContourPoint(midAng - 1.4, vomD, vomY);
        const vR = stadiumContourPoint(midAng + 1.4, vomD, vomY);
        const vLT = stadiumContourPoint(midAng - 1.4, vomD, vomY + 2.2);
        const vRT = stadiumContourPoint(midAng + 1.4, vomD, vomY + 2.2);
        pushQuad(world, vL, vR, vRT, vLT, [0.06, 0.08, 0.11]);

        // Concrete Stairway Aisles + Silver Handrails
        const upperEndD = upperStartD + (totalRows - lowerRows) * 1.15;
        const upperEndY = upperStartY + (totalRows - lowerRows) * 0.72;
        for (const boundaryAngle of [Number(sector.angle_start), Number(sector.angle_end)]) {
            const bA0 = boundaryAngle - 0.55;
            const bA1 = boundaryAngle + 0.55;
            const sb0 = stadiumContourPoint(bA0, 1.8, 2.1);
            const sb1 = stadiumContourPoint(bA1, 1.8, 2.1);
            const st0 = stadiumContourPoint(bA0, lowerEndD, lowerEndY);
            const st1 = stadiumContourPoint(bA1, lowerEndD, lowerEndY);
            pushQuad(world, sb0, sb1, st1, st0, stairColor);

            const ub0 = stadiumContourPoint(bA0, upperStartD, upperStartY);
            const ub1 = stadiumContourPoint(bA1, upperStartD, upperStartY);
            const ut0 = stadiumContourPoint(bA0, upperEndD, upperEndY);
            const ut1 = stadiumContourPoint(bA1, upperEndD, upperEndY);
            pushQuad(world, ub0, ub1, ut1, ut0, stairColor);

            pushHandrailSegment(
                world,
                stadiumContourPoint(boundaryAngle, 2.0, 2.2),
                stadiumContourPoint(boundaryAngle, lowerEndD, lowerEndY),
                0.85,
            );
            pushHandrailSegment(
                world,
                stadiumContourPoint(boundaryAngle, upperStartD, upperStartY),
                stadiumContourPoint(boundaryAngle, upperEndD, upperEndY),
                0.85,
            );
        }
    }

    // 8. Architectural Cantilevered Roof Canopy + Steel Trusses
    const roofUndersideCol = [0.76, 0.72, 0.65];
    const roofTopCol = [0.54, 0.56, 0.60];
    const roofRimCol = [0.44, 0.47, 0.52];
    const trussCol = [0.36, 0.40, 0.46];

    for (let deg = -45; deg < 315; deg += 5) {
        const a0 = deg;
        const a1 = deg + 5;

        const ri0 = stadiumContourPoint(a0, 6.8, 30.0);
        const ri1 = stadiumContourPoint(a1, 6.8, 30.0);
        const ro0 = stadiumContourPoint(a0, 36.0, 26.2);
        const ro1 = stadiumContourPoint(a1, 36.0, 26.2);

        const ti0 = stadiumContourPoint(a0, 6.8, 30.8);
        const ti1 = stadiumContourPoint(a1, 6.8, 30.8);
        const to0 = stadiumContourPoint(a0, 36.0, 27.0);
        const to1 = stadiumContourPoint(a1, 36.0, 27.0);

        pushQuad(world, ro0, ro1, ri1, ri0, roofUndersideCol, [0, 0], [1, 0], [1, 1], [0, 1], [0.72, 0.72, 0.94, 0.94]);
        pushQuad(world, ti0, ti1, to1, to0, roofTopCol);
        pushQuad(world, ri0, ri1, ti1, ti0, roofRimCol);

        const fw0 = stadiumContourPoint(a0, 35.5, 0);
        const fw1 = stadiumContourPoint(a1, 35.5, 0);
        pushQuad(world, fw0, fw1, ro1, ro0, [0.72, 0.69, 0.66], [0, 0], [1, 0], [1, 1], [0, 1], [0.78, 0.78, 0.96, 0.96]);

        if (deg % 10 === 0) {
            const rb0 = stadiumContourPoint(a0 - 0.38, 7.0, 29.3);
            const rb1 = stadiumContourPoint(a0 + 0.38, 7.0, 29.3);
            const rbo0 = stadiumContourPoint(a0 - 0.38, 35.5, 25.5);
            const rbo1 = stadiumContourPoint(a0 + 0.38, 35.5, 25.5);
            pushQuad(world, rbo0, rbo1, rb1, rb0, trussCol);
        }
    }

    // 9. Suspended Scoreboards & Roof-Mounted Floodlights
    for (const [ang, faceSign] of [
        [0, 1],
        [180, -1],
    ]) {
        const jp = stadiumContourPoint(ang, 12.0, 25.4);
        pushBox(world, jp[0], jp[1], jp[2], 14.5, 5.2, 0.9, [0.14, 0.17, 0.22]);

        const zFace = jp[2] + faceSign * 0.48;
        const hw = 6.8;
        const hh = 2.3;
        if (faceSign > 0) {
            pushQuad(
                jumbotron,
                [jp[0] - hw, jp[1] - hh, zFace],
                [jp[0] + hw, jp[1] - hh, zFace],
                [jp[0] + hw, jp[1] + hh, zFace],
                [jp[0] - hw, jp[1] + hh, zFace],
                [1, 1, 1],
                [0, 1],
                [1, 1],
                [1, 0],
                [0, 0],
            );
        } else {
            pushQuad(
                jumbotron,
                [jp[0] + hw, jp[1] - hh, zFace],
                [jp[0] - hw, jp[1] - hh, zFace],
                [jp[0] - hw, jp[1] + hh, zFace],
                [jp[0] + hw, jp[1] + hh, zFace],
                [1, 1, 1],
                [0, 1],
                [1, 1],
                [1, 0],
                [0, 0],
            );
        }
    }

    for (const lightAngle of [-28, 28, 152, 208]) {
        const lp = stadiumContourPoint(lightAngle, 14.0, 32.6);
        pushCylinder(world, [lp[0], lp[1] - 3.0, lp[2]], [lp[0], lp[1], lp[2]], 0.22, 0.22, 6, [0.75, 0.78, 0.82]);
        pushBox(world, lp[0], lp[1], lp[2], 8.2, 2.2, 0.7, [0.98, 0.98, 1.0]);
    }

    return { world, sky, pitch, seats, leds, jumbotron };
}

/**
 * Full 22-player (11 vs 11) + Referee smooth animated match simulation!
 */
function buildAnimatedMatchFrame(elapsedSec, homeRgb, awayRgb) {
    const dyn = createArrayBucket();
    const t = elapsedSec * 0.62;

    // Smooth dynamic ball arc across midfield & penalty boxes
    const ballX = Math.sin(t * 1.05) * 19 + Math.sin(t * 2.2) * 5;
    const ballZ = Math.sin(t * 0.68) * 35;
    const ballBounce = Math.abs(Math.sin(elapsedSec * 4.2)) * 0.26;

    // Smooth spherical soccer ball + ground shadow
    pushCylinder(dyn, [ballX, 0.02, ballZ], [ballX, 0.035, ballZ], 0.34, 0.34, 8, [0.14, 0.30, 0.12], 0.7);
    pushSphere(dyn, ballX, 0.24 + ballBounce, ballZ, 0.23, 0.23, 0.23, 4, 7, [0.98, 0.98, 1.0], 1.0);

    const homeShorts = [0.96, 0.96, 0.98];
    const awayShorts = [0.14, 0.18, 0.28];
    const gkHomeCol = [0.22, 0.75, 0.62];
    const gkAwayCol = [0.94, 0.74, 0.22];
    const refCol = [0.96, 0.84, 0.18];
    const skins = [
        [0.92, 0.75, 0.62],
        [0.82, 0.62, 0.48],
        [0.65, 0.46, 0.35],
    ];

    // 2 Goalkeepers
    const gkNorthX = clamp(ballX * 0.24, -4.2, 4.2);
    pushSmoothPlayer(dyn, gkNorthX, -48.5, 0, elapsedSec * 3.5, 0.35, gkHomeCol, [0.12, 0.14, 0.18], gkHomeCol, skins[0]);

    const gkSouthX = clamp(ballX * 0.24, -4.2, 4.2);
    pushSmoothPlayer(dyn, gkSouthX, 48.5, Math.PI, elapsedSec * 3.5 + 1.2, 0.35, gkAwayCol, [0.12, 0.14, 0.18], gkAwayCol, skins[1]);

    // 1 Referee near play
    const refX = clamp(ballX * 0.55 - 8, -26, 26);
    const refZ = clamp(ballZ * 0.65 + 4, -38, 38);
    pushSmoothPlayer(
        dyn,
        refX,
        refZ,
        Math.atan2(ballX - refX, ballZ - refZ),
        elapsedSec * 5.8,
        0.7,
        refCol,
        [0.12, 0.13, 0.16],
        [0.12, 0.13, 0.16],
        skins[2],
    );

    // 10 Outfield Home + 10 Outfield Away (4-3-3 tactical shapes shifting dynamically with the ball)
    const formation10 = [
        [-22, -32],
        [-8, -35],
        [8, -35],
        [22, -32],
        [-16, -14],
        [0, -16],
        [16, -14],
        [-19, 8],
        [0, 14],
        [19, 8],
    ];

    for (let i = 0; i < formation10.length; i++) {
        const [bx, bz] = formation10[i];
        const pull = i >= 7 ? 0.36 : i >= 4 ? 0.28 : 0.18;

        const hx = lerp(bx, ballX + (i - 4.5) * 2.5, pull) + Math.sin(t * 1.25 + i * 1.1) * 3.2;
        const hz = lerp(bz, ballZ - 5, pull) + Math.cos(t * 1.05 + i * 1.5) * 4.0;
        const hyaw = Math.atan2(ballX - hx, ballZ - hz);
        pushSmoothPlayer(
            dyn,
            clamp(hx, -31, 31),
            clamp(hz, -47, 47),
            hyaw,
            elapsedSec * 7.2 + i * 0.9,
            0.9,
            homeRgb,
            homeShorts,
            homeRgb,
            skins[i % skins.length],
        );

        const ax = lerp(-bx, ballX - (i - 4.5) * 2.5, pull) + Math.cos(t * 1.2 + i * 1.3) * 3.2;
        const az = lerp(-bz, ballZ + 5, pull) + Math.sin(t * 1.1 + i * 1.7) * 4.0;
        const ayaw = Math.atan2(ballX - ax, ballZ - az);
        pushSmoothPlayer(
            dyn,
            clamp(ax, -31, 31),
            clamp(az, -47, 47),
            ayaw,
            elapsedSec * 7.4 + i * 1.4,
            0.9,
            awayRgb,
            awayShorts,
            awayRgb,
            skins[(i + 1) % skins.length],
        );
    }

    return dyn;
}

/**
 * Generates falling 3D rain streaks around the stadium & viewer when weather === 'rain'.
 */
function buildRainStreaks(elapsedSec, anchorPos) {
    const rain = createArrayBucket();
    const drops = 210;
    const fallSpeed = 34;
    const rainCol = [0.78, 0.88, 0.98];

    for (let i = 0; i < drops; i++) {
        const rx = anchorPos[0] + (((i * 73) % 140) - 70);
        const rz = anchorPos[2] + (((i * 137) % 140) - 70);
        const phase = (i * 0.37 + elapsedSec * fallSpeed) % 44;
        const ry = 42 - phase;

        const p0 = [rx, ry, rz];
        const p1 = [rx + 0.18, ry - 2.3, rz + 0.1];
        const p2 = [rx + 0.24, ry - 2.3, rz + 0.14];
        const p3 = [rx + 0.06, ry, rz + 0.04];
        pushQuad(rain, p0, p1, p2, p3, rainCol);
    }

    return rain;
}

/**
 * Environment target presets for Time-of-Day + Weather simulation.
 */
function computeEnvironmentPreset(timeOfDay, weather) {
    const baseTime = {
        day: {
            sunDir: [0.55, 0.85, 0.42],
            sunColor: [1.0, 0.96, 0.88],
            sunStrength: 0.60,
            skyTop: [0.12, 0.36, 0.68],
            skyHorizon: [0.76, 0.89, 0.99],
            ambientTop: [0.64, 0.74, 0.88],
            ambientBot: [0.46, 0.44, 0.42],
            fogColor: [0.75, 0.88, 0.98],
            cloudTint: [1.0, 1.0, 1.0],
            cloudAlpha: 0.92,
            floodlight: 0.08,
        },
        sunset: {
            sunDir: [0.85, 0.28, -0.44],
            sunColor: [1.0, 0.62, 0.32],
            sunStrength: 0.72,
            skyTop: [0.16, 0.22, 0.44],
            skyHorizon: [0.96, 0.62, 0.38],
            ambientTop: [0.68, 0.56, 0.62],
            ambientBot: [0.42, 0.32, 0.28],
            fogColor: [0.84, 0.62, 0.50],
            cloudTint: [1.0, 0.78, 0.62],
            cloudAlpha: 0.92,
            floodlight: 0.42,
        },
        night: {
            sunDir: [0.25, 0.92, 0.25],
            sunColor: [0.92, 0.95, 1.0],
            sunStrength: 0.46,
            skyTop: [0.025, 0.055, 0.14],
            skyHorizon: [0.09, 0.16, 0.32],
            ambientTop: [0.28, 0.34, 0.48],
            ambientBot: [0.22, 0.24, 0.30],
            fogColor: [0.07, 0.13, 0.26],
            cloudTint: [0.22, 0.28, 0.42],
            cloudAlpha: 0.65,
            floodlight: 0.95,
        },
    }[timeOfDay] || {
        sunDir: [0.55, 0.85, 0.42],
        sunColor: [1.0, 0.96, 0.88],
        sunStrength: 0.60,
        skyTop: [0.12, 0.36, 0.68],
        skyHorizon: [0.76, 0.89, 0.99],
        ambientTop: [0.64, 0.74, 0.88],
        ambientBot: [0.46, 0.44, 0.42],
        fogColor: [0.75, 0.88, 0.98],
        cloudTint: [1.0, 1.0, 1.0],
        cloudAlpha: 0.92,
        floodlight: 0.08,
    };

    const result = {
        ...baseTime,
        wetness: 0.0,
        fogDensity: 0.22,
    };

    if (weather === 'cloudy') {
        result.sunStrength *= 0.42;
        result.skyTop = lerpVec3(result.skyTop, [0.36, 0.43, 0.52], 0.55);
        result.skyHorizon = lerpVec3(result.skyHorizon, [0.64, 0.70, 0.78], 0.6);
        result.cloudTint = lerpVec3(result.cloudTint, [0.72, 0.76, 0.82], 0.65);
        result.fogColor = lerpVec3(result.fogColor, [0.56, 0.63, 0.72], 0.55);
        result.fogDensity = 0.34;
        result.floodlight = Math.max(result.floodlight, 0.32);
    } else if (weather === 'rain') {
        result.sunStrength *= 0.28;
        result.skyTop = lerpVec3(result.skyTop, [0.22, 0.28, 0.36], 0.72);
        result.skyHorizon = lerpVec3(result.skyHorizon, [0.46, 0.53, 0.62], 0.75);
        result.cloudTint = lerpVec3(result.cloudTint, [0.52, 0.58, 0.66], 0.8);
        result.fogColor = lerpVec3(result.fogColor, [0.42, 0.49, 0.58], 0.7);
        result.fogDensity = 0.48;
        result.wetness = 1.0;
        result.floodlight = Math.max(result.floodlight, 0.55);
    }

    return result;
}

function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) || 'Shader compilation failed');
    }

    return shader;
}

function createProgram(gl, vsSource, fsSource) {
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vsSource));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || 'Program link failed');
    }

    return program;
}

function createMeshBuffers(gl, arrays, usage = gl.STATIC_DRAW) {
    const count = arrays.positions.length / 3;
    const buffers = {
        position: gl.createBuffer(),
        normal: gl.createBuffer(),
        color: gl.createBuffer(),
        uv: gl.createBuffer(),
        ao: gl.createBuffer(),
        count,
    };

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arrays.positions), usage);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arrays.normals), usage);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arrays.colors), usage);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.uv);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arrays.uvs), usage);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.ao);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arrays.aos), usage);

    return buffers;
}

function updateDynamicBuffers(gl, buffers, arrays) {
    buffers.count = arrays.positions.length / 3;

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arrays.positions), gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arrays.normals), gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arrays.colors), gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.uv);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arrays.uvs), gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.ao);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arrays.aos), gl.DYNAMIC_DRAW);
}

function uploadTexture(gl, canvas, wrapS = gl.CLAMP_TO_EDGE, wrapT = gl.CLAMP_TO_EDGE, anisoExt = null) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);

    if (anisoExt) {
        const maxAniso = gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 4;
        gl.texParameterf(gl.TEXTURE_2D, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, maxAniso));
    }

    return tex;
}

export class Stadium3DViewer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.sectors = options.sectors || [];
        this.homeColor = options.homeColor || '#d92d20';
        this.awayColor = options.awayColor || '#1d4ed8';
        this.homeRgb = hexToRgbNorm(this.homeColor, [0.85, 0.25, 0.18]);
        this.awayRgb = hexToRgbNorm(this.awayColor, [0.16, 0.42, 0.85]);
        this.homeTeam = options.homeTeam || 'PERSIJA';
        this.awayTeam = options.awayTeam || 'PERSIB';
        this.homeShort = options.homeShort || 'PRJ';
        this.awayShort = options.awayShort || 'PSB';
        this.stadiumName = options.stadiumName || 'Stadion Utama Gelora Bung Karno';

        this.activeSector = this.sectors[4] || this.sectors[0];
        this.rowNumber = 6;
        this.seatNumber = 3;
        this.cameraMode = 'seat';

        // Time & Weather Simulation state
        this.timeOfDay = 'day'; // 'day' | 'sunset' | 'night'
        this.weather = 'clear'; // 'clear' | 'cloudy' | 'rain'
        this.envCurrent = computeEnvironmentPreset('day', 'clear');
        this.envTarget = computeEnvironmentPreset('day', 'clear');

        this.targetYawOffset = 0;
        this.currentYawOffset = 0;
        this.targetPitchOffset = 0;
        this.currentPitchOffset = 0;
        this.targetFov = 54;
        this.currentFov = 54;
        this.targetOverviewAngle = 0.65;
        this.currentOverviewAngle = 0.65;

        this.currentEye = null;
        this.currentTarget = null;
        this.targetEye = null;
        this.targetLookAt = null;
        this.transitionProgress = 1;

        this.gl = null;
        this.isFallback2D = false;
        this.rafId = null;
        this.startTime = performance.now();
        this.lastFrameTime = performance.now();

        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;

        this.init();
    }

    init() {
        const gl = this.canvas.getContext('webgl', { antialias: true, alpha: false });
        if (!gl) {
            this.isFallback2D = true;
            this.bindPointerEvents();
            this.updateCameraTargets(true);
            this.startLoop();
            return;
        }

        this.gl = gl;
        const anisoExt =
            gl.getExtension('EXT_texture_filter_anisotropic') ||
            gl.getExtension('MOZ_EXT_texture_filter_anisotropic') ||
            gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');

        const vs = `
            attribute vec3 aPosition;
            attribute vec3 aNormal;
            attribute vec3 aColor;
            attribute vec2 aUv;
            attribute float aAo;
            uniform mat4 uProjection;
            uniform mat4 uView;
            uniform vec3 uOffset;
            varying vec3 vNormal;
            varying vec3 vColor;
            varying vec2 vUv;
            varying vec3 vWorldPos;
            varying float vAo;
            void main() {
                vec3 wp = aPosition + uOffset;
                vNormal = aNormal;
                vColor = aColor;
                vUv = aUv;
                vWorldPos = wp;
                vAo = aAo;
                gl_Position = uProjection * uView * vec4(wp, 1.0);
            }
        `;

        const fs = `
            precision mediump float;
            varying vec3 vNormal;
            varying vec3 vColor;
            varying vec2 vUv;
            varying vec3 vWorldPos;
            varying float vAo;
            uniform sampler2D uTexture;
            uniform float uRenderMode; // 0=solid, 1=pitch, 2=seats, 3=led, 3.4=jumbotron, 3.8=sky, 4.2=cloud, 4.6=rain
            uniform float uTime;
            uniform vec3 uCameraPos;
            uniform vec3 uSunDir;
            uniform vec3 uSunColor;
            uniform float uSunStrength;
            uniform vec3 uSkyTop;
            uniform vec3 uSkyHorizon;
            uniform vec3 uAmbientTop;
            uniform vec3 uAmbientBot;
            uniform vec3 uFogColor;
            uniform float uFogDensity;
            uniform vec3 uCloudTint;
            uniform float uCloudAlpha;
            uniform float uFloodlight;
            uniform float uWetness;

            void main() {
                if (uRenderMode > 4.4) {
                    gl_FragColor = vec4(vColor, 0.45);
                    return;
                }

                if (uRenderMode > 4.0) {
                    vec3 n = normalize(vNormal);
                    float topLight = 0.72 + 0.28 * max(n.y, 0.0);
                    gl_FragColor = vec4(uCloudTint * topLight, uCloudAlpha);
                    return;
                }

                if (uRenderMode > 3.6) {
                    float h = clamp(vWorldPos.y / 210.0, 0.0, 1.0);
                    vec3 skyGrad = mix(uSkyHorizon, uSkyTop, pow(h, 0.65));
                    vec3 cloudTex = texture2D(uTexture, vec2(fract(vUv.x + uTime * 0.004), vUv.y)).rgb;
                    float cloudMask = clamp((cloudTex.r - 0.55) * 1.4, 0.0, 0.45);
                    vec3 finalSky = mix(skyGrad, uCloudTint, cloudMask * (1.0 - h * 0.6));
                    gl_FragColor = vec4(finalSky, 1.0);
                    return;
                }

                if (uRenderMode > 2.5) {
                    vec2 uv = vUv;
                    if (uRenderMode < 3.2) {
                        uv.x = fract(uv.x + uTime * 0.032);
                    }
                    vec3 tex = texture2D(uTexture, uv).rgb;
                    gl_FragColor = vec4(tex * (0.95 + 0.35 * uFloodlight), 1.0);
                    return;
                }

                vec3 n = normalize(vNormal);
                vec3 viewDir = normalize(uCameraPos - vWorldPos);
                vec3 sunDir = normalize(uSunDir);
                float sunDiff = max(dot(n, sunDir), 0.0);

                // Stadium floodlight illumination (active at sunset, night & rain)
                vec3 flDir1 = normalize(vec3(0.45, 0.86, 0.35));
                vec3 flDir2 = normalize(vec3(-0.45, 0.86, -0.35));
                float flDiff = (max(dot(n, flDir1), 0.0) + max(dot(n, flDir2), 0.0)) * 0.45 * uFloodlight;

                vec3 hemi = mix(uAmbientBot, uAmbientTop, n.y * 0.5 + 0.5);
                vec3 lightTotal = hemi + uSunColor * sunDiff * uSunStrength + vec3(0.95, 0.97, 1.0) * flDiff;

                vec3 base = vColor;
                float specPower = 24.0;
                float specStrength = 0.08;

                if (uRenderMode > 1.5) {
                    vec3 seatTex = texture2D(uTexture, vUv).rgb;
                    base = vColor * (0.58 + 0.52 * seatTex);
                } else if (uRenderMode > 0.5) {
                    base = texture2D(uTexture, vUv).rgb;
                    // Stadium center spotlight boost during evening/night floodlights
                    float pitchRadial = length(vWorldPos.xz * vec2(0.022, 0.015));
                    float centerBoost = mix(1.0 + 0.25 * uFloodlight, 0.85, clamp(pitchRadial, 0.0, 1.0));
                    base *= centerBoost;
                    specStrength = 0.05 + 0.32 * uWetness;
                    specPower = 40.0;
                }

                vec3 halfVec = normalize(sunDir + viewDir);
                float spec = pow(max(dot(n, halfVec), 0.0), specPower) * specStrength;

                vec3 lit = base * lightTotal * vAo + vec3(spec) * vAo;
                float dist = length(vWorldPos - uCameraPos);
                float fog = clamp((dist - 140.0) / 185.0, 0.0, uFogDensity);
                gl_FragColor = vec4(mix(lit, uFogColor, fog), 1.0);
            }
        `;

        this.program = createProgram(gl, vs, fs);
        this.attribs = {
            position: gl.getAttribLocation(this.program, 'aPosition'),
            normal: gl.getAttribLocation(this.program, 'aNormal'),
            color: gl.getAttribLocation(this.program, 'aColor'),
            uv: gl.getAttribLocation(this.program, 'aUv'),
            ao: gl.getAttribLocation(this.program, 'aAo'),
        };
        this.uniforms = {
            projection: gl.getUniformLocation(this.program, 'uProjection'),
            view: gl.getUniformLocation(this.program, 'uView'),
            offset: gl.getUniformLocation(this.program, 'uOffset'),
            texture: gl.getUniformLocation(this.program, 'uTexture'),
            renderMode: gl.getUniformLocation(this.program, 'uRenderMode'),
            time: gl.getUniformLocation(this.program, 'uTime'),
            cameraPos: gl.getUniformLocation(this.program, 'uCameraPos'),
            sunDir: gl.getUniformLocation(this.program, 'uSunDir'),
            sunColor: gl.getUniformLocation(this.program, 'uSunColor'),
            sunStrength: gl.getUniformLocation(this.program, 'uSunStrength'),
            skyTop: gl.getUniformLocation(this.program, 'uSkyTop'),
            skyHorizon: gl.getUniformLocation(this.program, 'uSkyHorizon'),
            ambientTop: gl.getUniformLocation(this.program, 'uAmbientTop'),
            ambientBot: gl.getUniformLocation(this.program, 'uAmbientBot'),
            fogColor: gl.getUniformLocation(this.program, 'uFogColor'),
            fogDensity: gl.getUniformLocation(this.program, 'uFogDensity'),
            cloudTint: gl.getUniformLocation(this.program, 'uCloudTint'),
            cloudAlpha: gl.getUniformLocation(this.program, 'uCloudAlpha'),
            floodlight: gl.getUniformLocation(this.program, 'uFloodlight'),
            wetness: gl.getUniformLocation(this.program, 'uWetness'),
        };

        this.skyTexture = uploadTexture(gl, createSkyTextureCanvas(), gl.REPEAT, gl.CLAMP_TO_EDGE, anisoExt);
        this.pitchTexture = uploadTexture(gl, createPitchTextureCanvas(this.homeColor, this.awayColor), gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, anisoExt);
        this.seatsTexture = uploadTexture(gl, createSeatsTextureCanvas(), gl.REPEAT, gl.REPEAT, anisoExt);
        this.ledTexture = uploadTexture(gl, createLedBoardTextureCanvas(this.homeTeam, this.awayTeam, this.stadiumName), gl.REPEAT, gl.CLAMP_TO_EDGE, anisoExt);
        this.jumbotronTexture = uploadTexture(gl, createJumbotronTextureCanvas(this.homeShort, this.awayShort, this.homeColor, this.awayColor, this.stadiumName), gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, anisoExt);

        this.cloudsMesh = buildCloudsMesh(gl);
        this.dynamicMesh = createMeshBuffers(gl, buildAnimatedMatchFrame(0, this.homeRgb, this.awayRgb), gl.DYNAMIC_DRAW);
        this.rainMesh = createMeshBuffers(gl, buildRainStreaks(0, [0, 0, 0]), gl.DYNAMIC_DRAW);

        this.rebuildGeometry();
        this.bindPointerEvents();
        this.updateCameraTargets(true);
        this.startLoop();
    }

    setEnvironment({ timeOfDay, weather }) {
        if (timeOfDay) {
            this.timeOfDay = timeOfDay;
        }
        if (weather) {
            this.weather = weather;
        }
        this.envTarget = computeEnvironmentPreset(this.timeOfDay, this.weather);
    }

    rebuildGeometry() {
        if (!this.gl || !this.activeSector) {
            return;
        }

        const highlightCode = this.cameraMode === 'overview' ? this.activeSector.code : null;
        const activeSeatCoord = {
            sectorCode: this.activeSector.code,
            rowNumber: this.rowNumber,
            seatNumber: this.seatNumber,
        };

        const geom = buildStadiumGeometry(
            this.sectors,
            highlightCode,
            activeSeatCoord,
            this.cameraMode,
            this.homeRgb,
            this.awayRgb,
        );

        if (this.cameraMode === 'overview') {
            const seatInfo = seatWorldPosition(this.activeSector, this.rowNumber, this.seatNumber);
            const sb = seatInfo.seatBase;
            pushBox(geom.world, sb[0], sb[1] + 0.7, sb[2], 1.7, 1.4, 1.7, [0.96, 0.74, 0.24]);
        }

        this.worldMesh = createMeshBuffers(this.gl, geom.world);
        this.skyMesh = createMeshBuffers(this.gl, geom.sky);
        this.pitchMesh = createMeshBuffers(this.gl, geom.pitch);
        this.seatsMesh = createMeshBuffers(this.gl, geom.seats);
        this.ledMesh = createMeshBuffers(this.gl, geom.leds);
        this.jumbotronMesh = createMeshBuffers(this.gl, geom.jumbotron);
    }

    setSeat({ sector, rowNumber, seatNumber, immediate = false }) {
        const sectorChanged = !this.activeSector || this.activeSector.code !== sector.code;
        this.activeSector = sector;
        this.rowNumber = Number(rowNumber);
        this.seatNumber = Number(seatNumber);

        if (sectorChanged || this.cameraMode === 'seat' || this.cameraMode === 'overview' || !immediate) {
            this.rebuildGeometry();
        }

        this.updateCameraTargets(immediate);
    }

    setCameraMode(mode) {
        this.cameraMode = mode === 'overview' ? 'overview' : 'seat';
        this.targetYawOffset = 0;
        this.targetPitchOffset = 0;
        this.rebuildGeometry();
        this.updateCameraTargets(false);
    }

    resetLookDirection() {
        this.targetYawOffset = 0;
        this.targetPitchOffset = 0;
        this.targetFov = 54;
        this.updateCameraTargets(false);
    }

    adjustZoom(deltaFov) {
        this.targetFov = clamp(this.targetFov + deltaFov, 36, 74);
    }

    updateCameraTargets(immediate = false) {
        if (!this.activeSector) {
            return;
        }

        if (this.cameraMode === 'overview') {
            const radius = 128;
            this.targetEye = [
                Math.sin(this.currentOverviewAngle) * radius,
                76,
                Math.cos(this.currentOverviewAngle) * radius,
            ];
            this.targetLookAt = [0, 3, 0];
        } else {
            const seatInfo = seatWorldPosition(this.activeSector, this.rowNumber, this.seatNumber);
            this.targetEye = seatInfo.position;

            const baseDx = -seatInfo.position[0];
            const baseDz = -seatInfo.position[2];
            const horizDist = Math.hypot(baseDx, baseDz) || 1;
            const baseYaw = Math.atan2(baseDx, baseDz);
            const lookYaw = baseYaw + this.currentYawOffset;

            const basePitch = Math.atan2(1.5 - seatInfo.position[1], horizDist);
            const lookPitch = clamp(basePitch + this.currentPitchOffset, -0.78, 0.58);

            const cosP = Math.cos(lookPitch);
            const lookDist = 52;
            this.targetLookAt = [
                seatInfo.position[0] + Math.sin(lookYaw) * cosP * lookDist,
                seatInfo.position[1] + Math.sin(lookPitch) * lookDist,
                seatInfo.position[2] + Math.cos(lookYaw) * cosP * lookDist,
            ];
        }

        if (immediate || !this.currentEye || !this.currentTarget) {
            this.currentEye = [...this.targetEye];
            this.currentTarget = [...this.targetLookAt];
            this.transitionProgress = 1;
        } else {
            this.fromEye = [...this.currentEye];
            this.fromTarget = [...this.currentTarget];
            this.transitionProgress = 0;
        }
    }

    bindPointerEvents() {
        const onDown = (clientX, clientY) => {
            this.isDragging = true;
            this.dragStartX = clientX;
            this.dragStartY = clientY;
        };

        const onMove = (clientX, clientY) => {
            if (!this.isDragging) {
                return;
            }
            const dx = clientX - this.dragStartX;
            const dy = clientY - this.dragStartY;
            this.dragStartX = clientX;
            this.dragStartY = clientY;

            if (this.cameraMode === 'overview') {
                this.targetOverviewAngle -= dx * 0.008;
            } else {
                this.targetYawOffset = clamp(this.targetYawOffset + dx * 0.0048, -1.35, 1.35);
                this.targetPitchOffset = clamp(this.targetPitchOffset - dy * 0.004, -0.45, 0.58);
            }
        };

        const onUp = () => {
            this.isDragging = false;
        };

        this.canvas.addEventListener('mousedown', (event) => onDown(event.clientX, event.clientY));
        window.addEventListener('mousemove', (event) => onMove(event.clientX, event.clientY));
        window.addEventListener('mouseup', onUp);

        this.canvas.addEventListener(
            'touchstart',
            (event) => {
                if (event.touches[0]) {
                    onDown(event.touches[0].clientX, event.touches[0].clientY);
                }
            },
            { passive: true },
        );
        this.canvas.addEventListener(
            'touchmove',
            (event) => {
                if (event.touches[0]) {
                    onMove(event.touches[0].clientX, event.touches[0].clientY);
                }
            },
            { passive: true },
        );
        window.addEventListener('touchend', onUp);

        this.canvas.addEventListener(
            'wheel',
            (event) => {
                event.preventDefault();
                this.adjustZoom(event.deltaY > 0 ? 3 : -3);
            },
            { passive: false },
        );
    }

    resizeCanvas() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const displayW = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
        const displayH = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));

        if (this.canvas.width !== displayW || this.canvas.height !== displayH) {
            this.canvas.width = displayW;
            this.canvas.height = displayH;
        }
    }

    bindMesh(mesh) {
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.position);
        gl.enableVertexAttribArray(this.attribs.position);
        gl.vertexAttribPointer(this.attribs.position, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normal);
        gl.enableVertexAttribArray(this.attribs.normal);
        gl.vertexAttribPointer(this.attribs.normal, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.color);
        gl.enableVertexAttribArray(this.attribs.color);
        gl.vertexAttribPointer(this.attribs.color, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uv);
        gl.enableVertexAttribArray(this.attribs.uv);
        gl.vertexAttribPointer(this.attribs.uv, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.ao);
        gl.enableVertexAttribArray(this.attribs.ao);
        gl.vertexAttribPointer(this.attribs.ao, 1, gl.FLOAT, false, 0, 0);
    }

    renderFrame(now) {
        const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
        this.lastFrameTime = now;
        const elapsedSec = (now - this.startTime) / 1000;

        // Smoothly interpolate environment weather & time of day
        const envDamp = 1 - Math.exp(-5.5 * dt);
        this.envCurrent.sunDir = lerpVec3(this.envCurrent.sunDir, this.envTarget.sunDir, envDamp);
        this.envCurrent.sunColor = lerpVec3(this.envCurrent.sunColor, this.envTarget.sunColor, envDamp);
        this.envCurrent.sunStrength = lerp(this.envCurrent.sunStrength, this.envTarget.sunStrength, envDamp);
        this.envCurrent.skyTop = lerpVec3(this.envCurrent.skyTop, this.envTarget.skyTop, envDamp);
        this.envCurrent.skyHorizon = lerpVec3(this.envCurrent.skyHorizon, this.envTarget.skyHorizon, envDamp);
        this.envCurrent.ambientTop = lerpVec3(this.envCurrent.ambientTop, this.envTarget.ambientTop, envDamp);
        this.envCurrent.ambientBot = lerpVec3(this.envCurrent.ambientBot, this.envTarget.ambientBot, envDamp);
        this.envCurrent.fogColor = lerpVec3(this.envCurrent.fogColor, this.envTarget.fogColor, envDamp);
        this.envCurrent.fogDensity = lerp(this.envCurrent.fogDensity, this.envTarget.fogDensity, envDamp);
        this.envCurrent.cloudTint = lerpVec3(this.envCurrent.cloudTint, this.envTarget.cloudTint, envDamp);
        this.envCurrent.cloudAlpha = lerp(this.envCurrent.cloudAlpha, this.envTarget.cloudAlpha, envDamp);
        this.envCurrent.floodlight = lerp(this.envCurrent.floodlight, this.envTarget.floodlight, envDamp);
        this.envCurrent.wetness = lerp(this.envCurrent.wetness, this.envTarget.wetness, envDamp);

        const damp = 1 - Math.exp(-11 * dt);
        this.currentFov = lerp(this.currentFov, this.targetFov, damp);

        const lookChanged =
            Math.abs(this.currentYawOffset - this.targetYawOffset) > 0.0004 ||
            Math.abs(this.currentPitchOffset - this.targetPitchOffset) > 0.0004 ||
            Math.abs(this.currentOverviewAngle - this.targetOverviewAngle) > 0.0004;

        this.currentYawOffset = lerp(this.currentYawOffset, this.targetYawOffset, damp);
        this.currentPitchOffset = lerp(this.currentPitchOffset, this.targetPitchOffset, damp);
        this.currentOverviewAngle = lerp(this.currentOverviewAngle, this.targetOverviewAngle, damp);

        if (lookChanged && this.transitionProgress >= 1) {
            this.updateCameraTargets(true);
        }

        if (this.transitionProgress < 1 && this.fromEye && this.targetEye) {
            this.transitionProgress = Math.min(1, this.transitionProgress + dt * 2.0);
            const t = easeOutCubic(this.transitionProgress);
            this.currentEye = lerpVec3(this.fromEye, this.targetEye, t);
            this.currentTarget = lerpVec3(this.fromTarget, this.targetLookAt, t);
        }

        this.resizeCanvas();

        if (this.isFallback2D) {
            this.renderFallback2D();
            return;
        }

        const gl = this.gl;
        if (!gl || !this.worldMesh || !this.pitchMesh) {
            return;
        }

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(this.envCurrent.skyHorizon[0], this.envCurrent.skyHorizon[1], this.envCurrent.skyHorizon[2], 1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(this.program);

        const aspect = this.canvas.width / Math.max(1, this.canvas.height);
        const projection = mat4Perspective(this.currentFov, aspect, 0.4, 540);
        const view = mat4LookAt(this.currentEye, this.currentTarget);

        gl.uniformMatrix4fv(this.uniforms.projection, false, projection);
        gl.uniformMatrix4fv(this.uniforms.view, false, view);
        gl.uniform3f(this.uniforms.offset, 0, 0, 0);
        gl.uniform1f(this.uniforms.time, elapsedSec);
        gl.uniform3fv(this.uniforms.cameraPos, new Float32Array(this.currentEye));
        gl.uniform3fv(this.uniforms.sunDir, new Float32Array(this.envCurrent.sunDir));
        gl.uniform3fv(this.uniforms.sunColor, new Float32Array(this.envCurrent.sunColor));
        gl.uniform1f(this.uniforms.sunStrength, this.envCurrent.sunStrength);
        gl.uniform3fv(this.uniforms.skyTop, new Float32Array(this.envCurrent.skyTop));
        gl.uniform3fv(this.uniforms.skyHorizon, new Float32Array(this.envCurrent.skyHorizon));
        gl.uniform3fv(this.uniforms.ambientTop, new Float32Array(this.envCurrent.ambientTop));
        gl.uniform3fv(this.uniforms.ambientBot, new Float32Array(this.envCurrent.ambientBot));
        gl.uniform3fv(this.uniforms.fogColor, new Float32Array(this.envCurrent.fogColor));
        gl.uniform1f(this.uniforms.fogDensity, this.envCurrent.fogDensity);
        gl.uniform3fv(this.uniforms.cloudTint, new Float32Array(this.envCurrent.cloudTint));
        gl.uniform1f(this.uniforms.cloudAlpha, this.envCurrent.cloudAlpha);
        gl.uniform1f(this.uniforms.floodlight, this.envCurrent.floodlight);
        gl.uniform1f(this.uniforms.wetness, this.envCurrent.wetness);

        // 1. Sky Dome
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.skyTexture);
        gl.uniform1i(this.uniforms.texture, 0);
        gl.uniform1f(this.uniforms.renderMode, 3.8);
        this.bindMesh(this.skyMesh);
        gl.drawArrays(gl.TRIANGLES, 0, this.skyMesh.count);

        // 2. Drifting 3D Fluffy Clouds
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.uniform3f(this.uniforms.offset, Math.sin(elapsedSec * 0.04) * 14, 0, 0);
        gl.uniform1f(this.uniforms.renderMode, 4.2);
        this.bindMesh(this.cloudsMesh);
        gl.drawArrays(gl.TRIANGLES, 0, this.cloudsMesh.count);
        gl.disable(gl.BLEND);
        gl.uniform3f(this.uniforms.offset, 0, 0, 0);

        // 3. Stadium Bowl, Curved Seats, Overhanging Upper Tier, Handrails, Crowd & Trees
        gl.uniform1f(this.uniforms.renderMode, 0.0);
        this.bindMesh(this.worldMesh);
        gl.drawArrays(gl.TRIANGLES, 0, this.worldMesh.count);

        // 4. Smooth 22-Player + Referee Animated Football Match
        const dynArrays = buildAnimatedMatchFrame(elapsedSec, this.homeRgb, this.awayRgb);
        updateDynamicBuffers(gl, this.dynamicMesh, dynArrays);
        this.bindMesh(this.dynamicMesh);
        gl.drawArrays(gl.TRIANGLES, 0, this.dynamicMesh.count);

        // 5. Pitch Grass (with wet specular sheen in rain)
        gl.bindTexture(gl.TEXTURE_2D, this.pitchTexture);
        gl.uniform1f(this.uniforms.renderMode, 1.0);
        this.bindMesh(this.pitchMesh);
        gl.drawArrays(gl.TRIANGLES, 0, this.pitchMesh.count);

        // 6. Distant Textured Stands
        gl.bindTexture(gl.TEXTURE_2D, this.seatsTexture);
        gl.uniform1f(this.uniforms.renderMode, 2.0);
        this.bindMesh(this.seatsMesh);
        gl.drawArrays(gl.TRIANGLES, 0, this.seatsMesh.count);

        // 7. LED Boards & Jumbotrons
        gl.bindTexture(gl.TEXTURE_2D, this.ledTexture);
        gl.uniform1f(this.uniforms.renderMode, 3.0);
        this.bindMesh(this.ledMesh);
        gl.drawArrays(gl.TRIANGLES, 0, this.ledMesh.count);

        gl.bindTexture(gl.TEXTURE_2D, this.jumbotronTexture);
        gl.uniform1f(this.uniforms.renderMode, 3.4);
        this.bindMesh(this.jumbotronMesh);
        gl.drawArrays(gl.TRIANGLES, 0, this.jumbotronMesh.count);

        // 8. Animated 3D Rain Streaks (when weather === 'rain')
        if (this.weather === 'rain') {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            const rainArrays = buildRainStreaks(elapsedSec, this.cameraMode === 'overview' ? [0, 0, 0] : this.currentEye);
            updateDynamicBuffers(gl, this.rainMesh, rainArrays);
            gl.uniform1f(this.uniforms.renderMode, 4.6);
            this.bindMesh(this.rainMesh);
            gl.drawArrays(gl.TRIANGLES, 0, this.rainMesh.count);
            gl.disable(gl.BLEND);
        }
    }

    renderFallback2D() {
        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            return;
        }
        const w = this.canvas.width;
        const h = this.canvas.height;
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#4287cf');
        grad.addColorStop(0.55, '#8dc4f2');
        grad.addColorStop(1, '#55a53c');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#0e1c36';
        ctx.font = '600 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
            `Sudut Pandang Sektor ${this.activeSector?.code || '05'} · Baris ${this.rowNumber} · Kursi ${this.seatNumber}`,
            w / 2,
            h / 2,
        );
    }

    startLoop() {
        const tick = (now) => {
            this.renderFrame(now);
            this.rafId = requestAnimationFrame(tick);
        };
        this.rafId = requestAnimationFrame(tick);
    }

    destroy() {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }
}
