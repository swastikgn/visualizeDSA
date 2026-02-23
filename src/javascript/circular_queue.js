import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import gsap from "gsap";

// --- State ---
const MAX_SIZE = 8;
const RADIUS = 4;
let slots = new Array(MAX_SIZE).fill(null);
let head = -1;
let tail = -1;

let frontPointer = null;
let rearPointer = null;
let isAnimating = false;
let globalFont = null;

// Colors
let sceneBG = "#2e2e2e";
let elementColor = "#facc15";
let valueColor = "#000000";
let pointerColor = "#ef4444";

// DOM refs
const canvasContainer = document.getElementById("threed");
const canvas = document.getElementById("webgl");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const speedSlider = document.getElementById("speedSlider");

function setStatus(msg, animating = false) {
  statusText.textContent = msg;
  statusDot.className = animating ? "status-dot animating" : "status-dot";
}

function getSpeed() {
  return 1.1 - parseFloat(speedSlider.value);
}

// --- Live Color Listeners ---
document.getElementById("scene_background").addEventListener("input", (e) => {
  scene.background = new THREE.Color(e.target.value);
});
document.getElementById("cube_color").addEventListener("input", (e) => {
  elementColor = e.target.value;
  slots.forEach(g => { if (g) g.children[0].material.color.set(elementColor); });
});
document.getElementById("text_color").addEventListener("input", (e) => {
  valueColor = e.target.value;
  slots.forEach(g => { if (g) g.children[1].material.color.set(valueColor); });
});
document.getElementById("arrow_color").addEventListener("input", (e) => {
  pointerColor = e.target.value;
  if (frontPointer) frontPointer.traverse(node => { if (node.isMesh) node.material.color.set(pointerColor); });
  if (rearPointer) rearPointer.traverse(node => { if (node.isMesh) node.material.color.set(pointerColor); });
});

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(sceneBG);

const camera = new THREE.PerspectiveCamera(60, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 1000);
camera.position.set(0, 10, 12); // Higher up to see the circle

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 8, 5);
scene.add(dirLight);

// Env
new RGBELoader().load("/hdrr.hdr", (texture) => {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromEquirectangular(texture).texture;
  texture.dispose();
  pmremGenerator.dispose();
});

// --- Font & Elements ---
const fontLoader = new FontLoader();
fontLoader.load("/helvetiker_regular.typeface.json", (font) => {
  globalFont = font;
  drawEmptySlots();
  initStaticPointers();
});

function drawEmptySlots() {
  for (let i = 0; i < MAX_SIZE; i++) {
    const angle = (i * 2 * Math.PI) / MAX_SIZE;
    const x = RADIUS * Math.cos(angle);
    const z = RADIUS * Math.sin(angle);

    // Base platform for the slot
    const geo = new THREE.CylinderGeometry(0.8, 0.8, 0.1, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888, transparent: true, opacity: 0.3 });
    const base = new THREE.Mesh(geo, mat);
    base.position.set(x, -0.65, z);
    scene.add(base);

    // Index number
    const idxGeo = new TextGeometry(i.toString(), { font: globalFont, size: 0.3, height: 0.05 });
    idxGeo.computeBoundingBox();
    const idxW = idxGeo.boundingBox.max.x - idxGeo.boundingBox.min.x;
    const idxMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
    const idxMesh = new THREE.Mesh(idxGeo, idxMat);

    // Face the text upwards towards the camera
    idxMesh.rotation.x = -Math.PI / 2;
    idxMesh.position.set(x - idxW / 2, -0.55, z + 0.15);
    scene.add(idxMesh);
  }
}

function createPointer(label, angleZ, textOffsetX) {
  const group = new THREE.Group();

  const mat = new THREE.MeshStandardMaterial({
    color: pointerColor,
    metalness: 0.6,
    roughness: 0.2,
    emissive: pointerColor,
    emissiveIntensity: 0.1
  });

  const arrowGroup = new THREE.Group();

  const coneGeo = new THREE.ConeGeometry(0.2, 0.4, 16);
  coneGeo.rotateX(Math.PI);
  const cone = new THREE.Mesh(coneGeo, mat);
  cone.position.set(0, 0.2, 0); // Tip exactly at bottom
  arrowGroup.add(cone);

  const cylGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 16);
  const cyl = new THREE.Mesh(cylGeo, mat);
  cyl.position.y = 0.8;
  arrowGroup.add(cyl);

  arrowGroup.rotation.z = angleZ;
  group.add(arrowGroup);

  const textGeo = new TextGeometry(label, { font: globalFont, size: 0.28, height: 0.05 });
  textGeo.computeBoundingBox();
  const textW = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
  const textMesh = new THREE.Mesh(textGeo, mat);

  const tailX = -Math.sin(angleZ) * 1.3;
  const tailY = Math.cos(angleZ) * 1.3;
  textMesh.position.set(-textW / 2 + tailX + textOffsetX, tailY, 0);

  // Angle label text towards camera a bit
  textMesh.rotation.x = -Math.PI / 4;

  group.add(textMesh);

  group.scale.set(0, 0, 0);
  scene.add(group);
  return group;
}

function initStaticPointers() {
  frontPointer = createPointer("Front", Math.PI / 4, -0.3);
  rearPointer = createPointer("Rear", -Math.PI / 4, 0.3);
}

function updatePointers(animatePointers = true) {
  const duration = animatePointers ? 0.4 : 0;

  // Update Front
  if (head === -1) {
    gsap.to(frontPointer.scale, { x: 0, y: 0, z: 0, duration: 0.3 });
  } else {
    const angleF = (head * 2 * Math.PI) / MAX_SIZE;
    gsap.to(frontPointer.scale, { x: 1, y: 1, z: 1, duration: 0.3 });
    gsap.to(frontPointer.position, {
      x: (RADIUS - 0.2) * Math.cos(angleF),
      y: 0.6,
      z: (RADIUS - 0.2) * Math.sin(angleF),
      duration: duration,
      ease: "power2.out"
    });
  }

  // Update Rear
  if (tail === -1) {
    gsap.to(rearPointer.scale, { x: 0, y: 0, z: 0, duration: 0.3 });
  } else {
    const angleR = (tail * 2 * Math.PI) / MAX_SIZE;
    gsap.to(rearPointer.scale, { x: 1, y: 1, z: 1, duration: 0.3 });
    gsap.to(rearPointer.position, {
      x: (RADIUS + 0.2) * Math.cos(angleR),
      y: 0.6,
      z: (RADIUS + 0.2) * Math.sin(angleR),
      duration: duration,
      ease: "power2.out"
    });
  }
}

async function enqueue(val) {
  if (isAnimating || !globalFont) return;

  if ((tail + 1) % MAX_SIZE === head) {
    setStatus("Queue is Full! (Ring Buffer max capacity reached)", true);
    // Flash the ring red
    gsap.to(scene.background, { r: 0.3, g: 0.1, b: 0.1, duration: 0.1, yoyo: true, repeat: 3 });
    return;
  }

  isAnimating = true;
  setStatus(`Enqueuing ${val}...`, true);

  if (head === -1) head = 0;
  tail = (tail + 1) % MAX_SIZE;

  const group = new THREE.Group();
  const geo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const mat = new THREE.MeshStandardMaterial({ color: elementColor, roughness: 0.2, metalness: 0.3 });
  const box = new THREE.Mesh(geo, mat);
  group.add(box);

  const textGeo = new TextGeometry(val.toString(), { font: globalFont, size: 0.5, height: 0.1 });
  textGeo.computeBoundingBox();
  const textW = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
  const textMat = new THREE.MeshStandardMaterial({ color: valueColor });
  const textMesh = new THREE.Mesh(textGeo, textMat);
  textMesh.position.set(-textW / 2, -0.25, 0.61);
  group.add(textMesh);

  // Calculate target position based on Tail
  const angle = (tail * 2 * Math.PI) / MAX_SIZE;
  const targetX = RADIUS * Math.cos(angle);
  const targetZ = RADIUS * Math.sin(angle);

  // Start high above
  group.position.set(targetX, 10, targetZ);

  // Ensure we face the cube outward slightly to look cool
  group.rotation.y = -angle + Math.PI / 2;

  scene.add(group);
  slots[tail] = group;

  const duration = getSpeed();

  // Pointer movement happens simultaneously with block falling
  updatePointers(true);

  await gsap.to(group.position, { y: 0, duration: duration, ease: "bounce.out" });

  isAnimating = false;
  setStatus(`Enqueued ${val} at index ${tail}.`);
}

async function dequeue() {
  if (isAnimating) return;

  if (head === -1) {
    setStatus("Queue is Empty!", true);
    return;
  }

  isAnimating = true;
  setStatus(`Dequeuing from Head (index ${head})...`, true);

  const element = slots[head];
  slots[head] = null;
  const duration = getSpeed();

  // Animate removal (fly up/fade)
  await gsap.to(element.position, { y: 5, duration: duration, ease: "power2.in" });
  gsap.to(element.scale, { x: 0, y: 0, z: 0, duration: 0.2 });
  setTimeout(() => scene.remove(element), 200);

  // Update indices
  const removedIndex = head;
  if (head === tail) {
    head = -1;
    tail = -1;
  } else {
    head = (head + 1) % MAX_SIZE;
  }

  updatePointers(true);

  isAnimating = false;
  setStatus(`Dequeued from index ${removedIndex}. New Head is ${head === -1 ? 'None' : head}.`);
}

// --- Handlers ---
document.getElementById("myForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const rawVal = document.getElementById("array").value.trim();

  // Validation: Exactly one numeric value, no spaces
  const singleNumRegex = /^-?\d+$/;

  if (rawVal === "") return;

  if (!singleNumRegex.test(rawVal)) {
    setStatus("Invalid input! Please enter a single integer (e.g., 3).", true);
    return;
  }

  enqueue(rawVal);
  document.getElementById("array").value = "";
});

document.getElementById("dequeue").onclick = dequeue;

document.getElementById("reset").onclick = () => {
  if (isAnimating) return;
  slots.forEach((g, i) => {
    if (g) {
      scene.remove(g);
      slots[i] = null;
    }
  });
  head = -1;
  tail = -1;
  updatePointers(false);
  setStatus("Circular Queue reset.");
};

// --- Loop & Resize ---
const resizeObs = new ResizeObserver(() => {
  const w = canvasContainer.clientWidth;
  const h = canvasContainer.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});
resizeObs.observe(canvasContainer);

const tick = () => {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
};
tick();
