import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import gsap from "gsap";

// --- State ---
let nodes = []; // { group, value }
let arrows = []; // { mesh, start, end, offsetY, startOff, endOff }
let nullMarkers = { head: null, tail: null };
let isAnimating = false;
let globalFont = null;
let activeLabels = [];

const SPACING = 4.5;
const NODE_COLOR = "#6366f1";
const NEXT_ARROW_COLOR = "#a855f7";
const PREV_ARROW_COLOR = "#ec4899";
const TEXT_COLOR = "#ffffff";
const HIGHLIGHT_COLOR = "#facc15";

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

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color("#050505");
const camera = new THREE.PerspectiveCamera(60, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 1000);
camera.position.set(0, 6, 22);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

const grid = new THREE.GridHelper(60, 60, 0x222222, 0x111111);
grid.position.y = -2;
scene.add(grid);

new RGBELoader().load("/hdrr.hdr", (texture) => {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromEquirectangular(texture).texture;
    texture.dispose();
    pmremGenerator.dispose();
});

const fontLoader = new FontLoader();
fontLoader.load("/helvetiker_regular.typeface.json", (f) => {
    globalFont = f;
    initNullMarkers();
});

// --- Helpers ---
function createNodeMesh(value) {
    const group = new THREE.Group();
    const geo = new THREE.BoxGeometry(2, 1.2, 0.8);
    const mat = new THREE.MeshStandardMaterial({ color: NODE_COLOR, roughness: 0.2, metalness: 0.3 });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    if (globalFont) {
        const textGeo = new TextGeometry(value.toString(), { font: globalFont, size: 0.5, height: 0.1 });
        textGeo.computeBoundingBox();
        const textMesh = new THREE.Mesh(textGeo, new THREE.MeshStandardMaterial({ color: TEXT_COLOR }));
        const w = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
        textMesh.position.set(-w / 2, -0.25, 0.41);
        group.add(textMesh);
    }
    return group;
}

function createArrowMesh(color) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2 });
    const inner = new THREE.Group();
    group.add(inner);

    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 8), mat);
    cyl.rotation.z = Math.PI / 2;
    cyl.position.x = 0.5;
    inner.add(cyl);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8), mat);
    tip.rotation.z = -Math.PI / 2;
    tip.position.set(1, 0, 0);
    inner.add(tip);

    group.update = (start, end, sOff, eOff) => {
        const dir = new THREE.Vector3().subVectors(end, start);
        const fullLen = dir.length();
        if (fullLen < 0.1) { group.visible = false; return; }
        group.visible = true;

        const norm = dir.clone().normalize();
        const sPoint = start.clone().add(norm.clone().multiplyScalar(sOff));
        const ePoint = end.clone().sub(norm.clone().multiplyScalar(eOff));
        const finalDir = new THREE.Vector3().subVectors(ePoint, sPoint);
        const finalLen = finalDir.length();

        group.position.copy(sPoint);
        inner.rotation.z = Math.atan2(finalDir.y, finalDir.x);
        inner.rotation.y = -Math.atan2(finalDir.z, new THREE.Vector2(finalDir.x, finalDir.y).length());
        inner.scale.set(Math.max(0.01, finalLen), 1, 1);
    };

    scene.add(group);
    return group;
}

function createLabel(text, nodeGroup) {
    if (!globalFont) return null;
    const group = new THREE.Group();
    const textGeo = new TextGeometry(text, { font: globalFont, size: 0.3, height: 0.05 });
    textGeo.computeBoundingBox();
    const textMesh = new THREE.Mesh(textGeo, new THREE.MeshStandardMaterial({ color: HIGHLIGHT_COLOR }));
    const w = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
    textMesh.position.set(-w / 2, 0.9, 0);
    group.add(textMesh);

    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 8), new THREE.MeshStandardMaterial({ color: HIGHLIGHT_COLOR }));
    cone.position.set(0, 0.7, 0);
    cone.rotation.x = Math.PI;
    group.add(cone);

    scene.add(group);
    activeLabels.push({ group, target: nodeGroup });
    return group;
}

function clearLabels() {
    activeLabels.forEach(l => scene.remove(l.group));
    activeLabels = [];
}

function initNullMarkers() {
    const createM = (name) => {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), new THREE.MeshStandardMaterial({ color: "#ea4335", emissive: "#ea4335", emissiveIntensity: 0.5 })));
        if (globalFont) {
            const tGeo = new TextGeometry(name, { font: globalFont, size: 0.25, height: 0.05 });
            const tm = new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({ color: "#ea4335" }));
            tm.position.set(-0.3, -0.6, 0);
            g.add(tm);
        }
        scene.add(g);
        return g;
    };
    nullMarkers.head = createM("NULL");
    nullMarkers.tail = createM("NULL");
    updatePositions(0);
}

function updatePositions(duration = 0.5) {
    const startX = -((nodes.length - 1) * SPACING) / 2;
    nodes.forEach((n, i) => {
        gsap.to(n.group.position, { x: startX + i * SPACING, y: 0, z: 0, duration, ease: "power2.inOut" });
    });

    if (nullMarkers.head) {
        const headX = (nodes.length === 0) ? -2.5 : startX - SPACING * 0.8;
        gsap.to(nullMarkers.head.position, { x: headX, y: 0, z: 0, duration, ease: "power2.inOut" });
    }
    if (nullMarkers.tail) {
        const tailX = (nodes.length === 0) ? 2.5 : startX + (nodes.length - 1 + 0.8) * SPACING;
        gsap.to(nullMarkers.tail.position, { x: tailX, y: 0, z: 0, duration, ease: "power2.inOut" });
    }
}

function refreshArrows() {
    arrows.forEach(a => scene.remove(a.mesh));
    arrows = [];
    if (nodes.length === 0) return;

    // Head Prev -> Null
    arrows.push({ mesh: createArrowMesh(PREV_ARROW_COLOR), start: nodes[0].group, end: nullMarkers.head, offsetY: -0.2, sOff: 1.0, eOff: 0.3 });

    for (let i = 0; i < nodes.length; i++) {
        // Next Pointers
        if (i < nodes.length - 1) {
            arrows.push({ mesh: createArrowMesh(NEXT_ARROW_COLOR), start: nodes[i].group, end: nodes[i + 1].group, offsetY: 0.2, sOff: 1.0, eOff: 1.0 });
        } else {
            arrows.push({ mesh: createArrowMesh(NEXT_ARROW_COLOR), start: nodes[i].group, end: nullMarkers.tail, offsetY: 0.2, sOff: 1.0, eOff: 0.3 });
        }
        // Prev Pointers
        if (i > 0) {
            arrows.push({ mesh: createArrowMesh(PREV_ARROW_COLOR), start: nodes[i].group, end: nodes[i - 1].group, offsetY: -0.2, sOff: 1.0, eOff: 1.0 });
        }
    }
}

// --- Ops ---
async function addAtHead(val) {
    if (isAnimating || !globalFont) return; isAnimating = true;
    setStatus(`Adding ${val} at head...`, true);
    const n = { group: createNodeMesh(val), value: val };
    n.group.position.set(-8, 6, 0);
    scene.add(n.group);
    nodes.unshift(n);
    updatePositions(0.8 * getSpeed());
    refreshArrows();
    await sleep(800 * getSpeed());
    isAnimating = false; setStatus(`Head is ${val}.`);
}

async function addAtTail(val) {
    if (isAnimating || !globalFont) return; isAnimating = true;
    setStatus(`Adding ${val} at tail...`, true);
    const n = { group: createNodeMesh(val), value: val };
    n.group.position.set(8, 6, 0);
    scene.add(n.group);
    nodes.push(n);
    updatePositions(0.8 * getSpeed());
    refreshArrows();
    await sleep(800 * getSpeed());
    isAnimating = false; setStatus(`Added ${val} to tail.`);
}

async function addAtIndex(idx, val) {
    if (isAnimating || !globalFont) return;
    if (idx < 0 || idx > nodes.length) { setStatus("Invalid index!", true); return; }
    if (idx === 0) return addAtHead(val);
    if (idx === nodes.length) return addAtTail(val);

    isAnimating = true;
    setStatus(`Inserting ${val} at index ${idx}...`, true);
    for (let i = 0; i < idx; i++) {
        const mat = nodes[i].group.children[0].material;
        mat.emissive.set(HIGHLIGHT_COLOR); mat.emissiveIntensity = 0.5;
        await sleep(350 * getSpeed());
        mat.emissiveIntensity = 0;
    }
    const n = { group: createNodeMesh(val), value: val };
    n.group.position.set(0, -6, 0);
    scene.add(n.group);
    nodes.splice(idx, 0, n);
    updatePositions(0.8 * getSpeed());
    refreshArrows();
    await sleep(800 * getSpeed());
    isAnimating = false; setStatus(`Inserted ${val} at ${idx}.`);
}

async function remove(idx) {
    if (isAnimating || !globalFont || nodes.length === 0) return;
    if (idx < 0 || idx >= nodes.length) { setStatus("Invalid index!", true); return; }
    isAnimating = true;

    setStatus(`Traversing to Node ${idx}...`, true);
    // 1. Traverse
    for (let i = 0; i <= idx; i++) {
        const mat = nodes[i].group.children[0].material;
        mat.emissive.set(HIGHLIGHT_COLOR);
        mat.emissiveIntensity = 0.5;
        await sleep(400 * getSpeed());
        if (i < idx) mat.emissiveIntensity = 0;
    }

    const tempNode = nodes[idx];
    createLabel("temp", tempNode.group);
    setStatus("Marking target as 'temp'...", true);
    await sleep(600 * getSpeed());

    // 2. Move temp out of the way
    setStatus("Isolating 'temp' node...", true);
    await gsap.to(tempNode.group.position, { y: -2, duration: 0.6 * getSpeed(), ease: "power2.inOut" });
    await sleep(400 * getSpeed());

    // 3. Re-route pointers
    setStatus("Re-routing pointers around 'temp'...", true);
    // We already have refreshArrows() but we need to bypass tempNode conceptually.
    // To do this visually, we can temporarily remove tempNode from the array and refresh.
    nodes.splice(idx, 1);
    refreshArrows();
    await sleep(800 * getSpeed());

    // 4. Fade out and remove
    setStatus("Finalizing deletion...", true);
    await gsap.to(tempNode.group.position, { y: -6, opacity: 0, duration: 0.5 * getSpeed(), ease: "power2.in" });
    scene.remove(tempNode.group);
    clearLabels();

    updatePositions(0.6 * getSpeed());
    await sleep(600 * getSpeed());

    isAnimating = false;
    setStatus("Node removed successfully.");
}

// --- Events ---
document.getElementById("add-head").onclick = () => addAtHead(document.getElementById("value-input").value || Math.floor(Math.random() * 99));
document.getElementById("add-tail").onclick = () => addAtTail(document.getElementById("value-input").value || Math.floor(Math.random() * 99));
document.getElementById("add-index").onclick = () => addAtIndex(parseInt(document.getElementById("index-input").value) || 0, document.getElementById("value-input").value || Math.floor(Math.random() * 99));
document.getElementById("remove-head").onclick = () => remove(0);
document.getElementById("remove-tail").onclick = () => remove(nodes.length - 1);
document.getElementById("remove-index").onclick = () => remove(parseInt(document.getElementById("index-input").value) || 0);
document.getElementById("clear-list").onclick = () => {
    if (isAnimating) return;
    nodes.forEach(n => scene.remove(n.group));
    nodes = [];
    clearLabels();
    refreshArrows();
    updatePositions(0);
    setStatus("List cleared.");
};

// --- Loop ---
function animate() {
    controls.update();
    arrows.forEach(a => {
        const s = a.start.position.clone().add(new THREE.Vector3(0, a.offsetY, 0));
        const e = a.end.position.clone().add(new THREE.Vector3(0, a.offsetY, 0));
        a.mesh.update(s, e, a.sOff, a.eOff);
    });
    activeLabels.forEach(l => {
        l.group.position.copy(l.target.position);
    });
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
animate();

window.addEventListener("resize", () => {
    camera.aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
});
