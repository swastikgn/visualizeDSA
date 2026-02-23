import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import gsap from "gsap";

// --- State ---
let sceneBG = "#2e2e2e";
let nodeColor = "#ef4444";
let textColor = "#ffffff";
let lineColor = "#facc15";
let highlightColor = "#ffffff";
let visitedColor = "#22c55e";

let isSorting = false;
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
document.getElementById("node_color").addEventListener("input", (e) => {
  nodeColor = e.target.value;
  if (bst.root) bst.traverseNodes(bst.root, (node) => node.mesh.children[0].material.color.set(nodeColor));
});
document.getElementById("text_color").addEventListener("input", (e) => {
  textColor = e.target.value;
  if (bst.root) bst.traverseNodes(bst.root, (node) => node.mesh.children[1].material.color.set(textColor));
});
document.getElementById("line_color").addEventListener("input", (e) => {
  lineColor = e.target.value;
  if (bst.root) bst.traverseNodes(bst.root, (node) => {
    if (node.leftarrow) node.leftarrow.children[0].material.color.set(lineColor);
    if (node.rightarrow) node.rightarrow.children[0].material.color.set(lineColor);
  });
});

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(sceneBG);

const camera = new THREE.PerspectiveCamera(65, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 1000);
camera.position.set(0, 2, 12);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// Environment
new RGBELoader().load("/hdrr.hdr", (texture) => {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envMap = pmremGenerator.fromEquirectangular(texture).texture;
  scene.environment = envMap;
  texture.dispose();
  pmremGenerator.dispose();
});

const fontLoader = new FontLoader();
fontLoader.load("/helvetiker_regular.typeface.json", (f) => {
  globalFont = f;
});

// --- Node & Tree Logic ---
class Node {
  constructor(data) {
    this.data = data;
    this.left = null;
    this.right = null;
    this.leftarrow = null;
    this.rightarrow = null;
    this.mesh = this.createMesh(data);
  }

  createMesh(data) {
    const group = new THREE.Group();

    // Sphere representing node
    const geo = new THREE.SphereGeometry(0.7, 32, 32);
    const mat = new THREE.MeshStandardMaterial({ color: nodeColor, roughness: 0.3, metalness: 0.2 });
    const sphere = new THREE.Mesh(geo, mat);
    group.add(sphere);

    // Text on the node
    if (globalFont) {
      const textGeo = new TextGeometry(data.toString(), {
        font: globalFont,
        size: 0.4,
        height: 0.1,
      });
      textGeo.computeBoundingBox();
      const textW = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
      const textMat = new THREE.MeshStandardMaterial({ color: textColor });
      const textMesh = new THREE.Mesh(textGeo, textMat);
      textMesh.position.set(-textW / 2, -0.2, 0.6);
      group.add(textMesh);
    }

    scene.add(group);
    return group;
  }
}

class BinarySearchTree {
  constructor() {
    this.root = null;
    this.depth = 0;
  }

  insert(data) {
    if (this.root === null) {
      this.root = new Node(data);
      this.root.mesh.position.set(0, 4, 0);
      return true;
    } else {
      return this._insert(this.root, data, 1);
    }
  }

  _insert(node, data, currentDepth) {
    if (data === node.data) {
      return false; // Duplicate found
    }
    if (data < node.data) {
      if (node.left === null) {
        node.left = new Node(data);
        return true;
      } else {
        return this._insert(node.left, data, currentDepth + 1);
      }
    } else {
      if (node.right === null) {
        node.right = new Node(data);
        return true;
      } else {
        return this._insert(node.right, data, currentDepth + 1);
      }
    }
  }

  repositionAll() {
    const levels = this.getLevels(this.root);
    const maxDepth = levels.length;

    for (let y = 0; y < maxDepth; y++) {
      let p = Math.pow(2, maxDepth - y - 1);
      let py = 4 - 3 * y; // Start at Y=4, drop 3 units per level

      for (let x = 0; x < levels[y].length; x++) {
        const node = levels[y][x];
        if (!node) continue;

        // Find x index in a perfect binary tree
        let posInLevel = this.getNodePosition(this.root, node.data, 0, 0, Math.pow(2, y) - 1).xAtLevel;

        let px = 2 * (p / 2 + posInLevel * p - Math.pow(2, maxDepth - 2) - 0.5);

        gsap.to(node.mesh.position, {
          x: px,
          y: py,
          duration: 0.5,
          ease: "power2.out"
        });
      }
    }
  }

  getNodePosition(root, target, depth, xAtLevel, maxNodesAtLevel) {
    if (!root) return null;
    if (root.data === target) return { depth, xAtLevel };

    return this.getNodePosition(root.left, target, depth + 1, xAtLevel * 2, 0) ||
      this.getNodePosition(root.right, target, depth + 1, xAtLevel * 2 + 1, 0);
  }

  getLevels(root) {
    if (!root) return [];
    let result = [];
    let queue = [root];
    while (queue.length > 0) {
      let len = queue.length;
      let level = [];
      for (let i = 0; i < len; i++) {
        let node = queue.shift();
        level.push(node);
        if (node.left) queue.push(node.left);
        if (node.right) queue.push(node.right);
      }
      result.push(level);
    }
    return result;
  }

  updateConnections(node) {
    if (!node) return;

    if (node.left) {
      if (!node.leftarrow) {
        node.leftarrow = this.createArrow();
        scene.add(node.leftarrow);
      }
      this.orientArrow(node.leftarrow, node.mesh.position, node.left.mesh.position);
    }

    if (node.right) {
      if (!node.rightarrow) {
        node.rightarrow = this.createArrow();
        scene.add(node.rightarrow);
      }
      this.orientArrow(node.rightarrow, node.mesh.position, node.right.mesh.position);
    }

    this.updateConnections(node.left);
    this.updateConnections(node.right);
  }

  createArrow() {
    const group = new THREE.Group();
    // Cylinder for connection line
    const geo = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, 0.5);
    const mat = new THREE.MeshStandardMaterial({ color: lineColor });
    const line = new THREE.Mesh(geo, mat);
    group.add(line);
    return group;
  }

  orientArrow(arrow, start, end) {
    // We delay slightly to allow node reposition animations to progress if called immediately
    gsap.to({}, {
      duration: 0.5,
      onUpdate: () => {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const dz = end.z - start.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        arrow.position.copy(start);
        arrow.lookAt(end);
        arrow.scale.set(1, 1, dist);
      }
    });
  }

  traverseNodes(node, cb) {
    if (!node) return;
    cb(node);
    this.traverseNodes(node.left, cb);
    this.traverseNodes(node.right, cb);
  }

  async animateBfs() {
    if (isSorting || !this.root) return;
    isSorting = true;
    setStatus("Animating BFS Traversal...", true);

    let queue = [this.root];
    while (queue.length > 0) {
      let node = queue.shift();

      // Highlight
      await gsap.to(node.mesh.children[0].material.color, {
        r: new THREE.Color(highlightColor).r,
        g: new THREE.Color(highlightColor).g,
        b: new THREE.Color(highlightColor).b,
        duration: 0.3 * getSpeed()
      });

      await sleep(500 * getSpeed());

      // Mark as visited
      gsap.to(node.mesh.children[0].material.color, {
        r: new THREE.Color(visitedColor).r,
        g: new THREE.Color(visitedColor).g,
        b: new THREE.Color(visitedColor).b,
        duration: 0.3 * getSpeed()
      });

      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }

    setStatus("BFS Traversal Complete!");
    isSorting = false;
  }

  async animateDfs(node) {
    if (!node) return;

    // Visit current (Highlight)
    await gsap.to(node.mesh.children[0].material.color, {
      r: new THREE.Color(highlightColor).r,
      g: new THREE.Color(highlightColor).g,
      b: new THREE.Color(highlightColor).b,
      duration: 0.2 * getSpeed()
    });
    await sleep(300 * getSpeed());

    // Traverse Left
    await this.animateDfs(node.left);

    // Traverse Right
    await this.animateDfs(node.right);

    // Mark as visited
    gsap.to(node.mesh.children[0].material.color, {
      r: new THREE.Color(visitedColor).r,
      g: new THREE.Color(visitedColor).g,
      b: new THREE.Color(visitedColor).b,
      duration: 0.2 * getSpeed()
    });
  }

  resetColors(node) {
    if (!node) return;
    node.mesh.children[0].material.color.set(nodeColor);
    this.resetColors(node.left);
    this.resetColors(node.right);
  }
}

const bst = new BinarySearchTree();

// --- Handlers ---
document.getElementById("myForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const val = parseInt(document.getElementById("array").value);
  if (!isNaN(val)) {
    const success = bst.insert(val);
    if (success) {
      bst.repositionAll();
      bst.updateConnections(bst.root);
      document.getElementById("array").value = "";
      setStatus(`Inserted ${val} into the tree.`);
    } else {
      setStatus(`Value ${val} already exists in the tree!`, true);
    }
  }
});

document.getElementById("animate_bfs").onclick = () => bst.animateBfs();
document.getElementById("animate_dfs").onclick = async () => {
  if (isSorting || !bst.root) return;
  isSorting = true;
  setStatus("Animating DFS (Pre-order)...", true);
  await bst.animateDfs(bst.root);
  isSorting = false;
  setStatus("DFS Traversal Complete!");
};

document.getElementById("reset").onclick = () => {
  if (isSorting) return;
  bst.traverseNodes(bst.root, (node) => {
    scene.remove(node.mesh);
    if (node.leftarrow) scene.remove(node.leftarrow);
    if (node.rightarrow) scene.remove(node.rightarrow);
  });
  bst.root = null;
  setStatus("Tree cleared.");
};

// --- Loop & Resize ---
const animateLoop = () => {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animateLoop);
};
animateLoop();

const resizeObs = new ResizeObserver(() => {
  const w = canvasContainer.clientWidth;
  const h = canvasContainer.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});
resizeObs.observe(canvasContainer);
