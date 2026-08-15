# Doctor Strange Portal

A browser-based hand gesture experiment inspired by magical portal effects.

The project uses your webcam and hand tracking to create animated magical circles, sparks, particles, and a portal that can be activated using hand gestures.

Everything runs directly in the browser, so there is no Python backend or server-side processing required.

## Live Demo

Run the project directly in your browser:

https://YOUR-VERCEL-LINK.vercel.app/

## How It Works

The application uses the webcam to detect hand landmarks in real time.

Different hand gestures trigger different visual effects:

- Open palm → magical hand runes
- Left fist → enables portal drawing mode
- Right index finger → draws the portal circle
- Completed circle → activates the portal
- Portal active → animated runes, particles, sparks, and rotating symbols

## Controls

### Open Palm

Show an open palm to the camera.

The application displays a magical circular rune around the hand.

Both hands can generate the effect independently.

### Draw the Portal

1. Make a fist with your left hand.
2. Keep the fist visible.
3. Use your right index finger to draw a circle.
4. Complete the circle.

Once a sufficiently large closed circle is detected, the portal activates.

### Portal

After the circle is detected, the application generates:

- Rotating rune segments
- Geometric symbols
- Multiple circular layers
- Radial markings
- Glowing particles
- Spark effects
- A pulsing center

## Tech Stack

- HTML
- CSS
- JavaScript
- MediaPipe Hands
- Canvas 2D API
- Browser Web Camera API
- Vercel

## Project Structure

```text
doctor-strange-portal/
│
├── index.html
├── app.js
├── style.css
└── README.md
