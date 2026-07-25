import * as THREE from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/loaders/GLTFLoader.js";

const canvas = document.querySelector("#scene");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#startButton");
const lettersEl = document.querySelector("#letters");
const distanceEl = document.querySelector("#distance");
const bestEl = document.querySelector("#best");
const scoreEl = document.querySelector("#score");
const deliveredEl = document.querySelector("#delivered");
const comboEl = document.querySelector("#combo");
const comboHud = document.querySelector("#comboHud");
const comboMeter = document.querySelector("#comboMeter");
const objectiveLabel = document.querySelector("#objectiveLabel");
const objectiveDistance = document.querySelector("#objectiveDistance");
const menuButton = document.querySelector("#menuButton");
const soundButton = document.querySelector("#soundButton");
const colorButton = document.querySelector("#colorButton");
const viewButton = document.querySelector("#viewButton");
const moveStick = document.querySelector("#moveStick");
const moveKnob = document.querySelector("#moveKnob");
const jumpButton = document.querySelector("#jumpButton");
const carButton = document.querySelector("#carButton");
const gateButton = document.querySelector("#gateButton");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x71d4c7, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x71d4c7);
scene.fog = new THREE.Fog(0x71d4c7, 54, 132);

const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 220);

const materials = {
  ground: toon(0x8fb8a4),
  road: toon(0x78968c),
  lane: toon(0xf1f0df),
  wallA: toon(0xc9c9ae),
  wallB: toon(0x9fb8a7),
  wallC: toon(0xb4a88c),
  trim: toon(0x344a4b),
  dark: toon(0x182326),
  glass: toon(0x203338),
  shirt: toon(0x182326),
  skirt: toon(0x3d7773),
  skin: toon(0xe4b6b0),
  bag: toon(0xf2ead6),
  hair: toon(0x363142),
  sun: toon(0xe5aa3f),
  coral: toon(0xd95b59),
  mint: toon(0x71d4c7),
  plant: toon(0x4ba866),
  carPaint: new THREE.MeshToonMaterial({ color: 0x2f86d9, map: createCarLiveryTexture() }),
};

const state = {
  started: false,
  paused: false,
  letters: 0,
  walked: 0,
  best: Number(localStorage.getItem("alley-messenger-best") || 0),
  score: 0,
  delivered: 0,
  activeDeliveryIndex: 0,
  objectiveKind: "letter",
  objectiveDistance: 0,
  combo: 1,
  comboTimer: 0,
  comboDuration: 4,
  lastGateScore: 0,
  cameraMode: 0,
  soundOn: true,
  outfit: 0,
  verticalVelocity: 0,
  grounded: true,
  inCar: false,
  carSpeed: 0,
  keys: new Set(),
  pointerActive: false,
  lastPointerX: 0,
  stickPointerId: null,
  touchMoveX: 0,
  touchMoveY: 0,
  cameraYaw: 0,
  lastTime: 0,
};

const mapBounds = 38;
const moveVelocity = new THREE.Vector3();
const desiredVelocity = new THREE.Vector3();
const cameraForward = new THREE.Vector3();
const cameraRight = new THREE.Vector3();
const objectiveVector = new THREE.Vector3();
const cameraOffset = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const colliders = [];
const safetyGates = [];
const deliveryPoints = [];
const scorePopups = [];
const playerRadius = 0.55;
const buildingSizeMultiplier = 2;
const buildingColliderMultiplier = 0.85;
const carSpawn = {
  x: 2.4,
  z: 0,
  yaw: Math.PI / 2,
};

bestEl.textContent = `${state.best}m`;

const map = new THREE.Group();
const roadMarks = new THREE.Group();
const collectibles = new THREE.Group();
const props = new THREE.Group();
scene.add(map, roadMarks, collectibles, props);

const player = createRunner();
scene.add(player.root);
const car = createCar();
scene.add(car.root);
loadKenneyCar();
const objectiveArrow = createObjectiveArrow();
scene.add(objectiveArrow);

const sun = new THREE.DirectionalLight(0xfff2d0, 3.2);
sun.position.set(-10, 18, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -42;
sun.shadow.camera.right = 42;
sun.shadow.camera.top = 42;
sun.shadow.camera.bottom = -42;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x9fe5d8, 0x545b4c, 2.4));

buildMap();
spawnLetters();
updateCamera(1);
renderer.render(scene, camera);
requestAnimationFrame(tick);

function toon(color) {
  return new THREE.MeshToonMaterial({ color });
}

function edge(mesh, color = 0x172226, opacity = 0.8) {
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, 24),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
  mesh.add(outline);
  return mesh;
}

function box(name, size, position, material, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
  mesh.name = name;
  mesh.position.copy(position);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return edge(mesh);
}

function createObjectiveArrow() {
  const group = new THREE.Group();
  group.name = "objective-arrow";
  const ringMaterial = new THREE.MeshToonMaterial({ color: 0xe5aa3f });
  const centerMaterial = new THREE.MeshToonMaterial({ color: 0x172226 });
  const pointerMaterial = new THREE.MeshToonMaterial({ color: 0xf3f0df });

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 8, 32), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = true;

  const center = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 24), centerMaterial);
  center.position.y = 0.02;
  center.castShadow = true;

  const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.82, 3), pointerMaterial);
  pointer.rotation.x = -Math.PI / 2;
  pointer.position.set(0, 0.08, -0.72);
  pointer.castShadow = true;

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.42), ringMaterial);
  tail.position.set(0, 0.06, 0.42);
  tail.castShadow = true;

  group.add(edge(ring), edge(center, 0xf3f0df, 0.55), edge(pointer), edge(tail));
  group.scale.setScalar(0.78);
  group.visible = false;
  return group;
}

function createCarLiveryTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  context.fillStyle = "#2f86d9";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#f7f7ef";
  context.fillRect(214, 0, 84, 512);
  context.fillStyle = "#f0c746";
  context.fillRect(242, 0, 28, 512);
  context.fillStyle = "rgba(16, 33, 45, 0.18)";
  context.fillRect(0, 0, 512, 52);
  context.fillRect(0, 460, 512, 52);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  return texture;
}

function buildMap() {
  const ground = box(
    "map-ground",
    new THREE.Vector3(92, 0.16, 92),
    new THREE.Vector3(0, -0.1, 0),
    materials.ground,
    false
  );
  map.add(ground);

  const roads = [-24, 0, 24];
  for (const x of roads) {
    map.add(box("north-south-road", new THREE.Vector3(7.8, 0.08, 90), new THREE.Vector3(x, 0.02, 0), materials.road, false));
    map.add(box("left-curb", new THREE.Vector3(0.24, 0.22, 90), new THREE.Vector3(x - 4.05, 0.14, 0), materials.lane, false));
    map.add(box("right-curb", new THREE.Vector3(0.24, 0.22, 90), new THREE.Vector3(x + 4.05, 0.14, 0), materials.lane, false));
  }

  for (const z of roads) {
    map.add(box("east-west-road", new THREE.Vector3(90, 0.09, 7.8), new THREE.Vector3(0, 0.04, z), materials.road, false));
    map.add(box("top-curb", new THREE.Vector3(90, 0.22, 0.24), new THREE.Vector3(0, 0.15, z - 4.05), materials.lane, false));
    map.add(box("bottom-curb", new THREE.Vector3(90, 0.22, 0.24), new THREE.Vector3(0, 0.15, z + 4.05), materials.lane, false));
  }

  for (const x of roads) {
    for (let z = -39; z <= 39; z += 8) {
      const mark = box("road-mark", new THREE.Vector3(0.18, 0.025, 2.6), new THREE.Vector3(x, 0.16, z), materials.lane, false);
      roadMarks.add(mark);
    }
  }

  for (const z of roads) {
    for (let x = -39; x <= 39; x += 8) {
      const mark = box("road-mark", new THREE.Vector3(2.6, 0.025, 0.18), new THREE.Vector3(x, 0.17, z), materials.lane, false);
      roadMarks.add(mark);
    }
  }

  let seed = 0;
  for (let x = -36; x <= 36; x += 12) {
    for (let z = -36; z <= 36; z += 12) {
      if (isRoadBand(x, z)) continue;
      createBuilding(x, z, seed);
      seed += 1;
    }
  }

  createTree(-10, -12);
  createTree(13, 14);
  createTree(-35, 9);
  createTree(34, -16);
  createSafetyGate(0, -18);
  placeKenneySceneAssets();
  createDeliveryPoints();

  for (let i = 0; i < 22; i += 1) {
    createCone(((i * 13) % 72) - 36, ((i * 19) % 72) - 36, i);
  }
}

function isRoadBand(x, z) {
  return Math.abs(x) < 7 || Math.abs(z) < 7 || Math.abs(Math.abs(x) - 24) < 7 || Math.abs(Math.abs(z) - 24) < 7;
}

function createBuilding(x, z, seed) {
  const assets = [
    "building-a.glb",
    "building-b.glb",
    "building-c.glb",
    "building-d.glb",
    "building-e.glb",
    "building-f.glb",
    "building-g.glb",
    "building-h.glb",
    "building-i.glb",
    "building-j.glb",
    "building-k.glb",
    "building-l.glb",
    "building-m.glb",
    "building-n.glb",
    "building-skyscraper-a.glb",
    "building-skyscraper-b.glb",
    "building-skyscraper-c.glb",
    "building-skyscraper-d.glb",
    "building-skyscraper-e.glb",
    "low-detail-building-a.glb",
    "low-detail-building-b.glb",
    "low-detail-building-c.glb",
    "low-detail-building-d.glb",
    "low-detail-building-e.glb",
    "low-detail-building-f.glb",
    "low-detail-building-g.glb",
    "low-detail-building-h.glb",
    "low-detail-building-i.glb",
    "low-detail-building-j.glb",
    "low-detail-building-k.glb",
    "low-detail-building-l.glb",
    "low-detail-building-m.glb",
    "low-detail-building-n.glb",
    "low-detail-building-wide-a.glb",
    "low-detail-building-wide-b.glb",
  ];
  const asset = assets[seed % assets.length];
  const baseScale = asset.startsWith("low-detail") ? 4.2 + (seed % 3) * 0.22 : 2.65 + (seed % 4) * 0.16;
  const scale = baseScale * buildingSizeMultiplier;
  const rotation = ((seed % 4) * Math.PI) / 2 + (seed % 2 ? 0.08 : -0.06);
  const isWide = asset.includes("wide");
  const isSkyscraper = asset.includes("skyscraper");
  const halfX = (isWide ? 5.8 : 4.6) * buildingColliderMultiplier;
  const halfZ = (isWide ? 3.9 : 4.6) * buildingColliderMultiplier;
  const height = (isSkyscraper ? 24 : asset.startsWith("low-detail") ? 10.5 : 16.5) * buildingColliderMultiplier;
  loadCityAsset(asset, new THREE.Vector3(x, 0, z), scale, rotation, {
    collider: [halfX, halfZ, height],
  });
}

function placeKenneySceneAssets() {
  loadCityAsset("detail-awning-wide.glb", new THREE.Vector3(10, 2.3, -28), 2.2, Math.PI);
  loadCityAsset("detail-awning.glb", new THREE.Vector3(-29, 2.1, 10), 2.0, Math.PI / 2);
  loadCityAsset("detail-overhang-wide.glb", new THREE.Vector3(27, 2.15, -10), 1.8, -Math.PI / 2);
  loadCityAsset("detail-parasol-a.glb", new THREE.Vector3(31, 0, 11), 1.8, 0.4);
  loadCityAsset("detail-parasol-b.glb", new THREE.Vector3(-30, 0, -12), 1.6, -0.3, { collider: [0.8, 0.8, 2.2] });

  loadCarAsset("taxi.glb", new THREE.Vector3(-24, 0, 14), 1.25, Math.PI * 0.5, { collider: [1.2, 2.0, 1.4] });
  loadCarAsset("van.glb", new THREE.Vector3(24, 0, -12), 1.22, -Math.PI * 0.5, { collider: [1.25, 2.05, 1.5] });
  loadCarAsset("police.glb", new THREE.Vector3(12, 0, 24), 1.2, Math.PI, { collider: [1.15, 2.0, 1.4] });
  loadCarAsset("delivery.glb", new THREE.Vector3(-12, 0, -24), 1.2, 0, { collider: [1.2, 2.15, 1.6] });

  loadCarAsset("box.glb", new THREE.Vector3(-4.4, 0, 19), 1.6, 0.2, { collider: [0.65, 0.65, 1.3] });
  loadCarAsset("box.glb", new THREE.Vector3(4.6, 0, -19), 1.45, -0.3, { collider: [0.6, 0.6, 1.2] });
  loadCarAsset("debris-tire.glb", new THREE.Vector3(18, 0, 3), 1.35, 0.8, { collider: [0.6, 0.6, 0.8] });
  loadCarAsset("debris-bumper.glb", new THREE.Vector3(-18, 0, -3), 1.35, 1.1, { collider: [0.7, 0.35, 0.6] });
  loadCarAsset("debris-door.glb", new THREE.Vector3(3, 0, 28), 1.25, -0.5, { collider: [0.55, 0.7, 0.45] });
}

function createTree(x, z) {
  const trunk = box("tree-trunk", new THREE.Vector3(0.42, 2.4, 0.42), new THREE.Vector3(x, 1.2, z), materials.trim);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.65, 1), materials.plant);
  crown.position.set(x, 3.1, z);
  crown.castShadow = true;
  crown.receiveShadow = true;
  props.add(trunk, edge(crown));
  addCollider(x, z, 0.45, 0.45, 2.6);
}

function createCone(x, z, seed) {
  if (!isRoadBand(x, z)) return;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.05, 5), materials.coral);
  cone.position.set(x, 0.54, z);
  cone.rotation.y = seed * 0.7;
  cone.castShadow = true;
  cone.receiveShadow = true;
  props.add(edge(cone));
  addCollider(x, z, 0.55, 0.55, 1.1);
}

function createDeliveryPoints() {
  const spots = [
    [0, -32],
    [-31, -24],
    [31, -24],
    [-31, 24],
    [31, 24],
    [0, 32],
  ];

  spots.forEach(([x, z], index) => {
    const point = createDeliveryPoint(x, z, index);
    deliveryPoints.push(point);
    props.add(point);
  });
  setActiveDeliveryPoint(0);
}

function createDeliveryPoint(x, z, index) {
  const group = new THREE.Group();
  group.name = "delivery-point";
  group.position.set(x, 0, z);
  group.userData.index = index;

  const ringMaterial = new THREE.MeshToonMaterial({ color: 0xe5aa3f, transparent: true, opacity: 0.35 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.12, 8, 36), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.12;
  ring.receiveShadow = true;
  group.add(ring);

  const base = box("delivery-box", new THREE.Vector3(1.0, 0.72, 0.7), new THREE.Vector3(0, 0.48, 0), materials.lane);
  const lid = box("delivery-lid", new THREE.Vector3(1.1, 0.16, 0.8), new THREE.Vector3(0, 0.92, 0), materials.sun);
  const flag = box("delivery-flag", new THREE.Vector3(0.12, 1.35, 0.12), new THREE.Vector3(0.62, 1.24, 0), materials.trim);
  const flagTop = box("delivery-flag-top", new THREE.Vector3(0.62, 0.36, 0.08), new THREE.Vector3(0.93, 1.72, 0), materials.coral);
  group.add(base, lid, flag, flagTop);

  const label = createBillboardLabel("DELIVER", 0x172226, 0xe5aa3f);
  label.position.set(0, 2.45, 0);
  label.scale.set(2.6, 0.98, 1);
  group.add(label);
  group.userData.ring = ring;
  group.userData.label = label;
  return group;
}

function createBillboardLabel(text, textColor, backgroundColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  context.fillStyle = `#${backgroundColor.toString(16).padStart(6, "0")}`;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#172226";
  context.lineWidth = 16;
  context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  context.fillStyle = `#${textColor.toString(16).padStart(6, "0")}`;
  context.font = "900 72px 'Segoe UI', 'Yu Gothic', 'Meiryo', sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 3);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
}

function setActiveDeliveryPoint(index) {
  if (!deliveryPoints.length) return;
  state.activeDeliveryIndex = index % deliveryPoints.length;
  for (const point of deliveryPoints) {
    const active = point.userData.index === state.activeDeliveryIndex;
    point.userData.active = active;
    point.userData.ring.material.opacity = active ? 0.95 : 0.22;
    point.userData.ring.material.color.setHex(active ? 0xe5aa3f : 0x78968c);
    point.userData.label.visible = active;
    point.scale.setScalar(active ? 1 : 0.82);
  }
}

function createSafetyGate(x, z, rotationY = 0) {
  const gate = new THREE.Group();
  gate.name = "safety-gate";
  gate.position.set(x, 0, z);
  gate.rotation.y = rotationY;
  gate.userData.colliders = [];
  gate.userData.destroyed = false;
  gate.userData.falling = false;
  gate.userData.fallProgress = 0;
  gate.userData.fallDirection = 1;
  gate.userData.basePosition = gate.position.clone();
  gate.userData.baseRotation = gate.rotation.clone();

  const green = toon(0x10a96a);
  const white = toon(0xf7f7ef);

  // 追加：門の高さ倍率
  // 1.0 = 現在の高さ
  // 0.8 = 8割の高さ
  // 0.7 = 7割の高さ
  const gateYScale = 0.55;
  const gy = (value) => value * gateYScale;

  const leftPost = box(
    "safety-gate-left",
    new THREE.Vector3(1.15, gy(9.4), 0.55),
    new THREE.Vector3(-3.3, gy(4.7), 0),
    green
  );

  const rightPost = box(
    "safety-gate-right",
    new THREE.Vector3(1.15, gy(9.4), 0.55),
    new THREE.Vector3(3.3, gy(4.7), 0),
    green
  );

  const top = box(
    "safety-gate-top",
    new THREE.Vector3(7.7, gy(1.1), 0.6),
    new THREE.Vector3(0, gy(9.28), 0),
    green
  );

  gate.add(leftPost, rightPost, top);

  const title = makeHorizontalTextPanel("安全な作業　確実な作業　熟練した作業", 5.9, gy(0.58), 0.16);
  title.position.set(0, gy(9.28), 0.38);
  gate.add(title);

  const leftText = makeVerticalTextPanel(["わたくしたちは", "この入口を通ります"], 1.0, gy(6.85), 0.16, 150);
  leftText.position.set(-3.3, gy(4.45), 0.38);
  gate.add(leftText);

  const rightText = makeVerticalTextPanel(["安全な作業は", "作業の入口である"], 1.0, gy(6.85), 0.16, 160);
  rightText.position.set(3.3, gy(4.45), 0.38);
  gate.add(rightText);

  const cross = makePlusSign(white, green);
  cross.position.set(-3.3, gy(8.25), 0.42);
  cross.scale.y = gateYScale;
  gate.add(cross);

  const cross2 = makePlusSign(white, green);
  cross2.position.set(3.3, gy(8.25), 0.42);
  cross2.scale.y = gateYScale;
  gate.add(cross2);

  map.add(gate);
  safetyGates.push(gate);

  // 当たり判定も見た目に合わせて低くする
  addRotatedGatePostCollider(gate, -3.3, 0.7, 0.45, gy(9.4));
  addRotatedGatePostCollider(gate, 3.3, 0.7, 0.45, gy(9.4));
  return gate;
}

function addRotatedGatePostCollider(gate, localX, halfX, halfZ, height) {
  const offset = new THREE.Vector3(localX, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), gate.rotation.y);
  const cos = Math.abs(Math.cos(gate.rotation.y));
  const sin = Math.abs(Math.sin(gate.rotation.y));
  const worldHalfX = halfX * cos + halfZ * sin;
  const worldHalfZ = halfX * sin + halfZ * cos;
  gate.userData.colliders.push(
    addCollider(gate.position.x + offset.x, gate.position.z + offset.z, worldHalfX, worldHalfZ, height, { gate, destructible: true })
  );
}

function makePlusSign(backgroundMaterial, crossMaterial) {
  const group = new THREE.Group();
  group.add(box("plus-bg", new THREE.Vector3(0.78, 0.78, 0.07), new THREE.Vector3(0, 0, -0.02), backgroundMaterial));
  group.add(box("plus-v", new THREE.Vector3(0.2, 0.58, 0.08), new THREE.Vector3(0, 0, 0.04), crossMaterial));
  group.add(box("plus-h", new THREE.Vector3(0.58, 0.2, 0.09), new THREE.Vector3(0, 0, 0.05), crossMaterial));
  return group;
}

function makeHorizontalTextPanel(text, width, height, depth) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  drawPanelBackground(context, canvas);
  context.fillStyle = "#118956";
  context.font = "900 88px 'Yu Gothic', 'Meiryo', sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  return makeTextMesh(canvas, width, height, depth);
}

function makeVerticalTextPanel(lines, width, height, depth, fontSize) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 4096;
  const context = canvas.getContext("2d");
  drawPanelBackground(context, canvas);
  context.fillStyle = "#118956";
  context.font = `900 ${fontSize}px 'Yu Gothic', 'Meiryo', sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  const columns = Array.isArray(lines) ? lines : [lines];
  const columnGap = 150;
  const totalWidth = (columns.length - 1) * columnGap;
  for (let i = 0; i < columns.length; i += 1) {
    const chars = [...columns[i]];
    const x = canvas.width / 2 + totalWidth / 2 - i * columnGap;
    const lineHeight = Math.min(235, (canvas.height - 360) / chars.length);
    let y = 210;
    for (const char of chars) {
      drawVerticalChar(context, char, x, y, lineHeight);
      y += lineHeight;
    }
  }
  return makeTextMesh(canvas, width, height, depth);
}

function drawVerticalChar(context, char, x, y, lineHeight) {
  if (char === "、" || char === "。") {
    context.fillText(char, x + 48, y - lineHeight * 0.18);
    return;
  }
  if (char === "ー") {
    context.save();
    context.translate(x, y);
    context.rotate(Math.PI / 2);
    context.fillText(char, 0, 0);
    context.restore();
    return;
  }
  context.fillText(char, x, y);
}

function drawPanelBackground(context, canvas) {
  context.fillStyle = "#f7f7ef";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#128955";
  context.lineWidth = Math.max(8, canvas.width * 0.018);
  context.strokeRect(context.lineWidth / 2, context.lineWidth / 2, canvas.width - context.lineWidth, canvas.height - context.lineWidth);
}

function makeTextMesh(canvas, width, height, depth) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return edge(new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshToonMaterial({ map: texture })));
}

function addCollider(x, z, halfX, halfZ, height, options = {}) {
  const collider = { x, z, halfX, halfZ, height, ...options };
  colliders.push(collider);
  return collider;
}

function spawnLetters() {
  const spots = [
    [-24, -33],
    [0, -28],
    [24, -31],
    [-34, 0],
    [34, 0],
    [-28, 24],
    [0, 31],
    [28, 24],
    [-16, -24],
    [16, 24],
  ];

  for (const [x, z] of spots) {
    const letter = createLetter();
    letter.position.set(x, 1.25, z);
    collectibles.add(letter);
  }
}

function createCar() {
  const root = new THREE.Group();
  root.position.set(carSpawn.x, 0, carSpawn.z);
  root.rotation.y = carSpawn.yaw;

  const model = new THREE.Group();
  root.add(model);

  const body = box("fallback-car-body", new THREE.Vector3(2.6, 0.72, 4.2), new THREE.Vector3(0, 0.72, 0), materials.carPaint);
  const cabin = box("fallback-car-cabin", new THREE.Vector3(1.65, 0.82, 1.65), new THREE.Vector3(0, 1.28, -0.32), materials.glass);
  model.add(body, cabin);

  for (const x of [-1.1, 1.1]) {
    for (const z of [-1.35, 1.35]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.26, 16), materials.dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.38, z);
      wheel.castShadow = true;
      model.add(edge(wheel));
    }
  }

  return { root, model };
}

function loadKenneyCar() {
  const loader = new GLTFLoader();
  loader.load(
    "assets/kenney/car/sedan.glb",
    (gltf) => {
      car.model.clear();
      const model = gltf.scene;
      model.scale.setScalar(1.45);
      model.rotation.y = 0;
      model.position.y = 0.05;
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material = child.material.clone();
            const name = `${child.name} ${child.material.name || ""}`.toLowerCase();
            const isDarkPart = name.includes("wheel") || name.includes("tire") || name.includes("glass") || name.includes("window");
            if (!isDarkPart) {
              child.material = new THREE.MeshToonMaterial({
                color: 0x2f86d9,
                map: createCarLiveryTexture(),
              });
            } else if (child.material.color) {
              child.material.color.lerp(new THREE.Color(0x182326), 0.35);
            }
          }
        }
      });
      car.model.add(model);
    },
    undefined,
    () => {
      // The fallback car stays active when local GLB loading is unavailable.
    }
  );
}

function loadCityAsset(fileName, position, scale, rotationY, options = {}) {
  loadKenneyAsset(`assets/kenney/city/${fileName}`, position, scale, rotationY, options);
}

function loadCarAsset(fileName, position, scale, rotationY, options = {}) {
  loadKenneyAsset(`assets/kenney/car/${fileName}`, position, scale, rotationY, options);
}

function loadKenneyAsset(url, position, scale, rotationY, options = {}) {
  const loader = new GLTFLoader();
  loader.load(
    url,
    (gltf) => {
      const model = gltf.scene;
      model.position.copy(position);
      model.scale.setScalar(scale);
      model.rotation.y = rotationY;
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      props.add(model);
      if (options.collider) {
        const [halfX, halfZ, height] = options.collider;
        addCollider(position.x, position.z, halfX, halfZ, height);
      }
    },
    undefined,
    () => {}
  );
}

function createLetter() {
  const group = new THREE.Group();
  const body = box("letter", new THREE.Vector3(0.78, 0.48, 0.12), new THREE.Vector3(0, 0, 0), materials.lane);
  const flap = box("flap", new THREE.Vector3(0.5, 0.05, 0.13), new THREE.Vector3(0, 0.1, 0.02), materials.sun);
  flap.rotation.z = 0.7;
  group.add(body, flap);
  group.userData.hit = false;
  return group;
}

function createRunner() {
  const root = new THREE.Group();
  root.position.set(0, 0, 0);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 0.86, 4, 12), materials.shirt);
  body.position.y = 1.82;
  body.castShadow = true;
  root.add(edge(body));

  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.48, 0.64, 6), materials.skirt);
  skirt.position.y = 1.16;
  skirt.castShadow = true;
  root.add(edge(skirt));

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 12), materials.skin);
  head.position.set(0, 2.64, 0.02);
  head.castShadow = true;
  root.add(edge(head));

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.47, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.68), materials.hair);
  hair.position.set(0, 2.72, -0.02);
  hair.castShadow = true;
  root.add(edge(hair));

  const bag = box("bag", new THREE.Vector3(0.62, 0.92, 0.26), new THREE.Vector3(0, 1.82, 0.5), materials.bag);
  root.add(bag);

  const limbs = {
    leftArm: limb(-0.56, 1.75, 0, materials.skin),
    rightArm: limb(0.56, 1.75, 0, materials.skin),
    leftLeg: limb(-0.24, 0.58, 0, materials.dark, 0.22),
    rightLeg: limb(0.24, 0.58, 0, materials.dark, 0.22),
  };
  Object.values(limbs).forEach((part) => root.add(part));

  return { root, body, skirt, head, hair, bag, limbs };
}

function limb(x, y, z, material, radius = 0.14) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, 0.72, 4, 8), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return edge(mesh);
}

function updatePlayer(dt, time) {
  desiredVelocity.set(0, 0, 0);

  const forwardInput = getMoveForwardInput();
  const sideInput = getMoveSideInput();
  desiredVelocity
    .addScaledVector(getCameraForward(cameraForward), forwardInput)
    .addScaledVector(getCameraRight(cameraRight), sideInput);

  if (desiredVelocity.lengthSq() > 0) {
    desiredVelocity.normalize().multiplyScalar(state.keys.has("ShiftLeft") || state.keys.has("ShiftRight") ? 25.2 : 16.8);
  }

  moveVelocity.lerp(desiredVelocity, Math.min(1, dt * 9));
  const stepX = moveVelocity.x * dt;
  const stepZ = moveVelocity.z * dt;
  moveWithCollisions(stepX, stepZ);
  state.verticalVelocity -= 22 * dt;
  player.root.position.y += state.verticalVelocity * dt;
  if (player.root.position.y <= 0) {
    player.root.position.y = 0;
    state.verticalVelocity = 0;
    state.grounded = true;
  }
  state.walked += Math.sqrt(stepX * stepX + stepZ * stepZ);

  if (moveVelocity.lengthSq() > 0.08) {
    const targetYaw = Math.atan2(moveVelocity.x, moveVelocity.z);
    player.root.rotation.y = lerpAngle(player.root.rotation.y, targetYaw, Math.min(1, dt * 10));
  }

  const stride = time * (moveVelocity.length() > 6 ? 12 : 9);
  const moving = moveVelocity.lengthSq() > 0.1;
  const swing = moving ? Math.sin(stride) : 0;
  if (state.grounded) {
    player.root.position.y = moving ? Math.max(0, Math.sin(stride * 2) * 0.035) : 0;
  }
  player.limbs.leftArm.rotation.x = swing * 0.62;
  player.limbs.rightArm.rotation.x = -swing * 0.62;
  player.limbs.leftLeg.rotation.x = -swing * 0.72;
  player.limbs.rightLeg.rotation.x = swing * 0.72;
}

function updateCar(dt) {
  const forwardInput = getMoveForwardInput();
  const turnInput = clamp(
    Number(state.keys.has("KeyA") || state.keys.has("ArrowLeft")) -
      Number(state.keys.has("KeyD") || state.keys.has("ArrowRight")) -
      state.touchMoveX,
    -1,
    1
  );
  const maxSpeed = 58;
  const acceleration = 92;
  const drag = 2.6;

  state.carSpeed += forwardInput * acceleration * dt;
  state.carSpeed = clamp(state.carSpeed, -maxSpeed * 0.5, maxSpeed);
  if (!forwardInput) {
    state.carSpeed = THREE.MathUtils.damp(state.carSpeed, 0, drag, dt);
  }

  if (Math.abs(state.carSpeed) > 0.2) {
    car.root.rotation.y += turnInput * dt * 1.85 * Math.sign(state.carSpeed || 1);
  }

  const direction = new THREE.Vector3(Math.sin(car.root.rotation.y), 0, Math.cos(car.root.rotation.y));
  const nextX = clamp(car.root.position.x + direction.x * state.carSpeed * dt, -mapBounds, mapBounds);
  const nextZ = clamp(car.root.position.z + direction.z * state.carSpeed * dt, -mapBounds, mapBounds);

  const hitX = findCollider(nextX, car.root.position.z, 0, 1.35);
  if (!hitX) {
    car.root.position.x = nextX;
  } else if (hitX.destructible && Math.abs(state.carSpeed) > 8) {
    destroySafetyGate(hitX.gate);
    car.root.position.x = nextX;
  } else {
    state.carSpeed *= -0.25;
  }

  const hitZ = findCollider(car.root.position.x, nextZ, 0, 1.35);
  if (!hitZ) {
    car.root.position.z = nextZ;
  } else if (hitZ.destructible && Math.abs(state.carSpeed) > 8) {
    destroySafetyGate(hitZ.gate);
    car.root.position.z = nextZ;
  } else {
    state.carSpeed *= -0.25;
  }

  state.walked += Math.abs(state.carSpeed) * dt;
}

function moveWithCollisions(stepX, stepZ) {
  const current = player.root.position;
  const nextX = clamp(current.x + stepX, -mapBounds, mapBounds);
  if (!hitsCollider(nextX, current.z, current.y)) {
    current.x = nextX;
  }

  const nextZ = clamp(current.z + stepZ, -mapBounds, mapBounds);
  if (!hitsCollider(current.x, nextZ, current.y)) {
    current.z = nextZ;
  }
}

function hitsCollider(x, z, y, radius = playerRadius) {
  return Boolean(findCollider(x, z, y, radius));
}

function findCollider(x, z, y, radius = playerRadius) {
  for (const collider of colliders) {
    if (collider.disabled) continue;
    if (y > collider.height + 0.25) continue;
    const insideX = Math.abs(x - collider.x) < collider.halfX + radius;
    const insideZ = Math.abs(z - collider.z) < collider.halfZ + radius;
    if (insideX && insideZ) return collider;
  }
  return null;
}

function destroySafetyGate(gate) {
  if (!gate || gate.userData.destroyed) return;
  const earned = 100 * state.combo;
  state.score += earned;
  state.lastGateScore = earned;
  state.combo += 1;
  state.comboTimer = state.comboDuration;
  createScorePopup(`+${earned}`, gate.position, state.combo - 1);

  gate.userData.destroyed = true;
  gate.userData.falling = true;
  gate.userData.fallProgress = 0;
  const gateFront = new THREE.Vector3(Math.sin(gate.rotation.y), 0, Math.cos(gate.rotation.y));
  const carOffset = car.root.position.clone().sub(gate.position);
  gate.userData.fallDirection = gateFront.dot(carOffset) > 0 ? -1 : 1;
  for (const collider of gate.userData.colliders || []) {
    collider.disabled = true;
  }
  gate.traverse((child) => {
    if (child.isMesh && child.material?.color) {
      child.material = child.material.clone();
      child.material.color.lerp(new THREE.Color(0x4b5d52), 0.5);
    }
  });
  state.carSpeed *= 0.68;
}

function updateFallingSafetyGates(dt) {
  for (const gate of safetyGates) {
    if (!gate.userData.falling) continue;
    gate.userData.fallProgress = Math.min(1, gate.userData.fallProgress + dt * 0.58);
    const eased = 1 - Math.pow(1 - gate.userData.fallProgress, 3);
    gate.rotation.x = gate.userData.baseRotation.x + gate.userData.fallDirection * eased * 1.42;
    gate.rotation.z = gate.userData.baseRotation.z + eased * 0.16;
    gate.position.y = gate.userData.basePosition.y - eased * 0.42;
    if (gate.userData.fallProgress >= 1) {
      gate.userData.falling = false;
    }
  }
}

function updateCombo(dt) {
  if (state.comboTimer <= 0) return;
  state.comboTimer = Math.max(0, state.comboTimer - dt);
  if (state.comboTimer === 0) {
    state.combo = 1;
  }
}

function createScorePopup(text, position, comboValue, subtitle = `COMBO x${comboValue}`, fillColor = null) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "900 92px 'Segoe UI', 'Yu Gothic', 'Meiryo', sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 14;
  context.strokeStyle = "#172226";
  context.fillStyle = fillColor || (comboValue >= 3 ? "#d95b59" : "#e5aa3f");
  context.strokeText(text, canvas.width / 2, 78);
  context.fillText(text, canvas.width / 2, 78);
  context.font = "800 42px 'Segoe UI', 'Yu Gothic', 'Meiryo', sans-serif";
  context.strokeText(subtitle, canvas.width / 2, 142);
  context.fillText(subtitle, canvas.width / 2, 142);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(position.x, 5.4, position.z);
  sprite.scale.set(4.2, 1.55, 1);
  sprite.userData.age = 0;
  sprite.userData.life = 1.15;
  sprite.userData.baseY = sprite.position.y;
  props.add(sprite);
  scorePopups.push(sprite);
}

function updateScorePopups(dt) {
  for (let i = scorePopups.length - 1; i >= 0; i -= 1) {
    const popup = scorePopups[i];
    popup.userData.age += dt;
    const progress = popup.userData.age / popup.userData.life;
    popup.position.y = popup.userData.baseY + progress * 1.45;
    popup.material.opacity = Math.max(0, 1 - progress);
    if (progress >= 1) {
      props.remove(popup);
      popup.material.map?.dispose();
      popup.material.dispose();
      scorePopups.splice(i, 1);
    }
  }
}

function clearScorePopups() {
  for (const popup of scorePopups) {
    props.remove(popup);
    popup.material.map?.dispose();
    popup.material.dispose();
  }
  scorePopups.length = 0;
}

function spawnSafetyGateAhead() {
  if (!state.started) return;
  const target = state.inCar ? car.root : player.root;
  const position = target.position.clone().addScaledVector(getCameraForward(cameraForward), 7);
  const gateX = clamp(position.x, -mapBounds + 5, mapBounds - 5);
  const gateZ = clamp(position.z, -mapBounds + 5, mapBounds - 5);
  const toTarget = new THREE.Vector3(target.position.x - gateX, 0, target.position.z - gateZ);
  const gateYaw = toTarget.lengthSq() > 0.01 ? Math.atan2(toTarget.x, toTarget.z) : target.rotation.y + Math.PI;
  createSafetyGate(gateX, gateZ, gateYaw);
}

function getCameraForward(target) {
  return target.set(-Math.sin(state.cameraYaw), 0, -Math.cos(state.cameraYaw));
}

function getCameraRight(target) {
  return target.set(Math.cos(state.cameraYaw), 0, -Math.sin(state.cameraYaw));
}

function getMoveForwardInput() {
  return clamp(
    Number(state.keys.has("KeyW") || state.keys.has("ArrowUp")) -
      Number(state.keys.has("KeyS") || state.keys.has("ArrowDown")) -
      state.touchMoveY,
    -1,
    1
  );
}

function getMoveSideInput() {
  return clamp(
    Number(state.keys.has("KeyD") || state.keys.has("ArrowRight")) -
      Number(state.keys.has("KeyA") || state.keys.has("ArrowLeft")) +
      state.touchMoveX,
    -1,
    1
  );
}

function resetSafetyGates() {
  for (const gate of safetyGates) {
    gate.visible = true;
    gate.userData.destroyed = false;
    gate.userData.falling = false;
    gate.userData.fallProgress = 0;
    gate.position.copy(gate.userData.basePosition);
    gate.rotation.copy(gate.userData.baseRotation);
    for (const collider of gate.userData.colliders || []) {
      collider.disabled = false;
    }
  }
}

function jump() {
  if (!state.started || state.paused || state.inCar || !state.grounded) return;
  state.verticalVelocity = 9.2;
  state.grounded = false;
}

function toggleCar() {
  if (!state.started || state.paused) return;

  if (state.inCar) {
    state.inCar = false;
    state.carSpeed = 0;
    player.root.visible = true;
    const exitOffset = new THREE.Vector3(1.9, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.root.rotation.y);
    player.root.position.copy(car.root.position).add(exitOffset);
    player.root.position.y = 0;
    moveVelocity.set(0, 0, 0);
    return;
  }

  if (distance2D(player.root.position, car.root.position) < 2.8) {
    state.inCar = true;
    state.carSpeed = 0;
    player.root.visible = false;
  }
}

function resolvePickups(time) {
  const playerPos = player.root.position;

  for (const letter of collectibles.children) {
    if (letter.userData.hit) continue;
    letter.rotation.y += 0.03;
    letter.position.y = 1.25 + Math.sin(time * 3 + letter.position.x) * 0.12;
    if (distance2D(playerPos, letter.position) < 1.05) {
      letter.userData.hit = true;
      letter.visible = false;
      state.letters += 1;
    }
  }
}

function resolveDeliveries(time) {
  updateDeliveryPoints(time);
  if (state.letters <= 0 || !deliveryPoints.length) return;

  const activePoint = deliveryPoints[state.activeDeliveryIndex];
  const targetRoot = state.inCar ? car.root : player.root;
  if (distance2D(targetRoot.position, activePoint.position) > 2.4) return;

  state.letters -= 1;
  state.delivered += 1;
  state.score += 500;
  createScorePopup("+500", activePoint.position, state.combo, "DELIVERED", "#4ba866");
  setActiveDeliveryPoint(state.activeDeliveryIndex + 1);
}

function updateDeliveryPoints(time) {
  for (const point of deliveryPoints) {
    const active = point.userData.active;
    const available = active && state.letters > 0;
    point.userData.ring.material.opacity = available ? 0.95 : active ? 0.3 : 0.18;
    point.userData.ring.material.color.setHex(available ? 0xe5aa3f : 0x78968c);
    point.userData.label.visible = available;
    point.scale.setScalar(available ? 1 : 0.82);
    point.userData.ring.rotation.z += available ? 0.035 : 0.006;
    const pulse = available ? 1 + Math.sin(time * 5) * 0.1 : 1;
    point.userData.ring.scale.setScalar(pulse);
    point.userData.label.position.y = available ? 2.45 + Math.sin(time * 4) * 0.16 : 2.45;
  }
}

function getObjectiveTarget() {
  if (state.letters > 0 && deliveryPoints.length) {
    state.objectiveKind = "delivery";
    return deliveryPoints[state.activeDeliveryIndex];
  }

  let nearest = null;
  let nearestDistance = Infinity;
  const targetRoot = state.inCar ? car.root : player.root;
  for (const letter of collectibles.children) {
    if (letter.userData.hit || !letter.visible) continue;
    const distance = distance2D(targetRoot.position, letter.position);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = letter;
    }
  }
  state.objectiveKind = nearest ? "letter" : "complete";
  return nearest;
}

function updateObjectiveGuide(time) {
  const target = getObjectiveTarget();
  if (!target) {
    objectiveArrow.visible = false;
    state.objectiveDistance = 0;
    return;
  }

  const targetRoot = state.inCar ? car.root : player.root;
  objectiveVector.subVectors(target.position, targetRoot.position);
  objectiveVector.y = 0;
  state.objectiveDistance = objectiveVector.length();

  if (state.objectiveDistance > 0.01) {
    objectiveArrow.visible = true;
    objectiveArrow.position.copy(targetRoot.position);
    objectiveArrow.position.y += state.inCar ? 3.0 : 3.55;
    objectiveArrow.position.y += Math.sin(time * 5) * 0.12;
    objectiveArrow.rotation.set(0, Math.atan2(objectiveVector.x, objectiveVector.z) + Math.PI, 0);
    objectiveArrow.scale.setScalar((state.inCar ? 0.72 : 0.78) + Math.sin(time * 6) * 0.035);
  }
}

function updateCamera(dt) {
  const orbitDistance = state.cameraMode ? 15 : 10;
  const orbitHeight = state.cameraMode ? 10 : 5.5;
  const targetRoot = state.inCar ? car.root : player.root;
  cameraOffset.set(
    Math.sin(state.cameraYaw) * orbitDistance,
    orbitHeight,
    Math.cos(state.cameraYaw) * orbitDistance
  );
  cameraTarget.copy(targetRoot.position).add(cameraOffset);
  lookTarget.copy(targetRoot.position).add(new THREE.Vector3(0, state.inCar ? 1.0 : 1.55, 0));
  camera.position.lerp(cameraTarget, Math.min(1, dt * 5.8));
  camera.lookAt(lookTarget);
}

function updateHud() {
  const meters = Math.floor(state.walked);
  lettersEl.textContent = state.letters;
  distanceEl.textContent = `${meters}m`;
  bestEl.textContent = `${Math.max(state.best, meters)}m`;
  scoreEl.textContent = state.score;
  deliveredEl.textContent = state.delivered;
  comboEl.textContent = `x${state.combo}`;
  comboHud.classList.toggle("is-active", state.comboTimer > 0);
  comboMeter.style.width = `${state.comboTimer > 0 ? (state.comboTimer / state.comboDuration) * 100 : 0}%`;
  if (state.objectiveKind === "delivery") {
    objectiveLabel.textContent = "Deliver letter";
    objectiveDistance.textContent = `${Math.floor(state.objectiveDistance)}m`;
  } else if (state.objectiveKind === "letter") {
    objectiveLabel.textContent = "Find letter";
    objectiveDistance.textContent = `${Math.floor(state.objectiveDistance)}m`;
  } else {
    objectiveLabel.textContent = "All letters done";
    objectiveDistance.textContent = "--m";
  }
}

function tick(now) {
  const time = now / 1000;
  const dt = Math.min(0.033, (now - state.lastTime) / 1000 || 0.016);
  state.lastTime = now;

  if (state.started && !state.paused) {
    if (state.inCar) {
      updateCar(dt);
    } else {
      updatePlayer(dt, time);
    }
    updateCombo(dt);
    updateFallingSafetyGates(dt);
    updateScorePopups(dt);
    resolvePickups(time);
    resolveDeliveries(time);
    updateObjectiveGuide(time);
    updateCamera(dt);
    updateHud();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function startGame() {
  saveBest();
  state.started = true;
  state.paused = false;
  state.walked = 0;
  state.letters = 0;
  state.score = 0;
  state.delivered = 0;
  state.combo = 1;
  state.comboTimer = 0;
  state.lastGateScore = 0;
  state.lastTime = performance.now();
  state.verticalVelocity = 0;
  state.grounded = true;
  state.inCar = false;
  state.carSpeed = 0;
  moveVelocity.set(0, 0, 0);
  player.root.position.set(0, 0, 0);
  player.root.visible = true;
  player.root.rotation.set(0, Math.PI, 0);
  car.root.position.set(carSpawn.x, 0, carSpawn.z);
  car.root.rotation.y = carSpawn.yaw;
  objectiveArrow.visible = false;
  resetSafetyGates();
  setActiveDeliveryPoint(0);
  clearScorePopups();

  for (const letter of collectibles.children) {
    letter.visible = true;
    letter.userData.hit = false;
  }

  overlay.classList.add("hidden");
  overlay.querySelector("h1").textContent = "Alley Messenger";
  startButton.textContent = "Restart";
  updateCamera(1);
  updateHud();
}

function togglePause() {
  if (!state.started) return;
  state.paused = !state.paused;
  overlay.classList.toggle("hidden", !state.paused);
  overlay.querySelector("h1").textContent = state.paused ? "Paused" : "Alley Messenger";
  startButton.textContent = state.paused ? "Resume" : "Restart";
  menuButton.classList.toggle("is-active", state.paused);
  if (!state.paused) {
    state.lastTime = performance.now();
  }
}

function saveBest() {
  const meters = Math.floor(state.walked);
  if (meters > state.best) {
    state.best = meters;
    localStorage.setItem("alley-messenger-best", String(state.best));
  }
}

function distance2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerpAngle(current, target, amount) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * amount;
}

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);
window.addEventListener("beforeunload", saveBest);

window.addEventListener("keydown", (event) => {
  if (event.code === "Escape") {
    event.preventDefault();
    togglePause();
    return;
  }
  if (event.code === "Space") {
    event.preventDefault();
    jump();
    return;
  }
  if (event.code === "KeyE") {
    event.preventDefault();
    toggleCar();
    return;
  }
  if (event.code === "KeyG") {
    event.preventDefault();
    spawnSafetyGateAhead();
    return;
  }
  state.keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  state.keys.delete(event.code);
});

canvas.addEventListener("pointerdown", (event) => {
  state.pointerActive = true;
  state.lastPointerX = event.clientX;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!state.pointerActive) return;
  const dx = event.clientX - state.lastPointerX;
  state.lastPointerX = event.clientX;
  state.cameraYaw -= dx * 0.008;
});

canvas.addEventListener("pointerup", () => {
  state.pointerActive = false;
});

function updateMoveStick(event) {
  const rect = moveStick.getBoundingClientRect();
  const maxDistance = rect.width * 0.34;
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  const distance = Math.hypot(dx, dy);
  const scale = distance > maxDistance ? maxDistance / distance : 1;
  const knobX = dx * scale;
  const knobY = dy * scale;
  state.touchMoveX = clamp(knobX / maxDistance, -1, 1);
  state.touchMoveY = clamp(knobY / maxDistance, -1, 1);
  moveKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
}

function resetMoveStick() {
  state.stickPointerId = null;
  state.touchMoveX = 0;
  state.touchMoveY = 0;
  moveKnob.style.transform = "translate(-50%, -50%)";
}

moveStick.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  state.stickPointerId = event.pointerId;
  moveStick.setPointerCapture(event.pointerId);
  updateMoveStick(event);
});

moveStick.addEventListener("pointermove", (event) => {
  if (event.pointerId !== state.stickPointerId) return;
  event.preventDefault();
  event.stopPropagation();
  updateMoveStick(event);
});

moveStick.addEventListener("pointerup", (event) => {
  if (event.pointerId !== state.stickPointerId) return;
  event.preventDefault();
  event.stopPropagation();
  resetMoveStick();
});

moveStick.addEventListener("pointercancel", resetMoveStick);

startButton.addEventListener("click", () => {
  if (state.paused) {
    togglePause();
    return;
  }
  startGame();
});

menuButton.addEventListener("click", togglePause);
soundButton.addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  soundButton.classList.toggle("is-active", state.soundOn);
});
colorButton.addEventListener("click", () => {
  state.outfit = (state.outfit + 1) % 3;
  const colors = [0x182326, 0xd95b59, 0xe5aa3f];
  player.body.material.color.setHex(colors[state.outfit]);
});
viewButton.addEventListener("click", () => {
  state.cameraMode = 1 - state.cameraMode;
  viewButton.classList.toggle("is-active", Boolean(state.cameraMode));
});

jumpButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  jump();
});

carButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  toggleCar();
});

gateButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  spawnSafetyGateAhead();
});

soundButton.classList.add("is-active");
if (new URLSearchParams(window.location.search).has("autostart")) {
  startGame();
}

window.__alleyMessengerDebug = {
  state,
  player: player.root,
  car: car.root,
  spawnSafetyGate: (x, z, rotationY = 0) => createSafetyGate(x, z, rotationY),
  spawnSafetyGateAt: (x, z, rotationY = 0) => createSafetyGate(x, z, rotationY),
};
