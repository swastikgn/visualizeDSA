import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry";
import gsap from "gsap";

// --- State ---
let array = [];
let container = [];
let indexMeshes = [];
let isSorting = false;
let globalFont = null;

let sceneBG = "#2e2e2e";
let cubeColor = "#ef4444";
let highlightColor = "#ffffff";
let textColor = "#facc15";
let sortedColor = "#22c55e";

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
    return 1.1 - parseFloat(speedSlider.value);
}

// --- Listeners ---
document.getElementById("scene_background").addEventListener("input", (e) => {
    scene.background = new THREE.Color(e.target.value);
});
document.getElementById("cube_color").addEventListener("input", (e) => {
    cubeColor = e.target.value;
    container.forEach(g => { if (!g.userData.isSorted) g.children[0].material.color.set(cubeColor); });
});
document.getElementById("cube_change_color").addEventListener("input", (e) => highlightColor = e.target.value);
document.getElementById("text_color").addEventListener("input", (e) => {
    textColor = e.target.value;
    container.forEach(g => g.children[1].material.color.set(textColor));
    indexMeshes.forEach(m => m.material.color.set(textColor));
});
document.getElementById("sorted_color").addEventListener("input", (e) => sortedColor = e.target.value);

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(sceneBG);
const camera = new THREE.PerspectiveCamera(65, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 1000);
camera.position.set(0, 3, 10);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);
const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
grid.position.y = -1.5;
scene.add(grid);

const fontLoader = new FontLoader();
fontLoader.load("/helvetiker_regular.typeface.json", (f) => globalFont = f);

function createCubes() {
    if (!globalFont) { setTimeout(createCubes, 50); return; }
    container.forEach(g => scene.remove(g));
    indexMeshes.forEach(m => scene.remove(m));
    container = []; indexMeshes = [];

    const spacing = 1.3;
    const startX = -((array.length - 1) * spacing) / 2;

    array.forEach((val, i) => {
        const group = new THREE.Group();
        group.name = val.toString();
        group.userData = { id: i, isSorted: false };

        const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: cubeColor, roughness: 0.2, metalness: 0.5 }));
        group.add(cube);

        const textGeo = new TextGeometry(val.toString(), { font: globalFont, size: 0.4, height: 0.1 });
        textGeo.computeBoundingBox();
        const textWidth = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
        const textMesh = new THREE.Mesh(textGeo, new THREE.MeshStandardMaterial({ color: textColor }));
        textMesh.position.set(-textWidth / 2, -0.2, 0.51);
        group.add(textMesh);

        group.position.x = startX + i * spacing;
        scene.add(group);
        container.push(group);

        const idxGeo = new TextGeometry(i.toString(), { font: globalFont, size: 0.3, height: 0.05 });
        idxGeo.computeBoundingBox();
        const idxMesh = new THREE.Mesh(idxGeo, new THREE.MeshStandardMaterial({ color: textColor, opacity: 0.5, transparent: true }));
        idxMesh.position.set(group.position.x - (idxGeo.boundingBox.max.x - idxGeo.boundingBox.min.x) / 2, -1.2, 0);
        scene.add(idxMesh);
        indexMeshes.push(idxMesh);
    });

    const arrayWidth = array.length * spacing;
    const distance = Math.abs(arrayWidth / 2 / Math.tan((camera.fov * Math.PI / 180) / 2)) + 3;
    gsap.to(camera.position, { z: Math.max(distance, 6), duration: 1 });
    setStatus(`Created array of ${array.length} elements`);
}

async function mergeSortRecursive(start, end, depth = 0) {
    if (start >= end) return;

    const mid = Math.floor((start + end) / 2);
    const nextY = 6 - (depth + 1) * 2.5;

    // Visual Divide
    setStatus(`Dividing [${start}-${end}] at depth ${depth}...`, true);
    const tl = gsap.timeline();
    const duration = getSpeed() * 1.0;

    // Spread apart horizontally and move down
    const spreadOffset = (depth + 1) * 0.5;

    for (let i = start; i <= mid; i++) {
        tl.to(container[i].position, {
            y: nextY,
            x: container[i].position.x - spreadOffset,
            duration: duration,
            ease: "power2.inOut"
        }, 0);
    }
    for (let i = mid + 1; i <= end; i++) {
        tl.to(container[i].position, {
            y: nextY,
            x: container[i].position.x + spreadOffset,
            duration: duration,
            ease: "power2.inOut"
        }, 0);
    }
    await sleep(duration * 1000 + 100);

    await mergeSortRecursive(start, mid, depth + 1);
    await mergeSortRecursive(mid + 1, end, depth + 1);

    // Merge
    await mergeStep(start, mid, end, depth);
}

async function mergeStep(start, mid, end, depth) {
    const parentY = 6 - depth * 2.5;
    const spacing = 1.3;
    const arrayStartX = -((array.length - 1) * spacing) / 2;

    setStatus(`Merging subarrays back to level ${depth}...`, true);

    let left = container.slice(start, mid + 1);
    let right = container.slice(mid + 1, end + 1);
    let merged = [];

    let i = 0, j = 0;
    while (i < left.length || j < right.length) {
        let selected;
        if (i < left.length && (j >= right.length || parseInt(left[i].name) <= parseInt(right[j].name))) {
            selected = left[i];
            i++;
        } else {
            selected = right[j];
            j++;
        }

        merged.push(selected);
        const k = start + merged.length - 1;
        const targetX = arrayStartX + k * spacing;

        selected.children[0].material.color.set(highlightColor);
        await gsap.to(selected.position, {
            x: targetX,
            y: parentY,
            duration: getSpeed() * 0.8,
            ease: "power2.out"
        });
        selected.children[0].material.color.set(depth === 0 ? sortedColor : cubeColor);
        await sleep(getSpeed() * 200);
    }

    // Update global container reference for this range
    for (let idx = 0; idx < merged.length; idx++) {
        container[start + idx] = merged[idx];
    }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

document.getElementById("myForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (isSorting) return;
    const val = document.getElementById("array").value;
    array = val.split(/[ ,]+/).filter(Boolean).map(Number).slice(0, 8);
    createCubes();
});

document.getElementById("animate").onclick = async () => {
    if (isSorting || container.length === 0) return;
    isSorting = true;

    // Hide indices initially
    indexMeshes.forEach(m => gsap.to(m.material, { opacity: 0, duration: 0.3 }));

    // Reset positions to top
    container.forEach((g, i) => {
        g.position.y = 6;
        g.children[0].material.color.set(cubeColor);
    });

    await mergeSortRecursive(0, container.length - 1, 0);

    // Reposition and show indices
    const spacing = 1.3;
    const startX = -((array.length - 1) * spacing) / 2;
    indexMeshes.forEach((m, idx) => {
        m.position.x = startX + idx * spacing - 0.1; // adjust for text center
        m.position.y = 6 - 1.2;
        gsap.to(m.material, { opacity: 0.5, duration: 0.5 });
    });

    isSorting = false;
    setStatus("Merge Sort Complete!", false);
};

document.getElementById("reset").onclick = () => {
    if (isSorting) return;
    container.forEach(g => scene.remove(g));
    indexMeshes.forEach(m => scene.remove(m));
    container = []; indexMeshes = []; array = [];
    document.getElementById("array").value = "";
    setStatus("Ready — enter numbers and click Create");
};

const resizeObs = new ResizeObserver(() => {
    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    camera.aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
    camera.updateProjectionMatrix();
});
resizeObs.observe(canvasContainer);

function loop() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
}
loop();
