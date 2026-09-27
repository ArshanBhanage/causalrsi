'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { stepSpring } from '@/lib/motion';
import { useObservatory } from '@/lib/store';
import { pointer } from '@/hooks/usePointerLens';

/**
 * The camera is owned by the choreography. Bounded orbit is permitted only in the exploratory
 * scenes, and it always returns to the scripted pose.
 */
const ORBIT_SCENES = new Set(['OBSERVE', 'ATTRIBUTION']);
const MAX_AZIMUTH = (30 * Math.PI) / 180;
const MAX_ELEVATION = (20 * Math.PI) / 180;

export function CameraRig() {
  const { camera, size } = useThree();

  const state = useRef({
    px: 0,
    py: 0,
    pz: 3,
    vx: 0,
    vy: 0,
    vz: 0,
    tx: 0,
    ty: 0,
    tz: 0,
    az: 0,
    el: 0,
    started: false,
  });

  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const store = useObservatory.getState();
    const pose = store.derived.camera;
    const reduced = store.reducedMotion;
    const s = state.current;

    // bounded orbit, only where the spec allows it
    const canOrbit = ORBIT_SCENES.has(store.derived.scene) && !reduced;
    const wantAz = canOrbit && pointer.inside ? pointer.ndc.x * MAX_AZIMUTH : 0;
    const wantEl = canOrbit && pointer.inside ? pointer.ndc.y * MAX_ELEVATION : 0;
    const orbitK = Math.min(1, dt * 1.4);
    s.az += (wantAz - s.az) * orbitK;
    s.el += (wantEl - s.el) * orbitK;

    const radius = Math.hypot(pose.position.x, pose.position.z) || 0.0001;
    const baseAngle = Math.atan2(pose.position.x, pose.position.z);
    const angle = baseAngle + s.az;
    const desiredX = Math.sin(angle) * radius;
    const desiredZ = Math.cos(angle) * radius;
    const desiredY = pose.position.y + s.el * radius * 0.5;

    if (!s.started) {
      // land on the opening pose immediately so the first rendered frame is composed
      s.started = true;
      s.px = desiredX;
      s.py = desiredY;
      s.pz = desiredZ;
      s.tx = pose.target.x;
      s.ty = pose.target.y;
      s.tz = pose.target.z;
    } else if (reduced) {
      s.px = desiredX;
      s.py = desiredY;
      s.pz = desiredZ;
      s.tx = pose.target.x;
      s.ty = pose.target.y;
      s.tz = pose.target.z;
    } else {
      [s.px, s.vx] = stepSpring(s.px, s.vx, desiredX, dt, { omega: 5.2, zeta: 1.05 });
      [s.py, s.vy] = stepSpring(s.py, s.vy, desiredY, dt, { omega: 5.2, zeta: 1.05 });
      [s.pz, s.vz] = stepSpring(s.pz, s.vz, desiredZ, dt, { omega: 5.2, zeta: 1.05 });
      const tk = Math.min(1, dt * 3.2);
      s.tx += (pose.target.x - s.tx) * tk;
      s.ty += (pose.target.y - s.ty) * tk;
      s.tz += (pose.target.z - s.tz) * tk;
    }

    camera.position.set(s.px, s.py, s.pz);
    // On portrait viewports the readouts own the lower band, so the world is framed higher.
    const portrait = size.height > 0 && size.width / size.height < 0.8;
    target.set(s.tx, s.ty - (portrait ? 1.15 : 0), s.tz);
    camera.lookAt(target);

    const perspective = camera as THREE.PerspectiveCamera;
    if (perspective.isPerspectiveCamera) {
      const aspect = size.height === 0 ? 1.6 : size.width / size.height;
      // portrait viewports need a wider field to hold the same amount of graph
      const targetFov = pose.fov * (aspect < 0.8 ? 1.32 : aspect < 1.1 ? 1.14 : 1);
      const next = perspective.fov + (targetFov - perspective.fov) * Math.min(1, dt * 3);
      if (Math.abs(next - perspective.fov) > 0.001) {
        perspective.fov = next;
        perspective.updateProjectionMatrix();
      }
    }
  });

  return null;
}
