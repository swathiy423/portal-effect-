const video = document.getElementById("video");
const canvas = document.getElementById("canvas");

const ctx = canvas.getContext("2d");

const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const gestureText = document.getElementById("gestureText");

const loading = document.getElementById("loading");
const permission = document.getElementById("permission");
const startButton = document.getElementById("startButton");

const portalMessage =
    document.getElementById("portalMessage");


// =====================================================
// MEDIAPIPE
// =====================================================

let hands = null;

let stream = null;

let processing = false;

let lastFrameTime = 0;


// Off-screen canvas.
//
// This is important because your Python code does:
//
// image = cv2.flip(image, 1)
//
// BEFORE sending the image to MediaPipe.
//
// We do the same thing here.
const processCanvas =
    document.createElement("canvas");

const processCtx =
    processCanvas.getContext("2d");


// =====================================================
// STATE
// =====================================================

let detectedHands = [];

let drawingPoints = [];

let portalActive = false;

let portalCenter = {
    x: 0,
    y: 0
};

let portalRadius = 0;

let portalIntensity = 0;

let startTime = performance.now();

let lastTime = performance.now();


// =====================================================
// PARTICLES
// =====================================================

const sparks = [];

const portalParticles = [];


// =====================================================
// UTILITY
// =====================================================

function distance(a, b) {

    return Math.hypot(
        a.x - b.x,
        a.y - b.y
    );
}


// =====================================================
// EXACT PYTHON-STYLE PALM DETECTION
// =====================================================

function isPalmOpen(hand) {

    const wrist = hand[0];

    let extended = 0;

    const tips = [
        8,
        12,
        16,
        20
    ];

    const mcps = [
        5,
        9,
        13,
        17
    ];


    for (
        let i = 0;
        i < tips.length;
        i++
    ) {

        const tip =
            hand[tips[i]];

        const mcp =
            hand[mcps[i]];


        const dTipWrist =
            Math.hypot(
                tip.x - wrist.x,
                tip.y - wrist.y
            );


        const dMcpWrist =
            Math.hypot(
                mcp.x - wrist.x,
                mcp.y - wrist.y
            );


        if (
            dTipWrist >
            dMcpWrist * 1.3
        ) {

            extended++;
        }
    }


    /*
        Same thumb logic as your Python code.
    */

    const thumbTip =
        hand[4];

    const thumbIP =
        hand[3];


    if (
        Math.abs(
            thumbTip.x -
            thumbIP.x
        ) > 0.02 ||

        Math.abs(
            thumbTip.y -
            thumbIP.y
        ) > 0.02
    ) {

        extended++;
    }


    return extended >= 4;
}


// =====================================================
// EXACT PYTHON-STYLE FIST DETECTION
// =====================================================

function isFist(hand) {

    const wrist = hand[0];

    let curled = 0;

    const tips = [
        8,
        12,
        16,
        20
    ];

    const mcps = [
        5,
        9,
        13,
        17
    ];


    for (
        let i = 0;
        i < tips.length;
        i++
    ) {

        const tip =
            hand[tips[i]];

        const mcp =
            hand[mcps[i]];


        const dTipWrist =
            Math.hypot(
                tip.x - wrist.x,
                tip.y - wrist.y
            );


        const dMcpWrist =
            Math.hypot(
                mcp.x - wrist.x,
                mcp.y - wrist.y
            );


        if (
            dTipWrist <
            dMcpWrist * 1.1
        ) {

            curled++;
        }
    }


    return curled >= 3;
}


// =====================================================
// PALM CENTER
// =====================================================

function getPalmCenter(
    hand,
    width,
    height
) {

    const wrist =
        hand[0];

    const middleMCP =
        hand[9];


    return {

        x:
            (
                (wrist.x +
                middleMCP.x) /
                2
            ) * width,

        y:
            (
                (wrist.y +
                middleMCP.y) /
                2
            ) * height
    };
}


// =====================================================
// PALM SIZE
// =====================================================

function getPalmSize(
    hand,
    width,
    height
) {

    const wrist =
        hand[0];

    const middleMCP =
        hand[9];


    const dx =
        (wrist.x -
        middleMCP.x) *
        width;

    const dy =
        (wrist.y -
        middleMCP.y) *
        height;


    return Math.sqrt(
        dx * dx +
        dy * dy
    );
}


// =====================================================
// EXACT PYTHON-STYLE CIRCLE DETECTION
// =====================================================

function checkCircleGesture(
    points,
    minPerimeter = 250,
    closeThreshold = 50
) {

    if (
        points.length < 20
    ) {

        return {
            detected: false,
            center: null,
            radius: 0
        };
    }


    const endPoint =
        points[
            points.length - 1
        ];


    let pathDistance = 0;


    for (
        let i =
            points.length - 2;

        i >= 0;

        i--
    ) {

        const dx =
            points[i + 1].x -
            points[i].x;

        const dy =
            points[i + 1].y -
            points[i].y;


        pathDistance +=
            Math.hypot(
                dx,
                dy
            );


        if (
            pathDistance >
            minPerimeter
        ) {

            const distanceToOld =
                Math.hypot(
                    endPoint.x -
                    points[i].x,

                    endPoint.y -
                    points[i].y
                );


            if (
                distanceToOld <
                closeThreshold
            ) {

                const loopPoints =
                    points.slice(i);


                let cx = 0;
                let cy = 0;


                for (
                    const point of loopPoints
                ) {

                    cx += point.x;
                    cy += point.y;
                }


                cx /=
                    loopPoints.length;

                cy /=
                    loopPoints.length;


                let radius = 0;


                for (
                    const point of loopPoints
                ) {

                    radius +=
                        Math.hypot(
                            point.x - cx,
                            point.y - cy
                        );
                }


                radius /=
                    loopPoints.length;


                return {

                    detected: true,

                    center: {
                        x: Math.round(cx),
                        y: Math.round(cy)
                    },

                    radius
                };
            }
        }
    }


    return {
        detected: false,
        center: null,
        radius: 0
    };
}


// =====================================================
// RUNE SEGMENTS
// =====================================================

function drawRuneSegments(
    cx,
    cy,
    radius,
    angleOffset,
    numSegments,
    thickness,
    color,
    alpha
) {

    const segmentAngle =
        (Math.PI * 2) /
        numSegments;

    const arcLength =
        segmentAngle * 0.4;


    ctx.save();

    ctx.globalAlpha =
        alpha;

    ctx.strokeStyle =
        color;

    ctx.lineWidth =
        thickness;

    ctx.shadowColor =
        "#ff7a00";

    ctx.shadowBlur =
        10;


    for (
        let i = 0;
        i < numSegments;
        i++
    ) {

        const startAngle =
            angleOffset +
            i * segmentAngle;

        const endAngle =
            startAngle +
            arcLength;


        ctx.beginPath();


        const steps = 10;


        for (
            let s = 0;
            s <= steps;
            s++
        ) {

            const angle =
                startAngle +
                (
                    endAngle -
                    startAngle
                ) *
                s /
                steps;


            const x =
                cx +
                radius *
                Math.cos(angle);

            const y =
                cy +
                radius *
                Math.sin(angle);


            if (s === 0) {

                ctx.moveTo(x, y);

            } else {

                ctx.lineTo(x, y);
            }
        }


        ctx.stroke();
    }


    ctx.restore();
}


// =====================================================
// GEOMETRIC SYMBOLS
// =====================================================

function drawGeometricSymbols(
    cx,
    cy,
    radius,
    angleOffset,
    numSymbols,
    color,
    alpha
) {

    ctx.save();

    ctx.globalAlpha =
        alpha;

    ctx.strokeStyle =
        color;

    ctx.lineWidth =
        1.5;

    ctx.shadowColor =
        "#ff9d1c";

    ctx.shadowBlur =
        8;


    for (
        let i = 0;
        i < numSymbols;
        i++
    ) {

        const angle =
            angleOffset +
            i *
            (
                Math.PI * 2 /
                numSymbols
            );


        const sx =
            cx +
            radius *
            Math.cos(angle);

        const sy =
            cy +
            radius *
            Math.sin(angle);


        const size =
            Math.max(
                3,
                radius * 0.06
            );


        if (
            i % 3 === 0
        ) {

            ctx.beginPath();

            ctx.moveTo(
                sx,
                sy - size
            );

            ctx.lineTo(
                sx -
                size * 0.866,
                sy +
                size * 0.5
            );

            ctx.lineTo(
                sx +
                size * 0.866,
                sy +
                size * 0.5
            );

            ctx.closePath();

            ctx.stroke();

        } else if (
            i % 3 === 1
        ) {

            ctx.beginPath();

            ctx.moveTo(
                sx,
                sy - size
            );

            ctx.lineTo(
                sx + size,
                sy
            );

            ctx.lineTo(
                sx,
                sy + size
            );

            ctx.lineTo(
                sx - size,
                sy
            );

            ctx.closePath();

            ctx.stroke();

        } else {

            ctx.beginPath();

            ctx.arc(
                sx,
                sy,
                size,
                0,
                Math.PI * 2
            );

            ctx.stroke();
        }
    }


    ctx.restore();
}


// =====================================================
// MAGIC CIRCLE
// =====================================================

function drawMagicCircle(
    cx,
    cy,
    radius,
    time,
    intensity = 1
) {

    if (
        radius <= 0 ||
        intensity <= 0
    ) {

        return;
    }


    const alpha =
        Math.min(
            1,
            intensity
        );


    ctx.save();


    /*
        Glow
    */

    ctx.globalAlpha =
        alpha * 0.2;

    ctx.strokeStyle =
        "#ff6a00";

    ctx.lineWidth =
        4;

    ctx.shadowColor =
        "#ff6a00";

    ctx.shadowBlur =
        35;


    for (
        let g = 0;
        g < 3;
        g++
    ) {

        const r =
            radius *
            (
                1.15 +
                g * 0.08
            );


        ctx.beginPath();

        ctx.arc(
            cx,
            cy,
            r,
            0,
            Math.PI * 2
        );

        ctx.stroke();
    }


    /*
        Main outer circle
    */

    ctx.globalAlpha =
        alpha;

    ctx.shadowBlur =
        20;

    ctx.strokeStyle =
        "#ffd166";

    ctx.lineWidth =
        3;


    ctx.beginPath();

    ctx.arc(
        cx,
        cy,
        radius,
        0,
        Math.PI * 2
    );

    ctx.stroke();


    /*
        White highlight
    */

    ctx.shadowBlur =
        8;

    ctx.strokeStyle =
        "#ffffff";

    ctx.lineWidth =
        1;


    ctx.beginPath();

    ctx.arc(
        cx,
        cy,
        radius,
        0,
        Math.PI * 2
    );

    ctx.stroke();


    /*
        Rotating rune rings
    */

    drawRuneSegments(
        cx,
        cy,
        radius * 0.95,
        time * 0.8,
        36,
        2,
        "#ffd166",
        alpha * 0.9
    );


    drawRuneSegments(
        cx,
        cy,
        radius * 0.90,
        -time * 0.6,
        24,
        3,
        "#ff8c00",
        alpha * 0.7
    );


    /*
        Rotating octagon
    */

    ctx.strokeStyle =
        "#ffd166";

    ctx.lineWidth =
        2;

    ctx.shadowBlur =
        12;


    ctx.beginPath();


    for (
        let i = 0;
        i < 8;
        i++
    ) {

        const angle =
            time * 0.5 +
            i *
            (
                Math.PI / 4
            );


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


        if (
            i === 0
        ) {

            ctx.moveTo(x, y);

        } else {

            ctx.lineTo(x, y);
        }
    }


    ctx.closePath();

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
            -time * 0.4 +
            i *
            (
                Math.PI / 6
            );


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

        ctx.lineWidth =
            2;


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
            4,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }


    /*
        Inner circle
    */

    ctx.strokeStyle =
        "#ff8c00";

    ctx.lineWidth =
        2;


    ctx.beginPath();

    ctx.arc(
        cx,
        cy,
        radius * 0.65,
        0,
        Math.PI * 2
    );

    ctx.stroke();


    /*
        Two rotating squares
    */

    for (
        const offset of [
            0,
            Math.PI / 4
        ]
    ) {

        ctx.strokeStyle =
            "#ffd166";

        ctx.lineWidth =
            2;


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
                (
                    Math.PI / 2
                );


            const x =
                cx +
                radius *
                0.50 *
                Math.cos(angle);

            const y =
                cy +
                radius *
                0.50 *
                Math.sin(angle);


            if (
                i === 0
            ) {

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


    /*
        Center symbols
    */

    drawGeometricSymbols(
        cx,
        cy,
        radius * 0.35,
        -time * 2,
        6,
        "#ffffff",
        alpha
    );


    /*
        Pulsing center
    */

    const pulse =
        0.5 +
        0.5 *
        Math.sin(
            time * 8
        );


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


    ctx.globalAlpha =
        alpha;


    ctx.fillStyle =
        "#ffffff";

    ctx.shadowColor =
        "#ff9d1c";

    ctx.shadowBlur =
        25;


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


// =====================================================
// SPARK CLASS
// =====================================================

class Spark {

    constructor(x, y) {

        this.x = x;

        this.y = y;

        this.vx =
            Math.random() * 4 - 2;

        this.vy =
            Math.random() * 4 - 1;

        this.life =
            0.3 +
            Math.random() * 0.3;

        this.maxLife =
            this.life;

        this.size =
            2 +
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
            Math.max(
                0,
                this.life /
                this.maxLife
            );


        ctx.save();

        ctx.globalAlpha =
            alpha;

        ctx.fillStyle =
            "#ffb52e";

        ctx.shadowColor =
            "#ff6800";

        ctx.shadowBlur =
            12;


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


// =====================================================
// PORTAL PARTICLE
// =====================================================

class PortalParticle {

    constructor(
        cx,
        cy,
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
                Math.random() *
                0.2
            );


        this.x =
            cx +
            r *
            Math.cos(angle);

        this.y =
            cy +
            r *
            Math.sin(angle);


        this.vx =
            Math.random() *
            3 -
            1.5;

        this.vy =
            Math.random() *
            3 -
            1.5;


        this.life =
            0.3 +
            Math.random() *
            0.7;

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
            Math.max(
                0,
                this.life /
                this.maxLife
            );


        ctx.save();

        ctx.globalAlpha =
            alpha;

        ctx.fillStyle =
            "#ffd166";

        ctx.shadowColor =
            "#ff8c00";

        ctx.shadowBlur =
            12;


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


// =====================================================
// DRAW TRAIL
// =====================================================

function drawDrawingTrail() {

    if (
        drawingPoints.length < 2
    ) {

        return;
    }


    ctx.save();

    ctx.strokeStyle =
        "#ffb52e";

    ctx.lineWidth =
        3;

    ctx.lineCap =
        "round";

    ctx.lineJoin =
        "round";

    ctx.shadowColor =
        "#ff6800";

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


// =====================================================
// UPDATE PARTICLES
// =====================================================

function updateParticles(dt) {

    const aliveSparks = [];


    for (
        const spark of sparks
    ) {

        if (
            spark.update(dt)
        ) {

            spark.draw();

            aliveSparks.push(
                spark
            );
        }
    }


    sparks.length = 0;

    sparks.push(
        ...aliveSparks
    );


    const alivePortal = [];


    for (
        const particle of portalParticles
    ) {

        if (
            particle.update(dt)
        ) {

            particle.draw();

            alivePortal.push(
                particle
            );
        }
    }


    portalParticles.length = 0;

    portalParticles.push(
        ...alivePortal
    );
}


// =====================================================
// MEDIAPIPE RESULTS
// =====================================================

function onResults(results) {

    detectedHands = [];


    if (
        !results.multiHandLandmarks
    ) {

        return;
    }


    for (
        let i = 0;

        i <
        results.multiHandLandmarks.length;

        i++
    ) {

        const landmarks =
            results.multiHandLandmarks[i];


        let label =
            "Unknown";


        if (
            results.multiHandedness &&
            results.multiHandedness[i]
        ) {

            label =
                results
                    .multiHandedness[i]
                    .classification[0]
                    .label;
        }


        detectedHands.push({

            landmarks,

            label,

            palmOpen:
                isPalmOpen(
                    landmarks
                ),

            fist:
                isFist(
                    landmarks
                )
        });
    }
}


// =====================================================
// PROCESS CAMERA FRAME
// =====================================================

async function processFrame() {

    if (
        processing ||
        !video.videoWidth
    ) {

        requestAnimationFrame(
            processFrame
        );

        return;
    }


    processing = true;


    try {

        const width =
            video.videoWidth;

        const height =
            video.videoHeight;


        processCanvas.width =
            width;

        processCanvas.height =
            height;


        /*
            Mirror BEFORE MediaPipe.

            This replicates:

            image = cv2.flip(image, 1)
            results = hands.process(image_rgb)
        */

        processCtx.save();

        processCtx.translate(
            width,
            0
        );

        processCtx.scale(
            -1,
            1
        );


        processCtx.drawImage(
            video,
            0,
            0,
            width,
            height
        );


        processCtx.restore();


        await hands.send({
            image: processCanvas
        });

    } catch (error) {

        console.error(
            "MediaPipe frame error:",
            error
        );
    }


    processing = false;


    requestAnimationFrame(
        processFrame
    );
}


// =====================================================
// MAIN VISUAL LOOP
// =====================================================

function animate(now) {

    requestAnimationFrame(
        animate
    );


    if (
        !video.videoWidth
    ) {

        return;
    }


    const dt =
        Math.min(
            0.05,
            (
                now -
                lastTime
            ) / 1000
        );


    lastTime =
        now;


    const time =
        (
            now -
            startTime
        ) / 1000;


    const width =
        video.videoWidth;

    const height =
        video.videoHeight;


    if (
        canvas.width !== width ||
        canvas.height !== height
    ) {

        canvas.width =
            width;

        canvas.height =
            height;
    }


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    /*
        Detect visible hands.
    */

    let leftFistPresent =
        false;

    let rightHand =
        null;


    for (
        const hand of detectedHands
    ) {

        /*
            IMPORTANT:

            Because we mirror BEFORE
            MediaPipe exactly like your
            Python program, we keep your
            original mapping:

            MediaPipe "Right"
                = visible LEFT hand

            MediaPipe "Left"
                = visible RIGHT hand
        */


        const isVisibleLeft =
            hand.label === "Right";

        const isVisibleRight =
            hand.label === "Left";


        if (
            isVisibleLeft &&
            hand.fist
        ) {

            leftFistPresent =
                true;
        }


        if (
            isVisibleRight
        ) {

            rightHand =
                hand;
        }


        /*
            Open palm rune.

            Same behavior as your Python:
            palm_open + no drawing
            + no portal.
        */

        if (
            hand.palmOpen &&
            !portalActive &&
            drawingPoints.length === 0
        ) {

            const center =
                getPalmCenter(
                    hand.landmarks,
                    width,
                    height
                );


            const palmSize =
                getPalmSize(
                    hand.landmarks,
                    width,
                    height
                );


            drawMagicCircle(
                center.x,
                center.y,
                palmSize * 1.5,
                time,
                0.8
            );
        }
    }


    /*
        LEFT FIST + RIGHT HAND
    */

    if (
        leftFistPresent
    ) {

        if (
            !portalActive
        ) {

            if (
                rightHand
            ) {

                const index =
                    rightHand
                        .landmarks[8];


                const ix =
                    index.x *
                    width;

                const iy =
                    index.y *
                    height;


                drawingPoints.push({
                    x: ix,
                    y: iy
                });


                /*
                    Spark particles,
                    exactly like Python's
                    four Spark objects.
                */

                for (
                    let i = 0;
                    i < 4;
                    i++
                ) {

                    sparks.push(
                        new Spark(
                            ix,
                            iy
                        )
                    );
                }


                /*
                    Maximum trail length.
                */

                if (
                    drawingPoints.length >
                    100
                ) {

                    drawingPoints.shift();
                }


                /*
                    Circle detection.

                    Same values as Python.
                */

                const circle =
                    checkCircleGesture(
                        drawingPoints,
                        250,
                        50
                    );


                if (
                    circle.detected
                ) {

                    portalActive =
                        true;


                    portalCenter =
                        circle.center;


                    portalRadius =
                        Math.max(
                            circle.radius,
                            120
                        ) * 1.2;


                    drawingPoints = [];


                    portalMessage.classList.add(
                        "active"
                    );


                    gestureText.textContent =
                        "Portal activated";
                }
            }

        } else {

            /*
                Keep portal alive
                while fist is held.
            */

            portalIntensity =
                Math.min(
                    1,
                    portalIntensity +
                    dt * 2
                );


            drawingPoints = [];
        }

    } else {

        /*
            Release fist.

            Same behavior as Python.
        */

        portalIntensity =
            Math.max(
                0,
                portalIntensity -
                dt * 2
            );


        if (
            portalIntensity <= 0
        ) {

            portalActive =
                false;


            portalMessage.classList.remove(
                "active"
            );
        }


        drawingPoints = [];
    }


    /*
        Draw finger trail.
    */

    if (
        drawingPoints.length > 1
    ) {

        drawDrawingTrail();
    }


    /*
        Draw active portal.
    */

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


        /*
            Generate portal particles.
        */

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
                    new PortalParticle(
                        portalCenter.x,
                        portalCenter.y,
                        portalRadius
                    )
                );
            }
        }
    }


    /*
        Particle rendering.
    */

    updateParticles(dt);


    /*
        Limit particles.
    */

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


    /*
        UI status.
    */

    if (
        detectedHands.length === 0
    ) {

        gestureText.textContent =
            "No hands detected";

    } else if (
        leftFistPresent &&
        rightHand
    ) {

        gestureText.textContent =
            "Draw a circle with your right index";

    } else if (
        detectedHands.some(
            hand =>
                hand.palmOpen
        )
    ) {

        gestureText.textContent =
            "Open palm detected";

    } else {

        gestureText.textContent =
            "Hand detected";
    }
}


// =====================================================
// CAMERA
// =====================================================

async function startCamera() {

    try {

        statusText.textContent =
            "Requesting camera...";


        stream =
            await navigator.mediaDevices.getUserMedia({

                video: {

                    facingMode:
                        "user",

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
            "Loading hand tracking...";


        /*
            Start MediaPipe.
        */

        hands =
            new Hands({

                locateFile:
                    function(file) {

                        return (
                            "https://cdn.jsdelivr.net/npm/@mediapipe/hands/" +
                            file
                        );
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


        loading.classList.add(
            "hidden"
        );


        statusDot.classList.add(
            "active"
        );


        statusText.textContent =
            "Hand tracking active";


        startTime =
            performance.now();

        lastTime =
            performance.now();


        requestAnimationFrame(
            processFrame
        );

        requestAnimationFrame(
            animate
        );

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
            "Camera access failed";


        statusDot.classList.remove(
            "active"
        );
    }
}


// =====================================================
// BUTTON
// =====================================================

startButton.addEventListener(
    "click",
    startCamera
);


// =====================================================
// START
// =====================================================

startCamera();
