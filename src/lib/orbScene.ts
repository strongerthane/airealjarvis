import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

export interface OrbSceneApi {
  rotateBy(deltaTheta: number, deltaPhi: number): void;
  zoomBy(factor: number): void;
  zoomIn(): void;
  zoomOut(): void;
  resetView(): void;
  dispose(): void;
}

const HOME_POSITION = new THREE.Vector3(0, 0.5, 5.5);
const MIN_DISTANCE = 0.6;
const MAX_DISTANCE = 40;

function getSafeSize(container: HTMLElement) {
  const width = Math.max(1, container.clientWidth || 1);
  const height = Math.max(1, container.clientHeight || 1);
  return { width, height };
}

export function createOrbScene(container: HTMLElement): OrbSceneApi {
  const { width, height } = getSafeSize(container);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 500);
  camera.position.copy(HOME_POSITION);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
  container.appendChild(renderer.domElement);

  const composer = new EffectComposer(renderer);
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    1.8,
    0.4,
    0.2,
  );
  composer.addPass(bloom);

  const chromaticShader = {
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uIntensity: { value: 0.003 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;
      void main() {
        vec2 dir = vUv - vec2(0.5);
        float d = length(dir);
        float offset = uIntensity * d;
        float flicker = 1.0 + 0.02 * sin(uTime * 30.0) * sin(uTime * 7.3);
        vec4 cr = texture2D(tDiffuse, vUv + dir * offset);
        vec4 cg = texture2D(tDiffuse, vUv);
        vec4 cb = texture2D(tDiffuse, vUv - dir * offset * 0.5);
        gl_FragColor = vec4(cr.r, cg.g * 1.05, cb.b * 0.6, 1.0) * flicker;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.75, 0.9, 1.15), 0.25);
      }
    `,
  };
  const chromaticPass = new ShaderPass(chromaticShader);
  composer.addPass(chromaticPass);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.04;
  controls.minDistance = MIN_DISTANCE;
  controls.maxDistance = MAX_DISTANCE;
  controls.zoomSpeed = 1.4;
  controls.enablePan = false;

  const C_BRIGHT = 0x7dd3fc;
  const C_MID = 0x3b82f6;
  const C_DIM = 0x1e40af;
  const C_FAINT = 0x062e49;
  const C_HOT = 0x93c5fd;

  const orbGroup = new THREE.Group();
  scene.add(orbGroup);

  function lineMat(color: number, opacity = 1) {
    return new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  function latRing(radius: number, lat: number, segs = 120) {
    const r = radius * Math.cos(lat);
    const y = radius * Math.sin(lat);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a)));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }

  function meridian(radius: number, lon: number, segs = 120) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segs; i++) {
      const lat = (i / segs) * Math.PI - Math.PI / 2;
      pts.push(
        new THREE.Vector3(
          radius * Math.cos(lat) * Math.cos(lon),
          radius * Math.sin(lat),
          radius * Math.cos(lat) * Math.sin(lon),
        ),
      );
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }

  const outerShell = new THREE.Group();
  const R1 = 2.0;
  for (let i = -15; i <= 15; i++) {
    const lat = (i / 15) * (Math.PI / 2) * 0.95;
    const opacity = i % 3 === 0 ? 0.5 : 0.12;
    const color = i % 3 === 0 ? C_MID : C_FAINT;
    outerShell.add(new THREE.Line(latRing(R1, lat), lineMat(color, opacity)));
  }
  for (let i = 0; i < 24; i++) {
    const lon = (i / 24) * Math.PI * 2;
    const isMajor = i % 6 === 0;
    outerShell.add(
      new THREE.Line(meridian(R1, lon), lineMat(isMajor ? C_MID : C_FAINT, isMajor ? 0.6 : 0.1)),
    );
  }
  const CROSS_LINES = 18;
  const CROSS_SPREAD = 0.25;
  for (let i = 0; i < 4; i++) {
    const lon = (i / 4) * Math.PI * 2;
    for (let j = 0; j < CROSS_LINES; j++) {
      const t = (j / (CROSS_LINES - 1)) * 2 - 1;
      const offset = (t * CROSS_SPREAD) / 2;
      const falloff = 1 - Math.abs(t) * 0.7;
      const opacity = 0.85 * falloff;
      const color = Math.abs(t) < 0.3 ? C_BRIGHT : C_MID;
      outerShell.add(new THREE.Line(meridian(R1, lon + offset, 200), lineMat(color, opacity)));
    }
  }
  const EQ_LINES = 20;
  const EQ_SPREAD = 0.35;
  for (let j = 0; j < EQ_LINES; j++) {
    const t = (j / (EQ_LINES - 1)) * 2 - 1;
    const offset = (t * EQ_SPREAD) / 2;
    const falloff = 1 - Math.abs(t) * 0.65;
    const opacity = 0.8 * falloff;
    const color = Math.abs(t) < 0.3 ? C_BRIGHT : C_MID;
    outerShell.add(new THREE.Line(latRing(R1, offset, 200), lineMat(color, opacity)));
  }
  orbGroup.add(outerShell);

  const panelGroup = new THREE.Group();
  function createSpherePanel(
    latCenter: number,
    lonCenter: number,
    latSpan: number,
    lonSpan: number,
    radius: number,
    divisions = 4,
  ) {
    const group = new THREE.Group();
    const mat = lineMat(C_DIM, 0.25);
    for (let i = 0; i <= divisions; i++) {
      const lat = latCenter - latSpan / 2 + (i / divisions) * latSpan;
      const pts: THREE.Vector3[] = [];
      for (let j = 0; j <= divisions * 4; j++) {
        const lon = lonCenter - lonSpan / 2 + (j / (divisions * 4)) * lonSpan;
        pts.push(
          new THREE.Vector3(
            radius * Math.cos(lat) * Math.cos(lon),
            radius * Math.sin(lat),
            radius * Math.cos(lat) * Math.sin(lon),
          ),
        );
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    }
    for (let j = 0; j <= divisions; j++) {
      const lon = lonCenter - lonSpan / 2 + (j / divisions) * lonSpan;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= divisions * 4; i++) {
        const lat = latCenter - latSpan / 2 + (i / (divisions * 4)) * latSpan;
        pts.push(
          new THREE.Vector3(
            radius * Math.cos(lat) * Math.cos(lon),
            radius * Math.sin(lat),
            radius * Math.cos(lat) * Math.sin(lon),
          ),
        );
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    }
    return group;
  }
  for (let i = 0; i < 30; i++) {
    const lat = (Math.random() - 0.5) * Math.PI * 0.8;
    const lon = Math.random() * Math.PI * 2;
    const size = 0.15 + Math.random() * 0.25;
    const panel = createSpherePanel(
      lat,
      lon,
      size,
      size,
      R1 + 0.01,
      3 + Math.floor(Math.random() * 3),
    );
    panelGroup.add(panel);
  }
  orbGroup.add(panelGroup);

  const shell2 = new THREE.Group();
  const R2 = 2.12;
  for (let i = 0; i < 16; i++) {
    const lat = (Math.random() - 0.5) * Math.PI * 0.85;
    const startLon = Math.random() * Math.PI * 2;
    const arcLen = 0.3 + Math.random() * 1.2;
    const pts: THREE.Vector3[] = [];
    const segs = 60;
    const r = R2 * Math.cos(lat);
    const y = R2 * Math.sin(lat);
    for (let j = 0; j <= segs; j++) {
      const a = startLon + (j / segs) * arcLen;
      pts.push(new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a)));
    }
    shell2.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        lineMat(C_MID, 0.2 + Math.random() * 0.3),
      ),
    );
  }
  for (let i = 0; i < 12; i++) {
    const lon = Math.random() * Math.PI * 2;
    const startLat = (Math.random() - 0.5) * Math.PI * 0.8;
    const arcLen = 0.3 + Math.random() * 0.8;
    const pts: THREE.Vector3[] = [];
    const segs = 40;
    for (let j = 0; j <= segs; j++) {
      const lat = startLat + (j / segs) * arcLen;
      pts.push(
        new THREE.Vector3(
          R2 * Math.cos(lat) * Math.cos(lon),
          R2 * Math.sin(lat),
          R2 * Math.cos(lat) * Math.sin(lon),
        ),
      );
    }
    shell2.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        lineMat(C_DIM, 0.15 + Math.random() * 0.2),
      ),
    );
  }
  orbGroup.add(shell2);

  const innerCore = new THREE.Group();
  const R3 = 0.9;
  for (let s = 0; s < 8; s++) {
    const pts: THREE.Vector3[] = [];
    const turns = 3 + Math.random() * 2;
    const segs = 300;
    const phase = (s / 8) * Math.PI * 2;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const lat = t * Math.PI - Math.PI / 2;
      const lon = t * turns * Math.PI * 2 + phase;
      pts.push(
        new THREE.Vector3(
          R3 * Math.cos(lat) * Math.cos(lon),
          R3 * Math.sin(lat),
          R3 * Math.cos(lat) * Math.sin(lon),
        ),
      );
    }
    innerCore.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        lineMat(C_BRIGHT, 0.3 + Math.random() * 0.2),
      ),
    );
  }
  for (let i = -6; i <= 6; i++) {
    const lat = (i / 6) * (Math.PI / 2) * 0.9;
    innerCore.add(new THREE.Line(latRing(R3, lat, 80), lineMat(C_DIM, 0.2)));
  }
  for (let i = 0; i < 12; i++) {
    const lon = (i / 12) * Math.PI * 2;
    innerCore.add(new THREE.Line(meridian(R3, lon, 80), lineMat(C_DIM, 0.15)));
  }
  orbGroup.add(innerCore);

  const coreR = 0.25;
  const icoGeo = new THREE.IcosahedronGeometry(coreR, 1);
  const icoEdges = new THREE.EdgesGeometry(icoGeo);
  const icoWireMat = lineMat(C_HOT, 0.9);
  const icoWire = new THREE.LineSegments(icoEdges, icoWireMat);
  orbGroup.add(icoWire);

  const coreSphereMat = new THREE.MeshBasicMaterial({
    color: C_HOT,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
  });
  const coreSphere = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), coreSphereMat);
  orbGroup.add(coreSphere);

  const glowSphereMat = new THREE.MeshBasicMaterial({
    color: C_MID,
    transparent: true,
    opacity: 0.04,
    blending: THREE.AdditiveBlending,
  });
  const glowSphere = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), glowSphereMat);
  orbGroup.add(glowSphere);

  const codeSnippets = ["sys.init()", "0xFF3A", "malloc()", ">>> SCAN", "void*", "ACK"];

  function makeTextSprite(text: string, size = 0.08) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 32;
    const ctx = c.getContext("2d");
    if (!ctx) {
      const fallback = new THREE.Sprite(new THREE.SpriteMaterial());
      fallback.scale.set(size * 5, size * 0.7, 1);
      return fallback;
    }
    ctx.font = "bold 14px Courier New";
    const alpha = 0.35 + Math.random() * 0.55;
    ctx.fillStyle = `rgba(180, 220, 255, ${alpha})`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 16);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    s.scale.set(size * 5, size * 0.7, 1);
    return s;
  }

  function scatterText(
    count: number,
    sizeFn: () => number,
    rFn: () => number,
    speedScale: [number, number],
  ) {
    const group = new THREE.Group();
    for (let i = 0; i < count; i++) {
      const sp = makeTextSprite(
        codeSnippets[Math.floor(Math.random() * codeSnippets.length)],
        sizeFn(),
      );
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r = rFn();
      sp.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta),
      );
      sp.userData = {
        phi,
        theta,
        r,
        speed:
          (speedScale[0] + Math.random() * speedScale[1]) *
          (Math.random() > 0.5 ? 1 : -1),
      };
      group.add(sp);
    }
    return group;
  }

  const textOuter = scatterText(
    300,
    () => 0.03 + Math.random() * 0.03,
    () => R1 + 0.03 + Math.random() * 0.08,
    [0.0003, 0.0006],
  );
  orbGroup.add(textOuter);

  const debrisGeos = [
    new THREE.IcosahedronGeometry(0.012, 0),
    new THREE.TetrahedronGeometry(0.015, 0),
    new THREE.OctahedronGeometry(0.018, 0),
  ];
  const debris: THREE.Mesh[] = [];
  for (let i = 0; i < 120; i++) {
    const geo = debrisGeos[Math.floor(Math.random() * debrisGeos.length)];
    const mat = new THREE.MeshBasicMaterial({
      color: Math.random() > 0.6 ? C_BRIGHT : C_MID,
      transparent: true,
      opacity: 0.3 + Math.random() * 0.6,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const orbitR = 1.2 + Math.random() * 4.0;
    const speed = (0.08 + Math.random() * 0.6) * (Math.random() > 0.5 ? 1 : -1);
    const tiltX = (Math.random() - 0.5) * Math.PI * 0.9;
    const tiltZ = (Math.random() - 0.5) * Math.PI * 0.5;
    const phase = Math.random() * Math.PI * 2;
    mesh.userData = { orbitR, speed, tiltX, tiltZ, phase };
    debris.push(mesh);
    orbGroup.add(mesh);
  }

  const dustCount = 800;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    const rr = 0.5 + Math.pow(Math.random(), 0.6) * 7;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    dustPos[i * 3] = rr * Math.sin(phi) * Math.cos(theta);
    dustPos[i * 3 + 1] = rr * Math.cos(phi);
    dustPos[i * 3 + 2] = rr * Math.sin(phi) * Math.sin(theta);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.Float32BufferAttribute(dustPos, 3));

  const dotC = document.createElement("canvas");
  dotC.width = dotC.height = 64;
  const dCtx = dotC.getContext("2d");
  if (dCtx) {
    const g = dCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(120,200,255,1)");
    g.addColorStop(0.2, "rgba(90,160,255,0.6)");
    g.addColorStop(0.5, "rgba(50,100,180,0.15)");
    g.addColorStop(1, "rgba(20,40,80,0)");
    dCtx.fillStyle = g;
    dCtx.fillRect(0, 0, 64, 64);
  }

  const dustMat = new THREE.PointsMaterial({
    map: new THREE.CanvasTexture(dotC),
    size: 0.04,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    color: C_BRIGHT,
  });
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  orbGroup.add(dustPoints);

  function makeScanRing(radius: number, thickness = 0.015) {
    const geo = new THREE.RingGeometry(radius - thickness, radius + thickness, 120);
    const mat = new THREE.MeshBasicMaterial({
      color: C_BRIGHT,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  const scanRing1 = makeScanRing(R1, 0.01);
  const scanRing2 = makeScanRing(R1 * 0.7, 0.008);
  orbGroup.add(scanRing1, scanRing2);

  for (let i = 0; i < 15; i++) {
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    const r = R1 + 0.02;
    const hexGeo = new THREE.CircleGeometry(0.03 + Math.random() * 0.02, 6);
    const hexEdges = new THREE.EdgesGeometry(hexGeo);
    const hex = new THREE.LineSegments(hexEdges, lineMat(C_MID, 0.5));
    hex.position.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta),
    );
    hex.lookAt(0, 0, 0);
    outerShell.add(hex);
  }

  const sphericalScratch = new THREE.Spherical();
  const offsetScratch = new THREE.Vector3();

  function rotateBy(deltaTheta: number, deltaPhi: number) {
    offsetScratch.copy(camera.position).sub(controls.target);
    sphericalScratch.setFromVector3(offsetScratch);
    sphericalScratch.theta -= deltaTheta;
    sphericalScratch.phi = THREE.MathUtils.clamp(
      sphericalScratch.phi - deltaPhi,
      0.05,
      Math.PI - 0.05,
    );
    sphericalScratch.makeSafe();
    offsetScratch.setFromSpherical(sphericalScratch);
    camera.position.copy(controls.target).add(offsetScratch);
    camera.lookAt(controls.target);
  }

  function zoomBy(factor: number) {
    offsetScratch.copy(camera.position).sub(controls.target);
    const dist = THREE.MathUtils.clamp(
      offsetScratch.length() * factor,
      MIN_DISTANCE,
      MAX_DISTANCE,
    );
    offsetScratch.setLength(dist);
    camera.position.copy(controls.target).add(offsetScratch);
  }

  function resetView() {
    camera.position.copy(HOME_POSITION);
    controls.target.set(0, 0, 0);
    camera.lookAt(controls.target);
    controls.update();
  }

  const timer = new THREE.Timer();
  timer.connect(document);
  timer.start();

  let flickerTimer = 0;
  let rafId = 0;
  let disposed = false;

  function animate() {
    if (disposed) return;
    rafId = requestAnimationFrame(animate);

    timer.update();
    const t = timer.getElapsed();

    outerShell.rotation.y += 0.0015;
    outerShell.rotation.x = Math.sin(t * 0.08) * 0.05;
    panelGroup.rotation.y += 0.0018;
    panelGroup.rotation.x = Math.sin(t * 0.08 + 0.5) * 0.04;
    shell2.rotation.y -= 0.001;
    shell2.rotation.z = Math.sin(t * 0.12) * 0.03;
    innerCore.rotation.y -= 0.005;
    innerCore.rotation.z += 0.002;
    innerCore.rotation.x = Math.cos(t * 0.1) * 0.08;
    icoWire.rotation.x += 0.008;
    icoWire.rotation.y += 0.012;

    const wave1 = Math.sin(t * 1.2);
    const wave3 = Math.pow(Math.max(0, Math.sin(t * 0.4)), 5);
    const wave4 = Math.pow(Math.max(0, Math.sin(t * 0.7 + 2)), 8);
    const fadeOut = Math.pow(Math.max(0, Math.sin(t * 0.25)), 3);
    const surge = wave3 * 1.5 + wave4 * 2.0;
    const coreScale = 1 + surge + Math.sin(t * 5) * 0.05;

    coreSphere.scale.setScalar(coreScale);
    const coreOpacity = Math.max(
      0,
      (0.08 + wave1 * 0.05 + surge * 0.2) * (1 - fadeOut * 0.95),
    );
    coreSphereMat.opacity = Math.min(0.6, coreOpacity);
    glowSphere.scale.setScalar(1 + surge * 0.8);
    glowSphereMat.opacity = Math.max(0, (0.03 + surge * 0.08) * (1 - fadeOut * 0.9));
    icoWire.scale.setScalar(1 + surge * 0.6);
    icoWireMat.opacity = Math.min(1, 0.5 + surge * 0.4);

    debris.forEach((d) => {
      const u = d.userData as any;
      const a = t * u.speed + u.phase;
      d.position.set(
        u.orbitR * Math.cos(a) * Math.cos(u.tiltX),
        u.orbitR * Math.sin(u.tiltX) * Math.sin(a * 0.8) +
          Math.sin(a * 0.3 + u.tiltZ) * 0.2,
        u.orbitR * Math.sin(a) * Math.cos(u.tiltZ),
      );
      d.rotation.x += 0.015;
      d.rotation.z += 0.01;
    });

    textOuter.children.forEach((sp) => {
      const u = sp.userData as any;
      u.theta += u.speed;
      sp.position.set(
        u.r * Math.sin(u.phi) * Math.cos(u.theta),
        u.r * Math.cos(u.phi),
        u.r * Math.sin(u.phi) * Math.sin(u.theta),
      );
    });

    const scanY1 = Math.sin(t * 0.4) * R1;
    scanRing1.position.y = scanY1;
    const scanS1 = Math.sqrt(Math.max(0, R1 * R1 - scanY1 * scanY1)) / R1;
    scanRing1.scale.set(scanS1, scanS1, 1);
    (scanRing1.material as THREE.MeshBasicMaterial).opacity = 0.2 * scanS1;

    const scanY2 = Math.sin(t * 0.6 + 2) * R3;
    scanRing2.position.y = scanY2;
    const scanS2 = Math.sqrt(Math.max(0, R3 * R3 - scanY2 * scanY2)) / R3;
    scanRing2.scale.set(scanS2, scanS2, 1);
    (scanRing2.material as THREE.MeshBasicMaterial).opacity = 0.15 * scanS2;

    dustPoints.rotation.y += 0.0002;

    flickerTimer += 0.016;
    if (flickerTimer > 0.1) {
      flickerTimer = 0;
      panelGroup.children.forEach((p) => {
        if (Math.random() > 0.95) p.visible = !p.visible;
      });
    }

    bloom.strength = 1.6 + Math.sin(t * 0.8) * 0.3;
    chromaticPass.uniforms.uTime.value = t;

    controls.update();
    composer.render();
  }

  animate();

  function onResize() {
    const next = getSafeSize(container);
    if (!next.width || !next.height) return;
    camera.aspect = next.width / next.height;
    camera.updateProjectionMatrix();
    renderer.setSize(next.width, next.height, false);
    composer.setSize(next.width, next.height);
    bloom.setSize(next.width, next.height);
  }

  const resizeObserver = new ResizeObserver(() => {
    onResize();
  });
  resizeObserver.observe(container);

  window.addEventListener("resize", onResize);

  function dispose() {
    disposed = true;
    cancelAnimationFrame(rafId);
    resizeObserver.disconnect();
    window.removeEventListener("resize", onResize);
    controls.dispose();

    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh & {
        material?: THREE.Material | THREE.Material[];
        geometry?: THREE.BufferGeometry;
      };
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (!mat) continue;
        const anyMat = mat as THREE.Material & { map?: THREE.Texture };
        anyMat.map?.dispose();
        mat.dispose();
      }
    });

    composer.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }

  return {
    rotateBy,
    zoomBy,
    zoomIn: () => zoomBy(0.65),
    zoomOut: () => zoomBy(1.55),
    resetView,
    dispose,
  };
}
