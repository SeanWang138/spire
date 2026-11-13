import * as THREE from "three";

export interface PbrMapSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  aoMap: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
}

export interface SimplePbrMaps {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
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

function createCanvas(size: number, height = size): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = height;
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
 * Converts a scalar height canvas into a seamless toroidal Sobel tangent-space Normal map
 * paired with a crevice Ambient Occlusion canvas. OpenGL tangent space (+X right, +Y up).
 */
function buildNormalAndAoCanvases(
  heightCanvas: HTMLCanvasElement,
  strength: number,
  minAo = 0.42
): { normalCanvas: HTMLCanvasElement; aoCanvas: HTMLCanvasElement } {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const hCtx = heightCanvas.getContext("2d")!;
  const src = hCtx.getImageData(0, 0, w, h).data;

  const [normalCanvas, nCtx] = createCanvas(w, h);
  const [aoCanvas, aCtx] = createCanvas(w, h);
  const nImg = nCtx.createImageData(w, h);
  const aImg = aCtx.createImageData(w, h);
  const nOut = nImg.data;
  const aOut = aImg.data;

  const sampleH = (x: number, y: number): number => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return src[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sampleH(x - 1, y - 1);
      const t = sampleH(x, y - 1);
      const tr = sampleH(x + 1, y - 1);
      const l = sampleH(x - 1, y);
      const c = sampleH(x, y);
      const r = sampleH(x + 1, y);
      const bl = sampleH(x - 1, y + 1);
      const b = sampleH(x, y + 1);
      const br = sampleH(x + 1, y + 1);

      // Sobel finite differences in Canvas orientation (y down -> v up)
      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);

      let nx = -dx * strength;
      let ny = dy * strength;
      let nz = 1.0;
      const invLen = 1 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * w + x) * 4;
      nOut[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      nOut[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      nOut[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      nOut[idx + 3] = 255;

      // Local concavity + mortar depth for subtle crevice ambient occlusion
      const avgNb = (tl + t + tr + l + r + bl + b + br) / 8;
      const cavity = Math.max(0, avgNb - c) * 2.2;
      const heightTerm = Math.max(0, Math.min(1, (c - 0.14) / 0.58));
      const ao = Math.max(minAo, Math.min(1, minAo + (1 - minAo) * heightTerm - cavity * 0.35));
      const aoByte = Math.round(ao * 255);
      aOut[idx] = aoByte;
      aOut[idx + 1] = aoByte;
      aOut[idx + 2] = aoByte;
      aOut[idx + 3] = 255;
    }
  }

  nCtx.putImageData(nImg, 0, 0);
  aCtx.putImageData(aImg, 0, 0);
  return { normalCanvas, aoCanvas };
}

/**
 * Generates high-definition 512px seamless tileable PBR texture sets tailored per Citadel tier:
 * - Tier 1: Monumental staggered Volcanic Basalt ashlar blocks with branching molten magma veins.
 * - Tier 2: Crisp vertical Glacial Slate masonry laced with glossy frost rime fractures.
 * - Tier 3: Mirror-glossy Void Obsidian monolithic plates etched with arcane circuit channels.
 */
export function createTierPbrTextures(
  tier: 1 | 2 | 3,
  regTex: TextureRegistry,
  repeatOverride?: { x: number; y: number }
): PbrMapSet {
  const S = 512;
  const rand = mulberry32(tier * 1337 + 97);

  const [colCan, colCtx] = createCanvas(S);
  const [heightCan, heightCtx] = createCanvas(S);
  const [roughCan, roughCtx] = createCanvas(S);
  const [emissCan, emissCtx] = createCanvas(S);

  const palette =
    tier === 1
      ? {
          bg: "#100f14",
          stoneMin: [30, 29, 34] as const,
          stoneVar: [18, 17, 19] as const,
          rim: "rgba(116, 108, 102, 0.32)",
          rows: 6,
          cols: 4,
          roughBase: 192,
          roughMin: 145,
          recessRough: 242,
          heightBase: 196,
          normalStrength: 2.35,
          minAo: 0.44,
          veinCount: 14,
          veinSpread: 0.72,
          repeatX: repeatOverride?.x ?? 3,
          repeatY: repeatOverride?.y ?? 1.5,
        }
      : tier === 2
        ? {
            bg: "#0c111a",
            stoneMin: [22, 29, 43] as const,
            stoneVar: [14, 19, 25] as const,
            rim: "rgba(145, 196, 232, 0.28)",
            rows: 4,
            cols: 6,
            roughBase: 186,
            roughMin: 34,
            recessRough: 96,
            heightBase: 192,
            normalStrength: 2.25,
            minAo: 0.48,
            veinCount: 16,
            veinSpread: 0.48,
            repeatX: repeatOverride?.x ?? 2,
            repeatY: repeatOverride?.y ?? 1.5,
          }
        : {
            bg: "#080710",
            stoneMin: [14, 12, 24] as const,
            stoneVar: [9, 8, 16] as const,
            rim: "rgba(154, 114, 218, 0.26)",
            rows: 3,
            cols: 8,
            roughBase: 52,
            roughMin: 34,
            recessRough: 168,
            heightBase: 208,
            normalStrength: 2.1,
            minAo: 0.5,
            veinCount: 12,
            veinSpread: 0.14,
            repeatX: repeatOverride?.x ?? 2,
            repeatY: repeatOverride?.y ?? 2,
          };

  colCtx.fillStyle = palette.bg;
  colCtx.fillRect(0, 0, S, S);
  heightCtx.fillStyle = "rgb(26,26,26)";
  heightCtx.fillRect(0, 0, S, S);
  roughCtx.fillStyle = `rgb(${palette.recessRough},${palette.recessRough},${palette.recessRough})`;
  roughCtx.fillRect(0, 0, S, S);
  emissCtx.fillStyle = "#000000";
  emissCtx.fillRect(0, 0, S, S);

  const rowH = S / palette.rows;
  const colW = S / palette.cols;
  const mortar = tier === 1 ? 7 : tier === 2 ? 5.5 : 4.5;

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

      const x0 = bx + mortar * 0.5;
      const y0 = by + mortar * 0.5;

      colCtx.fillStyle = `rgb(${cr},${cg},${cb})`;
      colCtx.fillRect(x0, y0, bw, bh);

      // Chiseled edge highlight & bottom/right shadow bevel on albedo
      colCtx.strokeStyle = palette.rim;
      colCtx.lineWidth = 2;
      colCtx.strokeRect(x0 + 1.5, y0 + 1.5, bw - 3, bh - 3);
      colCtx.strokeStyle = "rgba(0,0,0,0.42)";
      colCtx.lineWidth = 2;
      colCtx.strokeRect(x0 + 0.5, y0 + 0.5, bw - 1, bh - 1);

      // Dual-step chamfered ashlar relief heightfield
      const bVal = Math.round(palette.heightBase + (shade - 0.5) * 32);
      heightCtx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
      heightCtx.fillRect(x0, y0, bw, bh);
      heightCtx.strokeStyle = "rgb(112,112,112)";
      heightCtx.lineWidth = 4;
      heightCtx.strokeRect(x0 + 1.5, y0 + 1.5, bw - 3, bh - 3);
      heightCtx.strokeStyle = "rgb(72,72,72)";
      heightCtx.lineWidth = 2;
      heightCtx.strokeRect(x0, y0, bw, bh);

      // Roughness per block
      const rVal = Math.round(palette.roughBase + (shade - 0.5) * 28);
      roughCtx.fillStyle = `rgb(${rVal},${rVal},${rVal})`;
      roughCtx.fillRect(x0, y0, bw, bh);
    }
  }

  // Fine mineral grain pits & horizontal masonry striation
  const speckCount = tier === 1 ? 1800 : tier === 2 ? 1400 : 750;
  for (let i = 0; i < speckCount; i++) {
    const px = rand() * S;
    const py = rand() * S;
    const ps = 1.4 + rand() * 3.4;
    const bright = rand() > 0.52;
    colCtx.fillStyle = bright ? "rgba(255,255,255,0.036)" : "rgba(0,0,0,0.22)";
    colCtx.fillRect(px, py, ps, ps);

    const bm = bright ? 222 : 108;
    heightCtx.fillStyle = `rgba(${bm},${bm},${bm},0.34)`;
    heightCtx.fillRect(px, py, ps, ps);
  }

  // Neutral monochrome glow channels so shader-driven uWaveColor / uTierIdleColor sweeps cleanly
  emissCtx.lineCap = "round";
  emissCtx.lineJoin = "round";

  if (tier === 3) {
    for (let i = 0; i < palette.cols; i++) {
      const cx = i * colW + colW * 0.5;
      if (i % 2 === 0) {
        const shift = i % 4 === 0 ? 14 : -14;
        const circuitPts: Array<[number, number]> = [
          [cx, 0],
          [cx, S * 0.28],
          [cx + shift, S * 0.36],
          [cx + shift, S * 0.64],
          [cx, S * 0.72],
          [cx, S],
        ];
        emissCtx.strokeStyle = "rgba(185, 185, 185, 0.32)";
        emissCtx.lineWidth = 5.5;
        strokeWrappedPolyline(emissCtx, S, circuitPts);
        emissCtx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        emissCtx.lineWidth = 2.0;
        strokeWrappedPolyline(emissCtx, S, circuitPts);

        heightCtx.strokeStyle = "rgb(52, 52, 52)";
        heightCtx.lineWidth = 4.2;
        strokeWrappedPolyline(heightCtx, S, circuitPts);

        emissCtx.fillStyle = "rgba(255,255,255,0.92)";
        const ny = S * 0.5;
        const nx = cx + shift;
        emissCtx.beginPath();
        emissCtx.moveTo(nx, ny - 10);
        emissCtx.lineTo(nx + 9, ny);
        emissCtx.lineTo(nx, ny + 10);
        emissCtx.lineTo(nx - 9, ny);
        emissCtx.closePath();
        emissCtx.fill();
      }
    }
  } else {
    for (let v = 0; v < palette.veinCount; v++) {
      const sx = rand() * S;
      const sy = tier === 1 ? S * (0.3 + rand() * 0.66) : rand() * S;
      const baseAngle =
        tier === 1 ? -Math.PI * 0.5 + (rand() - 0.5) * palette.veinSpread : rand() * Math.PI * 2;
      const pts = generateFractureBranch(rand, sx, sy, baseAngle, 9 + Math.floor(rand() * 5), 21);

      emissCtx.strokeStyle = tier === 1 ? "rgba(175, 175, 175, 0.36)" : "rgba(165, 165, 165, 0.32)";
      emissCtx.lineWidth = tier === 1 ? 7.2 : 5.6;
      strokeWrappedPolyline(emissCtx, S, pts);

      emissCtx.strokeStyle = "rgba(255, 255, 255, 0.88)";
      emissCtx.lineWidth = tier === 1 ? 2.4 : 1.9;
      strokeWrappedPolyline(emissCtx, S, pts);

      heightCtx.strokeStyle = tier === 1 ? "rgb(34,34,34)" : "rgb(238,238,238)";
      heightCtx.lineWidth = 3.8;
      strokeWrappedPolyline(heightCtx, S, pts);

      roughCtx.strokeStyle = `rgb(${palette.roughMin},${palette.roughMin},${palette.roughMin})`;
      roughCtx.lineWidth = tier === 2 ? 5.2 : 4.0;
      strokeWrappedPolyline(roughCtx, S, pts);

      if (tier === 2) {
        colCtx.strokeStyle = "rgba(180, 224, 255, 0.2)";
        colCtx.lineWidth = 3.2;
        strokeWrappedPolyline(colCtx, S, pts);
      }
    }
  }

  const { normalCanvas, aoCanvas } = buildNormalAndAoCanvases(
    heightCan,
    palette.normalStrength,
    palette.minAo
  );

  return {
    map: toTexture(colCan, regTex, {
      repeatX: palette.repeatX,
      repeatY: palette.repeatY,
      srgb: true,
    }),
    normalMap: toTexture(normalCanvas, regTex, {
      repeatX: palette.repeatX,
      repeatY: palette.repeatY,
    }),
    roughnessMap: toTexture(roughCan, regTex, {
      repeatX: palette.repeatX,
      repeatY: palette.repeatY,
    }),
    aoMap: toTexture(aoCanvas, regTex, {
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
 * Generates brushed hammered bronze maps with Sobel normal relief for architectural cornices and armillaries.
 */
export function createHammeredBrassMaps(regTex: TextureRegistry): Omit<SimplePbrMaps, "map"> {
  const S = 256;
  const rand = mulberry32(4207);
  const [heightCan, heightCtx] = createCanvas(S);
  const [roughCan, roughCtx] = createCanvas(S);

  heightCtx.fillStyle = "rgb(140,140,140)";
  heightCtx.fillRect(0, 0, S, S);
  roughCtx.fillStyle = "rgb(78,78,78)";
  roughCtx.fillRect(0, 0, S, S);

  for (let i = 0; i < 190; i++) {
    const cx = rand() * S;
    const cy = rand() * S;
    const rad = 6 + rand() * 14;
    const v = Math.round(112 + rand() * 68);
    heightCtx.fillStyle = `rgba(${v},${v},${v},0.36)`;
    heightCtx.beginPath();
    heightCtx.arc(cx, cy, rad, 0, Math.PI * 2);
    heightCtx.fill();

    const rv = Math.round(58 + rand() * 62);
    roughCtx.fillStyle = `rgba(${rv},${rv},${rv},0.38)`;
    roughCtx.beginPath();
    roughCtx.arc(cx, cy, rad * 0.9, 0, Math.PI * 2);
    roughCtx.fill();
  }

  for (let y = 0; y < S; y += 2) {
    const shade = Math.round(118 + rand() * 56);
    roughCtx.fillStyle = `rgba(${shade},${shade},${shade},0.16)`;
    roughCtx.fillRect(0, y, S, 1);
  }

  const { normalCanvas } = buildNormalAndAoCanvases(heightCan, 1.45, 0.7);
  return {
    normalMap: toTexture(normalCanvas, regTex, { repeatX: 6, repeatY: 1 }),
    roughnessMap: toTexture(roughCan, regTex, { repeatX: 6, repeatY: 1 }),
  };
}

/**
 * Generates fractured volcanic basalt cliff rock maps for mountain ridges and ruined viaduct bridge.
 */
export function createCliffRockMaps(regTex: TextureRegistry): SimplePbrMaps {
  const S = 256;
  const rand = mulberry32(9913);
  const [colCan, colCtx] = createCanvas(S);
  const [heightCan, heightCtx] = createCanvas(S);
  const [roughCan, roughCtx] = createCanvas(S);

  colCtx.fillStyle = "#12121a";
  colCtx.fillRect(0, 0, S, S);
  heightCtx.fillStyle = "rgb(125,125,125)";
  heightCtx.fillRect(0, 0, S, S);
  roughCtx.fillStyle = "rgb(208,208,208)";
  roughCtx.fillRect(0, 0, S, S);

  for (let i = 0; i < 240; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const w = 14 + rand() * 34;
    const h = 8 + rand() * 20;
    const val = rand();
    const shade = Math.round(14 + val * 16);
    colCtx.fillStyle = `rgba(${shade},${shade},${shade + 7},0.55)`;
    colCtx.fillRect(x, y, w, h);

    const b = Math.round(78 + val * 116);
    heightCtx.fillStyle = `rgba(${b},${b},${b},0.46)`;
    heightCtx.fillRect(x, y, w, h);

    const r = Math.round(168 + val * 68);
    roughCtx.fillStyle = `rgba(${r},${r},${r},0.5)`;
    roughCtx.fillRect(x, y, w, h);
  }

  for (let c = 0; c < 14; c++) {
    const pts = generateFractureBranch(rand, rand() * S, rand() * S, rand() * Math.PI * 2, 7, 14);
    heightCtx.strokeStyle = "rgb(35,35,35)";
    heightCtx.lineWidth = 2.4;
    strokeWrappedPolyline(heightCtx, S, pts);
  }

  const { normalCanvas } = buildNormalAndAoCanvases(heightCan, 2.1, 0.55);
  return {
    map: toTexture(colCan, regTex, { repeatX: 14, repeatY: 10, srgb: true }),
    normalMap: toTexture(normalCanvas, regTex, { repeatX: 14, repeatY: 10 }),
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
  const S = 1024;
  const [canvas, ctx] = createCanvas(S);
  const c = S * 0.5;

  ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.96)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.shadowColor = "rgba(255, 255, 255, 0.85)";
  ctx.shadowBlur = 10;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Soft outer mana annulus glow anchoring glyphs cleanly outside pedestal stone
  const ringGlow = ctx.createRadialGradient(c, c, 315, c, c, 495);
  ringGlow.addColorStop(0.0, "rgba(255,255,255,0.0)");
  ringGlow.addColorStop(0.28, "rgba(255,255,255,0.10)");
  ringGlow.addColorStop(0.68, "rgba(255,255,255,0.16)");
  ringGlow.addColorStop(0.92, "rgba(255,255,255,0.22)");
  ringGlow.addColorStop(1.0, "rgba(255,255,255,0.0)");
  ctx.fillStyle = ringGlow;
  ctx.beginPath();
  ctx.arc(c, c, 495, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
  for (const [rad, lw] of [
    [486, 4.4],
    [470, 2.2],
    [432, 3.8],
    [396, 2.4],
    [346, 3.4],
    [324, 1.8],
    [252, 1.6],
  ]) {
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(c, c, rad, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Fine perimeter compass graduations & segmented ward ticks
  for (let i = 0; i < 64; i++) {
    const a = (i * Math.PI * 2) / 64;
    const major = i % 4 === 0;
    const rIn = major ? 432 : 450;
    const rOut = 472;
    ctx.lineWidth = major ? 3.4 : 1.6;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * rIn, c + Math.sin(a) * rIn);
    ctx.lineTo(c + Math.cos(a) * rOut, c + Math.sin(a) * rOut);
    ctx.stroke();
  }

  // 16 outer diamond runes + orbital pips between outer borders
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI * 2) / 16;
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(a);
    if (i % 2 === 0) {
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(434, 0);
      ctx.lineTo(414, 12);
      ctx.lineTo(396, 0);
      ctx.lineTo(414, -12);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(414, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(404, -10);
      ctx.lineTo(426, 0);
      ctx.lineTo(404, 10);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 8-point sacred octagram framing outer plinth + pylon node locks
  ctx.lineWidth = 3.2;
  for (const rot of [0, Math.PI / 4]) {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(rot);
    const side = 428 * Math.SQRT2;
    ctx.strokeRect(-side * 0.5, -side * 0.5, side, side);
    ctx.restore();
  }

  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI * 2) / 8;
    ctx.lineWidth = i % 2 === 1 ? 3.2 : 2.2;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * 326, c + Math.sin(a) * 326);
    ctx.lineTo(c + Math.cos(a) * 484, c + Math.sin(a) * 484);
    ctx.stroke();
  }
  ctx.restore();

  return toTexture(canvas, regTex, { srgb: true, clamp: true });
}

/**
 * Generates a tileable engraved geometric rune filigree banner for orbital belts & cascade rings.
 */
export function createGlyphRibbonTexture(regTex: TextureRegistry): THREE.CanvasTexture {
  const W = 512;
  const H = 128;
  const [canvas, ctx] = createCanvas(W, H);
  ctx.clearRect(0, 0, W, H);

  // Clean dark negative space around sharp radiant center spine so belt runes stay crisp
  const bandGrad = ctx.createLinearGradient(0, 8, 0, H - 8);
  bandGrad.addColorStop(0.0, "rgba(255,255,255,0.0)");
  bandGrad.addColorStop(0.16, "rgba(255,255,255,0.16)");
  bandGrad.addColorStop(0.5, "rgba(255,255,255,0.28)");
  bandGrad.addColorStop(0.84, "rgba(255,255,255,0.16)");
  bandGrad.addColorStop(1.0, "rgba(255,255,255,0.0)");
  ctx.fillStyle = bandGrad;
  ctx.fillRect(0, 8, W, H - 16);

  ctx.save();
  ctx.shadowColor = "rgba(255,255,255,0.92)";
  ctx.shadowBlur = 9;
  ctx.strokeStyle = "rgba(255,255,255,1.0)";
  ctx.fillStyle = "rgba(255,255,255,1.0)";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Double heavy glowing filigree border rails
  ctx.lineWidth = 3.8;
  ctx.beginPath();
  ctx.moveTo(0, 14);
  ctx.lineTo(W, 14);
  ctx.moveTo(0, H - 14);
  ctx.lineTo(W, H - 14);
  ctx.stroke();

  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, 24);
  ctx.lineTo(W, 24);
  ctx.moveTo(0, H - 24);
  ctx.lineTo(W, H - 24);
  ctx.stroke();

  const segments = 16;
  const segW = W / segments;
  for (let i = 0; i < segments; i++) {
    const cx = i * segW + segW * 0.5;
    const cy = H * 0.5;

    if (i % 2 === 0) {
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 30);
      ctx.lineTo(cx + 15, cy);
      ctx.lineTo(cx, cy + 30);
      ctx.lineTo(cx - 15, cy);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 5.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy - 18);
      ctx.lineTo(cx, cy - 28);
      ctx.lineTo(cx + 12, cy - 18);
      ctx.moveTo(cx - 12, cy + 18);
      ctx.lineTo(cx, cy + 28);
      ctx.lineTo(cx + 12, cy + 18);
      ctx.moveTo(cx, cy - 18);
      ctx.lineTo(cx, cy + 18);
      ctx.stroke();
    }

    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(i * segW, 10);
    ctx.lineTo(i * segW, 34);
    ctx.moveTo(i * segW, H - 34);
    ctx.lineTo(i * segW, H - 10);
    ctx.stroke();
  }
  ctx.restore();

  return toTexture(canvas, regTex, { repeatX: 2, repeatY: 1, srgb: true });
}
