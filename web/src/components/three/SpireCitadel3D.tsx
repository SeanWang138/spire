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
  createGlyphRibbonTexture,
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
    mode === "showcase" ? 0.92 : FLOOR_CAM_TARGET_Y[selectedFloor] ?? 0
  );
  const currentLookYRef = useRef<number>(targetLookYRef.current);
  const targetDistRef = useRef<number>(
    mode === "showcase" ? 16.4 : FLOOR_CAM_DISTANCE[selectedFloor] ?? 8.6
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
      targetLookYRef.current = 0.92 + (FLOOR_CAM_TARGET_Y[selectedFloor] ?? 0) * 0.08;
      targetDistRef.current = 16.4;
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

    const initW = Math.max(container.clientWidth, 280);
    const initH = Math.max(container.clientHeight, 320);
    const dpr = Math.min(window.devicePixelRatio || 1, initW < 640 ? 1.5 : 1.75);
    renderer.setPixelRatio(dpr);
    renderer.setSize(initW, initH);
    renderer.setClearColor(0x050509, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "pan-y";
    renderer.domElement.setAttribute("aria-hidden", "true");
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
        0.68,
        0.76,
        0.76
      );
      composer.addPass(bloomPass);

      const outputPass = new OutputPass();
      composer.addPass(outputPass);
    } catch {
      composer = null;
      bloomPass = null;
    }

    // Procedural Cool Nocturnal Slate Studio IBL so metallic rims catch crisp twilight highlights without sepia wash
    let envRenderTarget: THREE.WebGLRenderTarget | null = null;
    try {
      const pmremGen = new THREE.PMREMGenerator(renderer);
      pmremGen.compileEquirectangularShader();
      const iblScene = new THREE.Scene();
      const iblGeo = new THREE.SphereGeometry(10, 24, 16);
      const iblMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vDir;
          void main() {
            float y = vDir.y;
            vec3 nadir = vec3(0.03, 0.03, 0.06);
            vec3 horizonSlate = vec3(0.11, 0.14, 0.24);
            vec3 skyCool = vec3(0.09, 0.19, 0.36);
            vec3 zenith = vec3(0.02, 0.03, 0.07);
            vec3 col = y < 0.0
              ? mix(horizonSlate, nadir, clamp(-y * 2.2, 0.0, 1.0))
              : mix(horizonSlate, skyCool, smoothstep(0.0, 0.36, y));
            col = mix(col, zenith, smoothstep(0.32, 0.92, y));
            float keySpot = pow(max(dot(normalize(vDir), normalize(vec3(-0.6, 0.55, 0.65))), 0.0), 10.0);
            float rimSpot = pow(max(dot(normalize(vDir), normalize(vec3(0.7, 0.35, -0.65))), 0.0), 10.0);
            float fillSpot = pow(max(dot(normalize(vDir), normalize(vec3(0.55, 0.45, 0.72))), 0.0), 8.0);
            col += vec3(0.58, 0.68, 0.92) * (keySpot * 0.62 + fillSpot * 0.28) + vec3(0.42, 0.68, 1.0) * rimSpot * 0.68;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      });
      const iblMesh = new THREE.Mesh(iblGeo, iblMat);
      iblScene.add(iblMesh);
      envRenderTarget = pmremGen.fromScene(iblScene, 0.04);
      scene.environment = envRenderTarget.texture;
      scene.environmentIntensity = 0.44;
      iblGeo.dispose();
      iblMat.dispose();
      pmremGen.dispose();
    } catch {
      envRenderTarget = null;
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

            vec3 zenithCol = vec3(0.014, 0.015, 0.028);
            vec3 midSkyCol = vec3(0.042, 0.044, 0.082);
            vec3 horizonCol = vec3(0.056, 0.058, 0.105) + uBeaconColor * 0.085;

            vec3 sky = mix(horizonCol, midSkyCol, smoothstep(-0.08, 0.28, h));
            sky = mix(sky, zenithCol, smoothstep(0.22, 0.85, h));

            // Backlit twilight cloud bands drifting across mountain peaks
            vec2 cloudUv = dir.xz / max(0.2, abs(dir.y) + 0.18);
            float n1 = fbm(cloudUv * 1.45 + vec2(uTime * 0.014, -uTime * 0.008));
            float n2 = fbm(cloudUv * 3.1 - vec2(uTime * 0.021, uTime * 0.011));
            float cloudMask = smoothstep(0.38, 0.82, n1 * 0.65 + n2 * 0.35) * smoothstep(-0.12, 0.32, dir.y) * (1.0 - smoothstep(0.45, 0.92, dir.y));

            float spireAlign = max(dot(normalize(vec3(dir.x, dir.y * 0.85, dir.z)), normalize(uBeaconDir)), 0.0);
            float scatterWide = pow(spireAlign, 2.2);
            float scatterCore = pow(spireAlign, 7.2);

            vec3 cloudLit = mix(vec3(0.07, 0.08, 0.14), uBeaconColor * (0.58 + uBloomBoost * 0.72), scatterWide);
            sky += cloudLit * cloudMask * (0.36 + uBloomBoost * 0.28);

            // Radiant atmospheric scatter halo behind citadel silhouette
            sky += uBeaconColor * (scatterCore * (0.22 + uBloomBoost * 0.38) + scatterWide * 0.08);

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
    // 2. THREE-POINT + SYMMETRICAL 360-DEGREE CITADEL BOUNCE LIGHTING
    // =========================================================================
    const hemiLight = new THREE.HemisphereLight(0x9ab0d4, 0x16121c, 0.88);
    scene.add(hemiLight);

    const moonKey = new THREE.DirectionalLight(0xf6ead6, 1.05);
    moonKey.position.set(-7, 11, 8);
    scene.add(moonKey);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.92);
    rimLight.position.set(10, 6, -11);
    scene.add(rimLight);

    // Symmetrical core + twin keep bounce fills so Floor 1 ashlar illuminated uniformly on every bay
    const keepCoreLight = new THREE.PointLight(0xffb02e, 7.5, 22, 1.45);
    keepCoreLight.position.set(0, -1.75, 0);
    scene.add(keepCoreLight);

    const keepFillFront = new THREE.PointLight(0xffb02e, 4.2, 18, 1.4);
    keepFillFront.position.set(-2.4, -1.85, 3.0);
    scene.add(keepFillFront);

    const keepFillRear = new THREE.PointLight(0xffb02e, 4.2, 18, 1.4);
    keepFillRear.position.set(2.4, -1.85, -3.0);
    scene.add(keepFillRear);

    const bastionCoreLight = new THREE.PointLight(0x38bdf8, 6.8, 22, 1.45);
    bastionCoreLight.position.set(0, 0.4, 0);
    scene.add(bastionCoreLight);

    const valleyWashLight = new THREE.PointLight(0xffb02e, 5.2, 38, 1.25);
    valleyWashLight.position.set(0, 1.4, 2.8);
    scene.add(valleyWashLight);

    const apexAuraLight = new THREE.PointLight(0xa855f7, 7.2, 24, 1.38);
    apexAuraLight.position.set(0, 3.5, 0);
    scene.add(apexAuraLight);

    // =========================================================================
    // 3. PROCEDURAL NORMAL/AO PBR MASONRY, WAVE SHADERS & LEADED CORE GLAZING
    // =========================================================================
    const f1Maps = createTierPbrTextures(1, regTex, { x: 3, y: 1.5 });
    const f2Maps = createTierPbrTextures(2, regTex, { x: 2, y: 1.5 });
    const f3Maps = createTierPbrTextures(3, regTex, { x: 2, y: 2 });
    const brassMaps = createHammeredBrassMaps(regTex);
    const cliffMaps = createCliffRockMaps(regTex);
    const bokehSparkTex = createBokehSparkTexture(regTex);
    const iceGlintTex = createIceGlintTexture(regTex);
    const arcaneDialTex = createArcaneDialTexture(regTex);
    const glyphRibbonTex = createGlyphRibbonTexture(regTex);

    const waveShaderState = {
      uWaveRadius: { value: 0 },
      uWaveOriginY: { value: -2.0 },
      uWaveDir: { value: 1 },
      uWaveMix: { value: 0 },
      uWaveColor: { value: new THREE.Color(0xffb02e) },
      uWaveCrestIntensity: { value: 1.25 },
    };

    const applyCascadeWaveShader = (mat: THREE.MeshStandardMaterial) => {
      mat.customProgramCacheKey = () => "citadel-stone-cascade-v2";
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uWaveRadius = waveShaderState.uWaveRadius;
        shader.uniforms.uWaveOriginY = waveShaderState.uWaveOriginY;
        shader.uniforms.uWaveDir = waveShaderState.uWaveDir;
        shader.uniforms.uWaveMix = waveShaderState.uWaveMix;
        shader.uniforms.uWaveColor = waveShaderState.uWaveColor;
        shader.uniforms.uWaveCrestIntensity = waveShaderState.uWaveCrestIntensity;

        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying vec3 vCitadelWorldPos;"
          )
          .replace(
            "#include <project_vertex>",
            "#include <project_vertex>\nvCitadelWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;"
          );

        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            `#include <common>
            varying vec3 vCitadelWorldPos;
            uniform float uWaveRadius;
            uniform float uWaveOriginY;
            uniform float uWaveDir;
            uniform float uWaveMix;
            uniform vec3 uWaveColor;
            uniform float uWaveCrestIntensity;`
          )
          .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
            if (uWaveMix > 0.001) {
              float distAlong = uWaveDir > 0.5
                ? (vCitadelWorldPos.y - uWaveOriginY)
                : (uWaveDir < -0.5 ? (uWaveOriginY - vCitadelWorldPos.y) : abs(vCitadelWorldPos.y - uWaveOriginY));
              distAlong = max(0.0, distAlong);
              float crest = exp(-pow((distAlong - uWaveRadius) / 0.56, 2.0)) * uWaveMix;
              float wake = exp(-max(0.0, uWaveRadius - distAlong) * 0.45) * smoothstep(-0.2, 0.2, uWaveRadius - distAlong) * 0.42 * uWaveMix;
              float veinMask = clamp(max(totalEmissiveRadiance.r, max(totalEmissiveRadiance.g, totalEmissiveRadiance.b)), 0.0, 2.2);
              totalEmissiveRadiance += uWaveColor * veinMask * (crest * uWaveCrestIntensity + wake * 0.65);
            }`
          );
      };
    };

    const f1StoneMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xd4d6de,
        map: f1Maps.map,
        normalMap: f1Maps.normalMap,
        normalScale: new THREE.Vector2(1.1, 1.1),
        aoMap: f1Maps.aoMap,
        aoMapIntensity: 0.85,
        roughnessMap: f1Maps.roughnessMap,
        roughness: 0.88,
        metalness: 0.26,
        emissive: new THREE.Color(0xffb02e),
        emissiveMap: f1Maps.emissiveMap,
        emissiveIntensity: 0.62,
      })
    );
    applyCascadeWaveShader(f1StoneMat);

    const f2StoneMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xd8e6f4,
        map: f2Maps.map,
        normalMap: f2Maps.normalMap,
        normalScale: new THREE.Vector2(1.05, 1.05),
        aoMap: f2Maps.aoMap,
        aoMapIntensity: 0.85,
        roughnessMap: f2Maps.roughnessMap,
        roughness: 0.9,
        metalness: 0.34,
        emissive: new THREE.Color(0x38bdf8),
        emissiveMap: f2Maps.emissiveMap,
        emissiveIntensity: 0.55,
      })
    );
    applyCascadeWaveShader(f2StoneMat);

    const f3StoneMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xdcd4f0,
        map: f3Maps.map,
        normalMap: f3Maps.normalMap,
        normalScale: new THREE.Vector2(0.95, 0.95),
        aoMap: f3Maps.aoMap,
        aoMapIntensity: 0.85,
        roughnessMap: f3Maps.roughnessMap,
        roughness: 0.84,
        metalness: 0.54,
        emissive: new THREE.Color(0xa855f7),
        emissiveMap: f3Maps.emissiveMap,
        emissiveIntensity: 0.62,
      })
    );
    applyCascadeWaveShader(f3StoneMat);

    const cryoFacetMat = regMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x8cdbff,
        emissive: new THREE.Color(0x1b6ca8),
        emissiveIntensity: 0.48,
        roughness: 0.14,
        metalness: 0.3,
        clearcoat: 0.88,
        clearcoatRoughness: 0.1,
        flatShading: true,
      })
    );
    const stoneDarkMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x161722,
        normalMap: cliffMaps.normalMap,
        normalScale: new THREE.Vector2(0.65, 0.65),
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
        normalMap: cliffMaps.normalMap,
        normalScale: new THREE.Vector2(1.2, 1.2),
        roughnessMap: cliffMaps.roughnessMap,
        roughness: 0.9,
        metalness: 0.18,
        flatShading: true,
      })
    );
    const solarBrassTrimMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xd2973b,
        normalMap: brassMaps.normalMap,
        normalScale: new THREE.Vector2(0.55, 0.55),
        roughnessMap: brassMaps.roughnessMap,
        roughness: 0.34,
        metalness: 0.88,
      })
    );
    const frostSilverTrimMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x8bc6ee,
        emissive: new THREE.Color(0x0b2a47),
        emissiveIntensity: 0.45,
        normalMap: brassMaps.normalMap,
        normalScale: new THREE.Vector2(0.55, 0.55),
        roughnessMap: brassMaps.roughnessMap,
        roughness: 0.28,
        metalness: 0.86,
      })
    );
    const voidObsidianTrimMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x2a1a42,
        emissive: new THREE.Color(0x280d4d),
        emissiveIntensity: 0.52,
        normalMap: brassMaps.normalMap,
        normalScale: new THREE.Vector2(0.55, 0.55),
        roughnessMap: brassMaps.roughnessMap,
        roughness: 0.24,
        metalness: 0.9,
      })
    );

    // Recessed Gothic stained-furnace pane shader with iron frame vignette, crisp mullions, & vibrant HDR plasma core
    const createEmissiveCoreShaderMat = (hex: number) =>
      regMat(
        new THREE.ShaderMaterial({
          toneMapped: false,
          uniforms: {
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(hex) },
            uIntensity: { value: 1.75 },
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
            uniform float uIntensity;
            varying vec2 vUv;
            void main() {
              float edgeX = smoothstep(0.02, 0.20, vUv.x) * smoothstep(0.98, 0.80, vUv.x);
              float edgeY = smoothstep(0.02, 0.11, vUv.y) * smoothstep(0.98, 0.89, vUv.y);
              float mask = edgeX * edgeY;
              float mullion = 1.0 - 0.48 * (exp(-pow((vUv.y - 0.33) * 38.0, 2.0)) + exp(-pow((vUv.y - 0.67) * 38.0, 2.0)));
              float flow = 0.82 + 0.18 * sin(vUv.y * 14.0 - uTime * 2.4 + sin(vUv.x * 6.283));
              float heat = mask * mullion * flow;
              vec3 darkLead = vec3(0.025, 0.025, 0.045);
              vec3 warmCore = mix(uColor, vec3(1.0, 0.97, 0.94), 0.34 * pow(heat, 1.55));
              vec3 col = mix(darkLead, uColor * (0.72 + 1.48 * uIntensity * heat) + warmCore * 0.44 * uIntensity * heat, mask);
              gl_FragColor = vec4(col, 1.0);
            }
          `,
        })
      );

    const f1WindowMat = createEmissiveCoreShaderMat(0xffb02e);
    const f2WindowMat = createEmissiveCoreShaderMat(0x38bdf8);
    const f3WindowMat = createEmissiveCoreShaderMat(0xa855f7);

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
              float alpha = clamp(fresnel * uIntensity, 0.0, 0.88);
              gl_FragColor = vec4(uColor * (1.05 + uIntensity * 0.65), alpha);
            }
          `,
        })
      );

    // Calibrated HDR Emitters for radiant energy rings, crystal shards, & orbital motes
    const f1GlowMat = regMat(
      new THREE.MeshBasicMaterial({
        color: makeHdrColor(0xf2a63b, 1.95),
        toneMapped: false,
      })
    );
    const f2GlowMat = regMat(
      new THREE.MeshBasicMaterial({
        color: makeHdrColor(0x38bdf8, 1.95),
        toneMapped: false,
      })
    );
    const f3GlowMat = regMat(
      new THREE.MeshBasicMaterial({
        color: makeHdrColor(0xa855f7, 2.05),
        toneMapped: false,
      })
    );
    const apexCoreMat = regMat(
      new THREE.MeshBasicMaterial({
        color: makeHdrColor(0xc084fc, 2.45),
        toneMapped: false,
      })
    );
    const pylonGlowMat = regMat(
      new THREE.MeshBasicMaterial({
        color: makeHdrColor(0x6478e6, 1.75),
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

      // Foreground Ruined Stone Viaduct aligned cleanly with Floor 1 Bay #7 Portal Gatehouse
      const viaductGroup = new THREE.Group();
      viaductGroup.position.set(0, -3.52, 0);
      viaductGroup.rotation.y = -Math.PI / 8;
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
    // Dual-Layer Volumetric Optical Corona, Wide Anamorphic Streak & Summit Diffraction Star-Burst
    const coronaShaderMat = regMat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
        uniforms: {
          uColor: { value: new THREE.Color(0x6c7ff2) },
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
            float softHalo = exp(-d * 3.1) * (0.13 + uBoost * 0.22) + exp(-d * 7.2) * (0.09 + uBoost * 0.16);
            float streak = exp(-abs(p.y) * 20.0) * exp(-abs(p.x) * 1.75) * (0.18 + uBoost * 0.46);
            float rays = pow(max(0.0, sin(ang * 8.0 + uTime * 0.22)), 3.2) * exp(-d * 2.4) * (0.09 + uBoost * 0.24);
            float edgeFade = (1.0 - smoothstep(0.45, 0.90, d))
              * smoothstep(0.95, 0.54, abs(p.x))
              * smoothstep(0.95, 0.52, abs(p.y));
            float a = clamp((softHalo + streak + rays) * edgeFade, 0.0, 0.90);
            gl_FragColor = vec4(uColor * (1.20 + uBoost * 0.55), a);
          }
        `,
      })
    );
    const coronaPlane = new THREE.Mesh(regGeo(new THREE.PlaneGeometry(18.0, 12.6)), coronaShaderMat);
    coronaPlane.position.set(0, 0.5, -1.4);
    worldRoot.add(coronaPlane);

    const apexFlareMat = regMat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
        uniforms: {
          uColor: { value: new THREE.Color(0xc084fc) },
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
            float core = exp(-d * 8.5) * (0.55 + uBoost * 0.85);
            float hFlare = exp(-abs(p.y) * 34.0) * exp(-abs(p.x) * 1.95) * (0.36 + uBoost * 0.72);
            float vFlare = exp(-abs(p.x) * 38.0) * exp(-abs(p.y) * 2.6) * (0.22 + uBoost * 0.48);
            float diagRot = abs(p.x + p.y) * abs(p.x - p.y);
            float diagRays = exp(-diagRot * 140.0) * exp(-d * 3.5) * (0.14 + uBoost * 0.32);
            float pulse = 0.92 + 0.08 * sin(uTime * 3.2);
            float edgeFade = (1.0 - smoothstep(0.55, 0.92, d))
              * smoothstep(0.95, 0.58, abs(p.x))
              * smoothstep(0.95, 0.58, abs(p.y));
            float lum = (core + hFlare + vFlare + diagRays) * pulse * edgeFade;
            vec3 flareCol = mix(uColor, vec3(1.0, 0.98, 1.0), 0.32 * core);
            gl_FragColor = vec4(flareCol * (1.48 + uBoost * 0.85), clamp(lum, 0.0, 0.95));
          }
        `,
      })
    );
    const apexFlarePlane = new THREE.Mesh(regGeo(new THREE.PlaneGeometry(4.4, 3.8)), apexFlareMat);
    apexFlarePlane.position.set(0, 5.69, 0.4);
    worldRoot.add(apexFlarePlane);

    // =========================================================================
    // 6. GOTHIC SPIRE CITADEL ARCHITECTURE (3 TIERS + ASTROLABE + SUMMIT)
    // =========================================================================
    const citadelRoot = new THREE.Group();
    citadelRoot.position.y = -0.25;
    worldRoot.add(citadelRoot);

    // Stepped Cliff Pedestal, Arcane Ground Dial & Keep Gatehouse Integration
    const pedestalGroup = new THREE.Group();
    pedestalGroup.position.y = -3.35;
    citadelRoot.add(pedestalGroup);

    const daisBase = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(3.05, 3.45, 0.52, 8)), stoneDarkMat);
    pedestalGroup.add(daisBase);

    const daisUpper = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(2.55, 2.88, 0.28, 8)), f1StoneMat);
    daisUpper.position.y = 0.36;
    pedestalGroup.add(daisUpper);

    const magicCircleMat = regMat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
        uniforms: {
          uTime: { value: 0 },
          uHover: { value: 0 },
          uPulse: { value: 0 },
          uIntensity: { value: 1.45 },
          uColor: { value: new THREE.Color(0xffb02e) },
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
          uniform float uPulse;
          uniform float uIntensity;
          uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            vec2 p = (vUv - 0.5) * 2.0;
            float r = length(p);
            if (r > 1.0) discard;
            float ang = atan(p.y, p.x);

            // Triple high-contrast concentric game seal rings outside pedestal stone
            float ringA = smoothstep(0.022, 0.0, abs(r - 0.935));
            float ringB = smoothstep(0.018, 0.0, abs(r - 0.865));
            float ringC = smoothstep(0.018, 0.0, abs(r - 0.665));

            // Rotating arcane ward arcs & rune pulse around perimeter
            float sectorA = smoothstep(0.18, 0.82, sin(ang * 16.0 + uTime * 1.15));
            float sectorB = smoothstep(0.24, 0.86, sin(ang * 8.0 - uTime * 1.65));
            float arcSweep = smoothstep(0.026, 0.0, abs(r - 0.815)) * (0.42 + 0.58 * sectorB);

            // 4 diagonal obelisk conduit nodes locked to corner pylons (45/135/225/315 deg)
            float pylonSector = pow(max(0.0, -cos(ang * 4.0)), 6.0);
            float pylonLock = smoothstep(0.055, 0.0, abs(r - 0.805)) * pylonSector * 0.9;

            // Outward traveling mana pulse wave constrained cleanly to seal annulus
            float wavePos = mix(0.65, 0.96, fract(uTime * 0.34));
            float manaWave = exp(-pow((r - wavePos) / 0.028, 2.0)) * smoothstep(0.60, 0.67, r) * smoothstep(0.99, 0.93, r);

            float lineMask = ringA * (0.72 + 0.28 * sectorA) + ringB * (0.62 + 0.38 * sectorB) + ringC * 0.82 + arcSweep + pylonLock;
            float haloWash = exp(-abs(r - 0.84) * 9.5) * (0.10 + uHover * 0.14 + uPulse * 0.22);

            float outerMask = smoothstep(0.54, 0.63, r) * smoothstep(1.0, 0.96, r);
            float lum = (lineMask * 1.12 + manaWave * (0.38 + uHover * 0.32 + uPulse * 0.62) + haloWash) * outerMask;
            vec3 coreCol = mix(uColor, vec3(1.0, 0.97, 0.90), clamp(lineMask * 0.16, 0.0, 0.22));
            vec3 col = coreCol * (uIntensity + uPulse * 0.35);
            float alpha = clamp(lum * (0.70 + uHover * 0.16 + uPulse * 0.18), 0.0, 0.94);
            gl_FragColor = vec4(col, alpha);
          }
        `,
      })
    );
    const magicCircleMesh = new THREE.Mesh(regGeo(new THREE.PlaneGeometry(9.0, 9.0)), magicCircleMat);
    magicCircleMesh.rotation.x = -Math.PI / 2;
    magicCircleMesh.position.y = 0.52;
    pedestalGroup.add(magicCircleMesh);

    const magicDialMat = regMat(
      new THREE.MeshBasicMaterial({
        map: arcaneDialTex,
        color: 0xffb02e,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    const magicDialMesh = new THREE.Mesh(regGeo(new THREE.PlaneGeometry(8.5, 8.5)), magicDialMat);
    magicDialMesh.rotation.x = -Math.PI / 2;
    magicDialMesh.position.y = 0.538;
    pedestalGroup.add(magicDialMesh);

    const groundRimMat = regMat(
      new THREE.MeshBasicMaterial({
        color: 0xffb02e,
        transparent: true,
        opacity: 0.84,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    const groundOuterRimRing = new THREE.Mesh(
      regGeo(new THREE.TorusGeometry(4.2, 0.024, 8, 96)),
      groundRimMat
    );
    groundOuterRimRing.rotation.x = Math.PI / 2;
    groundOuterRimRing.position.y = 0.552;
    const groundInnerRimRing = new THREE.Mesh(
      regGeo(new THREE.TorusGeometry(2.98, 0.019, 8, 84)),
      groundRimMat
    );
    groundInnerRimRing.rotation.x = Math.PI / 2;
    groundInnerRimRing.position.y = 0.548;
    pedestalGroup.add(groundOuterRimRing, groundInnerRimRing);

    // 4 Floating Perimeter Obelisks strictly outside dais perimeter (r = 3.62)
    const pylonsGroup = new THREE.Group();
    pedestalGroup.add(pylonsGroup);
    const obeliskGeo = regGeo(new THREE.ConeGeometry(0.16, 1.15, 4));
    const obeliskGemGeo = regGeo(new THREE.OctahedronGeometry(0.08, 0));
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const holder = new THREE.Group();
      holder.position.set(Math.cos(ang) * 3.62, 0.98, Math.sin(ang) * 3.62);
      const stoneObelisk = new THREE.Mesh(obeliskGeo, f1StoneMat);
      stoneObelisk.rotation.x = Math.PI;
      const gem = new THREE.Mesh(obeliskGemGeo, pylonGlowMat);
      gem.position.y = 0.76;
      holder.add(stoneObelisk, gem);
      pylonsGroup.add(holder);
    }

    // Summit-Only Skyward Conduit Beam erupting directly from Apex Crystal (visible into upper clouds, 0 tower clipping)
    const conduitBeamMat = regMat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
        uniforms: {
          uColor: { value: new THREE.Color(0xc084fc) },
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
            float fadeY = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.38, 1.0, vUv.y));
            float edge = sin(vUv.x * 3.14159);
            float core = pow(edge, 1.8) * (0.28 + uBoost * 0.48) + pow(edge, 5.0) * (0.34 + uBoost * 0.62);
            gl_FragColor = vec4(uColor * (1.4 + uBoost * 0.7), fadeY * core);
          }
        `,
      })
    );
    const conduitBeam = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.09, 0.34, 4.2, 20, 1, true)),
      conduitBeamMat
    );
    conduitBeam.position.y = 7.98;
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

    // Helper: Build a flush, wall-batter-aligned recessed Gothic lancet bay (tier-themed metal trim, 0 Z-fighting)
    const addFlushGothicWindow = (
      parent: THREE.Group,
      wallRadiusMid: number,
      wallSlope: number,
      paneW: number,
      paneH: number,
      paneMat: THREE.Material,
      trimMat: THREE.Material
    ) => {
      const slopeWrap = new THREE.Group();
      slopeWrap.position.set(0, 0.02, wallRadiusMid);
      slopeWrap.rotation.x = -wallSlope;

      const jambW = 0.05;
      const jambH = paneH + 0.14;
      const jambGeo = regGeo(new THREE.BoxGeometry(jambW, jambH, 0.095));
      const leftJamb = new THREE.Mesh(jambGeo, stoneDarkMat);
      leftJamb.position.set(-(paneW * 0.5 + jambW * 0.5), 0, 0.042);
      const rightJamb = new THREE.Mesh(jambGeo, stoneDarkMat);
      rightJamb.position.set(paneW * 0.5 + jambW * 0.5, 0, 0.042);

      const hoodGeo = regGeo(new THREE.ConeGeometry(paneW * 0.78, 0.18, 4));
      const hood = new THREE.Mesh(hoodGeo, trimMat);
      hood.rotation.y = Math.PI / 4;
      hood.position.set(0, jambH * 0.5 + 0.06, 0.042);

      const sillGeo = regGeo(new THREE.BoxGeometry(paneW + jambW * 2.1, 0.05, 0.11));
      const sill = new THREE.Mesh(sillGeo, trimMat);
      sill.position.set(0, -jambH * 0.5 - 0.01, 0.048);

      const backing = new THREE.Mesh(
        regGeo(new THREE.BoxGeometry(paneW + 0.02, paneH + 0.04, 0.02)),
        stoneDarkMat
      );
      backing.position.set(0, 0, 0.024);

      const glassPane = new THREE.Mesh(regGeo(new THREE.PlaneGeometry(paneW, paneH)), paneMat);
      glassPane.position.set(0, 0, 0.046);

      const mullionVert = new THREE.Mesh(
        regGeo(new THREE.BoxGeometry(0.011, paneH, 0.022)),
        trimMat
      );
      mullionVert.position.set(0, 0, 0.064);

      slopeWrap.add(leftJamb, rightJamb, hood, sill, backing, glassPane, mullionVert);
      parent.add(slopeWrap);
    };

    // --- FLOOR 1: Foundation Keep (Symmetrical 8-Bay Volcanic Basalt + Keep Gatehouse Portal + Parapet Braziers) ---
    const floor1Group = new THREE.Group();
    floor1Group.position.y = -1.85;
    citadelRoot.add(floor1Group);

    const f1Body = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(1.48, 1.92, 2.25, 8)), f1StoneMat);
    floor1Group.add(f1Body);

    const f1Skirt = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(1.92, 2.18, 0.36, 8)),
      stoneDarkMat
    );
    f1Skirt.position.y = -0.98;
    floor1Group.add(f1Skirt);

    const f1FresnelMat = createFresnelMat(0xffb02e, 2.6, 0.42);
    const f1FresnelShell = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(1.52, 1.97, 2.22, 16, 1, true)),
      f1FresnelMat
    );
    floor1Group.add(f1FresnelShell);

    const f1Cornice = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(1.66, 1.54, 0.18, 8)), solarBrassTrimMat);
    f1Cornice.position.y = 1.08;
    floor1Group.add(f1Cornice);

    // 8 Symmetric Corner Buttresses + Wall-Batter-Aligned Recessed Forge Embrasures + Viaduct Gatehouse
    const buttressPierGeo = regGeo(new THREE.BoxGeometry(0.24, 1.98, 0.48));
    const buttressArchGeo = regGeo(new THREE.BoxGeometry(0.18, 0.92, 0.22));
    const spireletGeo = regGeo(new THREE.ConeGeometry(0.125, 0.52, 4));
    const brazierBowlGeo = regGeo(new THREE.CylinderGeometry(0.11, 0.06, 0.12, 6));
    const brazierFlameGeo = regGeo(new THREE.OctahedronGeometry(0.078, 0));
    const f1BrazierGems: THREE.Mesh[] = [];

    const f1FaceMidR = 1.7 * Math.cos(Math.PI / 8); // exact apothem on 8-gon at y=0
    const f1WallSlope = Math.atan2((1.92 - 1.48) * Math.cos(Math.PI / 8), 2.25);

    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI * 2) / 8;
      const bWrap = new THREE.Group();
      bWrap.rotation.y = ang;

      const outerPier = new THREE.Mesh(buttressPierGeo, stoneDarkMat);
      outerPier.position.set(0, -0.18, 1.9);
      const pinnacle = new THREE.Mesh(spireletGeo, f1StoneMat);
      pinnacle.rotation.y = Math.PI / 4;
      pinnacle.position.set(0, 1.07, 1.9);
      const archStrut = new THREE.Mesh(buttressArchGeo, f1StoneMat);
      archStrut.position.set(0, 0.36, 1.66);
      archStrut.rotation.x = -0.44;
      bWrap.add(outerPier, pinnacle, archStrut);

      const wWrap = new THREE.Group();
      wWrap.rotation.y = ang + Math.PI / 8;

      if (i === 7) {
        // Grand Fortress Portal Gatehouse directly receiving the ruined stone viaduct bridge
        const gateTowerGeo = regGeo(new THREE.BoxGeometry(0.26, 1.65, 0.42));
        const leftTower = new THREE.Mesh(gateTowerGeo, stoneDarkMat);
        leftTower.position.set(-0.38, -0.3, 1.95);
        const rightTower = new THREE.Mesh(gateTowerGeo, stoneDarkMat);
        rightTower.position.set(0.38, -0.3, 1.95);

        const archLint = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.04, 0.16, 0.48)), stoneDarkMat);
        archLint.position.set(0, 0.5, 1.98);
        const archTrim = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.1, 0.06, 0.52)), solarBrassTrimMat);
        archTrim.position.set(0, 0.6, 1.98);
        const gateGable = new THREE.Mesh(regGeo(new THREE.ConeGeometry(0.46, 0.38, 4)), f1StoneMat);
        gateGable.rotation.y = Math.PI / 4;
        gateGable.position.set(0, 0.82, 1.96);
        const portalBacking = new THREE.Mesh(
          regGeo(new THREE.BoxGeometry(0.56, 1.18, 0.04)),
          stoneDarkMat
        );
        portalBacking.position.set(0, -0.48, 1.84);
        const portalGlow = new THREE.Mesh(regGeo(new THREE.PlaneGeometry(0.46, 1.02)), f1WindowMat);
        portalGlow.position.set(0, -0.48, 1.88);
        for (const barX of [-0.15, 0, 0.15]) {
          const bar = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.03, 1.04, 0.032)), solarBrassTrimMat);
          bar.position.set(barX, -0.48, 1.92);
          wWrap.add(bar);
        }
        const gateApron = new THREE.Mesh(
          regGeo(new THREE.BoxGeometry(1.16, 0.24, 0.72)),
          f1StoneMat
        );
        gateApron.position.set(0, -1.24, 2.26);

        for (const sx of [-0.38, 0.38]) {
          const sBowl = new THREE.Mesh(brazierBowlGeo, solarBrassTrimMat);
          sBowl.position.set(sx, 0.68, 2.02);
          const sFlame = new THREE.Mesh(brazierFlameGeo, f1GlowMat);
          sFlame.position.set(sx, 0.8, 2.02);
          sFlame.scale.set(0.75, 1.2, 0.75);
          wWrap.add(sBowl, sFlame);
        }
        wWrap.add(leftTower, rightTower, archLint, archTrim, gateGable, portalBacking, portalGlow, gateApron);
      } else {
        addFlushGothicWindow(wWrap, f1FaceMidR, f1WallSlope, 0.172, 0.96, f1WindowMat, solarBrassTrimMat);
      }

      // Anchored Parapet Forge Braziers cleanly on Floor 1 Brass Cornice
      const bowl = new THREE.Mesh(brazierBowlGeo, solarBrassTrimMat);
      bowl.position.set(0, 1.2, 1.56);
      const flame = new THREE.Mesh(brazierFlameGeo, f1GlowMat);
      flame.position.set(0, 1.32, 1.56);
      flame.scale.set(0.84, 1.32, 0.84);
      f1BrazierGems.push(flame);
      wWrap.add(bowl, flame);

      floor1Group.add(bWrap, wWrap);
    }

    // Forged Solar Brass + Luminous Solar Plasma Keep Runic Belt (r = 2.68 -> strictly clear of buttresses & gatehouse)
    const f1OrbitRingGroup = new THREE.Group();
    floor1Group.add(f1OrbitRingGroup);
    const f1BrassBelt = new THREE.Mesh(regGeo(new THREE.TorusGeometry(2.68, 0.012, 8, 56)), solarBrassTrimMat);
    f1BrassBelt.rotation.x = Math.PI / 2;
    f1BrassBelt.position.y = -0.25;
    f1OrbitRingGroup.add(f1BrassBelt);
    const f1ArcGeo = regGeo(new THREE.TorusGeometry(2.68, 0.017, 8, 24, Math.PI * 0.36));
    const f1SatGeo = regGeo(new THREE.OctahedronGeometry(0.11, 0));
    for (let i = 0; i < 4; i++) {
      const arc = new THREE.Mesh(f1ArcGeo, f1GlowMat);
      arc.rotation.x = Math.PI / 2;
      arc.rotation.z = (i * Math.PI * 2) / 4;
      arc.position.y = -0.22;
      f1OrbitRingGroup.add(arc);

      const sat = new THREE.Mesh(f1SatGeo, f1GlowMat);
      const a = (i * Math.PI * 2) / 4 + Math.PI / 4;
      sat.position.set(Math.cos(a) * 2.72, -0.22, Math.sin(a) * 2.72);
      f1OrbitRingGroup.add(sat);
    }

    // --- FLOOR 2: Glacial Bastion (100% Cool Rime Silver & Cyan Crystal Energy, Zero Gold) ---
    const floor2Group = new THREE.Group();
    floor2Group.position.y = 0.36;
    citadelRoot.add(floor2Group);

    const f2Plinth = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(1.42, 1.62, 0.24, 8)), f2StoneMat);
    f2Plinth.position.y = -1.04;
    floor2Group.add(f2Plinth);

    const f2Body = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(1.06, 1.38, 1.95, 8)), f2StoneMat);
    floor2Group.add(f2Body);

    const f2FresnelMat = createFresnelMat(0x38bdf8, 2.5, 0.44);
    const f2FresnelShell = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(1.09, 1.42, 1.94, 16, 1, true)),
      f2FresnelMat
    );
    floor2Group.add(f2FresnelShell);

    const f2Trim = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(1.18, 1.12, 0.12, 8)), frostSilverTrimMat);
    f2Trim.position.y = 0.96;
    floor2Group.add(f2Trim);

    // Mid-waist Swirling Glacial Mist Collar seated strictly on Floor 1->2 gallery ledger
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
            float radialMask = smoothstep(0.48, 0.65, r) * (1.0 - smoothstep(0.76, 1.0, r));
            float swirl = 0.5 + 0.5 * sin(ang * 5.0 - uTime * 0.9 + r * 6.0);
            float swirl2 = 0.5 + 0.5 * cos(ang * 3.0 + uTime * 0.65 - r * 4.0);
            float vapor = radialMask * (0.45 + 0.55 * swirl * swirl2);
            float a = clamp(vapor * (0.3 + uBoost * 0.36), 0.0, 0.78);
            gl_FragColor = vec4(uColor * (1.1 + uBoost * 0.55), a);
          }
        `,
      })
    );
    const midMistMesh = new THREE.Mesh(regGeo(new THREE.PlaneGeometry(5.6, 5.6)), midMistMat);
    midMistMesh.rotation.x = -Math.PI / 2;
    midMistMesh.position.y = -0.88;
    floor2Group.add(midMistMesh);

    const cryoColGeo = regGeo(new THREE.CylinderGeometry(0.085, 0.13, 1.55, 6));
    const cryoTipGeo = regGeo(new THREE.OctahedronGeometry(0.16, 0));
    const cryoSpireGeo = regGeo(new THREE.ConeGeometry(0.095, 0.56, 5));
    const cryoSocketGeo = regGeo(new THREE.CylinderGeometry(0.14, 0.18, 0.24, 6));
    const f2CrystalsGroup = new THREE.Group();
    floor2Group.add(f2CrystalsGroup);

    // Rime-silver filigree track + radiant Frost Cyan plasma belt carrying orbiting crystals (r = 2.26)
    const f2OrbitSteel = new THREE.Mesh(regGeo(new THREE.TorusGeometry(2.26, 0.009, 8, 56)), frostSilverTrimMat);
    f2OrbitSteel.rotation.x = Math.PI / 2;
    f2OrbitSteel.position.y = 0.01;
    f2CrystalsGroup.add(f2OrbitSteel);

    const f2FaceMidR = 1.22 * Math.cos(Math.PI / 8);
    const f2WallSlope = Math.atan2((1.38 - 1.06) * Math.cos(Math.PI / 8), 1.95);

    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI * 2) / 8;

      // Flush Bastion Window aligned to octagonal wall facet in Rime Silver trim
      const lancetWrap = new THREE.Group();
      lancetWrap.rotation.y = ang + Math.PI / 8;
      addFlushGothicWindow(lancetWrap, f2FaceMidR, f2WallSlope, 0.152, 0.92, f2WindowMat, frostSilverTrimMat);

      const iceSocket = new THREE.Mesh(cryoSocketGeo, stoneDarkMat);
      iceSocket.position.set(0, -0.88, 1.48);
      const baseIceSpike = new THREE.Mesh(cryoSpireGeo, cryoFacetMat);
      baseIceSpike.position.set(0, -0.68, 1.58);
      baseIceSpike.rotation.x = 0.48;
      lancetWrap.add(iceSocket, baseIceSpike);
      floor2Group.add(lancetWrap);

      // Corner Stone Column + Glowing Socketed Cryo Crystal Finial
      const colWrap = new THREE.Group();
      colWrap.rotation.y = ang;
      const stonePin = new THREE.Mesh(cryoColGeo, stoneDarkMat);
      stonePin.position.set(0, -0.04, 1.48);
      const crystalHead = new THREE.Mesh(cryoTipGeo, i % 2 === 0 ? f2GlowMat : cryoFacetMat);
      crystalHead.position.set(0, 0.72, 1.48);
      crystalHead.scale.set(0.64, 1.32, 0.64);
      colWrap.add(stonePin, crystalHead);
      floor2Group.add(colWrap);

      // Outer Orbiting Faceted Crystals & Blazing Frost Cyan Arcs (r = 2.26, >= 0.56m clear of masonry)
      const orbitCrystal = new THREE.Mesh(cryoTipGeo, f2GlowMat);
      orbitCrystal.position.set(
        Math.cos(ang) * 2.28,
        i % 2 === 0 ? 0.16 : -0.1,
        Math.sin(ang) * 2.28
      );
      orbitCrystal.scale.set(0.48, 1.24, 0.48);
      f2CrystalsGroup.add(orbitCrystal);

      if (i % 2 === 0) {
        const f2Arc = new THREE.Mesh(
          regGeo(new THREE.TorusGeometry(2.26, 0.018, 8, 22, Math.PI * 0.42)),
          f2GlowMat
        );
        f2Arc.rotation.x = Math.PI / 2;
        f2Arc.rotation.z = ang + 0.06;
        f2Arc.position.y = 0.04;
        f2CrystalsGroup.add(f2Arc);
      }
    }

    // --- FLOOR 3: Void Apex Sanctum (8-Bay Obsidian + Fluted Roof Ribs + Luminous Void Armillaries + Non-Clipping Finial) ---
    const floor3Group = new THREE.Group();
    floor3Group.position.y = 2.42;
    citadelRoot.add(floor3Group);

    const f3Base = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(1.06, 1.24, 0.2, 8)), stoneDarkMat);
    f3Base.position.y = -0.98;
    floor3Group.add(f3Base);

    const f3Body = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.62, 0.98, 1.85, 8)), f3StoneMat);
    floor3Group.add(f3Body);

    const f3SpireRoof = new THREE.Mesh(regGeo(new THREE.ConeGeometry(0.7, 2.25, 8)), f3StoneMat);
    f3SpireRoof.position.y = 2.02;
    floor3Group.add(f3SpireRoof);

    // Tight Silhouette-Matched Void Fresnel Veil sheathing spire roof
    const f3FresnelMat = createFresnelMat(0xa855f7, 2.4, 0.54);
    const f3FresnelShell = new THREE.Mesh(
      regGeo(new THREE.ConeGeometry(0.75, 2.32, 16, 1, true)),
      f3FresnelMat
    );
    f3FresnelShell.position.y = 2.02;
    floor3Group.add(f3FresnelShell);

    const crownGroup = new THREE.Group();
    floor3Group.add(crownGroup);
    const hornGeo = regGeo(new THREE.ConeGeometry(0.09, 0.92, 4));
    const roofRibGeo = regGeo(new THREE.BoxGeometry(0.05, 2.32, 0.07));
    const roofSlope = Math.atan2(0.7, 2.25);

    const f3FaceMidR = 0.8 * Math.cos(Math.PI / 8);
    const f3WallSlope = Math.atan2((0.98 - 0.62) * Math.cos(Math.PI / 8), 1.85);

    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI * 2) / 8;

      // Flush recessed Void Sanctum gothic slit bay on octagonal face
      const faceWrap = new THREE.Group();
      faceWrap.rotation.y = ang + Math.PI / 8;
      addFlushGothicWindow(faceWrap, f3FaceMidR, f3WallSlope, 0.128, 0.92, f3WindowMat, voidObsidianTrimMat);
      floor3Group.add(faceWrap);

      // Corner ridge: tucked gothic cornice horn + fluted spire edge-rib climbing up to finial cradle
      const ridgeWrap = new THREE.Group();
      ridgeWrap.rotation.y = ang;
      const horn = new THREE.Mesh(hornGeo, voidObsidianTrimMat);
      horn.rotation.y = Math.PI / 4;
      horn.position.set(0, 1.08, 0.78);
      horn.rotation.x = -0.14;

      const rib = new THREE.Mesh(roofRibGeo, stoneDarkMat);
      rib.position.set(0, 2.0, 0.34);
      rib.rotation.x = -roofSlope;

      ridgeWrap.add(horn, rib);
      crownGroup.add(ridgeWrap);
    }

    // 4 Floating Obsidian Monolith Fin Blades stationed outside armillary rings (r = 1.84)
    const finGeo = regGeo(new THREE.OctahedronGeometry(0.14, 0));
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const fin = new THREE.Mesh(finGeo, f3StoneMat);
      fin.position.set(Math.cos(ang) * 1.84, 0.38, Math.sin(ang) * 1.84);
      fin.scale.set(0.45, 2.6, 0.22);
      fin.rotation.y = -ang;
      crownGroup.add(fin);
    }

    // Sculpted Luminous Void Armillary Rings + Inner Obsidian-Amethyst Bezel + Gimbal Nodes (Zero Brass Bleed)
    const buildArmillaryRing = (
      radius: number,
      posY: number,
      rotX: number,
      rotY = 0,
      rotZ = 0,
      ringMat: THREE.Material = f3GlowMat
    ) => {
      const grp = new THREE.Group();
      grp.position.y = posY;
      grp.rotation.set(rotX, rotY, rotZ);

      const tubeR = ringMat === apexCoreMat ? 0.019 : 0.022;
      const glowingRing = new THREE.Mesh(regGeo(new THREE.TorusGeometry(radius, tubeR, 10, 64)), ringMat);
      const obsidianBezel = new THREE.Mesh(
        regGeo(new THREE.TorusGeometry(radius - 0.024, 0.008, 8, 64)),
        voidObsidianTrimMat
      );
      grp.add(glowingRing, obsidianBezel);

      const nodeGeo = regGeo(new THREE.OctahedronGeometry(0.056, 0));
      for (let g = 0; g < 3; g++) {
        const ga = (g * Math.PI * 2) / 3;
        const node = new THREE.Mesh(nodeGeo, apexCoreMat);
        node.position.set(Math.cos(ga) * radius, Math.sin(ga) * radius, 0);
        grp.add(node);
      }
      floor3Group.add(grp);
      return grp;
    };

    const astrolabeRingA = buildArmillaryRing(1.38, 0.78, 0.44);
    const astrolabeRingB = buildArmillaryRing(1.22, 1.48, -0.48);
    const astrolabeRingC = buildArmillaryRing(0.98, 2.24, 0.28, Math.PI / 3, 0.32, apexCoreMat);

    const crownOrbGroup = new THREE.Group();
    crownOrbGroup.position.y = 1.15;
    floor3Group.add(crownOrbGroup);
    const voidOrbGeo = regGeo(new THREE.OctahedronGeometry(0.095, 0));
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      const orb = new THREE.Mesh(voidOrbGeo, f3GlowMat);
      orb.position.set(Math.cos(a) * 1.64, 0.16 * Math.sin(i * 2.1), Math.sin(a) * 1.64);
      crownOrbGroup.add(orb);
    }

    // Void Obsidian Finial Crown Cradle + Floating Shattered Apex Relic Crystal + Crystalline Aura Shell
    const apexCradle = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.16, 0.08, 0.24, 8)),
      voidObsidianTrimMat
    );
    apexCradle.position.y = 3.1;
    floor3Group.add(apexCradle);

    const apexBeacon = new THREE.Mesh(regGeo(new THREE.OctahedronGeometry(0.24, 0)), apexCoreMat);
    apexBeacon.position.y = 3.52;
    apexBeacon.scale.set(0.76, 1.55, 0.76);
    floor3Group.add(apexBeacon);

    const apexAuraMat = createFresnelMat(0xc084fc, 2.5, 0.56);
    const apexAuraShell = new THREE.Mesh(regGeo(new THREE.OctahedronGeometry(0.3, 1)), apexAuraMat);
    apexAuraShell.position.y = 3.52;
    apexAuraShell.scale.set(0.84, 1.68, 0.84);
    floor3Group.add(apexAuraShell);

    // =========================================================================
    // 7. BOUNDING-ENVELOPE CASCADE VEILS, FILIGREE BELT & HELIX SURGE PARTICLES
    // =========================================================================
    // Smooth continuous radial envelope strictly OUTSIDE all buttresses, fins, armillaries & apex
    const getEnvelopeRadius = (localY: number): number => {
      if (localY <= -1.2) return 2.76;
      if (localY <= 0.36) {
        const t = (localY - -1.2) / 1.56;
        return 2.76 - t * 0.28; // 2.76 -> 2.48
      }
      if (localY <= 2.42) {
        const t = (localY - 0.36) / 2.06;
        return 2.48 - t * 0.46; // 2.48 -> 2.02
      }
      if (localY <= 5.95) {
        const t = Math.min(1, (localY - 2.42) / (5.95 - 2.42));
        return 2.02 - t * 1.08; // 2.02 -> 0.94
      }
      return 0.94;
    };

    const shockMat = regMat(
      new THREE.MeshBasicMaterial({
        color: 0xf2a63b,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    const shockRing = new THREE.Mesh(regGeo(new THREE.RingGeometry(0.96, 1.14, 48)), shockMat);
    shockRing.rotation.x = -Math.PI / 2;
    citadelRoot.add(shockRing);

    const waveDiskGeo = regGeo(new THREE.RingGeometry(0.84, 1.36, 72, 1));
    const waveCoreTorusGeo = regGeo(new THREE.TorusGeometry(1.0, 0.025, 12, 72));
    const waveEchoTorusGeo = regGeo(new THREE.TorusGeometry(1.0, 0.015, 8, 64));
    const waveSigilBeltGeo = regGeo(new THREE.CylinderGeometry(0.99, 1.05, 0.62, 64, 1, true));
    const waveCollarGeo = regGeo(new THREE.CylinderGeometry(0.99, 1.08, 1.48, 48, 1, true));

    const createWaveDiskMat = (initialHex: number) =>
      regMat(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          toneMapped: false,
          uniforms: {
            uColor: { value: new THREE.Color(initialHex) },
            uOpacity: { value: 0 },
            uHdrScale: { value: 1.45 },
            uTravelDir: { value: 1 },
            uTime: { value: 0 },
          },
          vertexShader: `
            varying vec3 vLocalPos;
            void main() {
              vLocalPos = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform vec3 uColor;
            uniform float uOpacity;
            uniform float uHdrScale;
            uniform float uTravelDir;
            uniform float uTime;
            varying vec3 vLocalPos;
            void main() {
              float t = clamp((length(vLocalPos.xy) - 0.84) / 0.52, 0.0, 1.0);
              float ang = atan(vLocalPos.y, vLocalPos.x);
              float blade = exp(-pow((t - 0.28) / 0.055, 2.0));
              float wing = exp(-max(0.0, t - 0.28) * 4.5) * smoothstep(0.0, 0.14, t) * smoothstep(1.0, 0.84, t);
              float ticks = 0.62 + 0.38 * pow(0.5 + 0.5 * sin(ang * 24.0 + uTime * 3.4 * uTravelDir), 2.0);
              float lum = (blade * 1.24 + wing * 0.72) * ticks;
              vec3 coreCol = mix(uColor, vec3(1.0, 0.98, 0.95), blade * 0.22);
              gl_FragColor = vec4(coreCol * uHdrScale, clamp(lum * uOpacity, 0.0, 0.92));
            }
          `,
        })
      );

    const createWaveCollarMat = (initialHex: number) =>
      regMat(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          toneMapped: false,
          uniforms: {
            uColor: { value: new THREE.Color(initialHex) },
            uOpacity: { value: 0 },
            uTravelDir: { value: 1 },
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
            uniform float uOpacity;
            uniform float uTravelDir;
            uniform float uTime;
            varying vec2 vUv;
            void main() {
              float signedDist = (vUv.y - 0.5) * uTravelDir;
              float sigma = signedDist > 0.0 ? 0.12 : 0.34;
              float band = exp(-pow(signedDist / sigma, 2.0));
              // Strict top/bottom margin fade prevents faint horizontal cylinder cutoff seams
              float verticalEdgeFade = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
              float shimmer = 0.76 + 0.24 * sin(vUv.x * 37.699 + uTime * 2.8 * uTravelDir);
              float a = clamp(band * verticalEdgeFade * shimmer * uOpacity, 0.0, 0.86);
              gl_FragColor = vec4(uColor * 1.32, a);
            }
          `,
        })
      );

    const createCascadeBranch = (initialHex: number) => {
      const diskMat = createWaveDiskMat(initialHex);
      const diskMesh = new THREE.Mesh(waveDiskGeo, diskMat);
      diskMesh.rotation.x = -Math.PI / 2;

      const coreTorusMat = regMat(
        new THREE.MeshBasicMaterial({
          color: initialHex,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        })
      );
      const coreTorusMesh = new THREE.Mesh(waveCoreTorusGeo, coreTorusMat);
      coreTorusMesh.rotation.x = Math.PI / 2;

      const echoTorusMat = regMat(
        new THREE.MeshBasicMaterial({
          color: initialHex,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        })
      );
      const echoTorusMesh = new THREE.Mesh(waveEchoTorusGeo, echoTorusMat);
      echoTorusMesh.rotation.x = Math.PI / 2;

      const sigilBeltMat = regMat(
        new THREE.MeshBasicMaterial({
          map: glyphRibbonTex,
          color: initialHex,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        })
      );
      const sigilBeltMesh = new THREE.Mesh(waveSigilBeltGeo, sigilBeltMat);

      const collarMat = createWaveCollarMat(initialHex);
      const collarMesh = new THREE.Mesh(waveCollarGeo, collarMat);

      citadelRoot.add(diskMesh, coreTorusMesh, echoTorusMesh, sigilBeltMesh, collarMesh);
      return {
        diskMat,
        diskMesh,
        coreTorusMat,
        coreTorusMesh,
        echoTorusMat,
        echoTorusMesh,
        sigilBeltMat,
        sigilBeltMesh,
        collarMat,
        collarMesh,
      };
    };

    const primaryWave = createCascadeBranch(0xffb02e);
    const secondaryWave = createCascadeBranch(0x38bdf8);

    const waveOriginMat = regMat(
      new THREE.MeshBasicMaterial({
        color: 0xffb02e,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    const waveOriginRing = new THREE.Mesh(
      regGeo(new THREE.TorusGeometry(1.0, 0.028, 10, 64)),
      waveOriginMat
    );
    waveOriginRing.rotation.x = Math.PI / 2;
    citadelRoot.add(waveOriginRing);

    const tmpCoreCol = new THREE.Color();
    const tmpWhite = new THREE.Color(0xffffff);
    const hideWaveBranch = (branch: ReturnType<typeof createCascadeBranch>) => {
      branch.diskMat.uniforms.uOpacity.value = 0;
      branch.coreTorusMat.opacity = 0;
      branch.echoTorusMat.opacity = 0;
      branch.sigilBeltMat.opacity = 0;
      branch.collarMat.uniforms.uOpacity.value = 0;
    };
    const updateWaveBranch = (
      branch: ReturnType<typeof createCascadeBranch>,
      yPos: number,
      dirSign: number,
      baseCol: THREE.Color,
      ringScaleHdr: number,
      alpha: number,
      satScale: number,
      timeSec: number
    ) => {
      const envR = getEnvelopeRadius(yPos);

      branch.diskMesh.position.y = yPos;
      branch.diskMesh.scale.setScalar(envR + 0.14);
      branch.diskMat.uniforms.uColor.value.copy(baseCol);
      branch.diskMat.uniforms.uHdrScale.value = 1.22 * satScale;
      branch.diskMat.uniforms.uOpacity.value = alpha;
      branch.diskMat.uniforms.uTravelDir.value = dirSign;
      branch.diskMat.uniforms.uTime.value = timeSec;

      tmpCoreCol.copy(baseCol).lerp(tmpWhite, 0.14);
      branch.coreTorusMat.color.copy(tmpCoreCol).multiplyScalar(ringScaleHdr * 0.82);
      branch.coreTorusMat.opacity = Math.min(0.95, alpha * 0.98);
      branch.coreTorusMesh.position.y = yPos;
      branch.coreTorusMesh.scale.setScalar(envR + 0.17);

      const echoY = Math.max(-2.55, Math.min(5.75, yPos - dirSign * 0.46));
      branch.echoTorusMat.color.copy(baseCol).multiplyScalar(ringScaleHdr * 0.72);
      branch.echoTorusMat.opacity = alpha * 0.62;
      branch.echoTorusMesh.position.y = echoY;
      branch.echoTorusMesh.scale.setScalar(getEnvelopeRadius(echoY) + 0.26);

      const beltScaleXZ = envR + 0.1;
      branch.sigilBeltMesh.position.y = yPos;
      branch.sigilBeltMesh.scale.set(beltScaleXZ, 1, beltScaleXZ);
      branch.sigilBeltMesh.rotation.y = timeSec * 0.56 * dirSign;
      branch.sigilBeltMat.color.copy(baseCol).multiplyScalar(1.36 * satScale);
      branch.sigilBeltMat.opacity = Math.min(0.94, alpha * 0.98);

      const collarScaleXZ = envR + 0.18;
      branch.collarMesh.position.y = yPos;
      branch.collarMesh.scale.set(collarScaleXZ, 1, collarScaleXZ);
      branch.collarMat.uniforms.uColor.value.copy(baseCol).multiplyScalar(ringScaleHdr * 0.42);
      branch.collarMat.uniforms.uOpacity.value = alpha * 0.34;
      branch.collarMat.uniforms.uTravelDir.value = dirSign;
      branch.collarMat.uniforms.uTime.value = timeSec;
    };

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
      radMin: 2.35,
      radMax: isShowcase ? 8.4 : 3.6,
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
      radMin: 2.05,
      radMax: isShowcase ? 7.2 : 3.2,
      omegaBase: 0.56,
      riseMin: -0.004,
      riseMax: 0.004,
      texture: iceGlintTex,
      size: isShowcase ? 0.25 : 0.17,
      initialHex: 0x38bdf8,
    });
    const f3Particles = createTierParticleSystem({
      count: isShowcase ? 76 : 32,
      yMin: 1.5,
      yMax: 5.9,
      radMin: 1.65,
      radMax: isShowcase ? 7.4 : 3.0,
      omegaBase: 0.28,
      riseMin: 0.005,
      riseMax: 0.015,
      texture: bokehSparkTex,
      size: isShowcase ? 0.22 : 0.15,
      initialHex: 0xa855f7,
    });

    // Dedicated Directional Cascade Helix Surge Spores carried along active hover wavefront
    const SURGE_COUNT = isShowcase ? 84 : 36;
    const surgePos = new Float32Array(SURGE_COUNT * 3);
    const surgeAngles = new Float32Array(SURGE_COUNT);
    const surgeOffsets = new Float32Array(SURGE_COUNT);
    const surgeRadPads = new Float32Array(SURGE_COUNT);
    const surgeOmegas = new Float32Array(SURGE_COUNT);
    for (let i = 0; i < SURGE_COUNT; i++) {
      surgeAngles[i] = (i / SURGE_COUNT) * Math.PI * 2 * 3;
      surgeOffsets[i] = ((i / SURGE_COUNT) - 0.5) * 1.95;
      surgeRadPads[i] = 0.06 + (i % 5) * 0.09;
      surgeOmegas[i] = (1.1 + (i % 7) * 0.18) * (i % 2 === 0 ? 1 : -1);
    }
    const surgeGeo = regGeo(new THREE.BufferGeometry());
    surgeGeo.setAttribute("position", new THREE.BufferAttribute(surgePos, 3));
    const surgeMat = regMat(
      new THREE.PointsMaterial({
        color: 0xffb02e,
        map: bokehSparkTex,
        size: isShowcase ? 0.29 : 0.19,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      })
    );
    const cascadeSparks = new THREE.Points(surgeGeo, surgeMat);
    citadelRoot.add(cascadeSparks);

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
    const handlePointerCancel = () => {
      isDragging = false;
    };
    const handlePointerLeave = () => {
      isDragging = false;
      setIsTowerHovered(false);
      setHoveredFloor(null);
    };

    renderer.domElement.addEventListener("pointerenter", handlePointerEnter);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
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
    const COL_TWILIGHT_IDLE = new THREE.Color(0x5b6fe6);

    const TRIM_SOLAR_BASE = new THREE.Color(0xd2973b);
    const TRIM_FROST_BASE = new THREE.Color(0x8bc6ee);
    const TRIM_VOID_BASE = new THREE.Color(0x2a1a42);

    const curF1Col = COL_SOLAR.clone();
    const curF2Col = COL_FROST.clone();
    const curF3Col = COL_VOID.clone();
    const curApexCol = COL_APEX_IDLE.clone();
    const tmpTargetCol = new THREE.Color();
    const tmpTrimCol = new THREE.Color();
    const cascadeCol = new THREE.Color(0xffb02e);
    const envTargetCol = COL_TWILIGHT_IDLE.clone();
    const envCurrentCol = COL_TWILIGHT_IDLE.clone();

    const smoothstep01 = (v: number) => {
      const t = Math.max(0, Math.min(1, v));
      return t * t * (3 - 2 * t);
    };

    let lastCascadeOrigin: number | null = null;
    let waveClock = 0;
    let time = 0;
    let hoverScalar = 0;
    let coronaY = 0.5;
    let rafId = 0;
    let prevPerf = performance.now();

    const coronaCenterVec = new THREE.Vector3();
    const dirCamToCorona = new THREE.Vector3();
    const dirToTower = new THREE.Vector3();

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, Math.max(0.004, (now - prevPerf) / 1000));
      prevPerf = now;
      const dtFactor = dt / 0.016;

      const paused = pausedRef.current;
      // Freeze ambient animation when Paused or OS prefers-reduced-motion unless Resume FX overrides.
      const motionScale = paused || reducedMotionRef.current ? 0 : 1;
      const selFloor = selectedFloorRef.current;
      const hovFloor = hoveredFloorRef.current;
      const towerHot = hovFloor !== null;

      const targetHover = towerHot ? 1 : 0;
      const prevHoverScalar = hoverScalar;
      hoverScalar += (targetHover - hoverScalar) * (1 - Math.exp(-6.0 * dt));

      if (motionScale > 0) {
        time += dt * motionScale;
      }
      if (!isDragging) {
        const autoDrift =
          motionScale > 0 ? (0.0045 + hoverScalar * 0.0042) * motionScale * dtFactor : 0;
        thetaRef.current += autoDrift + velThetaRef.current;
        velThetaRef.current *= Math.pow(0.92, dtFactor);
        if (Math.abs(velThetaRef.current) < 0.00025) {
          velThetaRef.current = 0;
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

      // Slow luxurious ~2.15s harmonic cascade across Floor 1 / 2 / 3 (delta-time normalized)
      if (hovFloor !== null) {
        if (hovFloor !== lastCascadeOrigin) {
          lastCascadeOrigin = hovFloor;
          waveClock = 0;
        }
        waveClock = Math.min(1.22, waveClock + dt * 0.46);
        cascadeCol.copy(hovFloor === 1 ? COL_SOLAR : hovFloor === 2 ? COL_FROST : COL_VOID);
      } else {
        lastCascadeOrigin = null;
        waveClock = Math.max(0, waveClock - dt * 1.35);
      }

      const d1 = hovFloor === null ? 0 : Math.abs(1 - hovFloor);
      const d2 = hovFloor === null ? 0 : Math.abs(2 - hovFloor);
      const d3 = hovFloor === null ? 0 : Math.abs(3 - hovFloor);

      const stepDelay = (dist: number) => (dist === 0 ? 0.0 : dist === 1 ? 0.28 : 0.56);
      const tierProg = (dist: number) =>
        hovFloor === null
          ? 0
          : dist === 0
            ? smoothstep01(waveClock / 0.18)
            : smoothstep01((waveClock - stepDelay(dist)) / 0.34);
      const prog1 = tierProg(d1);
      const prog2 = tierProg(d2);
      const prog3 = tierProg(d3);

      const crest1 = hovFloor !== null ? Math.sin(prog1 * Math.PI) : 0;
      const crest2 = hovFloor !== null ? Math.sin(prog2 * Math.PI) : 0;
      const crest3 = hovFloor !== null ? Math.sin(prog3 * Math.PI) : 0;

      // Progressive Chromatic Wave Infection:
      // Idle stays Tri-Color (F1 Gold / F2 Blue / F3 Purple). When hovered, each floor caught by the wavefront
      // smoothly morphs into the hovered floor's element (and relaxes back to Tri-Color when hover ends).
      const hoveredSatFactor = hovFloor === 2 ? 0.76 : hovFloor === 1 ? 0.85 : 0.96;
      const satScale = 1.0 - hoverScalar * (1.0 - hoveredSatFactor);

      if (hovFloor !== null) {
        const originLerp = 1 - Math.exp(-9.0 * dt);
        const sweepLerp = 1 - Math.exp(-6.2 * dt);

        tmpTargetCol.copy(COL_SOLAR).lerp(cascadeCol, prog1);
        curF1Col.lerp(tmpTargetCol, d1 === 0 ? originLerp : sweepLerp);

        tmpTargetCol.copy(COL_FROST).lerp(cascadeCol, prog2);
        curF2Col.lerp(tmpTargetCol, d2 === 0 ? originLerp : sweepLerp);

        tmpTargetCol.copy(COL_VOID).lerp(cascadeCol, prog3);
        curF3Col.lerp(tmpTargetCol, d3 === 0 ? originLerp : sweepLerp);

        tmpTargetCol.copy(COL_APEX_IDLE).lerp(cascadeCol, prog3);
        curApexCol.lerp(tmpTargetCol, sweepLerp);

        tmpTrimCol.setHex(hovFloor === 2 ? 0x5b8cb8 : hovFloor === 3 ? 0x472f70 : 0xd2973b);
        tmpTargetCol.copy(TRIM_SOLAR_BASE).lerp(tmpTrimCol, prog1 * 0.85);
        solarBrassTrimMat.color.lerp(tmpTargetCol, sweepLerp);

        tmpTrimCol.setHex(hovFloor === 1 ? 0xc69646 : hovFloor === 3 ? 0x7664a8 : 0x8bc6ee);
        tmpTargetCol.copy(TRIM_FROST_BASE).lerp(tmpTrimCol, prog2 * 0.78);
        frostSilverTrimMat.color.lerp(tmpTargetCol, sweepLerp);

        tmpTrimCol.setHex(hovFloor === 1 ? 0x4b3819 : hovFloor === 2 ? 0x1b3a58 : 0x2a1a42);
        tmpTargetCol.copy(TRIM_VOID_BASE).lerp(tmpTrimCol, prog3 * 0.82);
        voidObsidianTrimMat.color.lerp(tmpTargetCol, sweepLerp);
      } else {
        const idleLerp = 1 - Math.exp(-4.2 * dt);
        curF1Col.lerp(COL_SOLAR, idleLerp);
        curF2Col.lerp(COL_FROST, idleLerp);
        curF3Col.lerp(COL_VOID, idleLerp);
        curApexCol.lerp(COL_APEX_IDLE, idleLerp);
        solarBrassTrimMat.color.lerp(TRIM_SOLAR_BASE, idleLerp);
        frostSilverTrimMat.color.lerp(TRIM_FROST_BASE, idleLerp);
        voidObsidianTrimMat.color.lerp(TRIM_VOID_BASE, idleLerp);
      }
      solarBrassTrimMat.emissive.copy(curF1Col).multiplyScalar(0.16);
      solarBrassTrimMat.emissiveIntensity = prog1 * (hovFloor !== null && hovFloor !== 1 ? 0.42 * satScale : 0);
      frostSilverTrimMat.emissive.copy(curF2Col).multiplyScalar(0.24);
      frostSilverTrimMat.emissiveIntensity = 0.45 * satScale;
      voidObsidianTrimMat.emissive.copy(curF3Col).multiplyScalar(0.32);
      voidObsidianTrimMat.emissiveIntensity = 0.52 * satScale;

      // Synchronize full-height World-Y Masonry Cascade Shader (-2.80 .. +5.50 across all 3 tiers + apex)
      const waveNorm = smoothstep01(waveClock / 0.96);
      if (hovFloor !== null) {
        waveShaderState.uWaveOriginY.value =
          hovFloor === 1 ? -2.8 : hovFloor === 2 ? 0.11 : 5.5;
        waveShaderState.uWaveDir.value = hovFloor === 1 ? 1 : hovFloor === 2 ? 0 : -1;
        waveShaderState.uWaveRadius.value =
          waveNorm * (hovFloor === 2 ? 5.6 : hovFloor === 1 ? 8.5 : 8.4);
      }
      waveShaderState.uWaveMix.value =
        hovFloor !== null
          ? Math.min(1, hoverScalar * 1.2)
          : smoothstep01(waveClock / 0.35) * 0.65;
      waveShaderState.uWaveColor.value.copy(cascadeCol);
      waveShaderState.uWaveCrestIntensity.value = (1.35 + hoverScalar * 0.55) * satScale;

      // Multi-layered 3D Spell-Wave Cascade Rings (Primary + Symmetric Secondary Branch + Origin Ignite)
      const waveActive = hovFloor !== null && waveClock < 1.18;
      const ringAlpha = waveActive
        ? Math.min(1, waveClock / 0.14) * (1 - smoothstep01((waveNorm - 0.8) / 0.2)) * 0.88
        : 0;
      const ringScaleHdr = (hovFloor === 2 ? 1.54 : hovFloor === 1 ? 1.58 : 1.76) * satScale;
      if (ringAlpha > 0.01 && hovFloor !== null) {
        const primaryY =
          hovFloor === 1
            ? -2.55 + waveNorm * 8.3
            : hovFloor === 2
              ? 0.36 + waveNorm * 5.39
              : 5.75 - waveNorm * 8.3;
        const secondaryY = 0.36 - waveNorm * 2.91;
        const dirSign = hovFloor === 3 ? -1 : 1;

        glyphRibbonTex.offset.x = (time * 0.26 * dirSign) % 1;
        updateWaveBranch(primaryWave, primaryY, dirSign, cascadeCol, ringScaleHdr, ringAlpha, satScale, time);

        if (hovFloor === 2) {
          updateWaveBranch(
            secondaryWave,
            secondaryY,
            -1,
            cascadeCol,
            ringScaleHdr,
            ringAlpha,
            satScale,
            time
          );
        } else {
          hideWaveBranch(secondaryWave);
        }

        const originT = Math.min(1, waveClock / 0.32);
        if (originT < 1) {
          const originY = hovFloor === 1 ? -1.95 : hovFloor === 2 ? 0.36 : 4.85;
          waveOriginRing.position.y = originY;
          waveOriginRing.scale.setScalar(getEnvelopeRadius(originY) * (1.08 + originT * 0.56));
          waveOriginMat.color.copy(cascadeCol).multiplyScalar(ringScaleHdr * 0.92);
          waveOriginMat.opacity = (1 - originT) * 0.68;
        } else {
          waveOriginMat.opacity = 0;
        }

        const surgePosAttr = surgeGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < SURGE_COUNT; i++) {
          const useSecondary = hovFloor === 2 && i % 2 === 1;
          const baseY = useSecondary ? secondaryY : primaryY;
          const localDir = useSecondary ? -1 : dirSign;
          const py = baseY + surgeOffsets[i] * -localDir * 0.72;
          const envR = getEnvelopeRadius(py) + surgeRadPads[i];
          const ang = surgeAngles[i] + time * surgeOmegas[i];
          surgePosAttr.setXYZ(i, Math.cos(ang) * envR, py, Math.sin(ang) * envR);
        }
        surgePosAttr.needsUpdate = true;
        surgeMat.color.copy(cascadeCol).multiplyScalar(1.68 * satScale);
        surgeMat.opacity = Math.min(0.96, ringAlpha * 1.12);
      } else {
        hideWaveBranch(primaryWave);
        hideWaveBranch(secondaryWave);
        waveOriginMat.opacity = 0;
        surgeMat.opacity = 0;
      }

      // Idle keeps Cosmic Twilight Obsidian-Indigo backdrop (no gold bleed); Hover switches environment to hovered floor
      const activeFocus = hovFloor ?? selFloor;
      const focusHex =
        hovFloor !== null
          ? hovFloor === 1
            ? 0xffb02e
            : hovFloor === 2
              ? 0x38bdf8
              : 0xa855f7
          : 0x5b6fe6;
      envTargetCol.setHex(focusHex);
      envCurrentCol.lerp(envTargetCol, 0.08);
      const focusY = FLOOR_CAM_TARGET_Y[activeFocus] ?? 0.5;

      // Close volumetric corona halo behind tower along camera view ray
      coronaY += (focusY - coronaY) * 0.09;
      coronaCenterVec.set(0, coronaY, 0);
      dirCamToCorona.copy(coronaCenterVec).sub(camera.position).normalize();
      coronaPlane.position.copy(coronaCenterVec).addScaledVector(dirCamToCorona, 1.55);
      coronaPlane.lookAt(camera.position);
      coronaShaderMat.uniforms.uTime.value = time;
      coronaShaderMat.uniforms.uColor.value.copy(envCurrentCol);
      coronaShaderMat.uniforms.uBoost.value =
        (hoverScalar * 0.82 + Math.max(crest1, crest2, crest3) * 0.48) * satScale;

      // Summit Diffraction Star-Burst anchored cleanly in front of Apex Relic Crystal facing camera
      const apexWorldY = citadelRoot.position.y + floor3Group.position.y + apexBeacon.position.y;
      coronaCenterVec.set(0, apexWorldY, 0);
      dirCamToCorona.copy(coronaCenterVec).sub(camera.position).normalize();
      apexFlarePlane.position.copy(coronaCenterVec).addScaledVector(dirCamToCorona, -0.42);
      apexFlarePlane.lookAt(camera.position);
      apexFlareMat.uniforms.uTime.value = time;
      apexFlareMat.uniforms.uColor.value.copy(curApexCol);
      apexFlareMat.uniforms.uBoost.value =
        0.18 + (hoverScalar * 0.8 + crest3 * 0.65) * satScale + (shockwaveRef.current.active ? 0.38 : 0);

      // Synchronize Sky Dome scattering & mountain bounce illumination
      dirToTower.set(0, 0.35 + focusY * 0.04, 0).sub(camera.position).normalize();
      skyDomeMat.uniforms.uTime.value = time;
      skyDomeMat.uniforms.uBeaconColor.value.copy(envCurrentCol);
      skyDomeMat.uniforms.uBeaconDir.value.copy(dirToTower);
      skyDomeMat.uniforms.uBloomBoost.value = hoverScalar * (0.85 + 0.15 * satScale);

      // Synchronized tier & valley lights follow progressive wave infection (curF1Col / curF2Col / curF3Col)
      valleyWashLight.color.copy(envCurrentCol);
      valleyWashLight.intensity = 6.2 + hoverScalar * 9.2 * satScale;

      keepCoreLight.color.copy(curF1Col);
      keepCoreLight.intensity = (9.2 + crest1 * 4.8 + (hovFloor !== null ? prog1 * 3.6 : 0)) * satScale;
      const keepFillIntensity = (4.6 + crest1 * 2.4 + (hovFloor !== null ? prog1 * 1.6 : 0)) * satScale;
      keepFillFront.color.copy(curF1Col);
      keepFillFront.intensity = keepFillIntensity;
      keepFillRear.color.copy(curF1Col);
      keepFillRear.intensity = keepFillIntensity;

      bastionCoreLight.color.copy(curF2Col);
      bastionCoreLight.intensity = (8.8 + crest2 * 5.0 + (hovFloor !== null ? prog2 * 3.8 : 0)) * satScale;
      apexAuraLight.color.copy(curF3Col);
      apexAuraLight.intensity = (9.2 + crest3 * 5.4 + (hovFloor !== null ? prog3 * 4.2 : 0)) * satScale;

      mistShaderMat.uniforms.uTime.value = time;
      mistShaderMat.uniforms.uColor.value.copy(envCurrentCol);
      mistShaderMat.uniforms.uBoost.value = hoverScalar * satScale;

      midMistMat.uniforms.uTime.value = time;
      midMistMat.uniforms.uColor.value.copy(curF2Col);
      midMistMat.uniforms.uBoost.value = (hoverScalar + crest2 * 0.45) * satScale;

      const groundHitClock = hovFloor === 1 ? 0.12 : hovFloor === 2 ? 0.72 : 0.82;
      const groundImpact =
        hovFloor !== null
          ? Math.exp(-Math.pow((waveClock - groundHitClock) / 0.14, 2.0)) * (hovFloor === 1 ? 0.36 : 0.78)
          : 0;

      magicCircleMat.uniforms.uTime.value = time;
      magicCircleMat.uniforms.uHover.value = hoverScalar;
      magicCircleMat.uniforms.uPulse.value = groundImpact;
      magicCircleMat.uniforms.uIntensity.value = (1.28 + hoverScalar * 0.28 + groundImpact * 0.34) * satScale;
      magicCircleMat.uniforms.uColor.value.copy(curF1Col);
      const groundSealScale = 1 + hoverScalar * 0.04 + groundImpact * 0.05;
      magicCircleMesh.scale.setScalar(groundSealScale);

      magicDialMat.color.copy(curF1Col).multiplyScalar((1.16 + hoverScalar * 0.26 + groundImpact * 0.24) * satScale);
      magicDialMat.opacity = Math.min(0.92, 0.74 + hoverScalar * 0.12 + groundImpact * 0.10);
      magicDialMesh.scale.setScalar(groundSealScale);

      groundRimMat.color.copy(curF1Col).multiplyScalar((1.34 + hoverScalar * 0.26 + groundImpact * 0.28) * satScale);
      groundRimMat.opacity = Math.min(0.94, 0.80 + hoverScalar * 0.10);
      groundOuterRimRing.scale.setScalar(groundSealScale);
      groundInnerRimRing.scale.setScalar(1 + hoverScalar * 0.025 + groundImpact * 0.03);

      conduitBeamMat.uniforms.uColor.value.copy(curApexCol);
      conduitBeamMat.uniforms.uBoost.value =
        0.18 + (hoverScalar * 0.8 + crest3 * 0.5) * satScale + (shockwaveRef.current.active ? 0.45 : 0);

      // Floor Unlock state + Calibrated Cinema HDR Glazing & Filigree Multipliers (Infected Tiers Shift Together)
      const fs = floorsRef.current;
      const f2State = fs?.find((f) => f.floor === 2);
      const f3State = fs?.find((f) => f.floor === 3);

      const pulse = motionScale > 0 ? Math.sin(time * 2.5) * 0.12 : 0;
      const f1HoverGain = hovFloor !== null ? (hovFloor === 1 ? 0.85 : prog1 * 0.62) + crest1 * 0.65 : 0;
      const f2HoverGain = hovFloor !== null ? (hovFloor === 2 ? 0.88 : prog2 * 0.64) + crest2 * 0.68 : 0;
      const f3HoverGain = hovFloor !== null ? (hovFloor === 3 ? 0.96 : prog3 * 0.68) + crest3 * 0.72 : 0;

      const f1Mult = ((hovFloor !== null ? 2.28 : 1.98) + f1HoverGain * 0.58) * satScale + pulse;
      const f2Locked = Boolean(f2State && !f2State.unlocked);
      const f2Mult = f2Locked
        ? 0.44
        : ((hovFloor !== null ? 2.32 : 2.02) + f2HoverGain * 0.6) * satScale + pulse;
      const f3Locked = Boolean(f3State && !f3State.unlocked);
      const f3Mult = f3Locked
        ? 0.44
        : ((hovFloor !== null ? 2.44 : 2.12) + f3HoverGain * 0.64) * satScale + pulse;

      f1GlowMat.color.copy(curF1Col).multiplyScalar(f1Mult);
      f2GlowMat.color.copy(curF2Col).multiplyScalar(f2Mult);
      f3GlowMat.color.copy(curF3Col).multiplyScalar(f3Mult);
      apexCoreMat.color.copy(curApexCol).multiplyScalar((2.35 + f3HoverGain * 0.45) * satScale + pulse);
      pylonGlowMat.color.copy(envCurrentCol).multiplyScalar(1.92 + hoverScalar * 0.78 * satScale);

      // Update leaded Gothic stained-glass stained cores using curF1Col / curF2Col / curF3Col
      f1WindowMat.uniforms.uTime.value = time;
      f1WindowMat.uniforms.uColor.value.copy(curF1Col);
      f1WindowMat.uniforms.uIntensity.value =
        (1.62 + (hovFloor !== null ? (hovFloor === 1 ? 0.56 : prog1 * 0.36) + crest1 * 0.42 : 0)) * satScale + pulse * 0.32;

      f2WindowMat.uniforms.uTime.value = time;
      f2WindowMat.uniforms.uColor.value.copy(curF2Col);
      f2WindowMat.uniforms.uIntensity.value = f2Locked
        ? 0.38
        : (1.64 + (hovFloor !== null ? (hovFloor === 2 ? 0.56 : prog2 * 0.36) + crest2 * 0.42 : 0)) * satScale + pulse * 0.32;

      f3WindowMat.uniforms.uTime.value = time;
      f3WindowMat.uniforms.uColor.value.copy(curF3Col);
      f3WindowMat.uniforms.uIntensity.value = f3Locked
        ? 0.38
        : (1.72 + (hovFloor !== null ? (hovFloor === 3 ? 0.62 : prog3 * 0.4) + crest3 * 0.46 : 0)) * satScale + pulse * 0.32;

      // Synchronized procedural masonry vein emissives & infected crystals/Fresnel shells
      f1StoneMat.emissive.copy(curF1Col);
      f1StoneMat.emissiveIntensity =
        (0.72 + crest1 * 0.44 + (hovFloor === 1 ? 0.24 : prog1 * 0.16)) * satScale;
      f2StoneMat.emissive.copy(curF2Col);
      f2StoneMat.emissiveIntensity = f2Locked
        ? 0.16
        : (0.74 + crest2 * 0.44 + (hovFloor === 2 ? 0.24 : prog2 * 0.16)) * satScale;
      f3StoneMat.emissive.copy(curF3Col);
      f3StoneMat.emissiveIntensity = f3Locked
        ? 0.18
        : (0.78 + crest3 * 0.48 + (hovFloor === 3 ? 0.28 : prog3 * 0.18)) * satScale;

      cryoFacetMat.emissive.copy(curF2Col).multiplyScalar(0.55);
      cryoFacetMat.emissiveIntensity = f2Locked
        ? 0.22
        : (0.78 + (hovFloor === 2 ? 0.42 : prog2 * 0.28) + crest2 * 0.42) * satScale;

      f1FresnelMat.uniforms.uColor.value
        .copy(curF1Col)
        .lerp(cascadeCol, hovFloor !== null ? crest1 * 0.55 : 0);
      f1FresnelMat.uniforms.uIntensity.value =
        (0.56 + crest1 * 0.5 + (hovFloor === 1 ? 0.32 : prog1 * 0.2)) * satScale;
      f2FresnelMat.uniforms.uColor.value
        .copy(curF2Col)
        .lerp(cascadeCol, hovFloor !== null ? crest2 * 0.55 : 0);
      f2FresnelMat.uniforms.uIntensity.value = f2Locked
        ? 0.14
        : (0.58 + crest2 * 0.52 + (hovFloor === 2 ? 0.32 : prog2 * 0.2)) * satScale;
      f3FresnelMat.uniforms.uColor.value
        .copy(curF3Col)
        .lerp(cascadeCol, hovFloor !== null ? crest3 * 0.55 : 0);
      f3FresnelMat.uniforms.uIntensity.value = f3Locked
        ? 0.14
        : (0.64 + crest3 * 0.56 + (hovFloor === 3 ? 0.36 : prog3 * 0.22)) * satScale;
      apexAuraMat.uniforms.uColor.value
        .copy(curApexCol)
        .lerp(cascadeCol, hovFloor !== null ? crest3 * 0.5 : 0);
      apexAuraMat.uniforms.uIntensity.value = f3Locked
        ? 0.24
        : (0.88 + crest3 * 0.52 + (hovFloor === 3 ? 0.36 : prog3 * 0.22)) * satScale + pulse * 0.4;

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
        apexBeacon.position.y = 3.52 + Math.sin(time * 2.2) * 0.08 + hoverScalar * 0.08;
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
        shockBoost = (1 - p) * 0.45;
        if (p >= 1) {
          shockwaveRef.current.active = false;
          shockMat.opacity = 0;
        } else {
          const shockY = FLOOR_CAM_TARGET_Y[shockwaveRef.current.floor] ?? 0;
          shockRing.position.y = shockY;
          shockRing.scale.setScalar(getEnvelopeRadius(shockY) * (1.06 + p * 0.72));
          shockMat.color.setHex(FLOOR_COLORS[shockwaveRef.current.floor] ?? focusHex);
          shockMat.opacity = (1 - p) * 0.85;
        }
      }

      const waveCrestPeak = Math.max(crest1, crest2, crest3);
      if (bloomPass) {
        bloomPass.strength = 0.68 + hoverScalar * 0.2 * satScale + waveCrestPeak * 0.14 * satScale + shockBoost;
        bloomPass.radius = 0.76 + hoverScalar * 0.14;
      }

      f1Particles.mat.color.copy(curF1Col);
      f1Particles.mat.opacity = 0.78 + crest1 * 0.2 + hoverScalar * 0.14;
      f2Particles.mat.color.copy(curF2Col);
      f2Particles.mat.opacity = f2Locked ? 0.24 : 0.78 + crest2 * 0.2 + hoverScalar * 0.14;
      f3Particles.mat.color.copy(curF3Col);
      f3Particles.mat.opacity = f3Locked ? 0.24 : 0.82 + crest3 * 0.22 + hoverScalar * 0.16;

      const hoverStillEasing = Math.abs(hoverScalar - prevHoverScalar) > 0.001;
      const camStillEasing = Math.abs(currentDistRef.current - prevDist) > 0.001;
      const colorDiff = (a: THREE.Color, b: THREE.Color) =>
        Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
      const cascadeSettling =
        (hovFloor !== null && waveClock < 1.2) ||
        (hovFloor === null && waveClock > 0.01) ||
        colorDiff(curF1Col, COL_SOLAR) > 0.01 ||
        colorDiff(curF2Col, COL_FROST) > 0.01 ||
        colorDiff(curF3Col, COL_VOID) > 0.01 ||
        colorDiff(curApexCol, COL_APEX_IDLE) > 0.01;

      const shouldRender =
        motionScale > 0 ||
        isDragging ||
        Math.abs(velThetaRef.current) > 0 ||
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
      window.removeEventListener("pointercancel", handlePointerCancel);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);

      scene.environment = null;
      envRenderTarget?.dispose();
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

  const handleCanvasKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        nudgeOrbit(-0.45);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nudgeOrbit(0.45);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        resetOrbit();
      } else if (e.key === "1" || e.key === "2" || e.key === "3") {
        onSelectFloor?.(Number(e.key));
      }
    },
    [nudgeOrbit, resetOrbit, onSelectFloor]
  );

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
      <div className="relative w-full h-full min-h-[340px] flex-1 flex">
        <div
          ref={containerRef}
          tabIndex={0}
          role="region"
          aria-label="Interactive 3D Gothic Spire Citadel. Drag or use Left and Right arrow keys to orbit, press R to reset, or keys 1 to 3 to inspect a floor."
          onKeyDown={handleCanvasKeyDown}
          className="w-full h-full min-h-[340px] flex-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
        />
        {showControls && (
          <div className="pointer-events-auto absolute top-3 right-3 flex items-center gap-2 z-10">
            <button
              type="button"
              onClick={() => setPaused(!paused)}
              aria-pressed={paused}
              aria-label={paused ? "Resume 3D citadel motion" : "Pause 3D citadel motion"}
              title={paused ? "Resume motion" : "Pause motion"}
              className="min-w-[44px] min-h-[44px] px-2.5 rounded-lg bg-[#090910]/85 border border-brass/25 text-ash hover:text-parchment hover:border-solar/60 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
            >
              {paused ? <Play className="w-4 h-4 text-solar" aria-hidden="true" /> : <Pause className="w-4 h-4 text-frost" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => nudgeOrbit(-0.45)}
              aria-label="Rotate citadel left"
              title="Rotate left"
              className="min-w-[44px] min-h-[44px] rounded-lg bg-[#090910]/85 border border-brass/25 text-ash hover:text-parchment hover:border-solar/50 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => nudgeOrbit(0.45)}
              aria-label="Rotate citadel right"
              title="Rotate right"
              className="min-w-[44px] min-h-[44px] rounded-lg bg-[#090910]/85 border border-brass/25 text-ash hover:text-parchment hover:border-solar/50 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={resetOrbit}
              aria-label="Reset camera orbit"
              title="Reset camera orbit"
              className="min-w-[44px] min-h-[44px] rounded-lg bg-[#090910]/85 border border-brass/25 text-ash hover:text-parchment hover:border-solar/50 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
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
                <Flame className="w-3.5 h-3.5 text-solar" aria-hidden="true" />
              ) : floorNum === 2 ? (
                <Snowflake className="w-3.5 h-3.5 text-frost" aria-hidden="true" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-void" aria-hidden="true" />
              );

            return (
              <button
                key={floorNum}
                type="button"
                onClick={() => onSelectFloor(floorNum)}
                onMouseEnter={() => setHoveredFloor(floorNum)}
                onMouseLeave={() => setHoveredFloor(null)}
                aria-pressed={isSelected}
                className={`min-h-[44px] px-1.5 sm:px-2.5 py-2 rounded-lg border text-left transition-all flex items-center justify-between gap-1 sm:gap-2 ${
                  isSelected
                    ? floorNum === 3
                      ? "bg-void/15 border-void text-parchment"
                      : floorNum === 2
                      ? "bg-frost/15 border-frost text-parchment"
                      : "bg-solar/15 border-solar text-parchment"
                    : "bg-panel-dark/90 border-brass/20 text-ash hover:border-brass/45 hover:text-parchment"
                }`}
              >
                <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                  {icon}
                  <span className="font-mono text-xs font-semibold whitespace-nowrap">
                    Floor {floorNum}
                  </span>
                </div>
                {!unlocked ? (
                  <>
                    <Lock className="w-3 h-3 text-pewter shrink-0" aria-hidden="true" />
                    <span className="sr-only">Locked</span>
                  </>
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
