const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const loading = document.getElementById("loading");
const permission = document.getElementById("permission");
const startButton = document.getElementById("startButton");

const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");


let camera = null;

let hands = null;

let running = false;

let startTime = performance.now();
let lastTime = performance.now();


let leftFistPresent = false;
let rightHand = null;

let drawingPoints = [];

let portalActive = false;

let portalCenter = {
    x: 0,
    y: 0
};

let portalRadius = 0;

let portalIntensity = 0;


const sparks = [];
const portalParticles = [];


// --------------------------------------------------
// Utility
// --------------------------------------------------

function distance(a, b) {

    return Math.hypot(
        a.x - b.x,
        a.y - b.y
    );
}


function clamp(value, min, max) {

    return Math.max(
        min,
        Math.min(max, value)
    );
}


// --------------------------------------------------
// Hand detection
// --------------------------------------------------

function isPalmOpen(landmarks) {

    const wrist = landmarks[0];

    let extended = 0;

    const tips = [8, 12, 16, 20];
    const mcps = [5, 9, 13, 17];


    for (let i = 0; i < tips.length; i++) {

        const tip = landmarks[tips[i]];
        const mcp = landmarks[mcps[i]];

        const tipDistance = distance(
            tip,
            wrist
        );

        const mcpDistance = distance(
            mcp,
            wrist
        );


        if (tipDistance > mcpDistance * 1.3) {

            extended++;
        }
    }


    const thumbTip = landmarks[4];
    const thumbIP = landmarks[3];


    if (
        Math.abs(thumbTip.x - thumbIP.x) > 0.025 ||
        Math.abs(thumbTip.y - thumbIP.y) > 0.025
    ) {

        extended++;
    }


    return extended >= 4;
}


function isFist(landmarks) {

    const wrist = landmarks[0];

    let curled = 0;

    const tips = [8, 12, 16, 20];
    const mcps = [5, 9, 13, 17];


    for (let i = 0; i < tips.length; i++) {

        const tip = landmarks[tips[i]];
        const mcp = landmarks[mcps[i]];


        const tipDistance = distance(
            tip,
            wrist
        );

        const mcpDistance = distance(
            mcp,
            wrist
        );


        if (tipDistance < mcpDistance * 1.1) {

            curled++;
        }
    }


    return curled >= 3;
}


function palmCenter(landmarks) {

    const wrist = landmarks[0];
    const middle = landmarks[9];


    return {
        x: ((wrist.x + middle.x) / 2) * canvas.width,
        y: ((wrist.y + middle.y) / 2) * canvas.height
    };
}


function palmSize(landmarks) {

    const wrist = landmarks[0];
    const middle = landmarks[9];


    return Math.sqrt(
        Math.pow(
            (wrist.x - middle.x) * canvas.width,
            2
        ) +
        Math.pow(
            (wrist.y - middle.y) * canvas.height,
            2
        )
    );
}


// --------------------------------------------------
// Circle gesture
// --------------------------------------------------

function checkCircleGesture(
    points,
    minPerimeter = 250,
    closeThreshold = 50
) {

    if (points.length < 20) {

        return {
            detected: false
        };
    }


    const end = points[points.length - 1];

    let pathDistance = 0;


    for (
        let i = points.length - 2;
        i >= 0;
        i--
    ) {

        const a = points[i];
        const b = points[i + 1];


        pathDistance += Math.hypot(
            b.x - a.x,
            b.y - a.y
        );


        if (pathDistance > minPerimeter) {

            const distanceToOld = Math.hypot(
                end.x - a.x,
                end.y - a.y
            );


            if (distanceToOld < closeThreshold) {

                const loop = points.slice(i);

                let cx = 0;
                let cy = 0;


                for (const point of loop) {

                    cx += point.x;
                    cy += point.y;
                }


                cx /= loop.length;
                cy /= loop.length;


                const radii = loop.map(point =>
                    Math.hypot(
                        point.x - cx,
                        point.y - cy
                    )
                );


                const averageRadius =
                    radii.reduce(
                        (sum, value) => sum + value,
                        0
                    ) / radii.length;


                return {
                    detected: true,
                    center: {
                        x: cx,
                        y: cy
                    },
                    radius: averageRadius
                };
            }
        }
    }


    return {
        detected: false
    };
}


// --------------------------------------------------
// Spark
// --------------------------------------------------

class Spark {

    constructor(x, y) {

        this.x = x;
        this.y = y;

        this.vx =
            (Math.random() * 4) - 2;

        this.vy =
            (Math.random() * 4) - 1;

        this.life =
            0.3 +
            Math.random() * 0.3;

        this.maxLife =
            this.life;

        this.size =
            2 +
            Math.floor(Math.random() * 3);
    }


    update(dt) {

        this.x += this.vx;

        this.y += this.vy;

        this.life -= dt;

        return this.life > 0;
    }


    draw() {

        const alpha =
            clamp(
                this.life / this.maxLife,
                0,
                1
            );


        ctx.save();

        ctx.globalAlpha = alpha;

        ctx.fillStyle = "#ffb52e";

        ctx.shadowColor = "#ff8c1a";

        ctx.shadowBlur = 10;

        ctx.beginPath();

        ctx.arc(
            this.x,
            this.y,
            this.size,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.restore();
    }
}


// --------------------------------------------------
// Portal particle
// --------------------------------------------------

class Particle {

    constructor(
        centerX,
        centerY,
        radius
    ) {

        const angle =
            Math.random() *
            Math.PI *
            2;


        const r =
            radius *
            (
                0.9 +
                Math.random() * 0.2
            );


        this.x =
            centerX +
            r * Math.cos(angle);

        this.y =
            centerY +
            r * Math.sin(angle);


        this.vx =
            (Math.random() * 3) - 1.5;

        this.vy =
            (Math.random() * 3) - 1.5;


        this.life =
            0.3 +
            Math.random() * 0.7;

        this.maxLife =
            this.life;


        this.size =
            1 +
            Math.floor(
                Math.random() * 3
            );
    }


    update(dt) {

        this.x += this.vx;

        this.y += this.vy;

        this.life -= dt;

        return this.life > 0;
    }


    draw() {

        const alpha =
            clamp(
                this.life / this.maxLife,
                0,
                1
            );


        ctx.save();

        ctx.globalAlpha = alpha;

        ctx.fillStyle = "#ffd27a";

        ctx.shadowColor = "#ff8c1a";

        ctx.shadowBlur = 8;

        ctx.beginPath();

        ctx.arc(
            this.x,
            this.y,
            this.size,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.restore();
    }
}


// --------------------------------------------------
// Rune segments
// --------------------------------------------------

function drawRuneSegments(
    cx,
    cy,
    radius,
    rotation,
    segments,
    thickness,
    alpha
) {

    const segmentAngle =
        (Math.PI * 2) /
        segments;

    const arcLength =
        segmentAngle * 0.4;


    ctx.save();

    ctx.globalAlpha = alpha;

    ctx.strokeStyle = "#ffb52e";

    ctx.lineWidth = thickness;

    ctx.shadowColor = "#ff8c1a";

    ctx.shadowBlur = 8;


    for (
        let i = 0;
        i < segments;
        i++
    ) {

        const start =
            rotation +
            i * segmentAngle;

        const end =
            start +
            arcLength;


        ctx.beginPath();

        ctx.arc(
            cx,
            cy,
            radius,
            start,
            end
        );

        ctx.stroke();
    }


    ctx.restore();
}


// --------------------------------------------------
// Geometric symbols
// --------------------------------------------------

function drawGeometricSymbols(
    cx,
    cy,
    radius,
    rotation,
    count,
    alpha
) {

    ctx.save();

    ctx.globalAlpha = alpha;

    ctx.strokeStyle = "#ffe6a1";

    ctx.lineWidth = 1.5;

    ctx.shadowColor = "#ffb52e";

    ctx.shadowBlur = 5;


    for (
        let i = 0;
        i < count;
        i++
    ) {

        const angle =
            rotation +
            i *
            ((Math.PI * 2) / count);


        const x =
            cx +
            radius *
            Math.cos(angle);

        const y =
            cy +
            radius *
            Math.sin(angle);


        const size =
            Math.max(
                4,
                radius * 0.06
            );


        ctx.beginPath();


        if (i % 3 === 0) {

            ctx.moveTo(
                x,
                y - size
            );

            ctx.lineTo(
                x - size * 0.866,
                y + size * 0.5
            );

            ctx.lineTo(
                x + size * 0.866,
                y + size * 0.5
            );

            ctx.closePath();

        } else if (i % 3 === 1) {

            ctx.moveTo(
                x,
                y - size
            );

            ctx.lineTo(
                x + size,
                y
            );

            ctx.lineTo(
                x,
                y + size
            );

            ctx.lineTo(
                x - size,
                y
            );

            ctx.closePath();

        } else {

            ctx.arc(
                x,
                y,
                size,
                0,
                Math.PI * 2
            );
        }


        ctx.stroke();
    }


    ctx.restore();
}


// --------------------------------------------------
// Magic circle
// --------------------------------------------------

function drawMagicCircle(
    cx,
    cy,
    radius,
    time,
    intensity = 1
) {

    const alpha =
        clamp(
            intensity,
            0,
            1
        );


    ctx.save();


    // Outer glow

    for (
        let i = 0;
        i < 3;
        i++
    ) {

        ctx.globalAlpha =
            alpha *
            (0.18 - i * 0.04);

        ctx.strokeStyle =
            "#ff8c1a";

        ctx.lineWidth = 3;

        ctx.shadowColor =
            "#ff7a00";

        ctx.shadowBlur = 25;


        ctx.beginPath();

        ctx.arc(
            cx,
            cy,
            radius *
            (1.15 + i * 0.08),
            0,
            Math.PI * 2
        );

        ctx.stroke();
    }


    ctx.globalAlpha = alpha;


    // Main circle

    ctx.strokeStyle = "#ffe6a1";

    ctx.lineWidth = 2.5;

    ctx.shadowColor = "#ff9d1c";

    ctx.shadowBlur = 15;


    ctx.beginPath();

    ctx.arc(
        cx,
        cy,
        radius,
        0,
        Math.PI * 2
    );

    ctx.stroke();


    // Outer runes

    drawRuneSegments(
        cx,
        cy,
        radius * 0.95,
        time * 0.8,
        36,
        1.5,
        alpha * 0.9
    );


    drawRuneSegments(
        cx,
        cy,
        radius * 0.9,
        -time * 0.6,
        24,
        2,
        alpha * 0.7
    );


    // Octagon

    ctx.strokeStyle =
        "#ffd66b";

    ctx.lineWidth = 2;

    ctx.beginPath();


    for (
        let i = 0;
        i < 8;
        i++
    ) {

        const angle =
            time * 0.5 +
            i *
            (Math.PI / 4);


        const x =
            cx +
            radius *
            0.82 *
            Math.cos(angle);

        const y =
            cy +
            radius *
            0.82 *
            Math.sin(angle);


        if (i === 0) {

            ctx.moveTo(x, y);

        } else {

            ctx.lineTo(x, y);
        }
    }


    ctx.closePath();

    ctx.stroke();


    // Radial markings

    for (
        let i = 0;
        i < 12;
        i++
    ) {

        const angle =
            -time * 0.4 +
            i *
            (Math.PI / 6);


        const outer =
            radius * 0.82;

        const inner =
            radius * 0.65;


        const x1 =
            cx +
            outer *
            Math.cos(angle);

        const y1 =
            cy +
            outer *
            Math.sin(angle);


        const x2 =
            cx +
            inner *
            Math.cos(angle);

        const y2 =
            cy +
            inner *
            Math.sin(angle);


        ctx.strokeStyle =
            "#ffb52e";

        ctx.lineWidth = 1.5;


        ctx.beginPath();

        ctx.moveTo(
            x1,
            y1
        );

        ctx.lineTo(
            x2,
            y2
        );

        ctx.stroke();


        ctx.fillStyle =
            "#ffe6a1";


        ctx.beginPath();

        ctx.arc(
            x2,
            y2,
            3,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }


    // Inner circle

    ctx.strokeStyle =
        "#ff9b25";

    ctx.lineWidth = 2;


    ctx.beginPath();

    ctx.arc(
        cx,
        cy,
        radius * 0.65,
        0,
        Math.PI * 2
    );

    ctx.stroke();


    // Rotating squares

    for (
        const offset of [
            0,
            Math.PI / 4
        ]
    ) {

        ctx.beginPath();


        for (
            let i = 0;
            i < 4;
            i++
        ) {

            const angle =
                time * 1.5 +
                offset +
                i *
                (Math.PI / 2);


            const x =
                cx +
                radius *
                0.5 *
                Math.cos(angle);

            const y =
                cy +
                radius *
                0.5 *
                Math.sin(angle);


            if (i === 0) {

                ctx.moveTo(
                    x,
                    y
                );

            } else {

                ctx.lineTo(
                    x,
                    y
                );
            }
        }


        ctx.closePath();

        ctx.stroke();
    }


    // Symbols

    drawGeometricSymbols(
        cx,
        cy,
        radius * 0.35,
        -time * 2,
        6,
        alpha
    );


    // Center pulse

    const pulse =
        0.5 +
        0.5 *
        Math.sin(time * 8);


    ctx.fillStyle =
        "#ffb52e";

    ctx.globalAlpha =
        alpha * 0.5;


    ctx.beginPath();

    ctx.arc(
        cx,
        cy,
        radius * 0.15,
        0,
        Math.PI * 2
    );

    ctx.fill();


    ctx.globalAlpha = alpha;


    ctx.fillStyle =
        "#ffe6a1";


    ctx.beginPath();

    ctx.arc(
        cx,
        cy,
        radius * 0.05 +
        5 * pulse,
        0,
        Math.PI * 2
    );

    ctx.fill();


    ctx.restore();
}


// --------------------------------------------------
// Drawing path
// --------------------------------------------------

function drawPath() {

    if (
        drawingPoints.length < 2
    ) {

        return;
    }


    ctx.save();

    ctx.strokeStyle =
        "#ffb52e";

    ctx.lineWidth = 3;

    ctx.lineCap = "round";

    ctx.lineJoin = "round";

    ctx.shadowColor =
        "#ff7a18";

    ctx.shadowBlur = 15;


    ctx.beginPath();

    ctx.moveTo(
        drawingPoints[0].x,
        drawingPoints[0].y
    );


    for (
        let i = 1;
        i < drawingPoints.length;
        i++
    ) {

        ctx.lineTo(
            drawingPoints[i].x,
            drawingPoints[i].y
        );
    }


    ctx.stroke();

    ctx.restore();
}


// --------------------------------------------------
// MediaPipe
// --------------------------------------------------

function onResults(results) {

    leftFistPresent = false;

    rightHand = null;


    if (
        !results.multiHandLandmarks ||
        !results.multiHandedness
    ) {

        return;
    }


    for (
        let i = 0;
        i < results.multiHandLandmarks.length;
        i++
    ) {

        const landmarks =
            results.multiHandLandmarks[i];

        const handedness =
            results.multiHandedness[i]
                .classification[0]
                .label;


        /*
            MediaPipe sees the mirrored camera.

            "Right" corresponds to the user's
            physical left hand when the video
            is mirrored.
        */

        const userLeft =
            handedness === "Right";

        const userRight =
            handedness === "Left";


        const open =
            isPalmOpen(landmarks);

        const fist =
            isFist(landmarks);


        const center =
            palmCenter(landmarks);

        const size =
            palmSize(landmarks);


        if (userLeft) {

            if (fist) {

                leftFistPresent = true;

            } else if (
                open &&
                !portalActive &&
                drawingPoints.length === 0
            ) {

                drawMagicCircle(
                    center.x,
                    center.y,
                    size * 1.5,
                    performance.now() / 1000,
                    0.8
                );
            }
        }


        if (userRight) {

            rightHand = landmarks;


            if (
                open &&
                !portalActive &&
                drawingPoints.length === 0
            ) {

                drawMagicCircle(
                    center.x,
                    center.y,
                    size * 1.5,
                    performance.now() / 1000,
                    0.8
                );
            }
        }
    }


    // ------------------------------------------------
    // Left fist + right index finger
    // ------------------------------------------------

    if (
        leftFistPresent &&
        rightHand &&
        !portalActive
    ) {

        const index =
            rightHand[8];


        const x =
            index.x *
            canvas.width;

        const y =
            index.y *
            canvas.height;


        drawingPoints.push({
            x,
            y
        });


        // Create sparks

        for (
            let i = 0;
            i < 4;
            i++
        ) {

            sparks.push(
                new Spark(
                    x,
                    y
                )
            );
        }


        if (
            drawingPoints.length > 100
        ) {

            drawingPoints.shift();
        }


        const circle =
            checkCircleGesture(
                drawingPoints,
                250,
                50
            );


        if (circle.detected) {

            portalActive = true;

            portalCenter =
                circle.center;

            portalRadius =
                Math.max(
                    circle.radius,
                    120
                ) * 1.2;


            drawingPoints = [];
        }

    } else if (!portalActive) {

        drawingPoints = [];
    }


    if (portalActive) {

        portalIntensity =
            Math.min(
                1,
                portalIntensity +
                0.03
            );

    } else {

        portalIntensity =
            Math.max(
                0,
                portalIntensity -
                0.03
            );
    }
}


// --------------------------------------------------
// Animation
// --------------------------------------------------

function animate() {

    requestAnimationFrame(
        animate
    );


    const now =
        performance.now();


    const dt =
        Math.min(
            0.05,
            (now - lastTime) / 1000
        );


    lastTime = now;


    if (
        canvas.width !== video.videoWidth ||
        canvas.height !== video.videoHeight
    ) {

        if (
            video.videoWidth &&
            video.videoHeight
        ) {

            canvas.width =
                video.videoWidth;

            canvas.height =
                video.videoHeight;
        }
    }


    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    const time =
        (now - startTime) /
        1000;


    // Draw path

    drawPath();


    // Portal

    if (
        portalActive ||
        portalIntensity > 0.05
    ) {

        drawMagicCircle(
            portalCenter.x,
            portalCenter.y,
            portalRadius,
            time,
            portalIntensity
        );


        // Spawn portal particles

        if (
            Math.random() <
            0.8 *
            portalIntensity
        ) {

            for (
                let i = 0;
                i < 2;
                i++
            ) {

                portalParticles.push(
                    new Particle(
                        portalCenter.x,
                        portalCenter.y,
                        portalRadius
                    )
                );
            }
        }
    }


    // Sparks

    for (
        let i = sparks.length - 1;
        i >= 0;
        i--
    ) {

        const spark =
            sparks[i];


        if (
            spark.update(dt)
        ) {

            spark.draw();

        } else {

            sparks.splice(i, 1);
        }
    }


    // Portal particles

    for (
        let i =
            portalParticles.length - 1;
        i >= 0;
        i--
    ) {

        const particle =
            portalParticles[i];


        if (
            particle.update(dt)
        ) {

            particle.draw();

        } else {

            portalParticles.splice(i, 1);
        }
    }


    // Limit particles

    if (
        sparks.length > 300
    ) {

        sparks.splice(
            0,
            sparks.length - 200
        );
    }


    if (
        portalParticles.length > 400
    ) {

        portalParticles.splice(
            0,
            portalParticles.length - 300
        );
    }
}


// --------------------------------------------------
// Camera
// --------------------------------------------------

async function startCamera() {

    try {

        statusText.textContent =
            "Requesting camera...";


        const stream =
            await navigator.mediaDevices.getUserMedia({

                video: {
                    facingMode: "user",

                    width: {
                        ideal: 1280
                    },

                    height: {
                        ideal: 720
                    }
                },

                audio: false
            });


        video.srcObject =
            stream;


        await video.play();


        loading.classList.add(
            "hidden"
        );

        permission.classList.add(
            "hidden"
        );


        statusText.textContent =
            "Camera active";


        statusDot.classList.add(
            "active"
        );


        setupMediaPipe();


    } catch (error) {

        console.error(
            "Camera error:",
            error
        );


        loading.classList.add(
            "hidden"
        );

        permission.classList.remove(
            "hidden"
        );


        statusText.textContent =
            "Camera permission required";


        statusDot.classList.remove(
            "active"
        );
    }
}


// --------------------------------------------------
// MediaPipe initialization
// --------------------------------------------------

function setupMediaPipe() {

    hands =
        new Hands({

            locateFile: (
                file
            ) => {

                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });


    hands.setOptions({

        maxNumHands: 2,

        modelComplexity: 1,

        minDetectionConfidence: 0.6,

        minTrackingConfidence: 0.6
    });


    hands.onResults(
        onResults
    );


    camera =
        new Camera(
            video,
            {

                onFrame: async () => {

                    await hands.send({
                        image: video
                    });
                },

                width: 1280,

                height: 720
            }
        );


    camera.start();


    running = true;


    startTime =
        performance.now();

    lastTime =
        performance.now();


    requestAnimationFrame(
        animate
    );
}


// --------------------------------------------------
// Start button
// --------------------------------------------------

startButton.addEventListener(
    "click",
    () => {

        startCamera();
    }
);


// --------------------------------------------------
// Browser compatibility
// --------------------------------------------------

if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
) {

    loading.classList.add(
        "hidden"
    );

    permission.classList.remove(
        "hidden"
    );


    permission.querySelector("p")
        .textContent =
        "Your browser does not support webcam access. Please use a recent version of Chrome or Edge.";
}


// --------------------------------------------------
// Start
// --------------------------------------------------

startCamera();
