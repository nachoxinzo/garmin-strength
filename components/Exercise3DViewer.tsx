'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CatalogExercise } from '@/lib/exercise-catalog';
import { buildGymEquipmentRig, resolveMachineRig } from '@/lib/three-gym-equipment';
import {
  AnatomicalMuscleId,
  MUSCLE_LABELS,
  resolveExerciseMuscles,
} from '@/lib/exercise-muscle-map';

interface Exercise3DViewerProps {
  exercise: CatalogExercise;
  isPlaying: boolean;
  speed: number; // 0.5 | 1
  highlightMuscles: boolean;
  resetSignal: number;
}

interface LimbRig {
  topPivot: THREE.Group;
  midPivot: THREE.Group;
  endPivot: THREE.Group;
  side: -1 | 1;
  upperLen: number;
  lowerLen: number;
}

// Colores reutilizables en renderizado para evitar asignaciones por frame
const NEUTRAL_COLOR = new THREE.Color('#8c9db5');
const PRIMARY_LOW = new THREE.Color('#a8384a');
const PRIMARY_HIGH = new THREE.Color('#ff2438');
const PRIMARY_EMISSIVE = new THREE.Color('#ef4444');
const SECONDARY_LOW = new THREE.Color('#8c7844');
const SECONDARY_HIGH = new THREE.Color('#facc15');
const SECONDARY_EMISSIVE = new THREE.Color('#f59e0b');

const _sPos = new THREE.Vector3();
const _stVec = new THREE.Vector3();
const _dirST = new THREE.Vector3();
const _poleVec = new THREE.Vector3();
const _ePos = new THREE.Vector3();
const _dir1 = new THREE.Vector3();
const _dir2 = new THREE.Vector3();
const _yAxis = new THREE.Vector3();
const _zAxis = new THREE.Vector3();
const _xAxis = new THREE.Vector3();
const _rotMat = new THREE.Matrix4();
const _worldQuat = new THREE.Quaternion();
const _parentQuat = new THREE.Quaternion();

/**
 * Resuelve cinemática inversa (IK) planar de 2 huesos en el plano sagital (Y-Z)
 * para mantener los pies firmemente apoyados en el suelo o en plataformas inclinadas.
 */
function solveSagittalLegIK(
  hipY: number,
  hipZ: number,
  footY: number,
  footZ: number,
  upperLen: number,
  lowerLen: number
): { hipAngleX: number; kneeAngleX: number; ankleAngleX: number } {
  const dy = footY - hipY;
  const dz = footZ - hipZ;
  const maxReach = upperLen + lowerLen - 0.004;
  const minReach = Math.abs(upperLen - lowerLen) + 0.02;
  const dist = Math.max(minReach, Math.min(maxReach, Math.hypot(dy, dz)));

  const targetAngle = Math.atan2(dz, -dy);

  const cosHipOffset = Math.max(
    -1,
    Math.min(1, (upperLen * upperLen + dist * dist - lowerLen * lowerLen) / (2 * upperLen * dist))
  );
  const hipOffset = Math.acos(cosHipOffset);

  const cosKneeInterior = Math.max(
    -1,
    Math.min(1, (upperLen * upperLen + lowerLen * lowerLen - dist * dist) / (2 * upperLen * lowerLen))
  );
  const kneeBend = Math.PI - Math.acos(cosKneeInterior);

  const hipAngleX = -(targetAngle + hipOffset);
  const kneeAngleX = kneeBend;
  const ankleAngleX = -(hipAngleX + kneeAngleX);

  return { hipAngleX, kneeAngleX, ankleAngleX };
}

/**
 * Cinemática inversa analítica de 2 huesos en 3D para los brazos.
 * Orienta el hombro (topPivot) y flexiona el codo (midPivot) para que el extremo (mano)
 * alcance exactamente targetWorld respetando la dirección natural del codo (poleWorld).
 */
function solveTwoBoneArmIK(
  arm: LimbRig,
  parentPivot: THREE.Object3D,
  targetWorld: THREE.Vector3,
  poleWorld: THREE.Vector3
) {
  parentPivot.updateMatrixWorld(true);
  arm.topPivot.getWorldPosition(_sPos);

  const L1 = arm.upperLen;
  const L2 = arm.lowerLen;
  _stVec.subVectors(targetWorld, _sPos);
  const rawDist = _stVec.length();
  const minReach = Math.abs(L1 - L2) + 0.015;
  const maxReach = L1 + L2 - 0.003;
  const dist = Math.max(minReach, Math.min(maxReach, rawDist));

  if (rawDist < 1e-5) {
    _dirST.set(0, -1, 0);
  } else {
    _dirST.copy(_stVec).divideScalar(rawDist);
  }

  // Proyectar el vector polo ortogonalmente respecto al eje hombro-muñeca
  _poleVec.subVectors(poleWorld, _sPos);
  _poleVec.addScaledVector(_dirST, -_poleVec.dot(_dirST));
  if (_poleVec.lengthSq() < 1e-6) {
    _poleVec.set(0, 0, -1);
    _poleVec.addScaledVector(_dirST, -_poleVec.dot(_dirST));
    if (_poleVec.lengthSq() < 1e-6) {
      _poleVec.set(arm.side, 0, 0);
      _poleVec.addScaledVector(_dirST, -_poleVec.dot(_dirST));
    }
  }
  _poleVec.normalize();

  const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * L1 * dist);
  const clampedA = Math.max(-1, Math.min(1, a));
  const sinH = Math.sqrt(Math.max(0, 1 - clampedA * clampedA));

  _ePos
    .copy(_sPos)
    .addScaledVector(_dirST, clampedA * L1)
    .addScaledVector(_poleVec, sinH * L1);

  _dir1.subVectors(_ePos, _sPos).normalize();
  _dir2.subVectors(targetWorld, _ePos);
  if (_dir2.lengthSq() < 1e-7) {
    _dir2.copy(_dir1);
  } else {
    _dir2.normalize();
  }

  const elbowBend = Math.acos(Math.max(-1, Math.min(1, _dir1.dot(_dir2))));

  // +Z local apunta hacia el pliegue interior del codo (bíceps), hacia donde flexiona -elbowBend en X
  _yAxis.copy(_dir1).negate();
  if (elbowBend > 0.025) {
    _zAxis.copy(_dir2).addScaledVector(_dir1, -_dir2.dot(_dir1));
  } else {
    _zAxis.copy(_poleVec).negate();
    _zAxis.addScaledVector(_dir1, -_zAxis.dot(_dir1));
  }
  if (_zAxis.lengthSq() < 1e-6) {
    _zAxis.set(0, 0, 1);
    _zAxis.addScaledVector(_dir1, -_zAxis.dot(_dir1));
  }
  _zAxis.normalize();

  _xAxis.crossVectors(_yAxis, _zAxis).normalize();
  _zAxis.crossVectors(_xAxis, _yAxis).normalize();

  _rotMat.makeBasis(_xAxis, _yAxis, _zAxis);
  _worldQuat.setFromRotationMatrix(_rotMat);

  parentPivot.getWorldQuaternion(_parentQuat);
  arm.topPivot.quaternion.copy(_parentQuat).invert().multiply(_worldQuat);
  arm.midPivot.rotation.set(-elbowBend, 0, 0);
}

/**
 * Visor 3D biomecánico interactivo construido con Three.js.
 * Incluye maquinaria realista, IK analítica de brazos y piernas, y coloración muscular
 * dinámica en tiempo real diferenciando músculos primarios (rojo) y secundarios (ámbar).
 */
export function Exercise3DViewer({
  exercise,
  isPlaying,
  speed,
  highlightMuscles,
  resetSignal,
}: Exercise3DViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tensionBarRef = useRef<HTMLDivElement | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(speed);
  const highlightRef = useRef(highlightMuscles);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const defaultCameraRef = useRef<{ pos: [number, number, number]; target: [number, number, number] }>({
    pos: [2.25, 1.75, 2.65],
    target: [0, 0.9, 0],
  });

  const muscleProfile = useMemo(() => resolveExerciseMuscles(exercise), [exercise]);
  const primaryLabels = useMemo(
    () => muscleProfile.primary.map((m) => MUSCLE_LABELS[m]).join(', '),
    [muscleProfile]
  );
  const secondaryLabels = useMemo(
    () => muscleProfile.secondary.map((m) => MUSCLE_LABELS[m]).join(', '),
    [muscleProfile]
  );

  const rigMeta = useMemo(() => {
    const rigType = resolveMachineRig(exercise);
    const labelMap: Record<string, string> = {
      smith_flat_bench: 'Multipower · Barra guiada',
      smith_incline_bench: 'Multipower Inclinado · Barra guiada',
      smith_shoulder_press: 'Multipower Hombros · Barra guiada',
      smith_split_squat: 'Multipower Búlgara · Barra guiada',
      hack_squat: 'Sentadilla Hack 45° · Carro móvil',
      leg_press: 'Prensa Inclinada 45° · Plataforma móvil',
      leg_extension: 'Máquina Extensión Cuádriceps · Rodillo activo',
      leg_curl_seated: 'Máquina Curl Femoral Sentado',
      leg_curl_lying: 'Máquina Curl Femoral Tumbado',
      hip_machine: 'Máquina Abducción / Aducción',
      calf_machine_standing: 'Máquina de Gemelos de Pie',
      calf_machine_seated: 'Máquina de Gemelos Sentado',
      pec_deck: 'Contractor / Pec Deck en Máquina',
      machine_row: 'Máquina Remo Iso-Lateral',
      machine_lat_pulldown: 'Máquina Jalón Divergente',
      machine_lateral_raise: 'Máquina Elevaciones Laterales',
      cable_high_bar: 'Torre Polea Alta · Cable activo',
      cable_high_pushdown: 'Torre Polea Alta · Cable activo',
      cable_overhead_back: 'Torre Polea Trasera · Cable activo',
      cable_low_row: 'Torre Polea Baja · Cable activo',
      cable_low_single: 'Torre Polea Baja · Cable activo',
      cable_dual_crossover: 'Estación Dual Poleas · Cables activos',
      dip_station: 'Estación de Fondos en Paralelas',
      pullup_rig: 'Jaula / Barra de Dominadas',
      hip_thrust_bench: 'Banco Hip Thrust · Barra Olímpica',
      preacher_bench: 'Banco Scott · Curl Predicador',
      roman_chair: 'Banco Romano 45° · Hiperextensiones',
    };
    return {
      rigType,
      badge:
        labelMap[rigType] ||
        (exercise.equipment === 'Barra'
          ? 'Peso Libre · Barra Olímpica'
          : exercise.equipment === 'Mancuernas'
          ? 'Peso Libre · Mancuernas'
          : 'Peso Corporal'),
    };
  }, [exercise]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    highlightRef.current = highlightMuscles;
    if (!highlightMuscles && tensionBarRef.current) {
      tensionBarRef.current.style.width = '0%';
    }
  }, [highlightMuscles]);

  useEffect(() => {
    if (cameraRef.current && controlsRef.current) {
      const { pos, target } = defaultCameraRef.current;
      cameraRef.current.position.set(...pos);
      controlsRef.current.target.set(...target);
      controlsRef.current.update();
    }
  }, [resetSignal]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 480;
    const height = container.clientHeight || 360;

    // Escena y Fondo de Estudio Limpio
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f172a');
    scene.fog = new THREE.Fog('#0f172a', 7, 16);

    // Equipo / Máquina específica para este ejercicio
    const rigType = resolveMachineRig(exercise);
    const gymRig = buildGymEquipmentRig(rigType, exercise);
    scene.add(gymRig.group);
    defaultCameraRef.current = {
      pos: gymRig.cameraPos,
      target: gymRig.cameraTarget,
    };

    // Cámara encuadrada automáticamente según tamaño de máquina
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 50);
    camera.position.set(...gymRig.cameraPos);
    cameraRef.current = camera;

    // Renderizador WebGL
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Controles 360° (Ratón y Táctil)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(...gymRig.cameraTarget);
    controls.minDistance = 1.4;
    controls.maxDistance = 6.5;
    controls.maxPolarAngle = Math.PI * 0.51;
    controls.update();
    controlsRef.current = controls;

    // Iluminación de Estudio
    const ambientLight = new THREE.AmbientLight('#cbd5e1', 0.95);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight('#ffffff', 1.65);
    keyLight.position.set(3.2, 5.2, 4.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#38bdf8', 0.9);
    rimLight.position.set(-3.2, 3.2, -3.2);
    scene.add(rimLight);

    // Suelo y Rejilla
    const floorGeo = new THREE.CircleGeometry(3.6, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.85,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(6.8, 18, '#334155', '#1e293b');
    grid.position.y = 0.004;
    scene.add(grid);

    // Materiales Base y Diccionario Anatómico de 14 Grupos Musculares
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#8c9db5', roughness: 0.48, metalness: 0.14 });
    const jointMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.35, metalness: 0.4 });
    const equipmentMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.25, metalness: 0.75 });
    const plateMat = new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.4, metalness: 0.3 });

    const createMuscleMat = () =>
      new THREE.MeshStandardMaterial({
        color: '#8c9db5',
        emissive: new THREE.Color('#ef4444'),
        emissiveIntensity: 0,
        roughness: 0.38,
        metalness: 0.18,
      });

    const muscleMats: Record<AnatomicalMuscleId, THREE.MeshStandardMaterial> = {
      chest: createMuscleMat(),
      upper_back: createMuscleMat(),
      traps: createMuscleMat(),
      lower_back: createMuscleMat(),
      abs: createMuscleMat(),
      shoulders: createMuscleMat(),
      biceps: createMuscleMat(),
      triceps: createMuscleMat(),
      forearms: createMuscleMat(),
      glutes: createMuscleMat(),
      quads: createMuscleMat(),
      hamstrings: createMuscleMat(),
      adductors: createMuscleMat(),
      calves: createMuscleMat(),
    };

    const primarySet = new Set<AnatomicalMuscleId>(muscleProfile.primary);
    const secondarySet = new Set<AnatomicalMuscleId>(muscleProfile.secondary);
    const allMuscleIds = Object.keys(muscleMats) as AnatomicalMuscleId[];

    // ==============================================
    // CONSTRUCCIÓN DEL MANIQUÍ ANATÓMICO 3D
    // ==============================================
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const pelvisPivot = new THREE.Group();
    pelvisPivot.position.set(0, 0.88, 0);
    rootGroup.add(pelvisPivot);

    const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.13, 0.18), jointMat);
    pelvisMesh.castShadow = true;
    pelvisPivot.add(pelvisMesh);

    // Glúteos diferenciados en la cara trasera (-Z) de la pelvis
    [-0.078, 0.078].forEach((gx) => {
      const glute = new THREE.Mesh(new THREE.SphereGeometry(0.086, 14, 14), muscleMats.glutes);
      glute.scale.set(1.0, 0.92, 0.86);
      glute.position.set(gx, -0.02, -0.085);
      glute.castShadow = true;
      pelvisPivot.add(glute);
    });

    const spinePivot = new THREE.Group();
    spinePivot.position.set(0, 0.07, 0);
    pelvisPivot.add(spinePivot);

    // Núcleo de cintura + Abdomen frontal (+Z) + Lumbares traseros (-Z)
    const waistCore = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.102, 0.21, 14), bodyMat);
    waistCore.position.y = 0.105;
    waistCore.castShadow = true;
    spinePivot.add(waistCore);

    const absMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.19, 0.05), muscleMats.abs);
    absMesh.position.set(0, 0.105, 0.092);
    absMesh.castShadow = true;
    spinePivot.add(absMesh);

    const lowerBackMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.19, 0.055), muscleMats.lower_back);
    lowerBackMesh.position.set(0, 0.105, -0.092);
    lowerBackMesh.castShadow = true;
    spinePivot.add(lowerBackMesh);

    const chestPivot = new THREE.Group();
    chestPivot.position.set(0, 0.21, 0);
    spinePivot.add(chestPivot);

    // Núcleo del torso superior + Pectorales + Dorsales + Trapecios
    const torsoCore = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.15), bodyMat);
    torsoCore.position.y = 0.135;
    torsoCore.castShadow = true;
    chestPivot.add(torsoCore);

    [-0.082, 0.082].forEach((px) => {
      const pec = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.14, 0.058), muscleMats.chest);
      pec.position.set(px, 0.17, 0.082);
      pec.castShadow = true;
      chestPivot.add(pec);
    });

    const upperBackMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.062), muscleMats.upper_back);
    upperBackMesh.position.set(0, 0.145, -0.084);
    upperBackMesh.castShadow = true;
    chestPivot.add(upperBackMesh);

    const trapsMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.064, 0.135), muscleMats.traps);
    trapsMesh.position.set(0, 0.275, -0.02);
    trapsMesh.castShadow = true;
    chestPivot.add(trapsMesh);

    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.062, 0.08, 12), bodyMat);
    neckMesh.position.set(0, 0.305, 0);
    chestPivot.add(neckMesh);

    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 20), bodyMat);
    headMesh.position.set(0, 0.415, 0.01);
    headMesh.castShadow = true;
    chestPivot.add(headMesh);

    const createArm = (side: -1 | 1): LimbRig => {
      const upperLen = 0.27;
      const lowerLen = 0.25;
      const topPivot = new THREE.Group();

      // Deltoides
      const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.062, 14, 14), muscleMats.shoulders);
      topPivot.add(shoulderCap);

      // Núcleo del brazo superior + Bíceps (+Z) + Tríceps (-Z)
      const upperCore = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.038, upperLen, 12), bodyMat);
      upperCore.position.y = -upperLen / 2;
      upperCore.castShadow = true;
      topPivot.add(upperCore);

      const bicepsMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.025, 0.19, 12), muscleMats.biceps);
      bicepsMesh.position.set(0, -upperLen / 2, 0.025);
      bicepsMesh.castShadow = true;
      topPivot.add(bicepsMesh);

      const tricepsMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.026, 0.19, 12), muscleMats.triceps);
      tricepsMesh.position.set(0, -upperLen / 2, -0.025);
      tricepsMesh.castShadow = true;
      topPivot.add(tricepsMesh);

      const midPivot = new THREE.Group();
      midPivot.position.y = -upperLen;
      topPivot.add(midPivot);

      const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 14), jointMat);
      midPivot.add(elbowJoint);

      // Antebrazo
      const forearmMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.033, lowerLen, 14),
        muscleMats.forearms
      );
      forearmMesh.position.y = -lowerLen / 2;
      forearmMesh.castShadow = true;
      midPivot.add(forearmMesh);

      const endPivot = new THREE.Group();
      endPivot.position.y = -lowerLen;
      midPivot.add(endPivot);

      const wristJoint = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 12), bodyMat);
      endPivot.add(wristJoint);

      return { topPivot, midPivot, endPivot, side, upperLen, lowerLen };
    };

    const LEG_UPPER = 0.42;
    const LEG_LOWER = 0.41;

    const createLeg = (side: -1 | 1): LimbRig => {
      const topPivot = new THREE.Group();
      const hipJoint = new THREE.Mesh(new THREE.SphereGeometry(0.082, 14, 14), jointMat);
      topPivot.add(hipJoint);

      // Núcleo del muslo + Cuádriceps (+Z) + Isquiotibiales (-Z) + Aductores (cara interna)
      const thighCore = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.056, LEG_UPPER, 12), bodyMat);
      thighCore.position.y = -LEG_UPPER / 2;
      thighCore.castShadow = true;
      topPivot.add(thighCore);

      const quadsMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.038, 0.34, 12), muscleMats.quads);
      quadsMesh.position.set(0, -LEG_UPPER / 2, 0.03);
      quadsMesh.castShadow = true;
      topPivot.add(quadsMesh);

      const hamsMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.036, 0.34, 12), muscleMats.hamstrings);
      hamsMesh.position.set(0, -LEG_UPPER / 2, -0.03);
      hamsMesh.castShadow = true;
      topPivot.add(hamsMesh);

      const adductorsMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.034, 0.025, 0.28, 10),
        muscleMats.adductors
      );
      adductorsMesh.position.set(side === -1 ? 0.032 : -0.032, -0.17, 0.004);
      adductorsMesh.castShadow = true;
      topPivot.add(adductorsMesh);

      const midPivot = new THREE.Group();
      midPivot.position.y = -LEG_UPPER;
      topPivot.add(midPivot);

      const kneeJoint = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 14), jointMat);
      midPivot.add(kneeJoint);

      // Espinilla neutra + Gemelo trasero (-Z)
      const shinCore = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.038, LEG_LOWER, 12), bodyMat);
      shinCore.position.y = -LEG_LOWER / 2;
      shinCore.castShadow = true;
      midPivot.add(shinCore);

      const calfMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.024, 0.24, 12), muscleMats.calves);
      calfMesh.position.set(0, -0.15, -0.025);
      calfMesh.castShadow = true;
      midPivot.add(calfMesh);

      const endPivot = new THREE.Group();
      endPivot.position.y = -LEG_LOWER;
      midPivot.add(endPivot);

      const ankleJoint = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), bodyMat);
      endPivot.add(ankleJoint);

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

    const footGeo = new THREE.BoxGeometry(0.09, 0.045, 0.19);
    const leftFoot = new THREE.Mesh(footGeo, jointMat);
    leftFoot.position.set(0, -0.022, 0.045);
    leftFoot.castShadow = true;
    leftLeg.endPivot.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeo, jointMat);
    rightFoot.position.set(0, -0.022, 0.045);
    rightFoot.castShadow = true;
    rightLeg.endPivot.add(rightFoot);

    // Barra libre / Mancuernas cuando el rig no usa barra guiada ni poleas
    let freeBarbellGroup: THREE.Group | null = null;
    if (exercise.equipment === 'Barra' && !gymRig.usesOwnBarbell) {
      freeBarbellGroup = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 1.38, 12), equipmentMat);
      bar.rotation.z = Math.PI / 2;
      bar.castShadow = true;
      freeBarbellGroup.add(bar);

      const plateL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 20), plateMat);
      plateL.rotation.z = Math.PI / 2;
      plateL.position.x = -0.54;
      plateL.castShadow = true;
      freeBarbellGroup.add(plateL);

      const plateR = plateL.clone();
      plateR.position.x = 0.54;
      freeBarbellGroup.add(plateR);
      scene.add(freeBarbellGroup);
    } else if (exercise.equipment === 'Mancuernas') {
      const createDumbbell = () => {
        const db = new THREE.Group();
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 10), equipmentMat);
        handle.rotation.z = Math.PI / 2;
        db.add(handle);
        const w1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.035, 12), plateMat);
        w1.rotation.z = Math.PI / 2;
        w1.position.x = -0.065;
        db.add(w1);
        const w2 = w1.clone();
        w2.position.x = 0.065;
        db.add(w2);
        return db;
      };
      if (exercise.id === 'goblet_squat_dumbbell') {
        const db = createDumbbell();
        db.rotation.z = Math.PI / 2;
        rightArm.endPivot.add(db);
      } else {
        leftArm.endPivot.add(createDumbbell());
        rightArm.endPivot.add(createDumbbell());
      }
    }

    // ==============================================
    // BUCLE DE ANIMACIÓN BIOMECÁNICA PROCEDURAL
    // ==============================================
    let phaseTime = 0;
    let lastTs = performance.now();
    let frameId = 0;

    const leftHandPos = new THREE.Vector3();
    const rightHandPos = new THREE.Vector3();
    const leftAnklePos = new THREE.Vector3();
    const rightAnklePos = new THREE.Vector3();
    const leftKneePos = new THREE.Vector3();
    const rightKneePos = new THREE.Vector3();
    const leftElbowPos = new THREE.Vector3();
    const rightElbowPos = new THREE.Vector3();
    const pelvisPos = new THREE.Vector3();
    const chestPos = new THREE.Vector3();

    const handMidPos = new THREE.Vector3();
    const barDir = new THREE.Vector3();
    const xAxis = new THREE.Vector3(1, 0, 0);

    // Vectores auxiliares para IK de brazos y anclaje exacto de barra
    const targetHandL = new THREE.Vector3();
    const targetHandR = new THREE.Vector3();
    const poleElbowL = new THREE.Vector3();
    const poleElbowR = new THREE.Vector3();
    const anchorBarCenter = new THREE.Vector3();
    const anchorBarRight = new THREE.Vector3();
    const explicitBarQuat = new THREE.Quaternion();

    const resetPose = () => {
      pelvisPivot.position.set(0, 0.88, 0);
      pelvisPivot.rotation.set(0, 0, 0);
      spinePivot.rotation.set(0, 0, 0);
      leftArm.topPivot.position.set(-0.22, 0.24, 0);
      rightArm.topPivot.position.set(0.22, 0.24, 0);
      leftArm.topPivot.rotation.set(0, 0, 0);
      leftArm.midPivot.rotation.set(0, 0, 0);
      rightArm.topPivot.rotation.set(0, 0, 0);
      rightArm.midPivot.rotation.set(0, 0, 0);
      leftLeg.topPivot.rotation.set(0, 0, 0);
      leftLeg.midPivot.rotation.set(0, 0, 0);
      leftLeg.endPivot.rotation.set(0, 0, 0);
      rightLeg.topPivot.rotation.set(0, 0, 0);
      rightLeg.midPivot.rotation.set(0, 0, 0);
      rightLeg.endPivot.rotation.set(0, 0, 0);
    };

    const applyLegIK = (hipY: number, hipZ: number, footY = 0.044, footZ = 0) => {
      const ik = solveSagittalLegIK(hipY - 0.03, hipZ, footY, footZ, LEG_UPPER, LEG_LOWER);
      leftLeg.topPivot.rotation.x = ik.hipAngleX;
      leftLeg.midPivot.rotation.x = ik.kneeAngleX;
      leftLeg.endPivot.rotation.x = ik.ankleAngleX;
      rightLeg.topPivot.rotation.x = ik.hipAngleX;
      rightLeg.midPivot.rotation.x = ik.kneeAngleX;
      rightLeg.endPivot.rotation.x = ik.ankleAngleX;
    };

    const setSeatedLegs = (hipFlex = -1.42, kneeFlex = 1.38) => {
      leftLeg.topPivot.rotation.x = hipFlex;
      leftLeg.midPivot.rotation.x = kneeFlex;
      rightLeg.topPivot.rotation.x = hipFlex;
      rightLeg.midPivot.rotation.x = kneeFlex;
    };

    const id = exercise.id;
    const p = exercise.pattern;

    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTs) / 1000, 0.05);
      lastTs = now;

      if (isPlayingRef.current) {
        phaseTime += dt * 2.0 * speedRef.current;
      }

      // Ciclo suave 0..1
      const c = (Math.sin(phaseTime) + 1) * 0.5;
      const act =
        muscleProfile.activationMode === 'isometric'
          ? 0.55 + 0.45 * c
          : muscleProfile.activationMode === 'peak_at_0'
          ? 1 - c
          : c;

      // Coloración muscular anatómica en tiempo real (Primario rojo, Secundario ámbar)
      if (highlightRef.current) {
        for (const mId of allMuscleIds) {
          const mat = muscleMats[mId];
          if (primarySet.has(mId)) {
            mat.color.copy(PRIMARY_LOW).lerp(PRIMARY_HIGH, act);
            mat.emissive.copy(PRIMARY_EMISSIVE);
            mat.emissiveIntensity = 0.12 + act * 0.88;
          } else if (secondarySet.has(mId)) {
            mat.color.copy(SECONDARY_LOW).lerp(SECONDARY_HIGH, act);
            mat.emissive.copy(SECONDARY_EMISSIVE);
            mat.emissiveIntensity = 0.08 + act * 0.52;
          } else {
            mat.color.copy(NEUTRAL_COLOR);
            mat.emissiveIntensity = 0;
          }
        }
        if (tensionBarRef.current) {
          tensionBarRef.current.style.width = `${Math.round(act * 100)}%`;
        }
      } else {
        for (const mId of allMuscleIds) {
          const mat = muscleMats[mId];
          mat.color.copy(NEUTRAL_COLOR);
          mat.emissiveIntensity = 0;
        }
      }

      resetPose();

      let useBarCenter = false;
      let useExplicitBarQuat = false;

      // ============================================================
      // 1) RIGS DE MÁQUINAS ESPECÍFICAS Y POLEAS ESPECIALES
      // ============================================================
      if (rigType === 'smith_split_squat') {
        const railZ = gymRig.smithRailZ ?? -0.06;
        const hipY = 0.88 - c * 0.3;
        const hipZ = 0.085 - c * 0.01;
        pelvisPivot.position.set(0, hipY, hipZ);
        spinePivot.rotation.x = 0.08;
        const frontIk = solveSagittalLegIK(hipY - 0.03, hipZ, 0.044, 0.32, LEG_UPPER, LEG_LOWER);
        leftLeg.topPivot.rotation.x = frontIk.hipAngleX;
        leftLeg.midPivot.rotation.x = frontIk.kneeAngleX;
        leftLeg.endPivot.rotation.x = frontIk.ankleAngleX;
        rightLeg.topPivot.rotation.x = 0.42 + c * 0.22;
        rightLeg.midPivot.rotation.x = 0.95 + c * 0.45;

        rootGroup.updateMatrixWorld(true);
        anchorBarCenter.set(0, 0.27, -0.08);
        chestPivot.localToWorld(anchorBarCenter);
        const trapsY = anchorBarCenter.y;
        anchorBarCenter.set(0, trapsY, railZ);
        useBarCenter = true;

        targetHandL.set(-0.38, trapsY, railZ);
        targetHandR.set(0.38, trapsY, railZ);
        poleElbowL.set(-0.42, trapsY - 0.28, railZ - 0.16);
        poleElbowR.set(0.42, trapsY - 0.28, railZ - 0.16);
        solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
        solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
      } else if (rigType === 'hack_squat') {
        const slide = c * 0.38;
        const hipY = 0.95 - slide * 0.81;
        const hipZ = -0.05 + slide * 0.58;
        pelvisPivot.position.set(0, hipY, hipZ);
        pelvisPivot.rotation.x = -0.58;
        applyLegIK(hipY, hipZ, 0.16, 0.48);

        rootGroup.updateMatrixWorld(true);
        chestPivot.getWorldPosition(chestPos);
        targetHandL.set(-0.27, chestPos.y + 0.06, chestPos.z + 0.06);
        targetHandR.set(0.27, chestPos.y + 0.06, chestPos.z + 0.06);
        poleElbowL.set(-0.34, chestPos.y - 0.22, chestPos.z - 0.05);
        poleElbowR.set(0.34, chestPos.y - 0.22, chestPos.z - 0.05);
        solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
        solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
      } else if (rigType === 'leg_press') {
        pelvisPivot.position.set(0, 0.47, -0.24);
        pelvisPivot.rotation.x = -0.82;
        const push = c;
        const footY = 0.72 + push * 0.34;
        const footZ = 0.36 + push * 0.32;
        applyLegIK(0.45, -0.22, footY, footZ);
        // Apoyar plantas planas sobre la plataforma inclinada
        leftLeg.endPivot.rotation.x += 0.72;
        rightLeg.endPivot.rotation.x += 0.72;
        leftArm.topPivot.rotation.set(0.15, 0, -0.18);
        rightArm.topPivot.rotation.set(0.15, 0, 0.18);
        leftArm.midPivot.rotation.x = -0.6;
        rightArm.midPivot.rotation.x = -0.6;
      } else if (rigType === 'hip_machine') {
        pelvisPivot.position.set(0, 0.55, 0.02);
        setSeatedLegs(-1.45, 1.45);
        const spread = id.includes('abduction') ? 0.12 + c * 0.36 : 0.48 - c * 0.36;
        leftLeg.topPivot.rotation.z = -spread;
        rightLeg.topPivot.rotation.z = spread;
        leftArm.topPivot.rotation.set(0.1, 0, -0.22);
        rightArm.topPivot.rotation.set(0.1, 0, 0.22);
        leftArm.midPivot.rotation.x = -0.85;
        rightArm.midPivot.rotation.x = -0.85;
      } else if (rigType === 'calf_machine_standing') {
        const lift = c * 0.08;
        pelvisPivot.position.set(0, 0.96 + lift, 0);
        leftLeg.endPivot.rotation.x = c * 0.32;
        rightLeg.endPivot.rotation.x = c * 0.32;
        leftArm.topPivot.rotation.set(-1.35, 0, -0.2);
        rightArm.topPivot.rotation.set(-1.35, 0, 0.2);
        leftArm.midPivot.rotation.x = -1.6;
        rightArm.midPivot.rotation.x = -1.6;
      } else if (rigType === 'calf_machine_seated') {
        pelvisPivot.position.set(0, 0.55, -0.02);
        setSeatedLegs(-1.48, 1.52);
        const lift = c * 0.34;
        leftLeg.topPivot.rotation.x = -1.48 - lift * 0.25;
        rightLeg.topPivot.rotation.x = -1.48 - lift * 0.25;
        leftLeg.endPivot.rotation.x = lift;
        rightLeg.endPivot.rotation.x = lift;
        leftArm.topPivot.rotation.set(-0.45, 0, -0.1);
        rightArm.topPivot.rotation.set(-0.45, 0, 0.1);
        leftArm.midPivot.rotation.x = -0.6;
        rightArm.midPivot.rotation.x = -0.6;
      } else if (rigType === 'dip_station') {
        const dipY = 0.8 + c * 0.26;
        pelvisPivot.position.set(0, dipY, 0.02);
        leftLeg.topPivot.rotation.x = 0.08;
        leftLeg.midPivot.rotation.x = 0.55;
        rightLeg.topPivot.rotation.x = 0.08;
        rightLeg.midPivot.rotation.x = 0.55;
        rootGroup.updateMatrixWorld(true);
        targetHandL.set(-0.31, 1.15, 0.02);
        targetHandR.set(0.31, 1.15, 0.02);
        poleElbowL.set(-0.34, 1.4, -0.35);
        poleElbowR.set(0.34, 1.4, -0.35);
        solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
        solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
      } else if (rigType === 'pec_deck') {
        pelvisPivot.position.set(0, 0.55, 0.04);
        setSeatedLegs(-1.42, 1.42);
        if (id === 'rear_delt_fly_machine') {
          const pull = c * 1.1;
          leftArm.topPivot.rotation.set(-1.42, -pull, -0.12 - pull * 0.6);
          rightArm.topPivot.rotation.set(-1.42, pull, 0.12 + pull * 0.6);
        } else {
          const close = c * 1.15;
          leftArm.topPivot.rotation.set(-1.45, 0, -1.25 + close);
          rightArm.topPivot.rotation.set(-1.45, 0, 1.25 - close);
        }
        leftArm.midPivot.rotation.x = -0.45;
        rightArm.midPivot.rotation.x = -0.45;
      } else if (rigType === 'machine_lateral_raise') {
        pelvisPivot.position.set(0, 0.55, 0.04);
        setSeatedLegs(-1.42, 1.42);
        const abd = 0.2 + c * 1.32;
        leftArm.topPivot.rotation.set(-0.15, 0, -abd);
        rightArm.topPivot.rotation.set(-0.15, 0, abd);
        leftArm.midPivot.rotation.x = -1.15;
        rightArm.midPivot.rotation.x = -1.15;
      } else if (rigType === 'smith_shoulder_press') {
        pelvisPivot.position.set(0, 0.55, 0.04);
        setSeatedLegs(-1.42, 1.42);
        const barY = 1.06 + c * 0.42;
        const barZ = gymRig.smithRailZ ?? 0.14;
        anchorBarCenter.set(0, barY, barZ);
        useBarCenter = true;
        rootGroup.updateMatrixWorld(true);
        targetHandL.set(-0.36, barY, barZ);
        targetHandR.set(0.36, barY, barZ);
        poleElbowL.set(-0.42, 0.85, barZ + 0.14);
        poleElbowR.set(0.42, 0.85, barZ + 0.14);
        solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
        solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
      } else if (rigType === 'machine_lat_pulldown') {
        pelvisPivot.position.set(0, 0.55, 0.02);
        setSeatedLegs(-1.42, 1.42);
        spinePivot.rotation.x = -0.08 * c;
        const pullDown = -2.85 + c * 1.5;
        leftArm.topPivot.rotation.set(pullDown, 0, -0.35 - c * 0.22);
        rightArm.topPivot.rotation.set(pullDown, 0, 0.35 + c * 0.22);
        leftArm.midPivot.rotation.x = -0.2 - c * 1.3;
        rightArm.midPivot.rotation.x = -0.2 - c * 1.3;
      } else if (rigType === 'preacher_bench') {
        pelvisPivot.position.set(0, 0.55, -0.18);
        setSeatedLegs(-1.35, 1.35);
        spinePivot.rotation.x = 0.22;
        rootGroup.updateMatrixWorld(true);
        const gripX = exercise.equipment === 'Barra' ? 0.19 : 0.18;
        const handY = 0.74 + c * 0.38;
        const handZ = 0.36 - c * 0.16;
        targetHandL.set(-gripX, handY, handZ);
        targetHandR.set(gripX, handY, handZ);
        poleElbowL.set(-gripX, 0.9, 0.18);
        poleElbowR.set(gripX, 0.9, 0.18);
        solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
        solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        if (exercise.equipment === 'Barra') {
          anchorBarCenter.set(0, handY, handZ);
          useBarCenter = true;
        }
      } else if (rigType === 'hip_thrust_bench') {
        const hipY = 0.22 + c * 0.22;
        const hipZ = -0.02;
        pelvisPivot.position.set(0, hipY, hipZ);
        pelvisPivot.rotation.x = -0.96 - c * 0.53;
        applyLegIK(hipY, hipZ, 0.044, 0.38);

        rootGroup.updateMatrixWorld(true);
        anchorBarCenter.set(0, 0.04, 0.145);
        pelvisPivot.localToWorld(anchorBarCenter);
        anchorBarRight.set(1, 0.04, 0.145);
        pelvisPivot.localToWorld(anchorBarRight);
        barDir.copy(anchorBarRight).sub(anchorBarCenter).normalize();
        explicitBarQuat.setFromUnitVectors(xAxis, barDir);
        useBarCenter = true;
        useExplicitBarQuat = true;

        targetHandL.set(-0.32, 0.04, 0.145);
        pelvisPivot.localToWorld(targetHandL);
        targetHandR.set(0.32, 0.04, 0.145);
        pelvisPivot.localToWorld(targetHandR);
        poleElbowL.set(-0.35, 0.18, -0.08);
        pelvisPivot.localToWorld(poleElbowL);
        poleElbowR.set(0.35, 0.18, -0.08);
        pelvisPivot.localToWorld(poleElbowR);
        solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
        solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
      } else if (rigType === 'roman_chair') {
        pelvisPivot.position.set(0, 0.78, 0.02);
        pelvisPivot.rotation.x = 0.65;
        leftLeg.topPivot.rotation.x = 0.05;
        rightLeg.topPivot.rotation.x = 0.05;
        spinePivot.rotation.x = 0.92 - c * 0.85;
        leftArm.topPivot.rotation.set(-1.3, 0, 0.35);
        rightArm.topPivot.rotation.set(-1.3, 0, -0.35);
        leftArm.midPivot.rotation.x = -1.6;
        rightArm.midPivot.rotation.x = -1.6;

      // ============================================================
      // 2) PATRONES DE MOVIMIENTO Y EJERCICIOS ESPECÍFICOS
      // ============================================================
      } else if (p === 'Empuje Horizontal') {
        if (id.includes('push_up') || id.includes('pushup')) {
          const drop = (1 - c) * 0.16;
          pelvisPivot.position.set(0, 0.32 - drop * 0.4, 0.1);
          pelvisPivot.rotation.x = 1.32 - drop * 0.2;
          leftArm.topPivot.rotation.set(-1.35 + (1 - c) * 0.45, 0, -0.25);
          rightArm.topPivot.rotation.set(-1.35 + (1 - c) * 0.45, 0, 0.25);
          leftArm.midPivot.rotation.x = -(1 - c) * 1.15;
          rightArm.midPivot.rotation.x = -(1 - c) * 1.15;
        } else if (rigType === 'cable_dual_crossover') {
          applyLegIK(0.88, 0, 0.044, 0);
          spinePivot.rotation.x = 0.12;
          const press = c;
          leftArm.topPivot.rotation.set(-1.35, -0.15 + press * 0.45, -0.85 + press * 0.72);
          rightArm.topPivot.rotation.set(-1.35, 0.15 - press * 0.45, 0.85 - press * 0.72);
          leftArm.midPivot.rotation.x = -1.25 + press * 1.05;
          rightArm.midPivot.rotation.x = -1.25 + press * 1.05;
        } else {
          // Press de banca plano (barra o mancuernas / smith_flat_bench)
          pelvisPivot.position.set(0, 0.51, 0.26);
          pelvisPivot.rotation.x = -Math.PI / 2;
          leftLeg.topPivot.rotation.x = -0.2;
          leftLeg.midPivot.rotation.x = Math.PI / 2 + 0.2;
          rightLeg.topPivot.rotation.x = -0.2;
          rightLeg.midPivot.rotation.x = Math.PI / 2 + 0.2;

          if (exercise.equipment === 'Barra' || rigType === 'smith_flat_bench') {
            const barY = 0.64 + c * 0.36;
            const barZ = gymRig.smithRailZ ?? -0.25;
            const gripX = id === 'close_grip_bench_press' ? 0.2 : 0.38;
            anchorBarCenter.set(0, barY, barZ);
            useBarCenter = true;
            rootGroup.updateMatrixWorld(true);
            targetHandL.set(-gripX, barY, barZ);
            targetHandR.set(gripX, barY, barZ);
            poleElbowL.set(-(gripX + 0.08), 0.44, barZ + 0.12);
            poleElbowR.set(gripX + 0.08, 0.44, barZ + 0.12);
            solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
            solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
          } else {
            const flare = (1 - c) * 0.72;
            const elbowBend = (1 - c) * 1.25;
            leftArm.topPivot.rotation.set(-Math.PI / 2 + (1 - c) * 0.2, 0, -flare - 0.12);
            rightArm.topPivot.rotation.set(-Math.PI / 2 + (1 - c) * 0.2, 0, flare + 0.12);
            leftArm.midPivot.rotation.set(-0.15, 0, elbowBend);
            rightArm.midPivot.rotation.set(-0.15, 0, -elbowBend);
          }
        }
      } else if (p === 'Empuje Inclinado') {
        pelvisPivot.position.set(0, 0.53, 0.18);
        pelvisPivot.rotation.x = -0.68;
        setSeatedLegs(-0.82, 1.45);
        if (exercise.equipment === 'Barra' || rigType === 'smith_incline_bench') {
          const barY = 0.99 + c * 0.34;
          const barZ = gymRig.smithRailZ ?? -0.15;
          anchorBarCenter.set(0, barY, barZ);
          useBarCenter = true;
          rootGroup.updateMatrixWorld(true);
          targetHandL.set(-0.38, barY, barZ);
          targetHandR.set(0.38, barY, barZ);
          poleElbowL.set(-0.46, 0.75, barZ + 0.12);
          poleElbowR.set(0.46, 0.75, barZ + 0.12);
          solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
          solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        } else {
          const flare = (1 - c) * 0.65;
          const elbowBend = (1 - c) * 1.2;
          leftArm.topPivot.rotation.set(-Math.PI / 2 - 0.45 + (1 - c) * 0.2, 0, -flare - 0.12);
          rightArm.topPivot.rotation.set(-Math.PI / 2 - 0.45 + (1 - c) * 0.2, 0, flare + 0.12);
          leftArm.midPivot.rotation.set(-0.15, 0, elbowBend);
          rightArm.midPivot.rotation.set(-0.15, 0, -elbowBend);
        }
      } else if (p === 'Empuje Vertical') {
        const isSeated =
          id === 'seated_barbell_shoulder_press' || id === 'dumbbell_shoulder_press';
        if (isSeated) {
          pelvisPivot.position.set(0, 0.55, 0.04);
          setSeatedLegs(-1.42, 1.42);
        } else {
          applyLegIK(0.88, 0, 0.044, 0);
        }

        if (exercise.equipment === 'Barra') {
          const baseShoulderY = isSeated ? 1.06 : 1.38;
          const barY = baseShoulderY + c * 0.42;
          const barZ = 0.12;
          anchorBarCenter.set(0, barY, barZ);
          useBarCenter = true;
          rootGroup.updateMatrixWorld(true);
          targetHandL.set(-0.36, barY, barZ);
          targetHandR.set(0.36, barY, barZ);
          poleElbowL.set(-0.4, baseShoulderY - 0.18, barZ + 0.16);
          poleElbowR.set(0.4, baseShoulderY - 0.18, barZ + 0.16);
          solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
          solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        } else {
          const press = c;
          leftArm.topPivot.rotation.set(-1.75 - press * 1.15, 0, -0.35 + press * 0.25);
          rightArm.topPivot.rotation.set(-1.75 - press * 1.15, 0, 0.35 - press * 0.25);
          leftArm.midPivot.rotation.x = -1.45 + press * 1.3;
          rightArm.midPivot.rotation.x = -1.45 + press * 1.3;
        }
      } else if (p === 'Tracción Horizontal') {
        if (rigType === 'cable_low_row' || rigType === 'machine_row') {
          pelvisPivot.position.set(0, 0.56, 0);
          spinePivot.rotation.x = 0.08 - c * 0.06;
          setSeatedLegs(-1.35, 1.15);
          const pullBack = -1.25 + c * 1.15;
          leftArm.topPivot.rotation.x = pullBack;
          rightArm.topPivot.rotation.x = pullBack;
          leftArm.midPivot.rotation.x = -0.18 - c * 1.2;
          rightArm.midPivot.rotation.x = -0.18 - c * 1.2;
        } else if (id === 'chest_supported_dumbbell_row') {
          pelvisPivot.position.set(0, 0.53, 0.16);
          pelvisPivot.rotation.x = 0.72;
          setSeatedLegs(-0.82, 1.45);
          const pullBack = -0.8 + c * 0.95;
          leftArm.topPivot.rotation.x = pullBack;
          rightArm.topPivot.rotation.x = pullBack;
          leftArm.midPivot.rotation.x = -0.18 - c * 1.25;
          rightArm.midPivot.rotation.x = -0.18 - c * 1.25;
        } else if (exercise.equipment === 'Barra') {
          applyLegIK(0.82, -0.08, 0.044, 0);
          pelvisPivot.position.set(0, 0.82, -0.08);
          spinePivot.rotation.x = 0.85;
          rootGroup.updateMatrixWorld(true);
          const barY = 0.54 + c * 0.26;
          const barZ = 0.34 - c * 0.12;
          anchorBarCenter.set(0, barY, barZ);
          useBarCenter = true;
          targetHandL.set(-0.34, barY, barZ);
          targetHandR.set(0.34, barY, barZ);
          poleElbowL.set(-0.4, 1.05 + c * 0.08, 0.12);
          poleElbowR.set(0.4, 1.05 + c * 0.08, 0.12);
          solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
          solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        } else {
          applyLegIK(0.82, -0.08, 0.044, 0);
          pelvisPivot.position.set(0, 0.82, -0.08);
          spinePivot.rotation.x = 0.78;
          const pullBack = -1.25 + c * 1.15;
          leftArm.topPivot.rotation.x = pullBack;
          rightArm.topPivot.rotation.x = pullBack;
          leftArm.midPivot.rotation.x = -0.18 - c * 1.2;
          rightArm.midPivot.rotation.x = -0.18 - c * 1.2;
        }
      } else if (p === 'Tracción Vertical') {
        if (id === 'straight_arm_pulldown') {
          applyLegIK(0.88, -0.06, 0.044, 0);
          pelvisPivot.position.set(0, 0.88, -0.06);
          spinePivot.rotation.x = 0.24;
          const sweep = -2.35 + c * 1.85;
          leftArm.topPivot.rotation.set(sweep, 0, -0.12);
          rightArm.topPivot.rotation.set(sweep, 0, 0.12);
          leftArm.midPivot.rotation.x = -0.14;
          rightArm.midPivot.rotation.x = -0.14;
        } else if (rigType === 'cable_high_bar') {
          pelvisPivot.position.set(0, 0.56, 0.02);
          spinePivot.rotation.x = -0.12 * c;
          setSeatedLegs(-1.4, 1.38);
          const pullDown = -2.9 + c * 1.55;
          leftArm.topPivot.rotation.set(pullDown, 0, -0.38 - c * 0.25);
          rightArm.topPivot.rotation.set(pullDown, 0, 0.38 + c * 0.25);
          leftArm.midPivot.rotation.x = -0.15 - c * 1.35;
          rightArm.midPivot.rotation.x = -0.15 - c * 1.35;
        } else {
          // Dominadas con manos fijadas exactamente sobre la barra superior
          const pullY = 1.2 + c * 0.32;
          pelvisPivot.position.set(0, pullY, 0);
          leftLeg.topPivot.rotation.x = 0.1;
          leftLeg.midPivot.rotation.x = 0.35;
          rightLeg.topPivot.rotation.x = 0.1;
          rightLeg.midPivot.rotation.x = 0.35;
          rootGroup.updateMatrixWorld(true);
          const gripX = id === 'chin_up' ? 0.2 : 0.32;
          targetHandL.set(-gripX, 2.22, 0);
          targetHandR.set(gripX, 2.22, 0);
          poleElbowL.set(-(gripX + 0.08), 1.85, 0.24);
          poleElbowR.set(gripX + 0.08, 1.85, 0.24);
          solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
          solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        }
      } else if (p === 'Sentadilla / Cuádriceps') {
        if (rigType === 'leg_extension') {
          pelvisPivot.position.set(0, 0.56, 0.02);
          leftLeg.topPivot.rotation.x = -1.48;
          rightLeg.topPivot.rotation.x = -1.48;
          const ext = 1.48 - c * 1.38;
          leftLeg.midPivot.rotation.x = ext;
          rightLeg.midPivot.rotation.x = ext;
          leftArm.topPivot.rotation.set(0.05, 0, -0.2);
          rightArm.topPivot.rotation.set(0.05, 0, 0.2);
          leftArm.midPivot.rotation.x = -0.7;
          rightArm.midPivot.rotation.x = -0.7;
        } else if (
          id === 'lunge_barbell' ||
          id === 'lunge_dumbbell' ||
          id === 'walking_lunge_dumbbell' ||
          id === 'bulgarian_split_squat' ||
          id === 'step_up_dumbbell'
        ) {
          const hipY = 0.88 - c * 0.28;
          const hipZ = -c * 0.04;
          pelvisPivot.position.set(0, hipY, hipZ);
          spinePivot.rotation.x = c * 0.14;
          const frontIk = solveSagittalLegIK(hipY - 0.03, hipZ, 0.044, 0.3, LEG_UPPER, LEG_LOWER);
          leftLeg.topPivot.rotation.x = frontIk.hipAngleX;
          leftLeg.midPivot.rotation.x = frontIk.kneeAngleX;
          leftLeg.endPivot.rotation.x = frontIk.ankleAngleX;
          rightLeg.topPivot.rotation.x = 0.38 + c * 0.18;
          rightLeg.midPivot.rotation.x = 0.72 + c * 0.65;

          if (exercise.equipment === 'Barra') {
            rootGroup.updateMatrixWorld(true);
            anchorBarCenter.set(0, 0.27, -0.125);
            chestPivot.localToWorld(anchorBarCenter);
            anchorBarRight.set(1, 0.27, -0.125);
            chestPivot.localToWorld(anchorBarRight);
            barDir.copy(anchorBarRight).sub(anchorBarCenter).normalize();
            explicitBarQuat.setFromUnitVectors(xAxis, barDir);
            useBarCenter = true;
            useExplicitBarQuat = true;

            targetHandL.set(-0.38, 0.27, -0.125);
            chestPivot.localToWorld(targetHandL);
            targetHandR.set(0.38, 0.27, -0.125);
            chestPivot.localToWorld(targetHandR);
            poleElbowL.set(-0.42, -0.02, -0.25);
            chestPivot.localToWorld(poleElbowL);
            poleElbowR.set(0.42, -0.02, -0.25);
            chestPivot.localToWorld(poleElbowR);
            solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
            solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
          }
        } else {
          // Sentadilla trasera, frontal, goblet o sumo
          const hipY = 0.88 - c * 0.36;
          const hipZ = -c * 0.15;
          pelvisPivot.position.set(0, hipY, hipZ);
          spinePivot.rotation.x = id === 'squat_front_barbell' ? c * 0.18 : c * 0.32;
          applyLegIK(hipY, hipZ, 0.044, 0);
          if (id === 'sumo_squat') {
            leftLeg.topPivot.rotation.z = -0.22;
            rightLeg.topPivot.rotation.z = 0.22;
          }

          if (id === 'squat_front_barbell') {
            // Barra delante en rack frontal sobre hombros con codos altos
            rootGroup.updateMatrixWorld(true);
            anchorBarCenter.set(0, 0.26, 0.135);
            chestPivot.localToWorld(anchorBarCenter);
            anchorBarRight.set(1, 0.26, 0.135);
            chestPivot.localToWorld(anchorBarRight);
            barDir.copy(anchorBarRight).sub(anchorBarCenter).normalize();
            explicitBarQuat.setFromUnitVectors(xAxis, barDir);
            useBarCenter = true;
            useExplicitBarQuat = true;

            targetHandL.set(-0.24, 0.26, 0.135);
            chestPivot.localToWorld(targetHandL);
            targetHandR.set(0.24, 0.26, 0.135);
            chestPivot.localToWorld(targetHandR);
            poleElbowL.set(-0.24, 0.22, 0.48);
            chestPivot.localToWorld(poleElbowL);
            poleElbowR.set(0.24, 0.22, 0.48);
            chestPivot.localToWorld(poleElbowR);
            solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
            solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
          } else if (id === 'goblet_squat_dumbbell') {
            rootGroup.updateMatrixWorld(true);
            targetHandL.set(-0.07, 0.14, 0.26);
            chestPivot.localToWorld(targetHandL);
            targetHandR.set(0.07, 0.14, 0.26);
            chestPivot.localToWorld(targetHandR);
            poleElbowL.set(-0.2, 0.0, 0.18);
            chestPivot.localToWorld(poleElbowL);
            poleElbowR.set(0.2, 0.0, 0.18);
            chestPivot.localToWorld(poleElbowR);
            solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
            solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
          } else if (exercise.equipment === 'Barra') {
            // Sentadilla trasera: barra apoyada detrás del cuello sobre trapecios/espalda alta
            rootGroup.updateMatrixWorld(true);
            anchorBarCenter.set(0, 0.27, -0.125);
            chestPivot.localToWorld(anchorBarCenter);
            anchorBarRight.set(1, 0.27, -0.125);
            chestPivot.localToWorld(anchorBarRight);
            barDir.copy(anchorBarRight).sub(anchorBarCenter).normalize();
            explicitBarQuat.setFromUnitVectors(xAxis, barDir);
            useBarCenter = true;
            useExplicitBarQuat = true;

            targetHandL.set(-0.38, 0.27, -0.125);
            chestPivot.localToWorld(targetHandL);
            targetHandR.set(0.38, 0.27, -0.125);
            chestPivot.localToWorld(targetHandR);
            poleElbowL.set(-0.42, -0.02, -0.25);
            chestPivot.localToWorld(poleElbowL);
            poleElbowR.set(0.42, -0.02, -0.25);
            chestPivot.localToWorld(poleElbowR);
            solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
            solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
          }
        }
      } else if (p === 'Bisagra / Cadena Posterior') {
        if (rigType === 'leg_curl_lying') {
          pelvisPivot.position.set(0, 0.56, 0.02);
          pelvisPivot.rotation.x = Math.PI / 2 - 0.12;
          leftLeg.midPivot.rotation.x = 0.18 + c * 1.45;
          rightLeg.midPivot.rotation.x = 0.18 + c * 1.45;
          leftArm.topPivot.rotation.set(-2.5, 0, -0.28);
          rightArm.topPivot.rotation.set(-2.5, 0, 0.28);
          leftArm.midPivot.rotation.x = -0.5;
          rightArm.midPivot.rotation.x = -0.5;
        } else if (rigType === 'leg_curl_seated') {
          pelvisPivot.position.set(0, 0.56, 0.02);
          leftLeg.topPivot.rotation.x = -1.48;
          rightLeg.topPivot.rotation.x = -1.48;
          leftLeg.midPivot.rotation.x = 0.2 + c * 1.35;
          rightLeg.midPivot.rotation.x = 0.2 + c * 1.35;
          leftArm.topPivot.rotation.set(0.05, 0, -0.2);
          rightArm.topPivot.rotation.set(0.05, 0, 0.2);
          leftArm.midPivot.rotation.x = -0.7;
          rightArm.midPivot.rotation.x = -0.7;
        } else if (id === 'glute_bridge_barbell') {
          const hipY = 0.12 + c * 0.2;
          pelvisPivot.position.set(0, hipY, 0);
          pelvisPivot.rotation.x = -Math.PI / 2 + (1 - c) * 0.35;
          applyLegIK(hipY, 0, 0.044, 0.4);
          rootGroup.updateMatrixWorld(true);
          anchorBarCenter.set(0, 0.04, 0.145);
          pelvisPivot.localToWorld(anchorBarCenter);
          anchorBarRight.set(1, 0.04, 0.145);
          pelvisPivot.localToWorld(anchorBarRight);
          barDir.copy(anchorBarRight).sub(anchorBarCenter).normalize();
          explicitBarQuat.setFromUnitVectors(xAxis, barDir);
          useBarCenter = true;
          useExplicitBarQuat = true;

          targetHandL.set(-0.32, 0.04, 0.145);
          pelvisPivot.localToWorld(targetHandL);
          targetHandR.set(0.32, 0.04, 0.145);
          pelvisPivot.localToWorld(targetHandR);
          poleElbowL.set(-0.35, 0.18, -0.08);
          pelvisPivot.localToWorld(poleElbowL);
          poleElbowR.set(0.35, 0.18, -0.08);
          pelvisPivot.localToWorld(poleElbowR);
          solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
          solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        } else if (id === 'good_morning_barbell') {
          // c = 1 arriba erguido, c = 0 inclinado
          const hinge = (1 - c) * 1.05;
          const hipY = 0.88 - (1 - c) * 0.1;
          const hipZ = -(1 - c) * 0.14;
          pelvisPivot.position.set(0, hipY, hipZ);
          applyLegIK(hipY, hipZ, 0.044, 0);
          spinePivot.rotation.x = hinge;

          rootGroup.updateMatrixWorld(true);
          anchorBarCenter.set(0, 0.27, -0.125);
          chestPivot.localToWorld(anchorBarCenter);
          anchorBarRight.set(1, 0.27, -0.125);
          chestPivot.localToWorld(anchorBarRight);
          barDir.copy(anchorBarRight).sub(anchorBarCenter).normalize();
          explicitBarQuat.setFromUnitVectors(xAxis, barDir);
          useBarCenter = true;
          useExplicitBarQuat = true;

          targetHandL.set(-0.38, 0.27, -0.125);
          chestPivot.localToWorld(targetHandL);
          targetHandR.set(0.38, 0.27, -0.125);
          chestPivot.localToWorld(targetHandR);
          poleElbowL.set(-0.42, -0.02, -0.25);
          chestPivot.localToWorld(poleElbowL);
          poleElbowR.set(0.42, -0.02, -0.25);
          chestPivot.localToWorld(poleElbowR);
          solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
          solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        } else if (id === 'cable_pull_through') {
          const bend = 1 - c;
          const hipY = 0.88 - bend * 0.12;
          const hipZ = -bend * 0.16;
          pelvisPivot.position.set(0, hipY, hipZ);
          applyLegIK(hipY, hipZ, 0.044, 0);
          spinePivot.rotation.x = bend * 1.08;
          leftArm.topPivot.rotation.set(-bend * 0.45 + 0.18, 0, 0.08);
          rightArm.topPivot.rotation.set(-bend * 0.45 + 0.18, 0, -0.08);
        } else {
          // Peso muerto / RDL / Rack Pull (c = 1 bloqueo arriba, c = 0 barra abajo)
          const down = 1 - c;
          const isRdl = id === 'deadlift_straight_leg' || id === 'romanian_deadlift_dumbbell';
          const hipDrop = isRdl ? down * 0.09 : down * 0.24;
          const hipY = 0.88 - hipDrop;
          const hipZ = -down * 0.14;
          pelvisPivot.position.set(0, hipY, hipZ);
          applyLegIK(hipY, hipZ, 0.044, 0);
          if (id === 'deadlift_sumo') {
            leftLeg.topPivot.rotation.z = -0.26;
            rightLeg.topPivot.rotation.z = 0.26;
          }
          const hinge = down * 1.1;
          spinePivot.rotation.x = hinge;
          leftArm.topPivot.rotation.x = -hinge * 0.94;
          rightArm.topPivot.rotation.x = -hinge * 0.94;
        }
      } else if (p === 'Aislamiento Deltoides') {
        applyLegIK(0.88, 0, 0.044, 0);
        if (id === 'shrug_barbell' || id === 'shrug_dumbbell') {
          const shrugLift = c * 0.055;
          leftArm.topPivot.position.y = 0.24 + shrugLift;
          rightArm.topPivot.position.y = 0.24 + shrugLift;
          leftArm.topPivot.rotation.set(-0.08, 0, -0.06);
          rightArm.topPivot.rotation.set(-0.08, 0, 0.06);
          leftArm.midPivot.rotation.x = -0.08;
          rightArm.midPivot.rotation.x = -0.08;
        } else if (id === 'upright_row_barbell') {
          rootGroup.updateMatrixWorld(true);
          const barY = 0.88 + c * 0.48;
          const barZ = 0.22;
          anchorBarCenter.set(0, barY, barZ);
          useBarCenter = true;
          targetHandL.set(-0.18, barY, barZ);
          targetHandR.set(0.18, barY, barZ);
          poleElbowL.set(-0.46, barY + 0.16, 0.14);
          poleElbowR.set(0.46, barY + 0.16, 0.14);
          solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
          solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        } else if (id === 'front_raise_dumbbell' || id === 'front_raise_cable') {
          const lift = 0.12 + c * 1.48;
          leftArm.topPivot.rotation.set(-lift, 0, -0.08);
          rightArm.topPivot.rotation.set(-lift, 0, 0.08);
          leftArm.midPivot.rotation.x = -0.15;
          rightArm.midPivot.rotation.x = -0.15;
        } else if (id.includes('rear_delt') || id.includes('face_pull')) {
          if (id === 'rear_delt_fly_dumbbell') {
            spinePivot.rotation.x = 0.72;
          }
          const swing = c * 1.2;
          leftArm.topPivot.rotation.set(-1.35, -swing * 0.7, -0.25 - swing * 0.65);
          rightArm.topPivot.rotation.set(-1.35, swing * 0.7, 0.25 + swing * 0.65);
        } else {
          const abduction = 0.15 + c * 1.35;
          leftArm.topPivot.rotation.set(-0.15, 0, -abduction);
          rightArm.topPivot.rotation.set(-0.15, 0, abduction);
          leftArm.midPivot.rotation.x = -0.22;
          rightArm.midPivot.rotation.x = -0.22;
        }
      } else if (p === 'Aislamiento Pectoral') {
        if (rigType === 'free_bench_flat') {
          pelvisPivot.position.set(0, 0.51, 0.26);
          pelvisPivot.rotation.x = -Math.PI / 2;
          leftLeg.topPivot.rotation.x = -0.2;
          leftLeg.midPivot.rotation.x = Math.PI / 2 + 0.2;
          rightLeg.topPivot.rotation.x = -0.2;
          rightLeg.midPivot.rotation.x = Math.PI / 2 + 0.2;
          const open = (1 - c) * 1.05;
          leftArm.topPivot.rotation.set(-Math.PI / 2, 0, -open - 0.1);
          rightArm.topPivot.rotation.set(-Math.PI / 2, 0, open + 0.1);
          leftArm.midPivot.rotation.z = 0.25;
          rightArm.midPivot.rotation.z = -0.25;
        } else {
          applyLegIK(0.88, 0, 0.044, 0);
          const close = c * 1.1;
          leftArm.topPivot.rotation.set(-1.45, 0, -1.15 + close);
          rightArm.topPivot.rotation.set(-1.45, 0, 1.15 - close);
          leftArm.midPivot.rotation.x = -0.35;
          rightArm.midPivot.rotation.x = -0.35;
        }
      } else if (p === 'Bíceps') {
        if (rigType === 'free_bench_incline') {
          pelvisPivot.position.set(0, 0.53, 0.18);
          pelvisPivot.rotation.x = -0.68;
          setSeatedLegs(-0.82, 1.45);
          const curl = 0.18 + c * 1.85;
          leftArm.topPivot.rotation.x = 0.68;
          rightArm.topPivot.rotation.x = 0.68;
          leftArm.midPivot.rotation.x = -curl;
          rightArm.midPivot.rotation.x = -curl;
        } else if (exercise.equipment === 'Barra') {
          applyLegIK(0.88, 0, 0.044, 0);
          rootGroup.updateMatrixWorld(true);
          const curlAngle = -0.15 + c * 1.85;
          const handY = 1.13 - Math.cos(curlAngle) * 0.24;
          const handZ = 0.06 + Math.sin(curlAngle) * 0.24;
          anchorBarCenter.set(0, handY, handZ);
          useBarCenter = true;
          targetHandL.set(-0.24, handY, handZ);
          targetHandR.set(0.24, handY, handZ);
          poleElbowL.set(-0.24, 1.12, 0.02);
          poleElbowR.set(0.24, 1.12, 0.02);
          solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
          solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        } else {
          applyLegIK(0.88, 0, 0.044, 0);
          const curl = 0.18 + c * 1.85;
          leftArm.topPivot.rotation.x = -0.05;
          rightArm.topPivot.rotation.x = -0.05;
          leftArm.midPivot.rotation.x = -curl;
          rightArm.midPivot.rotation.x = -curl;
        }
      } else if (p === 'Tríceps') {
        if (id === 'skull_crusher_barbell') {
          pelvisPivot.position.set(0, 0.51, 0.26);
          pelvisPivot.rotation.x = -Math.PI / 2;
          leftLeg.topPivot.rotation.x = -0.2;
          leftLeg.midPivot.rotation.x = Math.PI / 2 + 0.2;
          rightLeg.topPivot.rotation.x = -0.2;
          rightLeg.midPivot.rotation.x = Math.PI / 2 + 0.2;

          rootGroup.updateMatrixWorld(true);
          const handY = 0.68 + c * 0.32;
          const handZ = -0.42 + c * 0.16;
          anchorBarCenter.set(0, handY, handZ);
          useBarCenter = true;
          targetHandL.set(-0.16, handY, handZ);
          targetHandR.set(0.16, handY, handZ);
          poleElbowL.set(-0.18, 0.8, -0.28);
          poleElbowR.set(0.18, 0.8, -0.28);
          solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
          solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        } else if (id === 'triceps_kickback_dumbbell') {
          applyLegIK(0.84, -0.08, 0.044, 0);
          pelvisPivot.position.set(0, 0.84, -0.08);
          spinePivot.rotation.x = 0.92;
          leftArm.topPivot.rotation.x = 0.45;
          rightArm.topPivot.rotation.x = 0.45;
          const ext = 1.65 - c * 1.5;
          leftArm.midPivot.rotation.x = -ext;
          rightArm.midPivot.rotation.x = -ext;
        } else if (id.includes('overhead')) {
          applyLegIK(0.88, 0, 0.044, 0);
          leftArm.topPivot.rotation.x = -2.85;
          rightArm.topPivot.rotation.x = -2.85;
          const ext = 1.75 - c * 1.45;
          leftArm.midPivot.rotation.x = -ext;
          rightArm.midPivot.rotation.x = -ext;
        } else {
          applyLegIK(0.88, 0, 0.044, 0);
          leftArm.topPivot.rotation.x = 0.05;
          rightArm.topPivot.rotation.x = 0.05;
          const push = 1.7 - c * 1.45;
          leftArm.midPivot.rotation.x = -push;
          rightArm.midPivot.rotation.x = -push;
        }
      } else if (p === 'Core') {
        if (id.includes('hanging')) {
          pelvisPivot.position.set(0, 1.2, 0);
          leftLeg.topPivot.rotation.x = -0.15 - c * 1.45;
          rightLeg.topPivot.rotation.x = -0.15 - c * 1.45;
          if (id === 'hanging_knee_raise') {
            leftLeg.midPivot.rotation.x = 1.5;
            rightLeg.midPivot.rotation.x = 1.5;
          }
          rootGroup.updateMatrixWorld(true);
          targetHandL.set(-0.32, 2.22, 0);
          targetHandR.set(0.32, 2.22, 0);
          poleElbowL.set(-0.38, 1.9, 0.22);
          poleElbowR.set(0.38, 1.9, 0.22);
          solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
          solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        } else if (id === 'cable_crunch') {
          pelvisPivot.position.set(0, 0.46, -0.05);
          setSeatedLegs(-0.1, 1.55);
          spinePivot.rotation.x = 0.18 + c * 0.92;
          leftArm.topPivot.rotation.set(-2.35, 0, -0.2);
          rightArm.topPivot.rotation.set(-2.35, 0, 0.2);
          leftArm.midPivot.rotation.x = -1.6;
          rightArm.midPivot.rotation.x = -1.6;
        } else if (id === 'plank') {
          pelvisPivot.position.set(0, 0.28 + c * 0.015, 0.06);
          pelvisPivot.rotation.x = 1.46;
          leftArm.topPivot.rotation.set(-1.35, 0, -0.12);
          rightArm.topPivot.rotation.set(-1.35, 0, 0.12);
          leftArm.midPivot.rotation.x = -1.45;
          rightArm.midPivot.rotation.x = -1.45;
        } else if (id === 'side_plank') {
          pelvisPivot.position.set(0, 0.26 + c * 0.02, 0);
          pelvisPivot.rotation.set(0, 0, -1.36);
          leftArm.topPivot.rotation.set(0, 0, -1.35);
          leftArm.midPivot.rotation.x = -1.45;
          rightArm.topPivot.rotation.set(0, 0, 0.35);
        } else if (id === 'ab_wheel_rollout') {
          pelvisPivot.position.set(0, 0.44 - c * 0.14, -0.15 + c * 0.22);
          pelvisPivot.rotation.x = 0.72 + c * 0.65;
          setSeatedLegs(-0.15, 1.55);
          leftArm.topPivot.rotation.set(-1.55 - c * 0.65, 0, -0.1);
          rightArm.topPivot.rotation.set(-1.55 - c * 0.65, 0, 0.1);
        } else if (id === 'cable_woodchopper') {
          applyLegIK(0.88, 0, 0.044, 0);
          const rot = -0.65 + c * 1.3;
          spinePivot.rotation.y = rot;
          leftArm.topPivot.rotation.set(-1.35 + (1 - c) * 0.45, rot * 0.3, -0.2);
          rightArm.topPivot.rotation.set(-1.35 + (1 - c) * 0.45, rot * 0.3, 0.2);
        } else if (id === 'russian_twist') {
          pelvisPivot.position.set(0, 0.14, 0);
          pelvisPivot.rotation.x = -0.58;
          setSeatedLegs(-0.95, 1.25);
          spinePivot.rotation.y = (c - 0.5) * 1.45;
          leftArm.topPivot.rotation.set(-0.95, 0, 0.25);
          rightArm.topPivot.rotation.set(-0.95, 0, -0.25);
          leftArm.midPivot.rotation.x = -0.8;
          rightArm.midPivot.rotation.x = -0.8;
        } else {
          // Crunch / Bicycle crunch en colchoneta
          pelvisPivot.position.set(0, 0.12, 0.16);
          pelvisPivot.rotation.x = -Math.PI / 2;
          if (id === 'bicycle_crunch') {
            leftLeg.topPivot.rotation.x = -1.25 + c * 0.8;
            rightLeg.topPivot.rotation.x = -0.45 - c * 0.8;
            leftLeg.midPivot.rotation.x = 1.45;
            rightLeg.midPivot.rotation.x = 1.45;
            spinePivot.rotation.set(0.35 + c * 0.45, (c - 0.5) * 0.8, 0);
          } else {
            leftLeg.topPivot.rotation.x = -0.85;
            leftLeg.midPivot.rotation.x = 1.65;
            rightLeg.topPivot.rotation.x = -0.85;
            rightLeg.midPivot.rotation.x = 1.65;
            spinePivot.rotation.x = 0.22 + c * 0.65;
          }
          leftArm.topPivot.rotation.set(-2.35, 0, -0.45);
          rightArm.topPivot.rotation.set(-2.35, 0, 0.45);
          leftArm.midPivot.rotation.x = -1.7;
          rightArm.midPivot.rotation.x = -1.7;
        }
      } else if (p === 'Gemelos') {
        const lift = c * 0.08;
        pelvisPivot.position.set(0, 0.88 + lift, 0);
        leftLeg.endPivot.rotation.x = c * 0.32;
        rightLeg.endPivot.rotation.x = c * 0.32;
      }

      // Actualizar matrices finales del esqueleto y sincronizar maquinaria/cables/barra libre
      rootGroup.updateMatrixWorld(true);

      leftArm.endPivot.getWorldPosition(leftHandPos);
      rightArm.endPivot.getWorldPosition(rightHandPos);
      leftLeg.endPivot.getWorldPosition(leftAnklePos);
      rightLeg.endPivot.getWorldPosition(rightAnklePos);
      leftLeg.midPivot.getWorldPosition(leftKneePos);
      rightLeg.midPivot.getWorldPosition(rightKneePos);
      leftArm.midPivot.getWorldPosition(leftElbowPos);
      rightArm.midPivot.getWorldPosition(rightElbowPos);
      pelvisPivot.getWorldPosition(pelvisPos);
      chestPivot.getWorldPosition(chestPos);

      gymRig.update({
        c,
        leftHand: leftHandPos,
        rightHand: rightHandPos,
        leftAnkle: leftAnklePos,
        rightAnkle: rightAnklePos,
        leftKnee: leftKneePos,
        rightKnee: rightKneePos,
        leftElbow: leftElbowPos,
        rightElbow: rightElbowPos,
        pelvis: pelvisPos,
        chest: chestPos,
        barCenter: useBarCenter ? anchorBarCenter : undefined,
      });

      if (freeBarbellGroup) {
        if (useExplicitBarQuat) {
          freeBarbellGroup.quaternion.copy(explicitBarQuat);
        } else {
          barDir.copy(rightHandPos).sub(leftHandPos);
          if (barDir.lengthSq() > 0.0001) {
            barDir.normalize();
            freeBarbellGroup.quaternion.setFromUnitVectors(xAxis, barDir);
          }
        }
        if (useBarCenter) {
          freeBarbellGroup.position.copy(anchorBarCenter);
        } else {
          handMidPos.copy(leftHandPos).add(rightHandPos).multiplyScalar(0.5);
          freeBarbellGroup.position.copy(handMidPos);
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    frameId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 480;
      const h = container.clientHeight || 360;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
    };
  }, [exercise, muscleProfile]);

  return (
    <div className="w-full h-[320px] sm:h-[380px] rounded-xl overflow-hidden bg-slate-900 border border-border/60 relative select-none">
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />
      <div className="pointer-events-none absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-slate-950/75 backdrop-blur-xs border border-slate-700/70 text-[11px] font-semibold text-slate-200">
        {rigMeta.badge}
      </div>

      {/* Leyenda anatómica en tiempo real (Primarios vs Secundarios) */}
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-[80%] px-3 py-2 rounded-lg bg-slate-950/80 backdrop-blur-xs border border-slate-700/70 text-[11px] text-slate-200 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 font-semibold text-rose-300">
            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.9)]" />
            <span>Primario:</span>
          </span>
          <span className="text-slate-100 font-medium">{primaryLabels}</span>
        </div>
        {secondaryLabels && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(250,204,21,0.75)]" />
              <span>Secundario:</span>
            </span>
            <span className="text-slate-300">{secondaryLabels}</span>
          </div>
        )}
        <div className="pt-0.5 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 shrink-0">Activación</span>
          <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden min-w-[72px]">
            <div
              ref={tensionBarRef}
              className="h-full rounded-full bg-gradient-to-r from-rose-500 via-red-500 to-amber-400 transition-[width] duration-75"
              style={{ width: highlightMuscles ? '50%' : '0%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
