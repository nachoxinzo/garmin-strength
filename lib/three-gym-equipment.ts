import * as THREE from 'three';
import { CatalogExercise } from './exercise-catalog';

export type MachineRigType =
  | 'smith_flat_bench'
  | 'smith_incline_bench'
  | 'smith_shoulder_press'
  | 'smith_split_squat'
  | 'hack_squat'
  | 'leg_press'
  | 'leg_extension'
  | 'leg_curl_seated'
  | 'leg_curl_lying'
  | 'hip_machine'
  | 'calf_machine_standing'
  | 'calf_machine_seated'
  | 'pec_deck'
  | 'machine_row'
  | 'machine_lat_pulldown'
  | 'machine_lateral_raise'
  | 'cable_high_bar'
  | 'cable_high_pushdown'
  | 'cable_overhead_back'
  | 'cable_low_row'
  | 'cable_low_single'
  | 'cable_dual_crossover'
  | 'dip_station'
  | 'pullup_rig'
  | 'hip_thrust_bench'
  | 'preacher_bench'
  | 'roman_chair'
  | 'free_bench_flat'
  | 'free_bench_incline'
  | 'free_standing';

export interface RigUpdateContext {
  c: number;
  leftHand: THREE.Vector3;
  rightHand: THREE.Vector3;
  leftAnkle: THREE.Vector3;
  rightAnkle: THREE.Vector3;
  leftKnee: THREE.Vector3;
  rightKnee: THREE.Vector3;
  leftElbow: THREE.Vector3;
  rightElbow: THREE.Vector3;
  pelvis: THREE.Vector3;
  chest: THREE.Vector3;
  barCenter?: THREE.Vector3;
}

export interface GymRigResult {
  group: THREE.Group;
  rigType: MachineRigType;
  label: string;
  usesOwnBarbell: boolean;
  smithRailZ?: number;
  cameraPos: [number, number, number];
  cameraTarget: [number, number, number];
  update: (ctx: RigUpdateContext) => void;
}

const UP_Y = new THREE.Vector3(0, 1, 0);
const tmpDir = new THREE.Vector3();
const tmpMid = new THREE.Vector3();

/**
 * Orienta y escala un cilindro unitario (altura = 1 en el eje Y) exactamente entre los puntos A y B.
 */
function orientUnitCylinderBetween(
  mesh: THREE.Object3D,
  a: THREE.Vector3,
  b: THREE.Vector3,
  minLen = 0.005
) {
  tmpDir.subVectors(b, a);
  const dist = tmpDir.length();
  if (dist < minLen || !Number.isFinite(dist)) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  tmpMid.addVectors(a, b).multiplyScalar(0.5);
  mesh.position.copy(tmpMid);
  mesh.scale.set(1, dist, 1);
  tmpDir.divideScalar(dist);
  mesh.quaternion.setFromUnitVectors(UP_Y, tmpDir);
}

/**
 * Determina el aparato 3D específico que corresponde a cada ejercicio del catálogo.
 */
export function resolveMachineRig(exercise: CatalogExercise): MachineRigType {
  const id = exercise.id;
  const p = exercise.pattern;
  const garmin = (exercise.garminName || '').toUpperCase();

  // Multipower / Smith Machine explícitos
  if (id === 'chest_press_machine' || garmin === 'SMITH_MACHINE_BENCH_PRESS') {
    return 'smith_flat_bench';
  }
  if (id === 'incline_chest_press_machine' || garmin === 'INCLINE_SMITH_MACHINE_BENCH_PRESS') {
    return 'smith_incline_bench';
  }
  if (id === 'shoulder_press_machine' || garmin === 'SMITH_MACHINE_OVERHEAD_PRESS') {
    return 'smith_shoulder_press';
  }
  if (id === 'barbell_bulgarian_split_squat') {
    return 'smith_split_squat';
  }

  // Máquinas de piernas y tren inferior
  if (id === 'hack_squat_machine') return 'hack_squat';
  if (id === 'leg_press') return 'leg_press';
  if (id === 'leg_extension_machine') return 'leg_extension';
  if (id === 'seated_leg_curl_machine') return 'leg_curl_seated';
  if (id === 'leg_curl_machine') return 'leg_curl_lying';
  if (id === 'hip_abduction_machine' || id === 'hip_adduction_machine') return 'hip_machine';
  if (id === 'calf_raise_standing') return 'calf_machine_standing';
  if (id === 'calf_raise_seated') return 'calf_machine_seated';

  // Máquinas guiadas de tren superior
  if (id === 'pec_deck_machine' || id === 'rear_delt_fly_machine') return 'pec_deck';
  if (id === 'machine_row') return 'machine_row';
  if (id === 'lat_pulldown_machine') return 'machine_lat_pulldown';
  if (id === 'lateral_raise_machine') return 'machine_lateral_raise';

  // Fondos en paralelas
  if (id === 'dips_chest' || id === 'triceps_dip_weighted') return 'dip_station';

  // Bancos específicos (Hip Thrust, Scott, Silla Romana)
  if (id === 'hip_thrust_barbell') return 'hip_thrust_bench';
  if (id === 'preacher_curl_ez_bar' || id === 'preacher_curl_dumbbell') return 'preacher_bench';
  if (id === 'back_extension') return 'roman_chair';
  if (id === 'chest_supported_dumbbell_row') return 'free_bench_incline';

  // Estaciones de poleas
  if (exercise.equipment === 'Polea') {
    if (
      id === 'cable_crossover_chest' ||
      id === 'cable_chest_press' ||
      id === 'rear_delt_fly_cable'
    ) {
      return 'cable_dual_crossover';
    }
    if (id === 'straight_arm_pulldown') {
      return 'cable_high_pushdown';
    }
    if (id.includes('lat_pulldown')) {
      return 'cable_high_bar';
    }
    if (id === 'triceps_overhead_cable') {
      return 'cable_overhead_back';
    }
    if (id.startsWith('triceps_') || id === 'face_pull' || id === 'cable_crunch') {
      return 'cable_high_pushdown';
    }
    if (p === 'Tracción Horizontal' || id.includes('cable_row')) {
      return 'cable_low_row';
    }
    return 'cable_low_single';
  }

  // Peso libre y calistenia
  if ((p === 'Tracción Vertical' && !id.includes('lat_pulldown')) || id.includes('hanging')) {
    return 'pullup_rig';
  }
  if (p === 'Empuje Inclinado' || id === 'incline_dumbbell_curl') {
    return 'free_bench_incline';
  }
  if (
    (p === 'Empuje Horizontal' && !id.includes('push_up') && !id.includes('dip')) ||
    (p === 'Aislamiento Pectoral' && id.includes('fly')) ||
    id === 'skull_crusher_barbell'
  ) {
    return 'free_bench_flat';
  }

  return 'free_standing';
}

export function buildGymEquipmentRig(
  rigType: MachineRigType,
  exercise: CatalogExercise
): GymRigResult {
  const group = new THREE.Group();
  const id = exercise.id;
  const updaters: Array<(ctx: RigUpdateContext) => void> = [];

  // Materiales de estudio con alto contraste sobre fondo #0f172a
  const frameMat = new THREE.MeshStandardMaterial({
    color: '#334155',
    roughness: 0.42,
    metalness: 0.55,
  });
  const frameLightMat = new THREE.MeshStandardMaterial({
    color: '#475569',
    roughness: 0.38,
    metalness: 0.6,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    roughness: 0.2,
    metalness: 0.85,
  });
  const padMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.72,
    metalness: 0.15,
  });
  const plateMat = new THREE.MeshStandardMaterial({
    color: '#2563eb',
    roughness: 0.35,
    metalness: 0.32,
  });
  const plateTrimMat = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    roughness: 0.3,
    metalness: 0.4,
  });
  const stackBlockMat = new THREE.MeshStandardMaterial({
    color: '#475569',
    roughness: 0.45,
    metalness: 0.45,
  });
  const activeStackMat = new THREE.MeshStandardMaterial({
    color: '#0ea5e9',
    emissive: new THREE.Color('#0284c7'),
    emissiveIntensity: 0.25,
    roughness: 0.35,
    metalness: 0.4,
  });
  const cableMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.25,
    metalness: 0.85,
  });
  const gripMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.85,
    metalness: 0.1,
  });

  const addBox = (
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    rx = 0,
    ry = 0,
    rz = 0
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    if (rx || ry || rz) mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const addPlatePair = (
    parent: THREE.Object3D,
    xOffset: number,
    y = 0,
    z = 0,
    radius = 0.16,
    thickness = 0.042
  ) => {
    [-1, 1].forEach((side) => {
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, thickness, 22),
        plateMat
      );
      plate.rotation.z = Math.PI / 2;
      plate.position.set(side * xOffset, y, z);
      plate.castShadow = true;
      parent.add(plate);

      const trim = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.42, radius * 0.42, thickness + 0.008, 16),
        plateTrimMat
      );
      trim.rotation.z = Math.PI / 2;
      trim.position.set(side * xOffset, y, z);
      parent.add(trim);
    });
  };

  const addWeightStackTower = (x: number, z: number, height = 2.05) => {
    const tower = new THREE.Group();
    tower.position.set(x, 0, z);
    group.add(tower);

    // Base y columnas
    addBox(tower, 0.42, 0.06, 0.44, 0, 0.03, 0, frameMat);
    addBox(tower, 0.06, height, 0.07, -0.17, height / 2, 0, frameMat);
    addBox(tower, 0.06, height, 0.07, 0.17, height / 2, 0, frameMat);
    addBox(tower, 0.42, 0.07, 0.16, 0, height, 0, frameMat);

    // Barras guía cromadas
    [-0.08, 0.08].forEach((rx) => {
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.011, 0.011, height - 0.12, 10),
        chromeMat
      );
      rod.position.set(rx, height / 2, 0);
      tower.add(rod);
    });

    // Bloque fijo inferior
    for (let i = 0; i < 4; i++) {
      addBox(tower, 0.24, 0.045, 0.12, 0, 0.12 + i * 0.055, 0, stackBlockMat);
    }

    // Bloque móvil activo (sube cuando c -> 1)
    const movingStack = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      addBox(
        movingStack,
        0.24,
        0.045,
        0.12,
        0,
        i * 0.055,
        0,
        i === 5 ? activeStackMat : stackBlockMat
      );
    }
    const baseStackY = 0.36;
    movingStack.position.set(0, baseStackY, 0);
    tower.add(movingStack);

    updaters.push(({ c }) => {
      movingStack.position.y = baseStackY + c * 0.42;
    });

    return tower;
  };

  const addFlatBench = (zCenter = -0.05) => {
    addBox(group, 0.34, 0.075, 1.18, 0, 0.42, zCenter, padMat);
    addBox(group, 0.07, 0.39, 0.07, 0, 0.195, zCenter - 0.44, frameMat);
    addBox(group, 0.07, 0.39, 0.07, 0, 0.195, zCenter + 0.44, frameMat);
    addBox(group, 0.42, 0.04, 0.08, 0, 0.02, zCenter - 0.44, frameMat);
    addBox(group, 0.42, 0.04, 0.08, 0, 0.02, zCenter + 0.44, frameMat);
  };

  const addInclineBench = (zSeat = 0.2) => {
    addBox(group, 0.34, 0.07, 0.38, 0, 0.44, zSeat, padMat);
    addBox(group, 0.34, 0.07, 0.82, 0, 0.72, zSeat - 0.38, padMat, 0.76);
    addBox(group, 0.07, 0.44, 0.07, 0, 0.22, zSeat + 0.04, frameMat);
    addBox(group, 0.07, 0.62, 0.07, 0, 0.31, zSeat - 0.42, frameMat);
    addBox(group, 0.42, 0.04, 0.92, 0, 0.02, zSeat - 0.16, frameMat);
  };

  const addUprightBench = (zSeat = 0.04) => {
    addBox(group, 0.36, 0.075, 0.42, 0, 0.48, zSeat, padMat);
    addBox(group, 0.32, 0.62, 0.075, 0, 0.84, zSeat - 0.22, padMat, -0.1);
    addBox(group, 0.07, 0.46, 0.07, 0, 0.23, zSeat, frameMat);
    addBox(group, 0.42, 0.04, 0.54, 0, 0.02, zSeat - 0.06, frameMat);
  };

  const createDynamicCable = (anchorWorld: THREE.Vector3) => {
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.007, 1, 8),
      cableMat
    );
    group.add(cable);
    return (target: THREE.Vector3) => orientUnitCylinderBetween(cable, anchorWorld, target);
  };

  let label: string = exercise.equipment;
  let usesOwnBarbell = false;
  let smithRailZ: number | undefined;
  let cameraPos: [number, number, number] = [2.25, 1.75, 2.65];
  let cameraTarget: [number, number, number] = [0, 0.9, 0];

  // ============================================================================
  // 1. MULTIPOWER / SMITH MACHINE
  // ============================================================================
  if (
    rigType === 'smith_flat_bench' ||
    rigType === 'smith_incline_bench' ||
    rigType === 'smith_shoulder_press' ||
    rigType === 'smith_split_squat'
  ) {
    usesOwnBarbell = true;
    label = 'Multipower · Barra guiada';
    cameraPos = [2.5, 1.9, 2.85];
    cameraTarget = [0, 1.0, -0.1];

    const railX = 0.66;
    const railZ =
      rigType === 'smith_flat_bench'
        ? -0.26
        : rigType === 'smith_incline_bench'
        ? -0.15
        : rigType === 'smith_shoulder_press'
        ? 0.14
        : -0.06;
    smithRailZ = railZ;
    const frameRearZ = railZ - 0.36;
    const frameHeight = 2.15;

    // Patas horizontales en base
    [-railX, railX].forEach((x) => {
      addBox(group, 0.08, 0.06, 1.25, x, 0.03, railZ - 0.05, frameMat);
      // Poste estructural trasero
      addBox(group, 0.075, frameHeight, 0.075, x, frameHeight / 2, frameRearZ, frameMat);
      // Brazo superior conectando poste trasero con guía cromada
      addBox(group, 0.07, 0.07, 0.44, x, frameHeight - 0.035, (railZ + frameRearZ) / 2, frameMat);
      // Barra guía vertical cromada por donde desliza la barra
      const guideRail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, frameHeight - 0.08, 14),
        chromeMat
      );
      guideRail.position.set(x, frameHeight / 2, railZ);
      guideRail.castShadow = true;
      group.add(guideRail);

      // Topes inferiores de seguridad
      addBox(group, 0.09, 0.09, 0.14, x, 0.56, railZ, plateTrimMat);
    });

    // Travesaño superior e inferior trasero
    addBox(group, railX * 2 + 0.08, 0.08, 0.08, 0, frameHeight - 0.04, frameRearZ, frameMat);
    addBox(group, railX * 2 + 0.08, 0.06, 0.06, 0, 0.08, frameRearZ, frameMat);

    // Banco o soporte trasero según el ejercicio
    if (rigType === 'smith_flat_bench') {
      addFlatBench(0.02);
    } else if (rigType === 'smith_incline_bench') {
      addInclineBench(0.2);
    } else if (rigType === 'smith_shoulder_press') {
      addUprightBench(0.04);
    } else if (rigType === 'smith_split_squat') {
      // Rodillo acolchado trasero para apoyar el empeine en búlgara
      addBox(group, 0.46, 0.05, 0.32, 0, 0.025, -0.56, frameMat);
      addBox(group, 0.06, 0.4, 0.06, 0, 0.22, -0.56, frameMat);
      const rearPad = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.42, 16), padMat);
      rearPad.rotation.z = Math.PI / 2;
      rearPad.position.set(0, 0.42, -0.56);
      group.add(rearPad);
    }

    // Barra Olímpica Guiada + Casquillos lineales + Discos en X = ±railX
    const guidedBar = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.017, 0.017, 1.82, 14),
      chromeMat
    );
    shaft.rotation.z = Math.PI / 2;
    shaft.castShadow = true;
    guidedBar.add(shaft);

    // Casquillos lineales que abrazan las guías cromadas en ±railX
    [-railX, railX].forEach((x) => {
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.14, 14), frameLightMat);
      sleeve.position.set(x, 0, 0);
      guidedBar.add(sleeve);
    });

    addPlatePair(guidedBar, 0.8, 0, 0, 0.17, 0.044);
    guidedBar.position.set(0, 1.0, railZ);
    group.add(guidedBar);

    updaters.push(({ leftHand, rightHand, barCenter }) => {
      const targetY = barCenter ? barCenter.y : (leftHand.y + rightHand.y) * 0.5;
      guidedBar.position.y = Math.max(0.58, Math.min(2.05, targetY));
    });
  }

  // ============================================================================
  // 2. SENTADILLA HACK EN MÁQUINA (CARRO MÓVIL 45°)
  // ============================================================================
  else if (rigType === 'hack_squat') {
    label = 'Sentadilla Hack 45° · Carro móvil';
    cameraPos = [2.6, 1.85, 2.55];
    cameraTarget = [0, 0.9, 0.1];

    // Base horizontal y plataforma de pies inclinada delante (+Z)
    addBox(group, 0.96, 0.06, 1.55, 0, 0.03, 0.05, frameMat);
    addBox(group, 0.72, 0.05, 0.58, 0, 0.15, 0.45, frameLightMat, -0.35);

    // Guías inclinadas 40° (suben hacia -Z)
    const railSlopeAngle = -0.62;
    [-0.3, 0.3].forEach((rx) => {
      const rail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 1.85, 12),
        chromeMat
      );
      rail.position.set(rx, 0.9, 0.02);
      rail.rotation.x = railSlopeAngle;
      rail.castShadow = true;
      group.add(rail);
    });
    // Soporte trasero para los raíles
    [-0.3, 0.3].forEach((rx) => {
      addBox(group, 0.06, 1.55, 0.06, rx, 0.78, -0.58, frameMat);
    });
    addBox(group, 0.68, 0.07, 0.08, 0, 1.58, -0.55, frameMat);

    // Carro móvil con respaldo acolchado + hombreras + discos laterales
    const sled = new THREE.Group();
    sled.rotation.x = railSlopeAngle;
    addBox(sled, 0.46, 0.85, 0.09, 0, 0.05, -0.04, padMat);
    // Hombreras acolchadas
    [-0.2, 0.2].forEach((sx) => {
      addBox(sled, 0.13, 0.24, 0.28, sx, 0.36, 0.14, padMat);
      // Agarres laterales
      addBox(sled, 0.03, 0.18, 0.03, sx * 1.35, 0.18, 0.2, gripMat);
    });
    // Soportes de carga laterales con discos azules
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.04, 12), chromeMat);
    horn.rotation.z = Math.PI / 2;
    horn.position.set(0, -0.05, -0.05);
    sled.add(horn);
    addPlatePair(sled, 0.44, -0.05, -0.05, 0.17, 0.044);

    group.add(sled);

    updaters.push(({ c }) => {
      // Desliza hacia abajo (+Z, -Y) cuando c -> 1 (flexión profunda)
      const slide = c * 0.38;
      sled.position.set(0, 1.07 - slide * 0.81, -0.21 + slide * 0.58);
    });
  }

  // ============================================================================
  // 3. PRENSA DE PIERNAS INCLINADA 45° (LEG PRESS)
  // ============================================================================
  else if (rigType === 'leg_press') {
    label = 'Prensa Inclinada 45° · Plataforma móvil';
    cameraPos = [2.65, 1.8, 2.45];
    cameraTarget = [0, 0.85, 0.15];

    // Bastidor inferior
    addBox(group, 0.88, 0.06, 1.85, 0, 0.03, 0.1, frameMat);
    // Asiento reclinado y respaldo atrás (-Z)
    addBox(group, 0.44, 0.08, 0.46, 0, 0.38, -0.3, padMat, 0.2);
    addBox(group, 0.42, 0.68, 0.09, 0, 0.64, -0.66, padMat, -0.85);
    addBox(group, 0.07, 0.55, 0.07, 0, 0.28, -0.58, frameMat);
    // Asideros laterales del asiento
    [-0.26, 0.26].forEach((gx) => {
      addBox(group, 0.035, 0.24, 0.035, gx, 0.48, -0.32, gripMat);
    });

    // Torres delanteras y raíles a 45° (+Z, +Y)
    [-0.34, 0.34].forEach((rx) => {
      addBox(group, 0.07, 1.48, 0.07, rx, 0.74, 0.92, frameMat);
      const rail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 1.55, 12),
        chromeMat
      );
      rail.position.set(rx, 0.86, 0.48);
      rail.rotation.x = 0.78;
      group.add(rail);
    });
    addBox(group, 0.76, 0.07, 0.08, 0, 1.46, 0.92, frameMat);

    // Carro/plataforma móvil que sigue exactamente los pies
    const plateSled = new THREE.Group();
    addBox(plateSled, 0.68, 0.52, 0.06, 0, 0, 0, frameLightMat, -0.62);
    const weightBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 1.08, 12),
      chromeMat
    );
    weightBar.rotation.z = Math.PI / 2;
    weightBar.position.set(0, 0.1, 0.08);
    plateSled.add(weightBar);
    addPlatePair(plateSled, 0.46, 0.1, 0.08, 0.16, 0.044);
    group.add(plateSled);

    updaters.push(({ leftAnkle, rightAnkle }) => {
      tmpMid.addVectors(leftAnkle, rightAnkle).multiplyScalar(0.5);
      plateSled.position.set(0, tmpMid.y + 0.04, tmpMid.z + 0.08);
    });
  }

  // ============================================================================
  // 4. EXTENSIÓN DE CUÁDRICEPS / CURL FEMORAL SENTADO
  // ============================================================================
  else if (rigType === 'leg_extension' || rigType === 'leg_curl_seated') {
    label =
      rigType === 'leg_extension'
        ? 'Máquina Extensión Cuádriceps · Brazo articulado'
        : 'Máquina Curl Femoral Sentado · Rodillo activo';
    cameraPos = [2.45, 1.65, 2.35];
    cameraTarget = [0, 0.75, 0.1];

    addUprightBench(0.02);
    // Agarres laterales junto al asiento
    [-0.26, 0.26].forEach((gx) => {
      addBox(group, 0.035, 0.04, 0.34, gx, 0.54, 0.02, gripMat);
    });

    // Torre lateral de placas (en X = -0.68)
    addWeightStackTower(-0.68, 0.08, 1.58);
    addBox(group, 0.68, 0.05, 0.08, -0.34, 0.025, 0.08, frameMat);

    // Eje de giro alineado con las rodillas (~ y=0.54, z=0.43)
    const pivot = new THREE.Vector3(0, 0.54, 0.43);
    const pivotCam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.36, 16),
      chromeMat
    );
    pivotCam.rotation.z = Math.PI / 2;
    pivotCam.position.copy(pivot);
    group.add(pivotCam);

    // Brazo de palanca dinámico y rodillo acolchado en los tobillos
    const leverArm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 12), chromeMat);
    group.add(leverArm);

    const ankleRoller = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.068, 0.46, 18),
      padMat
    );
    ankleRoller.rotation.z = Math.PI / 2;
    ankleRoller.castShadow = true;
    group.add(ankleRoller);

    // Rodillo superior sobre muslos en curl femoral sentado
    if (rigType === 'leg_curl_seated') {
      const thighPad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.072, 0.072, 0.46, 18),
        padMat
      );
      thighPad.rotation.z = Math.PI / 2;
      thighPad.position.set(0, 0.7, 0.16);
      group.add(thighPad);
      addBox(group, 0.05, 0.25, 0.05, 0.22, 0.58, 0.16, chromeMat);
    }

    updaters.push(({ leftAnkle, rightAnkle }) => {
      tmpMid.addVectors(leftAnkle, rightAnkle).multiplyScalar(0.5);
      const rollerOffsetZ = rigType === 'leg_extension' ? 0.065 : -0.055;
      const targetPos = new THREE.Vector3(0, tmpMid.y + 0.03, tmpMid.z + rollerOffsetZ);
      ankleRoller.position.copy(targetPos);
      orientUnitCylinderBetween(leverArm, pivot, targetPos);
    });
  }

  // ============================================================================
  // 5. CURL FEMORAL TUMBADO EN MÁQUINA
  // ============================================================================
  else if (rigType === 'leg_curl_lying') {
    label = 'Máquina Curl Femoral Tumbado';
    cameraPos = [2.45, 1.55, 2.35];
    cameraTarget = [0, 0.65, 0.05];

    // Banco angulado (torso hacia +Z, piernas hacia -Z)
    addBox(group, 0.4, 0.08, 0.68, 0, 0.52, 0.22, padMat, -0.14);
    addBox(group, 0.4, 0.08, 0.54, 0, 0.5, -0.34, padMat, 0.12);
    addBox(group, 0.07, 0.48, 0.07, 0, 0.24, 0.35, frameMat);
    addBox(group, 0.07, 0.48, 0.07, 0, 0.24, -0.38, frameMat);
    addBox(group, 0.46, 0.04, 0.92, 0, 0.02, 0, frameMat);
    // Agarres delanteros
    [-0.24, 0.24].forEach((gx) => {
      addBox(group, 0.032, 0.22, 0.032, gx, 0.42, 0.56, gripMat);
    });

    addWeightStackTower(-0.68, -0.1, 1.5);
    addBox(group, 0.68, 0.05, 0.08, -0.34, 0.025, -0.1, frameMat);

    const pivot = new THREE.Vector3(0, 0.52, -0.42);
    const pivotCam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.36, 16),
      chromeMat
    );
    pivotCam.rotation.z = Math.PI / 2;
    pivotCam.position.copy(pivot);
    group.add(pivotCam);

    const leverArm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 12), chromeMat);
    group.add(leverArm);

    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.46, 18), padMat);
    roller.rotation.z = Math.PI / 2;
    group.add(roller);

    updaters.push(({ leftAnkle, rightAnkle }) => {
      tmpMid.addVectors(leftAnkle, rightAnkle).multiplyScalar(0.5);
      const rollerPos = new THREE.Vector3(0, tmpMid.y + 0.05, tmpMid.z - 0.05);
      roller.position.copy(rollerPos);
      orientUnitCylinderBetween(leverArm, pivot, rollerPos);
    });
  }

  // ============================================================================
  // 6. ABDUCCIÓN / ADUCCIÓN DE CADERA EN MÁQUINA
  // ============================================================================
  else if (rigType === 'hip_machine') {
    label = 'Máquina Abducción / Aducción de Cadera';
    cameraPos = [2.25, 1.7, 2.5];
    cameraTarget = [0, 0.72, 0.1];

    addUprightBench(0.02);
    addWeightStackTower(0, 0.92, 1.6);
    addBox(group, 0.08, 0.05, 0.92, 0, 0.025, 0.46, frameMat);

    // Brazos articulados bilaterales con almohadillas para muslos/rodillas
    const leftSwing = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 10), chromeMat);
    const rightSwing = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 10), chromeMat);
    group.add(leftSwing, rightSwing);

    const createThighPad = () => addBox(group, 0.08, 0.24, 0.22, 0, 0.56, 0.3, padMat);
    const leftPad = createThighPad();
    const rightPad = createThighPad();

    const hipAnchorL = new THREE.Vector3(-0.12, 0.46, 0.02);
    const hipAnchorR = new THREE.Vector3(0.12, 0.46, 0.02);

    updaters.push(({ leftKnee, rightKnee }) => {
      const sideSign = id.includes('abduction') ? -1 : 1;
      leftPad.position.set(leftKnee.x + sideSign * 0.075, leftKnee.y + 0.02, leftKnee.z);
      rightPad.position.set(rightKnee.x - sideSign * 0.075, rightKnee.y + 0.02, rightKnee.z);
      orientUnitCylinderBetween(leftSwing, hipAnchorL, leftPad.position);
      orientUnitCylinderBetween(rightSwing, hipAnchorR, rightPad.position);
    });
  }

  // ============================================================================
  // 7. MÁQUINAS DE GEMELOS (DE PIE Y SENTADO)
  // ============================================================================
  else if (rigType === 'calf_machine_standing' || rigType === 'calf_machine_seated') {
    label =
      rigType === 'calf_machine_standing'
        ? 'Máquina de Gemelos de Pie'
        : 'Máquina de Gemelos Sentado (Sóleo)';

    if (rigType === 'calf_machine_standing') {
      addWeightStackTower(0, 0.72, 1.95);
      addBox(group, 0.52, 0.09, 0.24, 0, 0.045, 0.05, frameLightMat); // Escalón para punteras
      const shoulderCarriage = new THREE.Group();
      [-0.18, 0.18].forEach((sx) => {
        addBox(shoulderCarriage, 0.12, 0.12, 0.34, sx, 0, 0.04, padMat);
      });
      addBox(shoulderCarriage, 0.44, 0.06, 0.52, 0, 0.08, 0.36, frameMat);
      group.add(shoulderCarriage);

      updaters.push(({ chest }) => {
        shoulderCarriage.position.set(0, chest.y + 0.28, 0.02);
      });
    } else {
      addUprightBench(-0.04);
      addBox(group, 0.44, 0.08, 0.22, 0, 0.04, 0.34, frameLightMat);
      const lever = new THREE.Group();
      lever.position.set(0, 0.65, -0.05);
      addBox(lever, 0.46, 0.1, 0.22, 0, 0.05, 0.34, padMat);
      addBox(lever, 0.05, 0.06, 0.56, 0, 0.04, 0.34, frameMat);
      const weightPin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.75, 12),
        chromeMat
      );
      weightPin.rotation.z = Math.PI / 2;
      weightPin.position.set(0, 0.05, 0.64);
      lever.add(weightPin);
      addPlatePair(lever, 0.3, 0.05, 0.64, 0.14, 0.04);
      group.add(lever);

      updaters.push(({ c }) => {
        lever.rotation.x = -c * 0.14;
      });
    }
  }

  // ============================================================================
  // 8. CONTRACTOR / PEC DECK / DELTOIDES POSTERIOR EN MÁQUINA
  // ============================================================================
  else if (rigType === 'pec_deck') {
    label = 'Contractor / Pec Deck en Máquina';
    cameraPos = [2.45, 1.8, 2.5];
    cameraTarget = [0, 1.0, 0];

    addUprightBench(0.02);
    addWeightStackTower(0, -0.68, 2.1);
    addBox(group, 0.08, 0.05, 0.72, 0, 0.025, -0.34, frameMat);
    // Brazo superior hasta eje sobre la cabeza
    addBox(group, 0.09, 0.08, 0.72, 0, 2.06, -0.34, frameMat);
    addBox(group, 0.98, 0.07, 0.09, 0, 2.06, 0.02, frameMat);

    const topL = new THREE.Vector3(-0.46, 2.04, 0.02);
    const topR = new THREE.Vector3(0.46, 2.04, 0.02);

    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 10), chromeMat);
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 10), chromeMat);
    group.add(armL, armR);

    const handleL = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 10), gripMat);
    const handleR = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 10), gripMat);
    group.add(handleL, handleR);

    updaters.push(({ leftHand, rightHand }) => {
      handleL.position.copy(leftHand);
      handleR.position.copy(rightHand);
      const upperL = new THREE.Vector3(leftHand.x, leftHand.y + 0.11, leftHand.z);
      const upperR = new THREE.Vector3(rightHand.x, rightHand.y + 0.11, rightHand.z);
      orientUnitCylinderBetween(armL, topL, upperL);
      orientUnitCylinderBetween(armR, topR, upperR);
    });
  }

  // ============================================================================
  // 9. REMO SENTADO EN MÁQUINA ISO-LATERAL
  // ============================================================================
  else if (rigType === 'machine_row') {
    label = 'Máquina Remo Iso-Lateral con Apoyo';
    cameraPos = [2.45, 1.75, 2.45];
    cameraTarget = [0, 0.92, 0.2];

    // Asiento sin respaldo trasero para permitir apoyo frontal en pecho
    addBox(group, 0.36, 0.075, 0.42, 0, 0.48, 0.0, padMat);
    addBox(group, 0.07, 0.46, 0.07, 0, 0.23, 0.0, frameMat);
    addBox(group, 0.42, 0.04, 0.54, 0, 0.02, 0.0, frameMat);
    // Almohadilla frontal de apoyo de pecho pegada al torso
    addBox(group, 0.3, 0.34, 0.09, 0, 1.05, 0.16, padMat, 0.12);
    addBox(group, 0.07, 0.9, 0.07, 0, 0.45, 0.18, frameMat);
    addWeightStackTower(0, 0.88, 1.85);
    addBox(group, 0.08, 0.05, 0.88, 0, 0.025, 0.44, frameMat);

    const pivotL = new THREE.Vector3(-0.32, 1.62, 0.72);
    const pivotR = new THREE.Vector3(0.32, 1.62, 0.72);
    const leverL = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 10), chromeMat);
    const leverR = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 10), chromeMat);
    const gripL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 10), gripMat);
    const gripR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 10), gripMat);
    group.add(leverL, leverR, gripL, gripR);

    updaters.push(({ leftHand, rightHand }) => {
      gripL.position.copy(leftHand);
      gripR.position.copy(rightHand);
      orientUnitCylinderBetween(leverL, pivotL, leftHand);
      orientUnitCylinderBetween(leverR, pivotR, rightHand);
    });
  }

  // ============================================================================
  // 10. JALÓN VERTICAL EN MÁQUINA DIVERGENTE / ISO-LATERAL
  // ============================================================================
  else if (rigType === 'machine_lat_pulldown') {
    label = 'Máquina Jalón Divergente · Brazos Iso-Laterales';
    cameraPos = [2.5, 1.9, 2.65];
    cameraTarget = [0, 1.08, 0.1];

    addUprightBench(0.0);
    // Rodillo sujeción de muslos
    const kneeRoller = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.44, 16), padMat);
    kneeRoller.rotation.z = Math.PI / 2;
    kneeRoller.position.set(0, 0.68, 0.24);
    group.add(kneeRoller);
    addBox(group, 0.06, 0.42, 0.06, 0, 0.47, 0.24, frameMat);

    addWeightStackTower(0, 0.78, 2.15);
    addBox(group, 0.08, 0.05, 0.85, 0, 0.025, 0.39, frameMat);

    const pivotL = new THREE.Vector3(-0.34, 1.95, 0.52);
    const pivotR = new THREE.Vector3(0.34, 1.95, 0.52);
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 10), chromeMat);
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 10), chromeMat);
    const gripL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 10), gripMat);
    const gripR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 10), gripMat);
    group.add(armL, armR, gripL, gripR);

    updaters.push(({ leftHand, rightHand }) => {
      gripL.position.copy(leftHand);
      gripR.position.copy(rightHand);
      orientUnitCylinderBetween(armL, pivotL, leftHand);
      orientUnitCylinderBetween(armR, pivotR, rightHand);
    });
  }

  // ============================================================================
  // 11. ELEVACIONES LATERALES EN MÁQUINA
  // ============================================================================
  else if (rigType === 'machine_lateral_raise') {
    label = 'Máquina Elevaciones Laterales';
    cameraPos = [2.35, 1.8, 2.5];
    cameraTarget = [0, 0.95, 0];

    addUprightBench(0.02);
    addWeightStackTower(0, -0.64, 1.75);
    addBox(group, 0.08, 0.05, 0.68, 0, 0.025, -0.32, frameMat);

    const pivotL = new THREE.Vector3(-0.24, 1.15, -0.18);
    const pivotR = new THREE.Vector3(0.24, 1.15, -0.18);
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 10), chromeMat);
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 10), chromeMat);
    const padL = addBox(group, 0.08, 0.16, 0.14, -0.45, 1.0, 0.04, padMat);
    const padR = addBox(group, 0.08, 0.16, 0.14, 0.45, 1.0, 0.04, padMat);
    group.add(armL, armR);

    updaters.push(({ leftElbow, rightElbow }) => {
      padL.position.set(leftElbow.x - 0.04, leftElbow.y, leftElbow.z);
      padR.position.set(rightElbow.x + 0.04, rightElbow.y, rightElbow.z);
      orientUnitCylinderBetween(armL, pivotL, padL.position);
      orientUnitCylinderBetween(armR, pivotR, padR.position);
    });
  }

  // ============================================================================
  // 12. ESTACIONES DE POLEAS CON CABLES DINÁMICOS EN TIEMPO REAL
  // ============================================================================
  else if (
    rigType === 'cable_high_bar' ||
    rigType === 'cable_high_pushdown' ||
    rigType === 'cable_overhead_back' ||
    rigType === 'cable_low_row' ||
    rigType === 'cable_low_single'
  ) {
    const isPullThrough = id === 'cable_pull_through';
    const isWoodchopper = id === 'cable_woodchopper';
    const towerX = isWoodchopper ? -0.95 : 0;
    const towerZ = isWoodchopper
      ? 0.15
      : isPullThrough
      ? -0.92
      : rigType === 'cable_overhead_back'
      ? -0.82
      : 0.92;
    const isLow = rigType === 'cable_low_row' || rigType === 'cable_low_single';
    const pulleyY = isWoodchopper
      ? 0.55
      : isPullThrough
      ? 0.28
      : isLow
      ? rigType === 'cable_low_row'
        ? 0.55
        : 0.25
      : 2.1;
    const pulleyX = isWoodchopper ? -0.75 : 0;
    const pulleyZ = isWoodchopper
      ? towerZ
      : isPullThrough || rigType === 'cable_overhead_back'
      ? towerZ + 0.2
      : towerZ - 0.2;
    const pulleyWorld = new THREE.Vector3(pulleyX, pulleyY, pulleyZ);

    label = isLow
      ? 'Torre de Polea Baja · Cable activo'
      : 'Torre de Polea Alta · Cable activo';
    cameraPos = [2.5, 1.85, 2.7];
    cameraTarget = [
      0,
      1.0,
      isPullThrough || rigType === 'cable_overhead_back' ? -0.2 : isWoodchopper ? 0.05 : 0.2,
    ];

    addWeightStackTower(towerX, towerZ, 2.2);

    // Brazo superior con polea / polea inferior o lateral
    if (!isLow) {
      addBox(group, 0.08, 0.08, 0.42, towerX, 2.16, (towerZ + pulleyZ) / 2, frameMat);
    } else if (isWoodchopper) {
      addBox(group, 0.28, 0.07, 0.07, (towerX + pulleyX) / 2, pulleyY, towerZ, frameMat);
    }
    const pulleyWheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.04, 18),
      plateTrimMat
    );
    pulleyWheel.rotation.z = Math.PI / 2;
    pulleyWheel.position.copy(pulleyWorld);
    group.add(pulleyWheel);

    if (rigType === 'cable_high_bar' || rigType === 'cable_low_row') {
      // Banco de jalón / remo sentado
      addBox(group, 0.38, 0.08, 0.56, 0, 0.48, 0.02, padMat);
      addBox(group, 0.08, 0.46, 0.08, 0, 0.23, 0.02, frameMat);
      addBox(group, 0.08, 0.05, 0.95, 0, 0.025, 0.45, frameMat);
      if (rigType === 'cable_high_bar') {
        const kneePad = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.42, 16), padMat);
        kneePad.rotation.z = Math.PI / 2;
        kneePad.position.set(0, 0.68, 0.25);
        group.add(kneePad);
        addBox(group, 0.05, 0.44, 0.05, 0, 0.46, 0.25, frameMat);
      } else {
        // Apoya pies metálico en remo Gironda
        addBox(group, 0.44, 0.26, 0.05, 0, 0.28, 0.62, frameLightMat, -0.3);
      }
    }

    const updateCable = createDynamicCable(pulleyWorld);

    // Accesorio de agarre (Barra ancha o Cuerda/Triángulo)
    const isWideBar =
      rigType === 'cable_high_bar' ||
      id === 'straight_arm_pulldown' ||
      id === 'triceps_pushdown_cable' ||
      id === 'cable_biceps_curl' ||
      id === 'wide_grip_cable_row';

    if (isWideBar) {
      const barWidth =
        rigType === 'cable_high_bar' ? 0.92 : id === 'straight_arm_pulldown' ? 0.68 : 0.48;
      const barMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, barWidth, 12),
        chromeMat
      );
      barMesh.rotation.z = Math.PI / 2;
      group.add(barMesh);

      updaters.push(({ leftHand, rightHand }) => {
        tmpMid.addVectors(leftHand, rightHand).multiplyScalar(0.5);
        barMesh.position.copy(tmpMid);
        updateCable(tmpMid);
      });
    } else {
      // Cuerda / doble asa unida a un anillo central
      const ring = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 12), chromeMat);
      const ropeL = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 10), gripMat);
      const ropeR = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 10), gripMat);
      group.add(ring, ropeL, ropeR);

      updaters.push(({ leftHand, rightHand }) => {
        tmpMid.addVectors(leftHand, rightHand).multiplyScalar(0.5);
        const dirToPulley = new THREE.Vector3().subVectors(pulleyWorld, tmpMid).normalize();
        const apex = tmpMid.clone().addScaledVector(dirToPulley, 0.14);
        ring.position.copy(apex);
        orientUnitCylinderBetween(ropeL, apex, leftHand);
        orientUnitCylinderBetween(ropeR, apex, rightHand);
        updateCable(apex);
      });
    }
  }

  // ============================================================================
  // 13. CRUCE DE POLEAS DUAL (CABLE CROSSOVER)
  // ============================================================================
  else if (rigType === 'cable_dual_crossover') {
    label = 'Estación Dual de Poleas · Cables activos';
    cameraPos = [2.75, 1.9, 2.95];
    cameraTarget = [0, 1.0, 0];

    const colX = 1.12;
    const colZ = id === 'cable_chest_press' ? -0.35 : 0.05;
    addWeightStackTower(-colX, colZ, 2.2);
    addWeightStackTower(colX, colZ, 2.2);
    addBox(group, colX * 2 + 0.14, 0.07, 0.09, 0, 2.18, colZ, frameMat);

    const pulleyPosL = new THREE.Vector3(-colX + 0.18, 1.55, colZ + 0.06);
    const pulleyPosR = new THREE.Vector3(colX - 0.18, 1.55, colZ + 0.06);

    [pulleyPosL, pulleyPosR].forEach((pPos) => {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.035, 16),
        plateTrimMat
      );
      wheel.rotation.x = Math.PI / 2;
      wheel.position.copy(pPos);
      group.add(wheel);
    });

    const updateL = createDynamicCable(pulleyPosL);
    const updateR = createDynamicCable(pulleyPosR);

    const handleL = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.14, 10), gripMat);
    const handleR = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.14, 10), gripMat);
    group.add(handleL, handleR);

    updaters.push(({ leftHand, rightHand }) => {
      handleL.position.copy(leftHand);
      handleR.position.copy(rightHand);
      updateL(leftHand);
      updateR(rightHand);
    });
  }

  // ============================================================================
  // 14. ESTACIÓN DE FONDOS / DOMINADAS / BANCOS LIBRES
  // ============================================================================
  else if (rigType === 'dip_station') {
    label = 'Estación de Fondos en Paralelas';
    cameraPos = [2.25, 1.75, 2.5];
    cameraTarget = [0, 0.95, 0];

    addBox(group, 0.85, 0.05, 0.95, 0, 0.025, -0.05, frameMat);
    [-0.31, 0.31].forEach((dx) => {
      addBox(group, 0.06, 1.15, 0.06, dx, 0.58, -0.22, frameMat);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.65, 12), chromeMat);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(dx, 1.15, 0.04);
      group.add(bar);
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.25, 12), gripMat);
      sleeve.rotation.x = Math.PI / 2;
      sleeve.position.set(dx, 1.15, 0.02);
      group.add(sleeve);
    });
  } else if (rigType === 'pullup_rig') {
    label = 'Jaula / Barra de Dominadas';
    cameraPos = [2.4, 1.85, 2.7];
    cameraTarget = [0, 1.25, 0];

    [-0.65, 0.65].forEach((px) => {
      addBox(group, 0.07, 2.26, 0.07, px, 1.13, 0, frameMat);
      addBox(group, 0.09, 0.05, 0.85, px, 0.025, 0, frameMat);
    });
    const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 1.38, 14), chromeMat);
    topBar.rotation.z = Math.PI / 2;
    topBar.position.set(0, 2.22, 0);
    group.add(topBar);
  } else if (rigType === 'hip_thrust_bench') {
    label = 'Banco Hip Thrust + Barra Olímpica';
    cameraPos = [2.4, 1.55, 2.35];
    cameraTarget = [0, 0.52, -0.05];

    addBox(group, 0.85, 0.09, 0.36, 0, 0.4, -0.46, padMat);
    addBox(group, 0.07, 0.38, 0.07, -0.34, 0.19, -0.46, frameMat);
    addBox(group, 0.07, 0.38, 0.07, 0.34, 0.19, -0.46, frameMat);
    addBox(group, 0.82, 0.04, 0.32, 0, 0.02, -0.46, frameMat);
  } else if (rigType === 'preacher_bench') {
    label = exercise.equipment === 'Barra' ? 'Banco Scott + Barra Z' : 'Banco Scott + Mancuerna';
    cameraPos = [2.25, 1.65, 2.35];
    cameraTarget = [0, 0.85, 0.05];

    addBox(group, 0.34, 0.075, 0.36, 0, 0.48, -0.18, padMat);
    addBox(group, 0.07, 0.46, 0.07, 0, 0.23, -0.18, frameMat);
    addBox(group, 0.48, 0.46, 0.08, 0, 0.88, 0.22, padMat, 0.78);
    addBox(group, 0.07, 0.82, 0.07, 0, 0.41, 0.22, frameMat);
    addBox(group, 0.52, 0.05, 0.72, 0, 0.025, 0.04, frameMat);
    addBox(group, 0.36, 0.05, 0.06, 0, 0.64, 0.38, frameLightMat);
  } else if (rigType === 'roman_chair') {
    label = 'Banco Romano 45° (Hiperextensiones)';
    cameraPos = [2.45, 1.6, 2.35];
    cameraTarget = [0, 0.78, -0.05];

    addBox(group, 0.62, 0.05, 1.05, 0, 0.025, -0.1, frameMat);
    addBox(group, 0.08, 0.08, 0.96, 0, 0.46, -0.12, frameMat, -0.75);
    addBox(group, 0.44, 0.1, 0.26, 0, 0.78, 0.08, padMat, -0.65);
    const rearAnklePad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.44, 16),
      padMat
    );
    rearAnklePad.rotation.z = Math.PI / 2;
    rearAnklePad.position.set(0, 0.26, -0.44);
    group.add(rearAnklePad);
  } else if (rigType === 'free_bench_flat') {
    label =
      exercise.equipment === 'Barra'
        ? 'Banco Plano + Barra Olímpica'
        : 'Banco Plano + Mancuernas';
    addFlatBench(-0.05);
  } else if (rigType === 'free_bench_incline') {
    label =
      exercise.equipment === 'Barra'
        ? 'Banco Inclinado + Barra Olímpica'
        : 'Banco Inclinado + Mancuernas';
    addInclineBench(0.2);
  } else {
    label =
      exercise.equipment === 'Barra'
        ? 'Peso Libre · Barra Olímpica'
        : exercise.equipment === 'Mancuernas'
        ? 'Peso Libre · Mancuernas'
        : 'Peso Corporal';
  }

  return {
    group,
    rigType,
    label,
    usesOwnBarbell,
    smithRailZ,
    cameraPos,
    cameraTarget,
    update: (ctx) => {
      for (const fn of updaters) {
        fn(ctx);
      }
    },
  };
}
