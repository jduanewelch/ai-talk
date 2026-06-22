<div align="center">
  <h1>🤖 J.A.R.V.I.S. Local AI</h1>
  <p><i>A completely offline, voice-activated AI assistant running locally via Ollama.</i></p>
</div>

---

## ⚡ Overview
J.A.R.V.I.S. is a futuristic, highly responsive voice assistant that runs entirely locally on your machine. By leveraging an unfiltered LLM (`dolphin-llama3` via Ollama) and natural voice synthesis, it ensures 100% privacy with zero cloud dependencies. It features dynamic tool-calling, real-time system telemetry streaming, and a high-tech sci-fi visual interface.

## 🚀 Features
- **100% Offline & Private:** Powered by local Ollama instances.
- **Voice Activation:** "Jarvis" wake-word detection using Web Speech API.
- **Dual Interfaces:** Use the stunning sci-fi Web HUD or run it silently as a terminal daemon.
- **Cross-Platform Support:** Installers and guides for Windows, Linux, Android, and iOS.

---

## 💻 Desktop Installation (Windows & Linux)

J.A.R.V.I.S. requires a backend server to process AI models and a frontend interface to display the HUD. 

### Prerequisites
1. **[Install Ollama](https://ollama.com/)** on your system.
2. Pull the AI model: `ollama run dolphin-llama3` (or any model you prefer).
3. **[Install Python 3.10+](https://www.python.org/downloads/)**.

### Method 1: Running from Source
1. Clone the repository: `git clone https://github.com/jduanewelch/ai-talk.git`
2. Install dependencies: `pip install -r requirements.txt`
3. Run the server: `python server.py`
4. Open `http://localhost:8000` in your Chrome/Edge browser.

### Method 2: Creating a Standalone Executable
You can package J.A.R.V.I.S. into a single, clickable desktop application using PyInstaller.
1. Install PyInstaller: `pip install pyinstaller`
2. Compile the app: 
   ```bash
   pyinstaller --name "JarvisUI" --windowed --add-data "static:static" --add-data "templates:templates" server.py
   ```
3. Your standalone application will be generated inside the `dist/` folder! You can now move this `.exe` (Windows) or binary (Linux) anywhere on your system.

---

## 📱 Mobile Installation (Android & iPhone)

Because running massive language models requires dedicated PC hardware (RAM and GPU), smartphones cannot natively run the local Ollama engine. 

Instead, J.A.R.V.I.S. uses a **Server-Client Architecture** for mobile. Your PC runs the heavy lifting, and your phone acts as the remote microphone and speaker.

### Step 1: Configure Your Desktop Server
1. Ensure your PC (running the J.A.R.V.I.S. `server.py`) and your smartphone are connected to the **same WiFi network**.
2. Find your PC's local IP address:
   - **Windows:** Open Command Prompt and type `ipconfig` (Look for IPv4 Address, e.g., `192.168.1.50`).
   - **Linux:** Open Terminal and type `ip a` or `ifconfig`.
3. Start the server on your PC. *(Note: Ensure `uvicorn` is bound to `0.0.0.0` instead of `localhost` so external devices can connect).*

### Step 2: Connect Your Phone (iOS & Android)
1. Open **Safari (iPhone)** or **Chrome (Android)** on your phone.
2. Navigate to your PC's IP address and port (e.g., `http://192.168.1.50:8000`).
3. You will see the J.A.R.V.I.S. HUD load perfectly on your mobile screen.
4. **Make it an App:**
   - **iPhone:** Tap the "Share" icon at the bottom of Safari and select **"Add to Home Screen"**.
   - **Android:** Tap the three-dot menu in Chrome and select **"Add to Home Screen"**.
5. You now have a standalone J.A.R.V.I.S. app icon on your phone! Tap it to launch the interface natively, toggle the wake-word, and speak to your PC from anywhere in the house.

---

## ⌨️ Advanced: Linux Global Shortcuts
Want to trigger J.A.R.V.I.S. instantly without the browser? You can run it silently in the background:
1. Open your Desktop Environment Settings (GNOME/KDE).
2. Navigate to **Custom Shortcuts** -> Add New.
3. **Command:** `/path/to/your/venv/bin/python /path/to/jarvis_voice.py`
4. Bind it to a key combination like `Super + J`.
5. Press the shortcut, wait for the chime, and speak!

---
*Developed by Jonathan Welch*
