# BadgeBeam

BadgeBeam is a cross-platform companion application designed specifically for the BeagleBadge. It allows you to select images from your phone or computer, automatically dither them into 1-bit monochrome formats suitable for E-ink displays, and beam them wirelessly over Bluetooth Low Energy (BLE) directly to the badge.

## Features
- **Image Processing**: Automatically crops, resizes (to 400x300), and applies Floyd-Steinberg dithering to images for optimal E-ink display.
- **Cross-Platform**: Built with React, Vite, and Capacitor. Works as a Web App (PWA), and can be packaged for Android & iOS.
- **WebBLE Integration**: Connects and transfers 15,000-byte binary payloads directly via Bluetooth from the browser.

---

## ⚠️ Important Note for Linux Users (Chrome/Edge)

Web Bluetooth is not enabled by default on Linux browsers. To use the WebBLE scanning and connection features from a Linux desktop:

1. Open your Chromium-based browser (Chrome, Edge, Brave, etc.).
2. Navigate to `chrome://flags/`
3. Search for **Experimental Web Platform features** (`#enable-experimental-web-platform-features`).
4. Set it to **Enabled** and restart your browser.

---

## Running the Web Frontend

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173/` in your browser.

---

## BeagleBadge Hardware Setup

To receive images on the Linux-based BeagleBadge, you need to set up the receiver app and background Bluetooth service on the device.

### 1. Bluetooth Infrastructure (BlueZ)
The BeagleBadge must have its hardware Bluetooth controller powered on and the DBus service correctly configured with experimental LE features.

On the BeagleBadge (as root):
```bash
# Bind the TI Bluetooth chip to the kernel
/usr/local/bin/enable-cc33xx-ble.sh

# Edit /lib/systemd/system/bluetooth.service
# Find the line starting with "ExecStart=" and append "-E" to the end:
# ExecStart=/usr/libexec/bluetooth/bluetoothd -E

# Reload and restart Bluetooth
systemctl daemon-reload
systemctl enable --now bluetooth

# Make the device discoverable and pairable
bluetoothctl discoverable on
bluetoothctl pairable on
```

*Note: You may also need python DBus bindings on the badge: `apt-get install python3-gi python3-dbus dbus-user-session`*

### 2. BadgeBeam LVGL App
Copy the MicroPython application to the `badge-slop` framework folder structure:

```bash
mkdir -p /opt/badge_launcher/applications/apps/badgebeam
cp path/to/badgebeam_app.py /opt/badge_launcher/applications/apps/badgebeam/
```

This app expects to read a raw 1-bit 15,000-byte file located at `latest.bin` in that directory and wraps an LVGL `lv.image_dsc_t` over it for instant hardware rendering.

### 3. Background BLE Server
Copy the Python GATT server script `badgebeam_bleserver.py` to `/opt/badge_launcher/scripts/` and run it in the background:

```bash
chmod +x /opt/badge_launcher/scripts/badgebeam_bleserver.py
nohup python3 /opt/badge_launcher/scripts/badgebeam_bleserver.py > /tmp/ble.log 2>&1 &
```

This script advertises the custom UUIDs, receives the 120-byte payload chunks from the Web App, and smoothly writes the reconstructed 15,000-byte `latest.bin` file for the microPython app to display.
