I have completed the requested improvements for "Auto Spin (Gyro)" and "Mobile UI".

### 1. Auto Spin & Gyroscope Fix (Fixes & New Features)

* **Implemented** **`GyroController.js`**:

  * **Parallax Tilt**: The game view now tilts slightly with your device (3D effect), using smooth interpolation (LERP) to prevent jitter.

  * **Shake-to-Spin**: Shaking the device triggers the "Auto Spin" toggle.

  * **Angle Limits**: Restricted tilt to +/- 0.15 radians (\~8.5 degrees) to prevent dizziness.

  * **Permissions**: Automatically requests iOS Sensor permissions on the first "Spin" click.

### 2. Mobile UI Enhancements

* **Touch Area Adjustment**: Added a global function to resize button touch targets dynamically.

* **Sensitivity Control**: Added a global function to adjust gyro sensitivity.

### 3. How to Test / Adjust (Console Commands)

Since there is no dedicated Settings Menu yet, you can adjust these values in the browser console:

```javascript
// Adjust Gyro Sensitivity (Default: 0.08)
window.setGyroSensitivity(0.15); 

// Adjust Button Size (Default: 1.0)
// 1.2 = 20% larger buttons
window.adjustTouchArea(1.2); 
```

### 4. Code Changes

* **Created**: `src/systems/GyroController.js`

* **Modified**: `src/main.js` (Integrated Gyro, added global settings)

* **Verified**: `index.html` (UI Styles are already applied)

