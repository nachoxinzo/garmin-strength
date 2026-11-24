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
 * Visor 3D biomecánico interactivo construido con Three.js.
 * Permite rotar 360° con ratón o dedo, hacer zoom y observar la cinemática articular
 * junto con los grupos musculares primarios iluminados.
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
      cameraRef.current.position.set(2.3, 1.85, 2.75);
      controlsRef.current.target.set(0, 0.95, 0);
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
    camera.position.set(2.3, 1.85, 2.75);
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
    controls.target.set(0, 0.95, 0);
    controls.minDistance = 1.6;
    controls.maxDistance = 5.5;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.update();
    controlsRef.current = controls;

    // Iluminación de Estudio
    const ambientLight = new THREE.AmbientLight('#cbd5e1', 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight('#ffffff', 1.6);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#38bdf8', 0.9);
    rimLight.position.set(-3, 3, -3);
    scene.add(rimLight);

    // Suelo y Rejilla de Referencia Espacial
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
    grid.position.y = 0.005;
    scene.add(grid);

    // Materiales Base y Musculares (para iluminar grupo objetivo)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: '#94a3b8',
      roughness: 0.45,
      metalness: 0.15,
    });
    const jointMat = new THREE.MeshStandardMaterial({
      color: '#475569',
      roughness: 0.35,
      metalness: 0.4,
    });
    const equipmentMat = new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      roughness: 0.25,
      metalness: 0.75,
    });
    const plateMat = new THREE.MeshStandardMaterial({
      color: '#2563eb',
      roughness: 0.4,
      metalness: 0.3,
    });
    const benchMat = new THREE.MeshStandardMaterial({
      color: '#334155',
      roughness: 0.7,
      metalness: 0.2,
    });

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
    pelvisPivot.position.set(0, 0.95, 0);
    rootGroup.add(pelvisPivot);

    const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.2), jointMat);
    pelvisMesh.castShadow = true;
    pelvisPivot.add(pelvisMesh);

    // Torso & Core
    const spinePivot = new THREE.Group();
    spinePivot.position.set(0, 0.08, 0);
    pelvisPivot.add(spinePivot);

    const abdomenMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.13, 0.22, 16), coreMat);
    abdomenMesh.position.y = 0.11;
    abdomenMesh.castShadow = true;
    spinePivot.add(abdomenMesh);

    const chestPivot = new THREE.Group();
    chestPivot.position.set(0, 0.22, 0);
    spinePivot.add(chestPivot);

    const upperTorso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.22), backMat);
    upperTorso.position.y = 0.14;
    upperTorso.castShadow = true;
    chestPivot.add(upperTorso);

    // Placa pectoral frontal
    const pecsMesh = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.16, 0.06), chestMat);
    pecsMesh.position.set(0, 0.17, 0.11);
    pecsMesh.castShadow = true;
    chestPivot.add(pecsMesh);

    // Cabeza y cuello
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.08, 12), bodyMat);
    neckMesh.position.set(0, 0.31, 0);
    chestPivot.add(neckMesh);

    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 20), bodyMat);
    headMesh.position.set(0, 0.42, 0.01);
    headMesh.castShadow = true;
    chestPivot.add(headMesh);

    // Función auxiliar para extremidades articuladas
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

      return { topPivot, midPivot, endPivot, side };
    };

    // Brazos
    const leftArm = createLimb(-1, 0.28, 0.25, 0.055, 0.044, shoulderMat, armsMat);
    leftArm.topPivot.position.set(-0.23, 0.25, 0);
    chestPivot.add(leftArm.topPivot);

    const rightArm = createLimb(1, 0.28, 0.25, 0.055, 0.044, shoulderMat, armsMat);
    rightArm.topPivot.position.set(0.23, 0.25, 0);
    chestPivot.add(rightArm.topPivot);

    // Piernas
    const leftLeg = createLimb(-1, 0.42, 0.41, 0.08, 0.058, legsMat, legsMat);
    leftLeg.topPivot.position.set(-0.11, -0.04, 0);
    pelvisPivot.add(leftLeg.topPivot);

    const rightLeg = createLimb(1, 0.42, 0.41, 0.08, 0.058, legsMat, legsMat);
    rightLeg.topPivot.position.set(0.11, -0.04, 0);
    pelvisPivot.add(rightLeg.topPivot);

    // Pies
    const footGeo = new THREE.BoxGeometry(0.09, 0.05, 0.19);
    const leftFoot = new THREE.Mesh(footGeo, jointMat);
    leftFoot.position.set(0, -0.02, 0.05);
    leftLeg.endPivot.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeo, jointMat);
    rightFoot.position.set(0, -0.02, 0.05);
    rightLeg.endPivot.add(rightFoot);

    // ==============================================
    // EQUIPO / MÁQUINA DE REFERENCIA
    // ==============================================
    const propGroup = new THREE.Group();
    scene.add(propGroup);

    const isBenchExercise =
      exercise.pattern === 'Empuje Horizontal' ||
      exercise.pattern === 'Empuje Inclinado' ||
      exercise.id === 'incline_dumbbell_curl';

    if (isBenchExercise) {
      const benchSeat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 1.15), benchMat);
      benchSeat.position.set(0, 0.45, -0.05);
      if (exercise.pattern === 'Empuje Inclinado') {
        benchSeat.rotation.x = -0.35;
        benchSeat.position.y = 0.62;
      }
      propGroup.add(benchSeat);

      const benchLeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), equipmentMat);
      benchLeg1.position.set(0, 0.22, -0.45);
      propGroup.add(benchLeg1);

      const benchLeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), equipmentMat);
      benchLeg2.position.set(0, 0.22, 0.35);
      propGroup.add(benchLeg2);
    }

    // Barra / Mancuernas según equipamiento
    let barbellGroup: THREE.Group | null = null;
    if (exercise.equipment === 'Barra') {
      barbellGroup = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.4, 12), equipmentMat);
      bar.rotation.z = Math.PI / 2;
      barbellGroup.add(bar);

      const plateL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 20), plateMat);
      plateL.rotation.z = Math.PI / 2;
      plateL.position.x = -0.56;
      barbellGroup.add(plateL);

      const plateR = plateL.clone();
      plateR.position.x = 0.56;
      barbellGroup.add(plateR);
      scene.add(barbellGroup);
    } else if (exercise.equipment === 'Mancuernas') {
      const createDumbbell = () => {
        const db = new THREE.Group();
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 10), equipmentMat);
        handle.rotation.x = Math.PI / 2;
        db.add(handle);
        const w1 = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.04, 12), plateMat);
        w1.rotation.x = Math.PI / 2;
        w1.position.z = -0.07;
        db.add(w1);
        const w2 = w1.clone();
        w2.position.z = 0.07;
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

    const resetPose = () => {
      pelvisPivot.position.set(0, 0.95, 0);
      pelvisPivot.rotation.set(0, 0, 0);
      spinePivot.rotation.set(0, 0, 0);
      leftArm.topPivot.rotation.set(0, 0, 0);
      leftArm.midPivot.rotation.set(0, 0, 0);
      rightArm.topPivot.rotation.set(0, 0, 0);
      rightArm.midPivot.rotation.set(0, 0, 0);
      leftLeg.topPivot.rotation.set(0, 0, 0);
      leftLeg.midPivot.rotation.set(0, 0, 0);
      rightLeg.topPivot.rotation.set(0, 0, 0);
      rightLeg.midPivot.rotation.set(0, 0, 0);
    };

    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTs) / 1000, 0.05);
      lastTs = now;

      if (isPlayingRef.current) {
        phaseTime += dt * 2.1 * speedRef.current;
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

      const p = exercise.pattern;
      const id = exercise.id;

      if (p === 'Empuje Horizontal') {
        // Press plano tumbado sobre banco
        pelvisPivot.position.set(0, 0.52, -0.05);
        pelvisPivot.rotation.x = -Math.PI / 2;
        leftLeg.topPivot.rotation.x = Math.PI / 2;
        leftLeg.midPivot.rotation.x = 0.2;
        rightLeg.topPivot.rotation.x = Math.PI / 2;
        rightLeg.midPivot.rotation.x = 0.2;

        const armReach = -1.45 + c * 0.15;
        const elbowFlex = 1.55 - c * 1.35;
        leftArm.topPivot.rotation.set(armReach, 0, -0.35 + c * 0.2);
        rightArm.topPivot.rotation.set(armReach, 0, 0.35 - c * 0.2);
        leftArm.midPivot.rotation.x = -elbowFlex;
        rightArm.midPivot.rotation.x = -elbowFlex;

        if (barbellGroup) {
          barbellGroup.position.set(0, 0.65 + c * 0.35, 0.12);
        }
      } else if (p === 'Empuje Inclinado') {
        pelvisPivot.position.set(0, 0.56, -0.1);
        pelvisPivot.rotation.x = -0.95;
        leftLeg.topPivot.rotation.x = 0.95;
        rightLeg.topPivot.rotation.x = 0.95;

        const pressAngle = -1.75 + c * 0.2;
        const elbow = 1.45 - c * 1.25;
        leftArm.topPivot.rotation.set(pressAngle, 0, -0.3 + c * 0.15);
        rightArm.topPivot.rotation.set(pressAngle, 0, 0.3 - c * 0.15);
        leftArm.midPivot.rotation.x = -elbow;
        rightArm.midPivot.rotation.x = -elbow;

        if (barbellGroup) {
          barbellGroup.position.set(0, 0.95 + c * 0.32, 0.15);
        }
      } else if (p === 'Empuje Vertical') {
        const elbow = 1.65 - c * 1.4;
        leftArm.topPivot.rotation.set(-1.9 - c * 0.95, 0, -0.45 + c * 0.3);
        rightArm.topPivot.rotation.set(-1.9 - c * 0.95, 0, 0.45 - c * 0.3);
        leftArm.midPivot.rotation.x = -elbow;
        rightArm.midPivot.rotation.x = -elbow;

        if (barbellGroup) {
          barbellGroup.position.set(0, 1.42 + c * 0.42, 0.08);
        }
      } else if (p === 'Tracción Horizontal') {
        // Remo inclinado / sentado
        spinePivot.rotation.x = id.includes('seated') || id.includes('machine') ? 0.1 : 0.72;
        if (id.includes('seated') || id.includes('machine')) {
          pelvisPivot.position.y = 0.58;
          leftLeg.topPivot.rotation.x = -1.25;
          leftLeg.midPivot.rotation.x = 1.25;
          rightLeg.topPivot.rotation.x = -1.25;
          rightLeg.midPivot.rotation.x = 1.25;
        }
        const pull = -0.95 + c * 1.15;
        leftArm.topPivot.rotation.x = pull;
        rightArm.topPivot.rotation.x = pull;
        leftArm.midPivot.rotation.x = -0.25 - c * 1.15;
        rightArm.midPivot.rotation.x = -0.25 - c * 1.15;

        if (barbellGroup) {
          barbellGroup.position.set(0, 0.78 + c * 0.25, 0.36 - c * 0.14);
        }
      } else if (p === 'Tracción Vertical') {
        // Jalón / Dominadas
        if (id.includes('lat_pulldown')) {
          pelvisPivot.position.y = 0.58;
          leftLeg.topPivot.rotation.x = -1.35;
          leftLeg.midPivot.rotation.x = 1.35;
          rightLeg.topPivot.rotation.x = -1.35;
          rightLeg.midPivot.rotation.x = 1.35;
        }
        const pullDown = -2.8 + c * 1.7;
        leftArm.topPivot.rotation.set(pullDown, 0, -0.35 - c * 0.25);
        rightArm.topPivot.rotation.set(pullDown, 0, 0.35 + c * 0.25);
        leftArm.midPivot.rotation.x = -0.2 - c * 1.35;
        rightArm.midPivot.rotation.x = -0.2 - c * 1.35;
      } else if (p === 'Sentadilla / Cuádriceps') {
        if (id === 'leg_extension_machine') {
          pelvisPivot.position.y = 0.62;
          leftLeg.topPivot.rotation.x = -1.45;
          rightLeg.topPivot.rotation.x = -1.45;
          const ext = 1.45 - c * 1.35;
          leftLeg.midPivot.rotation.x = ext;
          rightLeg.midPivot.rotation.x = ext;
        } else {
          // Sentadilla profunda / Hack Squat / Prensa
          const squatDepth = c;
          pelvisPivot.position.y = 0.95 - squatDepth * 0.36;
          pelvisPivot.position.z = -squatDepth * 0.14;
          spinePivot.rotation.x = squatDepth * 0.32;

          leftLeg.topPivot.rotation.x = -squatDepth * 1.45;
          rightLeg.topPivot.rotation.x = -squatDepth * 1.45;
          leftLeg.midPivot.rotation.x = squatDepth * 1.75;
          rightLeg.midPivot.rotation.x = squatDepth * 1.75;

          leftArm.topPivot.rotation.set(-0.6, 0, -0.35);
          rightArm.topPivot.rotation.set(-0.6, 0, 0.35);
          leftArm.midPivot.rotation.x = -1.5;
          rightArm.midPivot.rotation.x = -1.5;

          if (barbellGroup) {
            barbellGroup.position.set(0, 1.38 - squatDepth * 0.34, -squatDepth * 0.05);
          }
        }
      } else if (p === 'Bisagra / Cadena Posterior') {
        if (id.includes('leg_curl')) {
          pelvisPivot.position.y = 0.62;
          leftLeg.topPivot.rotation.x = -1.45;
          rightLeg.topPivot.rotation.x = -1.45;
          leftLeg.midPivot.rotation.x = 0.25 + c * 1.35;
          rightLeg.midPivot.rotation.x = 0.25 + c * 1.35;
        } else if (id.includes('hip_thrust')) {
          pelvisPivot.position.y = 0.35 + c * 0.26;
          pelvisPivot.rotation.x = -1.45 + c * 0.45;
          leftLeg.topPivot.rotation.x = 0.65 - c * 0.45;
          rightLeg.topPivot.rotation.x = 0.65 - c * 0.45;
          leftLeg.midPivot.rotation.x = 1.2;
          rightLeg.midPivot.rotation.x = 1.2;
        } else {
          // Peso muerto rumano / Bisagra
          const hinge = c * 1.15;
          pelvisPivot.position.y = 0.95 - c * 0.08;
          pelvisPivot.position.z = -c * 0.14;
          spinePivot.rotation.x = hinge;
          leftLeg.topPivot.rotation.x = -hinge * 0.35;
          rightLeg.topPivot.rotation.x = -hinge * 0.35;
          leftLeg.midPivot.rotation.x = 0.28;
          rightLeg.midPivot.rotation.x = 0.28;
          leftArm.topPivot.rotation.x = -hinge * 0.85;
          rightArm.topPivot.rotation.x = -hinge * 0.85;
          if (barbellGroup) {
            barbellGroup.position.set(0, 0.82 - c * 0.42, 0.2);
          }
        }
      } else if (p === 'Aislamiento Deltoides') {
        if (id.includes('rear_delt') || id.includes('face_pull')) {
          const swing = c * 1.25;
          leftArm.topPivot.rotation.set(-1.35, -swing * 0.7, -0.25 - swing * 0.7);
          rightArm.topPivot.rotation.set(-1.35, swing * 0.7, 0.25 + swing * 0.7);
        } else {
          // Elevaciones laterales
          const abduction = 0.15 + c * 1.35;
          leftArm.topPivot.rotation.set(-0.2, 0, -abduction);
          rightArm.topPivot.rotation.set(-0.2, 0, abduction);
          leftArm.midPivot.rotation.x = -0.25;
          rightArm.midPivot.rotation.x = -0.25;
        }
      } else if (p === 'Aislamiento Pectoral') {
        // Peck Deck / Aperturas
        const close = c * 1.15;
        leftArm.topPivot.rotation.set(-1.45, 0, -1.2 + close);
        rightArm.topPivot.rotation.set(-1.45, 0, 1.2 - close);
        leftArm.midPivot.rotation.x = -0.35;
        rightArm.midPivot.rotation.x = -0.35;
      } else if (p === 'Bíceps') {
        const curl = 0.2 + c * 1.85;
        leftArm.topPivot.rotation.x = id.includes('incline') ? 0.35 : -0.05;
        rightArm.topPivot.rotation.x = id.includes('incline') ? 0.35 : -0.05;
        leftArm.midPivot.rotation.x = -curl;
        rightArm.midPivot.rotation.x = -curl;
        if (barbellGroup) {
          barbellGroup.position.set(0, 0.92 + c * 0.45, 0.26);
        }
      } else if (p === 'Tríceps') {
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
          leftArm.topPivot.rotation.x = -3.0;
          rightArm.topPivot.rotation.x = -3.0;
          pelvisPivot.position.y = 1.05;
          leftLeg.topPivot.rotation.x = -0.2 - c * 1.45;
          rightLeg.topPivot.rotation.x = -0.2 - c * 1.45;
        } else {
          spinePivot.rotation.x = 0.15 + c * 0.85;
          leftArm.topPivot.rotation.x = -1.6;
          rightArm.topPivot.rotation.x = -1.6;
          leftArm.midPivot.rotation.x = -1.3;
          rightArm.midPivot.rotation.x = -1.3;
        }
      } else if (p === 'Gemelos') {
        pelvisPivot.position.y = 0.95 + c * 0.09;
      }

      controls.update();
      renderer.render(scene, camera);
    };

    frameId = requestAnimationFrame(animate);

    // Resize responsive
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
