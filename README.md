# 🤖 RME SENTINEL — Amazon MCC1 Technician AI Sidekick

> **Intelligent Multimodal Tablet Sidekick for Amazon Reliability, Maintenance, and Engineering (RME) Service Technicians at MCC1 (Rancho Cordova Cross-Dock).**

---

## ⚡ Overview
**RME Sentinel** is a purpose-built, safety-first AI copilot designed for Amazon RME Technicians (Tech II, Tech III, Control Systems Leads, and Robotics Specialists) working in high-throughput fulfillment and cross-dock environments.

### 🌟 Key Capabilities
* **📸 Multimodal Vision & Camera Inspection:** Snap photos of PowerFlex 525 VFD faults, Banner Q4X photoeye alignment LEDs, broken sorter shoes, or loose drive chains. The AI analyzes the image, places HUD visual marker boxes around the fault, and generates step-by-step troubleshooting.
* **🛡️ Strict Safety & LOTO Gatekeeping:** Prominent, non-blocking contextual Red/Amber safety cards for Lockout/Tagout (LOTO), Arc Flash NFPA 70E PPE categories, zero-energy multi-meter try-step verification, pneumatic air dumps, and hydraulic safety prop bars.
* **🎧 Bluetooth Headset Voice HUD:** Hands-free two-way audio dictation (Speech-to-Text) and crisp step-by-step audio narration (Text-to-Speech) so technicians can work with tools while listening to the AI.
* **📋 Shift Passdown & Work Order Logger:** Log work orders, parts used, downtime, and generate executive shift handoff summaries ready to paste into Slack, Chime, or email.
* **🔍 Nameplate & Sensor OCR Scanner:** Extract Full Load Amps (FLA), voltage, horsepower, RPM, gear ratios, and wiring pinouts from motor nameplates and sensor labels.
* **🧮 RME Field Calculators:** Built-in calculators for V-Belt Sonic Tension Frequency (Hz), 3-Phase Motor FLA & Wire Sizing, Fastener Torque Specs, and Hydraulic Cylinder Lift Force (PSI ↔ Tonnage).
* **📱 Tablet PWA Mode:** Glove-friendly touch targets (52px+ buttons, oversized checkboxes), high-contrast tactical dark theme, and offline-resilient local queuing.

---

## 🌐 Dual Hosting Modes

### Mode 1: 100% Serverless on GitHub Pages (Zero Server Needed!)
Because RME Sentinel includes direct client-side Google Gemini REST API support, you can host the entire app completely free on **GitHub Pages**:
1. Push this repository to GitHub.
2. Go to **Repository Settings** ➔ **Pages**.
3. Under **Build and deployment** ➔ **Branch**, select `main` and folder `/ (root)` or `/docs`.
4. Click **Save**.
5. Your live app URL will be:
   ```
   https://<your-username>.github.io/ai-talk/
   ```
6. Open that URL in Chrome on your Android tablet, tap the three dots ➔ **"Add to Home Screen"** to install it as a standalone full-screen tablet app!
7. Enter your Gemini API key in **Settings** (it saves securely in your tablet's local storage).

---

### Mode 2: Local / Site Network Server (Python FastAPI)
Run the backend server on your PC or local warehouse network:

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure .env with your Gemini API Key
echo "GEMINI_API_KEY=your_key_here" > .env

# 3. Start the FastAPI server
python server.py
```

* **Local Machine:** Open `http://localhost:8000` in your browser.
* **Android Tablet on same Wi-Fi:** Open `http://<your-pc-ip>:8000` on your tablet.

---

## 🏭 Amazon MCC1 Equipment Profiles Covered
* **Inbound & Docks:** Caljan extendable boom conveyors, Rite-Hite hydraulic dock levelers, Dok-Lok vehicle restraints.
* **Sortation & Conveyors:** Dematic & Vanderlande sliding shoe sorters, Intralox ARB switches, Interroll / Itoh Denki MDR ZPA accumulation, AmbaFlex spiral conveyors.
* **Controls & Electrical:** Allen-Bradley ControlLogix / Studio 5000, PowerFlex 525 & 755 VFDs, SEW Eurodrive Movimot, Banner Q4X/QS18 photoeyes, Sick laser scanners, 480VAC/120VAC/24VDC circuits.
* **Mezzanine & Bulk:** VRCs (Vertical Reciprocating Conveyor lifts), stretch wrappers, balers.

---

## 📱 PWA Tablet Installation
1. Open the app URL on Chrome on your Android Tablet.
2. Tap the three dots menu in the upper right.
3. Tap **"Add to Home Screen"** or **"Install App"**.
4. Launch "RME Sentinel" directly from your home screen in full-screen industrial mode!
