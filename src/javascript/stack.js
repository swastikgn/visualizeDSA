import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import gsap from "gsap";

// --- State ---
let container = []; // Stores Group of {Mesh, Text}
let topPointer = null;
let minusOneMesh = null;
let isAnimating = false;
let globalFont = null;

// Default colors
let sceneBG = "#2e2e2e";
let elementColor = "#facc15";
let valueColor = "#000000";
let topPointerColor = "#ef4444";

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
  // Inverting: higher slider value means faster animation (smaller duration)
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
  if (minusOneMesh) minusOneMesh.material.color.set(valueColor);
});
document.getElementById("top_pointer_color").addEventListener("input", (e) => {
  topPointerColor = e.target.value;
  if (topPointer) topPointer.material.color.set(topPointerColor);
});

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(sceneBG);

const camera = new THREE.PerspectiveCamera(60, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 1000);
camera.position.set(6, 4, 10);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

// Lighting & Environment
const regbeLoader = new RGBELoader();
regbeLoader.load("/hdrr.hdr", function (texture) {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envMap = pmremGenerator.fromEquirectangular(texture).texture;
  scene.environment = envMap;
  texture.dispose();
  pmremGenerator.dispose();
});

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 8, 5);
scene.add(dirLight);

// Floor Grid
const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
gridHelper.position.y = -4.2;
scene.add(gridHelper);

// --- Font Loading ---
const fontLoader = new FontLoader();
fontLoader.load("/helvetiker_regular.typeface.json", (font) => {
  globalFont = font;
  initStaticElements();
});

function initStaticElements() {
  // "-1" text for top index when empty
  const minusGeo = new TextGeometry("-1", { font: globalFont, size: 0.6, height: 0.1 });
  const minusMat = new THREE.MeshStandardMaterial({
    color: valueColor,
    metalness: 0.5,
    roughness: 0.2
  });
  minusOneMesh = new THREE.Mesh(minusGeo, minusMat);
  minusGeo.computeBoundingBox();
  const minusW = minusGeo.boundingBox.max.x - minusGeo.boundingBox.min.x;
  minusOneMesh.position.set(-minusW / 2, -4, 0);
  scene.add(minusOneMesh);

  // "<= top" pointer
  const topGeo = new TextGeometry("<= top", { font: globalFont, size: 0.6, height: 0.1 });
  const topMat = new THREE.MeshStandardMaterial({
    color: topPointerColor,
    metalness: 0.5,
    roughness: 0.2,
    emissive: topPointerColor,
    emissiveIntensity: 0.2
  });
  topPointer = new THREE.Mesh(topGeo, topMat);
  topPointer.position.set(0.6, -4, 0);
  scene.add(topPointer);
}

async function pushElement(val) {
  if (isAnimating || !globalFont) return;
  isAnimating = true;
  setStatus(`Pushing ${val}...`, true);

  const group = new THREE.Group();

  // Cube Mesh
  const geo = new THREE.BoxGeometry(2, 1, 2);
  const mat = new THREE.MeshStandardMaterial({ color: elementColor, metalness: 0.4, roughness: 0.2 });
  const box = new THREE.Mesh(geo, mat);
  group.add(box);

  // Text Mesh
  const textGeo = new TextGeometry(val.toString(), { font: globalFont, size: 0.5, height: 0.1 });
  textGeo.computeBoundingBox();
  const textW = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
  const textMat = new THREE.MeshStandardMaterial({ color: valueColor });
  const textMesh = new THREE.Mesh(textGeo, textMat);
  textMesh.position.set(-textW / 2, -0.25, 1.01);
  group.add(textMesh);

  // Initial position (flying in from top)
  const targetY = -2.8 + container.length * 1.2;
  group.position.set(0, 10, 0);
  scene.add(group);
  container.push(group);

  const duration = getSpeed();

  // Animate push
  await gsap.to(group.position, { y: targetY, duration: duration, ease: "bounce.out" });

  // Move pointer
  await gsap.to(topPointer.position, { y: targetY - 0.3, x: 1.5, duration: 0.3 });

  isAnimating = false;
  setStatus(`Pushed ${val}. Stack size: ${container.length}`);
}

async function popElement() {
  if (isAnimating || container.length === 0) return;
  isAnimating = true;
  setStatus("Popping element...", true);

  const top = container.pop();
  const duration = getSpeed();

  // Move pointer down first
  if (container.length > 0) {
    const nextY = -2.8 + (container.length - 1) * 1.2;
    gsap.to(topPointer.position, { y: nextY - 0.3, duration: 0.3 });
  } else {
    gsap.to(topPointer.position, { y: -4, x: 0.6, duration: 0.3 });
  }

  // Fly out the element
  await gsap.to(top.position, { x: 10, opacity: 0, duration: duration, ease: "power2.in" });

  scene.remove(top);
  isAnimating = false;
  setStatus(container.length === 0 ? "Stack is empty." : `Popped. Stack size: ${container.length}`);
}

// --- Handlers ---
document.getElementById("myForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("array");
  const val = input.value.trim();
  if (val !== "") {
    pushElement(val);
    input.value = "";
  }
});

document.getElementById("pop_stack").onclick = popElement;

document.getElementById("reset").onclick = () => {
  if (isAnimating) return;
  container.forEach(g => scene.remove(g));
  container = [];
  topPointer.position.set(0.6, -3.5, 0);
  setStatus("Stack reset.");
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

function animateLoop() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animateLoop);
}
animateLoop();
