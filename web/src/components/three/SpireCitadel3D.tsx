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
import {
  createArcaneDialTexture,
  createBokehSparkTexture,
  createCliffRockMaps,
  createHammeredBrassMaps,
  createIceGlintTexture,
  createTierPbrTextures,
} from "./citadelTextures";

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
    mode === "showcase" ? 0.52 : FLOOR_CAM_TARGET_Y[selectedFloor] ?? 0
  );
  const currentLookYRef = useRef<number>(targetLookYRef.current);
  const targetDistRef = useRef<number>(
    mode === "showcase" ? 15.6 : FLOOR_CAM_DISTANCE[selectedFloor] ?? 8.6
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
      targetLookYRef.current = 0.52 + (FLOOR_CAM_TARGET_Y[selectedFloor] ?? 0) * 0.1;
      targetDistRef.current = 15.6;
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
        0.66,
        0.72,
        0.78
      );
      composer.addPass(bloomPass);

      const outputPass = new OutputPass();
      composer.addPass(outputPass);
    } catch {
      composer = null;
      bloomPass = null;
    }

    const disposables: {
      geometries: THREE.BufferGeometry[];
      materials: THREE.Material[];
      textures: THREE.Texture[];
    } = {
      geometries: [],
      materials: [],
      textures: [],
    };
    const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      disposables.geometries.push(g);
      return g;
    };
    const regMat = <T extends THREE.Material>(m: T): T => {
      disposables.materials.push(m);
      return m;
    };
    const regTex = <T extends THREE.Texture>(t: T): T => {
      disposables.textures.push(t);
      return t;
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
    const keepCoreLight = new THREE.PointLight(0xffb02e, 9.0, 24, 1.45);
    keepCoreLight.position.set(0, -1.75, 0.8);
    scene.add(keepCoreLight);

    const bastionCoreLight = new THREE.PointLight(0x38bdf8, 8.0, 22, 1.45);
    bastionCoreLight.position.set(0, 0.4, 0.8);
    scene.add(bastionCoreLight);

    const valleyWashLight = new THREE.PointLight(0xffb02e, 5.5, 38, 1.25);
    valleyWashLight.position.set(0, 1.4, 2.4);
    scene.add(valleyWashLight);

    const apexAuraLight = new THREE.PointLight(0xa855f7, 8.5, 24, 1.38);
    apexAuraLight.position.set(0, 3.6, 0.8);
    scene.add(apexAuraLight);

    // =========================================================================
    // 3. PROCEDURAL PBR MASONRY TEXTURES, ELEMENTAL STONE & FRESNEL BLOOMS
    // =========================================================================
    const f1Maps = createTierPbrTextures(1, regTex);
    const f2Maps = createTierPbrTextures(2, regTex);
    const f3Maps = createTierPbrTextures(3, regTex);
    const brassMaps = createHammeredBrassMaps(regTex);
    const cliffMaps = createCliffRockMaps(regTex);
    const bokehSparkTex = createBokehSparkTexture(regTex);
    const iceGlintTex = createIceGlintTexture(regTex);
    const arcaneDialTex = createArcaneDialTexture(regTex);

    const f1StoneMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xc6c8d2,
        map: f1Maps.map,
        bumpMap: f1Maps.bumpMap,
        bumpScale: 0.055,
        roughnessMap: f1Maps.roughnessMap,
        roughness: 0.9,
        metalness: 0.24,
        emissive: new THREE.Color(0xffb02e),
        emissiveMap: f1Maps.emissiveMap,
        emissiveIntensity: 0.55,
        flatShading: true,
      })
    );
    const f2StoneMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xd6e6f5,
        map: f2Maps.map,
        bumpMap: f2Maps.bumpMap,
        bumpScale: 0.055,
        roughnessMap: f2Maps.roughnessMap,
        roughness: 0.92,
        metalness: 0.34,
        emissive: new THREE.Color(0x38bdf8),
        emissiveMap: f2Maps.emissiveMap,
        emissiveIntensity: 0.5,
        flatShading: true,
      })
    );
    const f3StoneMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xdad0f2,
        map: f3Maps.map,
        bumpMap: f3Maps.bumpMap,
        bumpScale: 0.048,
        roughnessMap: f3Maps.roughnessMap,
        roughness: 0.85,
        metalness: 0.52,
        emissive: new THREE.Color(0xa855f7),
        emissiveMap: f3Maps.emissiveMap,
        emissiveIntensity: 0.62,
        flatShading: true,
      })
    );
    const cryoFacetMat = regMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x8cdbff,
        emissive: new THREE.Color(0x1b6ca8),
        emissiveIntensity: 0.55,
        roughness: 0.14,
        metalness: 0.28,
        clearcoat: 0.85,
        clearcoatRoughness: 0.12,
        flatShading: true,
      })
    );
    const stoneDarkMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x161722,
        bumpMap: cliffMaps.bumpMap,
        bumpScale: 0.045,
        roughnessMap: cliffMaps.roughnessMap,
        roughness: 0.78,
        metalness: 0.28,
        flatShading: true,
      })
    );
    const cliffRockMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xd2d4e0,
        map: cliffMaps.map,
        bumpMap: cliffMaps.bumpMap,
        bumpScale: 0.09,
        roughnessMap: cliffMaps.roughnessMap,
        roughness: 0.9,
        metalness: 0.18,
        flatShading: true,
      })
    );
    const brassTrimMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xc28f3a,
        bumpMap: brassMaps.bumpMap,
        bumpScale: 0.032,
        roughnessMap: brassMaps.roughnessMap,
        roughness: 0.36,
        metalness: 0.86,
        flatShading: true,
      })
    );

    const createFresnelMat = (hex: number, power: number, intensity: number) =>
      regMat(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.FrontSide,
          toneMapped: false,
          uniforms: {
            uColor: { value: new THREE.Color(hex) },
            uPower: { value: power },
            uIntensity: { value: intensity },
          },
          vertexShader: `
            varying vec3 vNormalView;
            varying vec3 vViewDir;
            void main() {
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              vNormalView = normalize(normalMatrix * normal);
              vViewDir = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }
          `,
          fragmentShader: `
            uniform vec3 uColor;
            uniform float uPower;
            uniform float uIntensity;
            varying vec3 vNormalView;
            varying vec3 vViewDir;
            void main() {
              float fresnel = pow(clamp(1.0 - abs(dot(normalize(vNormalView), normalize(vViewDir))), 0.0, 1.0), uPower);
              float alpha = clamp(fresnel * uIntensity, 0.0, 0.9);
              gl_FragColor = vec4(uColor * (0.95 + uIntensity * 0.65), alpha);
            }
          `,
        })
      );

    // Calibrated HDR Emitters (toneMapped: false so slits, fissures, and rings weave silky HDR bloom)
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
        color: makeHdrColor(0xc084fc, 2.35),
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
      const deckMesh = new THREE.Mesh(deckGeo, f1StoneMat);
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
          const post = new THREE.Mesh(postGeo, f1StoneMat);
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

    // Volumetric Optical Corona, Anamorphic Flare & Slow Caustic God-Rays
    const coronaShaderMat = regMat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uColor: { value: new THREE.Color(0xf2a63b) },
          uBoost: { value: 0 },
          uTime: { value: 0 },
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
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vec2 p = (vUv - 0.5) * 2.0;
            float d = length(p);
            float ang = atan(p.y, p.x);
            float softHalo = exp(-d * 3.1) * (0.14 + uBoost * 0.22) + exp(-d * 7.2) * (0.12 + uBoost * 0.16);
            float streak = exp(-abs(p.y) * 26.0) * exp(-abs(p.x) * 2.1) * (0.14 + uBoost * 0.36);
            float rays = pow(max(0.0, sin(ang * 6.0 + uTime * 0.18)), 3.0) * exp(-d * 2.6) * (0.06 + uBoost * 0.14);
            float a = clamp((softHalo + streak + rays) * (1.0 - smoothstep(0.66, 1.0, d)), 0.0, 0.88);
            gl_FragColor = vec4(uColor, a);
          }
        `,
      })
    );
    const coronaPlane = new THREE.Mesh(regGeo(new THREE.PlaneGeometry(12.2, 8.2)), coronaShaderMat);
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

    const daisUpper = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(2.55, 2.88, 0.26, 12)), f1StoneMat);
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

    const magicDialMat = regMat(
      new THREE.MeshBasicMaterial({
        map: arcaneDialTex,
        color: 0xf2a63b,
        transparent: true,
        opacity: 0.44,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    const magicDialMesh = new THREE.Mesh(regGeo(new THREE.PlaneGeometry(7.0, 7.0)), magicDialMat);
    magicDialMesh.rotation.x = -Math.PI / 2;
    magicDialMesh.position.y = 0.525;
    pedestalGroup.add(magicDialMesh);

    // 4 Floating Perimeter Obelisks around Pedestal
    const pylonsGroup = new THREE.Group();
    pedestalGroup.add(pylonsGroup);
    const obeliskGeo = regGeo(new THREE.ConeGeometry(0.16, 1.15, 4));
    const obeliskGemGeo = regGeo(new THREE.OctahedronGeometry(0.08, 0));
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const holder = new THREE.Group();
      holder.position.set(Math.cos(ang) * 3.15, 0.98, Math.sin(ang) * 3.15);
      const stoneObelisk = new THREE.Mesh(obeliskGeo, f1StoneMat);
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

    // Gapless Tier Hitboxes (invisible to render & bloom, exact vertical tier bands for clean raycasting)
    const floorInteractives: THREE.Object3D[] = [];
    const hitboxMat = regMat(
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
      })
    );
    const registerHitbox = (radiusTop: number, radiusBottom: number, height: number, y: number, floorNum: number) => {
      const box = new THREE.Mesh(
        regGeo(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 16)),
        hitboxMat
      );
      box.position.y = y;
      box.userData.floor = floorNum;
      citadelRoot.add(box);
      floorInteractives.push(box);
    };
    registerHitbox(2.55, 3.35, 2.61, -2.045, 1);
    registerHitbox(1.88, 2.30, 2.03, 0.275, 2);
    registerHitbox(1.42, 1.80, 5.18, 3.88, 3);

    // --- FLOOR 1: Foundation Keep (Volcanic Ashlar Basalt + Parapet Braziers + Magma Aura) ---
    const floor1Group = new THREE.Group();
    floor1Group.position.y = -1.85;
    citadelRoot.add(floor1Group);

    const f1Body = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(1.48, 1.92, 2.25, 12)), f1StoneMat);
    floor1Group.add(f1Body);

    const f1FresnelMat = createFresnelMat(0xffb02e, 2.7, 0.42);
    const f1FresnelShell = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(1.56, 2.02, 2.24, 16, 1, true)),
      f1FresnelMat
    );
    floor1Group.add(f1FresnelShell);

    const f1Cornice = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(1.66, 1.56, 0.18, 12)), brassTrimMat);
    f1Cornice.position.y = 1.08;
    floor1Group.add(f1Cornice);

    // 8 Gothic Ribbed Flying Buttresses, Recessed Furnace Lancets & Parapet Forge Braziers
    const buttressPierGeo = regGeo(new THREE.BoxGeometry(0.24, 1.95, 0.54));
    const buttressArchGeo = regGeo(new THREE.BoxGeometry(0.18, 0.95, 0.24));
    const lancetFrameGeo = regGeo(new THREE.BoxGeometry(0.24, 1.18, 0.14));
    const lancetSlitGeo = regGeo(new THREE.BoxGeometry(0.075, 0.96, 0.06));
    const spireletGeo = regGeo(new THREE.ConeGeometry(0.13, 0.56, 4));
    const brazierBowlGeo = regGeo(new THREE.CylinderGeometry(0.11, 0.06, 0.12, 6));
    const brazierFlameGeo = regGeo(new THREE.OctahedronGeometry(0.075, 0));
    const f1BrazierGems: THREE.Mesh[] = [];

    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI * 2) / 8;
      const bWrap = new THREE.Group();
      bWrap.rotation.y = ang;

      const outerPier = new THREE.Mesh(buttressPierGeo, stoneDarkMat);
      outerPier.position.set(0, -0.18, 1.92);
      const pinnacle = new THREE.Mesh(spireletGeo, f1StoneMat);
      pinnacle.position.set(0, 1.08, 1.92);
      const archStrut = new THREE.Mesh(buttressArchGeo, f1StoneMat);
      archStrut.position.set(0, 0.35, 1.65);
      archStrut.rotation.x = -0.45;
      bWrap.add(outerPier, pinnacle, archStrut);

      // Recessed molten furnace lancet + parapet forge brazier between buttresses
      const wWrap = new THREE.Group();
      wWrap.rotation.y = ang + Math.PI / 8;
      const frame = new THREE.Mesh(lancetFrameGeo, stoneDarkMat);
      frame.position.set(0, 0.04, 1.68);
      const slit = new THREE.Mesh(lancetSlitGeo, f1GlowMat);
      slit.position.set(0, 0.04, 1.72);
      const bowl = new THREE.Mesh(brazierBowlGeo, brassTrimMat);
      bowl.position.set(0, 1.2, 1.56);
      const flame = new THREE.Mesh(brazierFlameGeo, f1GlowMat);
      flame.position.set(0, 1.32, 1.56);
      flame.scale.set(0.8, 1.3, 0.8);
      f1BrazierGems.push(flame);
      wWrap.add(frame, slit, bowl, flame);

      floor1Group.add(bWrap, wWrap);
    }

    const f1OrbitRingGroup = new THREE.Group();
    floor1Group.add(f1OrbitRingGroup);
    const f1ArcGeo = regGeo(new THREE.TorusGeometry(2.38, 0.022, 8, 18, Math.PI * 0.24));
    const f1SatGeo = regGeo(new THREE.OctahedronGeometry(0.11, 0));
    for (let i = 0; i < 6; i++) {
      const arc = new THREE.Mesh(f1ArcGeo, f1GlowMat);
      arc.rotation.x = Math.PI / 2;
      arc.rotation.z = (i * Math.PI * 2) / 6;
      arc.position.y = -0.35;
      f1OrbitRingGroup.add(arc);
    }
    for (let i = 0; i < 4; i++) {
      const sat = new THREE.Mesh(f1SatGeo, f1GlowMat);
      const a = (i * Math.PI * 2) / 4;
      sat.position.set(Math.cos(a) * 2.52, -0.32, Math.sin(a) * 2.52);
      f1OrbitRingGroup.add(sat);
    }

    // --- FLOOR 2: Glacial Bastion (Rime-Veined Slate + Cryo Shards + Waist Frost Mist Collar) ---
    const floor2Group = new THREE.Group();
    floor2Group.position.y = 0.36;
    citadelRoot.add(floor2Group);

    const f2Plinth = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(1.42, 1.62, 0.22, 12)), f2StoneMat);
    f2Plinth.position.y = -1.04;
    floor2Group.add(f2Plinth);

    const f2Body = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(1.06, 1.38, 1.95, 8)), f2StoneMat);
    floor2Group.add(f2Body);

    const f2FresnelMat = createFresnelMat(0x38bdf8, 2.5, 0.44);
    const f2FresnelShell = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(1.13, 1.46, 1.96, 12, 1, true)),
      f2FresnelMat
    );
    floor2Group.add(f2FresnelShell);

    const f2Trim = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(1.18, 1.12, 0.12, 8)), brassTrimMat);
    f2Trim.position.y = 0.96;
    floor2Group.add(f2Trim);

    // Mid-waist Swirling Glacial Mist Collar marking Floor 1 -> Floor 2 thermal divide
    const midMistMat = regMat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(0x38bdf8) },
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
          void main() {
            vec2 p = (vUv - 0.5) * 2.0;
            float r = length(p);
            float ang = atan(p.y, p.x);
            float radialMask = smoothstep(0.45, 0.62, r) * (1.0 - smoothstep(0.75, 1.0, r));
            float swirl = 0.5 + 0.5 * sin(ang * 5.0 - uTime * 0.9 + r * 6.0);
            float swirl2 = 0.5 + 0.5 * cos(ang * 3.0 + uTime * 0.65 - r * 4.0);
            float vapor = radialMask * (0.45 + 0.55 * swirl * swirl2);
            float a = clamp(vapor * (0.28 + uBoost * 0.34), 0.0, 0.72);
            gl_FragColor = vec4(uColor * (0.95 + uBoost * 0.5), a);
          }
        `,
      })
    );
    const midMistMesh = new THREE.Mesh(regGeo(new THREE.PlaneGeometry(5.6, 5.6)), midMistMat);
    midMistMesh.rotation.x = -Math.PI / 2;
    midMistMesh.position.y = -0.88;
    floor2Group.add(midMistMesh);

    const f2WindowGeo = regGeo(new THREE.BoxGeometry(0.065, 0.95, 0.05));
    const cryoColGeo = regGeo(new THREE.CylinderGeometry(0.09, 0.14, 1.55, 6));
    const cryoTipGeo = regGeo(new THREE.OctahedronGeometry(0.18, 0));
    const cryoSpireGeo = regGeo(new THREE.ConeGeometry(0.1, 0.58, 5));
    const f2CrystalsGroup = new THREE.Group();
    floor2Group.add(f2CrystalsGroup);

    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI * 2) / 6;

      // Attached tall gothic lancet mullions + glowing frost core slits
      const lancetWrap = new THREE.Group();
      lancetWrap.rotation.y = ang + Math.PI / 6;
      const frostSlit = new THREE.Mesh(f2WindowGeo, f2GlowMat);
      frostSlit.position.set(0, 0.02, 1.24);
      const baseIceSpike = new THREE.Mesh(cryoSpireGeo, cryoFacetMat);
      baseIceSpike.position.set(0, -0.78, 1.54);
      baseIceSpike.rotation.x = 0.52;
      lancetWrap.add(frostSlit, baseIceSpike);
      floor2Group.add(lancetWrap);

      // Cantilevered flanking stone pinnacle + suspended glowing cryo prism
      const colWrap = new THREE.Group();
      colWrap.rotation.y = ang;
      const stonePin = new THREE.Mesh(cryoColGeo, stoneDarkMat);
      stonePin.position.set(0, -0.04, 1.52);
      const crystalHead = new THREE.Mesh(cryoTipGeo, f2GlowMat);
      crystalHead.position.set(0, 0.72, 1.52);
      crystalHead.scale.set(0.6, 1.25, 0.6);
      colWrap.add(stonePin, crystalHead);
      floor2Group.add(colWrap);

      // Orbiting faceted glacier diamond fragments + broken cryo rune arcs
      const orbitCrystal = new THREE.Mesh(cryoTipGeo, f2GlowMat);
      orbitCrystal.position.set(
        Math.cos(ang) * 1.96,
        i % 2 === 0 ? 0.16 : -0.16,
        Math.sin(ang) * 1.96
      );
      orbitCrystal.scale.set(0.45, 1.2, 0.45);
      f2CrystalsGroup.add(orbitCrystal);

      const f2Arc = new THREE.Mesh(
        regGeo(new THREE.TorusGeometry(1.78, 0.018, 8, 16, Math.PI * 0.22)),
        f2GlowMat
      );
      f2Arc.rotation.x = Math.PI / 2;
      f2Arc.rotation.z = ang + 0.12;
      f2Arc.position.y = 0.08;
      f2CrystalsGroup.add(f2Arc);
    }

    // --- FLOOR 3: Void Apex Sanctum (Obsidian Circuit Monolith + Fresnel Veil + Astrolabe Nodes) ---
    const floor3Group = new THREE.Group();
    floor3Group.position.y = 2.42;
    citadelRoot.add(floor3Group);

    const f3Base = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(1.06, 1.24, 0.2, 8)), stoneDarkMat);
    f3Base.position.y = -0.98;
    floor3Group.add(f3Base);

    const f3Body = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.62, 0.98, 1.85, 8)), f3StoneMat);
    floor3Group.add(f3Body);

    // Gothic roof pinnacle needle rising gracefully to crown
    const f3SpireRoof = new THREE.Mesh(regGeo(new THREE.ConeGeometry(0.7, 2.25, 8)), f3StoneMat);
    f3SpireRoof.position.y = 2.02;
    floor3Group.add(f3SpireRoof);

    // Translucent Additive Fresnel Void Aura sheathing upper spire & apex diamond
    const f3FresnelMat = createFresnelMat(0xa855f7, 2.4, 0.56);
    const f3FresnelShell = new THREE.Mesh(
      regGeo(new THREE.ConeGeometry(0.84, 2.55, 16, 1, true)),
      f3FresnelMat
    );
    f3FresnelShell.position.y = 2.04;
    floor3Group.add(f3FresnelShell);

    // 8 Flaring Obsidian Crown Pinnacles + Slender Violet Runic Lancet Slits
    const crownGroup = new THREE.Group();
    floor3Group.add(crownGroup);
    const hornGeo = regGeo(new THREE.ConeGeometry(0.11, 1.25, 4));
    const voidSlitGeo = regGeo(new THREE.BoxGeometry(0.055, 1.05, 0.04));

    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI * 2) / 8;
      const hornWrap = new THREE.Group();
      hornWrap.rotation.y = ang;
      const horn = new THREE.Mesh(hornGeo, f3StoneMat);
      horn.position.set(0, 1.15, 0.86);
      horn.rotation.x = -0.18;
      const slit = new THREE.Mesh(voidSlitGeo, f3GlowMat);
      slit.position.set(0, -0.05, 0.82);
      hornWrap.add(horn, slit);
      crownGroup.add(hornWrap);
    }

    // 4 Floating Obsidian Monolith Fin Blades around upper Void Sanctum
    const finGeo = regGeo(new THREE.OctahedronGeometry(0.14, 0));
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const fin = new THREE.Mesh(finGeo, f3StoneMat);
      fin.position.set(Math.cos(ang) * 1.32, 0.36, Math.sin(ang) * 1.32);
      fin.scale.set(0.45, 2.5, 0.22);
      fin.rotation.y = -ang;
      crownGroup.add(fin);
    }

    // Precision Precessing Astrolabe / Armillary Rings + Ring-Mounted Gimbal Nodes
    const astrolabeRingA = new THREE.Mesh(regGeo(new THREE.TorusGeometry(1.42, 0.02, 8, 64)), f3GlowMat);
    astrolabeRingA.rotation.x = Math.PI / 2.6;
    astrolabeRingA.position.y = 0.82;
    floor3Group.add(astrolabeRingA);

    const astrolabeRingB = new THREE.Mesh(regGeo(new THREE.TorusGeometry(1.12, 0.017, 8, 64)), f3GlowMat);
    astrolabeRingB.rotation.x = -Math.PI / 2.9;
    astrolabeRingB.position.y = 1.48;
    floor3Group.add(astrolabeRingB);

    const gimbalNodeGeo = regGeo(new THREE.OctahedronGeometry(0.058, 0));
    for (let g = 0; g < 3; g++) {
      const ga = (g * Math.PI * 2) / 3;
      const nodeA = new THREE.Mesh(gimbalNodeGeo, apexCoreMat);
      nodeA.position.set(Math.cos(ga) * 1.42, Math.sin(ga) * 1.42, 0);
      astrolabeRingA.add(nodeA);

      const nodeB = new THREE.Mesh(gimbalNodeGeo, apexCoreMat);
      nodeB.position.set(Math.cos(ga + 0.5) * 1.12, Math.sin(ga + 0.5) * 1.12, 0);
      astrolabeRingB.add(nodeB);
    }

    const astrolabeRingC = new THREE.Mesh(regGeo(new THREE.TorusGeometry(0.86, 0.015, 8, 56)), apexCoreMat);
    astrolabeRingC.rotation.y = Math.PI / 3;
    astrolabeRingC.position.y = 2.05;
    floor3Group.add(astrolabeRingC);

    const crownOrbGroup = new THREE.Group();
    crownOrbGroup.position.y = 1.15;
    floor3Group.add(crownOrbGroup);
    const voidOrbGeo = regGeo(new THREE.OctahedronGeometry(0.095, 0));
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      const orb = new THREE.Mesh(voidOrbGeo, f3GlowMat);
      orb.position.set(Math.cos(a) * 1.48, 0.18 * Math.sin(i * 2.1), Math.sin(a) * 1.48);
      crownOrbGroup.add(orb);
    }

    // Floating Shattered Apex Relic Crystal + Silhouette-Matched Crystalline Aura Shell
    const apexBeacon = new THREE.Mesh(regGeo(new THREE.OctahedronGeometry(0.26, 0)), apexCoreMat);
    apexBeacon.position.y = 3.36;
    apexBeacon.scale.set(0.76, 1.55, 0.76);
    floor3Group.add(apexBeacon);

    const apexAuraMat = createFresnelMat(0xc084fc, 2.9, 0.48);
    const apexAuraShell = new THREE.Mesh(regGeo(new THREE.OctahedronGeometry(0.32, 1)), apexAuraMat);
    apexAuraShell.position.y = 3.36;
    apexAuraShell.scale.set(0.84, 1.68, 0.84);
    floor3Group.add(apexAuraShell);

    // =========================================================================
    // 7. VOLUMETRIC CASCADE VEIL + TIER-ISOLATED BOKEH & GLINT PARTICLE CLOUDS
    // =========================================================================
    const shockMat = regMat(
      new THREE.MeshBasicMaterial({
        color: 0xf2a63b,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const shockRing = new THREE.Mesh(regGeo(new THREE.RingGeometry(1.25, 1.5, 48)), shockMat);
    shockRing.rotation.x = -Math.PI / 2;
    citadelRoot.add(shockRing);

    const wavePrimaryMat = regMat(
      new THREE.MeshBasicMaterial({
        color: 0xf2a63b,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const waveRingPrimary = new THREE.Mesh(regGeo(new THREE.RingGeometry(1.88, 2.04, 64)), wavePrimaryMat);
    waveRingPrimary.rotation.x = -Math.PI / 2;
    citadelRoot.add(waveRingPrimary);

    const waveSecondaryMat = regMat(
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const waveRingSecondary = new THREE.Mesh(regGeo(new THREE.RingGeometry(1.88, 2.04, 64)), waveSecondaryMat);
    waveRingSecondary.rotation.x = -Math.PI / 2;
    citadelRoot.add(waveRingSecondary);

    // Soft feathered cylindrical volumetric ribbon traveling smoothly with the cascade wave crest
    const waveCollarMat = regMat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
        uniforms: {
          uColor: { value: new THREE.Color(0xf2a63b) },
          uOpacity: { value: 0 },
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
          uniform float uOpacity;
          varying vec2 vUv;
          void main() {
            float band = exp(-pow((vUv.y - 0.5) * 4.2, 2.0));
            float shimmer = 0.8 + 0.2 * sin(vUv.x * 37.699);
            float a = clamp(band * shimmer * uOpacity, 0.0, 0.78);
            gl_FragColor = vec4(uColor * 1.4, a);
          }
        `,
      })
    );
    const waveCollarMesh = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(1.98, 2.28, 1.25, 48, 1, true)),
      waveCollarMat
    );
    citadelRoot.add(waveCollarMesh);

    const createTierParticleSystem = ({
      count,
      yMin,
      yMax,
      radMin,
      radMax,
      omegaBase,
      riseMin,
      riseMax,
      texture,
      size,
      initialHex,
    }: {
      count: number;
      yMin: number;
      yMax: number;
      radMin: number;
      radMax: number;
      omegaBase: number;
      riseMin: number;
      riseMax: number;
      texture: THREE.CanvasTexture;
      size: number;
      initialHex: number;
    }) => {
      const posArr = new Float32Array(count * 3);
      const radii = new Float32Array(count);
      const angles = new Float32Array(count);
      const ys = new Float32Array(count);
      const omegas = new Float32Array(count);
      const speeds = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = radMin + Math.random() * (radMax - radMin);
        const y = yMin + Math.random() * (yMax - yMin);
        angles[i] = ang;
        radii[i] = rad;
        ys[i] = y;
        omegas[i] = (omegaBase + Math.random() * 0.45) * (i % 3 === 0 ? -1 : 1);
        speeds[i] = riseMin + Math.random() * (riseMax - riseMin);
        posArr[i * 3] = Math.cos(ang) * rad;
        posArr[i * 3 + 1] = y;
        posArr[i * 3 + 2] = Math.sin(ang) * rad;
      }
      const geo = regGeo(new THREE.BufferGeometry());
      geo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
      const mat = regMat(
        new THREE.PointsMaterial({
          color: initialHex,
          map: texture,
          size,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          sizeAttenuation: true,
        })
      );
      const points = new THREE.Points(geo, mat);
      citadelRoot.add(points);

      const update = (omegaMult: number, riseMult: number) => {
        for (let i = 0; i < count; i++) {
          angles[i] += omegas[i] * 0.016 * omegaMult;
          ys[i] += speeds[i] * riseMult;
          if (ys[i] > yMax) ys[i] = yMin;
          if (ys[i] < yMin) ys[i] = yMax;
          const r = radii[i];
          const a = angles[i];
          posArr[i * 3] = Math.cos(a) * r;
          posArr[i * 3 + 1] = ys[i];
          posArr[i * 3 + 2] = Math.sin(a) * r;
        }
        geo.attributes.position.needsUpdate = true;
      };

      return { mat, update };
    };

    const isShowcase = mode === "showcase";
    const f1Particles = createTierParticleSystem({
      count: isShowcase ? 88 : 38,
      yMin: -3.65,
      yMax: -0.25,
      radMin: 2.0,
      radMax: isShowcase ? 8.4 : 3.4,
      omegaBase: 0.34,
      riseMin: 0.008,
      riseMax: 0.02,
      texture: bokehSparkTex,
      size: isShowcase ? 0.24 : 0.16,
      initialHex: 0xffb02e,
    });
    const f2Particles = createTierParticleSystem({
      count: isShowcase ? 78 : 34,
      yMin: -0.65,
      yMax: 1.55,
      radMin: 1.7,
      radMax: isShowcase ? 7.2 : 3.1,
      omegaBase: 0.56,
      riseMin: -0.004,
      riseMax: 0.004,
      texture: iceGlintTex,
      size: isShowcase ? 0.26 : 0.18,
      initialHex: 0x38bdf8,
    });
    const f3Particles = createTierParticleSystem({
      count: isShowcase ? 76 : 32,
      yMin: 1.5,
      yMax: 5.9,
      radMin: 1.2,
      radMax: isShowcase ? 7.4 : 2.9,
      omegaBase: 0.28,
      riseMin: 0.005,
      riseMax: 0.015,
      texture: bokehSparkTex,
      size: isShowcase ? 0.22 : 0.15,
      initialHex: 0xa855f7,
    });

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
    // 9. ANIMATION, HARMONIC CASCADE WAVE & HDR BLOOM SYNCHRONIZATION LOOP
    // =========================================================================
    const COL_SOLAR = new THREE.Color(0xffb02e);
    const COL_FROST = new THREE.Color(0x38bdf8);
    const COL_VOID = new THREE.Color(0xa855f7);
    const COL_APEX_IDLE = new THREE.Color(0xc084fc);

    const curF1Col = COL_SOLAR.clone();
    const curF2Col = COL_FROST.clone();
    const curF3Col = COL_VOID.clone();
    const curApexCol = COL_APEX_IDLE.clone();
    const cascadeCol = new THREE.Color(0xffb02e);
    const envTargetCol = new THREE.Color(0xf2a63b);
    const envCurrentCol = new THREE.Color(0xf2a63b);

    const smoothstep01 = (v: number) => {
      const t = Math.max(0, Math.min(1, v));
      return t * t * (3 - 2 * t);
    };

    let lastCascadeOrigin: number | null = null;
    let waveClock = 0;
    let time = 0;
    let hoverScalar = 0;
    let rafId = 0;
    let prevPerf = performance.now();

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, Math.max(0.004, (now - prevPerf) / 1000));
      prevPerf = now;
      const dtFactor = dt / 0.016;

      const paused = pausedRef.current;
      // Keep gentle living orbit even if OS reduced-motion is on; explicit Pause freezes time.
      const motionScale = paused ? 0 : reducedMotionRef.current ? 0.35 : 1;
      const selFloor = selectedFloorRef.current;
      const hovFloor = hoveredFloorRef.current;
      const towerHot = hovFloor !== null;

      const targetHover = towerHot ? 1 : 0;
      const prevHoverScalar = hoverScalar;
      hoverScalar += (targetHover - hoverScalar) * (1 - Math.exp(-6.0 * dt));

      if (motionScale > 0) {
        time += dt * motionScale;
        if (!isDragging) {
          thetaRef.current +=
            (0.0045 + hoverScalar * 0.0042) * motionScale * dtFactor + velThetaRef.current;
          velThetaRef.current *= Math.pow(0.92, dtFactor);
        }
      }

      // Smooth camera transition
      const prevDist = currentDistRef.current;
      currentLookYRef.current += (targetLookYRef.current - currentLookYRef.current) * (1 - Math.exp(-5.5 * dt));
      const hoverDistPull = towerHot ? -0.48 : 0;
      currentDistRef.current +=
        (targetDistRef.current + hoverDistPull - currentDistRef.current) * (1 - Math.exp(-5.5 * dt));

      const sinPhi = Math.sin(phiRef.current);
      camera.position.set(
        currentDistRef.current * sinPhi * Math.sin(thetaRef.current),
        currentLookYRef.current + currentDistRef.current * Math.cos(phiRef.current),
        currentDistRef.current * sinPhi * Math.cos(thetaRef.current)
      );
      camera.lookAt(0, currentLookYRef.current, 0);

      // Harmonic cascade state progression across Floor 1 / 2 / 3 (delta-time normalized)
      if (hovFloor !== null) {
        if (hovFloor !== lastCascadeOrigin) {
          lastCascadeOrigin = hovFloor;
          waveClock = 0;
        }
        waveClock = Math.min(1.2, waveClock + dt * 1.38);
        cascadeCol.copy(hovFloor === 1 ? COL_SOLAR : hovFloor === 2 ? COL_FROST : COL_VOID);
      } else {
        lastCascadeOrigin = null;
        waveClock = Math.max(0, waveClock - dt * 3.5);
      }

      const d1 = hovFloor === null ? 0 : Math.abs(1 - hovFloor);
      const d2 = hovFloor === null ? 0 : Math.abs(2 - hovFloor);
      const d3 = hovFloor === null ? 0 : Math.abs(3 - hovFloor);

      const stepDelay = (dist: number) => (dist === 0 ? 0.0 : dist === 1 ? 0.2 : 0.4);
      const prog1 = hovFloor !== null ? smoothstep01((waveClock - stepDelay(d1)) / 0.34) : 0;
      const prog2 = hovFloor !== null ? smoothstep01((waveClock - stepDelay(d2)) / 0.34) : 0;
      const prog3 = hovFloor !== null ? smoothstep01((waveClock - stepDelay(d3)) / 0.34) : 0;

      const crest1 = hovFloor !== null ? Math.sin(prog1 * Math.PI) : 0;
      const crest2 = hovFloor !== null ? Math.sin(prog2 * Math.PI) : 0;
      const crest3 = hovFloor !== null ? Math.sin(prog3 * Math.PI) : 0;

      // Update per-tier chromatic convergence:
      // Hover F1 -> Gold sweeps 1 -> 2 -> 3 | Hover F2 -> Blue sweeps 2 -> 1&3 | Hover F3 -> Purple sweeps 3 -> 2 -> 1
      // When idle -> smoothly melt back to distinct Triad colors (Gold / Cyan / Violet)
      if (hovFloor !== null) {
        const originLerp = 1 - Math.exp(-16.0 * dt);
        const hopLerp = 1 - Math.exp(-11.0 * dt);
        if (waveClock >= stepDelay(d1)) curF1Col.lerp(cascadeCol, d1 === 0 ? originLerp : hopLerp);
        if (waveClock >= stepDelay(d2)) curF2Col.lerp(cascadeCol, d2 === 0 ? originLerp : hopLerp);
        if (waveClock >= stepDelay(d3)) curF3Col.lerp(cascadeCol, d3 === 0 ? originLerp : hopLerp);
        if (waveClock >= stepDelay(d3)) curApexCol.lerp(cascadeCol, hopLerp);
      } else {
        const idleLerp = 1 - Math.exp(-6.0 * dt);
        curF1Col.lerp(COL_SOLAR, idleLerp);
        curF2Col.lerp(COL_FROST, idleLerp);
        curF3Col.lerp(COL_VOID, idleLerp);
        curApexCol.lerp(COL_APEX_IDLE, idleLerp);
      }

      // Traveling additive harmonic wave rings + feathered volumetric ribbon along spire silhouette
      const waveActive = hovFloor !== null && waveClock < 1.15;
      const waveNorm = smoothstep01(waveClock / 0.92);
      const ringAlpha = waveActive ? Math.sin(waveNorm * Math.PI) * 0.56 : 0;
      const ringScaleHdr = hovFloor === 2 ? 2.15 : hovFloor === 1 ? 2.45 : 2.9;
      if (ringAlpha > 0.01 && hovFloor !== null) {
        wavePrimaryMat.color.copy(cascadeCol).multiplyScalar(ringScaleHdr);
        wavePrimaryMat.opacity = ringAlpha;
        const primaryY =
          hovFloor === 1
            ? -1.75 + waveNorm * 6.2
            : hovFloor === 2
              ? 0.35 + waveNorm * 4.1
              : 4.25 - waveNorm * 6.3;
        const ringScaleFactor = 1.22 - ((primaryY + 2) / 6.5) * 0.38;
        waveRingPrimary.position.y = primaryY;
        waveRingPrimary.scale.setScalar(ringScaleFactor);
        waveCollarMesh.position.y = primaryY;
        waveCollarMesh.scale.setScalar(ringScaleFactor);
        waveCollarMat.uniforms.uColor.value.copy(cascadeCol).multiplyScalar(ringScaleHdr * 0.65);
        waveCollarMat.uniforms.uOpacity.value = ringAlpha * 0.68;

        if (hovFloor === 2) {
          waveSecondaryMat.color.copy(cascadeCol).multiplyScalar(ringScaleHdr);
          waveSecondaryMat.opacity = ringAlpha;
          const secondaryY = 0.35 - waveNorm * 2.45;
          waveRingSecondary.position.y = secondaryY;
          waveRingSecondary.scale.setScalar(1.0 + waveNorm * 0.34);
        } else {
          waveSecondaryMat.opacity = 0;
        }
      } else {
        wavePrimaryMat.opacity = 0;
        waveSecondaryMat.opacity = 0;
        waveCollarMat.uniforms.uOpacity.value = 0;
      }

      // Environmental wash color tracks hovered floor (or active floor / dominant element)
      const activeFocus = hovFloor ?? selFloor;
      const focusHex =
        hovFloor !== null
          ? hovFloor === 1
            ? 0xffb02e
            : hovFloor === 2
              ? 0x38bdf8
              : 0xa855f7
          : FLOOR_COLORS[activeFocus] ?? ELEMENT_COLORS[dominantElementRef.current] ?? 0xf2a63b;
      envTargetCol.setHex(focusHex);
      envCurrentCol.lerp(envTargetCol, 0.1);
      const focusY = FLOOR_CAM_TARGET_Y[activeFocus] ?? 0.5;

      coronaPlane.position.y += (focusY - coronaPlane.position.y) * 0.1;
      coronaPlane.lookAt(camera.position);
      coronaShaderMat.uniforms.uTime.value = time;
      coronaShaderMat.uniforms.uColor.value.copy(envCurrentCol);
      coronaShaderMat.uniforms.uBoost.value = hoverScalar + Math.max(crest1, crest2, crest3) * 0.45;

      // Synchronize Sky Dome scattering & mountain bounce illumination
      const dirToTower = new THREE.Vector3(0, 0.35 + focusY * 0.04, 0)
        .sub(camera.position)
        .normalize();
      skyDomeMat.uniforms.uTime.value = time;
      skyDomeMat.uniforms.uBeaconColor.value.copy(envCurrentCol);
      skyDomeMat.uniforms.uBeaconDir.value.copy(dirToTower);
      skyDomeMat.uniforms.uBloomBoost.value = hoverScalar;

      // Synchronized tier & valley lights (per-element balanced HDR luminance so obsidian stone stays crisp)
      const cascadeLumCap = hovFloor === 2 ? 0.66 : hovFloor === 1 ? 0.78 : 1.0;
      valleyWashLight.color.copy(envCurrentCol);
      valleyWashLight.intensity = 5.5 + hoverScalar * (hovFloor === 2 ? 7.2 : 10.0);
      keepCoreLight.color.copy(curF1Col);
      keepCoreLight.intensity = 8.0 + crest1 * 6.0 * cascadeLumCap + (hovFloor !== null ? 3.5 * cascadeLumCap : 0);
      bastionCoreLight.color.copy(curF2Col);
      bastionCoreLight.intensity = 7.5 + crest2 * 6.0 * cascadeLumCap + (hovFloor !== null ? 3.5 * cascadeLumCap : 0);
      apexAuraLight.color.copy(curF3Col);
      apexAuraLight.intensity = 8.0 + crest3 * 6.2 * cascadeLumCap + (hovFloor !== null ? 4.0 * cascadeLumCap : 0);

      mistShaderMat.uniforms.uTime.value = time;
      mistShaderMat.uniforms.uColor.value.copy(envCurrentCol);
      mistShaderMat.uniforms.uBoost.value = hoverScalar * (hovFloor === 2 ? 0.75 : 1.0);

      midMistMat.uniforms.uTime.value = time;
      midMistMat.uniforms.uColor.value.copy(curF2Col);
      midMistMat.uniforms.uBoost.value = hoverScalar + crest2 * 0.45;

      magicCircleMat.uniforms.uTime.value = time;
      magicCircleMat.uniforms.uHover.value = hoverScalar;
      magicCircleMat.uniforms.uColor.value.copy(envCurrentCol);
      magicCircleMesh.scale.setScalar(1 + hoverScalar * 0.12);

      magicDialMat.color.copy(envCurrentCol);
      magicDialMat.opacity = 0.36 + hoverScalar * 0.36;

      conduitBeamMat.uniforms.uColor.value.copy(envCurrentCol);
      conduitBeamMat.uniforms.uBoost.value = hoverScalar * 0.8 + (shockwaveRef.current.active ? 0.45 : 0);

      // Floor Unlock state + Calibrated HDR Radiance Multipliers (distinct Triad idle, crisp Cascade on hover)
      const fs = floorsRef.current;
      const f2State = fs?.find((f) => f.floor === 2);
      const f3State = fs?.find((f) => f.floor === 3);

      const pulse = motionScale > 0 ? Math.sin(time * 2.5) * 0.14 : 0;
      const f1HoverGain = hovFloor !== null ? ((hovFloor === 1 ? 1.15 : prog1 * 0.95) + crest1 * 0.85) * cascadeLumCap : 0;
      const f2HoverGain = hovFloor !== null ? ((hovFloor === 2 ? 1.2 : prog2 * 1.0) + crest2 * 0.88) * cascadeLumCap : 0;
      const f3HoverGain = hovFloor !== null ? ((hovFloor === 3 ? 1.4 : prog3 * 1.15) + crest3 * 0.95) * cascadeLumCap : 0;

      const f1Mult = (hovFloor === 1 ? 1.9 : selFloor === 1 ? 1.95 : 1.68) + f1HoverGain + pulse;
      const f2Locked = Boolean(f2State && !f2State.unlocked);
      const f2Mult = f2Locked
        ? 0.48
        : (hovFloor === 2 ? 1.72 : selFloor === 2 ? 1.85 : 1.66) + f2HoverGain + pulse;
      const f3Locked = Boolean(f3State && !f3State.unlocked);
      const f3Mult = f3Locked
        ? 0.48
        : (hovFloor === 3 ? 2.15 : selFloor === 3 ? 2.1 : 1.82) + f3HoverGain + pulse;

      f1GlowMat.color.copy(curF1Col).multiplyScalar(f1Mult);
      f2GlowMat.color.copy(curF2Col).multiplyScalar(f2Mult);
      f3GlowMat.color.copy(curF3Col).multiplyScalar(f3Mult);
      apexCoreMat.color.copy(curApexCol).multiplyScalar(2.1 + f3HoverGain * 0.72 + pulse);
      pylonGlowMat.color.copy(envCurrentCol).multiplyScalar(1.75 + hoverScalar * 0.9 * cascadeLumCap);

      // Synchronized procedural masonry vein emissives & edge-lit Fresnel aura shells
      f1StoneMat.emissive.copy(curF1Col);
      f1StoneMat.emissiveIntensity =
        0.48 + crest1 * 0.65 * cascadeLumCap + (hovFloor === 1 ? 0.32 : prog1 * 0.25);
      f2StoneMat.emissive.copy(curF2Col);
      f2StoneMat.emissiveIntensity = f2Locked
        ? 0.16
        : 0.44 + crest2 * 0.58 * cascadeLumCap + (hovFloor === 2 ? 0.28 : prog2 * 0.22);
      f3StoneMat.emissive.copy(curF3Col);
      f3StoneMat.emissiveIntensity = f3Locked
        ? 0.18
        : 0.52 + crest3 * 0.7 * cascadeLumCap + (hovFloor === 3 ? 0.36 : prog3 * 0.26);

      cryoFacetMat.emissive.copy(curF2Col).multiplyScalar(0.5);
      cryoFacetMat.emissiveIntensity = f2Locked ? 0.2 : 0.52 + f2HoverGain * 0.45;

      f1FresnelMat.uniforms.uColor.value.copy(curF1Col);
      f1FresnelMat.uniforms.uIntensity.value =
        0.4 + crest1 * 0.55 * cascadeLumCap + (hovFloor === 1 ? 0.38 : prog1 * 0.24);
      f2FresnelMat.uniforms.uColor.value.copy(curF2Col);
      f2FresnelMat.uniforms.uIntensity.value = f2Locked
        ? 0.14
        : 0.42 + crest2 * 0.5 * cascadeLumCap + (hovFloor === 2 ? 0.34 : prog2 * 0.22);
      f3FresnelMat.uniforms.uColor.value.copy(curF3Col);
      f3FresnelMat.uniforms.uIntensity.value = f3Locked
        ? 0.14
        : 0.54 + crest3 * 0.62 * cascadeLumCap + (hovFloor === 3 ? 0.44 : prog3 * 0.28);
      apexAuraMat.uniforms.uColor.value.copy(curApexCol);
      apexAuraMat.uniforms.uIntensity.value = f3Locked ? 0.22 : 0.72 + f3HoverGain * 0.38 + pulse * 0.5;

      if (motionScale > 0) {
        f1OrbitRingGroup.rotation.y = time * (0.58 + hoverScalar * 0.65);
        f2CrystalsGroup.rotation.y = -time * (0.72 + hoverScalar * 0.78);
        crownGroup.rotation.y = time * 0.24;
        crownOrbGroup.rotation.y = -time * (0.85 + hoverScalar * 0.85);
        crownOrbGroup.rotation.z = Math.sin(time * 0.8) * 0.14;
        astrolabeRingA.rotation.z = time * (f3State?.enrage ? 1.4 : 0.62 + hoverScalar * 0.72);
        astrolabeRingB.rotation.z = -time * (0.76 + hoverScalar * 0.85);
        astrolabeRingC.rotation.x = time * 0.88;
        apexBeacon.rotation.y = time * (1.05 + hoverScalar * 0.9);
        apexBeacon.position.y = 3.36 + Math.sin(time * 2.2) * 0.1 + hoverScalar * 0.1;
        apexAuraShell.rotation.y = apexBeacon.rotation.y;
        apexAuraShell.position.y = apexBeacon.position.y;
        magicDialMesh.rotation.z = time * (0.14 + hoverScalar * 0.12);

        for (let i = 0; i < pylonsGroup.children.length; i++) {
          pylonsGroup.children[i].position.y = 0.98 + Math.sin(time * 1.8 + i * 1.35) * 0.15;
        }

        for (let i = 0; i < f1BrazierGems.length; i++) {
          const gem = f1BrazierGems[i];
          const flicker = Math.sin(time * 5.0 + i * 1.15);
          gem.position.y = 1.32 + flicker * 0.028;
          gem.scale.set(
            0.8 + flicker * 0.08 + hoverScalar * 0.12,
            1.3 + flicker * 0.22 + hoverScalar * 0.24,
            0.8 + flicker * 0.08 + hoverScalar * 0.12
          );
        }

        const omegaMult = (1 + hoverScalar * 1.45) * motionScale * dtFactor;
        const riseMult = (1 + hoverScalar * 1.35) * motionScale * dtFactor;
        f1Particles.update(omegaMult, riseMult);
        f2Particles.update(omegaMult * 1.15, riseMult * 0.6);
        f3Particles.update(omegaMult * 0.85, riseMult);
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

      const waveCrestPeak = Math.max(crest1, crest2, crest3);
      if (bloomPass) {
        bloomPass.strength = 0.64 + hoverScalar * (hovFloor === 2 ? 0.22 : 0.30) + waveCrestPeak * 0.22 + shockBoost;
        bloomPass.radius = 0.68 + hoverScalar * 0.18;
      }

      f1Particles.mat.color.copy(curF1Col);
      f1Particles.mat.opacity = 0.66 + crest1 * 0.25 + hoverScalar * 0.22;
      f2Particles.mat.color.copy(curF2Col);
      f2Particles.mat.opacity = f2Locked ? 0.24 : 0.64 + crest2 * 0.24 + hoverScalar * 0.22;
      f3Particles.mat.color.copy(curF3Col);
      f3Particles.mat.opacity = f3Locked ? 0.24 : 0.68 + crest3 * 0.28 + hoverScalar * 0.24;

      const hoverStillEasing = Math.abs(hoverScalar - prevHoverScalar) > 0.001;
      const camStillEasing = Math.abs(currentDistRef.current - prevDist) > 0.001;
      const colorDiff = (a: THREE.Color, b: THREE.Color) =>
        Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
      const cascadeSettling =
        (hovFloor !== null && waveClock < 1.18) ||
        colorDiff(curF1Col, COL_SOLAR) > 0.015 ||
        colorDiff(curF2Col, COL_FROST) > 0.015 ||
        colorDiff(curF3Col, COL_VOID) > 0.015;

      const shouldRender =
        motionScale > 0 ||
        isDragging ||
        hoverStillEasing ||
        camStillEasing ||
        cascadeSettling ||
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
      disposables.textures.forEach((t) => t.dispose());
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
