# Doctor Strange Portal Effect

A real-time visual effect using your webcam to create Doctor Strange style magical runes and portals using hand gestures!

## Installation

1. Install Python 3.
2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## How to Run

Run the script from your terminal:
```bash
python app.py
# (Or python3 app.py depending on your installation)
```

## How to Use

1. **Open Palm**: Hold your palm open to reveal small magical hand runes around your hand.
2. **Open Portal**: Make a **fist with your left hand** and draw a **circle with your right index finger** to open a magical portal!
3. **Quit**: Press the `q` key or `ESC` on your keyboard to close the application.

## Troubleshooting the Camera

If the script runs but your camera doesn't turn on (or the wrong camera is selected), you will need to change the camera index in the code.

1. Open `app.py` in your code editor.
2. Go to around **line 237** and look for this line:
   ```python
   cap = cv2.VideoCapture(1)
   ```
3. Change the `1` inside `cv2.VideoCapture()` to `0` or `2` depending on which webcam you want to use.
   - `0` is usually the default built-in webcam.
   - `1`, `2`, etc. are usually external webcams or virtual cameras.
