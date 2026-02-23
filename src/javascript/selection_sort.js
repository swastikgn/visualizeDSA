import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry";
import gsap from "gsap";

// --- State ---
let array = [];
let container = []; // Group of (mesh + text)
let indexMeshes = [];
let isSorting = false;
let globalFont = null;

// Default colors
let sceneBG = "#2e2e2e";
let cubeColor = "#ef4444";
let highlightColor = "#ffffff";
let textColor = "#facc15";
let sortedColor = "#22c55e";

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
  // Inverting: higher slider value means faster animation
  return 1.1 - parseFloat(speedSlider.value);
}

// --- Live Color Listeners ---
document.getElementById("scene_background").addEventListener("input", (e) => {
  sceneBG = e.target.value;
  scene.background = new THREE.Color(sceneBG);
});
document.getElementById("cube_color").addEventListener("input", (e) => {
  cubeColor = e.target.value;
  container.forEach(group => {
    if (!group.userData.isSorted) {
      group.children[0].material.color.set(cubeColor);
    }
  });
});
document.getElementById("cube_change_color").addEventListener("input", (e) => {
  highlightColor = e.target.value;
});
document.getElementById("text_color").addEventListener("input", (e) => {
  textColor = e.target.value;
  container.forEach(group => group.children[1].material.color.set(textColor));
  indexMeshes.forEach(mesh => mesh.material.color.set(textColor));
});
document.getElementById("sorted_color").addEventListener("input", (e) => {
  sortedColor = e.target.value;
  container.forEach(group => {
    if (group.userData.isSorted) {
      group.children[0].material.color.set(sortedColor);
    }
  });
});

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(sceneBG);

const camera = new THREE.PerspectiveCamera(65, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 1000);
camera.position.set(0, 2, 8);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// Grid for floor context
const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
gridHelper.position.y = -1.5;
scene.add(gridHelper);

// --- Font Loading ---
const fontLoader = new FontLoader();
fontLoader.load("/helvetiker_regular.typeface.json", (font) => {
  globalFont = font;
  console.log("Font loaded");
});

function createCubes() {
  if (!globalFont) {
    setTimeout(createCubes, 100);
    return;
  }

  // Cleanup
  container.forEach(g => scene.remove(g));
  indexMeshes.forEach(m => scene.remove(m));
  container = [];
  indexMeshes = [];

  const spacing = 1.3;
  const startX = -((array.length - 1) * spacing) / 2;

  array.forEach((val, i) => {
    const group = new THREE.Group();
    group.name = val.toString();
    group.userData = { originalIndex: i, isSorted: false };

    // Cube
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: cubeColor,
        roughness: 0.2,
        metalness: 0.5,
      })
    );
    group.add(cube);

    // Number on Cube
    const textGeo = new TextGeometry(val.toString(), {
      font: globalFont,
      size: 0.4,
      height: 0.1,
      curveSegments: 12,
    });
    textGeo.computeBoundingBox();
    const textWidth = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
    const textMesh = new THREE.Mesh(
      textGeo,
      new THREE.MeshStandardMaterial({ color: textColor, metalness: 0.4 })
    );
    textMesh.position.set(-textWidth / 2, -0.2, 0.51);
    group.add(textMesh);

    group.position.x = startX + i * spacing;
    scene.add(group);
    container.push(group);

    // Index number below
    const idxGeo = new TextGeometry(i.toString(), {
      font: globalFont,
      size: 0.3,
      height: 0.05,
    });
    idxGeo.computeBoundingBox();
    const idxWidth = idxGeo.boundingBox.max.x - idxGeo.boundingBox.min.x;
    const idxMesh = new THREE.Mesh(
      idxGeo,
      new THREE.MeshStandardMaterial({ color: textColor, opacity: 0.6, transparent: true })
    );
    idxMesh.position.set(group.position.x - idxWidth / 2, -1.2, 0);
    scene.add(idxMesh);
    indexMeshes.push(idxMesh);
  });

  // Adjust camera to fit
  const fov = camera.fov * (Math.PI / 180);
  const arrayWidth = array.length * spacing;
  let distance = Math.abs(arrayWidth / 2 / Math.tan(fov / 2)) + 2;
  gsap.to(camera.position, { z: Math.max(distance, 5), duration: 1, ease: "power2.out" });
  controls.target.set(0, 0, 0);
  setStatus(`Created array of ${array.length} elements`);
}

async function selectionSort() {
  if (isSorting) return;
  if (container.length === 0) {
    setStatus("Error: No cubes to sort!", false);
    return;
  }

  isSorting = true;
  let n = container.length;
  let comparisons = 0;
  let swaps = 0;

  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;

    // Highlight current front
    container[i].children[0].material.color.set(highlightColor);
    setStatus(`Phase ${i + 1}: Finding minimum for index ${i}...`, true);

    for (let j = i + 1; j < n; j++) {
      comparisons++;
      setStatus(`Comparing index ${minIdx} and ${j}...`, true);

      // Temporary highlight
      const originalJColor = container[j].userData.isSorted ? sortedColor : cubeColor;
      container[j].children[0].material.color.set(highlightColor);
      await sleep(getSpeed() * 500);

      if (parseInt(container[j].name) < parseInt(container[minIdx].name)) {
        // Reset old min color
        if (minIdx !== i) container[minIdx].children[0].material.color.set(cubeColor);
        minIdx = j;
        // Keep new min highlighted
        container[minIdx].children[0].material.color.set("#fbbf24"); // Amber for curr min
      } else {
        container[j].children[0].material.color.set(originalJColor);
      }
    }

    if (minIdx !== i) {
      swaps++;
      setStatus(`Found min ${container[minIdx].name} at index ${minIdx}. Swapping...`, true);
      await swapCubes(i, minIdx);
    }

    // Mark as sorted
    container[i].userData.isSorted = true;
    container[i].children[0].material.color.set(sortedColor);

    // Reset minIdx color if it wasn't swapped but was highlighted
    if (minIdx !== i) {
      container[minIdx].children[0].material.color.set(cubeColor);
    }
  }

  // Last element is sorted
  container[n - 1].userData.isSorted = true;
  container[n - 1].children[0].material.color.set(sortedColor);

  isSorting = false;
  setStatus(`Sorted! ${comparisons} comparisons, ${swaps} swaps.`, false);
}

async function swapCubes(i, j) {
  const duration = getSpeed();
  const obj1 = container[i];
  const obj2 = container[j];

  const pos1 = obj1.position.x;
  const pos2 = obj2.position.x;

  await gsap.timeline()
    .to(obj1.position, { y: 1.2, duration: duration / 2, ease: "power2.inOut" }, 0)
    .to(obj2.position, { y: -1.2, duration: duration / 2, ease: "power2.inOut" }, 0)
    .to(obj1.position, { x: pos2, duration: duration, ease: "power2.inOut" })
    .to(obj2.position, { x: pos1, duration: duration, ease: "power2.inOut" }, "-=" + duration)
    .to(obj1.position, { y: 0, duration: duration / 2, ease: "power2.inOut" })
    .to(obj2.position, { y: 0, duration: duration / 2, ease: "power2.inOut" }, "-=" + (duration / 2));

  // Swap in array
  [container[i], container[j]] = [container[j], container[i]];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Handlers ---
document.getElementById("myForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (isSorting) return;
  const val = document.getElementById("array").value;
  array = val.split(/[ ,]+/).filter(Boolean).map(Number).slice(0, 20); // max 20
  if (array.length === 0) setStatus("Please enter some numbers", false);
  else createCubes();
});

document.getElementById("animate").onclick = selectionSort;

document.getElementById("reset").onclick = () => {
  if (isSorting) return;
  container.forEach(g => scene.remove(g));
  indexMeshes.forEach(m => scene.remove(m));
  container = [];
  indexMeshes = [];
  array = [];
  document.getElementById("array").value = "";
  setStatus("Ready — enter numbers and click Create");
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
