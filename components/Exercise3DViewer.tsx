'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CatalogExercise } from '@/lib/exercise-catalog';

interface Exercise3DViewerProps {
  exercise: CatalogExercise;
  isPlaying: boolean;
  speed: number; // 0.5 | 1
  highlightMuscles: boolean;
  resetSignal: number;
}

/**
 * Resuelve cinemática inversa (IK) planar de 2 huesos en el plano sagital (Y-Z)
 * para mantener los pies firmemente apoyados en el suelo (y = 0) durante sentadillas,
 * peso muerto y ejercicios de pie.
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

  // Ángulo desde la vertical (-Y) hacia delante (+Z)
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

  // En Three.js, rotación X negativa lleva el segmento (-Y) hacia delante (+Z)
  const hipAngleX = -(targetAngle + hipOffset);
  // La rodilla dobla hacia atrás (+X)
  const kneeAngleX = kneeBend;
  // El tobillo compensa para dejar la planta del pie paralela al suelo
  const ankleAngleX = -(hipAngleX + kneeAngleX);

  return { hipAngleX, kneeAngleX, ankleAngleX };
}

/**
 * Visor 3D biomecánico interactivo construido con Three.js.
 * Incluye IK de piernas para anclaje al suelo y acoplamiento dinámico de barra/mancuernas a las manos.
 */
export function Exercise3DViewer({
  exercise,
  isPlaying,
  speed,
  highlightMuscles,
  resetSignal,
}: Exercise3DViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(speed);
  const highlightRef = useRef(highlightMuscles);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    highlightRef.current = highlightMuscles;
  }, [highlightMuscles]);

  useEffect(() => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(2.25, 1.75, 2.65);
      controlsRef.current.target.set(0, 0.9, 0);
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
    scene.fog = new THREE.Fog('#0f172a', 6, 14);

    // Cámara
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 50);
    camera.position.set(2.25, 1.75, 2.65);
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
    controls.target.set(0, 0.9, 0);
    controls.minDistance = 1.5;
    controls.maxDistance = 5.5;
    controls.maxPolarAngle = Math.PI * 0.51;
    controls.update();
    controlsRef.current = controls;

    // Iluminación de Estudio
    const ambientLight = new THREE.AmbientLight('#cbd5e1', 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight('#ffffff', 1.65);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#38bdf8', 0.85);
    rimLight.position.set(-3, 3, -3);
    scene.add(rimLight);

    // Suelo y Rejilla
    const floorGeo = new THREE.CircleGeometry(3.2, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.85,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(6, 16, '#334155', '#1e293b');
    grid.position.y = 0.004;
    scene.add(grid);

    // Materiales Base y Musculares
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.45, metalness: 0.15 });
    const jointMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.35, metalness: 0.4 });
    const equipmentMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.25, metalness: 0.75 });
    const plateMat = new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.4, metalness: 0.3 });
    const benchMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.7, metalness: 0.2 });

    const createMuscleMat = () =>
      new THREE.MeshStandardMaterial({
        color: '#94a3b8',
        emissive: new THREE.Color('#2563eb'),
        emissiveIntensity: 0,
        roughness: 0.4,
        metalness: 0.2,
      });

    const chestMat = createMuscleMat();
    const backMat = createMuscleMat();
    const shoulderMat = createMuscleMat();
    const armsMat = createMuscleMat();
    const legsMat = createMuscleMat();
    const coreMat = createMuscleMat();

    const targetMuscleMatMap: Record<string, THREE.MeshStandardMaterial> = {
      Pecho: chestMat,
      Espalda: backMat,
      Hombros: shoulderMat,
      Brazos: armsMat,
      Piernas: legsMat,
      Core: coreMat,
    };
    const activeMuscleMat = targetMuscleMatMap[exercise.muscleGroup] || chestMat;

    // ==============================================
    // CONSTRUCCIÓN DEL MANIQUÍ ARTICULADO 3D
    // ==============================================
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const pelvisPivot = new THREE.Group();
    pelvisPivot.position.set(0, 0.88, 0);
    rootGroup.add(pelvisPivot);

    const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.13, 0.19), jointMat);
    pelvisMesh.castShadow = true;
    pelvisPivot.add(pelvisMesh);

    // Torso & Core
    const spinePivot = new THREE.Group();
    spinePivot.position.set(0, 0.07, 0);
    pelvisPivot.add(spinePivot);

    const abdomenMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.21, 16), coreMat);
    abdomenMesh.position.y = 0.105;
    abdomenMesh.castShadow = true;
    spinePivot.add(abdomenMesh);

    const chestPivot = new THREE.Group();
    chestPivot.position.set(0, 0.21, 0);
    spinePivot.add(chestPivot);

    const upperTorso = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.27, 0.21), backMat);
    upperTorso.position.y = 0.135;
    upperTorso.castShadow = true;
    chestPivot.add(upperTorso);

    const pecsMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.15, 0.06), chestMat);
    pecsMesh.position.set(0, 0.165, 0.105);
    pecsMesh.castShadow = true;
    chestPivot.add(pecsMesh);

    // Cabeza y cuello
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.062, 0.08, 12), bodyMat);
    neckMesh.position.set(0, 0.3, 0);
    chestPivot.add(neckMesh);

    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 20), bodyMat);
    headMesh.position.set(0, 0.41, 0.01);
    headMesh.castShadow = true;
    chestPivot.add(headMesh);

    const createLimb = (
      side: -1 | 1,
      upperLen: number,
      lowerLen: number,
      upperRadius: number,
      lowerRadius: number,
      upperMat: THREE.Material,
      lowerMat: THREE.Material
    ) => {
      const topPivot = new THREE.Group();
      const topJoint = new THREE.Mesh(new THREE.SphereGeometry(upperRadius * 1.15, 14, 14), upperMat);
      topPivot.add(topJoint);

      const upperMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(upperRadius, upperRadius * 0.88, upperLen, 14),
        upperMat
      );
      upperMesh.position.y = -upperLen / 2;
      upperMesh.castShadow = true;
      topPivot.add(upperMesh);

      const midPivot = new THREE.Group();
      midPivot.position.y = -upperLen;
      topPivot.add(midPivot);

      const midJoint = new THREE.Mesh(new THREE.SphereGeometry(lowerRadius * 1.1, 14, 14), jointMat);
      midPivot.add(midJoint);

      const lowerMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(lowerRadius, lowerRadius * 0.8, lowerLen, 14),
        lowerMat
      );
      lowerMesh.position.y = -lowerLen / 2;
      lowerMesh.castShadow = true;
      midPivot.add(lowerMesh);

      const endPivot = new THREE.Group();
      endPivot.position.y = -lowerLen;
      midPivot.add(endPivot);

      const endJoint = new THREE.Mesh(new THREE.SphereGeometry(lowerRadius * 0.9, 12, 12), bodyMat);
      endPivot.add(endJoint);

      return { topPivot, midPivot, endPivot, side, upperLen, lowerLen };
    };

    const leftArm = createLimb(-1, 0.27, 0.25, 0.052, 0.042, shoulderMat, armsMat);
    leftArm.topPivot.position.set(-0.22, 0.24, 0);
    chestPivot.add(leftArm.topPivot);

    const rightArm = createLimb(1, 0.27, 0.25, 0.052, 0.042, shoulderMat, armsMat);
    rightArm.topPivot.position.set(0.22, 0.24, 0);
    chestPivot.add(rightArm.topPivot);

    const LEG_UPPER = 0.42;
    const LEG_LOWER = 0.41;

    const leftLeg = createLimb(-1, LEG_UPPER, LEG_LOWER, 0.078, 0.056, legsMat, legsMat);
    leftLeg.topPivot.position.set(-0.105, -0.03, 0);
    pelvisPivot.add(leftLeg.topPivot);

    const rightLeg = createLimb(1, LEG_UPPER, LEG_LOWER, 0.078, 0.056, legsMat, legsMat);
    rightLeg.topPivot.position.set(0.105, -0.03, 0);
    pelvisPivot.add(rightLeg.topPivot);

    // Pies articulados en endPivot
    const footGeo = new THREE.BoxGeometry(0.09, 0.045, 0.19);
    const leftFoot = new THREE.Mesh(footGeo, jointMat);
    leftFoot.position.set(0, -0.022, 0.045);
    leftFoot.castShadow = true;
    leftLeg.endPivot.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeo, jointMat);
    rightFoot.position.set(0, -0.022, 0.045);
    rightFoot.castShadow = true;
    rightLeg.endPivot.add(rightFoot);

    // ==============================================
    // EQUIPO / MÁQUINA DE REFERENCIA
    // ==============================================
    const propGroup = new THREE.Group();
    scene.add(propGroup);

    const id = exercise.id;
    const p = exercise.pattern;

    const isSeatedRow = p === 'Tracción Horizontal' && (id.includes('seated') || id.includes('machine'));
    const isLatPulldown = p === 'Tracción Vertical' && id.includes('lat_pulldown');
    const isPullup = (p === 'Tracción Vertical' && !isLatPulldown) || id.includes('hanging');
    const isFlatBench =
      (p === 'Empuje Horizontal' && !id.includes('pushup') && !id.includes('dip')) ||
      (p === 'Aislamiento Pectoral' && id.includes('fly'));
    const isInclineBench = p === 'Empuje Inclinado' || id === 'incline_dumbbell_curl';
    const isSeatedMachineLegs = id === 'leg_extension_machine' || id.includes('leg_curl');

    if (isFlatBench) {
      const benchSeat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 1.25), benchMat);
      benchSeat.position.set(0, 0.42, -0.05);
      benchSeat.castShadow = true;
      propGroup.add(benchSeat);

      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), equipmentMat);
      leg1.position.set(0, 0.2, -0.52);
      propGroup.add(leg1);

      const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), equipmentMat);
      leg2.position.set(0, 0.2, 0.42);
      propGroup.add(leg2);
    } else if (isInclineBench) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 0.42), benchMat);
      seat.position.set(0, 0.44, 0.2);
      propGroup.add(seat);

      const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 0.85), benchMat);
      backrest.position.set(0, 0.72, -0.22);
      backrest.rotation.x = 0.75;
      propGroup.add(backrest);

      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.56, 0.08), equipmentMat);
      post.position.set(0, 0.28, -0.32);
      propGroup.add(post);
    } else if (isSeatedRow || isLatPulldown || isSeatedMachineLegs) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.42), benchMat);
      seat.position.set(0, 0.5, 0);
      propGroup.add(seat);

      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), equipmentMat);
      post.position.set(0, 0.25, 0);
      propGroup.add(post);

      if (isLatPulldown || isSeatedRow) {
        const tower = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.05, 0.14), equipmentMat);
        tower.position.set(0, 1.02, 0.85);
        propGroup.add(tower);
      }
    } else if (isPullup) {
      const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.25, 10), equipmentMat);
      leftPost.position.set(-0.65, 1.12, 0);
      propGroup.add(leftPost);
      const rightPost = leftPost.clone();
      rightPost.position.set(0.65, 1.12, 0);
      propGroup.add(rightPost);
      const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.36, 12), equipmentMat);
      topBar.rotation.z = Math.PI / 2;
      topBar.position.set(0, 2.22, 0);
      propGroup.add(topBar);
    }

    // Barra / Mancuernas según equipamiento
    let barbellGroup: THREE.Group | null = null;
    if (exercise.equipment === 'Barra') {
      barbellGroup = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 1.35, 12), equipmentMat);
      bar.rotation.z = Math.PI / 2;
      bar.castShadow = true;
      barbellGroup.add(bar);

      const plateL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 20), plateMat);
      plateL.rotation.z = Math.PI / 2;
      plateL.position.x = -0.52;
      plateL.castShadow = true;
      barbellGroup.add(plateL);

      const plateR = plateL.clone();
      plateR.position.x = 0.52;
      barbellGroup.add(plateR);
      scene.add(barbellGroup);
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
      leftArm.endPivot.add(createDumbbell());
      rightArm.endPivot.add(createDumbbell());
    }

    // ==============================================
    // BUCLE DE ANIMACIÓN BIOMECÁNICA PROCEDURAL
    // ==============================================
    let phaseTime = 0;
    let lastTs = performance.now();
    let frameId = 0;

    const leftHandPos = new THREE.Vector3();
    const rightHandPos = new THREE.Vector3();
    const handMidPos = new THREE.Vector3();
    const barDir = new THREE.Vector3();
    const xAxis = new THREE.Vector3(1, 0, 0);

    const resetPose = () => {
      pelvisPivot.position.set(0, 0.88, 0);
      pelvisPivot.rotation.set(0, 0, 0);
      spinePivot.rotation.set(0, 0, 0);
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

    const applyStandingLegIK = (hipY: number, hipZ: number, footZ = 0) => {
      const ik = solveSagittalLegIK(hipY - 0.03, hipZ, 0.044, footZ, LEG_UPPER, LEG_LOWER);
      leftLeg.topPivot.rotation.x = ik.hipAngleX;
      leftLeg.midPivot.rotation.x = ik.kneeAngleX;
      leftLeg.endPivot.rotation.x = ik.ankleAngleX;
      rightLeg.topPivot.rotation.x = ik.hipAngleX;
      rightLeg.midPivot.rotation.x = ik.kneeAngleX;
      rightLeg.endPivot.rotation.x = ik.ankleAngleX;
    };

    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTs) / 1000, 0.05);
      lastTs = now;

      if (isPlayingRef.current) {
        phaseTime += dt * 2.0 * speedRef.current;
      }

      // Ciclo suave 0..1 (0 = inicio/estiramiento, 1 = máxima contracción)
      const c = (Math.sin(phaseTime) + 1) * 0.5;

      // Iluminación pulsada del músculo objetivo
      if (highlightRef.current) {
        activeMuscleMat.color.set('#3b82f6');
        activeMuscleMat.emissive.set('#2563eb');
        activeMuscleMat.emissiveIntensity = 0.25 + c * 0.55;
      } else {
        activeMuscleMat.color.set('#94a3b8');
        activeMuscleMat.emissiveIntensity = 0;
      }

      resetPose();

      if (p === 'Empuje Horizontal') {
        if (id.includes('pushup')) {
          // Flexiones en el suelo
          const drop = (1 - c) * 0.16;
          pelvisPivot.position.set(0, 0.32 - drop * 0.4, 0.1);
          pelvisPivot.rotation.x = 1.32 - drop * 0.2;
          leftArm.topPivot.rotation.set(-1.35 + (1 - c) * 0.45, 0, -0.25);
          rightArm.topPivot.rotation.set(-1.35 + (1 - c) * 0.45, 0, 0.25);
          leftArm.midPivot.rotation.x = -(1 - c) * 1.15;
          rightArm.midPivot.rotation.x = -(1 - c) * 1.15;
        } else {
          // Press de banca plano tumbado sobre el banco (espalda en y ≈ 0.50, cabeza hacia -Z)
          pelvisPivot.position.set(0, 0.51, 0.26);
          pelvisPivot.rotation.x = -Math.PI / 2;

          // Piernas flexionadas apoyadas en el suelo
          leftLeg.topPivot.rotation.x = -0.2;
          leftLeg.midPivot.rotation.x = Math.PI / 2 + 0.2;
          rightLeg.topPivot.rotation.x = -0.2;
          rightLeg.midPivot.rotation.x = Math.PI / 2 + 0.2;

          // Brazos empujan hacia el techo (+Y mundial = +Z local)
          // c=0: abajo (codos abiertos hacia abajo); c=1: arriba (brazos extendidos)
          const flare = (1 - c) * 0.72;
          const elbowBend = (1 - c) * 1.25;
          leftArm.topPivot.rotation.set(-Math.PI / 2 + (1 - c) * 0.2, 0, -flare - 0.12);
          rightArm.topPivot.rotation.set(-Math.PI / 2 + (1 - c) * 0.2, 0, flare + 0.12);
          leftArm.midPivot.rotation.set(-0.15, 0, elbowBend);
          rightArm.midPivot.rotation.set(-0.15, 0, -elbowBend);
        }
      } else if (p === 'Empuje Inclinado') {
        // Sentado en banco inclinado (~45° hacia atrás)
        pelvisPivot.position.set(0, 0.53, 0.18);
        pelvisPivot.rotation.x = -0.68;

        leftLeg.topPivot.rotation.x = -0.82;
        leftLeg.midPivot.rotation.x = 1.45;
        rightLeg.topPivot.rotation.x = -0.82;
        rightLeg.midPivot.rotation.x = 1.45;

        const flare = (1 - c) * 0.65;
        const elbowBend = (1 - c) * 1.2;
        leftArm.topPivot.rotation.set(-Math.PI / 2 - 0.45 + (1 - c) * 0.2, 0, -flare - 0.12);
        rightArm.topPivot.rotation.set(-Math.PI / 2 - 0.45 + (1 - c) * 0.2, 0, flare + 0.12);
        leftArm.midPivot.rotation.set(-0.15, 0, elbowBend);
        rightArm.midPivot.rotation.set(-0.15, 0, -elbowBend);
      } else if (p === 'Empuje Vertical') {
        // Press militar de pie con pies anclados
        applyStandingLegIK(0.88, 0, 0);
        const press = c;
        leftArm.topPivot.rotation.set(-1.75 - press * 1.15, 0, -0.35 + press * 0.25);
        rightArm.topPivot.rotation.set(-1.75 - press * 1.15, 0, 0.35 - press * 0.25);
        leftArm.midPivot.rotation.x = -1.45 + press * 1.3;
        rightArm.midPivot.rotation.x = -1.45 + press * 1.3;
      } else if (p === 'Tracción Horizontal') {
        if (isSeatedRow) {
          // Remo sentado en polea
          pelvisPivot.position.set(0, 0.56, 0);
          spinePivot.rotation.x = 0.08 - c * 0.06;
          leftLeg.topPivot.rotation.x = -1.35;
          leftLeg.midPivot.rotation.x = 1.15;
          rightLeg.topPivot.rotation.x = -1.35;
          rightLeg.midPivot.rotation.x = 1.15;
        } else {
          // Remo inclinado con barra/mancuernas y pies fijos en el suelo
          applyStandingLegIK(0.82, -0.08, 0);
          pelvisPivot.position.set(0, 0.82, -0.08);
          spinePivot.rotation.x = 0.78;
        }
        const pullBack = -1.25 + c * 1.15;
        leftArm.topPivot.rotation.x = pullBack;
        rightArm.topPivot.rotation.x = pullBack;
        leftArm.midPivot.rotation.x = -0.18 - c * 1.2;
        rightArm.midPivot.rotation.x = -0.18 - c * 1.2;
      } else if (p === 'Tracción Vertical') {
        if (isLatPulldown) {
          // Jalón al pecho sentado
          pelvisPivot.position.set(0, 0.56, 0);
          spinePivot.rotation.x = -0.12 * c;
          leftLeg.topPivot.rotation.x = -1.4;
          leftLeg.midPivot.rotation.x = 1.38;
          rightLeg.topPivot.rotation.x = -1.4;
          rightLeg.midPivot.rotation.x = 1.38;

          const pullDown = -2.9 + c * 1.55;
          leftArm.topPivot.rotation.set(pullDown, 0, -0.38 - c * 0.25);
          rightArm.topPivot.rotation.set(pullDown, 0, 0.38 + c * 0.25);
          leftArm.midPivot.rotation.x = -0.15 - c * 1.35;
          rightArm.midPivot.rotation.x = -0.15 - c * 1.35;
        } else {
          // Dominadas colgado de la barra (y=2.22): el cuerpo sube manteniendo las manos arriba
          pelvisPivot.position.set(0, 1.18 + c * 0.34, 0);
          leftLeg.topPivot.rotation.x = 0.1;
          leftLeg.midPivot.rotation.x = 0.35;
          rightLeg.topPivot.rotation.x = 0.1;
          rightLeg.midPivot.rotation.x = 0.35;

          const armPull = -2.95 + c * 1.55;
          leftArm.topPivot.rotation.set(armPull, 0, -0.28 - c * 0.25);
          rightArm.topPivot.rotation.set(armPull, 0, 0.28 + c * 0.25);
          leftArm.midPivot.rotation.x = -0.15 - c * 1.45;
          rightArm.midPivot.rotation.x = -0.15 - c * 1.45;
        }
      } else if (p === 'Sentadilla / Cuádriceps') {
        if (id === 'leg_extension_machine') {
          pelvisPivot.position.set(0, 0.56, 0);
          leftLeg.topPivot.rotation.x = -1.48;
          rightLeg.topPivot.rotation.x = -1.48;
          const ext = 1.48 - c * 1.38;
          leftLeg.midPivot.rotation.x = ext;
          rightLeg.midPivot.rotation.x = ext;
        } else {
          // Sentadilla con IK exacta: la cadera baja y retrocede, los pies nunca se despegan del suelo
          const hipY = 0.88 - c * 0.36;
          const hipZ = -c * 0.15;
          pelvisPivot.position.set(0, hipY, hipZ);
          spinePivot.rotation.x = c * 0.34;
          applyStandingLegIK(hipY, hipZ, 0);

          // Manos sosteniendo la barra sobre los hombros
          leftArm.topPivot.rotation.set(-0.55, 0, -0.45);
          rightArm.topPivot.rotation.set(-0.55, 0, 0.45);
          leftArm.midPivot.rotation.x = -1.95;
          rightArm.midPivot.rotation.x = -1.95;
        }
      } else if (p === 'Bisagra / Cadena Posterior') {
        if (id.includes('leg_curl')) {
          pelvisPivot.position.set(0, 0.56, 0);
          leftLeg.topPivot.rotation.x = -1.48;
          rightLeg.topPivot.rotation.x = -1.48;
          leftLeg.midPivot.rotation.x = 0.2 + c * 1.35;
          rightLeg.midPivot.rotation.x = 0.2 + c * 1.35;
        } else if (id.includes('hip_thrust')) {
          pelvisPivot.position.set(0, 0.34 + c * 0.25, 0.1);
          pelvisPivot.rotation.x = -1.4 + c * 0.45;
          leftLeg.topPivot.rotation.x = 0.55 - c * 0.45;
          rightLeg.topPivot.rotation.x = 0.55 - c * 0.45;
          leftLeg.midPivot.rotation.x = 1.25;
          rightLeg.midPivot.rotation.x = 1.25;
        } else {
          // Peso muerto rumano / Bisagra con pies anclados
          const hipY = 0.88 - c * 0.1;
          const hipZ = -c * 0.14;
          pelvisPivot.position.set(0, hipY, hipZ);
          applyStandingLegIK(hipY, hipZ, 0);

          const hinge = c * 1.15;
          spinePivot.rotation.x = hinge;
          // Brazos cuelgan verticales hacia el suelo mientras el torso se inclina
          leftArm.topPivot.rotation.x = -hinge * 0.92;
          rightArm.topPivot.rotation.x = -hinge * 0.92;
        }
      } else if (p === 'Aislamiento Deltoides') {
        applyStandingLegIK(0.88, 0, 0);
        if (id.includes('rear_delt') || id.includes('face_pull')) {
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
        if (isFlatBench) {
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
          applyStandingLegIK(0.88, 0, 0);
          const close = c * 1.1;
          leftArm.topPivot.rotation.set(-1.45, 0, -1.15 + close);
          rightArm.topPivot.rotation.set(-1.45, 0, 1.15 - close);
          leftArm.midPivot.rotation.x = -0.35;
          rightArm.midPivot.rotation.x = -0.35;
        }
      } else if (p === 'Bíceps') {
        if (isInclineBench) {
          pelvisPivot.position.set(0, 0.53, 0.18);
          pelvisPivot.rotation.x = -0.68;
          leftLeg.topPivot.rotation.x = -0.82;
          leftLeg.midPivot.rotation.x = 1.45;
          rightLeg.topPivot.rotation.x = -0.82;
          rightLeg.midPivot.rotation.x = 1.45;
        } else {
          applyStandingLegIK(0.88, 0, 0);
        }
        const curl = 0.18 + c * 1.85;
        leftArm.topPivot.rotation.x = isInclineBench ? 0.68 : -0.05;
        rightArm.topPivot.rotation.x = isInclineBench ? 0.68 : -0.05;
        leftArm.midPivot.rotation.x = -curl;
        rightArm.midPivot.rotation.x = -curl;
      } else if (p === 'Tríceps') {
        applyStandingLegIK(0.88, 0, 0);
        if (id.includes('overhead')) {
          leftArm.topPivot.rotation.x = -2.85;
          rightArm.topPivot.rotation.x = -2.85;
          const ext = 1.75 - c * 1.45;
          leftArm.midPivot.rotation.x = -ext;
          rightArm.midPivot.rotation.x = -ext;
        } else {
          leftArm.topPivot.rotation.x = 0.05;
          rightArm.topPivot.rotation.x = 0.05;
          const push = 1.7 - c * 1.45;
          leftArm.midPivot.rotation.x = -push;
          rightArm.midPivot.rotation.x = -push;
        }
      } else if (p === 'Core') {
        if (id.includes('hanging')) {
          pelvisPivot.position.set(0, 1.22, 0);
          leftArm.topPivot.rotation.x = -3.0;
          rightArm.topPivot.rotation.x = -3.0;
          leftLeg.topPivot.rotation.x = -0.15 - c * 1.45;
          rightLeg.topPivot.rotation.x = -0.15 - c * 1.45;
        } else {
          applyStandingLegIK(0.88, 0, 0);
          spinePivot.rotation.x = 0.15 + c * 0.85;
          leftArm.topPivot.rotation.x = -1.6;
          rightArm.topPivot.rotation.x = -1.6;
          leftArm.midPivot.rotation.x = -1.3;
          rightArm.midPivot.rotation.x = -1.3;
        }
      } else if (p === 'Gemelos') {
        const lift = c * 0.08;
        pelvisPivot.position.set(0, 0.88 + lift, 0);
        leftLeg.endPivot.rotation.x = c * 0.32;
        rightLeg.endPivot.rotation.x = c * 0.32;
      }

      // Actualizar matrices del esqueleto para acoplar la barra exactamente a las manos
      rootGroup.updateMatrixWorld(true);
      if (barbellGroup) {
        leftArm.endPivot.getWorldPosition(leftHandPos);
        rightArm.endPivot.getWorldPosition(rightHandPos);
        handMidPos.copy(leftHandPos).add(rightHandPos).multiplyScalar(0.5);
        barDir.copy(rightHandPos).sub(leftHandPos);
        if (barDir.lengthSq() > 0.0001) {
          barDir.normalize();
          barbellGroup.quaternion.setFromUnitVectors(xAxis, barDir);
        }
        barbellGroup.position.copy(handMidPos);
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
  }, [exercise]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[320px] sm:h-[380px] rounded-xl overflow-hidden bg-slate-900 border border-border/60 cursor-grab active:cursor-grabbing relative select-none"
    />
  );
}
