# J.A.R.V.I.S. // Voice AI Assistant for Linux

A futuristic, highly responsive voice assistant running entirely locally on Linux. Uses an unfiltered LLM (`dolphin-llama3` via Ollama) and natural voice synthesis.

## Core Interaction Interfaces

### Option A: Web HUD Dashboard
1. Run the server (already running in the background):
   ```bash
   .venv/bin/python server.py
   ```
2. Navigate to `http://localhost:8000` in Chrome/Chromium.
3. Toggle the **Wake Word ("Jarvis")** switch to activate hands-free continuous monitoring.

### Option B: Terminal CLI (Runs in background, no browser required)
1. **Continuous Chat Loop**:
   Run the voice assistant as a looping terminal daemon:
   ```bash
   .venv/bin/python jarvis_voice.py --continuous
   ```

2. **One-Shot Trigger (Global Shortcut)**:
   Run the voice assistant for a single prompt and exit:
   ```bash
   .venv/bin/python jarvis_voice.py
   ```
   **Setting up a global shortcut in Linux (GNOME/KDE/etc.):**
   * Go to **Settings** -> **Keyboard** -> **Custom Shortcuts** -> Add (`+`).
   * **Name**: `J.A.R.V.I.S.`
   * **Command**: `/home/jonathan/ai talk/.venv/bin/python "/home/jonathan/ai talk/jarvis_voice.py"`
   * **Shortcut**: Choose a key bind (e.g. `Super + J`).
   * Press the shortcut from anywhere on your desktop, wait for the chime, speak your prompt, and hear the response!
