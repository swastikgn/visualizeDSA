import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import gsap from "gsap";

// --- State ---
const CAPACITY = 10;
const LEAK_RATE_MS = 1500; // Leak 1 request every 1.5 seconds

let queue = []; // Array of meshes representing requests in the bucket
let isAnimating = false;
let globalFont = null;
let leakInterval = null;
let fullTextMesh = null;

// Colors
let sceneBG = "#2e2e2e";
let waterColor = "#4488ff"; // representing requests - blue
let containerColor = "#4f46e5";

// DOM refs
const canvasContainer = document.getElementById("threed");
const canvas = document.getElementById("webgl");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const queueSizeSpan = document.getElementById("queue_size");

function setStatus(msg, animating = false) {
    statusText.textContent = msg;
    statusDot.className = animating ? "status-dot animating" : "status-dot";
}

function updateQueueCount() {
    if (queueSizeSpan) {
        queueSizeSpan.textContent = queue.length;
    }
    if (fullTextMesh) {
        fullTextMesh.visible = (queue.length >= CAPACITY);
        if (queue.length >= CAPACITY) {
            fullTextMesh.scale.set(0, 0, 0);
            gsap.to(fullTextMesh.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: "elastic.out(1, 0.5)" });
        }
    }
}

// --- Live Color Listeners ---
document.getElementById("scene_background").addEventListener("input", (e) => {
    scene.background = new THREE.Color(e.target.value);
});
document.getElementById("water_color").addEventListener("input", (e) => {
    waterColor = e.target.value;
    queue.forEach(group => {
        group.children[0].material.color.set(waterColor);
        group.children[0].material.emissive.set(waterColor);
    });
});
// container_color handles the outline/bucket color

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(sceneBG);

const camera = new THREE.PerspectiveCamera(60, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 1000);
camera.position.set(0, 5, 14);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 4, 0);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// Env
new RGBELoader().load("/hdrr.hdr", (texture) => {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromEquirectangular(texture).texture;
    texture.dispose();
    pmremGenerator.dispose();
});

// --- Bucket Geometry ---
const bucketMaterial = new THREE.LineBasicMaterial({ color: containerColor, transparent: true, opacity: 0.6, linewidth: 2 });
const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(2.4, CAPACITY * 0.8 + 0.2, 2.4));
const bucketBox = new THREE.LineSegments(edges, bucketMaterial);
bucketBox.position.set(0, (CAPACITY * 0.8 + 0.2) / 2, 0);
scene.add(bucketBox);

// Base plane (with a hole in it to represent leaking conceptually)
const planeGeo = new THREE.PlaneGeometry(6, 6);
const planeMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
const plane = new THREE.Mesh(planeGeo, planeMat);
plane.rotation.x = -Math.PI / 2;
scene.add(plane);

// Speed slider listener
document.getElementById("speedSlider").addEventListener("input", () => {
    queueNextLeak();
});


// --- Font & Initialization ---
const fontLoader = new FontLoader();
fontLoader.load("/helvetiker_regular.typeface.json", (font) => {
    globalFont = font;

    // Create 'FULL' text
    const textGeo = new TextGeometry("FULL", { font: globalFont, size: 0.5, height: 0.2 });
    textGeo.computeBoundingBox();
    const textW = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
    const textMat = new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff4444, emissiveIntensity: 0.6 });
    fullTextMesh = new THREE.Mesh(textGeo, textMat);
    fullTextMesh.position.set(-textW / 2, CAPACITY * 0.8 + 1.5, 0);
    fullTextMesh.visible = false;
    scene.add(fullTextMesh);

    queueNextLeak();
});

function createRequestMesh() {
    const group = new THREE.Group();
    // Use a cube for requests
    const geo = new THREE.BoxGeometry(1.6, 0.6, 1.6);
    const mat = new THREE.MeshStandardMaterial({
        color: waterColor,
        roughness: 0.1,
        metalness: 0.5,
        emissive: waterColor,
        emissiveIntensity: 0.3
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    return group;
}

// ------------------------------------
// Core Logic
// ------------------------------------
function queueNextLeak() {
    if (leakInterval) clearTimeout(leakInterval);

    const speed = parseFloat(document.getElementById("speedSlider").value);
    const delay = LEAK_RATE_MS / speed;

    leakInterval = setTimeout(() => {
        leakOneRequest();
        queueNextLeak();
    }, delay);
}

function leakOneRequest() {
    if (queue.length === 0) return; // Nothing to leak

    const req = queue.shift(); // Remove from bottom of bucket

    // Fly it out towards bottom right
    gsap.to(req.position, {
        x: 4,
        y: -3,
        z: 0,
        duration: 0.8,
        ease: "power2.in"
    });

    gsap.to(req.scale, { x: 0, y: 0, z: 0, duration: 0.4, delay: 0.4 });
    setTimeout(() => scene.remove(req), 800);

    // Shift the remaining queue elements down physically
    queue.forEach((item, index) => {
        const targetY = index * 0.8 + 0.4;
        gsap.to(item.position, {
            y: targetY,
            duration: 0.4,
            ease: "bounce.out"
        });
    });

    updateQueueCount();
}

function animateRejectedRequests(amount, startIdx) {
    for (let i = 0; i < amount; i++) {
        const group = new THREE.Group();
        // Red box for rejected
        const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xff4444,
            roughness: 0.2,
            metalness: 0.3,
            emissive: 0xff0000,
            emissiveIntensity: 0.4
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        group.add(mesh);

        // Spawn coming in from the top left
        group.position.set(-6 - (i + startIdx), CAPACITY * 0.8 + 4 + i, 0);
        scene.add(group);

        const tl = gsap.timeline({ onComplete: () => scene.remove(group) });
        // Fly towards bucket top
        tl.to(group.position, { x: -1, y: CAPACITY * 0.8 + 0.5, duration: 0.3, ease: "power2.in" });
        // Smack bucket top rim and bounce away
        tl.to(group.position, { x: -3 - Math.random() * 2, y: -2, z: Math.random() * 4, duration: 0.6, ease: "power1.in" });
        tl.to(group.scale, { x: 0, y: 0, z: 0, duration: 0.2 }, "-=0.2");

        gsap.to(mesh.rotation, { x: "+=5", y: "+=5", duration: 0.9 });
    }
}

function sendRequest(amount) {
    if (!globalFont) return;
    setStatus(`Receiving ${amount} requests...`, true);

    let accepted = 0;
    let rejected = 0;

    for (let i = 0; i < amount; i++) {
        if (queue.length < CAPACITY) {
            // Accept request
            const req = createRequestMesh();
            // Start it falling from top left
            req.position.set(-5 - i, CAPACITY * 0.8 + 5 + i, 0);
            scene.add(req);

            const targetY = queue.length * 0.8 + 0.4;
            queue.push(req);

            gsap.to(req.position, {
                x: 0,
                y: targetY,
                duration: 0.6 + i * 0.1,
                ease: "bounce.out"
            });
            accepted++;
        } else {
            // Reject request (Bucket Full)
            rejected++;
        }
    }

    if (rejected > 0) {
        // Flash bucket
        gsap.to(bucketMaterial.color, { r: 1, g: 0.2, b: 0.2, duration: 0.2, yoyo: true, repeat: 3 });
        setTimeout(() => { bucketMaterial.color.set(containerColor); }, 1000);

        animateRejectedRequests(rejected, accepted);
    }

    updateQueueCount();

    if (rejected > 0 && accepted === 0) {
        setStatus(`Bucket Full! ${rejected} request(s) dropped.`, true);
    } else if (rejected > 0) {
        setStatus(`Partially Accepted: ${accepted} queued, ${rejected} dropped.`, true);
    } else {
        setStatus(`All ${amount} requests successfully queued.`);
    }

    setTimeout(() => {
        setStatus(`Ready — requests leak continuously. Queue: ${queue.length}/${CAPACITY}`);
    }, 2500);
}


// --- Handlers ---
document.getElementById("send_request").onclick = () => {
    sendRequest(1);
};

document.getElementById("send_requests").onclick = () => {
    sendRequest(5);
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
