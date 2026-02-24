import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import gsap from "gsap";

// --- State ---
const CAPACITY = 10;
const REFILL_RATE_MS = 1500; // Refill 1 token every 1.5 seconds

let tokens = []; // Array of meshes
let isAnimating = false;
let globalFont = null;
let refillInterval = null;
let lastDropTime = 0;

// Colors
let sceneBG = "#2e2e2e";
let tokenColor = "#48c78e";
let containerColor = "#4f46e5";

// DOM refs
const canvasContainer = document.getElementById("threed");
const canvas = document.getElementById("webgl");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const tokenCountSpan = document.getElementById("token_count");

function setStatus(msg, animating = false) {
    statusText.textContent = msg;
    statusDot.className = animating ? "status-dot animating" : "status-dot";
}

function updateTokenCount() {
    if (tokenCountSpan) {
        tokenCountSpan.textContent = tokens.length;
    }
}

// --- Live Color Listeners ---
document.getElementById("scene_background").addEventListener("input", (e) => {
    scene.background = new THREE.Color(e.target.value);
});
document.getElementById("token_color").addEventListener("input", (e) => {
    tokenColor = e.target.value;
    tokens.forEach(group => {
        group.children[0].material.color.set(tokenColor);
        group.children[0].material.emissive.set(tokenColor);
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
// We will draw a simple 3D outline box to represent the bucket
const bucketMaterial = new THREE.LineBasicMaterial({ color: containerColor, transparent: true, opacity: 0.6, linewidth: 2 });
const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(2.4, CAPACITY * 0.8 + 0.2, 2.4));
const bucketBox = new THREE.LineSegments(edges, bucketMaterial);
// Shift it up so its base is at y=0
bucketBox.position.set(0, (CAPACITY * 0.8 + 0.2) / 2, 0);
scene.add(bucketBox);

// Base plane
const planeGeo = new THREE.PlaneGeometry(3, 3);
const planeMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
const plane = new THREE.Mesh(planeGeo, planeMat);
plane.rotation.x = -Math.PI / 2;
scene.add(plane);

// Speed slider listener
document.getElementById("speedSlider").addEventListener("input", () => {
    queueNextRefill();
});


// --- Font & Initialization ---
const fontLoader = new FontLoader();
fontLoader.load("/helvetiker_regular.typeface.json", (font) => {
    globalFont = font;

    queueNextRefill();
    // Pre-fill a few tokens with a slight stagger
    setTimeout(() => addToken(), 100);
    setTimeout(() => addToken(), 600);
    setTimeout(() => addToken(), 1100);
});

function createTokenMesh() {
    const group = new THREE.Group();

    // Use a nice disc/cylinder for a "Token"
    const geo = new THREE.CylinderGeometry(0.8, 0.8, 0.4, 32);
    const mat = new THREE.MeshStandardMaterial({
        color: tokenColor,
        roughness: 0.1,
        metalness: 0.5,
        emissive: tokenColor,
        emissiveIntensity: 0.3
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    return group;
}

// ------------------------------------
// Core Logic
// ------------------------------------
function queueNextRefill() {
    if (refillInterval) clearTimeout(refillInterval);

    const speed = parseFloat(document.getElementById("speedSlider").value);
    const delay = REFILL_RATE_MS / speed;

    refillInterval = setTimeout(() => {
        // Only refill if we aren't at capacity and no tokens are currently mid-drop in the last 0.5s
        // to prevent overlapping animations.
        if (tokens.length < CAPACITY) {
            addToken();
        }
        queueNextRefill();
    }, delay);
}

function addToken() {
    const now = Date.now();
    // Ensure at least 300ms between any two token drops to prevent visual clumping
    if (now - lastDropTime < 300) {
        setTimeout(addToken, 300 - (now - lastDropTime));
        return;
    }
    lastDropTime = now;

    if (tokens.length >= CAPACITY) return;

    const token = createTokenMesh();

    // Start way above the bucket with slight spatial jitter
    token.position.set((Math.random() - 0.5) * 0.2, CAPACITY * 0.8 + 5, (Math.random() - 0.5) * 0.2);
    scene.add(token);
    tokens.push(token);

    updateTokenCount();

    // Drop animation
    const targetY = (tokens.length - 1) * 0.8 + 0.4; // Stack them up inside the bucket

    gsap.to(token.position, {
        y: targetY,
        x: 0,
        z: 0,
        duration: 0.6 + Math.random() * 0.2,
        ease: "bounce.out"
    });
}

function animateRejectedRequests(amount, startIndex = 0) {
    for (let i = 0; i < amount; i++) {
        const group = new THREE.Group();
        // A red cube to represent an invalid/rejected request packet
        const geo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xff4444,
            roughness: 0.2,
            metalness: 0.3,
            emissive: 0xff0000,
            emissiveIntensity: 0.2
        });
        const mesh = new THREE.Mesh(geo, mat);
        // Random spin
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        group.add(mesh);

        // Spawn coming in from the left
        group.position.set(-8, 3 + ((i + startIndex) * 1.5), 2);
        scene.add(group);

        const tl = gsap.timeline({ onComplete: () => scene.remove(group) });
        // Fly towards the bucket
        tl.to(group.position, { x: -1.5, z: 0, duration: 0.3, ease: "power2.in" });
        // Smack into the invisible forcefield / bucket and bounce down and away
        tl.to(group.position, { x: -3 - Math.random() * 2, y: -5, z: 4 + Math.random() * 2, duration: 0.5, ease: "power1.in" });
        // Shrink away at the very end
        tl.to(group.scale, { x: 0, y: 0, z: 0, duration: 0.2 }, "-=0.2");

        // Spin while bouncing away
        gsap.to(mesh.rotation, { x: "+=5", y: "+=5", duration: 0.8 });
    }
}

function animateSuccessfulRequests(amount, startIndex = 0) {
    for (let i = 0; i < amount; i++) {
        const group = new THREE.Group();
        // A blue cube to represent a valid/accepted request packet
        const geo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x4488ff,
            roughness: 0.2,
            metalness: 0.3,
            emissive: 0x0044ff,
            emissiveIntensity: 0.2
        });
        const mesh = new THREE.Mesh(geo, mat);
        // Random spin
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        group.add(mesh);

        // Spawn coming in from the left
        group.position.set(-8, 3 + ((i + startIndex) * 1.5), 2);
        scene.add(group);

        const tl = gsap.timeline({ onComplete: () => scene.remove(group) });
        // Fly towards the bucket
        tl.to(group.position, { x: 0, y: 3, z: 0, duration: 0.3, ease: "power2.out" });
        // Fly out to the right (success)
        tl.to(group.position, { x: 8, y: 4 + ((i + startIndex) * 0.5), z: 2, duration: 0.5, ease: "power2.in" });
        // Shrink away at the very end
        tl.to(group.scale, { x: 0, y: 0, z: 0, duration: 0.2 }, "-=0.2");

        // Spin nicely
        gsap.to(mesh.rotation, { x: "+=5", y: "+=5", duration: 0.8 });
    }
}

function sendRequest(amount) {
    if (!globalFont) return;

    const acceptedCount = Math.min(amount, tokens.length);
    const rejectedCount = amount - acceptedCount;

    if (rejectedCount > 0) {
        if (acceptedCount === 0) {
            setStatus(`Rate Limited! Need ${amount} token(s) but bucket is empty.`, true);
        } else {
            setStatus(`${acceptedCount} request(s) sent, ${rejectedCount} rate limited.`, true);
        }

        // Flash the bucket box to indicate some denial
        gsap.to(bucketMaterial.color, { r: 1, g: 0.2, b: 0.2, duration: 0.2, yoyo: true, repeat: 3 });
        setTimeout(() => {
            bucketMaterial.color.set(containerColor);
        }, 1000);

        // Animate the rejected requests bouncing off
        animateRejectedRequests(rejectedCount, acceptedCount);
    }

    if (acceptedCount > 0) {
        if (rejectedCount === 0) {
            setStatus(`Processing request (${amount} tokens used)...`, true);
        }

        // Animate the requests going right through
        animateSuccessfulRequests(acceptedCount, 0);

        // We need to pop 'acceptedCount' tokens from the top of the stack
        for (let i = 0; i < acceptedCount; i++) {
            const token = tokens.pop();

            // Token flies up and right, following the accepted request
            // Wait 0.3s before flying off so the blue incoming packet has time to arrive
            gsap.to(token.position, {
                x: 5,
                y: token.position.y + 4,
                z: 1,
                duration: 0.5,
                delay: 0.3,
                ease: "power2.in"
            });

            gsap.to(token.scale, { x: 0, y: 0, z: 0, duration: 0.3, delay: 0.6 });

            setTimeout(() => scene.remove(token), 900);
        }
    }

    updateTokenCount();
    setTimeout(() => {
        setStatus(`Ready — tokens refill continuously. Limit: ${tokens.length}/10`);
    }, 1500);
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
