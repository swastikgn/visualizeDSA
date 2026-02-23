import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import gsap from "gsap";

// --- State ---
let sceneBG = "#2e2e2e";
let cubeColor = "#3b82f6";
let textColor = "#ffffff";
let keyFoundColor = "#22c55e";

let container = [];
let lowPointer = null;
let midPointer = null;
let highPointer = null;
let isAnimating = false;
let globalFont = null;

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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- Live Color Listeners ---
document.getElementById("scene_background").addEventListener("input", (e) => {
  scene.background = new THREE.Color(e.target.value);
});
document.getElementById("cube_color").addEventListener("input", (e) => {
  cubeColor = e.target.value;
  container.forEach(g => {
    if (!g.userData.found) g.children[0].material.color.set(cubeColor);
  });
});
document.getElementById("text_color").addEventListener("input", (e) => {
  textColor = e.target.value;
  container.forEach(g => g.children[1].material.color.set(textColor));
  container.forEach(g => g.children[2].material.color.set(textColor));
});
document.getElementById("key_found").addEventListener("input", (e) => {
  keyFoundColor = e.target.value;
  if (lowPointer) lowPointer.traverse(node => { if (node.isMesh) node.material.color.set(keyFoundColor); });
  if (midPointer) midPointer.traverse(node => { if (node.isMesh) node.material.color.set(keyFoundColor); });
  if (highPointer) highPointer.traverse(node => { if (node.isMesh) node.material.color.set(keyFoundColor); });
  container.forEach(g => {
    if (g.userData.found) g.children[0].material.color.set(keyFoundColor);
  });
});

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(sceneBG);

const camera = new THREE.PerspectiveCamera(60, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 1000);
camera.position.set(0, 3, 14);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// Environment
new RGBELoader().load("/hdrr.hdr", (texture) => {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromEquirectangular(texture).texture;
  texture.dispose();
  pmremGenerator.dispose();
});

// Font
const fontLoader = new FontLoader();
fontLoader.load("/helvetiker_regular.typeface.json", (font) => {
  globalFont = font;
  initPointers();
});

function createPointer(label, isAbove, angleZ = 0, textOffsetX = 0) {
  const group = new THREE.Group();

  const mat = new THREE.MeshStandardMaterial({
    color: keyFoundColor,
    metalness: 0.6,
    roughness: 0.2,
    emissive: keyFoundColor,
    emissiveIntensity: 0.1
  });

  const arrowGroup = new THREE.Group();

  // Cone
  const coneGeo = new THREE.ConeGeometry(0.2, 0.4, 16);
  if (isAbove) {
    coneGeo.rotateX(Math.PI); // Point down
  }
  const cone = new THREE.Mesh(coneGeo, mat);
  cone.position.set(0, isAbove ? 0.2 : -0.2, 0);
  arrowGroup.add(cone);

  // Cylinder
  const cylGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 16);
  const cyl = new THREE.Mesh(cylGeo, mat);
  cyl.position.y = isAbove ? 0.8 : -0.8;
  arrowGroup.add(cyl);

  arrowGroup.rotation.z = angleZ;
  group.add(arrowGroup);

  // Label
  const textGeo = new TextGeometry(label, { font: globalFont, size: 0.25, height: 0.05 });
  textGeo.computeBoundingBox();
  const textW = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
  const textMesh = new THREE.Mesh(textGeo, mat);
  textMesh.position.set(-textW / 2 + textOffsetX, isAbove ? 1.4 : -1.5, 0);
  group.add(textMesh);

  group.scale.set(0, 0, 0);
  scene.add(group);
  return group;
}

function initPointers() {
  lowPointer = createPointer("Low", false, -Math.PI / 5, -0.6);
  highPointer = createPointer("High", false, Math.PI / 5, 0.6);
  midPointer = createPointer("Mid", true, 0, 0);
}

function createElement(data, index, xPos) {
  const group = new THREE.Group();

  // Cube
  const geo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
  const mat = new THREE.MeshStandardMaterial({ color: cubeColor, roughness: 0.2, metalness: 0.3 });
  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);

  // Value
  const textGeo = new TextGeometry(data.toString(), { font: globalFont, size: 0.5, height: 0.1 });
  textGeo.computeBoundingBox();
  const textW = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
  const textMat = new THREE.MeshStandardMaterial({ color: textColor });
  const textMesh = new THREE.Mesh(textGeo, textMat);
  textMesh.position.set(-textW / 2, -0.25, 0.56);
  group.add(textMesh);

  // Index text below
  const idxGeo = new TextGeometry(index.toString(), { font: globalFont, size: 0.3, height: 0.05 });
  idxGeo.computeBoundingBox();
  const idxW = idxGeo.boundingBox.max.x - idxGeo.boundingBox.min.x;
  const idxMesh = new THREE.Mesh(idxGeo, textMat);
  idxMesh.position.set(-idxW / 2, -1.2, 0);
  group.add(idxMesh);

  group.position.set(xPos, 0, 0);
  group.userData = { data: data, found: false };
  scene.add(group);
  return group;
}

function buildArray(arr) {
  if (!globalFont) return;

  // Clear existing
  container.forEach(g => scene.remove(g));
  container = [];

  // Sort array
  arr.sort((a, b) => a - b);

  // Center alignment
  const startX = -((arr.length - 1) * 1.4) / 2;

  arr.forEach((val, i) => {
    const x = startX + i * 1.4;
    const el = createElement(val, i, x);

    // Entrance animation
    el.position.y = 10;
    gsap.to(el.position, { y: 0, duration: 0.5, delay: i * 0.05, ease: "bounce.out" });
    container.push(el);
  });

  // Hide pointers
  lowPointer.scale.set(0, 0, 0);
  highPointer.scale.set(0, 0, 0);
  midPointer.scale.set(0, 0, 0);

  setStatus(`Array sorted and built. Length: ${arr.length}`);
}

async function startBinarySearch(key) {
  if (isAnimating || container.length === 0) return;
  isAnimating = true;

  // Reset colors
  container.forEach(g => {
    g.children[0].material.color.set(cubeColor);
    g.userData.found = false;
  });

  let low = 0;
  let high = container.length - 1;

  const speed = getSpeed();

  // Show Low & High pointers initially
  lowPointer.position.set(container[low].position.x, -1.5, 0);
  highPointer.position.set(container[high].position.x, -1.5, 0);
  gsap.to(lowPointer.scale, { x: 1, y: 1, z: 1, duration: 0.3 });
  gsap.to(highPointer.scale, { x: 1, y: 1, z: 1, duration: 0.3 });

  while (low <= high) {
    let mid = Math.floor(low + (high - low) / 2);

    setStatus(`Searching... Low=${low}, High=${high}. Calculating Mid.`, true);
    await sleep(600 * speed);

    setStatus(`Mid is index ${mid}. Value is ${container[mid].userData.data}.`, true);

    // Animate Mid pointer
    midPointer.position.set(container[mid].position.x, 1.2, 0);
    if (midPointer.scale.x === 0) {
      gsap.to(midPointer.scale, { x: 1, y: 1, z: 1, duration: 0.3 });
    } else {
      await gsap.to(midPointer.position, { x: container[mid].position.x, duration: 0.5 * speed, ease: "power2.inOut" });
    }

    await sleep(800 * speed);

    if (container[mid].userData.data === key) {
      setStatus(`Key ${key} found at index ${mid}!`);
      container[mid].userData.found = true;
      gsap.to(container[mid].children[0].material.color, {
        r: new THREE.Color(keyFoundColor).r,
        g: new THREE.Color(keyFoundColor).g,
        b: new THREE.Color(keyFoundColor).b,
        duration: 0.4
      });

      // Bump animation
      gsap.to(container[mid].position, { y: 0.5, duration: 0.2, yoyo: true, repeat: 3 });

      isAnimating = false;
      return;
    }
    else if (container[mid].userData.data < key) {
      setStatus(`${container[mid].userData.data} < ${key}. Ignoring left half.`);
      // Dim left half
      for (let i = low; i <= mid; i++) {
        gsap.to(container[i].children[0].material, { opacity: 0.2, transparent: true, duration: 0.3 });
      }
      low = mid + 1;
      if (low <= high) {
        await gsap.to(lowPointer.position, { x: container[low].position.x, duration: 0.5 * speed, ease: "power2.inOut" });
      }
    }
    else {
      setStatus(`${container[mid].userData.data} > ${key}. Ignoring right half.`);
      // Dim right half
      for (let i = mid; i <= high; i++) {
        gsap.to(container[i].children[0].material, { opacity: 0.2, transparent: true, duration: 0.3 });
      }
      high = mid - 1;
      if (low <= high) {
        await gsap.to(highPointer.position, { x: container[high].position.x, duration: 0.5 * speed, ease: "power2.inOut" });
      }
    }
  }

  setStatus(`Key ${key} not found in the array.`, true);
  gsap.to(midPointer.scale, { x: 0, y: 0, z: 0, duration: 0.3 });
  isAnimating = false;
}

// --- Handlers ---
document.getElementById("myForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (isAnimating) return;
  const raw = document.getElementById("array").value;
  const arr = raw.split(/[ ,]+/).filter(Boolean).map(x => parseInt(x)).filter(x => !isNaN(x));
  if (arr.length > 0) {
    buildArray(arr);
  } else {
    setStatus("Please enter valid integers.", true);
  }
});

document.getElementById("reset").addEventListener("click", () => {
  if (isAnimating) return;
  container.forEach(g => scene.remove(g));
  container = [];
  if (lowPointer) lowPointer.scale.set(0, 0, 0);
  if (highPointer) highPointer.scale.set(0, 0, 0);
  if (midPointer) midPointer.scale.set(0, 0, 0);
  document.getElementById("array").value = "";
  setStatus("Scene reset.");
});

document.getElementById("binary_search").addEventListener("submit", (e) => {
  e.preventDefault();
  if (isAnimating) return;
  const key = parseInt(document.getElementById("key").value);
  if (!isNaN(key)) {
    // Reset opacities before new search
    container.forEach(g => {
      g.children[0].material.opacity = 1;
      g.children[0].material.transparent = false;
    });
    startBinarySearch(key);
  } else {
    setStatus("Please enter a valid key to search.", true);
  }
});

document.getElementById("resetbs").addEventListener("click", () => {
  if (isAnimating) return;
  container.forEach(g => {
    g.children[0].material.opacity = 1;
    g.children[0].material.transparent = false;
    g.children[0].material.color.set(cubeColor);
    g.userData.found = false;
  });
  if (lowPointer) lowPointer.scale.set(0, 0, 0);
  if (highPointer) highPointer.scale.set(0, 0, 0);
  if (midPointer) midPointer.scale.set(0, 0, 0);
  document.getElementById("key").value = "";
  setStatus("Search reset. Ready.");
});

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
