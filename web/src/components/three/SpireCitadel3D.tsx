"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import {
  Pause,
  Play,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Lock,
  Flame,
  Snowflake,
  Sparkles,
} from "lucide-react";
import type { FloorResponse } from "@/lib/contract";
import { useMotionControl } from "@/lib/spire/motion";
import { CitadelFallbackSvg } from "./CitadelFallbackSvg";

export interface SpireCitadel3DProps {
  mode?: "showcase" | "tactical";
  selectedFloor: number;
  onSelectFloor: (floor: number) => void;
  onHoverChange?: (isHovered: boolean, hoveredFloor: number | null) => void;
  externalHoveredFloor?: number | null;
  floors?: FloorResponse[];
  dominantElement?: 0 | 1 | 2;
  shockwaveSeq?: number;
  showFloorDock?: boolean;
  showControls?: boolean;
  className?: string;
}

const ELEMENT_COLORS: Record<number, number> = {
  0: 0xf2a63b,
  1: 0x38bdf8,
  2: 0xa855f7,
};

const FLOOR_COLORS: Record<number, number> = {
  1: 0xf2a63b,
  2: 0x38bdf8,
  3: 0xa855f7,
};

const FLOOR_CAM_TARGET_Y: Record<number, number> = {
  1: -1.65,
  2: 0.45,
  3: 2.55,
};

const FLOOR_CAM_DISTANCE: Record<number, number> = {
  1: 8.8,
  2: 8.2,
  3: 7.9,
};

function makeHdrColor(hex: number, multiplier: number): THREE.Color {
  const col = new THREE.Color(hex);
  col.multiplyScalar(multiplier);
  return col;
}

export const SpireCitadel3D: React.FC<SpireCitadel3DProps> = ({
  mode = "showcase",
  selectedFloor,
  onSelectFloor,
  onHoverChange,
  externalHoveredFloor = null,
  floors,
  dominantElement = 0,
  shockwaveSeq = 0,
  showFloorDock = true,
  showControls = true,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [hoveredFloor, setHoveredFloor] = useState<number | null>(null);
  const [isTowerHovered, setIsTowerHovered] = useState(false);
  const { paused, setPaused, reducedMotion } = useMotionControl();

  const selectedFloorRef = useRef(selectedFloor);
  selectedFloorRef.current = selectedFloor;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const dominantElementRef = useRef(dominantElement);
  dominantElementRef.current = dominantElement;
  const floorsRef = useRef(floors);
  floorsRef.current = floors;
  const hoveredFloorRef = useRef<number | null>(null);
  hoveredFloorRef.current = hoveredFloor ?? externalHoveredFloor;
  const isHoveredRef = useRef(false);
  isHoveredRef.current = isTowerHovered || externalHoveredFloor !== null;

  const thetaRef = useRef<number>(mode === "showcase" ? 0.52 : 0.42);
  const phiRef = useRef<number>(mode === "showcase" ? 1.38 : 1.32);
  const targetLookYRef = useRef<number>(
    mode === "showcase" ? 0.45 : FLOOR_CAM_TARGET_Y[selectedFloor] ?? 0
  );
  const currentLookYRef = useRef<number>(targetLookYRef.current);
  const targetDistRef = useRef<number>(
    mode === "showcase" ? 14.8 : FLOOR_CAM_DISTANCE[selectedFloor] ?? 8.6
  );
  const currentDistRef = useRef<number>(targetDistRef.current);
  const velThetaRef = useRef<number>(0);

  const shockwaveRef = useRef<{ active: boolean; progress: number; floor: number }>({
    active: false,
    progress: 0,
    floor: selectedFloor,
  });

  const needsSingleRenderRef = useRef<boolean>(true);
  const onSelectFloorRef = useRef(onSelectFloor);
  onSelectFloorRef.current = onSelectFloor;
  const onHoverChangeRef = useRef(onHoverChange);
  onHoverChangeRef.current = onHoverChange;

  useEffect(() => {
    onHoverChangeRef.current?.(isTowerHovered || hoveredFloor !== null, hoveredFloor);
  }, [isTowerHovered, hoveredFloor]);

  useEffect(() => {
    if (mode === "tactical") {
      targetLookYRef.current = FLOOR_CAM_TARGET_Y[selectedFloor] ?? 0;
      targetDistRef.current = FLOOR_CAM_DISTANCE[selectedFloor] ?? 8.6;
    } else {
      targetLookYRef.current = 0.42 + (FLOOR_CAM_TARGET_Y[selectedFloor] ?? 0) * 0.14;
      targetDistRef.current = 14.8;
    }
    needsSingleRenderRef.current = true;
  }, [selectedFloor, mode]);

  useEffect(() => {
    if (shockwaveSeq <= 0) return;
    shockwaveRef.current = {
      active: true,
      progress: 0,
      floor: selectedFloorRef.current,
    };
    needsSingleRenderRef.current = true;
  }, [shockwaveSeq]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const initW = Math.max(container.clientWidth, 280);
    const initH = Math.max(container.clientHeight, 320);
    renderer.setPixelRatio(dpr);
    renderer.setSize(initW, initH);
    renderer.setClearColor(0x050509, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "pan-y";
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D Gothic Spire Citadel anchored over obsidian cliffs with HDR optical bloom. Drag horizontally to orbit or click a floor tier."
    );
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07070c, mode === "showcase" ? 0.025 : 0.036);

    const camera = new THREE.PerspectiveCamera(40, initW / initH, 0.1, 140);
    const applyCameraViewport = (w: number, h: number) => {
      camera.aspect = w / h;
      if (mode === "showcase" && w >= 1024) {
        // Shift camera view frustum left so Spire frames cleanly on the right-center
        // while its 3D mountain ridges, mist, and sky span full-bleed behind left typography.
        camera.setViewOffset(w, h, -w * 0.21, 0, w, h);
      } else {
        camera.clearViewOffset();
      }
      camera.updateProjectionMatrix();
    };
    applyCameraViewport(initW, initH);

    // Opaque Half-Float HDR EffectComposer + Selective UnrealBloomPass + OutputPass
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    try {
      const renderTarget = new THREE.WebGLRenderTarget(
        Math.floor(initW * dpr),
        Math.floor(initH * dpr),
        {
          type: THREE.HalfFloatType,
          format: THREE.RGBAFormat,
        }
      );
      composer = new EffectComposer(renderer, renderTarget);
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(initW, initH),
        0.58,
        0.74,
        0.88
      );
      composer.addPass(bloomPass);

      const outputPass = new OutputPass();
      composer.addPass(outputPass);
    } catch {
      composer = null;
      bloomPass = null;
    }

    const disposables: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[] } = {
      geometries: [],
      materials: [],
    };
    const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      disposables.geometries.push(g);
      return g;
    };
    const regMat = <T extends THREE.Material>(m: T): T => {
      disposables.materials.push(m);
      return m;
    };

    // =========================================================================
    // 1. PROCEDURAL GLSL TWILIGHT SKY & DYNAMIC CLOUD SCATTERING DOME
    // =========================================================================
    const skyDomeMat = regMat(
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          uTime: { value: 0 },
          uBeaconColor: { value: new THREE.Color(0xf2a63b) },
          uBeaconDir: { value: new THREE.Vector3(0.18, 0.26, -0.94).normalize() },
          uBloomBoost: { value: 0 },
        },
        vertexShader: `
          varying vec3 vWorldPos;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPos = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uBeaconColor;
          uniform vec3 uBeaconDir;
          uniform float uBloomBoost;
          varying vec3 vWorldPos;

          float hash21(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }

          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash21(i);
            float b = hash21(i + vec2(1.0, 0.0));
            float c = hash21(i + vec2(0.0, 1.0));
            float d = hash21(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
          }

          float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.5;
            for (int i = 0; i < 4; i++) {
              v += a * noise(p);
              p = p * 2.04 + vec2(11.3, 7.1);
              a *= 0.5;
            }
            return v;
          }

          void main() {
            vec3 dir = normalize(vWorldPos);
            float h = clamp(dir.y, -0.25, 1.0);

            vec3 zenithCol = vec3(0.015, 0.016, 0.028);
            vec3 midSkyCol = vec3(0.048, 0.042, 0.068);
            vec3 horizonCol = vec3(0.105, 0.072, 0.078) + uBeaconColor * 0.07;

            vec3 sky = mix(horizonCol, midSkyCol, smoothstep(-0.08, 0.28, h));
            sky = mix(sky, zenithCol, smoothstep(0.22, 0.85, h));

            // Backlit twilight cloud bands drifting across mountain peaks
            vec2 cloudUv = dir.xz / max(0.2, abs(dir.y) + 0.18);
            float n1 = fbm(cloudUv * 1.45 + vec2(uTime * 0.014, -uTime * 0.008));
            float n2 = fbm(cloudUv * 3.1 - vec2(uTime * 0.021, uTime * 0.011));
            float cloudMask = smoothstep(0.38, 0.82, n1 * 0.65 + n2 * 0.35) * smoothstep(-0.12, 0.32, dir.y) * (1.0 - smoothstep(0.45, 0.92, dir.y));

            float spireAlign = max(dot(normalize(vec3(dir.x, dir.y * 0.85, dir.z)), normalize(uBeaconDir)), 0.0);
            float scatterWide = pow(spireAlign, 2.2);
            float scatterCore = pow(spireAlign, 7.5);

            vec3 cloudLit = mix(vec3(0.09, 0.08, 0.12), uBeaconColor * (0.48 + uBloomBoost * 0.52), scatterWide);
            sky += cloudLit * cloudMask * (0.34 + uBloomBoost * 0.22);

            // Subtle atmospheric scatter halo behind citadel silhouette
            sky += uBeaconColor * (scatterCore * (0.16 + uBloomBoost * 0.28) + scatterWide * 0.06);

            // Crisp distant stars strictly in high zenith clearings
            float starSeed = hash21(floor(dir.xz * 290.0 + dir.y * 140.0));
            float starVis = smoothstep(0.9965, 0.9998, starSeed) * smoothstep(0.24, 0.72, dir.y) * (1.0 - cloudMask * 0.85);
            sky += vec3(0.85, 0.82, 0.76) * starVis * 0.45;

            gl_FragColor = vec4(clamp(sky, 0.0, 0.78), 1.0);
          }
        `,
      })
    );
    const skySphere = new THREE.Mesh(regGeo(new THREE.SphereGeometry(72, 40, 28)), skyDomeMat);
    scene.add(skySphere);

    // =========================================================================
    // 2. THREE-POINT + ENVIRONMENTAL BOUNCE LIGHTING
    // =========================================================================
    const hemiLight = new THREE.HemisphereLight(0x8899bb, 0x0a080d, 0.72);
    scene.add(hemiLight);

    const moonKey = new THREE.DirectionalLight(0xf6ead6, 1.35);
    moonKey.position.set(-7, 11, 8);
    scene.add(moonKey);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.85);
    rimLight.position.set(10, 6, -12);
    scene.add(rimLight);

    // Dynamic floor & environmental bounce lights that wash surrounding cliffs & viaduct
    const keepCoreLight = new THREE.PointLight(0xf2a63b, 9.0, 28, 1.45);
    keepCoreLight.position.set(0, -1.35, 0.4);
    scene.add(keepCoreLight);

    const valleyWashLight = new THREE.PointLight(0xf2a63b, 6.0, 36, 1.25);
    valleyWashLight.position.set(0, 1.5, 2.2);
    scene.add(valleyWashLight);

    const apexAuraLight = new THREE.PointLight(0xa855f7, 7.0, 24, 1.35);
    apexAuraLight.position.set(0, 4.2, 0.6);
    scene.add(apexAuraLight);

    // =========================================================================
    // 3. SHARED CARVED BASALT PBR & SELECTIVE HDR MATERIALS
    // =========================================================================
    const stoneBasaltMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x1a1b24,
        roughness: 0.62,
        metalness: 0.34,
        flatShading: true,
      })
    );
    const stoneDarkMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x111219,
        roughness: 0.72,
        metalness: 0.28,
        flatShading: true,
      })
    );
    const cliffRockMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x15151e,
        roughness: 0.84,
        metalness: 0.18,
        flatShading: true,
      })
    );
    const brassTrimMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xb68635,
        roughness: 0.32,
        metalness: 0.85,
        flatShading: true,
      })
    );

    // Calibrated HDR Emitters (toneMapped: false so ONLY crisp slits/crystals cross bloom threshold 0.88)
    const f1GlowMat = regMat(
      new THREE.MeshBasicMaterial({
        color: makeHdrColor(0xf2a63b, 1.85),
        toneMapped: false,
      })
    );
    const f2GlowMat = regMat(
      new THREE.MeshBasicMaterial({
        color: makeHdrColor(0x38bdf8, 1.85),
        toneMapped: false,
      })
    );
    const f3GlowMat = regMat(
      new THREE.MeshBasicMaterial({
        color: makeHdrColor(0xa855f7, 1.95),
        toneMapped: false,
      })
    );
    const apexCoreMat = regMat(
      new THREE.MeshBasicMaterial({
        color: makeHdrColor(0xffe09e, 2.4),
        toneMapped: false,
      })
    );
    const pylonGlowMat = regMat(
      new THREE.MeshBasicMaterial({
        color: makeHdrColor(0xf2a63b, 2.0),
        toneMapped: false,
      })
    );

    const worldRoot = new THREE.Group();
    scene.add(worldRoot);

    // =========================================================================
    // 4. 3D BASALT MOUNTAIN AMPHITHEATER + RUINED STONE VIADUCT BRIDGE
    // =========================================================================
    if (mode === "showcase") {
      const terrainGeo = regGeo(new THREE.PlaneGeometry(72, 48, 84, 52));
      terrainGeo.rotateX(-Math.PI / 2);
      const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;

      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const z = posAttr.getZ(i);
        const dist = Math.hypot(x, z * 1.12);

        // Central rocky outcrop plateau at r < 3.4, deep chasm moat at r 4..8, rising flanking ridges outside
        let h = -3.75;
        if (dist < 3.6) {
          h = -3.65 + (3.6 - dist) * 0.08;
        } else if (dist < 7.8) {
          h = -5.85 + Math.cos(((dist - 3.6) / 4.2) * Math.PI) * 1.1;
        } else {
          const ridgeBand = Math.min(1, (dist - 7.8) / 14);
          const peakWave =
            Math.sin(x * 0.24 + 0.6) * Math.cos(z * 0.22 - 0.3) * 2.4 +
            Math.sin(x * 0.52 - z * 0.41) * 1.05 +
            Math.abs(Math.cos(x * 0.14 + z * 0.17)) * 2.2;
          // Carve dramatic chasm depression right along front-left causeway corridor
          const bridgeCorridor = Math.exp(-Math.pow((x + z * 0.42) / 3.8, 2)) * (z > 2 ? 1 : 0);
          h = -4.2 + ridgeBand * 3.8 + peakWave * ridgeBand - bridgeCorridor * 2.8;
        }
        // Subtle jagged rock faceting
        h += Math.sin(x * 1.9 + z * 2.3) * 0.14;
        posAttr.setY(i, h);
      }
      terrainGeo.computeVertexNormals();
      const terrainMesh = new THREE.Mesh(terrainGeo, cliffRockMat);
      worldRoot.add(terrainMesh);

      // Foreground Ruined Stone Viaduct leading toward the Citadel Keep Gate
      const viaductGroup = new THREE.Group();
      viaductGroup.position.set(0, -3.52, 0);
      viaductGroup.rotation.y = -0.36;
      worldRoot.add(viaductGroup);

      const deckGeo = regGeo(new THREE.BoxGeometry(1.75, 0.28, 11.4));
      const deckMesh = new THREE.Mesh(deckGeo, stoneBasaltMat);
      deckMesh.position.set(0, 0, 7.6);
      viaductGroup.add(deckMesh);

      const pierGeo = regGeo(new THREE.BoxGeometry(0.95, 3.2, 0.95));
      const postGeo = regGeo(new THREE.BoxGeometry(0.24, 0.85, 0.24));
      const brazierCoreGeo = regGeo(new THREE.OctahedronGeometry(0.11, 0));

      for (let b = 0; b < 3; b++) {
        const bz = 3.9 + b * 3.1;
        const pier = new THREE.Mesh(pierGeo, stoneDarkMat);
        pier.position.set(0, -1.6, bz);
        viaductGroup.add(pier);

        for (const side of [-0.74, 0.74]) {
          const post = new THREE.Mesh(postGeo, stoneBasaltMat);
          post.position.set(side, 0.52, bz);
          const ember = new THREE.Mesh(brazierCoreGeo, pylonGlowMat);
          ember.position.set(side, 1.02, bz);
          viaductGroup.add(post, ember);
        }
      }
    }

    // =========================================================================
    // 5. VOLUMETRIC CHASM MIST SEA & RADIAL GOD-RAY SHAFTS
    // =========================================================================
    const mistShaderMat = regMat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(0xf2a63b) },
          uBoost: { value: 0 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uColor;
          uniform float uBoost;
          varying vec2 vUv;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
              f.y
            );
          }

          void main() {
            vec2 p = vUv * 2.0 - 1.0;
            float radial = 1.0 - smoothstep(0.15, 0.96, length(p));
            float m1 = noise(vUv * 5.2 + vec2(uTime * 0.035, -uTime * 0.02));
            float m2 = noise(vUv * 10.4 - vec2(uTime * 0.04, uTime * 0.025));
            float fog = (m1 * 0.65 + m2 * 0.35) * radial;
            float ringBoost = exp(-abs(length(p) - 0.34) * 5.0) * (0.28 + uBoost * 0.45);
            vec3 col = mix(vec3(0.05, 0.05, 0.08), uColor * 0.55, ringBoost + 0.14);
            float alpha = clamp(fog * (0.48 + uBoost * 0.26), 0.0, 0.72);
            gl_FragColor = vec4(col, alpha);
          }
        `,
      })
    );

    const mistLower = new THREE.Mesh(regGeo(new THREE.PlaneGeometry(42, 42)), mistShaderMat);
    mistLower.rotation.x = -Math.PI / 2;
    mistLower.position.y = -3.85;
    worldRoot.add(mistLower);

    const mistUpper = new THREE.Mesh(regGeo(new THREE.PlaneGeometry(24, 24)), mistShaderMat);
    mistUpper.rotation.x = -Math.PI / 2;
    mistUpper.position.y = -2.95;
    worldRoot.add(mistUpper);

    // Volumetric Optical Corona & Diagonal Light Shafts radiating around the Citadel
    const coronaShaderMat = regMat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uColor: { value: new THREE.Color(0xf2a63b) },
          uBoost: { value: 0 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uBoost;
          varying vec2 vUv;
          void main() {
            vec2 p = (vUv - 0.5) * 2.0;
            float d = length(p);
            float softHalo = exp(-d * 3.8) * (0.14 + uBoost * 0.24);
            float streak = exp(-abs(p.y) * 24.0) * exp(-abs(p.x) * 2.8) * (0.12 + uBoost * 0.34);
            float a = clamp((softHalo + streak) * (1.0 - smoothstep(0.65, 1.0, d)), 0.0, 0.85);
            gl_FragColor = vec4(uColor, a);
          }
        `,
      })
    );
    const coronaPlane = new THREE.Mesh(regGeo(new THREE.PlaneGeometry(11.5, 7.5)), coronaShaderMat);
    coronaPlane.position.set(0, 0.5, -0.8);
    worldRoot.add(coronaPlane);

    // =========================================================================
    // 6. GOTHIC SPIRE CITADEL ARCHITECTURE (3 TIERS + ASTROLABE + SUMMIT)
    // =========================================================================
    const citadelRoot = new THREE.Group();
    citadelRoot.position.y = -0.25;
    worldRoot.add(citadelRoot);

    // Stepped Cliff Pedestal & Delicate Arcane Summoning Circle
    const pedestalGroup = new THREE.Group();
    pedestalGroup.position.y = -3.35;
    citadelRoot.add(pedestalGroup);

    const daisBase = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(3.05, 3.45, 0.52, 12)), stoneDarkMat);
    pedestalGroup.add(daisBase);

    const daisUpper = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(2.55, 2.88, 0.26, 12)), stoneBasaltMat);
    daisUpper.position.y = 0.36;
    pedestalGroup.add(daisUpper);

    const magicCircleMat = regMat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uHover: { value: 0 },
          uColor: { value: new THREE.Color(0xf2a63b) },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uHover;
          uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            vec2 p = (vUv - 0.5) * 2.0;
            float r = length(p);
            if (r > 1.0) discard;
            float ang = atan(p.y, p.x);

            float ringA = smoothstep(0.016, 0.0, abs(r - 0.94));
            float ringB = smoothstep(0.014, 0.0, abs(r - 0.78));
            float ringC = smoothstep(0.012, 0.0, abs(r - 0.58));

            float glyphsA = smoothstep(0.35, 0.8, sin(ang * 16.0 + uTime * 0.95));
            float glyphsB = smoothstep(0.4, 0.85, sin(ang * 12.0 - uTime * 1.4));
            float runes = ringA * (0.4 + 0.6 * glyphsA) + ringB * (0.3 + 0.7 * glyphsB) + ringC * 0.55;

            float glow = exp(-abs(r - 0.86) * 8.0) * (0.15 + uHover * 0.35);
            vec3 col = uColor * (runes * (0.85 + uHover * 1.35) + glow);
            float alpha = clamp((runes + glow) * (0.48 + uHover * 0.45), 0.0, 0.95);
            gl_FragColor = vec4(col, alpha);
          }
        `,
      })
    );
    const magicCircleMesh = new THREE.Mesh(regGeo(new THREE.PlaneGeometry(7.6, 7.6)), magicCircleMat);
    magicCircleMesh.rotation.x = -Math.PI / 2;
    magicCircleMesh.position.y = 0.51;
    pedestalGroup.add(magicCircleMesh);

    // 4 Floating Perimeter Obelisks around Pedestal
    const pylonsGroup = new THREE.Group();
    pedestalGroup.add(pylonsGroup);
    const obeliskGeo = regGeo(new THREE.ConeGeometry(0.16, 1.15, 4));
    const obeliskGemGeo = regGeo(new THREE.OctahedronGeometry(0.08, 0));
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const holder = new THREE.Group();
      holder.position.set(Math.cos(ang) * 3.15, 0.98, Math.sin(ang) * 3.15);
      const stoneObelisk = new THREE.Mesh(obeliskGeo, stoneBasaltMat);
      stoneObelisk.rotation.x = Math.PI;
      const gem = new THREE.Mesh(obeliskGemGeo, pylonGlowMat);
      gem.position.y = 0.76;
      holder.add(stoneObelisk, gem);
      pylonsGroup.add(holder);
    }

    // Fine Central Skyward Light Conduit Beam
    const conduitBeamMat = regMat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uColor: { value: new THREE.Color(0xf2a63b) },
          uBoost: { value: 0 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uBoost;
          varying vec2 vUv;
          void main() {
            float fadeY = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.5, 1.0, vUv.y));
            float edge = sin(vUv.x * 3.14159);
            float a = fadeY * pow(edge, 2.0) * (0.14 + uBoost * 0.28);
            gl_FragColor = vec4(uColor, a);
          }
        `,
      })
    );
    const conduitBeam = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.08, 0.42, 13.0, 16, 1, true)),
      conduitBeamMat
    );
    conduitBeam.position.y = 3.6;
    citadelRoot.add(conduitBeam);

    // Raycaster floor tags
    const floorInteractives: THREE.Object3D[] = [];
    const tagFloor = (obj: THREE.Object3D, floorNum: number) => {
      obj.traverse((child) => {
        child.userData.floor = floorNum;
        if ((child as THREE.Mesh).isMesh) {
          floorInteractives.push(child);
        }
      });
    };

    // --- FLOOR 1: Foundation Keep (Tapered 12-Sided Fortress + Recessed Molten Lancets) ---
    const floor1Group = new THREE.Group();
    floor1Group.position.y = -1.85;
    citadelRoot.add(floor1Group);

    const f1Body = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(1.48, 1.92, 2.25, 12)), stoneBasaltMat);
    floor1Group.add(f1Body);

    const f1Cornice = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(1.64, 1.56, 0.16, 12)), brassTrimMat);
    f1Cornice.position.y = 1.08;
    floor1Group.add(f1Cornice);

    // 8 Gothic Ribbed Flying Buttresses + Recessed Incandescent Furnace Window Slits
    const buttressPierGeo = regGeo(new THREE.BoxGeometry(0.24, 1.95, 0.54));
    const buttressArchGeo = regGeo(new THREE.BoxGeometry(0.18, 0.95, 0.24));
    const lancetFrameGeo = regGeo(new THREE.BoxGeometry(0.24, 1.18, 0.14));
    const lancetSlitGeo = regGeo(new THREE.BoxGeometry(0.075, 0.96, 0.06));
    const spireletGeo = regGeo(new THREE.ConeGeometry(0.13, 0.56, 4));

    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI * 2) / 8;
      const bWrap = new THREE.Group();
      bWrap.rotation.y = ang;

      const outerPier = new THREE.Mesh(buttressPierGeo, stoneDarkMat);
      outerPier.position.set(0, -0.18, 1.92);
      const pinnacle = new THREE.Mesh(spireletGeo, stoneBasaltMat);
      pinnacle.position.set(0, 1.08, 1.92);
      const archStrut = new THREE.Mesh(buttressArchGeo, stoneBasaltMat);
      archStrut.position.set(0, 0.35, 1.65);
      archStrut.rotation.x = -0.45;
      bWrap.add(outerPier, pinnacle, archStrut);

      // Recessed molten furnace lancet between buttresses
      const wWrap = new THREE.Group();
      wWrap.rotation.y = ang + Math.PI / 8;
      const frame = new THREE.Mesh(lancetFrameGeo, stoneDarkMat);
      frame.position.set(0, 0.04, 1.68);
      const slit = new THREE.Mesh(lancetSlitGeo, f1GlowMat);
      slit.position.set(0, 0.04, 1.72);
      wWrap.add(frame, slit);

      floor1Group.add(bWrap, wWrap);
    }

    const f1OrbitRingGroup = new THREE.Group();
    floor1Group.add(f1OrbitRingGroup);
    const f1HairlineRing = new THREE.Mesh(regGeo(new THREE.TorusGeometry(2.38, 0.016, 8, 64)), f1GlowMat);
    f1HairlineRing.rotation.x = Math.PI / 2;
    f1HairlineRing.position.y = -0.35;
    f1OrbitRingGroup.add(f1HairlineRing);
    tagFloor(floor1Group, 1);

    // --- FLOOR 2: Glacial Bastion (Waisted Cloister + 6 Cryo-Crystal Pinnacles) ---
    const floor2Group = new THREE.Group();
    floor2Group.position.y = 0.36;
    citadelRoot.add(floor2Group);

    const f2Plinth = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(1.42, 1.62, 0.22, 12)), stoneDarkMat);
    f2Plinth.position.y = -1.04;
    floor2Group.add(f2Plinth);

    const f2Body = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(1.06, 1.38, 1.95, 8)), stoneBasaltMat);
    floor2Group.add(f2Body);

    const f2Trim = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(1.18, 1.12, 0.12, 8)), brassTrimMat);
    f2Trim.position.y = 0.96;
    floor2Group.add(f2Trim);

    const f2WindowGeo = regGeo(new THREE.BoxGeometry(0.065, 0.95, 0.05));
    const cryoColGeo = regGeo(new THREE.CylinderGeometry(0.09, 0.14, 1.55, 6));
    const cryoTipGeo = regGeo(new THREE.OctahedronGeometry(0.18, 0));
    const f2CrystalsGroup = new THREE.Group();
    floor2Group.add(f2CrystalsGroup);

    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI * 2) / 6;

      // Attached tall gothic lancet mullions + glowing frost core slits
      const lancetWrap = new THREE.Group();
      lancetWrap.rotation.y = ang + Math.PI / 6;
      const frostSlit = new THREE.Mesh(f2WindowGeo, f2GlowMat);
      frostSlit.position.set(0, 0.02, 1.24);
      lancetWrap.add(frostSlit);
      floor2Group.add(lancetWrap);

      // Cantilevered flanking stone pinnacle + suspended glowing cryo prism
      const colWrap = new THREE.Group();
      colWrap.rotation.y = ang;
      const stonePin = new THREE.Mesh(cryoColGeo, stoneDarkMat);
      stonePin.position.set(0, -0.02, 1.52);
      const crystalHead = new THREE.Mesh(cryoTipGeo, f2GlowMat);
      crystalHead.position.set(0, 0.96, 1.52);
      crystalHead.scale.set(0.65, 1.65, 0.65);
      colWrap.add(stonePin, crystalHead);
      floor2Group.add(colWrap);

      // Orbiting glacial diamond fragments
      const orbitCrystal = new THREE.Mesh(cryoTipGeo, f2GlowMat);
      orbitCrystal.position.set(
        Math.cos(ang) * 1.96,
        i % 2 === 0 ? 0.25 : -0.25,
        Math.sin(ang) * 1.96
      );
      orbitCrystal.scale.set(0.45, 1.35, 0.45);
      f2CrystalsGroup.add(orbitCrystal);
    }

    const f2Ring = new THREE.Mesh(regGeo(new THREE.TorusGeometry(1.78, 0.015, 8, 64)), f2GlowMat);
    f2Ring.rotation.x = Math.PI / 2;
    f2Ring.position.y = 0.08;
    floor2Group.add(f2Ring);
    tagFloor(floor2Group, 2);

    // --- FLOOR 3: Void Apex Sanctum (Cathedral Needle + Astrolabe + Shattered Crown) ---
    const floor3Group = new THREE.Group();
    floor3Group.position.y = 2.42;
    citadelRoot.add(floor3Group);

    const f3Base = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(1.06, 1.24, 0.2, 8)), stoneDarkMat);
    f3Base.position.y = -0.98;
    floor3Group.add(f3Base);

    const f3Body = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.62, 0.98, 1.85, 8)), stoneBasaltMat);
    floor3Group.add(f3Body);

    // Gothic roof pinnacle needle rising gracefully to crown
    const f3SpireRoof = new THREE.Mesh(regGeo(new THREE.ConeGeometry(0.7, 2.25, 8)), stoneDarkMat);
    f3SpireRoof.position.y = 2.02;
    floor3Group.add(f3SpireRoof);

    // 8 Flaring Obsidian Crown Pinnacles + Slender Violet Runic Lancet Slits
    const crownGroup = new THREE.Group();
    floor3Group.add(crownGroup);
    const hornGeo = regGeo(new THREE.ConeGeometry(0.11, 1.25, 4));
    const voidSlitGeo = regGeo(new THREE.BoxGeometry(0.055, 1.05, 0.04));

    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI * 2) / 8;
      const hornWrap = new THREE.Group();
      hornWrap.rotation.y = ang;
      const horn = new THREE.Mesh(hornGeo, stoneBasaltMat);
      horn.position.set(0, 1.15, 0.86);
      horn.rotation.x = -0.18;
      const slit = new THREE.Mesh(voidSlitGeo, f3GlowMat);
      slit.position.set(0, -0.05, 0.82);
      hornWrap.add(horn, slit);
      crownGroup.add(hornWrap);
    }

    // Precision Precessing Astrolabe / Armillary Rings (fine brass + glowing void rim)
    const astrolabeRingA = new THREE.Mesh(regGeo(new THREE.TorusGeometry(1.42, 0.018, 8, 64)), f3GlowMat);
    astrolabeRingA.rotation.x = Math.PI / 2.6;
    astrolabeRingA.position.y = 0.82;
    floor3Group.add(astrolabeRingA);

    const astrolabeRingB = new THREE.Mesh(regGeo(new THREE.TorusGeometry(1.12, 0.015, 8, 64)), brassTrimMat);
    astrolabeRingB.rotation.x = -Math.PI / 2.9;
    astrolabeRingB.position.y = 1.48;
    floor3Group.add(astrolabeRingB);

    const astrolabeRingC = new THREE.Mesh(regGeo(new THREE.TorusGeometry(0.86, 0.013, 8, 56)), apexCoreMat);
    astrolabeRingC.rotation.y = Math.PI / 3;
    astrolabeRingC.position.y = 2.05;
    floor3Group.add(astrolabeRingC);

    // Floating Shattered Apex Relic Crystal
    const apexBeacon = new THREE.Mesh(regGeo(new THREE.OctahedronGeometry(0.28, 0)), apexCoreMat);
    apexBeacon.position.y = 3.55;
    apexBeacon.scale.set(0.76, 1.65, 0.76);
    floor3Group.add(apexBeacon);

    tagFloor(floor3Group, 3);

    // =========================================================================
    // 7. SHOCKWAVE PULSE RING + ASCENDING EMBER SPORES
    // =========================================================================
    const shockMat = regMat(
      new THREE.MeshBasicMaterial({
        color: 0xf2a63b,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      })
    );
    const shockRing = new THREE.Mesh(regGeo(new THREE.RingGeometry(1.25, 1.5, 48)), shockMat);
    shockRing.rotation.x = -Math.PI / 2;
    citadelRoot.add(shockRing);

    const PARTICLE_COUNT = mode === "showcase" ? 210 : 95;
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const particleSpeeds = new Float32Array(PARTICLE_COUNT);
    const spreadRadius = mode === "showcase" ? 9.5 : 3.2;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = 1.0 + Math.random() * spreadRadius;
      positions[i * 3] = Math.cos(ang) * rad;
      positions[i * 3 + 1] = -3.8 + Math.random() * 9.5;
      positions[i * 3 + 2] = Math.sin(ang) * rad;
      particleSpeeds[i] = 0.007 + Math.random() * 0.015;
    }
    const particleGeo = regGeo(new THREE.BufferGeometry());
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particleMat = regMat(
      new THREE.PointsMaterial({
        color: 0xffe4a0,
        size: mode === "showcase" ? 0.068 : 0.055,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const particles = new THREE.Points(particleGeo, particleMat);
    citadelRoot.add(particles);

    // =========================================================================
    // 8. POINTER RAYCASTING, DRAG ORBIT & FLOOR SELECTION
    // =========================================================================
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let isDragging = false;
    let pointerDownPos = { x: 0, y: 0 };
    let lastDragX = 0;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging) {
        const dx = e.clientX - lastDragX;
        lastDragX = e.clientX;
        thetaRef.current -= dx * 0.01;
        velThetaRef.current = -dx * 0.0028;
        needsSingleRenderRef.current = true;
        return;
      }

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(floorInteractives, false);
      const hitFloor = hits.length > 0 ? (hits[0].object.userData.floor as number) : null;
      setHoveredFloor((prev) => (prev === hitFloor ? prev : hitFloor));
      renderer.domElement.style.cursor = hitFloor ? "pointer" : "grab";
    };

    const handlePointerDown = (e: PointerEvent) => {
      isDragging = true;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      lastDragX = e.clientX;
      renderer.domElement.style.cursor = "grabbing";
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moved < 6) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(floorInteractives, false);
        if (hits.length > 0) {
          const hitFloor = hits[0].object.userData.floor as number;
          if (hitFloor >= 1 && hitFloor <= 3) {
            onSelectFloorRef.current(hitFloor);
            shockwaveRef.current = { active: true, progress: 0, floor: hitFloor };
            needsSingleRenderRef.current = true;
          }
        }
      }
      renderer.domElement.style.cursor = hoveredFloorRef.current ? "pointer" : "grab";
    };

    const handlePointerEnter = () => setIsTowerHovered(true);
    const handlePointerLeave = () => {
      isDragging = false;
      setIsTowerHovered(false);
      setHoveredFloor(null);
    };

    renderer.domElement.addEventListener("pointerenter", handlePointerEnter);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(entry.contentRect.width, 220);
        const h = Math.max(entry.contentRect.height, 260);
        applyCameraViewport(w, h);
        renderer.setSize(w, h);
        composer?.setSize(w, h);
        bloomPass?.setSize(w, h);
        needsSingleRenderRef.current = true;
      }
    });
    resizeObserver.observe(container);

    // =========================================================================
    // 9. ANIMATION & HDR BLOOM SYNCHRONIZATION LOOP
    // =========================================================================
    let time = 0;
    let hoverScalar = 0;
    let rafId = 0;

    const animate = () => {
      rafId = requestAnimationFrame(animate);

      const freezeMotion = pausedRef.current || reducedMotionRef.current;
      const selFloor = selectedFloorRef.current;
      const hovFloor = hoveredFloorRef.current;
      const towerHot = isHoveredRef.current;

      // Hover scalar always interpolates smoothly so bloom & lights respond even under reduced-motion
      const targetHover = towerHot ? 1 : 0;
      const prevHoverScalar = hoverScalar;
      hoverScalar += (targetHover - hoverScalar) * 0.08;

      if (!freezeMotion) {
        time += 0.016;
        if (!isDragging) {
          thetaRef.current += (0.0022 + hoverScalar * 0.0028) + velThetaRef.current;
          velThetaRef.current *= 0.92;
        }
      }

      // Smooth camera transition
      const prevDist = currentDistRef.current;
      currentLookYRef.current += (targetLookYRef.current - currentLookYRef.current) * 0.08;
      const hoverDistPull = towerHot ? -0.52 : 0;
      currentDistRef.current += (targetDistRef.current + hoverDistPull - currentDistRef.current) * 0.08;

      const sinPhi = Math.sin(phiRef.current);
      camera.position.set(
        currentDistRef.current * sinPhi * Math.sin(thetaRef.current),
        currentLookYRef.current + currentDistRef.current * Math.cos(phiRef.current),
        currentDistRef.current * sinPhi * Math.cos(thetaRef.current)
      );
      camera.lookAt(0, currentLookYRef.current, 0);

      // Billboard optical corona plane softly toward camera
      const activeFocus = hovFloor ?? selFloor;
      const focusHex = FLOOR_COLORS[activeFocus] ?? ELEMENT_COLORS[dominantElementRef.current] ?? 0xf2a63b;
      const focusY = FLOOR_CAM_TARGET_Y[activeFocus] ?? 0.5;

      coronaPlane.position.y += (focusY - coronaPlane.position.y) * 0.1;
      coronaPlane.lookAt(camera.position);
      coronaShaderMat.uniforms.uColor.value.setHex(focusHex);
      coronaShaderMat.uniforms.uBoost.value = hoverScalar;

      // Synchronize Sky Dome scattering & mountain bounce illumination
      const dirToTower = new THREE.Vector3(0, 0.35 + focusY * 0.04, 0)
        .sub(camera.position)
        .normalize();
      skyDomeMat.uniforms.uTime.value = time;
      skyDomeMat.uniforms.uBeaconColor.value.setHex(focusHex);
      skyDomeMat.uniforms.uBeaconDir.value.copy(dirToTower);
      skyDomeMat.uniforms.uBloomBoost.value = hoverScalar;

      valleyWashLight.color.setHex(focusHex);
      valleyWashLight.intensity = 6.0 + hoverScalar * 11.5;
      keepCoreLight.color.setHex(activeFocus === 1 ? 0xf2a63b : focusHex);
      keepCoreLight.intensity = 8.0 + hoverScalar * 9.0;
      apexAuraLight.color.setHex(activeFocus === 3 ? 0xc084fc : focusHex);
      apexAuraLight.intensity = 6.5 + hoverScalar * 10.5;

      mistShaderMat.uniforms.uTime.value = time;
      mistShaderMat.uniforms.uColor.value.setHex(focusHex);
      mistShaderMat.uniforms.uBoost.value = hoverScalar;

      magicCircleMat.uniforms.uTime.value = time;
      magicCircleMat.uniforms.uHover.value = hoverScalar;
      magicCircleMat.uniforms.uColor.value.setHex(focusHex);
      magicCircleMesh.scale.setScalar(1 + hoverScalar * 0.12);

      conduitBeamMat.uniforms.uColor.value.setHex(focusHex);
      conduitBeamMat.uniforms.uBoost.value = hoverScalar + (shockwaveRef.current.active ? 0.5 : 0);

      // Floor Unlock state + Calibrated HDR Radiance Multipliers (sharp glowing slits, zero stone whiteout)
      const fs = floorsRef.current;
      const f2State = fs?.find((f) => f.floor === 2);
      const f3State = fs?.find((f) => f.floor === 3);

      const pulse = freezeMotion ? 0 : Math.sin(time * 2.5) * 0.18;
      const f1Mult =
        (hovFloor === 1 ? 3.2 : selFloor === 1 ? 2.4 : 1.55) + hoverScalar * 0.85 + pulse;
      const f2Locked = Boolean(f2State && !f2State.unlocked);
      const f2Mult = f2Locked
        ? 0.45
        : (hovFloor === 2 ? 3.25 : selFloor === 2 ? 2.45 : 1.55) + hoverScalar * 0.85 + pulse;
      const f3Locked = Boolean(f3State && !f3State.unlocked);
      const f3Mult = f3Locked
        ? 0.45
        : (hovFloor === 3 ? 3.35 : selFloor === 3 ? 2.5 : 1.65) + hoverScalar * 0.9 + pulse;

      f1GlowMat.color.setHex(0xf2a63b).multiplyScalar(f1Mult);
      f2GlowMat.color.setHex(0x38bdf8).multiplyScalar(f2Mult);
      f3GlowMat.color.setHex(0xa855f7).multiplyScalar(f3Mult);
      apexCoreMat.color.setHex(focusHex === 0x38bdf8 ? 0xbae6fd : 0xffe4a0).multiplyScalar(2.3 + hoverScalar * 1.45 + pulse);
      pylonGlowMat.color.setHex(focusHex).multiplyScalar(1.85 + hoverScalar * 1.15);

      if (!freezeMotion) {
        f1OrbitRingGroup.rotation.y = time * (0.35 + hoverScalar * 0.65);
        f2CrystalsGroup.rotation.y = -time * (0.48 + hoverScalar * 0.75);
        crownGroup.rotation.y = time * 0.18;
        astrolabeRingA.rotation.z = time * (f3State?.enrage ? 1.4 : 0.48 + hoverScalar * 0.7);
        astrolabeRingB.rotation.z = -time * (0.62 + hoverScalar * 0.85);
        astrolabeRingC.rotation.x = time * 0.75;
        apexBeacon.rotation.y = time * (0.9 + hoverScalar * 0.9);
        apexBeacon.position.y = 3.55 + Math.sin(time * 2.0) * 0.11 + hoverScalar * 0.14;

        for (let i = 0; i < pylonsGroup.children.length; i++) {
          pylonsGroup.children[i].position.y = 0.98 + Math.sin(time * 1.6 + i * 1.35) * 0.14;
        }

        const posArr = particleGeo.attributes.position.array as Float32Array;
        const speedMult = 1 + hoverScalar * 1.35;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          posArr[i * 3 + 1] += particleSpeeds[i] * speedMult;
          if (posArr[i * 3 + 1] > 5.7) {
            posArr[i * 3 + 1] = -3.8;
          }
        }
        particleGeo.attributes.position.needsUpdate = true;
      }

      let shockBoost = 0;
      if (shockwaveRef.current.active) {
        shockwaveRef.current.progress += 0.032;
        const p = shockwaveRef.current.progress;
        shockBoost = (1 - p) * 0.55;
        if (p >= 1) {
          shockwaveRef.current.active = false;
          shockMat.opacity = 0;
        } else {
          shockRing.position.y = FLOOR_CAM_TARGET_Y[shockwaveRef.current.floor] ?? 0;
          shockRing.scale.setScalar(1 + p * 2.8);
          shockMat.color.setHex(focusHex);
          shockMat.opacity = (1 - p) * 0.9;
        }
      }

      if (bloomPass) {
        bloomPass.strength = 0.56 + hoverScalar * 0.52 + shockBoost;
        bloomPass.radius = 0.72 + hoverScalar * 0.22;
      }

      particleMat.color.setHex(focusHex);
      particleMat.opacity = 0.55 + hoverScalar * 0.35;

      const hoverStillEasing = Math.abs(hoverScalar - prevHoverScalar) > 0.001;
      const camStillEasing = Math.abs(currentDistRef.current - prevDist) > 0.001;

      const shouldRender =
        !freezeMotion ||
        isDragging ||
        hoverStillEasing ||
        camStillEasing ||
        shockwaveRef.current.active ||
        needsSingleRenderRef.current;

      if (shouldRender) {
        if (composer) {
          composer.render();
        } else {
          renderer.render(scene, camera);
        }
        needsSingleRenderRef.current = false;
      }
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerenter", handlePointerEnter);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);

      disposables.geometries.forEach((g) => g.dispose());
      disposables.materials.forEach((m) => m.dispose());
      composer?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [mode]);

  const resetOrbit = useCallback(() => {
    thetaRef.current = mode === "showcase" ? 0.52 : 0.42;
    phiRef.current = mode === "showcase" ? 1.38 : 1.32;
    velThetaRef.current = 0;
    needsSingleRenderRef.current = true;
  }, [mode]);

  const nudgeOrbit = useCallback((deltaTheta: number) => {
    velThetaRef.current = deltaTheta * 0.36;
    needsSingleRenderRef.current = true;
  }, []);

  if (webglFailed) {
    return (
      <CitadelFallbackSvg
        activeFloor={selectedFloor}
        onSelectFloor={onSelectFloor}
        floors={floors}
        className={className}
      />
    );
  }

  return (
    <div className={`relative flex flex-col ${className}`}>
      <div
        ref={containerRef}
        className="relative w-full h-full min-h-[340px] flex-1"
      >
        {showControls && (
          <div className="pointer-events-auto absolute top-3 right-3 flex items-center gap-1.5 z-10">
            <button
              type="button"
              onClick={() => setPaused(!paused)}
              aria-pressed={paused}
              aria-label={paused ? "Resume 3D citadel motion" : "Pause 3D citadel motion"}
              title={paused ? "Resume motion" : "Pause motion"}
              className="min-w-[40px] min-h-[40px] px-2.5 rounded-lg bg-[#090910]/80 border border-brass/25 text-ash hover:text-parchment hover:border-solar/60 flex items-center justify-center transition-colors"
            >
              {paused ? <Play className="w-4 h-4 text-solar" /> : <Pause className="w-4 h-4 text-frost" />}
            </button>
            <button
              type="button"
              onClick={() => nudgeOrbit(-0.45)}
              aria-label="Rotate citadel left"
              className="min-w-[40px] min-h-[40px] rounded-lg bg-[#090910]/80 border border-brass/25 text-ash hover:text-parchment hover:border-solar/50 hidden sm:flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => nudgeOrbit(0.45)}
              aria-label="Rotate citadel right"
              className="min-w-[40px] min-h-[40px] rounded-lg bg-[#090910]/80 border border-brass/25 text-ash hover:text-parchment hover:border-solar/50 hidden sm:flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={resetOrbit}
              aria-label="Reset camera orbit"
              className="min-w-[40px] min-h-[40px] rounded-lg bg-[#090910]/80 border border-brass/25 text-ash hover:text-parchment hover:border-solar/50 flex items-center justify-center transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {showFloorDock && (
        <div
          className="mt-2.5 grid grid-cols-3 gap-2"
          role="group"
          aria-label="Citadel floor selector"
        >
          {[1, 2, 3].map((floorNum) => {
            const fState = floors?.find((f) => f.floor === floorNum);
            const unlocked = floorNum === 1 ? true : fState?.unlocked ?? mode === "showcase";
            const isSelected = selectedFloor === floorNum;
            const icon =
              floorNum === 1 ? (
                <Flame className="w-3.5 h-3.5 text-solar" />
              ) : floorNum === 2 ? (
                <Snowflake className="w-3.5 h-3.5 text-frost" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-void" />
              );

            return (
              <button
                key={floorNum}
                type="button"
                onClick={() => onSelectFloor(floorNum)}
                onMouseEnter={() => setHoveredFloor(floorNum)}
                onMouseLeave={() => setHoveredFloor(null)}
                aria-pressed={isSelected}
                className={`min-h-[44px] px-2.5 py-2 rounded-lg border text-left transition-all flex items-center justify-between gap-1.5 ${
                  isSelected
                    ? floorNum === 3
                      ? "bg-void/15 border-void text-parchment"
                      : floorNum === 2
                      ? "bg-frost/15 border-frost text-parchment"
                      : "bg-solar/15 border-solar text-parchment"
                    : "bg-panel-dark/90 border-brass/20 text-ash hover:border-brass/45 hover:text-parchment"
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {icon}
                  <span className="font-mono text-xs font-semibold truncate">
                    Floor {floorNum}
                  </span>
                </div>
                {!unlocked ? (
                  <Lock className="w-3 h-3 text-pewter shrink-0" aria-label="Locked" />
                ) : fState ? (
                  <span className="font-mono-numbers text-xs text-ash hidden xl:inline">
                    {fState.hp}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
