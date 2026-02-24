import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry";
import gsap from "gsap";

// --- State ---
let array = [];
let container = [];
let indexMeshes = [];
let isSorting = false;
let globalFont = null;

let sceneBG = "#2e2e2e";
let cubeColor = "#ef4444";
let pivotColor = "#facc15";
let sortedColor = "#22c55e";
let textColor = "#ffffff";
let pointerColor = "#3b82f6"; // Scanner j
let boundaryColor = "#6366f1"; // Boundary i

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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- Listeners ---
document.getElementById("scene_background").addEventListener("input", (e) => {
    scene.background = new THREE.Color(e.target.value);
});
document.getElementById("cube_color").addEventListener("input", (e) => {
    cubeColor = e.target.value;
    container.forEach(g => {
        if (!g.userData.isSorted) g.children[0].material.color.set(cubeColor);
    });
});
document.getElementById("pivot_color").addEventListener("input", (e) => pivotColor = e.target.value);
document.getElementById("sorted_color").addEventListener("input", (e) => {
    sortedColor = e.target.value;
    container.forEach(g => {
        if (g.userData.isSorted) g.children[0].material.color.set(sortedColor);
    });
});

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(sceneBG);
const camera = new THREE.PerspectiveCamera(60, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 1000);
camera.position.set(0, 5, 12);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
grid.position.y = -1.5;
scene.add(grid);

// Environment
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
new RGBELoader().load("/hdrr.hdr", (texture) => {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromEquirectangular(texture).texture;
    texture.dispose();
    pmremGenerator.dispose();
});

const fontLoader = new FontLoader();
fontLoader.load("/helvetiker_regular.typeface.json", (f) => globalFont = f);

function createCubes() {
    if (!globalFont) return;
    container.forEach(g => scene.remove(g));
    indexMeshes.forEach(m => scene.remove(m));
    container = [];
    indexMeshes = [];

    const spacing = 1.3;
    const startX = -((array.length - 1) * spacing) / 2;

    array.forEach((val, i) => {
        const group = new THREE.Group();
        group.name = val.toString();
        group.userData = { initialIdx: i, isSorted: false };

        const cube = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({ color: cubeColor, roughness: 0.3, metalness: 0.4 })
        );
        group.add(cube);

        const textGeo = new TextGeometry(val.toString(), { font: globalFont, size: 0.4, height: 0.1 });
        textGeo.computeBoundingBox();
        const textW = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
        const textMesh = new THREE.Mesh(textGeo, new THREE.MeshStandardMaterial({ color: textColor }));
        textMesh.position.set(-textW / 2, -0.2, 0.51);
        group.add(textMesh);

        group.position.x = startX + i * spacing;
        group.position.y = 0;
        scene.add(group);
        container.push(group);

        // Add Index Mesh
        const idxGeo = new TextGeometry(i.toString(), { font: globalFont, size: 0.3, height: 0.05 });
        idxGeo.computeBoundingBox();
        const idxW = idxGeo.boundingBox.max.x - idxGeo.boundingBox.min.x;
        const idxMesh = new THREE.Mesh(idxGeo, new THREE.MeshStandardMaterial({ color: textColor, opacity: 0.5, transparent: true }));
        idxMesh.position.set(startX + i * spacing - idxW / 2, -1.2, 0);
        scene.add(idxMesh);
        indexMeshes.push(idxMesh);
    });
    setStatus(`Created array of ${array.length} elements.`);
}

async function swapVisually(idx1, idx2) {
    if (idx1 === idx2) return;
    const g1 = container[idx1];
    const g2 = container[idx2];

    const pos1 = g1.position.x;
    const pos2 = g2.position.x;

    const duration = getSpeed() * 0.6;

    // Arched swap
    await Promise.all([
        gsap.to(g1.position, { x: pos2, z: 1, duration: duration, ease: "power2.inOut" }),
        gsap.to(g2.position, { x: pos1, z: -1, duration: duration, ease: "power2.inOut" })
    ]);

    // Reset Z
    gsap.to(g1.position, { z: 0, duration: 0.1 });
    gsap.to(g2.position, { z: 0, duration: 0.1 });

    // Swap in array
    [container[idx1], container[idx2]] = [container[idx2], container[idx1]];
}

async function partition(low, high, depth) {
    const pivot = container[high];
    const pivotVal = parseInt(pivot.name);

    // Highlight Pivot
    pivot.children[0].material.color.set(pivotColor);
    setStatus(`Partitioning [${low}-${high}] | Pivot: ${pivotVal}`, true);
    await sleep(getSpeed() * 600);

    let i = low - 1;
    for (let j = low; j < high; j++) {
        const scanner = container[j];

        // Highlight scanner
        scanner.children[0].material.emissive.set(pointerColor);
        scanner.children[0].material.emissiveIntensity = 0.5;

        await sleep(getSpeed() * 400);

        if (parseInt(scanner.name) < pivotVal) {
            i++;
            // Highlight boundary
            const boundary = container[i];
            boundary.children[0].material.emissive.set(boundaryColor);
            boundary.children[0].material.emissiveIntensity = 0.5;

            await sleep(getSpeed() * 200);
            await swapVisually(i, j);

            // Cleanup boundary highlight after swap
            container[i].children[0].material.emissiveIntensity = 0;
        }

        // Cleanup scanner highlight
        scanner.children[0].material.emissiveIntensity = 0;
    }

    // Final pivot swap
    await swapVisually(i + 1, high);

    // Mark pivot as sorted
    const finalPivotPos = container[i + 1];
    finalPivotPos.children[0].material.color.set(sortedColor);
    finalPivotPos.children[0].material.emissiveIntensity = 0;
    finalPivotPos.userData.isSorted = true;

    return i + 1;
}

async function quickSortRecursive(low, high, depth = 0) {
    if (low <= high) {
        // Move active range down to show recursion level
        const targetY = -depth * 1.5;
        const anims = [];
        for (let idx = low; idx <= high; idx++) {
            if (!container[idx].userData.isSorted) {
                anims.push(gsap.to(container[idx].position, { y: targetY, duration: 0.5 }));
            }
        }
        await Promise.all(anims);

        if (low < high) {
            let pi = await partition(low, high, depth);
            await quickSortRecursive(low, pi - 1, depth + 1);
            await quickSortRecursive(pi + 1, high, depth + 1);
        } else {
            // Single element is sorted
            container[low].children[0].material.color.set(sortedColor);
            container[low].userData.isSorted = true;
        }

        // Move back up after returning from recursion
        const returnAnims = [];
        for (let idx = low; idx <= high; idx++) {
            returnAnims.push(gsap.to(container[idx].position, { y: 0, duration: 0.5 }));
        }
        await Promise.all(returnAnims);
    }
}

document.getElementById("myForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (isSorting) return;
    const val = document.getElementById("array").value;
    array = val.split(/[ ,]+/).filter(Boolean).map(Number).slice(0, 12);
    createCubes();
});

document.getElementById("animate").onclick = async () => {
    if (isSorting || container.length === 0) return;
    isSorting = true;

    // Reset colors
    container.forEach(g => {
        g.children[0].material.color.set(cubeColor);
        g.userData.isSorted = false;
    });

    await quickSortRecursive(0, container.length - 1);

    setStatus("Quick Sort Complete!", false);
    container.forEach(g => g.children[0].material.color.set(sortedColor));
    isSorting = false;
};

document.getElementById("reset").onclick = () => {
    if (isSorting) return;
    container.forEach(g => scene.remove(g));
    indexMeshes.forEach(m => scene.remove(m));
    container = []; indexMeshes = []; array = [];
    document.getElementById("array").value = "";
    setStatus("Ready — enter numbers and click Create");
};

// --- Loop & Resize ---
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
