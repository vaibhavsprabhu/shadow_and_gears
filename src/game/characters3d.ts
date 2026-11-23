import * as THREE from 'three';

export type CharacterId3D =
  | 'roman'
  | 'john'
  | 'brock'
  | 'randy'
  | 'shasha'
  | 'pablo'
  | 'shamus';

export type GameplayCharacterKind =
  | CharacterId3D
  | 'guard'
  | 'swat'
  | 'cartel';

export interface Character3DSpec {
  id: CharacterId3D;
  name: string;
  heightLabel: string;
  archetype: string;
  description: string;
  targetY: number;
  cameraPos: [number, number, number];
  bgHex: number;
  rimHex: number;
}

export const CHARACTER_3D_SPECS: Character3DSpec[] = [
  {
    id: 'roman',
    name: 'Roman',
    heightLabel: "5'10\"",
    archetype: 'P1 · Street Bruiser',
    description:
      'Boxy dark-brown leather zip jacket over fitted matte-black crewneck tee, dark curls with beard, silver accents, street trousers, and boots.',
    targetY: 0.98,
    cameraPos: [0, 1.32, 3.55],
    bgHex: 0x181c20,
    rimHex: 0xd97706,
  },
  {
    id: 'john',
    name: 'John',
    heightLabel: "5'5\"",
    archetype: 'P3 · The Muscle',
    description:
      'Red-and-navy checkered shirt with rolled sleeves, bowl cut, skinny jeans, and sneakers.',
    targetY: 0.9,
    cameraPos: [0, 1.3, 3.6],
    bgHex: 0x161c22,
    rimHex: 0xf97316,
  },
  {
    id: 'brock',
    name: 'Brock',
    heightLabel: "5'10\"",
    archetype: 'P2 · Hacker / Heavy',
    description:
      'V-taper frame in olive tank top and dark denim vest, French beard, utility pouches, and combat boots.',
    targetY: 1.0,
    cameraPos: [0, 1.35, 3.6],
    bgHex: 0x14181e,
    rimHex: 0x60a5fa,
  },
  {
    id: 'randy',
    name: 'Randy',
    heightLabel: "7'0\"",
    archetype: 'P4 · Agile Striker & Driver',
    description:
      'Lean 7-foot frame with charcoal compression top, slate open jacket with amber trim, crossbody sling, and fade.',
    targetY: 1.15,
    cameraPos: [0, 1.5, 4.1],
    bgHex: 0x14181e,
    rimHex: 0xf59e0b,
  },
  {
    id: 'shasha',
    name: 'Shasha',
    heightLabel: "5'6\"",
    archetype: 'Target · Precision Infiltrator',
    description:
      'Tailored crimson-plum trench coat over obsidian turtleneck, leather gloves, and sleek dark bob.',
    targetY: 0.92,
    cameraPos: [0, 1.28, 3.5],
    bgHex: 0x17141d,
    rimHex: 0xf472b6,
  },
  {
    id: 'pablo',
    name: 'Pablo',
    heightLabel: "6'0\"",
    archetype: 'Villain · Syndicate Boss',
    description:
      'Weathered espresso leather coat over dark linen shirt, rugged beard, hip holster, gold watch, and signet ring.',
    targetY: 1.02,
    cameraPos: [0, 1.38, 3.7],
    bgHex: 0x181512,
    rimHex: 0xd97706,
  },
  {
    id: 'shamus',
    name: 'Officer Shamus',
    heightLabel: "5'11\"",
    archetype: 'Villain · Tactical Vanguard',
    description:
      'Matte black ballistic vest with silver police badge over navy uniform, textured dark curls, handcuffs, and duty holster.',
    targetY: 1.0,
    cameraPos: [0, 1.36, 3.6],
    bgHex: 0x181c20,
    rimHex: 0x3b82f6,
  },
];

export interface BuiltCharacterRig {
  group: THREE.Group;
  animate: (
    elapsed: number,
    walkPhase?: number,
    isMoving?: boolean,
    carryingBag?: boolean
  ) => void;
  textures: THREE.Texture[];
}

function attachCarryBag(parent: THREE.Object3D, y: number, z = -0.2): THREE.Group {
  const bagGroup = new THREE.Group();
  bagGroup.position.set(0, y, z);
  bagGroup.visible = false;

  const duffelMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xe5a93b, roughness: 0.4, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.16), duffelMat);
  body.castShadow = true;
  bagGroup.add(body);

  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.045, 0.175), trimMat);
  strap.position.y = 0.03;
  bagGroup.add(strap);

  parent.add(bagGroup);
  return bagGroup;
}

function makeLimb(
  radiusTop: number,
  radiusBottom: number,
  length: number,
  material: THREE.Material
): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 20);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createCheckTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#8b2635';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = 'rgba(24, 34, 64, 0.65)';
  const step = 32;
  for (let x = 0; x < 256; x += step) {
    ctx.fillRect(x, 0, step / 2, 256);
  }
  for (let y = 0; y < 256; y += step) {
    ctx.fillRect(0, y, 256, step / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function buildJohn3D(maxAnisotropy: number): BuiltCharacterRig {
  const john = new THREE.Group();
  const checkTex = createCheckTexture(maxAnisotropy);

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.6 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x3b281e, roughness: 0.85 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: checkTex, roughness: 0.75 });
  const jeansMat = new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.8 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.7 });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.45 });

  // Torso & belly
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 0.32, 24), shirtMat);
  chest.position.set(0, 1.12, 0);
  chest.scale.set(1.15, 1, 0.85);
  chest.castShadow = true;
  john.add(chest);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 24), shirtMat);
  belly.position.set(0, 0.9, 0.035);
  belly.scale.set(1.05, 0.95, 0.95);
  belly.castShadow = true;
  john.add(belly);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.06, 20), shirtMat);
  collar.position.set(0, 1.29, 0);
  john.add(collar);

  const buttonGeo = new THREE.SphereGeometry(0.01, 8, 8);
  for (let i = 0; i < 4; i++) {
    const btn = new THREE.Mesh(buttonGeo, soleMat);
    btn.position.set(0, 1.22 - i * 0.1, 0.21 + (i === 3 ? 0.04 : 0.01));
    john.add(btn);
  }

  // Head & Bowl Cut
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.45, 0);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 24, 24), skinMat);
  head.scale.set(0.95, 1.08, 1);
  head.castShadow = true;
  headGroup.add(head);

  const bowlTop = new THREE.Mesh(
    new THREE.SphereGeometry(0.156, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hairMat
  );
  bowlTop.position.set(0, 0.015, -0.005);
  bowlTop.rotation.x = -0.08;
  bowlTop.castShadow = true;
  headGroup.add(bowlTop);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  const eyeGeo = new THREE.SphereGeometry(0.015, 12, 12);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.048, -0.01, 0.132);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.048, -0.01, 0.132);
  headGroup.add(leftEye, rightEye);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.045, 12), skinMat);
  nose.position.set(0, -0.035, 0.148);
  nose.rotation.x = 0.2;
  headGroup.add(nose);

  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 8, 16, Math.PI * 0.8), hairMat);
  smile.position.set(0, -0.068, 0.132);
  smile.rotation.z = Math.PI * 1.1;
  headGroup.add(smile);

  john.add(headGroup);

  // Arms
  function createArm(isLeft: boolean) {
    const armGroup = new THREE.Group();
    const side = isLeft ? -1 : 1;
    armGroup.position.set(side * 0.24, 1.22, 0);
    armGroup.rotation.z = side * -0.12;

    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 16), shirtMat);
    shoulderCap.position.y = 0.0;
    shoulderCap.castShadow = true;
    armGroup.add(shoulderCap);

    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.24, 16), shirtMat);
    sleeve.position.y = -0.11;
    sleeve.castShadow = true;
    armGroup.add(sleeve);

    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.012, 8, 16), shirtMat);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.22;
    armGroup.add(cuff);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.042, 0.23, 16), skinMat);
    forearm.position.y = -0.33;
    forearm.castShadow = true;
    armGroup.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 16), skinMat);
    hand.position.y = -0.46;
    hand.scale.set(0.8, 1.2, 0.6);
    armGroup.add(hand);
    return armGroup;
  }
  const leftArm = createArm(true);
  const rightArm = createArm(false);
  john.add(leftArm, rightArm);

  // Pelvis & Skinny Jeans + Sneakers (sole bottom sits at y = 0)
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.16, 20), jeansMat);
  pelvis.position.set(0, 0.72, 0.01);
  pelvis.scale.set(1.05, 1, 0.85);
  pelvis.castShadow = true;
  john.add(pelvis);

  function createLeg(isLeft: boolean) {
    const legGroup = new THREE.Group();
    const side = isLeft ? -1 : 1;
    legGroup.position.set(side * 0.095, 0.68, 0);

    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.055, 0.62, 16), jeansMat);
    leg.position.y = -0.31;
    leg.castShadow = true;
    legGroup.add(leg);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.22), shoeMat);
    shoe.position.set(0, -0.63, 0.04);
    shoe.castShadow = true;
    legGroup.add(shoe);

    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.116, 0.022, 0.226), soleMat);
    sole.position.set(0, -0.665, 0.04);
    legGroup.add(sole);
    return legGroup;
  }
  const leftLeg = createLeg(true);
  const rightLeg = createLeg(false);
  john.add(leftLeg, rightLeg);

  const carryBag = attachCarryBag(john, 1.02, -0.24);

  // Ground flush at y = 0 (sole bottom was -0.665 - 0.011 + 0.68 = +0.004)
  john.position.y = -0.004;

  return {
    group: john,
    textures: [checkTex],
    animate: (t: number, walkPhase = 0, isMoving = false, carryingBag = false) => {
      carryBag.visible = carryingBag;
      if (isMoving) {
        const swing = Math.sin(walkPhase) * 0.55;
        leftLeg.rotation.x = swing;
        rightLeg.rotation.x = -swing;
        leftArm.rotation.x = -swing * 0.75;
        rightArm.rotation.x = swing * 0.75;
        chest.position.y = 1.12 + Math.abs(Math.cos(walkPhase)) * 0.02;
        headGroup.position.y = 1.45 + Math.abs(Math.cos(walkPhase)) * 0.02;
      } else {
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
        leftArm.rotation.x = 0;
        rightArm.rotation.x = 0;
        chest.position.y = 1.12 + Math.sin(t * 2) * 0.004;
        headGroup.position.y = 1.45 + Math.sin(t * 2) * 0.004;
      }
    },
  };
}

export function buildBrock3D(): BuiltCharacterRig {
  const brock = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.55 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x161412, roughness: 0.9 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x4b5842, roughness: 0.8 });
  const vestMat = new THREE.MeshStandardMaterial({ color: 0x282d33, roughness: 0.75 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x323639, roughness: 0.85 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.55 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.45 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.85, roughness: 0.25 });

  // Pelvis & Utility Belt
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.26), pantsMat);
  pelvis.position.y = 0.92;
  pelvis.castShadow = true;
  brock.add(pelvis);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.28), leatherMat);
  belt.position.y = 1.01;
  brock.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.065, 0.02), steelMat);
  buckle.position.set(0, 1.01, 0.145);
  brock.add(buckle);

  [-0.24, 0.24].forEach((xPos) => {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 0.14), leatherMat);
    pouch.position.set(xPos, 0.96, 0.02);
    pouch.castShadow = true;
    brock.add(pouch);
  });

  // Upper Body
  const upperBody = new THREE.Group();
  upperBody.position.y = 1.03;
  brock.add(upperBody);

  const abs = makeLimb(0.21, 0.18, 0.22, tankMat);
  abs.scale.set(1.1, 1, 0.72);
  abs.position.y = 0.11;
  upperBody.add(abs);

  const chest = makeLimb(0.29, 0.21, 0.3, tankMat);
  chest.scale.set(1.18, 1, 0.78);
  chest.position.y = 0.36;
  upperBody.add(chest);

  [-0.17, 0.17].forEach((xPos) => {
    const vestSide = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.48, 0.34), vestMat);
    vestSide.position.set(xPos, 0.26, 0.01);
    vestSide.castShadow = true;
    upperBody.add(vestSide);
  });
  const vestBack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.48, 0.1), vestMat);
  vestBack.position.set(0, 0.26, -0.14);
  vestBack.castShadow = true;
  upperBody.add(vestBack);

  const traps = makeLimb(0.11, 0.2, 0.1, skinMat);
  traps.scale.set(1.3, 1, 0.9);
  traps.position.y = 0.53;
  upperBody.add(traps);

  // Head & French Beard
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.68, 0.01);
  upperBody.add(headGroup);

  const cranium = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.23, 0.21), skinMat);
  cranium.castShadow = true;
  headGroup.add(cranium);

  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.22), hairMat);
  hairTop.position.set(0, 0.1, -0.005);
  headGroup.add(hairTop);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  [-0.045, 0.045].forEach((xPos) => {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.015, 0.02), hairMat);
    brow.position.set(xPos, 0.035, 0.105);
    brow.rotation.z = xPos < 0 ? -0.1 : 0.1;
    headGroup.add(brow);

    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.015, 0.01), eyeMat);
    eye.position.set(xPos, 0.015, 0.105);
    headGroup.add(eye);
  });

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.055, 0.04), skinMat);
  nose.position.set(0, -0.005, 0.115);
  headGroup.add(nose);

  const mustache = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.022, 0.025), hairMat);
  mustache.position.set(0, -0.045, 0.108);
  headGroup.add(mustache);

  [-0.042, 0.042].forEach((xPos) => {
    const beardSide = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.065, 0.025), hairMat);
    beardSide.position.set(xPos, -0.075, 0.106);
    headGroup.add(beardSide);
  });

  const goatee = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.042, 0.035), hairMat);
  goatee.position.set(0, -0.1, 0.102);
  headGroup.add(goatee);

  function buildArm(side: number) {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.36, 0.44, 0);

    const delt = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 16), skinMat);
    delt.scale.set(1.05, 1.15, 1.05);
    delt.castShadow = true;
    armGroup.add(delt);

    const upperArm = makeLimb(0.095, 0.082, 0.26, skinMat);
    upperArm.position.set(side * 0.03, -0.15, 0);
    upperArm.rotation.z = side * 0.14;
    armGroup.add(upperArm);

    const forearm = makeLimb(0.082, 0.062, 0.25, skinMat);
    forearm.position.set(side * 0.05, -0.37, 0.04);
    forearm.rotation.x = -0.25;
    armGroup.add(forearm);

    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.11, 0.105), leatherMat);
    glove.position.set(side * 0.05, -0.52, 0.08);
    glove.castShadow = true;
    armGroup.add(glove);
    return armGroup;
  }

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);
  upperBody.add(leftArm, rightArm);

  function buildLeg(side: number) {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.13, 0.85, 0);

    const thigh = makeLimb(0.125, 0.105, 0.4, pantsMat);
    thigh.position.set(side * 0.02, -0.2, 0);
    thigh.rotation.z = side * 0.05;
    legGroup.add(thigh);

    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.12), pantsMat);
    pocket.position.set(side * 0.135, -0.2, 0);
    legGroup.add(pocket);

    const shin = makeLimb(0.098, 0.082, 0.32, pantsMat);
    shin.position.set(side * 0.03, -0.52, 0);
    legGroup.add(shin);

    const bootShaft = makeLimb(0.085, 0.082, 0.16, bootMat);
    bootShaft.position.set(side * 0.03, -0.73, 0);
    legGroup.add(bootShaft);

    const bootFoot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.28), bootMat);
    bootFoot.position.set(side * 0.03, -0.805, 0.045);
    bootFoot.castShadow = true;
    legGroup.add(bootFoot);
    return legGroup;
  }
  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);
  brock.add(leftLeg, rightLeg);

  const carryBag = attachCarryBag(upperBody, 0.24, -0.24);

  return {
    group: brock,
    textures: [],
    animate: (t: number, walkPhase = 0, isMoving = false, carryingBag = false) => {
      carryBag.visible = carryingBag;
      if (isMoving) {
        const swing = Math.sin(walkPhase) * 0.55;
        leftLeg.rotation.x = swing;
        rightLeg.rotation.x = -swing;
        leftArm.rotation.x = -swing * 0.72;
        rightArm.rotation.x = swing * 0.72;
        leftArm.rotation.z = 0;
        rightArm.rotation.z = 0;
        upperBody.position.y = 1.03 + Math.abs(Math.cos(walkPhase)) * 0.022;
        headGroup.rotation.y = 0;
      } else {
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
        leftArm.rotation.x = 0;
        rightArm.rotation.x = 0;
        upperBody.position.y = 1.03 + Math.sin(t * 2.2) * 0.012;
        chest.scale.set(1.18 + Math.sin(t * 2.2) * 0.025, 1, 0.78 + Math.sin(t * 2.2) * 0.025);
        headGroup.rotation.y = Math.sin(t * 0.9) * 0.08;
        leftArm.rotation.z = Math.sin(t * 2.2) * 0.02;
        rightArm.rotation.z = -Math.sin(t * 2.2) * 0.02;
      }
    },
  };
}

export function buildRandy3D(): BuiltCharacterRig {
  const randy = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.5 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x111010, roughness: 0.9 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.75 });
  const jacketMat = new THREE.MeshStandardMaterial({ color: 0x2b3a4a, roughness: 0.8 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.55 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.85 });
  const wrapMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.7 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 });

  // Slim Pelvis & Belt
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.22), pantsMat);
  pelvis.position.y = 1.14;
  pelvis.castShadow = true;
  randy.add(pelvis);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.045, 0.23), accentMat);
  belt.position.y = 1.23;
  randy.add(belt);

  // Lean Athletic Torso
  const upperBody = new THREE.Group();
  upperBody.position.y = 1.25;
  randy.add(upperBody);

  const abs = makeLimb(0.165, 0.145, 0.28, shirtMat);
  abs.scale.set(1.05, 1, 0.68);
  abs.position.y = 0.14;
  upperBody.add(abs);

  const chest = makeLimb(0.215, 0.165, 0.34, shirtMat);
  chest.scale.set(1.12, 1, 0.72);
  chest.position.y = 0.43;
  upperBody.add(chest);

  [-0.145, 0.145].forEach((xPos) => {
    const jacketFront = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.68, 0.27), jacketMat);
    jacketFront.position.set(xPos, 0.28, 0.01);
    jacketFront.castShadow = true;
    upperBody.add(jacketFront);

    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.68, 0.02), accentMat);
    trim.position.set(xPos + (xPos < 0 ? 0.052 : -0.052), 0.28, 0.14);
    upperBody.add(trim);
  });

  const jacketBack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.68, 0.08), jacketMat);
  jacketBack.position.set(0, 0.28, -0.11);
  jacketBack.castShadow = true;
  upperBody.add(jacketBack);

  const sling = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.62, 0.29), accentMat);
  sling.position.set(0, 0.32, 0.005);
  sling.rotation.z = -0.52;
  upperBody.add(sling);

  const neck = makeLimb(0.068, 0.082, 0.13, skinMat);
  neck.position.y = 0.64;
  upperBody.add(neck);

  // Head & Sharp Fade
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.79, 0.01);
  upperBody.add(headGroup);

  const cranium = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.23, 0.195), skinMat);
  cranium.castShadow = true;
  headGroup.add(cranium);

  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.178, 0.075, 0.202), hairMat);
  hairTop.position.set(0, 0.115, -0.003);
  headGroup.add(hairTop);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0d0d0d });
  [-0.04, 0.04].forEach((xPos) => {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.012, 0.018), hairMat);
    brow.position.set(xPos, 0.035, 0.098);
    headGroup.add(brow);

    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.013, 0.01), eyeMat);
    eye.position.set(xPos, 0.016, 0.098);
    headGroup.add(eye);
  });

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.055, 0.036), skinMat);
  nose.position.set(0, -0.005, 0.108);
  headGroup.add(nose);

  const lightMustache = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.012, 0.018), hairMat);
  lightMustache.position.set(0, -0.045, 0.099);
  headGroup.add(lightMustache);

  // Long Lean Arms (completing wrist wraps & hands cleanly)
  function buildArm(side: number) {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.265, 0.54, 0);

    const delt = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 16), skinMat);
    delt.scale.set(0.95, 1.15, 0.95);
    delt.castShadow = true;
    armGroup.add(delt);

    const upperArm = makeLimb(0.062, 0.054, 0.34, skinMat);
    upperArm.position.set(side * 0.02, -0.18, 0);
    upperArm.rotation.z = side * 0.09;
    armGroup.add(upperArm);

    const forearm = makeLimb(0.054, 0.042, 0.33, skinMat);
    forearm.position.set(side * 0.035, -0.49, 0.03);
    forearm.rotation.x = -0.18;
    armGroup.add(forearm);

    const wrap = makeLimb(0.045, 0.044, 0.09, wrapMat);
    wrap.position.set(side * 0.035, -0.62, 0.055);
    wrap.rotation.x = -0.18;
    armGroup.add(wrap);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.09, 0.08), skinMat);
    hand.position.set(side * 0.035, -0.69, 0.072);
    hand.castShadow = true;
    armGroup.add(hand);

    return armGroup;
  }

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);
  upperBody.add(leftArm, rightArm);

  // Long Athletic Legs & High-Top Boots (7'0" silhouette)
  function buildLeg(side: number) {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.11, 1.07, 0);

    const thigh = makeLimb(0.095, 0.078, 0.5, pantsMat);
    thigh.position.set(side * 0.015, -0.25, 0);
    thigh.rotation.z = side * 0.03;
    legGroup.add(thigh);

    const shin = makeLimb(0.076, 0.058, 0.45, pantsMat);
    shin.position.set(side * 0.02, -0.7, 0);
    legGroup.add(shin);

    const bootShaft = makeLimb(0.064, 0.062, 0.14, shoeMat);
    bootShaft.position.set(side * 0.02, -0.96, 0);
    legGroup.add(bootShaft);

    const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.26), shoeMat);
    bootSole.position.set(side * 0.02, -1.03, 0.045);
    bootSole.castShadow = true;
    legGroup.add(bootSole);

    return legGroup;
  }
  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);
  randy.add(leftLeg, rightLeg);

  const carryBag = attachCarryBag(upperBody, 0.3, -0.2);

  return {
    group: randy,
    textures: [],
    animate: (t: number, walkPhase = 0, isMoving = false, carryingBag = false) => {
      carryBag.visible = carryingBag;
      if (isMoving) {
        const swing = Math.sin(walkPhase) * 0.52;
        leftLeg.rotation.x = swing;
        rightLeg.rotation.x = -swing;
        leftArm.rotation.x = -swing * 0.7;
        rightArm.rotation.x = swing * 0.7;
        upperBody.position.y = 1.25 + Math.abs(Math.cos(walkPhase)) * 0.024;
        headGroup.rotation.y = 0;
      } else {
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
        upperBody.position.y = 1.25 + Math.sin(t * 2.0) * 0.01;
        headGroup.rotation.y = Math.sin(t * 0.8) * 0.07;
        leftArm.rotation.x = Math.sin(t * 2.0) * 0.025;
        rightArm.rotation.x = -Math.sin(t * 2.0) * 0.025;
      }
    },
  };
}

export function buildShasha3D(): BuiltCharacterRig {
  const shasha = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a37c, roughness: 0.48 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1b1518, roughness: 0.72 });
  const coatMat = new THREE.MeshStandardMaterial({ color: 0x6b1d3a, roughness: 0.62 }); // Crimson-plum tailored trench
  const knitMat = new THREE.MeshStandardMaterial({ color: 0x16181f, roughness: 0.82 }); // Obsidian turtleneck
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.78 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x1f191d, roughness: 0.38 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.88, roughness: 0.22 });

  // Pelvis & Belt
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.2), pantsMat);
  pelvis.position.y = 0.88;
  pelvis.castShadow = true;
  shasha.add(pelvis);

  const waistBelt = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.045, 0.21), gloveMat);
  waistBelt.position.y = 0.96;
  shasha.add(waistBelt);

  const beltClasp = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.048, 0.018), goldMat);
  beltClasp.position.set(0, 0.96, 0.11);
  shasha.add(beltClasp);

  // Upper Body & Tailored Trench
  const upperBody = new THREE.Group();
  upperBody.position.y = 0.97;
  shasha.add(upperBody);

  const waist = makeLimb(0.145, 0.13, 0.22, knitMat);
  waist.scale.set(1.05, 1, 0.7);
  waist.position.y = 0.11;
  upperBody.add(waist);

  const chest = makeLimb(0.185, 0.145, 0.24, knitMat);
  chest.scale.set(1.12, 1, 0.76);
  chest.position.y = 0.32;
  upperBody.add(chest);

  const turtleneck = makeLimb(0.068, 0.075, 0.1, knitMat);
  turtleneck.position.y = 0.48;
  upperBody.add(turtleneck);

  [-0.12, 0.12].forEach((xPos) => {
    const coatPanel = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.62, 0.23), coatMat);
    coatPanel.position.set(xPos, 0.16, 0.005);
    coatPanel.castShadow = true;
    upperBody.add(coatPanel);

    const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.02), coatMat);
    lapel.position.set(xPos + (xPos < 0 ? 0.04 : -0.04), 0.34, 0.125);
    lapel.rotation.z = xPos < 0 ? -0.14 : 0.14;
    upperBody.add(lapel);
  });

  const coatBack = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.62, 0.075), coatMat);
  coatBack.position.set(0, 0.16, -0.095);
  coatBack.castShadow = true;
  upperBody.add(coatBack);

  // Head & Sleek Bob Hair
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.61, 0.01);
  upperBody.add(headGroup);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.115, 22, 22), skinMat);
  cranium.scale.set(0.92, 1.08, 0.96);
  cranium.castShadow = true;
  headGroup.add(cranium);

  const hairCrown = new THREE.Mesh(
    new THREE.SphereGeometry(0.126, 22, 22, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat
  );
  hairCrown.position.set(0, 0.015, -0.01);
  hairCrown.rotation.x = -0.12;
  hairCrown.castShadow = true;
  headGroup.add(hairCrown);

  [-0.085, 0.085].forEach((xPos) => {
    const hairSide = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.18, 0.14), hairMat);
    hairSide.position.set(xPos, -0.03, -0.02);
    headGroup.add(hairSide);
  });

  const hairBackBob = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.19, 0.06), hairMat);
  hairBackBob.position.set(0, -0.035, -0.085);
  headGroup.add(hairBackBob);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  [-0.038, 0.038].forEach((xPos) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 10), eyeMat);
    eye.position.set(xPos, 0.01, 0.1);
    headGroup.add(eye);

    const earring = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 8), goldMat);
    earring.position.set(xPos * 2.75, -0.035, 0.0);
    headGroup.add(earring);
  });

  // Arms
  function buildArm(side: number) {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.215, 0.4, 0);

    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 14), coatMat);
    shoulder.castShadow = true;
    armGroup.add(shoulder);

    const upperArm = makeLimb(0.052, 0.046, 0.24, coatMat);
    upperArm.position.set(side * 0.02, -0.13, 0);
    upperArm.rotation.z = side * 0.08;
    armGroup.add(upperArm);

    const forearm = makeLimb(0.045, 0.036, 0.23, coatMat);
    forearm.position.set(side * 0.03, -0.35, 0.025);
    forearm.rotation.x = -0.15;
    armGroup.add(forearm);

    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.085, 0.065), gloveMat);
    glove.position.set(side * 0.03, -0.49, 0.045);
    glove.castShadow = true;
    armGroup.add(glove);
    return armGroup;
  }

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);
  upperBody.add(leftArm, rightArm);

  // Legs & Boots (5'6" proportions)
  function buildLeg(side: number) {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.09, 0.82, 0);

    const thigh = makeLimb(0.082, 0.068, 0.38, pantsMat);
    thigh.position.set(side * 0.01, -0.19, 0);
    legGroup.add(thigh);

    const shin = makeLimb(0.064, 0.048, 0.33, pantsMat);
    shin.position.set(side * 0.012, -0.52, 0);
    legGroup.add(shin);

    const bootShaft = makeLimb(0.054, 0.052, 0.11, gloveMat);
    bootShaft.position.set(side * 0.012, -0.72, 0);
    legGroup.add(bootShaft);

    const bootFoot = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.06, 0.21), gloveMat);
    bootFoot.position.set(side * 0.012, -0.79, 0.038);
    bootFoot.castShadow = true;
    legGroup.add(bootFoot);
    return legGroup;
  }
  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);
  shasha.add(leftLeg, rightLeg);

  return {
    group: shasha,
    textures: [],
    animate: (t: number, walkPhase = 0, isMoving = false) => {
      if (isMoving) {
        const swing = Math.sin(walkPhase) * 0.48;
        leftLeg.rotation.x = swing;
        rightLeg.rotation.x = -swing;
        leftArm.rotation.x = -swing * 0.65;
        rightArm.rotation.x = swing * 0.65;
        upperBody.position.y = 0.97 + Math.abs(Math.cos(walkPhase)) * 0.015;
        headGroup.rotation.y = 0;
      } else {
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
        upperBody.position.y = 0.97 + Math.sin(t * 2.1) * 0.006;
        headGroup.rotation.y = Math.sin(t * 0.85) * 0.1;
        leftArm.rotation.x = Math.sin(t * 2.1) * 0.018;
        rightArm.rotation.x = -Math.sin(t * 2.1) * 0.018;
      }
    },
  };
}

export function buildPablo3D(): BuiltCharacterRig {
  const pablo = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: 0x9c663b, roughness: 0.52 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1a1715, roughness: 0.88 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0x1e2024, roughness: 0.72 });
  const coatMat = new THREE.MeshStandardMaterial({ color: 0x3d2518, roughness: 0.55 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x181a1d, roughness: 0.75 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.35 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.88, roughness: 0.22 });

  // Pelvis, Belt & Holster
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.17, 0.23), pantsMat);
  pelvis.position.y = 0.96;
  pelvis.castShadow = true;
  pablo.add(pelvis);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.05, 0.24), bootMat);
  belt.position.y = 1.045;
  pablo.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.052, 0.015), goldMat);
  buckle.position.set(0, 1.045, 0.124);
  pablo.add(buckle);

  const holster = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.14, 0.09), bootMat);
  holster.position.set(0.21, 0.97, 0.02);
  holster.castShadow = true;
  pablo.add(holster);

  // Upper Body & Espresso Leather Coat
  const upperBody = new THREE.Group();
  upperBody.position.y = 1.06;
  pablo.add(upperBody);

  const abs = makeLimb(0.175, 0.155, 0.24, shirtMat);
  abs.scale.set(1.08, 1, 0.72);
  abs.position.y = 0.12;
  upperBody.add(abs);

  const chest = makeLimb(0.225, 0.175, 0.28, shirtMat);
  chest.scale.set(1.14, 1, 0.75);
  chest.position.y = 0.36;
  upperBody.add(chest);

  const vNeck = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.12, 0.02), skinMat);
  vNeck.position.set(0, 0.44, 0.158);
  upperBody.add(vNeck);

  [-0.145, 0.145].forEach((xPos) => {
    const coatFront = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.66, 0.28), coatMat);
    coatFront.position.set(xPos, 0.21, 0.01);
    coatFront.castShadow = true;
    upperBody.add(coatFront);

    const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.26, 0.025), coatMat);
    lapel.position.set(xPos + (xPos < 0 ? 0.045 : -0.045), 0.38, 0.152);
    lapel.rotation.z = xPos < 0 ? -0.14 : 0.14;
    upperBody.add(lapel);
  });

  const coatBack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.66, 0.09), coatMat);
  coatBack.position.set(0, 0.21, -0.115);
  coatBack.castShadow = true;
  upperBody.add(coatBack);

  const neck = makeLimb(0.072, 0.088, 0.11, skinMat);
  neck.position.y = 0.54;
  upperBody.add(neck);

  // Head & Rugged Beard
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.68, 0.01);
  upperBody.add(headGroup);

  const cranium = new THREE.Mesh(new THREE.BoxGeometry(0.178, 0.225, 0.198), skinMat);
  cranium.castShadow = true;
  headGroup.add(cranium);

  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.188, 0.07, 0.212), hairMat);
  hairTop.position.set(0, 0.105, -0.01);
  hairTop.rotation.x = -0.08;
  headGroup.add(hairTop);

  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.182, 0.14, 0.04), hairMat);
  hairBack.position.set(0, 0.03, -0.095);
  headGroup.add(hairBack);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0e0e0e });
  [-0.042, 0.042].forEach((xPos) => {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.015, 0.02), hairMat);
    brow.position.set(xPos, 0.034, 0.1);
    brow.rotation.z = xPos < 0 ? -0.12 : 0.12;
    headGroup.add(brow);

    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.013, 0.01), eyeMat);
    eye.position.set(xPos, 0.015, 0.1);
    headGroup.add(eye);
  });

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.052, 0.038), skinMat);
  nose.position.set(0, -0.005, 0.11);
  headGroup.add(nose);

  const mustache = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.02, 0.022), hairMat);
  mustache.position.set(0, -0.044, 0.102);
  headGroup.add(mustache);

  const jawBeard = new THREE.Mesh(new THREE.BoxGeometry(0.184, 0.075, 0.185), hairMat);
  jawBeard.position.set(0, -0.078, 0.012);
  headGroup.add(jawBeard);

  function buildArm(side: number) {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.275, 0.45, 0);

    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 16), coatMat);
    shoulder.castShadow = true;
    armGroup.add(shoulder);

    const upperSleeve = makeLimb(0.068, 0.062, 0.26, coatMat);
    upperSleeve.position.set(side * 0.02, -0.14, 0);
    upperSleeve.rotation.z = side * 0.09;
    armGroup.add(upperSleeve);

    const cuff = makeLimb(0.064, 0.062, 0.04, shirtMat);
    cuff.position.set(side * 0.032, -0.27, 0);
    cuff.rotation.z = side * 0.09;
    armGroup.add(cuff);

    const forearm = makeLimb(0.056, 0.044, 0.25, skinMat);
    forearm.position.set(side * 0.038, -0.4, 0.028);
    forearm.rotation.x = -0.18;
    armGroup.add(forearm);

    if (side === -1) {
      const watch = makeLimb(0.048, 0.048, 0.022, goldMat);
      watch.position.set(side * 0.038, -0.5, 0.048);
      watch.rotation.x = -0.18;
      armGroup.add(watch);
    }

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.095, 0.085), skinMat);
    hand.position.set(side * 0.038, -0.55, 0.058);
    hand.castShadow = true;
    armGroup.add(hand);

    if (side === 1) {
      const ring = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.018), goldMat);
      ring.position.set(side * 0.038, -0.56, 0.102);
      armGroup.add(ring);
    }
    return armGroup;
  }

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);
  upperBody.add(leftArm, rightArm);

  function buildLeg(side: number) {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.115, 0.89, 0);

    const thigh = makeLimb(0.098, 0.082, 0.42, pantsMat);
    thigh.position.set(side * 0.015, -0.21, 0);
    thigh.rotation.z = side * 0.035;
    legGroup.add(thigh);

    const shin = makeLimb(0.078, 0.062, 0.35, pantsMat);
    shin.position.set(side * 0.022, -0.56, 0);
    legGroup.add(shin);

    const bootShaft = makeLimb(0.066, 0.064, 0.13, bootMat);
    bootShaft.position.set(side * 0.022, -0.77, 0);
    legGroup.add(bootShaft);

    const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.072, 0.25), bootMat);
    bootSole.position.set(side * 0.022, -0.845, 0.042);
    bootSole.castShadow = true;
    legGroup.add(bootSole);
    return legGroup;
  }
  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);
  pablo.add(leftLeg, rightLeg);

  return {
    group: pablo,
    textures: [],
    animate: (t: number, walkPhase = 0, isMoving = false) => {
      if (isMoving) {
        const swing = Math.sin(walkPhase) * 0.48;
        leftLeg.rotation.x = swing;
        rightLeg.rotation.x = -swing;
        leftArm.rotation.x = -swing * 0.65;
        rightArm.rotation.x = swing * 0.65;
        upperBody.position.y = 1.06 + Math.abs(Math.cos(walkPhase)) * 0.018;
        upperBody.rotation.y = 0;
        headGroup.rotation.y = 0;
      } else {
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
        upperBody.position.y = 1.06 + Math.sin(t * 1.8) * 0.008;
        upperBody.rotation.y = Math.sin(t * 0.7) * 0.035;
        headGroup.rotation.y = Math.sin(t * 0.6) * 0.09;
        leftArm.rotation.x = Math.sin(t * 1.8) * 0.02;
        rightArm.rotation.x = -Math.sin(t * 1.8) * 0.02;
      }
    },
  };
}

export function buildShamus3D(): BuiltCharacterRig {
  const shamus = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xa46c43, roughness: 0.5 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x151312, roughness: 0.92 });
  const uniformMat = new THREE.MeshStandardMaterial({ color: 0x1b263b, roughness: 0.75 });
  const vestMat = new THREE.MeshStandardMaterial({ color: 0x16191e, roughness: 0.65 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1c2536, roughness: 0.8 });
  const gearMat = new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.5 });
  const silverMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.2 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.6 });

  // Pelvis, Duty Belt, Handcuffs & Sidearm Holster
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.17, 0.23), pantsMat);
  pelvis.position.y = 0.94;
  pelvis.castShadow = true;
  shamus.add(pelvis);

  const dutyBelt = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.055, 0.25), gearMat);
  dutyBelt.position.y = 1.025;
  shamus.add(dutyBelt);

  const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.058, 0.015), silverMat);
  beltBuckle.position.set(0, 1.025, 0.13);
  shamus.add(beltBuckle);

  const holster = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.14, 0.095), gearMat);
  holster.position.set(0.215, 0.95, 0.02);
  holster.castShadow = true;
  shamus.add(holster);

  const cuffPouch = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.1, 0.09), gearMat);
  cuffPouch.position.set(-0.215, 0.98, 0.02);
  shamus.add(cuffPouch);

  const handcuffs = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.005, 8, 16), silverMat);
  handcuffs.position.set(-0.18, 0.98, 0.13);
  shamus.add(handcuffs);

  // Upper Body, Silver Chain & Ballistic Tactical Vest
  const upperBody = new THREE.Group();
  upperBody.position.y = 1.04;
  shamus.add(upperBody);

  const abs = makeLimb(0.175, 0.155, 0.24, uniformMat);
  abs.scale.set(1.08, 1, 0.72);
  abs.position.y = 0.12;
  upperBody.add(abs);

  const chest = makeLimb(0.225, 0.175, 0.27, uniformMat);
  chest.scale.set(1.14, 1, 0.75);
  chest.position.y = 0.35;
  upperBody.add(chest);

  const collarSkin = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.09, 0.02), skinMat);
  collarSkin.position.set(0, 0.45, 0.156);
  upperBody.add(collarSkin);

  const silverChain = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.004, 8, 20, Math.PI), silverMat);
  silverChain.position.set(0, 0.46, 0.165);
  silverChain.rotation.z = Math.PI;
  upperBody.add(silverChain);

  const vestFront = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.36, 0.28), vestMat);
  vestFront.position.set(0, 0.27, 0.01);
  vestFront.castShadow = true;
  upperBody.add(vestFront);

  [-0.135, 0.135].forEach((xPos) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.06, 0.25), vestMat);
    strap.position.set(xPos, 0.47, 0);
    upperBody.add(strap);
  });

  const badgeShield = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.052, 0.012), silverMat);
  badgeShield.position.set(-0.105, 0.37, 0.154);
  upperBody.add(badgeShield);

  const radioMic = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.048, 0.024), gearMat);
  radioMic.position.set(-0.14, 0.46, 0.125);
  upperBody.add(radioMic);

  const crimsonTag = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.022, 0.012), accentMat);
  crimsonTag.position.set(0.105, 0.37, 0.154);
  upperBody.add(crimsonTag);

  const neck = makeLimb(0.072, 0.086, 0.11, skinMat);
  neck.position.y = 0.53;
  upperBody.add(neck);

  // Head & Textured Dark Curls
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.67, 0.01);
  upperBody.add(headGroup);

  const cranium = new THREE.Mesh(new THREE.BoxGeometry(0.172, 0.225, 0.195), skinMat);
  cranium.castShadow = true;
  headGroup.add(cranium);

  const curlCrown = new THREE.Mesh(new THREE.BoxGeometry(0.196, 0.085, 0.218), hairMat);
  curlCrown.position.set(0, 0.115, 0.005);
  curlCrown.castShadow = true;
  headGroup.add(curlCrown);

  const curlOffsets: [number, number, number][] = [
    [-0.06, 0.145, 0.06],
    [0, 0.155, 0.05],
    [0.06, 0.145, 0.06],
    [-0.05, 0.125, 0.095],
    [0.01, 0.12, 0.1],
    [0.055, 0.125, 0.092],
    [-0.075, 0.135, -0.02],
    [0.075, 0.135, -0.02],
    [0, 0.145, -0.06],
  ];
  const curlGeo = new THREE.SphereGeometry(0.036, 10, 10);
  curlOffsets.forEach(([cx, cy, cz]) => {
    const curlCluster = new THREE.Mesh(curlGeo, hairMat);
    curlCluster.position.set(cx, cy, cz);
    headGroup.add(curlCluster);
  });

  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.176, 0.13, 0.035), hairMat);
  hairBack.position.set(0, 0.04, -0.092);
  headGroup.add(hairBack);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0e0e0e });
  [-0.04, 0.04].forEach((xPos) => {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.014, 0.018), hairMat);
    brow.position.set(xPos, 0.034, 0.098);
    brow.rotation.z = xPos < 0 ? -0.1 : 0.1;
    headGroup.add(brow);

    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.013, 0.01), eyeMat);
    eye.position.set(xPos, 0.015, 0.098);
    headGroup.add(eye);
  });

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.05, 0.036), skinMat);
  nose.position.set(0, -0.005, 0.108);
  headGroup.add(nose);

  const lightMustache = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.014, 0.02), hairMat);
  lightMustache.position.set(0, -0.044, 0.1);
  headGroup.add(lightMustache);

  const chinTrim = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.022, 0.024), hairMat);
  chinTrim.position.set(0, -0.098, 0.094);
  headGroup.add(chinTrim);

  function buildArm(side: number) {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.275, 0.44, 0);

    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 16), uniformMat);
    shoulder.castShadow = true;
    armGroup.add(shoulder);

    const upperSleeve = makeLimb(0.068, 0.062, 0.21, uniformMat);
    upperSleeve.position.set(side * 0.02, -0.11, 0);
    upperSleeve.rotation.z = side * 0.09;
    armGroup.add(upperSleeve);

    const cuff = makeLimb(0.065, 0.064, 0.035, uniformMat);
    cuff.position.set(side * 0.03, -0.21, 0);
    cuff.rotation.z = side * 0.09;
    armGroup.add(cuff);

    const forearm = makeLimb(0.056, 0.044, 0.27, skinMat);
    forearm.position.set(side * 0.038, -0.36, 0.028);
    forearm.rotation.x = -0.18;
    armGroup.add(forearm);

    if (side === -1) {
      const watch = makeLimb(0.048, 0.048, 0.022, gearMat);
      watch.position.set(side * 0.038, -0.47, 0.048);
      watch.rotation.x = -0.18;
      armGroup.add(watch);
    }

    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.092, 0.084), gearMat);
    glove.position.set(side * 0.038, -0.52, 0.058);
    glove.castShadow = true;
    armGroup.add(glove);
    return armGroup;
  }

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);
  upperBody.add(leftArm, rightArm);

  function buildLeg(side: number) {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.115, 0.87, 0);

    const thigh = makeLimb(0.105, 0.092, 0.41, pantsMat);
    thigh.position.set(side * 0.015, -0.2, 0);
    thigh.rotation.z = side * 0.035;
    legGroup.add(thigh);

    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.13, 0.11), pantsMat);
    pocket.position.set(side * 0.115, -0.2, 0);
    legGroup.add(pocket);

    const shin = makeLimb(0.088, 0.074, 0.34, pantsMat);
    shin.position.set(side * 0.022, -0.54, 0);
    legGroup.add(shin);

    const bootShaft = makeLimb(0.068, 0.066, 0.13, gearMat);
    bootShaft.position.set(side * 0.022, -0.75, 0);
    legGroup.add(bootShaft);

    const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.128, 0.074, 0.25), gearMat);
    bootSole.position.set(side * 0.022, -0.825, 0.042);
    bootSole.castShadow = true;
    legGroup.add(bootSole);
    return legGroup;
  }

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);
  shamus.add(leftLeg, rightLeg);

  // Ground flush at y = 0 (0.87 - 0.825 - 0.037 = +0.008)
  shamus.position.y = -0.008;

  return {
    group: shamus,
    textures: [],
    animate: (t: number, walkPhase = 0, isMoving = false) => {
      if (isMoving) {
        const swing = Math.sin(walkPhase) * 0.52;
        leftLeg.rotation.x = swing;
        rightLeg.rotation.x = -swing;
        leftArm.rotation.x = -swing * 0.72;
        rightArm.rotation.x = swing * 0.72;
        upperBody.position.y = 1.04 + Math.abs(Math.cos(walkPhase)) * 0.02;
        upperBody.rotation.y = 0;
        headGroup.rotation.y = 0;
      } else {
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
        upperBody.position.y = 1.04 + Math.sin(t * 2.2) * 0.009;
        upperBody.rotation.y = Math.sin(t * 0.95) * 0.04;
        headGroup.rotation.y = Math.sin(t * 0.85) * 0.12;
        leftArm.rotation.x = Math.sin(t * 2.2) * 0.025;
        rightArm.rotation.x = -Math.sin(t * 2.2) * 0.025;
      }
    },
  };
}

export function buildRoman3D(): BuiltCharacterRig {
  const roman = new THREE.Group();

  // Exact palette matching Roman's Street Bruiser spec
  const skinMat = new THREE.MeshStandardMaterial({ color: 0x935d37, roughness: 0.52 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x141211, roughness: 0.92 });
  const teeMat = new THREE.MeshStandardMaterial({ color: 0x16171a, roughness: 0.8 });
  const jacketMat = new THREE.MeshStandardMaterial({ color: 0x382216, roughness: 0.58 });
  const zipperMat = new THREE.MeshStandardMaterial({ color: 0xd6d3cd, metalness: 0.65, roughness: 0.35 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.82 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.45 });
  const silverMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.2 });

  // Pelvis & Belt with Silver Buckle
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.17, 0.23), pantsMat);
  pelvis.position.y = 0.93;
  pelvis.castShadow = true;
  roman.add(pelvis);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.395, 0.05, 0.24), bootMat);
  belt.position.y = 1.015;
  roman.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.052, 0.015), silverMat);
  buckle.position.set(0, 1.015, 0.125);
  roman.add(buckle);

  // Upper Body: Fitted Black Tee + Open Boxy Dark-Brown Leather Zip Jacket
  const upperBody = new THREE.Group();
  upperBody.position.y = 1.03;
  roman.add(upperBody);

  const abs = makeLimb(0.172, 0.152, 0.24, teeMat);
  abs.scale.set(1.08, 1, 0.72);
  abs.position.y = 0.12;
  upperBody.add(abs);

  const chest = makeLimb(0.222, 0.172, 0.28, teeMat);
  chest.scale.set(1.14, 1, 0.75);
  chest.position.y = 0.35;
  upperBody.add(chest);

  // Crewneck tee collar & exposed neck skin + silver chain
  const teeCollar = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.016, 10, 20), teeMat);
  teeCollar.rotation.x = Math.PI / 2 - 0.12;
  teeCollar.position.set(0, 0.485, 0.02);
  upperBody.add(teeCollar);

  const silverChain = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.0055, 8, 22, Math.PI), silverMat);
  silverChain.position.set(0, 0.45, 0.145);
  silverChain.rotation.z = Math.PI;
  upperBody.add(silverChain);

  // Open Boxy Leather Jacket Panels & Zipper Trim
  [-0.145, 0.145].forEach((xPos) => {
    const jacketFront = new THREE.Mesh(new THREE.BoxGeometry(0.128, 0.56, 0.275), jacketMat);
    jacketFront.position.set(xPos, 0.25, 0.01);
    jacketFront.castShadow = true;
    upperBody.add(jacketFront);

    const zipTrack = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.55, 0.02), zipperMat);
    zipTrack.position.set(xPos + (xPos < 0 ? 0.06 : -0.06), 0.25, 0.148);
    upperBody.add(zipTrack);

    const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.16, 0.025), jacketMat);
    lapel.position.set(xPos + (xPos < 0 ? 0.03 : -0.03), 0.45, 0.15);
    lapel.rotation.z = xPos < 0 ? -0.14 : 0.14;
    upperBody.add(lapel);
  });

  const jacketBack = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.56, 0.095), jacketMat);
  jacketBack.position.set(0, 0.25, -0.11);
  jacketBack.castShadow = true;
  upperBody.add(jacketBack);

  const jacketHem = new THREE.Mesh(new THREE.BoxGeometry(0.415, 0.055, 0.28), jacketMat);
  jacketHem.position.set(0, -0.015, -0.005);
  upperBody.add(jacketHem);

  const neck = makeLimb(0.07, 0.085, 0.11, skinMat);
  neck.position.y = 0.54;
  upperBody.add(neck);

  // Head: Dark Curls, Mustache & Beard
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.675, 0.01);
  upperBody.add(headGroup);

  const cranium = new THREE.Mesh(new THREE.BoxGeometry(0.172, 0.225, 0.195), skinMat);
  cranium.castShadow = true;
  headGroup.add(cranium);

  const curlCrown = new THREE.Mesh(new THREE.BoxGeometry(0.194, 0.082, 0.215), hairMat);
  curlCrown.position.set(0, 0.112, 0.004);
  curlCrown.castShadow = true;
  headGroup.add(curlCrown);

  const curlOffsets: [number, number, number][] = [
    [-0.062, 0.142, 0.058],
    [0.0, 0.152, 0.05],
    [0.062, 0.142, 0.058],
    [-0.048, 0.124, 0.092],
    [0.012, 0.12, 0.098],
    [0.056, 0.124, 0.09],
    [-0.074, 0.132, -0.022],
    [0.074, 0.132, -0.022],
    [0.0, 0.142, -0.058],
  ];
  const curlGeo = new THREE.SphereGeometry(0.034, 10, 10);
  curlOffsets.forEach(([cx, cy, cz]) => {
    const curl = new THREE.Mesh(curlGeo, hairMat);
    curl.position.set(cx, cy, cz);
    headGroup.add(curl);
  });

  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.176, 0.13, 0.038), hairMat);
  hairBack.position.set(0, 0.04, -0.092);
  headGroup.add(hairBack);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0e0e0e });
  [-0.04, 0.04].forEach((xPos) => {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.014, 0.018), hairMat);
    brow.position.set(xPos, 0.034, 0.098);
    brow.rotation.z = xPos < 0 ? -0.1 : 0.1;
    headGroup.add(brow);

    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.013, 0.01), eyeMat);
    eye.position.set(xPos, 0.015, 0.098);
    headGroup.add(eye);
  });

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.05, 0.036), skinMat);
  nose.position.set(0, -0.005, 0.108);
  headGroup.add(nose);

  const mustache = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.02, 0.022), hairMat);
  mustache.position.set(0, -0.044, 0.101);
  headGroup.add(mustache);

  const fullBeard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.072, 0.185), hairMat);
  fullBeard.position.set(0, -0.078, 0.012);
  headGroup.add(fullBeard);

  // Arms: Boxy Leather Sleeves, Ribbed Cuffs, Silver Watch & Hands
  function buildArm(side: number) {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.272, 0.44, 0);

    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.078, 16, 16), jacketMat);
    shoulder.castShadow = true;
    armGroup.add(shoulder);

    const upperSleeve = makeLimb(0.074, 0.068, 0.25, jacketMat);
    upperSleeve.position.set(side * 0.02, -0.13, 0);
    upperSleeve.rotation.z = side * 0.09;
    armGroup.add(upperSleeve);

    const lowerSleeve = makeLimb(0.068, 0.056, 0.22, jacketMat);
    lowerSleeve.position.set(side * 0.035, -0.34, 0.024);
    lowerSleeve.rotation.x = -0.18;
    armGroup.add(lowerSleeve);

    const cuff = makeLimb(0.058, 0.052, 0.04, pantsMat);
    cuff.position.set(side * 0.035, -0.45, 0.044);
    cuff.rotation.x = -0.18;
    armGroup.add(cuff);

    if (side === -1) {
      const watch = makeLimb(0.048, 0.048, 0.02, silverMat);
      watch.position.set(side * 0.035, -0.48, 0.049);
      watch.rotation.x = -0.18;
      armGroup.add(watch);
    }

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.092, 0.082), skinMat);
    hand.position.set(side * 0.035, -0.53, 0.058);
    hand.castShadow = true;
    armGroup.add(hand);

    if (side === 1) {
      const ring = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.016), silverMat);
      ring.position.set(side * 0.035, -0.54, 0.1);
      armGroup.add(ring);
    }
    return armGroup;
  }

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);
  upperBody.add(leftArm, rightArm);

  // Dark Street Trousers & Dark Boots
  function buildLeg(side: number) {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.112, 0.86, 0);

    const thigh = makeLimb(0.102, 0.088, 0.4, pantsMat);
    thigh.position.set(side * 0.015, -0.2, 0);
    thigh.rotation.z = side * 0.032;
    legGroup.add(thigh);

    const shin = makeLimb(0.086, 0.072, 0.34, pantsMat);
    shin.position.set(side * 0.02, -0.54, 0);
    legGroup.add(shin);

    const bootShaft = makeLimb(0.068, 0.066, 0.13, bootMat);
    bootShaft.position.set(side * 0.02, -0.74, 0);
    legGroup.add(bootShaft);

    const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.126, 0.074, 0.245), bootMat);
    bootSole.position.set(side * 0.02, -0.815, 0.04);
    bootSole.castShadow = true;
    legGroup.add(bootSole);
    return legGroup;
  }

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);
  roman.add(leftLeg, rightLeg);

  const carryBag = attachCarryBag(upperBody, 0.24, -0.22);

  // Ground flush at y = 0 (0.86 - 0.815 - 0.037 = +0.008)
  roman.position.y = -0.008;

  return {
    group: roman,
    textures: [],
    animate: (t: number, walkPhase = 0, isMoving = false, carryingBag = false) => {
      carryBag.visible = carryingBag;
      if (isMoving) {
        const swing = Math.sin(walkPhase) * 0.56;
        leftLeg.rotation.x = swing;
        rightLeg.rotation.x = -swing;
        leftArm.rotation.x = -swing * 0.76;
        rightArm.rotation.x = swing * 0.76;
        upperBody.position.y = 1.03 + Math.abs(Math.cos(walkPhase)) * 0.02;
        upperBody.rotation.y = 0;
        headGroup.rotation.y = 0;
      } else {
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
        upperBody.position.y = 1.03 + Math.sin(t * 2.1) * 0.009;
        upperBody.rotation.y = Math.sin(t * 0.85) * 0.035;
        headGroup.rotation.y = Math.sin(t * 0.75) * 0.1;
        leftArm.rotation.x = Math.sin(t * 2.1) * 0.022;
        rightArm.rotation.x = -Math.sin(t * 2.1) * 0.022;
      }
    },
  };
}

export function buildNPCVariant3D(kind: 'guard' | 'swat' | 'cartel'): BuiltCharacterRig {
  const npc = new THREE.Group();

  const jacketHex =
    kind === 'cartel' ? 0x581c87 : kind === 'swat' ? 0x1e3a8a : 0xb45309;
  const pantHex = kind === 'cartel' ? 0x18181b : 0x111827;
  const hatHex = kind === 'cartel' ? 0x18181b : kind === 'swat' ? 0x0f172a : 0x1e293b;

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc58c64, roughness: 0.55 });
  const jacketMat = new THREE.MeshStandardMaterial({ color: jacketHex, roughness: 0.7 });
  const pantMat = new THREE.MeshStandardMaterial({ color: pantHex, roughness: 0.8 });
  const hatMat = new THREE.MeshStandardMaterial({ color: hatHex, roughness: 0.55 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x0f1014, roughness: 0.5 });

  const upperBody = new THREE.Group();
  upperBody.position.y = 0.98;
  npc.add(upperBody);

  const torso = makeLimb(0.2, 0.16, 0.46, jacketMat);
  torso.scale.set(1.1, 1, 0.74);
  torso.position.y = 0.23;
  upperBody.add(torso);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.62, 0.01);
  upperBody.add(headGroup);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.2, 0.185), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.2), hatMat);
  cap.position.set(0, 0.095, 0.005);
  headGroup.add(cap);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0e0e0e });
  [-0.04, 0.04].forEach((xPos) => {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.014, 0.012), eyeMat);
    eye.position.set(xPos, 0.015, 0.096);
    headGroup.add(eye);
  });

  function buildArm(side: number) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.24, 0.42, 0);
    const mesh = makeLimb(0.055, 0.042, 0.46, jacketMat);
    mesh.position.y = -0.23;
    arm.add(mesh);
    return arm;
  }
  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);
  upperBody.add(leftArm, rightArm);

  function buildLeg(side: number) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.098, 0.84, 0);
    const lMesh = makeLimb(0.085, 0.06, 0.72, pantMat);
    lMesh.position.y = -0.36;
    leg.add(lMesh);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.21), bootMat);
    boot.position.set(0, -0.78, 0.035);
    boot.castShadow = true;
    leg.add(boot);
    return leg;
  }
  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);
  npc.add(leftLeg, rightLeg);

  return {
    group: npc,
    textures: [],
    animate: (t: number, walkPhase = 0, isMoving = false) => {
      if (isMoving) {
        const swing = Math.sin(walkPhase) * 0.48;
        leftLeg.rotation.x = swing;
        rightLeg.rotation.x = -swing;
        leftArm.rotation.x = -swing * 0.65;
        rightArm.rotation.x = swing * 0.65;
        upperBody.position.y = 0.98 + Math.abs(Math.cos(walkPhase)) * 0.016;
      } else {
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
        leftArm.rotation.x = Math.sin(t * 2) * 0.02;
        rightArm.rotation.x = -Math.sin(t * 2) * 0.02;
        upperBody.position.y = 0.98 + Math.sin(t * 2) * 0.007;
      }
    },
  };
}

export function buildCharacter3D(
  id: CharacterId3D,
  maxAnisotropy: number
): BuiltCharacterRig {
  switch (id) {
    case 'roman':
      return buildRoman3D();
    case 'john':
      return buildJohn3D(maxAnisotropy);
    case 'brock':
      return buildBrock3D();
    case 'randy':
      return buildRandy3D();
    case 'shasha':
      return buildShasha3D();
    case 'pablo':
      return buildPablo3D();
    case 'shamus':
      return buildShamus3D();
  }
}

export function buildGameplayCharacter3D(
  kind: GameplayCharacterKind,
  maxAnisotropy: number
): BuiltCharacterRig {
  switch (kind) {
    case 'guard':
    case 'swat':
    case 'cartel':
      return buildNPCVariant3D(kind);
    default:
      return buildCharacter3D(kind, maxAnisotropy);
  }
}

export function disposeCharacterRig(rig: BuiltCharacterRig): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  rig.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      geometries.add(obj.geometry);
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => materials.add(m));
      } else if (obj.material) {
        materials.add(obj.material);
      }
    }
  });

  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  rig.textures.forEach((t) => t.dispose());
}
