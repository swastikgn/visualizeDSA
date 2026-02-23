import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import gsap from "gsap";

// --- State ---
let container = []; // Stores Group of {Mesh, Text}
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
  container.forEach(g => g.children[0].material.color.set(elementColor));
});
document.getElementById("text_color").addEventListener("input", (e) => {
  valueColor = e.target.value;
  container.forEach(g => g.children[1].material.color.set(valueColor));
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
camera.position.set(4, 5, 12);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(3, 0, 0);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 8, 5);
scene.add(dirLight);

// Grid
const gridHelper = new THREE.GridHelper(30, 30, 0x444444, 0x222222);
gridHelper.position.y = -0.6;
scene.add(gridHelper);

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
  initStaticPointers();
});

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
  cone.position.set(0, 0.2, 0); // Tip at exactly 0,0,0
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

  // Position text near the tail of the arrow
  const tailX = -Math.sin(angleZ) * 1.3;
  const tailY = Math.cos(angleZ) * 1.3;
  textMesh.position.set(-textW / 2 + tailX + textOffsetX, tailY, 0);

  group.add(textMesh);

  group.scale.set(0, 0, 0);
  scene.add(group);
  return group;
}

function initStaticPointers() {
  frontPointer = createPointer("Front", Math.PI / 4, -0.2); // Angles from top-left
  rearPointer = createPointer("Rear", -Math.PI / 4, 0.2); // Angles from top-right
}

async function enqueue(val) {
  if (isAnimating || !globalFont) return;
  isAnimating = true;
  setStatus(`Enqueuing ${val}...`, true);

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

  const targetX = container.length * 1.6;
  group.position.set(targetX, 10, 0);
  scene.add(group);
  container.push(group);

  const duration = getSpeed();

  // Animate Entrance
  await gsap.to(group.position, { y: 0, duration: duration, ease: "bounce.out" });

  // Update Pointers to point exactly at the top center of the elements
  if (container.length === 1) {
    gsap.to(frontPointer.scale, { x: 1, y: 1, z: 1, duration: 0.3 });
    gsap.to(frontPointer.position, { x: 0, y: 0.6, duration: 0.3 });
  }

  gsap.to(rearPointer.scale, { x: 1, y: 1, z: 1, duration: 0.3 });
  await gsap.to(rearPointer.position, { x: targetX, y: 0.6, duration: 0.3 });

  isAnimating = false;
  setStatus(`Enqueued ${val}. Size: ${container.length}`);
}

async function dequeue() {
  if (isAnimating || container.length === 0) return;
  isAnimating = true;
  setStatus("Dequeuing element...", true);

  const element = container.shift();
  const duration = getSpeed();

  // Fly out to the left
  await gsap.to(element.position, { x: -10, opacity: 0, duration: duration, ease: "power2.in" });
  scene.remove(element);

  if (container.length === 0) {
    gsap.to(frontPointer.scale, { x: 0, y: 0, z: 0, duration: 0.3 });
    gsap.to(rearPointer.scale, { x: 0, y: 0, z: 0, duration: 0.3 });
  } else {
    // Shift the whole queue left
    const tl = gsap.timeline();
    container.forEach((g, idx) => {
      tl.to(g.position, { x: idx * 1.6, duration: 0.4, ease: "power2.inOut" }, 0);
    });

    // Front stays pointing at 0, rear tracks the last element
    tl.to(frontPointer.position, { x: 0, y: 0.6, duration: 0.4 }, 0);
    await tl.to(rearPointer.position, { x: (container.length - 1) * 1.6, y: 0.6, duration: 0.4 }, 0);
  }

  isAnimating = false;
  setStatus(container.length === 0 ? "Queue empty." : `Dequeued. Size: ${container.length}`);
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
  container.forEach(g => scene.remove(g));
  container = [];
  frontPointer.scale.set(0, 0, 0);
  rearPointer.scale.set(0, 0, 0);
  setStatus("Queue reset.");
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
