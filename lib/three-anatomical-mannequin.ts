import * as THREE from 'three';
import { AnatomicalMuscleId } from '@/lib/exercise-muscle-map';

export interface LimbRig {
  topPivot: THREE.Group;
  midPivot: THREE.Group;
  endPivot: THREE.Group;
  side: -1 | 1;
  upperLen: number;
  lowerLen: number;
}

export interface MuscleStriationTextures {
  albedoMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  dispose: () => void;
}

export interface AnatomicalMannequinOptions {
  muscleMats: Record<AnatomicalMuscleId, THREE.MeshStandardMaterial>;
  bodyMat: THREE.MeshStandardMaterial;
  tendonMat: THREE.MeshStandardMaterial;
  shortsMat: THREE.MeshStandardMaterial;
  skinMat?: THREE.MeshStandardMaterial;
}

export interface AnatomicalMannequinResult {
  rootGroup: THREE.Group;
  pelvisPivot: THREE.Group;
  spinePivot: THREE.Group;
  chestPivot: THREE.Group;
  leftArm: LimbRig;
  rightArm: LimbRig;
  leftLeg: LimbRig;
  rightLeg: LimbRig;
  dispose: () => void;
}

interface LoftRing {
  y: number;
  rx: number;
  rz: number;
  offsetX?: number;
  offsetZ?: number;
  frontPinch?: number;
  backPinch?: number;
  squareness?: number;
}

/**
 * Determina un generador pseudo-aleatorio determinista para texturas repetibles
 * sin flickering ni variaciones entre renders.
 */
function createSeededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Genera mapas procedurales en memoria (Albedo en escala de grises + BumpMap)
 * con estrías longitudinales de fibras musculares e inserciones tendinosas sutiles.
 */
export function createMuscleStriationTextures(): MuscleStriationTextures {
  const size = 256;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  // Base luminosa neutra para multiplicar limpiamente por color del músculo
  aCtx.fillStyle = '#ebedf2';
  aCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  const rand = createSeededRandom(4219);

  // Haz de fascículos musculares suaves
  const bundleCount = 14;
  for (let i = 0; i < bundleCount; i++) {
    const xBase = (i / bundleCount) * size;
    const bundleW = size / bundleCount;
    const shade = Math.round(218 + rand() * 24);
    const bump = Math.round(122 + rand() * 34);

    aCtx.fillStyle = `rgba(${shade}, ${shade + 2}, ${shade + 5}, 0.42)`;
    aCtx.fillRect(xBase + 1, 0, bundleW - 2, size);

    // Tabique intermuscular sutil
    aCtx.fillStyle = 'rgba(130, 140, 158, 0.34)';
    aCtx.fillRect(xBase, 0, 1.5, size);

    bCtx.fillStyle = `rgba(${bump}, ${bump}, ${bump}, 0.55)`;
    bCtx.fillRect(xBase + 1.5, 0, bundleW - 3, size);
    bCtx.fillStyle = 'rgba(78, 78, 78, 0.45)';
    bCtx.fillRect(xBase, 0, 1.5, size);
  }

  // Fibras finas sinuosas longitudinales (miofibrillas)
  for (let f = 0; f < 160; f++) {
    const x0 = rand() * size;
    const amp = 1.2 + rand() * 2.2;
    const freq = 0.025 + rand() * 0.035;
    const phase = rand() * Math.PI * 2;
    const isDark = f % 2 === 0;

    aCtx.strokeStyle = isDark
      ? `rgba(118, 126, 142, ${0.14 + rand() * 0.22})`
      : `rgba(255, 255, 255, ${0.18 + rand() * 0.22})`;
    aCtx.lineWidth = 0.8 + rand() * 1.1;

    bCtx.strokeStyle = isDark
      ? `rgba(82, 82, 82, ${0.24 + rand() * 0.25})`
      : `rgba(205, 205, 205, ${0.22 + rand() * 0.24})`;
    bCtx.lineWidth = aCtx.lineWidth;

    aCtx.beginPath();
    bCtx.beginPath();
    for (let y = 0; y <= size; y += 8) {
      const x = x0 + Math.sin(y * freq + phase) * amp;
      if (y === 0) {
        aCtx.moveTo(x, y);
        bCtx.moveTo(x, y);
      } else {
        aCtx.lineTo(x, y);
        bCtx.lineTo(x, y);
      }
    }
    aCtx.stroke();
    bCtx.stroke();
  }

  // Inserción tendinosa suave en los extremos superior e inferior (V -> 0 y V -> 1)
  const topFade = aCtx.createLinearGradient(0, 0, 0, size * 0.16);
  topFade.addColorStop(0, 'rgba(244, 246, 250, 0.72)');
  topFade.addColorStop(1, 'rgba(244, 246, 250, 0)');
  aCtx.fillStyle = topFade;
  aCtx.fillRect(0, 0, size, size * 0.16);

  const botFade = aCtx.createLinearGradient(0, size * 0.84, 0, size);
  botFade.addColorStop(0, 'rgba(244, 246, 250, 0)');
  botFade.addColorStop(1, 'rgba(244, 246, 250, 0.72)');
  aCtx.fillStyle = botFade;
  aCtx.fillRect(0, size * 0.84, size, size * 0.16);

  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.RepeatWrapping;
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = 4;

  return {
    albedoMap,
    bumpMap,
    dispose: () => {
      albedoMap.dispose();
      bumpMap.dispose();
    },
  };
}

/**
 * Construye una malla cerrada orgánica por anillos transversales ordenados de abajo hacia arriba,
 * con normales suaves CCW y UVs longitudinales para fibras musculares reales.
 */
function createSculptedLoftGeometry(
  rawRings: LoftRing[],
  radialSegments = 22,
  uRepeat = 1.5
): THREE.BufferGeometry {
  const rings = [...rawRings].sort((a, b) => a.y - b.y);
  const ringCount = rings.length;
  const stride = radialSegments + 1;
  const yMin = rings[0].y;
  const ySpan = Math.max(0.0001, rings[ringCount - 1].y - yMin);

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < ringCount; i++) {
    const r = rings[i];
    const v = (r.y - yMin) / ySpan;
    const ox = r.offsetX ?? 0;
    const oz = r.offsetZ ?? 0;
    const frontPinch = r.frontPinch ?? 1;
    const backPinch = r.backPinch ?? 1;
    const sq = r.squareness ?? 0;

    for (let j = 0; j <= radialSegments; j++) {
      const uNorm = j / radialSegments;
      const theta = uNorm * Math.PI * 2;
      let cosT = Math.cos(theta);
      let sinT = Math.sin(theta);

      if (sq > 0) {
        const exp = Math.max(0.45, 1 - sq * 0.45);
        cosT = Math.sign(cosT) * Math.pow(Math.abs(cosT), exp);
        sinT = Math.sign(sinT) * Math.pow(Math.abs(sinT), exp);
      }

      const pinchX = sinT >= 0 ? 1 - (1 - frontPinch) * sinT : 1 - (1 - backPinch) * -sinT;
      const x = ox + cosT * r.rx * pinchX;
      const z = oz + sinT * r.rz;

      positions.push(x, r.y, z);
      uvs.push(uNorm * uRepeat, v);
    }
  }

  // Caras laterales con devanado CCW hacia el exterior
  for (let i = 0; i < ringCount - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * stride + j;
      const b = i * stride + (j + 1);
      const c = (i + 1) * stride + (j + 1);
      const d = (i + 1) * stride + j;
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  // Tapa inferior (normal -Y)
  const botCenterIdx = positions.length / 3;
  positions.push(rings[0].offsetX ?? 0, rings[0].y, rings[0].offsetZ ?? 0);
  uvs.push(0.5, 0);
  for (let j = 0; j < radialSegments; j++) {
    indices.push(botCenterIdx, j, j + 1);
  }

  // Tapa superior (normal +Y)
  const topRingStart = (ringCount - 1) * stride;
  const topCenterIdx = positions.length / 3;
  positions.push(rings[ringCount - 1].offsetX ?? 0, rings[ringCount - 1].y, rings[ringCount - 1].offsetZ ?? 0);
  uvs.push(0.5, 1);
  for (let j = 0; j < radialSegments; j++) {
    indices.push(topCenterIdx, topRingStart + j + 1, topRingStart + j);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Construye una malla anatómica en abanico para el pectoral mayor (esternal + clavicular),
 * ceñida a la curvatura de la caja torácica y con UVs convergentes hacia el hombro.
 */
function createPectoralFanGeometry(side: -1 | 1): THREE.BufferGeometry {
  const uSegs = 16;
  const vSegs = 12;
  const stride = vSegs + 1;
  const gridCount = (uSegs + 1) * stride;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const samplePoint = (u: number, v: number, isBack: boolean): [number, number, number] => {
    const x = side * THREE.MathUtils.lerp(0.008, 0.172, u);
    const yBottom = THREE.MathUtils.lerp(0.114, 0.178, Math.pow(u, 1.35));
    const yTop = 0.252 - 0.012 * u - 0.008 * Math.pow(1 - u, 2);
    const y = THREE.MathUtils.lerp(yBottom, yTop, v);
    const zBase = 0.088 * Math.cos(u * 1.12) - 0.006 * Math.abs(v - 0.45);
    const edgeFade = Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
    if (isBack) {
      return [x, y, zBase - 0.008 * edgeFade];
    }
    const bulge =
      0.022 *
      Math.sin(Math.pow(u, 0.65) * Math.PI) *
      Math.sin(Math.pow(v, 0.72) * Math.PI) *
      (1.12 - 0.22 * v);
    return [x, y, zBase + bulge];
  };

  // Vértices de la cara frontal (+Z)
  for (let i = 0; i <= uSegs; i++) {
    const u = i / uSegs;
    for (let j = 0; j <= vSegs; j++) {
      const v = j / vSegs;
      const [x, y, z] = samplePoint(u, v, false);
      positions.push(x, y, z);
      // V sigue u (esternón -> húmero) para que las estrías irradien en abanico hacia el hombro
      uvs.push(v * 1.35, u * 1.15);
    }
  }

  // Vértices de la cara posterior (-Z)
  for (let i = 0; i <= uSegs; i++) {
    const u = i / uSegs;
    for (let j = 0; j <= vSegs; j++) {
      const v = j / vSegs;
      const [x, y, z] = samplePoint(u, v, true);
      positions.push(x, y, z);
      uvs.push(v * 1.35, u * 1.15);
    }
  }

  // Índices frontales (respetando espejo X cuando side === -1 para normales CCW salientes)
  for (let i = 0; i < uSegs; i++) {
    for (let j = 0; j < vSegs; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      if (side === 1) {
        indices.push(a, b, c, a, c, d);
      } else {
        indices.push(a, c, b, a, d, c);
      }
    }
  }

  // Índices posteriores
  for (let i = 0; i < uSegs; i++) {
    for (let j = 0; j < vSegs; j++) {
      const a = gridCount + i * stride + j;
      const b = gridCount + (i + 1) * stride + j;
      const c = gridCount + (i + 1) * stride + (j + 1);
      const d = gridCount + i * stride + (j + 1);
      if (side === 1) {
        indices.push(a, c, b, a, d, c);
      } else {
        indices.push(a, b, c, a, c, d);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Crea un músculo redondeado/fusiforme escalado con UVs limpias para que las fibras recorran su eje.
 */
function createMuscleBellGeometry(
  rx: number,
  ry: number,
  rz: number,
  taperTop = 1,
  taperBottom = 1,
  widthSegs = 16,
  heightSegs = 14
): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, widthSegs, heightSegs);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = y >= 0 ? THREE.MathUtils.lerp(1, taperTop, y) : THREE.MathUtils.lerp(1, taperBottom, -y);
    pos.setXYZ(i, x * rx * t, y * ry, z * rz * t);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Construye el maniquí anatómico esculpido (*écorché*) preservando exactamente los pivotes,
 * longitudes de segmentos y puntos de contacto con barras/bancos/máquinas del visor 3D.
 */
export function buildAnatomicalMannequin({
  muscleMats,
  bodyMat,
  tendonMat,
  shortsMat,
  skinMat = bodyMat,
}: AnatomicalMannequinOptions): AnatomicalMannequinResult {
  const geometries: THREE.BufferGeometry[] = [];
  const track = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };

  const makeMesh = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    pos?: [number, number, number],
    rot?: [number, number, number],
    scale?: [number, number, number]
  ) => {
    const m = new THREE.Mesh(track(geo), mat);
    if (pos) m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    if (scale) m.scale.set(...scale);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  const rootGroup = new THREE.Group();

  // ==============================================================
  // 1. PELVIS Y PANTALÓN CORTO DEPORTIVO + GLÚTEOS ANATÓMICOS
  // ==============================================================
  const pelvisPivot = new THREE.Group();
  pelvisPivot.position.set(0, 0.88, 0);
  rootGroup.add(pelvisPivot);

  // Base anatómica de cadera y pantalón corto de compresión
  const shortsPelvisGeo = createSculptedLoftGeometry(
    [
      { y: -0.075, rx: 0.145, rz: 0.095, offsetZ: -0.004, squareness: 0.25 },
      { y: -0.02, rx: 0.162, rz: 0.106, offsetZ: -0.002, squareness: 0.25 },
      { y: 0.045, rx: 0.156, rz: 0.102, offsetZ: 0.0, squareness: 0.2 },
      { y: 0.088, rx: 0.136, rz: 0.092, offsetZ: 0.002, squareness: 0.2 },
    ],
    22
  );
  pelvisPivot.add(makeMesh(shortsPelvisGeo, shortsMat));

  // Cinturilla deportiva del pantalón
  const waistbandGeo = createSculptedLoftGeometry(
    [
      { y: 0.068, rx: 0.146, rz: 0.099, offsetZ: 0.002, squareness: 0.2 },
      { y: 0.098, rx: 0.134, rz: 0.094, offsetZ: 0.002, squareness: 0.2 },
    ],
    22
  );
  pelvisPivot.add(makeMesh(waistbandGeo, shortsMat));

  // Glúteos esculpidos (en -Z; en reposo siguen tono oscuro del pantalón, al activarse lucen en rojo/ámbar)
  [-1, 1].forEach((side) => {
    const gluteGeo = createMuscleBellGeometry(0.082, 0.088, 0.066, 0.78, 0.92);
    const glute = makeMesh(
      gluteGeo,
      muscleMats.glutes,
      [side * 0.074, -0.015, -0.068],
      [0.14, side * -0.18, side * 0.08]
    );
    pelvisPivot.add(glute);
  });

  // ==============================================================
  // 2. COLUMNA / CINTURA: OBLICUOS, ABDOMEN 6-PACK Y LUMBARES
  // ==============================================================
  const spinePivot = new THREE.Group();
  spinePivot.position.set(0, 0.07, 0);
  pelvisPivot.add(spinePivot);

  const waistCoreGeo = createSculptedLoftGeometry(
    [
      { y: 0.0, rx: 0.126, rz: 0.088, offsetZ: 0.0 },
      { y: 0.075, rx: 0.12, rz: 0.084, offsetZ: 0.002 },
      { y: 0.145, rx: 0.126, rz: 0.086, offsetZ: 0.003 },
      { y: 0.22, rx: 0.138, rz: 0.09, offsetZ: 0.002 },
    ],
    22
  );
  spinePivot.add(makeMesh(waistCoreGeo, bodyMat));

  // 6 bloques anatómicos definidos pero integrados en la pared abdominal + oblicuos estilizados
  const abHeights = [0.172, 0.116, 0.058];
  const abWidths = [0.036, 0.034, 0.031];
  [-1, 1].forEach((side) => {
    abHeights.forEach((ay, idx) => {
      const abPad = makeMesh(
        createMuscleBellGeometry(abWidths[idx], 0.023, 0.012, 0.92, 0.9),
        muscleMats.abs,
        [side * 0.03, ay, 0.074],
        [0.04, side * -0.14, 0]
      );
      spinePivot.add(abPad);
    });

    // Oblicuo lateral esculpido sin sobresalir
    const oblique = makeMesh(
      createMuscleBellGeometry(0.018, 0.076, 0.036, 0.88, 0.72),
      muscleMats.abs,
      [side * 0.104, 0.105, 0.018],
      [0.1, side * 0.24, side * -0.14]
    );
    spinePivot.add(oblique);

    // Erector espinal / lumbar (-Z)
    const erector = makeMesh(
      createMuscleBellGeometry(0.04, 0.094, 0.026, 0.85, 0.85),
      muscleMats.lower_back,
      [side * 0.042, 0.11, -0.072],
      [-0.04, side * 0.14, side * 0.05]
    );
    spinePivot.add(erector);
  });

  // ==============================================================
  // 3. TÓRAX: CAJA TORÁCICA, PECTORALES, DORSALES Y TRAPECIOS
  // ==============================================================
  const chestPivot = new THREE.Group();
  chestPivot.position.set(0, 0.21, 0);
  spinePivot.add(chestPivot);

  const torsoCoreGeo = createSculptedLoftGeometry(
    [
      { y: 0.0, rx: 0.136, rz: 0.088, offsetZ: 0.0 },
      { y: 0.08, rx: 0.156, rz: 0.094, offsetZ: 0.0 },
      { y: 0.175, rx: 0.174, rz: 0.096, offsetZ: -0.002, frontPinch: 0.96 },
      { y: 0.25, rx: 0.162, rz: 0.086, offsetZ: -0.005 },
      { y: 0.29, rx: 0.085, rz: 0.068, offsetZ: -0.006 },
    ],
    24
  );
  chestPivot.add(makeMesh(torsoCoreGeo, bodyMat));

  // Clavículas suaves sobre la parte superior del pecho
  [-1, 1].forEach((side) => {
    const clavicle = makeMesh(
      new THREE.CapsuleGeometry(0.011, 0.105, 6, 10),
      tendonMat,
      [side * 0.092, 0.26, 0.066],
      [0, side * -0.22, side * (Math.PI / 2 - 0.12)]
    );
    chestPivot.add(clavicle);
  });

  // Pectoral mayor en abanico anatómico esculpido sobre la caja torácica
  ([-1, 1] as const).forEach((side) => {
    chestPivot.add(makeMesh(createPectoralFanGeometry(side), muscleMats.chest));
  });

  // Dorsales anchos en V y romboides/espalda alta (-Z)
  [-1, 1].forEach((side) => {
    const lat = makeMesh(
      createMuscleBellGeometry(0.072, 0.118, 0.034, 0.95, 0.56),
      muscleMats.upper_back,
      [side * 0.112, 0.135, -0.064],
      [-0.08, side * 0.32, side * -0.2]
    );
    chestPivot.add(lat);

    const midTrap = makeMesh(
      createMuscleBellGeometry(0.058, 0.078, 0.028, 0.85, 0.75),
      muscleMats.upper_back,
      [side * 0.056, 0.185, -0.08],
      [0, side * 0.14, side * -0.1]
    );
    chestPivot.add(midTrap);
  });

  // Trapecio superior en pendiente (encaja justo delante de la barra de sentadilla en z = -0.125)
  const trapsUpper = makeMesh(
    createMuscleBellGeometry(0.115, 0.044, 0.058, 0.52, 1.0),
    muscleMats.traps,
    [0, 0.278, -0.038],
    [0.24, 0, 0]
  );
  chestPivot.add(trapsUpper);

  [-1, 1].forEach((side) => {
    const trapSlope = makeMesh(
      createMuscleBellGeometry(0.078, 0.032, 0.044, 0.65, 0.95),
      muscleMats.traps,
      [side * 0.096, 0.268, -0.026],
      [0.14, side * 0.24, side * -0.34]
    );
    chestPivot.add(trapSlope);
  });

  // ==============================================================
  // 4. CUELLO Y CABEZA ANATÓMICA ESCULPIDA
  // ==============================================================
  const neckGeo = createSculptedLoftGeometry(
    [
      { y: 0.265, rx: 0.066, rz: 0.062, offsetZ: -0.004 },
      { y: 0.315, rx: 0.054, rz: 0.055, offsetZ: 0.0 },
      { y: 0.365, rx: 0.052, rz: 0.054, offsetZ: 0.004 },
    ],
    18
  );
  chestPivot.add(makeMesh(neckGeo, bodyMat));

  // Tendones esternocleidomastoideos en V
  [-1, 1].forEach((side) => {
    const scm = makeMesh(
      new THREE.CapsuleGeometry(0.011, 0.07, 6, 8),
      tendonMat,
      [side * 0.024, 0.308, 0.042],
      [0.18, 0, side * -0.28]
    );
    chestPivot.add(scm);
  });

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.425, 0.012);
  chestPivot.add(headGroup);

  // Cráneo + mandíbula esculpida lisa sin estrías (busto anatómico limpio)
  const cranium = makeMesh(
    createMuscleBellGeometry(0.075, 0.086, 0.09, 0.85, 0.82),
    skinMat,
    [0, 0.014, -0.006],
    [-0.08, 0, 0]
  );
  headGroup.add(cranium);

  const jawGeo = createSculptedLoftGeometry(
    [
      { y: -0.08, rx: 0.036, rz: 0.044, offsetZ: 0.024, frontPinch: 0.82 },
      { y: -0.04, rx: 0.056, rz: 0.062, offsetZ: 0.012, frontPinch: 0.88 },
      { y: 0.0, rx: 0.066, rz: 0.074, offsetZ: 0.002 },
    ],
    18
  );
  headGroup.add(makeMesh(jawGeo, skinMat));

  // Puente nasal suave y orejas anatómicas
  headGroup.add(
    makeMesh(createMuscleBellGeometry(0.008, 0.019, 0.011), skinMat, [0, -0.008, 0.079], [-0.18, 0, 0])
  );
  [-1, 1].forEach((side) => {
    headGroup.add(
      makeMesh(createMuscleBellGeometry(0.011, 0.022, 0.014), skinMat, [side * 0.075, -0.004, -0.006])
    );
  });

  // ==============================================================
  // 5. BRAZOS ESCULPIDOS (3 CABEZAS DELTOIDES, BÍCEPS, TRÍCEPS, MANOS)
  // ==============================================================
  const createArm = (side: -1 | 1): LimbRig => {
    const upperLen = 0.27;
    const lowerLen = 0.25;
    const topPivot = new THREE.Group();

    // Deltoides de 3 cabezas (anterior, lateral y posterior) envolviendo el hombro
    const deltLat = makeMesh(
      createMuscleBellGeometry(0.052, 0.076, 0.054, 0.82, 0.56),
      muscleMats.shoulders,
      [side * 0.012, -0.034, 0],
      [0, 0, side * -0.14]
    );
    topPivot.add(deltLat);

    const deltFront = makeMesh(
      createMuscleBellGeometry(0.038, 0.062, 0.036, 0.82, 0.6),
      muscleMats.shoulders,
      [side * -0.006, -0.028, 0.024],
      [-0.22, 0, side * -0.1]
    );
    topPivot.add(deltFront);

    const deltRear = makeMesh(
      createMuscleBellGeometry(0.038, 0.06, 0.036, 0.82, 0.6),
      muscleMats.shoulders,
      [side * 0.004, -0.03, -0.026],
      [0.2, 0, side * -0.1]
    );
    topPivot.add(deltRear);

    // Núcleo del húmero
    const upperCoreGeo = createSculptedLoftGeometry(
      [
        { y: -upperLen, rx: 0.036, rz: 0.036 },
        { y: -upperLen * 0.55, rx: 0.044, rz: 0.046 },
        { y: -0.02, rx: 0.048, rz: 0.048 },
      ],
      16
    );
    topPivot.add(makeMesh(upperCoreGeo, bodyMat));

    // Bíceps (+Z) y Tríceps en herradura (-Z)
    topPivot.add(
      makeMesh(
        createMuscleBellGeometry(0.034, 0.095, 0.032, 0.72, 0.72),
        muscleMats.biceps,
        [0, -0.145, 0.028]
      )
    );
    topPivot.add(
      makeMesh(
        createMuscleBellGeometry(0.036, 0.098, 0.032, 0.78, 0.64),
        muscleMats.triceps,
        [side * 0.008, -0.135, -0.028]
      )
    );

    const midPivot = new THREE.Group();
    midPivot.position.y = -upperLen;
    topPivot.add(midPivot);

    // Transición orgánica de codo
    midPivot.add(makeMesh(new THREE.SphereGeometry(0.04, 14, 12), tendonMat));

    // Antebrazo fusiforme (braquiorradial ancho en zona proximal -> muñeca estilizada)
    const forearmGeo = createSculptedLoftGeometry(
      [
        { y: -lowerLen, rx: 0.027, rz: 0.022 },
        { y: -lowerLen * 0.62, rx: 0.034, rz: 0.03 },
        { y: -lowerLen * 0.25, rx: 0.044, rz: 0.04 },
        { y: 0.0, rx: 0.038, rz: 0.036 },
      ],
      16
    );
    midPivot.add(makeMesh(forearmGeo, muscleMats.forearms));

    const endPivot = new THREE.Group();
    endPivot.position.y = -lowerLen;
    midPivot.add(endPivot);

    // Mano humana anatómica lisa (muñeca + palma + dedos flexionados para agarrar la barra alrededor de 0,0,0)
    const handGroup = new THREE.Group();
    endPivot.add(handGroup);

    handGroup.add(makeMesh(new THREE.SphereGeometry(0.026, 12, 10), tendonMat, [0, 0.012, 0]));
    handGroup.add(
      makeMesh(
        createMuscleBellGeometry(0.022, 0.034, 0.032, 0.9, 0.9),
        skinMat,
        [0, -0.012, 0.008]
      )
    );
    // Bloque de dedos en garra suavemente cerrada hacia la palma
    handGroup.add(
      makeMesh(
        new THREE.CapsuleGeometry(0.016, 0.038, 6, 10),
        skinMat,
        [0, -0.036, 0.02],
        [0.45, 0, Math.PI / 2]
      )
    );
    // Pulgar oponible
    handGroup.add(
      makeMesh(
        new THREE.CapsuleGeometry(0.011, 0.026, 5, 8),
        skinMat,
        [side * -0.024, -0.014, 0.024],
        [0.4, 0, side * 0.5]
      )
    );

    return { topPivot, midPivot, endPivot, side, upperLen, lowerLen };
  };

  // ==============================================================
  // 6. PIERNAS ESCULPIDAS (CUÁDRICEPS, ISQUIOS, GEMELOS Y PIES)
  // ==============================================================
  const LEG_UPPER = 0.42;
  const LEG_LOWER = 0.41;

  const createLeg = (side: -1 | 1): LimbRig => {
    const topPivot = new THREE.Group();
    topPivot.add(makeMesh(new THREE.SphereGeometry(0.072, 14, 12), shortsMat));

    // Pernera del pantalón corto de compresión (cubre 27% superior del muslo sin clipping)
    const shortLegGeo = createSculptedLoftGeometry(
      [
        { y: -0.145, rx: 0.083, rz: 0.085, offsetZ: 0.002 },
        { y: -0.06, rx: 0.088, rz: 0.09, offsetZ: 0.002 },
        { y: 0.015, rx: 0.086, rz: 0.088 },
      ],
      20
    );
    topPivot.add(makeMesh(shortLegGeo, shortsMat));

    // Núcleo anatómico del muslo
    const thighCoreGeo = createSculptedLoftGeometry(
      [
        { y: -LEG_UPPER, rx: 0.05, rz: 0.052 },
        { y: -LEG_UPPER * 0.65, rx: 0.066, rz: 0.07 },
        { y: -LEG_UPPER * 0.3, rx: 0.078, rz: 0.082 },
        { y: -0.04, rx: 0.082, rz: 0.084 },
      ],
      20
    );
    topPivot.add(makeMesh(thighCoreGeo, bodyMat));

    // Cuádriceps en 3 haces visibles (+Z)
    // Recto femoral central
    topPivot.add(
      makeMesh(
        createMuscleBellGeometry(0.036, 0.145, 0.032, 0.82, 0.68),
        muscleMats.quads,
        [0, -0.22, 0.056]
      )
    );
    // Vasto lateral exterior (curva atlética del muslo)
    topPivot.add(
      makeMesh(
        createMuscleBellGeometry(0.038, 0.15, 0.04, 0.85, 0.65),
        muscleMats.quads,
        [side * 0.038, -0.225, 0.032],
        [0, side * 0.25, side * -0.05]
      )
    );
    // Vasto medial ("gota" interior sobre la rodilla)
    topPivot.add(
      makeMesh(
        createMuscleBellGeometry(0.03, 0.082, 0.032, 0.72, 0.84),
        muscleMats.quads,
        [side * -0.028, -0.325, 0.038]
      )
    );

    // Isquiotibiales (-Z) y Aductor (cara interna)
    topPivot.add(
      makeMesh(
        createMuscleBellGeometry(0.046, 0.145, 0.034, 0.86, 0.66),
        muscleMats.hamstrings,
        [0, -0.22, -0.05]
      )
    );
    topPivot.add(
      makeMesh(
        createMuscleBellGeometry(0.032, 0.125, 0.032, 0.92, 0.48),
        muscleMats.adductors,
        [side * -0.042, -0.19, 0.008]
      )
    );

    const midPivot = new THREE.Group();
    midPivot.position.y = -LEG_UPPER;
    topPivot.add(midPivot);

    // Rodilla y rótula anatómica
    midPivot.add(makeMesh(createMuscleBellGeometry(0.052, 0.054, 0.054), tendonMat));
    midPivot.add(
      makeMesh(createMuscleBellGeometry(0.024, 0.026, 0.018), tendonMat, [0, 0.005, 0.048])
    );

    // Espinilla y tibial anterior
    const shinGeo = createSculptedLoftGeometry(
      [
        { y: -LEG_LOWER, rx: 0.034, rz: 0.036 },
        { y: -LEG_LOWER * 0.68, rx: 0.042, rz: 0.046 },
        { y: -LEG_LOWER * 0.34, rx: 0.052, rz: 0.056 },
        { y: 0.0, rx: 0.05, rz: 0.05 },
      ],
      18
    );
    midPivot.add(makeMesh(shinGeo, bodyMat));

    // Gemelo en diamante (2 cabezas: medial + lateral) + tendón de Aquiles
    midPivot.add(
      makeMesh(
        createMuscleBellGeometry(0.032, 0.095, 0.034, 0.72, 0.56),
        muscleMats.calves,
        [side * -0.016, -0.14, -0.038]
      )
    );
    midPivot.add(
      makeMesh(
        createMuscleBellGeometry(0.03, 0.088, 0.032, 0.72, 0.56),
        muscleMats.calves,
        [side * 0.018, -0.132, -0.036]
      )
    );
    midPivot.add(
      makeMesh(
        new THREE.CylinderGeometry(0.014, 0.011, 0.16, 10),
        tendonMat,
        [0, -0.295, -0.032]
      )
    );

    const endPivot = new THREE.Group();
    endPivot.position.y = -LEG_LOWER;
    midPivot.add(endPivot);

    // Tobillo y pie anatómico (la suela exacta queda a y = -0.044 para pisar plano sobre y = 0)
    endPivot.add(makeMesh(new THREE.SphereGeometry(0.036, 12, 10), tendonMat, [0, 0.004, 0]));

    const footGroup = new THREE.Group();
    endPivot.add(footGroup);

    // Empeine y talón anatómicos lisos
    footGroup.add(
      makeMesh(
        createMuscleBellGeometry(0.038, 0.03, 0.045),
        skinMat,
        [0, -0.016, -0.012]
      )
    );
    footGroup.add(
      makeMesh(
        createMuscleBellGeometry(0.042, 0.025, 0.082, 0.85, 0.9),
        skinMat,
        [0, -0.018, 0.056],
        [0.12, 0, 0]
      )
    );
    // Puntera plana tocando exactamente y = -0.044
    footGroup.add(
      makeMesh(
        createMuscleBellGeometry(0.043, 0.014, 0.048),
        skinMat,
        [0, -0.03, 0.118]
      )
    );
    // Suela de apoyo sutil en y = -0.044
    footGroup.add(
      makeMesh(
        new THREE.BoxGeometry(0.072, 0.008, 0.185),
        tendonMat,
        [0, -0.04, 0.045]
      )
    );

    return { topPivot, midPivot, endPivot, side, upperLen: LEG_UPPER, lowerLen: LEG_LOWER };
  };

  const leftArm = createArm(-1);
  leftArm.topPivot.position.set(-0.22, 0.24, 0);
  chestPivot.add(leftArm.topPivot);

  const rightArm = createArm(1);
  rightArm.topPivot.position.set(0.22, 0.24, 0);
  chestPivot.add(rightArm.topPivot);

  const leftLeg = createLeg(-1);
  leftLeg.topPivot.position.set(-0.105, -0.03, 0);
  pelvisPivot.add(leftLeg.topPivot);

  const rightLeg = createLeg(1);
  rightLeg.topPivot.position.set(0.105, -0.03, 0);
  pelvisPivot.add(rightLeg.topPivot);

  return {
    rootGroup,
    pelvisPivot,
    spinePivot,
    chestPivot,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    dispose: () => {
      for (const g of geometries) {
        g.dispose();
      }
    },
  };
}
