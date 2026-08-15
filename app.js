const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const loading = document.getElementById("loading");
const permission = document.getElementById("permission");
const startButton = document.getElementById("startButton");

const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");

let hands;
let camera;

let detectedHands = [];

let drawingPoints = [];

let portalActive = false;

let portalCenter = {
    x: 0,
    y: 0
};

let portalRadius = 0;

let portalStrength = 0;

const sparks = [];
const particles = [];


// ==================================================
// BASIC UTILITIES
// ==================================================

function distance(a, b) {
    return Math.hypot(
        a.x - b.x,
        a.y - b.y
    );
}


function getCanvasPoint(point) {

    return {
        x: point.x * canvas.width,
        y: point.y * canvas.height
    };
}


// ==================================================
// HAND DETECTION
// ==================================================

function isOpenHand(hand) {

    /*
        MediaPipe landmarks:

        0  = wrist
        4  = thumb
        8  = index
        12 = middle
        16 = ring
        20 = pinky
    */

    const wrist = hand[0];

    const fingers = [
        [8, 5],
        [12, 9],
        [16, 13],
        [20, 17]
    ];

    let extended = 0;

    for (const [tipIndex, baseIndex] of fingers) {

        const tip = hand[tipIndex];
        const base = hand[baseIndex];

        const tipDistance =
            distance(tip, wrist);

        const baseDistance =
            distance(base, wrist);

        if (
            tipDistance >
            baseDistance * 1.25
        ) {

            extended++;
        }
    }

    /*
        We mainly care about the four
        fingers. This is much more reliable
        than the previous thumb test.
    */

    return extended >= 3;
}


function isFist(hand) {

    const wrist = hand[0];

    const tips = [
        8,
        12,
        16,
        20
    ];

    const bases = [
        5,
        9,
        13,
        17
    ];

    let curled = 0;

    for (let i = 0; i < tips.length; i++) {

        const tip = hand[tips[i]];
        const base = hand[bases[i]];

        const tipDistance =
            distance(tip, wrist);

        const baseDistance =
            distance(base, wrist);

        if (
            tipDistance <
            baseDistance * 1.15
        ) {

            curled++;
        }
    }

    return curled >= 3;
}


// ==================================================
// MEDIAPIPE CALLBACK
// ==================================================

function onResults(results) {

    detectedHands = [];

    if (
        !results.multiHandLandmarks ||
        results.multiHandLandmarks.length === 0
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

        let handedness = "Unknown";

        if (
            results.multiHandedness &&
            results.multiHandedness[i]
        ) {

            handedness =
                results
                    .multiHandedness[i]
                    .classification[0]
                    .label;
        }

        detectedHands.push({
            landmarks,
            handedness,
            open: isOpenHand(landmarks),
            fist: isFist(landmarks)
        });
    }
}


// ==================================================
// DRAW HAND TRACKING
// ==================================================

function drawHandTracking() {

    for (const hand of detectedHands) {

        const landmarks =
            hand.landmarks;

        /*
            Index fingertip
        */

        const index =
            getCanvasPoint(
                landmarks[8]
            );


        /*
            Visible tracking point.

            If you see this yellow point
            following your finger, MediaPipe
            is working.
        */

        ctx.save();

        ctx.beginPath();

        ctx.arc(
            index.x,
            index.y,
            8,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            "#ffd166";

        ctx.shadowColor =
            "#ff8c00";

        ctx.shadowBlur = 20;

        ctx.fill();

        ctx.restore();


        /*
            Small points on all landmarks
        */

        for (const landmark of landmarks) {

            const p =
                getCanvasPoint(
                    landmark
                );

            ctx.save();

            ctx.fillStyle =
                "rgba(255,190,70,0.5)";

            ctx.beginPath();

            ctx.arc(
                p.x,
                p.y,
                2,
                0,
                Math.PI * 2
            );

            ctx.fill();

            ctx.restore();
        }
    }
}


// ==================================================
// HAND CENTER
// ==================================================

function getHandCenter(hand) {

    const wrist = hand[0];
    const middle = hand[9];

    return {
        x:
            ((wrist.x + middle.x) / 2)
            * canvas.width,

        y:
            ((wrist.y + middle.y) / 2)
            * canvas.height
    };
}


function getHandRadius(hand) {

    const wrist = hand[0];
    const middle = hand[9];

    return distance(
        {
            x: wrist.x * canvas.width,
            y: wrist.y * canvas.height
        },
        {
            x: middle.x * canvas.width,
            y: middle.y * canvas.height
        }
    );
}


// ==================================================
// MAGIC CIRCLE
// ==================================================

function drawMagicCircle(
    x,
    y,
    radius,
    rotation,
    strength = 1
) {

    if (radius < 30) {
        return;
    }

    ctx.save();

    ctx.globalAlpha =
        strength;


    /*
        Outer glow
    */

    ctx.shadowColor =
        "#ff8c00";

    ctx.shadowBlur =
        25;

    ctx.strokeStyle =
        "#ffb52e";

    ctx.lineWidth =
        3;


    ctx.beginPath();

    ctx.arc(
        x,
        y,
        radius,
        0,
        Math.PI * 2
    );

    ctx.stroke();


    /*
        Second ring
    */

    ctx.shadowBlur =
        15;

    ctx.lineWidth =
        1.5;

    ctx.strokeStyle =
        "#ffe6a1";


    ctx.beginPath();

    ctx.arc(
        x,
        y,
        radius * 0.86,
        0,
        Math.PI * 2
    );

    ctx.stroke();


    /*
        Rotating rune segments
    */

    const segments = 24;

    const segmentAngle =
        Math.PI * 2 /
        segments;


    ctx.lineWidth = 2;


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
            segmentAngle * 0.55;


        ctx.beginPath();

        ctx.arc(
            x,
            y,
            radius * 0.94,
            start,
            end
        );

        ctx.stroke();
    }


    /*
        Inner octagon
    */

    ctx.strokeStyle =
        "#ffcc66";

    ctx.lineWidth =
        2;


    ctx.beginPath();

    for (
        let i = 0;
        i < 8;
        i++
    ) {

        const angle =
            rotation +
            i * Math.PI / 4;


        const px =
            x +
            radius * 0.67 *
            Math.cos(angle);

        const py =
            y +
            radius * 0.67 *
            Math.sin(angle);


        if (i === 0) {

            ctx.moveTo(px, py);

        } else {

            ctx.lineTo(px, py);
        }
    }

    ctx.closePath();

    ctx.stroke();


    /*
        Inner circle
    */

    ctx.beginPath();

    ctx.arc(
        x,
        y,
        radius * 0.43,
        0,
        Math.PI * 2
    );

    ctx.stroke();


    /*
        Radial lines
    */

    for (
        let i = 0;
        i < 12;
        i++
    ) {

        const angle =
            rotation +
            i *
            Math.PI / 6;


        const inner =
            radius * 0.45;

        const outer =
            radius * 0.64;


        ctx.beginPath();

        ctx.moveTo(
            x +
            inner *
            Math.cos(angle),

            y +
            inner *
            Math.sin(angle)
        );

        ctx.lineTo(
            x +
            outer *
            Math.cos(angle),

            y +
            outer *
            Math.sin(angle)
        );

        ctx.stroke();
    }


    /*
        Center
    */

    const pulse =
        5 +
        Math.sin(
            performance.now() / 150
        ) * 3;


    ctx.fillStyle =
        "#ffe6a1";

    ctx.shadowColor =
        "#ff9d1c";

    ctx.shadowBlur =
        20;


    ctx.beginPath();

    ctx.arc(
        x,
        y,
        pulse,
        0,
        Math.PI * 2
    );

    ctx.fill();


    ctx.restore();
}


// ==================================================
// DRAWING TRAIL
// ==================================================

function drawTrail() {

    if (
        drawingPoints.length < 2
    ) {

        return;
    }


    ctx.save();

    ctx.strokeStyle =
        "#ffb52e";

    ctx.lineWidth =
        4;

    ctx.lineCap =
        "round";

    ctx.lineJoin =
        "round";

    ctx.shadowColor =
        "#ff7a00";

    ctx.shadowBlur =
        18;


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


// ==================================================
// CIRCLE DETECTION
// ==================================================

function detectCircle() {

    if (
        drawingPoints.length < 25
    ) {

        return null;
    }


    const first =
        drawingPoints[0];

    const last =
        drawingPoints[
            drawingPoints.length - 1
        ];


    const closeDistance =
        distance(
            first,
            last
        );


    /*
        The end of the drawing must
        be close to the beginning.
    */

    if (
        closeDistance > 70
    ) {

        return null;
    }


    /*
        Calculate center.
    */

    let cx = 0;
    let cy = 0;


    for (
        const point of drawingPoints
    ) {

        cx += point.x;
        cy += point.y;
    }


    cx /=
        drawingPoints.length;

    cy /=
        drawingPoints.length;


    /*
        Calculate radius.
    */

    let radius = 0;


    for (
        const point of drawingPoints
    ) {

        radius +=
            Math.hypot(
                point.x - cx,
                point.y - cy
            );
    }


    radius /=
        drawingPoints.length;


    /*
        Require a reasonable circle.
    */

    if (
        radius < 70
    ) {

        return null;
    }


    return {
        x: cx,
        y: cy,
        radius
    };
}


// ==================================================
// PARTICLES
// ==================================================

function createSpark(x, y) {

    sparks.push({

        x,

        y,

        vx:
            (Math.random() - 0.5)
            * 6,

        vy:
            (Math.random() - 0.5)
            * 6,

        life:
            1
    });
}


function updateSparks() {

    for (
        let i = sparks.length - 1;
        i >= 0;
        i--
    ) {

        const spark =
            sparks[i];


        spark.x +=
            spark.vx;

        spark.y +=
            spark.vy;

        spark.life -=
            0.025;


        if (
            spark.life <= 0
        ) {

            sparks.splice(i, 1);

            continue;
        }


        ctx.save();

        ctx.globalAlpha =
            spark.life;

        ctx.fillStyle =
            "#ffb52e";

        ctx.shadowColor =
            "#ff7a00";

        ctx.shadowBlur =
            15;


        ctx.beginPath();

        ctx.arc(
            spark.x,
            spark.y,
            3,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.restore();
    }
}


function createPortalParticles() {

    if (
        Math.random() > 0.75
    ) {

        return;
    }


    const angle =
        Math.random() *
        Math.PI *
        2;


    const radius =
        portalRadius *
        (
            0.8 +
            Math.random() * 0.4
        );


    particles.push({

        x:
            portalCenter.x +
            Math.cos(angle) *
            radius,

        y:
            portalCenter.y +
            Math.sin(angle) *
            radius,

        vx:
            (Math.random() - 0.5)
            * 2,

        vy:
            (Math.random() - 0.5)
            * 2,

        life:
            1
    });
}


function updateParticles() {

    for (
        let i = particles.length - 1;
        i >= 0;
        i--
    ) {

        const particle =
            particles[i];


        particle.x +=
            particle.vx;

        particle.y +=
            particle.vy;

        particle.life -=
            0.015;


        if (
            particle.life <= 0
        ) {

            particles.splice(i, 1);

            continue;
        }


        ctx.save();

        ctx.globalAlpha =
            particle.life;

        ctx.fillStyle =
            "#ffd166";

        ctx.shadowColor =
            "#ff8c00";

        ctx.shadowBlur =
            10;


        ctx.beginPath();

        ctx.arc(
            particle.x,
            particle.y,
            2,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.restore();
    }
}


// ==================================================
// MAIN ANIMATION LOOP
// ==================================================

function animate() {

    requestAnimationFrame(
        animate
    );


    if (
        !video.videoWidth
    ) {

        return;
    }


    if (
        canvas.width !==
        video.videoWidth ||
        canvas.height !==
        video.videoHeight
    ) {

        canvas.width =
            video.videoWidth;

        canvas.height =
            video.videoHeight;
    }


    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    const time =
        performance.now() /
        1000;


    /*
        Draw detected hands.
    */

    drawHandTracking();


    /*
        OPEN HAND EFFECT
    */

    for (
        const hand of detectedHands
    ) {

        if (
            hand.open &&
            !portalActive
        ) {

            const center =
                getHandCenter(
                    hand.landmarks
                );

            const radius =
                getHandRadius(
                    hand.landmarks
                ) * 1.8;


            drawMagicCircle(
                center.x,
                center.y,
                radius,
                time,
                0.9
            );
        }
    }


    /*
        LEFT FIST + RIGHT INDEX
    */

    const leftFist =
        detectedHands.some(
            hand =>
                hand.handedness === "Right" &&
                hand.fist
        );


    const rightHand =
        detectedHands.find(
            hand =>
                hand.handedness === "Left"
        );


    if (
        leftFist &&
        rightHand &&
        !portalActive
    ) {

        const index =
            getCanvasPoint(
                rightHand.landmarks[8]
            );


        /*
            Add point.
        */

        drawingPoints.push(
            index
        );


        if (
            drawingPoints.length > 180
        ) {

            drawingPoints.shift();
        }


        /*
            Sparks from finger.
        */

        if (
            Math.random() < 0.6
        ) {

            createSpark(
                index.x,
                index.y
            );
        }


        /*
            Check circle.
        */

        const circle =
            detectCircle();


        if (circle) {

            portalActive =
                true;

            portalCenter = {
                x: circle.x,
                y: circle.y
            };

            portalRadius =
                circle.radius;

            drawingPoints = [];

            statusText.textContent =
                "PORTAL ACTIVE";
        }

    } else if (!portalActive) {

        /*
            Don't immediately clear
            the trail. This makes drawing
            easier.
        */

        if (
            drawingPoints.length > 0
        ) {

            drawingPoints.shift();
        }
    }


    /*
        Draw trail.
    */

    if (
        !portalActive
    ) {

        drawTrail();
    }


    /*
        PORTAL
    */

    if (
        portalActive
    ) {

        portalStrength =
            Math.min(
                1,
                portalStrength +
                0.025
            );


        drawMagicCircle(
            portalCenter.x,
            portalCenter.y,
            portalRadius,
            time,
            portalStrength
        );


        createPortalParticles();


        /*
            Extra sparks around portal.
        */

        if (
            Math.random() < 0.3
        ) {

            const angle =
                Math.random() *
                Math.PI *
                2;


            createSpark(

                portalCenter.x +
                Math.cos(angle) *
                portalRadius,

                portalCenter.y +
                Math.sin(angle) *
                portalRadius
            );
        }

    } else {

        portalStrength =
            Math.max(
                0,
                portalStrength -
                0.03
            );
    }


    updateSparks();

    updateParticles();
}


// ==================================================
// START MEDIAPIPE
// ==================================================

async function startTracking() {

    try {

        statusText.textContent =
            "Starting hand tracking...";


        hands = new Hands({

            locateFile: function(file) {

                return (
                    "https://cdn.jsdelivr.net/npm/@mediapipe/hands/" +
                    file
                );
            }
        });


        hands.setOptions({

            maxNumHands: 2,

            modelComplexity: 1,

            minDetectionConfidence: 0.5,

            minTrackingConfidence: 0.5
        });


        hands.onResults(
            onResults
        );


        camera =
            new Camera(
                video,
                {

                    onFrame:
                        async function() {

                            await hands.send({
                                image: video
                            });
                        },

                    width: 1280,

                    height: 720
                }
            );


        camera.start();


        loading.classList.add(
            "hidden"
        );


        statusDot.classList.add(
            "active"
        );


        statusText.textContent =
            "Hand tracking active";


        requestAnimationFrame(
            animate
        );

    } catch (error) {

        console.error(
            "MediaPipe error:",
            error
        );


        statusText.textContent =
            "Hand tracking failed";

        statusDot.classList.remove(
            "active"
        );
    }
}


// ==================================================
// CAMERA
// ==================================================

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


        permission.classList.add(
            "hidden"
        );


        statusText.textContent =
            "Camera connected";


        await startTracking();

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
    }
}


// ==================================================
// START BUTTON
// ==================================================

startButton.addEventListener(
    "click",
    startCamera
);


// ==================================================
// START
// ==================================================

startCamera();
