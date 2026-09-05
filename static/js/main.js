const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d', { alpha: false });
const loader = document.getElementById('loader');
const modeIndicator = document.getElementById('mode-indicator');

let currentMode = 1;

// Persistent Coordinate Buffers
let rawLeftHand = null;   // { index: {x,y}, thumb: {x,y} }
let rawRightHand = null;  // { index: {x,y}, thumb: {x,y} }

let targetPts = null;     // Array of 4 points: [Left Index, Right Index, Right Thumb, Left Thumb]
let currentPts = null;    // Smoothed points currently being rendered

let framesWithoutHands = 0;
const MAX_PERSISTENCE_FRAMES = 8; // Keeps box steady briefly during camera motion blur
const LERP_FACTOR = 0.22;          // Smoothness interpolation speed

const MODE_NAMES = {
    1: '🎨 Cartoon Shader',
    2: '⚡ Cyberpunk Neon',
    3: '🔥 Thermal Heatmap',
    4: '❄️ Tinted Glass',
    5: '🌆 Vaporwave Grid',
    6: '💻 Matrix Code',
    7: '✏️ Pencil Sketch',
    8: '👁️ Night Vision',
    9: '🎬 Anime Layer'
};

function setMode(modeId) {
    currentMode = modeId;
    document.querySelectorAll('.mode-grid button').forEach(btn => btn.classList.remove('active'));
    const targetBtn = document.getElementById(`btn-${modeId}`);
    if (targetBtn) targetBtn.classList.add('active');
    if (modeIndicator) modeIndicator.innerText = `Mode: ${MODE_NAMES[modeId]}`;
}

// Linear Interpolation
function lerp(start, end, amt) {
    return start + (end - start) * amt;
}

// Smoothly transition current rendering points toward new target coordinates
function updateSmoothPoints() {
    if (!targetPts) {
        framesWithoutHands++;
        if (framesWithoutHands > MAX_PERSISTENCE_FRAMES) {
            currentPts = null;
        }
        return;
    }

    framesWithoutHands = 0;

    if (!currentPts || currentPts.length !== targetPts.length) {
        currentPts = JSON.parse(JSON.stringify(targetPts));
        return;
    }

    for (let i = 0; i < targetPts.length; i++) {
        currentPts[i].x = lerp(currentPts[i].x, targetPts[i].x, LERP_FACTOR);
        currentPts[i].y = lerp(currentPts[i].y, targetPts[i].y, LERP_FACTOR);
    }
}

// MediaPipe Callback: Assigns fingertips based on Left/Right hand chirality
function onResults(results) {
    if (loader && loader.style.display !== 'none') {
        loader.style.display = 'none';
    }

    let leftHandTips = null;
    let rightHandTips = null;

    if (results.multiHandLandmarks && results.multiHandedness) {
        const w = canvasElement.width || 640;
        const h = canvasElement.height || 480;

        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const label = results.multiHandedness[i].label; // "Left" or "Right"

            const handData = {
                index: { x: landmarks[8].x * w, y: landmarks[8].y * h },
                thumb: { x: landmarks[4].x * w, y: landmarks[4].y * h }
            };

            if (label === 'Left') {
                leftHandTips = handData;
            } else {
                rightHandTips = handData;
            }
        }
    }

    // Strictly construct quad: [Left Index, Right Index, Right Thumb, Left Thumb]
    if (leftHandTips && rightHandTips) {
        targetPts = [
            leftHandTips.index,
            rightHandTips.index,
            rightHandTips.thumb,
            leftHandTips.thumb
        ];
    } else {
        targetPts = null;
    }

    window.lastResultsImage = results.image;
}

// Dedicated 60 FPS Render Loop
function renderLoop() {
    const w = canvasElement.width = videoElement.videoWidth || 640;
    const h = canvasElement.height = videoElement.videoHeight || 480;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, w, h);

    if (window.lastResultsImage) {
        canvasCtx.drawImage(window.lastResultsImage, 0, 0, w, h);
    }

    updateSmoothPoints();

    if (currentPts && window.lastResultsImage) {
        applyAllModes(canvasCtx, window.lastResultsImage, w, h, currentPts);
    }

    canvasCtx.restore();
    requestAnimationFrame(renderLoop);
}

// Shader application pipeline inside polygon boundary
function applyAllModes(ctx, image, w, h, pts) {
    ctx.save();

    // Polygon Masking
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    ctx.clip();

    let borderColor = '#00e5ff';

    switch (currentMode) {
        case 1: // Cartoon Shader
            ctx.filter = 'saturate(220%) contrast(150%) brightness(105%)';
            ctx.drawImage(image, 0, 0, w, h);
            borderColor = '#ff007f';
            break;

        case 2: // Cyberpunk Neon
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, w, h);
            ctx.filter = 'grayscale(100%) contrast(400%) invert(100%)';
            ctx.globalCompositeOperation = 'screen';
            ctx.drawImage(image, 0, 0, w, h);
            ctx.fillStyle = 'rgba(0, 255, 255, 0.35)';
            ctx.fillRect(0, 0, w, h);
            borderColor = '#00ffff';
            break;

        case 3: // Thermal Heatmap
            ctx.filter = 'contrast(250%) hue-rotate(90deg) saturate(350%)';
            ctx.drawImage(image, 0, 0, w, h);
            borderColor = '#ffaa00';
            break;

        case 4: // Tinted Glass
            ctx.filter = 'none';
            ctx.drawImage(image, 0, 0, w, h);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fillRect(0, 0, w, h);
            borderColor = '#ffffff';
            break;

        case 5: // Vaporwave Grid
            ctx.filter = 'saturate(200%) hue-rotate(280deg) contrast(125%)';
            ctx.drawImage(image, 0, 0, w, h);
            ctx.strokeStyle = 'rgba(255, 0, 255, 0.35)';
            ctx.lineWidth = 1;
            for (let x = 0; x < w; x += 24) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
            }
            borderColor = '#ff77ff';
            break;

        case 6: // Matrix Code
            ctx.filter = 'grayscale(100%) brightness(85%)';
            ctx.drawImage(image, 0, 0, w, h);
            ctx.fillStyle = 'rgba(0, 255, 70, 0.25)';
            ctx.fillRect(0, 0, w, h);
            borderColor = '#00ff44';
            break;

        case 7: // Pencil Sketch
            ctx.filter = 'grayscale(100%) contrast(300%) invert(100%)';
            ctx.drawImage(image, 0, 0, w, h);
            borderColor = '#ffffff';
            break;

        case 8: // Night Vision
            ctx.filter = 'sepia(100%) hue-rotate(90deg) saturate(300%) brightness(90%)';
            ctx.drawImage(image, 0, 0, w, h);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            for (let y = 0; y < h; y += 4) {
                ctx.fillRect(0, y, w, 2);
            }
            borderColor = '#33ff33';
            break;

        case 9: // Anime Layer
            ctx.filter = 'contrast(180%) saturate(250%) hue-rotate(320deg)';
            ctx.drawImage(image, 0, 0, w, h);
            borderColor = '#ff00aa';
            break;
    }

    ctx.restore();

    // Smooth Outer Polyline
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = borderColor;
    ctx.shadowColor = borderColor;
    ctx.shadowBlur = 10;
    ctx.stroke();
}

// MediaPipe Setup
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 0, // Lite model for maximum tracking speed
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480
});

camera.start();
requestAnimationFrame(renderLoop);