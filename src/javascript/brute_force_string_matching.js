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
let matchColor = "#22c55e";
let activeColor = "#f59e0b"; // Comparing

let textGroup = null;
let patternGroup = null;
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
  [textGroup, patternGroup].forEach(group => {
    if (group) {
      group.children.forEach(el => {
        if (!el.userData.isMatched) {
          el.children[0].material.color.set(cubeColor);
        }
      });
    }
  });
});
document.getElementById("text_color").addEventListener("input", (e) => {
  textColor = e.target.value;
  [textGroup, patternGroup].forEach(group => {
    if (group) {
      group.children.forEach(el => {
        el.children[1].material.color.set(textColor);
        if (el.children[2]) el.children[2].material.color.set(textColor);
      });
    }
  });
});
document.getElementById("match_color").addEventListener("input", (e) => {
  matchColor = e.target.value;
  [textGroup, patternGroup].forEach(group => {
    if (group) {
      group.children.forEach(el => {
        if (el.userData.isMatched) {
          el.children[0].material.color.set(matchColor);
        }
      });
    }
  });
});

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(sceneBG);

const camera = new THREE.PerspectiveCamera(60, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 1000);
camera.position.set(4, 1, 15);

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
});

function createElement(char, index, isPattern) {
  const group = new THREE.Group();

  // Cube geometry
  const geo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const mat = new THREE.MeshStandardMaterial({ color: cubeColor, roughness: 0.3, metalness: 0.3 });
  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);

  // Value
  const displayChar = char === " " ? "_" : char;
  const textGeo = new TextGeometry(displayChar, { font: globalFont, size: 0.6, height: 0.1 });
  textGeo.computeBoundingBox();
  const textW = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
  const textMat = new THREE.MeshStandardMaterial({ color: textColor });
  const textMesh = new THREE.Mesh(textGeo, textMat);
  textMesh.position.set(-textW / 2, -0.3, 0.61);
  group.add(textMesh);

  // Index (only for Text, not pattern)
  if (!isPattern) {
    const idxGeo = new TextGeometry(index.toString(), { font: globalFont, size: 0.3, height: 0.05 });
    idxGeo.computeBoundingBox();
    const idxW = idxGeo.boundingBox.max.x - idxGeo.boundingBox.min.x;
    const idxMesh = new THREE.Mesh(idxGeo, textMat);
    idxMesh.position.set(-idxW / 2, 0.8, 0); // Above the cube
    group.add(idxMesh);
  }

  group.userData = { char: char, isMatched: false };
  return group;
}

async function buildStrings(textStr, patternStr) {
  if (!globalFont || isAnimating) return;

  if (textGroup) scene.remove(textGroup);
  if (patternGroup) scene.remove(patternGroup);

  textGroup = new THREE.Group();
  patternGroup = new THREE.Group();

  // Center alignment offset
  const textStartX = -((textStr.length - 1) * 1.5) / 2;

  // Build Text (Top)
  for (let i = 0; i < textStr.length; i++) {
    const el = createElement(textStr[i], i, false);
    el.position.set(textStartX + i * 1.5, 1, 0);
    textGroup.add(el);
  }

  // Build Pattern (Bottom)
  for (let i = 0; i < patternStr.length; i++) {
    const el = createElement(patternStr[i], i, true);
    // Align pattern strictly under the first elements of text
    el.position.set(textStartX + i * 1.5, -1.5, 0);
    patternGroup.add(el);
  }

  scene.add(textGroup);
  scene.add(patternGroup);

  // Intro Anim
  const tl = gsap.timeline();
  tl.from(textGroup.position, { y: 5, opacity: 0, duration: 0.6, ease: "power2.out" });
  tl.from(patternGroup.position, { y: -5, opacity: 0, duration: 0.6, ease: "power2.out" }, "-=0.4");

  // Update camera target dynamically
  controls.target.set(0, 0, 0);

  setStatus(`Built scene. Ready to search for "${patternStr}".`);
}

function resetColors() {
  if (!textGroup || !patternGroup) return;
  textGroup.children.forEach(el => {
    el.userData.isMatched = false;
    el.children[0].material.color.set(cubeColor);
    el.children[0].material.emissiveIntensity = 0;
  });
  patternGroup.children.forEach(el => {
    el.userData.isMatched = false;
    el.children[0].material.color.set(cubeColor);
    el.children[0].material.emissiveIntensity = 0;
  });
}

async function animateMatch() {
  if (isAnimating || !textGroup || !patternGroup) return;

  const n = textGroup.children.length;
  const m = patternGroup.children.length;

  if (m === 0 || n === 0 || m > n) {
    setStatus("Invalid length: pattern is larger than text or empty.", true);
    return;
  }

  isAnimating = true;
  resetColors();

  const speed = getSpeed();
  const textStartX = textGroup.children[0].position.x; // Starting X of the string

  for (let i = 0; i <= n - m; i++) {
    setStatus(`Aligning pattern at index ${i}...`, true);

    // Slide Pattern Base Position
    const targetX = textStartX + (i * 1.5) - patternGroup.children[0].position.x; // calculate how much to shift the ENTIRE group

    await gsap.to(patternGroup.position, {
      x: i * 1.5,
      duration: 0.6 * speed,
      ease: "power2.inOut",
    });

    let j;
    for (j = 0; j < m; j++) {
      const textEl = textGroup.children[i + j];
      const patEl = patternGroup.children[j];

      setStatus(`Comparing Text['${textEl.userData.char}'] against Pattern['${patEl.userData.char}']...`, true);

      // Highlight comparing
      const highlightT = gsap.to(textEl.children[0].material.color, { r: new THREE.Color(activeColor).r, g: new THREE.Color(activeColor).g, b: new THREE.Color(activeColor).b, duration: 0.2 * speed });
      const highlightP = gsap.to(patEl.children[0].material.color, { r: new THREE.Color(activeColor).r, g: new THREE.Color(activeColor).g, b: new THREE.Color(activeColor).b, duration: 0.2 * speed });

      await Promise.all([highlightT, highlightP]);
      await sleep(300 * speed);

      if (textEl.userData.char !== patEl.userData.char) {
        setStatus(`Mismatch at index ${i + j}. Shifting pattern.`, true);

        // Flash Red (Error)
        gsap.to(textEl.children[0].material.color, { r: 1, g: 0.2, b: 0.2, duration: 0.3 });
        gsap.to(patEl.children[0].material.color, { r: 1, g: 0.2, b: 0.2, duration: 0.3 });
        await sleep(400 * speed);

        // Reset colors of all previously compared elements in this loop so we can shift cleanly
        for (let k = 0; k <= j; k++) {
          gsap.to(textGroup.children[i + k].children[0].material.color, { r: new THREE.Color(cubeColor).r, g: new THREE.Color(cubeColor).g, b: new THREE.Color(cubeColor).b, duration: 0.2 });
          gsap.to(patternGroup.children[k].children[0].material.color, { r: new THREE.Color(cubeColor).r, g: new THREE.Color(cubeColor).g, b: new THREE.Color(cubeColor).b, duration: 0.2 });
        }
        await sleep(200);
        break; // Break J loop
      } else {
        // Matched character
        setStatus(`Match! Checking next character.`, true);
        gsap.to(textEl.children[0].material.color, { r: new THREE.Color(matchColor).r, g: new THREE.Color(matchColor).g, b: new THREE.Color(matchColor).b, duration: 0.2 });
        gsap.to(patEl.children[0].material.color, { r: new THREE.Color(matchColor).r, g: new THREE.Color(matchColor).g, b: new THREE.Color(matchColor).b, duration: 0.2 });
      }
    }

    if (j === m) {
      // Full Match Found!
      for (let k = 0; k < m; k++) {
        textGroup.children[i + k].userData.isMatched = true;
        patternGroup.children[k].userData.isMatched = true;

        // Add a nice emissive glow
        textGroup.children[i + k].children[0].material.emissive = new THREE.Color(matchColor);
        textGroup.children[i + k].children[0].material.emissiveIntensity = 0.4;
        patternGroup.children[k].children[0].material.emissive = new THREE.Color(matchColor);
        patternGroup.children[k].children[0].material.emissiveIntensity = 0.4;

        // Bump animation
        gsap.to(textGroup.children[i + k].position, { y: 1.5, duration: 0.2, yoyo: true, repeat: 3, delay: k * 0.1 });
        gsap.to(patternGroup.children[k].position, { y: -1.0, duration: 0.2, yoyo: true, repeat: 3, delay: k * 0.1 });
      }

      setStatus(`Pattern fully matched starting at index ${i}! 🎉`);
      isAnimating = false;
      return i;
    }
  }

  setStatus(`Reached end. Pattern not found in Text.`, true);
  isAnimating = false;
  return -1;
}

// --- Handlers ---
document.getElementById("myForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (isAnimating) return;
  const textStr = document.getElementById("text").value;
  const patternStr = document.getElementById("pattern").value;
  if (textStr && patternStr) {
    buildStrings(textStr, patternStr);
  } else {
    setStatus("Please enter both text and pattern.", true);
  }
});

document.getElementById("animate").addEventListener("click", () => {
  if (isAnimating || !textGroup || !patternGroup) {
    if (!textGroup) setStatus("Please build the scene first.", true);
    return;
  }
  animateMatch();
});

document.getElementById("reset").addEventListener("click", () => {
  if (isAnimating) return;
  if (textGroup) scene.remove(textGroup);
  if (patternGroup) scene.remove(patternGroup);
  textGroup = null;
  patternGroup = null;
  document.getElementById("text").value = "";
  document.getElementById("pattern").value = "";
  setStatus("Scene cleared. Ready.");
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
