'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CatalogExercise } from '@/lib/exercise-catalog';
import {
  buildAnatomicalMannequin,
  createMuscleStriationTextures,
  LimbRig,
} from '@/lib/three-anatomical-mannequin';
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

// Paletas de estudio reutilizables para evitar asignaciones por frame
const LIGHT_BG = new THREE.Color('#f8fafc');
const DARK_BG = new THREE.Color('#0c1322');

const NEUTRAL_LIGHT = new THREE.Color('#cfd6e0');
const NEUTRAL_DARK = new THREE.Color('#b6c2d2');
const BODY_LIGHT = new THREE.Color('#d8dee7');
const BODY_DARK = new THREE.Color('#bdc8d6');
const SKIN_LIGHT = new THREE.Color('#dce2ea');
const SKIN_DARK = new THREE.Color('#c2ccd9');
const TENDON_LIGHT = new THREE.Color('#bcc5d3');
const TENDON_DARK = new THREE.Color('#9aa7ba');
const SHORTS_LIGHT = new THREE.Color('#1d222b');
const SHORTS_DARK = new THREE.Color('#1a1f29');

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
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  );
  const isDarkRef = useRef(isDark);
  const applySceneThemeRef = useRef<((dark: boolean) => void) | null>(null);
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
    if (typeof document === 'undefined') return;
    const syncTheme = () => {
      const nextDark = document.documentElement.classList.contains('dark');
      isDarkRef.current = nextDark;
      setIsDark(nextDark);
      applySceneThemeRef.current?.(nextDark);
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

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
    const initialDark =
      typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false;
    isDarkRef.current = initialDark;

    // Escena y Fondo de Estudio Infinito Limpio (adaptado dinámicamente al tema claro / oscuro)
    const scene = new THREE.Scene();
    scene.background = (initialDark ? DARK_BG : LIGHT_BG).clone();
    scene.fog = new THREE.Fog(initialDark ? '#0c1322' : '#f8fafc', 7.5, 16);

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

    // Renderizador WebGL con ACESFilmicToneMapping para brillos anatómicos naturales
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
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

    // Iluminación de Estudio Fotográfico (3 puntos + hemisferio suave)
    const hemiLight = new THREE.HemisphereLight(
      initialDark ? '#e2e8f0' : '#ffffff',
      initialDark ? '#1e293b' : '#cbd5e1',
      initialDark ? 0.95 : 1.18
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#ffffff', initialDark ? 1.65 : 1.5);
    keyLight.position.set(3.2, 5.5, 4.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 16;
    keyLight.shadow.camera.left = -2.4;
    keyLight.shadow.camera.right = 2.4;
    keyLight.shadow.camera.top = 2.8;
    keyLight.shadow.camera.bottom = -1.4;
    keyLight.shadow.bias = -0.0004;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight('#e2e8f0', initialDark ? 0.42 : 0.58);
    fillLight.position.set(-3.0, 2.4, 3.2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(
      initialDark ? '#60a5fa' : '#ffffff',
      initialDark ? 0.78 : 0.48
    );
    rimLight.position.set(-2.5, 3.4, -3.5);
    scene.add(rimLight);

    // Suelo de estudio sin banda de horizonte (ShadowMaterial transparente directo sobre el fondo)
    const shadowGeo = new THREE.CircleGeometry(6.0, 64);
    const shadowCatcherMat = new THREE.ShadowMaterial({
      color: initialDark ? '#020617' : '#0f172a',
      opacity: initialDark ? 0.42 : 0.16,
    });
    const shadowCatcher = new THREE.Mesh(shadowGeo, shadowCatcherMat);
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = 0.001;
    shadowCatcher.receiveShadow = true;
    scene.add(shadowCatcher);

    // Texturas procedurales de estrías musculares en memoria + Materiales anatómicos
    const striations = createMuscleStriationTextures();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: (initialDark ? BODY_DARK : BODY_LIGHT).clone(),
      map: striations.albedoMap,
      bumpMap: striations.bumpMap,
      bumpScale: 0.005,
      roughness: 0.56,
      metalness: 0.04,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: (initialDark ? SKIN_DARK : SKIN_LIGHT).clone(),
      roughness: 0.62,
      metalness: 0.03,
    });
    const tendonMat = new THREE.MeshStandardMaterial({
      color: (initialDark ? TENDON_DARK : TENDON_LIGHT).clone(),
      roughness: 0.54,
      metalness: 0.04,
    });
    const shortsMat = new THREE.MeshStandardMaterial({
      color: (initialDark ? SHORTS_DARK : SHORTS_LIGHT).clone(),
      roughness: 0.74,
      metalness: 0.06,
    });

    // Materiales de equipamiento libre (hierro negro mate + cromo)
    const barChromeMat = new THREE.MeshStandardMaterial({
      color: '#e5e7eb',
      roughness: 0.18,
      metalness: 0.88,
    });
    const barGripMat = new THREE.MeshStandardMaterial({
      color: '#11151d',
      roughness: 0.88,
      metalness: 0.08,
    });
    const ironPlateMat = new THREE.MeshStandardMaterial({
      color: '#1c2028',
      roughness: 0.48,
      metalness: 0.35,
    });
    const plateHubMat = new THREE.MeshStandardMaterial({
      color: '#94a3b8',
      roughness: 0.28,
      metalness: 0.65,
    });

    const createMuscleMat = (initialColor: THREE.Color) =>
      new THREE.MeshStandardMaterial({
        color: initialColor.clone(),
        map: striations.albedoMap,
        bumpMap: striations.bumpMap,
        bumpScale: 0.012,
        emissive: new THREE.Color('#ef4444'),
        emissiveIntensity: 0,
        roughness: 0.46,
        metalness: 0.06,
      });

    const defaultMuscleNeutral = initialDark ? NEUTRAL_DARK : NEUTRAL_LIGHT;
    const defaultShortsNeutral = initialDark ? SHORTS_DARK : SHORTS_LIGHT;

    const muscleMats: Record<AnatomicalMuscleId, THREE.MeshStandardMaterial> = {
      chest: createMuscleMat(defaultMuscleNeutral),
      upper_back: createMuscleMat(defaultMuscleNeutral),
      traps: createMuscleMat(defaultMuscleNeutral),
      lower_back: createMuscleMat(defaultMuscleNeutral),
      abs: createMuscleMat(defaultMuscleNeutral),
      shoulders: createMuscleMat(defaultMuscleNeutral),
      biceps: createMuscleMat(defaultMuscleNeutral),
      triceps: createMuscleMat(defaultMuscleNeutral),
      forearms: createMuscleMat(defaultMuscleNeutral),
      glutes: createMuscleMat(defaultShortsNeutral),
      quads: createMuscleMat(defaultMuscleNeutral),
      hamstrings: createMuscleMat(defaultMuscleNeutral),
      adductors: createMuscleMat(defaultMuscleNeutral),
      calves: createMuscleMat(defaultMuscleNeutral),
    };

    applySceneThemeRef.current = (dark: boolean) => {
      scene.background = (dark ? DARK_BG : LIGHT_BG).clone();
      scene.fog = new THREE.Fog(dark ? '#0c1322' : '#f8fafc', 7.5, 16);
      shadowCatcherMat.color.set(dark ? '#020617' : '#0f172a');
      shadowCatcherMat.opacity = dark ? 0.42 : 0.16;

      hemiLight.color.set(dark ? '#e2e8f0' : '#ffffff');
      hemiLight.groundColor.set(dark ? '#1e293b' : '#cbd5e1');
      hemiLight.intensity = dark ? 0.95 : 1.18;
      keyLight.intensity = dark ? 1.65 : 1.5;
      fillLight.intensity = dark ? 0.42 : 0.58;
      rimLight.color.set(dark ? '#60a5fa' : '#ffffff');
      rimLight.intensity = dark ? 0.78 : 0.48;

      bodyMat.color.copy(dark ? BODY_DARK : BODY_LIGHT);
      skinMat.color.copy(dark ? SKIN_DARK : SKIN_LIGHT);
      tendonMat.color.copy(dark ? TENDON_DARK : TENDON_LIGHT);
      shortsMat.color.copy(dark ? SHORTS_DARK : SHORTS_LIGHT);
    };

    const primarySet = new Set<AnatomicalMuscleId>(muscleProfile.primary);
    const secondarySet = new Set<AnatomicalMuscleId>(muscleProfile.secondary);
    const allMuscleIds = Object.keys(muscleMats) as AnatomicalMuscleId[];

    // ==============================================
    // CONSTRUCCIÓN DEL MANIQUÍ ANATÓMICO ESCULPIDO
    // ==============================================
    const mannequin = buildAnatomicalMannequin({
      muscleMats,
      bodyMat,
      tendonMat,
      shortsMat,
      skinMat,
    });
    const {
      rootGroup,
      pelvisPivot,
      spinePivot,
      chestPivot,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      dispose: disposeMannequin,
    } = mannequin;
    scene.add(rootGroup);

    const LEG_UPPER = leftLeg.upperLen;
    const LEG_LOWER = leftLeg.lowerLen;

    // Barra libre / Mancuernas con discos negros mate y bujes metálicos
    let freeBarbellGroup: THREE.Group | null = null;
    if (exercise.equipment === 'Barra' && !gymRig.usesOwnBarbell) {
      freeBarbellGroup = new THREE.Group();
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 1.46, 14),
        barChromeMat
      );
      bar.rotation.z = Math.PI / 2;
      bar.castShadow = true;
      freeBarbellGroup.add(bar);

      // Agarres moleteados negros en barra
      [-0.3, 0.3].forEach((gx) => {
        const grip = new THREE.Mesh(
          new THREE.CylinderGeometry(0.019, 0.019, 0.22, 12),
          barGripMat
        );
        grip.rotation.z = Math.PI / 2;
        grip.position.x = gx;
        freeBarbellGroup!.add(grip);
      });

      [-0.54, 0.54].forEach((px) => {
        const plate = new THREE.Mesh(
          new THREE.CylinderGeometry(0.165, 0.165, 0.042, 24),
          ironPlateMat
        );
        plate.rotation.z = Math.PI / 2;
        plate.position.x = px;
        plate.castShadow = true;
        freeBarbellGroup!.add(plate);

        const hub = new THREE.Mesh(
          new THREE.CylinderGeometry(0.056, 0.056, 0.048, 16),
          plateHubMat
        );
        hub.rotation.z = Math.PI / 2;
        hub.position.x = px;
        freeBarbellGroup!.add(hub);
      });
      scene.add(freeBarbellGroup);
    } else if (exercise.equipment === 'Mancuernas') {
      const createDumbbell = () => {
        const db = new THREE.Group();
        const handle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.014, 0.014, 0.16, 12),
          barChromeMat
        );
        handle.rotation.z = Math.PI / 2;
        db.add(handle);
        const w1 = new THREE.Mesh(
          new THREE.CylinderGeometry(0.062, 0.062, 0.036, 16),
          ironPlateMat
        );
        w1.rotation.z = Math.PI / 2;
        w1.position.x = -0.065;
        w1.castShadow = true;
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
        const dbL = createDumbbell();
        const dbR = createDumbbell();
        if (
          exercise.pattern === 'Aislamiento Pectoral' ||
          exercise.pattern === 'Tracción Horizontal' ||
          exercise.id === 'hammer_curl_dumbbell' ||
          exercise.id === 'triceps_kickback_dumbbell'
        ) {
          dbL.rotation.y = Math.PI / 2;
          dbR.rotation.y = Math.PI / 2;
        }
        leftArm.endPivot.add(dbL);
        rightArm.endPivot.add(dbR);
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

    const applyWorldLegIK = (
      footY: number,
      footZ: number,
      which: 'both' | 'left' | 'right' = 'both'
    ) => {
      const pelvisRotX = pelvisPivot.rotation.x;
      const hipWorldY = pelvisPivot.position.y - 0.03 * Math.cos(pelvisRotX);
      const hipWorldZ = pelvisPivot.position.z - 0.03 * Math.sin(pelvisRotX);
      const ik = solveSagittalLegIK(hipWorldY, hipWorldZ, footY, footZ, LEG_UPPER, LEG_LOWER);
      if (which === 'both' || which === 'left') {
        leftLeg.topPivot.rotation.x = ik.hipAngleX - pelvisRotX;
        leftLeg.midPivot.rotation.x = ik.kneeAngleX;
        leftLeg.endPivot.rotation.x = ik.ankleAngleX;
      }
      if (which === 'both' || which === 'right') {
        rightLeg.topPivot.rotation.x = ik.hipAngleX - pelvisRotX;
        rightLeg.midPivot.rotation.x = ik.kneeAngleX;
        rightLeg.endPivot.rotation.x = ik.ankleAngleX;
      }
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
        phaseTime += dt * 1.75 * speedRef.current;
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
      const darkTheme = isDarkRef.current;
      const neutralCol = darkTheme ? NEUTRAL_DARK : NEUTRAL_LIGHT;
      const gluteShortsCol = darkTheme ? SHORTS_DARK : SHORTS_LIGHT;

      if (highlightRef.current) {
        for (const mId of allMuscleIds) {
          const mat = muscleMats[mId];
          if (primarySet.has(mId)) {
            mat.color.copy(PRIMARY_LOW).lerp(PRIMARY_HIGH, act);
            mat.emissive.copy(PRIMARY_EMISSIVE);
            mat.emissiveIntensity = darkTheme ? 0.12 + act * 0.78 : 0.06 + act * 0.42;
          } else if (secondarySet.has(mId)) {
            mat.color.copy(SECONDARY_LOW).lerp(SECONDARY_HIGH, act);
            mat.emissive.copy(SECONDARY_EMISSIVE);
            mat.emissiveIntensity = darkTheme ? 0.08 + act * 0.46 : 0.04 + act * 0.26;
          } else {
            mat.color.copy(mId === 'glutes' ? gluteShortsCol : neutralCol);
            mat.emissiveIntensity = 0;
          }
        }
        if (tensionBarRef.current) {
          tensionBarRef.current.style.width = `${Math.round(act * 100)}%`;
        }
      } else {
        for (const mId of allMuscleIds) {
          const mat = muscleMats[mId];
          mat.color.copy(mId === 'glutes' ? gluteShortsCol : neutralCol);
          mat.emissiveIntensity = 0;
        }
      }

      resetPose();

      let useBarCenter = false;
      let useExplicitBarQuat = false;

      // ============================================================
      // 1) RIGS DE MÁQUINAS ESPECÍFICAS Y POLEAS ESPECIALES (RANGO COMPLETO)
      // ============================================================
      if (rigType === 'smith_split_squat') {
        const railZ = gymRig.smithRailZ ?? -0.06;
        const hipY = 0.88 - c * 0.38;
        const hipZ = 0.085 - c * 0.015;
        pelvisPivot.position.set(0, hipY, hipZ);
        spinePivot.rotation.x = 0.12;
        const frontIk = solveSagittalLegIK(hipY - 0.03, hipZ, 0.044, 0.32, LEG_UPPER, LEG_LOWER);
        leftLeg.topPivot.rotation.x = frontIk.hipAngleX;
        leftLeg.midPivot.rotation.x = frontIk.kneeAngleX;
        leftLeg.endPivot.rotation.x = frontIk.ankleAngleX;
        rightLeg.topPivot.rotation.x = 0.4 + c * 0.28;
        rightLeg.midPivot.rotation.x = 0.85 + c * 0.68;

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
        const slide = c * 0.46;
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
        const footY = 0.64 + push * 0.34;
        const footZ = 0.24 + push * 0.28;
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
        const spread = id.includes('abduction') ? 0.08 + c * 0.48 : 0.56 - c * 0.48;
        leftLeg.topPivot.rotation.z = -spread;
        rightLeg.topPivot.rotation.z = spread;
        leftArm.topPivot.rotation.set(0.1, 0, -0.22);
        rightArm.topPivot.rotation.set(0.1, 0, 0.22);
        leftArm.midPivot.rotation.x = -0.85;
        rightArm.midPivot.rotation.x = -0.85;
      } else if (rigType === 'calf_machine_standing') {
        const lift = -0.02 + c * 0.11;
        pelvisPivot.position.set(0, 0.96 + lift, 0);
        leftLeg.endPivot.rotation.x = -0.14 + c * 0.56;
        rightLeg.endPivot.rotation.x = -0.14 + c * 0.56;
        leftArm.topPivot.rotation.set(-1.35, 0, -0.2);
        rightArm.topPivot.rotation.set(-1.35, 0, 0.2);
        leftArm.midPivot.rotation.x = -1.6;
        rightArm.midPivot.rotation.x = -1.6;
      } else if (rigType === 'calf_machine_seated') {
        pelvisPivot.position.set(0, 0.55, -0.02);
        setSeatedLegs(-1.48, 1.52);
        const lift = -0.14 + c * 0.56;
        leftLeg.topPivot.rotation.x = -1.48 - Math.max(0, lift) * 0.25;
        rightLeg.topPivot.rotation.x = -1.48 - Math.max(0, lift) * 0.25;
        leftLeg.endPivot.rotation.x = lift;
        rightLeg.endPivot.rotation.x = lift;
        leftArm.topPivot.rotation.set(-0.45, 0, -0.1);
        rightArm.topPivot.rotation.set(-0.45, 0, 0.1);
        leftArm.midPivot.rotation.x = -0.6;
        rightArm.midPivot.rotation.x = -0.6;
      } else if (rigType === 'dip_station') {
        const dipY = 0.68 + c * 0.38;
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
          const pull = c * 1.32;
          leftArm.topPivot.rotation.set(-1.42, -pull, -0.08 - pull * 0.68);
          rightArm.topPivot.rotation.set(-1.42, pull, 0.08 + pull * 0.68);
        } else {
          const close = c * 1.3;
          leftArm.topPivot.rotation.set(-1.45, 0, -1.38 + close);
          rightArm.topPivot.rotation.set(-1.45, 0, 1.38 - close);
        }
        leftArm.midPivot.rotation.x = -0.36;
        rightArm.midPivot.rotation.x = -0.36;
      } else if (rigType === 'machine_lateral_raise') {
        pelvisPivot.position.set(0, 0.55, 0.04);
        setSeatedLegs(-1.42, 1.42);
        const abd = 0.08 + c * 1.48;
        leftArm.topPivot.rotation.set(-0.15, 0, -abd);
        rightArm.topPivot.rotation.set(-0.15, 0, abd);
        leftArm.midPivot.rotation.x = -1.1;
        rightArm.midPivot.rotation.x = -1.1;
      } else if (rigType === 'smith_shoulder_press') {
        pelvisPivot.position.set(0, 0.55, 0.04);
        setSeatedLegs(-1.42, 1.42);
        const barY = 1.03 + c * 0.5;
        const barZ = gymRig.smithRailZ ?? 0.14;
        anchorBarCenter.set(0, barY, barZ);
        useBarCenter = true;
        rootGroup.updateMatrixWorld(true);
        targetHandL.set(-0.36, barY, barZ);
        targetHandR.set(0.36, barY, barZ);
        poleElbowL.set(-0.44, 0.8 + c * 0.14, barZ + 0.16);
        poleElbowR.set(0.44, 0.8 + c * 0.14, barZ + 0.16);
        solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
        solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
      } else if (rigType === 'machine_lat_pulldown') {
        pelvisPivot.position.set(0, 0.55, 0.02);
        setSeatedLegs(-1.42, 1.42);
        spinePivot.rotation.x = -0.1 * c;
        const pullDown = -3.02 + c * 1.75;
        leftArm.topPivot.rotation.set(pullDown, 0, -0.32 - c * 0.25);
        rightArm.topPivot.rotation.set(pullDown, 0, 0.32 + c * 0.25);
        leftArm.midPivot.rotation.x = -0.08 - c * 1.52;
        rightArm.midPivot.rotation.x = -0.08 - c * 1.52;
      } else if (rigType === 'preacher_bench') {
        pelvisPivot.position.set(0, 0.55, -0.18);
        setSeatedLegs(-1.35, 1.35);
        spinePivot.rotation.x = 0.22;
        rootGroup.updateMatrixWorld(true);
        const gripX = exercise.equipment === 'Barra' ? 0.19 : 0.18;
        const handY = 0.66 + c * 0.48;
        const handZ = 0.42 - c * 0.24;
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
        const hipY = 0.16 + c * 0.28;
        const hipZ = -0.02;
        pelvisPivot.position.set(0, hipY, hipZ);
        pelvisPivot.rotation.x = -0.82 - c * 0.7;
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
        spinePivot.rotation.x = 1.12 - c * 1.08;
        leftArm.topPivot.rotation.set(-1.3, 0, 0.35);
        rightArm.topPivot.rotation.set(-1.3, 0, -0.35);
        leftArm.midPivot.rotation.x = -1.6;
        rightArm.midPivot.rotation.x = -1.6;

      // ============================================================
      // 2) PATRONES DE MOVIMIENTO Y EJERCICIOS ESPECÍFICOS (RANGO COMPLETO)
      // ============================================================
      } else if (p === 'Empuje Horizontal') {
        if (id.includes('push_up') || id.includes('pushup')) {
          const baseY = id === 'incline_push_up' ? 0.25 : 0.15;
          pelvisPivot.position.set(0, baseY + c * 0.22, -0.1);
          pelvisPivot.rotation.x = (id === 'incline_push_up' ? 1.24 : 1.44) - c * 0.14;
          rootGroup.updateMatrixWorld(true);
          const handX = id === 'diamond_push_up' ? 0.085 : 0.3;
          const handY = id === 'incline_push_up' ? 0.24 : 0.04;
          targetHandL.set(-handX, handY, 0.42);
          targetHandR.set(handX, handY, 0.42);
          poleElbowL.set(-(handX + 0.1), handY + 0.24 + c * 0.18, 0.16);
          poleElbowR.set(handX + 0.1, handY + 0.24 + c * 0.18, 0.16);
          solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
          solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        } else if (rigType === 'cable_dual_crossover') {
          applyLegIK(0.88, 0, 0.044, 0);
          spinePivot.rotation.x = 0.14;
          const press = c;
          leftArm.topPivot.rotation.set(-1.35, -0.22 + press * 0.58, -1.2 + press * 1.08);
          rightArm.topPivot.rotation.set(-1.35, 0.22 - press * 0.58, 1.2 - press * 1.08);
          leftArm.midPivot.rotation.x = -1.1 + press * 0.98;
          rightArm.midPivot.rotation.x = -1.1 + press * 0.98;
        } else {
          // Press de banca plano (barra o mancuernas / smith_flat_bench)
          pelvisPivot.position.set(0, 0.51, 0.26);
          pelvisPivot.rotation.x = -Math.PI / 2;
          leftLeg.topPivot.rotation.x = -0.2;
          leftLeg.midPivot.rotation.x = Math.PI / 2 + 0.2;
          rightLeg.topPivot.rotation.x = -0.2;
          rightLeg.midPivot.rotation.x = Math.PI / 2 + 0.2;

          if (exercise.equipment === 'Barra' || rigType === 'smith_flat_bench') {
            const barY = 0.615 + c * 0.385;
            const barZ = gymRig.smithRailZ ?? -0.25;
            const gripX = id === 'close_grip_bench_press' ? 0.2 : 0.38;
            anchorBarCenter.set(0, barY, barZ);
            useBarCenter = true;
            rootGroup.updateMatrixWorld(true);
            targetHandL.set(-gripX, barY, barZ);
            targetHandR.set(gripX, barY, barZ);
            poleElbowL.set(-(gripX + 0.1), 0.4 + c * 0.14, barZ + 0.12);
            poleElbowR.set(gripX + 0.1, 0.4 + c * 0.14, barZ + 0.12);
            solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
            solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
          } else {
            // Press plano con mancuernas mediante IK analítica (antebrazos verticales y convergencia arriba)
            rootGroup.updateMatrixWorld(true);
            const handX = 0.38 - c * 0.23;
            const handY = 0.58 + c * 0.42;
            const handZ = -0.24 - c * 0.01;
            targetHandL.set(-handX, handY, handZ);
            targetHandR.set(handX, handY, handZ);
            poleElbowL.set(-(0.46 - c * 0.06), 0.34 + c * 0.22, -0.12);
            poleElbowR.set(0.46 - c * 0.06, 0.34 + c * 0.22, -0.12);
            solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
            solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
          }
        }
      } else if (p === 'Empuje Inclinado') {
        if (id === 'decline_push_up') {
          pelvisPivot.position.set(0, 0.26 + c * 0.2, -0.1);
          pelvisPivot.rotation.x = 1.62 - c * 0.12;
          rootGroup.updateMatrixWorld(true);
          targetHandL.set(-0.3, 0.04, 0.42);
          targetHandR.set(0.3, 0.04, 0.42);
          poleElbowL.set(-0.4, 0.28 + c * 0.18, 0.16);
          poleElbowR.set(0.4, 0.28 + c * 0.18, 0.16);
          solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
          solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        } else {
          pelvisPivot.position.set(0, 0.53, 0.18);
          pelvisPivot.rotation.x = -0.68;
          setSeatedLegs(-0.82, 1.45);
          if (exercise.equipment === 'Barra' || rigType === 'smith_incline_bench') {
            const barY = 0.955 + c * 0.46;
            const barZ = gymRig.smithRailZ ?? -0.15;
            anchorBarCenter.set(0, barY, barZ);
            useBarCenter = true;
            rootGroup.updateMatrixWorld(true);
            targetHandL.set(-0.38, barY, barZ);
            targetHandR.set(0.38, barY, barZ);
            poleElbowL.set(-0.46, 0.66 + c * 0.22, barZ + 0.14);
            poleElbowR.set(0.46, 0.66 + c * 0.22, barZ + 0.14);
            solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
            solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
          } else {
            // Press inclinado con mancuernas mediante IK analítica (empuje vertical + convergencia superior)
            rootGroup.updateMatrixWorld(true);
            const handX = 0.35 - c * 0.19;
            const handY = 0.91 + c * 0.515;
            const handZ = -0.09 - c * 0.05;
            targetHandL.set(-handX, handY, handZ);
            targetHandR.set(handX, handY, handZ);
            poleElbowL.set(-(0.45 - c * 0.05), 0.59 + c * 0.3, -0.02 - c * 0.04);
            poleElbowR.set(0.45 - c * 0.05, 0.59 + c * 0.3, -0.02 - c * 0.04);
            solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
            solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
          }
        }
      } else if (p === 'Empuje Vertical') {
        if (id === 'pike_push_up') {
          const hipY = 0.72 + c * 0.06;
          const hipZ = -0.04 - c * 0.08;
          pelvisPivot.position.set(0, hipY, hipZ);
          pelvisPivot.rotation.x = 2.42 - c * 0.32;
          spinePivot.rotation.x = 0;
          applyWorldLegIK(0.044, -0.44, 'both');
          rootGroup.updateMatrixWorld(true);
          targetHandL.set(-0.26, 0.04, 0.4);
          targetHandR.set(0.26, 0.04, 0.4);
          poleElbowL.set(-0.34, 0.34 + c * 0.12, 0.08);
          poleElbowR.set(0.34, 0.34 + c * 0.12, 0.08);
          solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
          solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        } else {
          const isSeated =
            id === 'seated_barbell_shoulder_press' || id === 'dumbbell_shoulder_press' || id === 'arnold_press';
          if (isSeated) {
            pelvisPivot.position.set(0, 0.55, 0.04);
            setSeatedLegs(-1.42, 1.42);
          } else {
            applyLegIK(0.88, 0, 0.044, 0);
          }

          if (exercise.equipment === 'Barra') {
            const baseShoulderY = isSeated ? 1.03 : 1.35;
            const barY = baseShoulderY + c * (isSeated ? 0.5 : 0.51);
            const barZ = 0.12;
            anchorBarCenter.set(0, barY, barZ);
            useBarCenter = true;
            rootGroup.updateMatrixWorld(true);
            targetHandL.set(-0.36, barY, barZ);
            targetHandR.set(0.36, barY, barZ);
            poleElbowL.set(-0.42, baseShoulderY - 0.2 + c * 0.14, barZ + 0.16);
            poleElbowR.set(0.42, baseShoulderY - 0.2 + c * 0.14, barZ + 0.16);
            solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
            solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
          } else {
            // Press militar con mancuernas mediante IK analítica (subida vertical real)
            const baseShoulderY = isSeated ? 1.07 : 1.4;
            rootGroup.updateMatrixWorld(true);
            const handX = 0.34 - c * 0.19;
            const handY = baseShoulderY + 0.02 + c * 0.46;
            const handZ = 0.06 - c * 0.02;
            targetHandL.set(-handX, handY, handZ);
            targetHandR.set(handX, handY, handZ);
            poleElbowL.set(-(0.4 - c * 0.04), baseShoulderY - 0.28 + c * 0.36, 0.14);
            poleElbowR.set(0.4 - c * 0.04, baseShoulderY - 0.28 + c * 0.36, 0.14);
            solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
            solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
          }
        }
      } else if (p === 'Tracción Horizontal') {
        if (id === 'inverted_table_row') {
          pelvisPivot.position.set(0, 0.28 + c * 0.3, 0);
          pelvisPivot.rotation.x = -1.22;
          rootGroup.updateMatrixWorld(true);
          targetHandL.set(-0.32, 0.92, -0.35);
          targetHandR.set(0.32, 0.92, -0.35);
          poleElbowL.set(-0.4, 0.42 + c * 0.1, -0.45);
          poleElbowR.set(0.4, 0.42 + c * 0.1, -0.45);
          solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
          solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        } else if (rigType === 'cable_low_row' || rigType === 'machine_row') {
          pelvisPivot.position.set(0, 0.56, 0);
          spinePivot.rotation.x = 0.12 - c * 0.12;
          setSeatedLegs(-1.35, 1.15);
          const pullBack = -1.48 + c * 1.58;
          leftArm.topPivot.rotation.x = pullBack;
          rightArm.topPivot.rotation.x = pullBack;
          leftArm.midPivot.rotation.x = -0.1 - c * 1.48;
          rightArm.midPivot.rotation.x = -0.1 - c * 1.48;
        } else if (id === 'chest_supported_dumbbell_row') {
          pelvisPivot.position.set(0, 0.53, 0.16);
          pelvisPivot.rotation.x = 0.72;
          setSeatedLegs(-0.82, 1.45);
          rootGroup.updateMatrixWorld(true);
          const handY = 0.44 + c * 0.36;
          const handZ = 0.48 - c * 0.22;
          targetHandL.set(-0.26, handY, handZ);
          targetHandR.set(0.26, handY, handZ);
          poleElbowL.set(-0.34, 0.72 + c * 0.24, 0.26 - c * 0.12);
          poleElbowR.set(0.34, 0.72 + c * 0.24, 0.26 - c * 0.12);
          solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
          solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        } else if (exercise.equipment === 'Barra') {
          applyLegIK(0.82, -0.08, 0.044, 0);
          pelvisPivot.position.set(0, 0.82, -0.08);
          spinePivot.rotation.x = 0.88;
          rootGroup.updateMatrixWorld(true);
          const barY = 0.46 + c * 0.34;
          const barZ = 0.36 - c * 0.15;
          anchorBarCenter.set(0, barY, barZ);
          useBarCenter = true;
          targetHandL.set(-0.34, barY, barZ);
          targetHandR.set(0.34, barY, barZ);
          poleElbowL.set(-0.4, 1.05 + c * 0.1, 0.1);
          poleElbowR.set(0.4, 1.05 + c * 0.1, 0.1);
          solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
          solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        } else {
          applyLegIK(0.82, -0.08, 0.044, 0);
          pelvisPivot.position.set(0, 0.82, -0.08);
          spinePivot.rotation.x = 0.84;
          rootGroup.updateMatrixWorld(true);
          const handY = 0.46 + c * 0.34;
          const handZ = 0.36 - c * 0.18;
          targetHandL.set(-0.26, handY, handZ);
          targetHandR.set(0.26, handY, handZ);
          poleElbowL.set(-0.34, 0.98 + c * 0.14, 0.14 - c * 0.1);
          poleElbowR.set(0.34, 0.98 + c * 0.14, 0.14 - c * 0.1);
          solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
          solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        }
      } else if (p === 'Tracción Vertical') {
        if (id === 'bodyweight_superman_pull') {
          pelvisPivot.position.set(0, 0.11, 0.1);
          pelvisPivot.rotation.x = Math.PI / 2;
          spinePivot.rotation.x = -0.15 - c * 0.18;
          leftLeg.topPivot.rotation.x = -0.16;
          rightLeg.topPivot.rotation.x = -0.16;
          leftArm.topPivot.rotation.set(-2.9 + c * 1.45, 0, -0.22 - c * 0.35);
          rightArm.topPivot.rotation.set(-2.9 + c * 1.45, 0, 0.22 + c * 0.35);
          leftArm.midPivot.rotation.x = -0.15 - c * 1.35;
          rightArm.midPivot.rotation.x = -0.15 - c * 1.35;
        } else if (id === 'straight_arm_pulldown') {
          applyLegIK(0.88, -0.06, 0.044, 0);
          pelvisPivot.position.set(0, 0.88, -0.06);
          spinePivot.rotation.x = 0.26;
          const sweep = -2.55 + c * 2.15;
          leftArm.topPivot.rotation.set(sweep, 0, -0.12);
          rightArm.topPivot.rotation.set(sweep, 0, 0.12);
          leftArm.midPivot.rotation.x = -0.12;
          rightArm.midPivot.rotation.x = -0.12;
        } else if (rigType === 'cable_high_bar') {
          pelvisPivot.position.set(0, 0.56, 0.02);
          spinePivot.rotation.x = -0.14 * c;
          setSeatedLegs(-1.4, 1.38);
          const pullDown = -3.02 + c * 1.75;
          leftArm.topPivot.rotation.set(pullDown, 0, -0.32 - c * 0.26);
          rightArm.topPivot.rotation.set(pullDown, 0, 0.32 + c * 0.26);
          leftArm.midPivot.rotation.x = -0.08 - c * 1.52;
          rightArm.midPivot.rotation.x = -0.08 - c * 1.52;
        } else {
          // Dominadas con extensión completa abajo -> barbilla sobre barra arriba
          const pullY = 1.18 + c * 0.44;
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
          const ext = 1.58 - c * 1.52;
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
          id === 'bodyweight_bulgarian_split_squat' ||
          id === 'bodyweight_lunge' ||
          id === 'step_up_dumbbell'
        ) {
          const hipY = 0.88 - c * 0.38;
          const hipZ = -c * 0.05;
          pelvisPivot.position.set(0, hipY, hipZ);
          spinePivot.rotation.x = c * 0.16;
          const frontIk = solveSagittalLegIK(hipY - 0.03, hipZ, 0.044, 0.3, LEG_UPPER, LEG_LOWER);
          leftLeg.topPivot.rotation.x = frontIk.hipAngleX;
          leftLeg.midPivot.rotation.x = frontIk.kneeAngleX;
          leftLeg.endPivot.rotation.x = frontIk.ankleAngleX;
          rightLeg.topPivot.rotation.x = 0.36 + c * 0.26;
          rightLeg.midPivot.rotation.x = 0.65 + c * 0.85;

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
          // Sentadilla profunda (rompiendo paralelo) hasta extensión completa
          const hipY = 0.88 - c * 0.45;
          const hipZ = -c * 0.19;
          pelvisPivot.position.set(0, hipY, hipZ);
          spinePivot.rotation.x = id === 'squat_front_barbell' ? c * 0.22 : c * 0.38;
          applyLegIK(hipY, hipZ, 0.044, 0);
          if (id === 'sumo_squat') {
            leftLeg.topPivot.rotation.z = -0.24;
            rightLeg.topPivot.rotation.z = 0.24;
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
          } else {
            // Air squat libre: brazos al frente como contrapeso
            leftArm.topPivot.rotation.set(-1.35 * c, 0, -0.08);
            rightArm.topPivot.rotation.set(-1.35 * c, 0, 0.08);
            leftArm.midPivot.rotation.x = -0.15;
            rightArm.midPivot.rotation.x = -0.15;
          }
        }
      } else if (p === 'Bisagra / Cadena Posterior') {
        if (rigType === 'leg_curl_lying') {
          pelvisPivot.position.set(0, 0.56, 0.02);
          pelvisPivot.rotation.x = Math.PI / 2 - 0.12;
          leftLeg.midPivot.rotation.x = 0.1 + c * 1.62;
          rightLeg.midPivot.rotation.x = 0.1 + c * 1.62;
          leftArm.topPivot.rotation.set(-2.5, 0, -0.28);
          rightArm.topPivot.rotation.set(-2.5, 0, 0.28);
          leftArm.midPivot.rotation.x = -0.5;
          rightArm.midPivot.rotation.x = -0.5;
        } else if (rigType === 'leg_curl_seated') {
          pelvisPivot.position.set(0, 0.56, 0.02);
          leftLeg.topPivot.rotation.x = -1.48;
          rightLeg.topPivot.rotation.x = -1.48;
          leftLeg.midPivot.rotation.x = 0.1 + c * 1.55;
          rightLeg.midPivot.rotation.x = 0.1 + c * 1.55;
          leftArm.topPivot.rotation.set(0.05, 0, -0.2);
          rightArm.topPivot.rotation.set(0.05, 0, 0.2);
          leftArm.midPivot.rotation.x = -0.7;
          rightArm.midPivot.rotation.x = -0.7;
        } else if (
          id === 'glute_bridge_barbell' ||
          id === 'bodyweight_glute_bridge' ||
          id === 'single_leg_glute_bridge'
        ) {
          const hipY = 0.1 + c * 0.25;
          const pelvisRotX =
            -Math.PI / 2 - Math.asin(Math.min(0.85, (hipY - 0.1) / 0.52));
          const hipZ = -0.52 - 0.52 * Math.sin(pelvisRotX);
          pelvisPivot.position.set(0, hipY, hipZ);
          pelvisPivot.rotation.x = pelvisRotX;
          applyWorldLegIK(
            0.044,
            0.42,
            id === 'single_leg_glute_bridge' ? 'left' : 'both'
          );
          if (id === 'single_leg_glute_bridge') {
            rightLeg.topPivot.rotation.x = 0.05;
            rightLeg.midPivot.rotation.x = 0.08;
            rightLeg.endPivot.rotation.x = 0;
          }
          if (exercise.equipment === 'Barra') {
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
          } else {
            rootGroup.updateMatrixWorld(true);
            targetHandL.set(-0.28, 0.04, -0.02);
            targetHandR.set(0.28, 0.04, -0.02);
            poleElbowL.set(-0.3, 0.09, -0.28);
            poleElbowR.set(0.3, 0.09, -0.28);
            solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
            solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
          }
        } else if (id === 'good_morning_barbell') {
          // c = 1 arriba erguido, c = 0 inclinado profundo
          const hinge = (1 - c) * 1.25;
          const hipY = 0.88 - (1 - c) * 0.12;
          const hipZ = -(1 - c) * 0.16;
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
          const hipY = 0.88 - bend * 0.15;
          const hipZ = -bend * 0.18;
          pelvisPivot.position.set(0, hipY, hipZ);
          applyLegIK(hipY, hipZ, 0.044, 0);
          spinePivot.rotation.x = bend * 1.24;
          leftArm.topPivot.rotation.set(-bend * 0.55 + 0.18, 0, 0.08);
          rightArm.topPivot.rotation.set(-bend * 0.55 + 0.18, 0, -0.08);
        } else {
          // Peso muerto / RDL / Rack Pull (c = 1 bloqueo completo, c = 0 barra abajo)
          const down = 1 - c;
          const isRdl = id === 'deadlift_straight_leg' || id === 'romanian_deadlift_dumbbell';
          const hipDrop = isRdl ? down * 0.11 : down * 0.32;
          const hipY = 0.88 - hipDrop;
          const hipZ = -down * 0.16;
          pelvisPivot.position.set(0, hipY, hipZ);
          applyLegIK(hipY, hipZ, 0.044, 0);
          if (id === 'deadlift_sumo') {
            leftLeg.topPivot.rotation.z = -0.28;
            rightLeg.topPivot.rotation.z = 0.28;
          }
          const hinge = down * 1.26;
          spinePivot.rotation.x = hinge;
          leftArm.topPivot.rotation.x = -hinge * 0.94;
          rightArm.topPivot.rotation.x = -hinge * 0.94;
        }
      } else if (p === 'Aislamiento Deltoides') {
        applyLegIK(0.88, 0, 0.044, 0);
        if (id === 'shrug_barbell' || id === 'shrug_dumbbell') {
          const shrugLift = c * 0.072;
          leftArm.topPivot.position.y = 0.24 + shrugLift;
          rightArm.topPivot.position.y = 0.24 + shrugLift;
          leftArm.topPivot.rotation.set(-0.08, 0, -0.06);
          rightArm.topPivot.rotation.set(-0.08, 0, 0.06);
          leftArm.midPivot.rotation.x = -0.08;
          rightArm.midPivot.rotation.x = -0.08;
        } else if (id === 'upright_row_barbell') {
          rootGroup.updateMatrixWorld(true);
          const barY = 0.84 + c * 0.56;
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
          const lift = 0.08 + c * 1.62;
          leftArm.topPivot.rotation.set(-lift, 0, -0.08);
          rightArm.topPivot.rotation.set(-lift, 0, 0.08);
          leftArm.midPivot.rotation.x = -0.14;
          rightArm.midPivot.rotation.x = -0.14;
        } else if (id === 'prone_y_t_raises') {
          pelvisPivot.position.set(0, 0.11, 0.1);
          pelvisPivot.rotation.x = Math.PI / 2;
          spinePivot.rotation.x = -0.15;
          const liftY = c * 0.42;
          leftArm.topPivot.rotation.set(-2.35 - liftY * 0.5, 0, -0.55);
          rightArm.topPivot.rotation.set(-2.35 - liftY * 0.5, 0, 0.55);
          leftArm.midPivot.rotation.x = -0.12;
          rightArm.midPivot.rotation.x = -0.12;
        } else if (id.includes('rear_delt') || id.includes('face_pull')) {
          if (id === 'rear_delt_fly_dumbbell') {
            spinePivot.rotation.x = 0.78;
          }
          const swing = c * 1.38;
          leftArm.topPivot.rotation.set(-1.35, -swing * 0.72, -0.15 - swing * 0.7);
          rightArm.topPivot.rotation.set(-1.35, swing * 0.72, 0.15 + swing * 0.7);
        } else {
          const abduction = 0.08 + c * 1.48;
          leftArm.topPivot.rotation.set(-0.15, 0, -abduction);
          rightArm.topPivot.rotation.set(-0.15, 0, abduction);
          leftArm.midPivot.rotation.x = -0.18;
          rightArm.midPivot.rotation.x = -0.18;
        }
      } else if (p === 'Aislamiento Pectoral') {
        if (rigType === 'free_bench_incline') {
          pelvisPivot.position.set(0, 0.53, 0.18);
          pelvisPivot.rotation.x = -0.68;
          setSeatedLegs(-0.82, 1.45);
          rootGroup.updateMatrixWorld(true);
          const arcTheta = 0.06 + c * 1.34;
          const handX = 0.18 + Math.cos(arcTheta) * 0.45;
          const handY = 0.93 + Math.sin(arcTheta) * 0.48;
          const handZ = -0.14;
          targetHandL.set(-handX, handY, handZ);
          targetHandR.set(handX, handY, handZ);
          poleElbowL.set(-handX * 0.92, handY - 0.22, -0.06);
          poleElbowR.set(handX * 0.92, handY - 0.22, -0.06);
          solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
          solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        } else if (rigType === 'free_bench_flat') {
          pelvisPivot.position.set(0, 0.51, 0.26);
          pelvisPivot.rotation.x = -Math.PI / 2;
          leftLeg.topPivot.rotation.x = -0.2;
          leftLeg.midPivot.rotation.x = Math.PI / 2 + 0.2;
          rightLeg.topPivot.rotation.x = -0.2;
          rightLeg.midPivot.rotation.x = Math.PI / 2 + 0.2;
          rootGroup.updateMatrixWorld(true);
          const arcTheta = 0.06 + c * 1.34;
          const handX = 0.18 + Math.cos(arcTheta) * 0.46;
          const handY = 0.51 + Math.sin(arcTheta) * 0.48;
          const handZ = -0.25;
          targetHandL.set(-handX, handY, handZ);
          targetHandR.set(handX, handY, handZ);
          poleElbowL.set(-handX * 0.92, handY - 0.22, -0.18);
          poleElbowR.set(handX * 0.92, handY - 0.22, -0.18);
          solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
          solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        } else {
          applyLegIK(0.88, 0, 0.044, 0);
          const close = c * 1.28;
          leftArm.topPivot.rotation.set(-1.45, 0, -1.35 + close);
          rightArm.topPivot.rotation.set(-1.45, 0, 1.35 - close);
          leftArm.midPivot.rotation.x = -0.28;
          rightArm.midPivot.rotation.x = -0.28;
        }
      } else if (p === 'Bíceps') {
        if (rigType === 'free_bench_incline') {
          pelvisPivot.position.set(0, 0.53, 0.18);
          pelvisPivot.rotation.x = -0.68;
          setSeatedLegs(-0.82, 1.45);
          const curl = 0.08 + c * 2.04;
          leftArm.topPivot.rotation.x = 0.68;
          rightArm.topPivot.rotation.x = 0.68;
          leftArm.midPivot.rotation.x = -curl;
          rightArm.midPivot.rotation.x = -curl;
        } else if (exercise.equipment === 'Barra') {
          applyLegIK(0.88, 0, 0.044, 0);
          rootGroup.updateMatrixWorld(true);
          const curlAngle = -0.05 + c * 2.12;
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
          const curl = 0.08 + c * 2.04;
          leftArm.topPivot.rotation.x = -0.05;
          rightArm.topPivot.rotation.x = -0.05;
          leftArm.midPivot.rotation.x = -curl;
          rightArm.midPivot.rotation.x = -curl;
        }
      } else if (p === 'Tríceps') {
        if (id === 'diamond_push_up') {
          pelvisPivot.position.set(0, 0.15 + c * 0.22, -0.1);
          pelvisPivot.rotation.x = 1.44 - c * 0.14;
          rootGroup.updateMatrixWorld(true);
          targetHandL.set(-0.085, 0.04, 0.42);
          targetHandR.set(0.085, 0.04, 0.42);
          poleElbowL.set(-0.18, 0.28 + c * 0.18, 0.16);
          poleElbowR.set(0.18, 0.28 + c * 0.18, 0.16);
          solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
          solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        } else if (id === 'bench_chair_dips') {
          const hipY = 0.18 + c * 0.24;
          pelvisPivot.position.set(0, hipY, 0.18);
          pelvisPivot.rotation.x = -0.15;
          leftLeg.topPivot.rotation.x = -1.25;
          rightLeg.topPivot.rotation.x = -1.25;
          leftLeg.midPivot.rotation.x = 0.18;
          rightLeg.midPivot.rotation.x = 0.18;
          rootGroup.updateMatrixWorld(true);
          targetHandL.set(-0.24, 0.46, -0.08);
          targetHandR.set(0.24, 0.46, -0.08);
          poleElbowL.set(-0.24, 0.56 + c * 0.18, -0.32);
          poleElbowR.set(0.24, 0.56 + c * 0.18, -0.32);
          solveTwoBoneArmIK(leftArm, chestPivot, targetHandL, poleElbowL);
          solveTwoBoneArmIK(rightArm, chestPivot, targetHandR, poleElbowR);
        } else if (id === 'skull_crusher_barbell') {
          pelvisPivot.position.set(0, 0.51, 0.26);
          pelvisPivot.rotation.x = -Math.PI / 2;
          leftLeg.topPivot.rotation.x = -0.2;
          leftLeg.midPivot.rotation.x = Math.PI / 2 + 0.2;
          rightLeg.topPivot.rotation.x = -0.2;
          rightLeg.midPivot.rotation.x = Math.PI / 2 + 0.2;

          rootGroup.updateMatrixWorld(true);
          const handY = 0.62 + c * 0.39;
          const handZ = -0.46 + c * 0.2;
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
          const ext = 1.85 - c * 1.77;
          leftArm.midPivot.rotation.x = -ext;
          rightArm.midPivot.rotation.x = -ext;
        } else if (id.includes('overhead')) {
          applyLegIK(0.88, 0, 0.044, 0);
          leftArm.topPivot.rotation.x = -2.88;
          rightArm.topPivot.rotation.x = -2.88;
          const ext = 1.92 - c * 1.84;
          leftArm.midPivot.rotation.x = -ext;
          rightArm.midPivot.rotation.x = -ext;
        } else {
          applyLegIK(0.88, 0, 0.044, 0);
          leftArm.topPivot.rotation.x = 0.05;
          rightArm.topPivot.rotation.x = 0.05;
          const push = 1.88 - c * 1.8;
          leftArm.midPivot.rotation.x = -push;
          rightArm.midPivot.rotation.x = -push;
        }
      } else if (p === 'Core') {
        if (id.includes('hanging')) {
          pelvisPivot.position.set(0, 1.2, 0);
          leftLeg.topPivot.rotation.x = -0.05 - c * 1.7;
          rightLeg.topPivot.rotation.x = -0.05 - c * 1.7;
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
          spinePivot.rotation.x = 0.1 + c * 1.08;
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
          pelvisPivot.position.set(0, 0.46 - c * 0.18, -0.16 + c * 0.26);
          pelvisPivot.rotation.x = 0.65 + c * 0.78;
          setSeatedLegs(-0.15, 1.55);
          leftArm.topPivot.rotation.set(-1.45 - c * 0.8, 0, -0.1);
          rightArm.topPivot.rotation.set(-1.45 - c * 0.8, 0, 0.1);
        } else if (id === 'cable_woodchopper') {
          applyLegIK(0.88, 0, 0.044, 0);
          const rot = -0.82 + c * 1.64;
          spinePivot.rotation.y = rot;
          leftArm.topPivot.rotation.set(-1.35 + (1 - c) * 0.55, rot * 0.3, -0.2);
          rightArm.topPivot.rotation.set(-1.35 + (1 - c) * 0.55, rot * 0.3, 0.2);
        } else if (id === 'russian_twist') {
          pelvisPivot.position.set(0, 0.14, 0);
          pelvisPivot.rotation.x = -0.58;
          setSeatedLegs(-0.95, 1.25);
          spinePivot.rotation.y = (c - 0.5) * 1.65;
          leftArm.topPivot.rotation.set(-0.95, 0, 0.25);
          rightArm.topPivot.rotation.set(-0.95, 0, -0.25);
          leftArm.midPivot.rotation.x = -0.8;
          rightArm.midPivot.rotation.x = -0.8;
        } else {
          // Crunch / Bicycle crunch en colchoneta
          pelvisPivot.position.set(0, 0.12, 0.16);
          pelvisPivot.rotation.x = -Math.PI / 2;
          if (id === 'bicycle_crunch') {
            leftLeg.topPivot.rotation.x = -1.35 + c * 0.95;
            rightLeg.topPivot.rotation.x = -0.4 - c * 0.95;
            leftLeg.midPivot.rotation.x = 1.45;
            rightLeg.midPivot.rotation.x = 1.45;
            spinePivot.rotation.set(0.28 + c * 0.58, (c - 0.5) * 0.9, 0);
          } else {
            leftLeg.topPivot.rotation.x = -0.85;
            leftLeg.midPivot.rotation.x = 1.65;
            rightLeg.topPivot.rotation.x = -0.85;
            rightLeg.midPivot.rotation.x = 1.65;
            spinePivot.rotation.x = 0.14 + c * 0.78;
          }
          leftArm.topPivot.rotation.set(-2.35, 0, -0.45);
          rightArm.topPivot.rotation.set(-2.35, 0, 0.45);
          leftArm.midPivot.rotation.x = -1.7;
          rightArm.midPivot.rotation.x = -1.7;
        }
      } else if (p === 'Gemelos') {
        const lift = -0.02 + c * 0.11;
        pelvisPivot.position.set(0, 0.88 + lift, 0);
        leftLeg.endPivot.rotation.x = -0.14 + c * 0.56;
        rightLeg.endPivot.rotation.x = -0.14 + c * 0.56;
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
      applySceneThemeRef.current = null;
      disposeMannequin();
      striations.dispose();
      shadowGeo.dispose();
      shadowCatcherMat.dispose();
      bodyMat.dispose();
      skinMat.dispose();
      tendonMat.dispose();
      shortsMat.dispose();
      barChromeMat.dispose();
      barGripMat.dispose();
      ironPlateMat.dispose();
      plateHubMat.dispose();
      allMuscleIds.forEach((mId) => muscleMats[mId].dispose());
      controls.dispose();
      renderer.dispose();
    };
  }, [exercise, muscleProfile]);

  return (
    <div
      className={`w-full h-[320px] sm:h-[380px] rounded-xl overflow-hidden border border-border/70 relative select-none transition-colors ${
        isDark ? 'bg-[#0c1322]' : 'bg-[#f8fafc]'
      }`}
    >
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />
      <div className="pointer-events-none absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-card/85 dark:bg-slate-950/80 backdrop-blur-xs border border-border/70 text-[11px] font-semibold text-foreground shadow-xs">
        {rigMeta.badge}
      </div>

      {/* Leyenda anatómica en tiempo real (Primarios vs Secundarios) */}
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-[80%] px-3 py-2 rounded-lg bg-card/88 dark:bg-slate-950/82 backdrop-blur-xs border border-border/70 text-[11px] text-foreground shadow-xs space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 font-semibold text-rose-600 dark:text-rose-300">
            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.85)]" />
            <span>Primario:</span>
          </span>
          <span className="text-foreground font-medium">{primaryLabels}</span>
        </div>
        {secondaryLabels && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(250,204,21,0.75)]" />
              <span>Secundario:</span>
            </span>
            <span className="text-muted-foreground dark:text-slate-300">{secondaryLabels}</span>
          </div>
        )}
        <div className="pt-0.5 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Activación</span>
          <div className="flex-1 h-1.5 rounded-full bg-muted dark:bg-slate-800 overflow-hidden min-w-[72px]">
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
