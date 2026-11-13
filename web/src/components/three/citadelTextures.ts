import * as THREE from "three";

export interface PbrMapSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
}

export interface SimplePbrMaps {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

type TextureRegistry = <T extends THREE.Texture>(tex: T) => T;

/**
 * Deterministic PRNG so procedural masonry veins and fractures never jitter across mounts.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to acquire 2D context for procedural citadel texture.");
  }
  return [canvas, ctx];
}

function toTexture(
  canvas: HTMLCanvasElement,
  regTex: TextureRegistry,
  {
    repeatX = 1,
    repeatY = 1,
    srgb = false,
    clamp = false,
  }: { repeatX?: number; repeatY?: number; srgb?: boolean; clamp?: boolean } = {}
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  const wrap = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.wrapS = wrap;
  tex.wrapT = wrap;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return regTex(tex);
}

/**
 * Draws a polyline in toroidal UV space (wrapping seamlessly across all 4 canvas edges).
 */
function strokeWrappedPolyline(
  ctx: CanvasRenderingContext2D,
  size: number,
  pts: Array<[number, number]>
) {
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const px = pts[i][0] + ox * size;
        const py = pts[i][1] + oy * size;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
}

function generateFractureBranch(
  rand: () => number,
  size: number,
  startX: number,
  startY: number,
  baseAngle: number,
  steps: number,
  stepLen: number
): Array<[number, number]> {
  const pts: Array<[number, number]> = [[startX, startY]];
  let x = startX;
  let y = startY;
  let angle = baseAngle;
  for (let i = 0; i < steps; i++) {
    angle += (rand() - 0.5) * 0.85;
    x += Math.cos(angle) * stepLen;
    y += Math.sin(angle) * stepLen;
    pts.push([x, y]);
  }
  return pts;
}

/**
 * Generates seamless tileable PBR texture sets tailored per Citadel tier:
 * - Tier 1: Heavy staggered Volcanic Basalt ashlar blocks with branching molten magma veins.
 * - Tier 2: Vertical Glacial Slate masonry laced with glossy frost rime fractures.
 * - Tier 3: Glossy Void Obsidian monolithic plates etched with arcane circuit channels.
 */
export function createTierPbrTextures(
  tier: 1 | 2 | 3,
  regTex: TextureRegistry
): PbrMapSet {
  const S = 256;
  const rand = mulberry32(tier * 1337 + 97);

  const [colCan, colCtx] = createCanvas(S);
  const [bumpCan, bumpCtx] = createCanvas(S);
  const [roughCan, roughCtx] = createCanvas(S);
  const [emissCan, emissCtx] = createCanvas(S);

  const palette =
    tier === 1
      ? {
          bg: "#131015",
          stoneMin: [28, 22, 24] as const,
          stoneVar: [18, 13, 12] as const,
          rim: "rgba(92, 64, 42, 0.36)",
          rows: 6,
          cols: 4,
          roughBase: 184,
          roughMin: 145,
          recessRough: 238,
          bumpBase: 192,
          veinCount: 11,
          veinSpread: 0.72,
          repeatX: 4,
          repeatY: 2,
        }
      : tier === 2
        ? {
            bg: "#0e121c",
            stoneMin: [22, 28, 42] as const,
            stoneVar: [14, 18, 24] as const,
            rim: "rgba(130, 184, 224, 0.28)",
            rows: 4,
            cols: 6,
            roughBase: 188,
            roughMin: 34, // Sharp specular frost fractures
            recessRough: 95,
            bumpBase: 186,
            veinCount: 15,
            veinSpread: 0.48,
            repeatX: 4,
            repeatY: 2,
          }
        : {
            bg: "#090812",
            stoneMin: [15, 13, 25] as const,
            stoneVar: [10, 9, 18] as const,
            rim: "rgba(148, 108, 212, 0.24)",
            rows: 3,
            cols: 8,
            roughBase: 54, // Glossy dark obsidian glass panels
            roughMin: 36,
            recessRough: 168,
            bumpBase: 205,
            veinCount: 12,
            veinSpread: 0.14,
            repeatX: 4,
            repeatY: 2,
          };

  colCtx.fillStyle = palette.bg;
  colCtx.fillRect(0, 0, S, S);
  bumpCtx.fillStyle = "rgb(28,28,28)";
  bumpCtx.fillRect(0, 0, S, S);
  roughCtx.fillStyle = `rgb(${palette.recessRough},${palette.recessRough},${palette.recessRough})`;
  roughCtx.fillRect(0, 0, S, S);
  emissCtx.fillStyle = "#000000";
  emissCtx.fillRect(0, 0, S, S);

  const rowH = S / palette.rows;
  const colW = S / palette.cols;
  const mortar = tier === 1 ? 3.5 : tier === 2 ? 2.8 : 2.2;

  for (let r = 0; r < palette.rows; r++) {
    const stagger = tier === 1 && r % 2 === 1 ? colW * 0.5 : 0;
    for (let c = -1; c <= palette.cols; c++) {
      const bx = c * colW + stagger;
      const by = r * rowH;
      const bw = colW - mortar;
      const bh = rowH - mortar;

      const shade = rand();
      const cr = Math.round(palette.stoneMin[0] + shade * palette.stoneVar[0]);
      const cg = Math.round(palette.stoneMin[1] + shade * palette.stoneVar[1]);
      const cb = Math.round(palette.stoneMin[2] + shade * palette.stoneVar[2]);

      colCtx.fillStyle = `rgb(${cr},${cg},${cb})`;
      colCtx.fillRect(bx + mortar * 0.5, by + mortar * 0.5, bw, bh);

      // Subtle chiseled top/left bevel gleam
      colCtx.strokeStyle = palette.rim;
      colCtx.lineWidth = 1.4;
      colCtx.strokeRect(bx + mortar * 0.5 + 1, by + mortar * 0.5 + 1, bw - 2, bh - 2);

      // Bump height block
      const bVal = Math.round(palette.bumpBase + (shade - 0.5) * 34);
      bumpCtx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
      bumpCtx.fillRect(bx + mortar * 0.5, by + mortar * 0.5, bw, bh);
      bumpCtx.strokeStyle = "rgba(95,95,95,0.85)";
      bumpCtx.lineWidth = 2;
      bumpCtx.strokeRect(bx + mortar * 0.5 + 0.5, by + mortar * 0.5 + 0.5, bw - 1, bh - 1);

      // Roughness per block
      const rVal = Math.round(palette.roughBase + (shade - 0.5) * 28);
      roughCtx.fillStyle = `rgb(${rVal},${rVal},${rVal})`;
      roughCtx.fillRect(bx + mortar * 0.5, by + mortar * 0.5, bw, bh);
    }
  }

  // Fine mineral grain speckles wrapped across edges
  const speckCount = tier === 1 ? 650 : tier === 2 ? 520 : 280;
  for (let i = 0; i < speckCount; i++) {
    const px = rand() * S;
    const py = rand() * S;
    const ps = 1 + rand() * 2.2;
    const bright = rand() > 0.5;
    colCtx.fillStyle = bright ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.18)";
    colCtx.fillRect(px, py, ps, ps);

    const bm = bright ? 218 : 112;
    bumpCtx.fillStyle = `rgba(${bm},${bm},${bm},0.35)`;
    bumpCtx.fillRect(px, py, ps, ps);
  }

  // Elemental fractures / icy rime fissures / void arcane circuitry (neutral white emissive mask
  // so MeshStandardMaterial.emissive color seamlessly follows any tier color cascade!)
  emissCtx.lineCap = "round";
  emissCtx.lineJoin = "round";

  if (tier === 3) {
    // Crisp geometric vertical Void Sanctum circuit traces & node junctions
    for (let i = 0; i < palette.cols; i++) {
      const cx = i * colW + colW * 0.5;
      if (i % 2 === 0) {
        const circuitPts: Array<[number, number]> = [
          [cx, 0],
          [cx, S * 0.28],
          [cx + (i % 4 === 0 ? 7 : -7), S * 0.36],
          [cx + (i % 4 === 0 ? 7 : -7), S * 0.64],
          [cx, S * 0.72],
          [cx, S],
        ];
        emissCtx.strokeStyle = "rgba(185, 185, 185, 0.34)";
        emissCtx.lineWidth = 3.2;
        strokeWrappedPolyline(emissCtx, S, circuitPts);
        emissCtx.strokeStyle = "rgba(255, 255, 255, 0.78)";
        emissCtx.lineWidth = 1.1;
        strokeWrappedPolyline(emissCtx, S, circuitPts);

        // Etched channel groove in bump & matte channel in roughness
        bumpCtx.strokeStyle = "rgb(55, 55, 55)";
        bumpCtx.lineWidth = 2.4;
        strokeWrappedPolyline(bumpCtx, S, circuitPts);

        // Diamond glyph node midpoint
        emissCtx.fillStyle = "rgba(255,255,255,0.92)";
        emissCtx.beginPath();
        const ny = S * 0.5;
        const nx = cx + (i % 4 === 0 ? 7 : -7);
        emissCtx.moveTo(nx, ny - 5);
        emissCtx.lineTo(nx + 4.5, ny);
        emissCtx.lineTo(nx, ny + 5);
        emissCtx.lineTo(nx - 4.5, ny);
        emissCtx.closePath();
        emissCtx.fill();
      }
    }
  } else {
    // Tier 1 magma fissures & Tier 2 jagged ice rime veins
    for (let v = 0; v < palette.veinCount; v++) {
      const sx = rand() * S;
      const sy = tier === 1 ? S * (0.35 + rand() * 0.6) : rand() * S;
      const baseAngle = tier === 1 ? -Math.PI * 0.5 + (rand() - 0.5) * palette.veinSpread : rand() * Math.PI * 2;
      const pts = generateFractureBranch(rand, S, sx, sy, baseAngle, 8 + Math.floor(rand() * 5), 11);

      // Soft outer halo on emissive mask
      emissCtx.strokeStyle = tier === 1 ? "rgba(180, 180, 180, 0.38)" : "rgba(170, 170, 170, 0.32)";
      emissCtx.lineWidth = tier === 1 ? 4.2 : 3.2;
      strokeWrappedPolyline(emissCtx, S, pts);

      // Razor bright vein core
      emissCtx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      emissCtx.lineWidth = tier === 1 ? 1.35 : 1.05;
      strokeWrappedPolyline(emissCtx, S, pts);

      // Deepened crack on bump map + specular glint on ice veins (Tier 2)
      bumpCtx.strokeStyle = tier === 1 ? "rgb(30,30,30)" : "rgb(245,245,245)";
      bumpCtx.lineWidth = 2.0;
      strokeWrappedPolyline(bumpCtx, S, pts);

      roughCtx.strokeStyle = `rgb(${palette.roughMin},${palette.roughMin},${palette.roughMin})`;
      roughCtx.lineWidth = tier === 2 ? 3.0 : 2.2;
      strokeWrappedPolyline(roughCtx, S, pts);

      if (tier === 2) {
        colCtx.strokeStyle = "rgba(180, 224, 255, 0.22)";
        colCtx.lineWidth = 1.8;
        strokeWrappedPolyline(colCtx, S, pts);
      }
    }
  }

  return {
    map: toTexture(colCan, regTex, {
      repeatX: palette.repeatX,
      repeatY: palette.repeatY,
      srgb: true,
    }),
    bumpMap: toTexture(bumpCan, regTex, {
      repeatX: palette.repeatX,
      repeatY: palette.repeatY,
    }),
    roughnessMap: toTexture(roughCan, regTex, {
      repeatX: palette.repeatX,
      repeatY: palette.repeatY,
    }),
    emissiveMap: toTexture(emissCan, regTex, {
      repeatX: palette.repeatX,
      repeatY: palette.repeatY,
      srgb: true,
    }),
  };
}

/**
 * Generates brushed hammered bronze maps for architectural cornices, collars, and astrolabes.
 */
export function createHammeredBrassMaps(regTex: TextureRegistry): Omit<SimplePbrMaps, "map"> {
  const S = 128;
  const rand = mulberry32(4207);
  const [bumpCan, bumpCtx] = createCanvas(S);
  const [roughCan, roughCtx] = createCanvas(S);

  bumpCtx.fillStyle = "rgb(140,140,140)";
  bumpCtx.fillRect(0, 0, S, S);
  roughCtx.fillStyle = "rgb(82,82,82)";
  roughCtx.fillRect(0, 0, S, S);

  for (let i = 0; i < 90; i++) {
    const cx = rand() * S;
    const cy = rand() * S;
    const rad = 4 + rand() * 8;
    const v = Math.round(115 + rand() * 60);
    bumpCtx.fillStyle = `rgba(${v},${v},${v},0.35)`;
    bumpCtx.beginPath();
    bumpCtx.arc(cx, cy, rad, 0, Math.PI * 2);
    bumpCtx.fill();

    const rv = Math.round(64 + rand() * 64);
    roughCtx.fillStyle = `rgba(${rv},${rv},${rv},0.4)`;
    roughCtx.beginPath();
    roughCtx.arc(cx, cy, rad * 0.9, 0, Math.PI * 2);
    roughCtx.fill();
  }

  // Brushed horizontal grain lines
  for (let y = 0; y < S; y += 2) {
    const shade = Math.round(120 + rand() * 55);
    roughCtx.fillStyle = `rgba(${shade},${shade},${shade},0.16)`;
    roughCtx.fillRect(0, y, S, 1);
  }

  return {
    bumpMap: toTexture(bumpCan, regTex, { repeatX: 6, repeatY: 1 }),
    roughnessMap: toTexture(roughCan, regTex, { repeatX: 6, repeatY: 1 }),
  };
}

/**
 * Generates fractured volcanic basalt cliff rock maps for mountain ridges and viaduct bridge.
 */
export function createCliffRockMaps(regTex: TextureRegistry): SimplePbrMaps {
  const S = 256;
  const rand = mulberry32(9913);
  const [colCan, colCtx] = createCanvas(S);
  const [bumpCan, bumpCtx] = createCanvas(S);
  const [roughCan, roughCtx] = createCanvas(S);

  colCtx.fillStyle = "#12121a";
  colCtx.fillRect(0, 0, S, S);
  bumpCtx.fillStyle = "rgb(125,125,125)";
  bumpCtx.fillRect(0, 0, S, S);
  roughCtx.fillStyle = "rgb(208,208,208)";
  roughCtx.fillRect(0, 0, S, S);

  for (let i = 0; i < 220; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const w = 14 + rand() * 34;
    const h = 8 + rand() * 20;
    const val = rand();
    const shade = Math.round(14 + val * 16);
    colCtx.fillStyle = `rgba(${shade},${shade},${shade + 7},0.55)`;
    colCtx.fillRect(x, y, w, h);

    const b = Math.round(80 + val * 115);
    bumpCtx.fillStyle = `rgba(${b},${b},${b},0.45)`;
    bumpCtx.fillRect(x, y, w, h);

    const r = Math.round(170 + val * 65);
    roughCtx.fillStyle = `rgba(${r},${r},${r},0.5)`;
    roughCtx.fillRect(x, y, w, h);
  }

  for (let c = 0; c < 14; c++) {
    const pts = generateFractureBranch(rand, S, rand() * S, rand() * S, rand() * Math.PI * 2, 7, 14);
    bumpCtx.strokeStyle = "rgb(35,35,35)";
    bumpCtx.lineWidth = 2.2;
    strokeWrappedPolyline(bumpCtx, S, pts);
  }

  return {
    map: toTexture(colCan, regTex, { repeatX: 14, repeatY: 10, srgb: true }),
    bumpMap: toTexture(bumpCan, regTex, { repeatX: 14, repeatY: 10 }),
    roughnessMap: toTexture(roughCan, regTex, { repeatX: 14, repeatY: 10 }),
  };
}

/**
 * Generates a radial Gaussian bokeh spark texture so additive particles bloom smoothly as glowing orbs.
 */
export function createBokehSparkTexture(regTex: TextureRegistry): THREE.CanvasTexture {
  const S = 128;
  const [canvas, ctx] = createCanvas(S);
  const c = S * 0.5;
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
  grad.addColorStop(0.18, "rgba(255, 255, 255, 0.92)");
  grad.addColorStop(0.42, "rgba(255, 255, 255, 0.34)");
  grad.addColorStop(0.72, "rgba(255, 255, 255, 0.08)");
  grad.addColorStop(1.0, "rgba(255, 255, 255, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  return toTexture(canvas, regTex, { srgb: true, clamp: true });
}

/**
 * Generates a 4-point crisp icy star-glint sprite for Floor 2 Glacial Bastion blizzard motes.
 */
export function createIceGlintTexture(regTex: TextureRegistry): THREE.CanvasTexture {
  const S = 128;
  const [canvas, ctx] = createCanvas(S);
  const c = S * 0.5;

  const glow = ctx.createRadialGradient(c, c, 0, c, c, c * 0.72);
  glow.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
  glow.addColorStop(0.22, "rgba(220, 248, 255, 0.65)");
  glow.addColorStop(1.0, "rgba(180, 235, 255, 0.0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, S, S);

  // Horizontal & vertical crisp star needle flare
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  for (const [rx, ry] of [
    [c * 0.88, 2.8],
    [2.8, c * 0.88],
  ]) {
    ctx.beginPath();
    ctx.ellipse(c, c, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  return toTexture(canvas, regTex, { srgb: true, clamp: true });
}

/**
 * Generates an intricate engraved circular ritual compass rune overlay for the pedestal base.
 */
export function createArcaneDialTexture(regTex: TextureRegistry): THREE.CanvasTexture {
  const S = 512;
  const [canvas, ctx] = createCanvas(S);
  const c = S * 0.5;

  ctx.clearRect(0, 0, S, S);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineCap = "round";

  // Concentric calibration rings
  for (const [rad, lw] of [
    [236, 2.4],
    [214, 1.3],
    [186, 2.0],
    [144, 1.2],
  ]) {
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(c, c, rad, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Degree tick marks & cardinal rune notches
  for (let i = 0; i < 48; i++) {
    const a = (i * Math.PI * 2) / 48;
    const major = i % 4 === 0;
    const rIn = major ? 188 : 204;
    const rOut = 234;
    ctx.lineWidth = major ? 2.2 : 1.0;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * rIn, c + Math.sin(a) * rIn);
    ctx.lineTo(c + Math.cos(a) * rOut, c + Math.sin(a) * rOut);
    ctx.stroke();
  }

  // Dual interlocking rotated squares (sacred geometry seal)
  ctx.lineWidth = 1.6;
  for (const rot of [0, Math.PI / 4]) {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(rot);
    const side = 186 * Math.SQRT2;
    ctx.strokeRect(-side * 0.5, -side * 0.5, side, side);
    ctx.restore();
  }

  return toTexture(canvas, regTex, { srgb: true, clamp: true });
}
