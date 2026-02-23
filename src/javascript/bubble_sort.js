import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry";
import gsap from "gsap";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";

// State
let array = [];
let container = [];
let indexMeshes = [];
let isSorting = false;
let loadedFont = null;

// Colors (reactive from pickers)
let cubeColor = new THREE.Color("#ef4444");
let textColor = new THREE.Color("#facc15");
let swapColor = new THREE.Color("#ffffff");
let sortedColor = new THREE.Color("#22c55e");

// DOM refs
const canvasContainer = document.getElementById("threed");
const canvas = document.getElementById("webgl");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const speedSlider = document.getElementById("speedSlider");

function setStatus(msg, sorting = false) {
  statusText.textContent = msg;
  statusDot.className = sorting ? "status-dot sorting" : "status-dot";
}

function getSpeed() {
  // Inverting: higher slider value (e.g. 1.0) should mean faster animation (smaller duration)
  // Max duration (at 0.1 slider) = 1.0s, Min duration (at 1.0 slider) = 0.1s
  return 1.1 - parseFloat(speedSlider.value);
}

// --- Color pickers (live, no button needed) ---
document.getElementById("scene_background").addEventListener("input", (e) => {
  scene.background = new THREE.Color(e.target.value);
});
document.getElementById("cube_color").addEventListener("input", (e) => {
  cubeColor = new THREE.Color(e.target.value);
  container.forEach((g) => g.children[0].material.color.copy(cubeColor));
});
document.getElementById("cube_change_color").addEventListener("input", (e) => {
  swapColor = new THREE.Color(e.target.value);
});
document.getElementById("text_color").addEventListener("input", (e) => {
  textColor = new THREE.Color(e.target.value);
  container.forEach((g) => {
    if (g.children[1]) g.children[1].material.color.copy(textColor);
  });
  indexMeshes.forEach((m) => m.material.color.copy(textColor));
});
document.getElementById("sorted_color").addEventListener("input", (e) => {
  sortedColor = new THREE.Color(e.target.value);
});

// --- Form submit ---
document.getElementById("myForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (isSorting) return setStatus("⏳ Wait for current sort to finish", true);

  const raw = document.getElementById("array").value.trim();
  if (!raw) return setStatus("⚠️ Please enter some numbers");

  const parsed = raw.split(/[ ,]+/).filter(Boolean).map(Number);
  if (parsed.some(isNaN)) return setStatus("⚠️ Invalid input — use numbers only");
  if (parsed.length === 0) return setStatus("⚠️ No valid numbers entered");
  if (parsed.length > 20) return setStatus("⚠️ Max 20 elements for visualization");

  array = parsed;
  clearScene();
  createCubes();
  setStatus(`✅ Created ${array.length} elements — click Sort to begin`);
});

// --- Animate button ---
document.getElementById("animate").addEventListener("click", () => {
  if (isSorting) return;
  if (container.length === 0) return setStatus("⚠️ Nothing to sort — create elements first");
  if (container.length === 1) return setStatus("✅ Already sorted (single element)");
  bubbleSort(container);
});

// --- Reset ---
document.getElementById("reset").addEventListener("click", () => {
  if (isSorting) return setStatus("⏳ Cannot reset while sorting", true);
  clearScene();
  array = [];
  setStatus("Ready — enter numbers and click Create");
});

function clearScene() {
  container.forEach((g) => scene.remove(g));
  indexMeshes.forEach((m) => scene.remove(m));
  container = [];
  indexMeshes = [];
}

// --- Three.js setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color("#2e2e2e");

const sizes = {
  width: canvasContainer.clientWidth,
  height: canvasContainer.clientHeight,
};

const camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 0.1, 100);
camera.position.set(0, 1.5, 7);
scene.add(camera);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Environment map
const rgbeLoader = new RGBELoader();
rgbeLoader.load("/hdrr.hdr", (texture) => {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromEquirectangular(texture).texture;
  scene.environment = envMap;
  texture.dispose();
  pmrem.dispose();
});

// Extra lights for when no env map
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 8, 5);
scene.add(dirLight);

// Floor grid (subtle reference)
const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x333333);
gridHelper.position.y = -2;
scene.add(gridHelper);

// --- Font loader ---
const fontLoader = new FontLoader();
fontLoader.load("/helvetiker_regular.typeface.json", (font) => {
  loadedFont = font;
});

function createTextMesh(text, size, color, font) {
  const geo = new TextGeometry(String(text), {
    font, size, height: 0.05,
    curveSegments: 8,
    bevelEnabled: true, bevelThickness: 0.01,
    bevelSegments: 3, bevelSize: 0.015, bevelOffset: -0.002,
  });
  geo.computeBoundingBox();
  geo.center();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.4 });
  return new THREE.Mesh(geo, mat);
}

function createCubes() {
  if (!loadedFont) {
    setStatus("⏳ Loading font, please wait...");
    fontLoader.load("/helvetiker_regular.typeface.json", (font) => {
      loadedFont = font;
      createCubes();
    });
    return;
  }

  const spacing = 1.4;
  const totalWidth = (array.length - 1) * spacing;
  const startX = -totalWidth / 2;

  for (let i = 0; i < array.length; i++) {
    const group = new THREE.Group();

    // Cube with rounded edges feel (still box but nicer material)
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1, 2, 2, 2),
      new THREE.MeshStandardMaterial({
        color: cubeColor,
        roughness: 0.35,
        metalness: 0.7,
        envMapIntensity: 1.0,
      })
    );
    group.add(mesh);

    // Value text on front face
    const textMesh = createTextMesh(array[i], 0.35, textColor, loadedFont);
    textMesh.position.set(0, 0, 0.55);
    group.add(textMesh);

    group.name = String(array[i]);
    group.position.set(startX + i * spacing, 0, 0);
    container.push(group);
    scene.add(group);

    // Index label below
    const idxMesh = createTextMesh(i, 0.25, textColor, loadedFont);
    idxMesh.position.set(startX + i * spacing, -1.2, 0.5);
    indexMeshes.push(idxMesh);
    scene.add(idxMesh);
  }

  // Auto-fit camera
  const camZ = Math.max(5, totalWidth * 0.6 + 3);
  gsap.to(camera.position, { duration: 0.6, x: 0, y: 1.5, z: camZ, ease: "power2.out" });
  controls.target.set(0, 0, 0);
}

// --- Bubble sort animation ---
async function bubbleSort(c) {
  isSorting = true;
  const n = c.length;
  let totalSwaps = 0;

  for (let i = 0; i < n; i++) {
    let swapped = false;
    for (let j = 0; j < n - i - 1; j++) {
      setStatus(`🔍 Comparing index ${j} and ${j + 1}`, true);

      // Highlight comparison pair
      c[j].children[0].material.color.copy(swapColor);
      c[j + 1].children[0].material.color.copy(swapColor);

      const speed = getSpeed();
      await delay(speed * 300);

      if (parseInt(c[j].name) > parseInt(c[j + 1].name)) {
        setStatus(`🔄 Swapping ${c[j].name} ↔ ${c[j + 1].name}`, true);
        await swapAnimation(c[j], c[j + 1]);

        // Swap in array
        [c[j], c[j + 1]] = [c[j + 1], c[j]];
        swapped = true;
        totalSwaps++;
      }

      // Reset color
      c[j].children[0].material.color.copy(cubeColor);
      c[j + 1].children[0].material.color.copy(cubeColor);
    }

    // Mark last element of this pass as sorted
    c[n - i - 1].children[0].material.color.copy(sortedColor);

    if (!swapped) {
      // All remaining are sorted
      for (let k = 0; k < n - i - 1; k++) {
        c[k].children[0].material.color.copy(sortedColor);
      }
      break;
    }
  }

  isSorting = false;
  setStatus(`✅ Sorted! ${totalSwaps} swap${totalSwaps !== 1 ? "s" : ""} performed`);
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function swapAnimation(obj1, obj2) {
  const speed = getSpeed();
  const pos1 = obj1.position.x;
  const pos2 = obj2.position.x;

  const tl = gsap.timeline();
  // Lift both, move across, drop — parallel with stagger
  await tl
    .to(obj1.position, { duration: speed, y: 1.6, ease: "power2.out" }, 0)
    .to(obj2.position, { duration: speed, y: -1.6, ease: "power2.out" }, 0)
    .to(obj1.position, { duration: speed, x: pos2, ease: "power2.inOut" }, speed * 0.5)
    .to(obj2.position, { duration: speed, x: pos1, ease: "power2.inOut" }, speed * 0.5)
    .to(obj1.position, { duration: speed, y: 0, ease: "power2.in" }, speed * 1.2)
    .to(obj2.position, { duration: speed, y: 0, ease: "power2.in" }, speed * 1.2);
}

// --- Resize ---
const resizeObserver = new ResizeObserver(() => {
  sizes.width = canvasContainer.clientWidth;
  sizes.height = canvasContainer.clientHeight;
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
resizeObserver.observe(canvasContainer);

// --- Render loop ---
function tick() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
