/**
 * Amazon RME Copilot - MCC1 Tablet Client Application
 * Supports Dual Mode: Local/Cloud Python Backend OR 100% Serverless GitHub Pages Direct-to-Gemini
 */

const RME_SYSTEM_PROMPT = `
You are "RME Sentinel", an expert AI Senior Reliability, Maintenance, and Engineering (RME) Specialist and Control Systems Lead (CSL) acting as an on-the-floor tablet sidekick for an Amazon Service Technician at Amazon MCC1 (Rancho Cordova, CA - Inbound Cross-Dock / IXD facility).

FACILITY CONTEXT:
- Amazon MCC1 is an Inbound Cross-Dock facility (629k sq ft, 132 dock doors, high-speed automated sorting, mezzanine decks, big-rig intake).
- Key Equipment Domains:
  1. Inbound & Dock: Caljan / FMH telescoping extendable boom conveyors, Rite-Hite hydraulic dock levelers, Dok-Lok vehicle restraints, dock seals, truck restraint interlocks.
  2. Sortation & Merge: High-speed sliding shoe sorters (Dematic, Vanderlande, Intelligrated), Intralox ARB (Activated Roller Belt) aligners and switches, Sawtooth merges, MDR (Motorized Drive Rollers - Interroll EC310/EC5000, Itoh Denki PM605FE) zero-pressure accumulation (ZPA) zones, AmbaFlex spiral conveyors, incline/decline flat belts.
  3. Controls & Electrical: Allen-Bradley ControlLogix / CompactLogix (Studio 5000), PowerFlex 525 & 755 VFDs (F004 UnderVolt, F005 OverVolt, F007 Motor Overload, F012 HW OverCurrent, F013 Ground Fault, F070 Power Unit, F081 Comm Loss), SEW Eurodrive / Movimot gearmotors, Banner Q4X distance laser sensors, QS18 photoeyes, Sick laser scanners, Point I/O, 480VAC 3-phase, 120VAC, 24VDC control circuits.
  4. Mezzanine & Bulk: VRCs (Vertical Reciprocating Conveyors - Pflow/Wildeck), stretch wrappers, balers, air compressors.

SAFETY & PROTOCOL MANDATES:
- Always prioritize Technician Safety (OSHA 1910.147, NFPA 70E Arc Flash, Class 0/00 1000V rated gloves, 3-point contact, Fall Protection harness, Lockout/Tagout - LOTO).
- Always include explicit Zero-Energy verification steps (meter try-step: test live circuit, test zero on isolated circuit, test live circuit again).
- Always flag Stored Energy Hazards (pneumatic air bleeder valves, mechanical safety prop bars for dock levelers, gravity-loaded VRC carriages, counterweights).
- VISUAL AIDS: You MUST include a visual reference whenever you think seeing the component would be helpful to the tech (e.g. for locating obscure parts, verifying status lights, or confirming safety lockouts).
  -> Use these exact filenames in the 'visual_reference' field when applicable:
     - 'pneumatic_lockout_valve.png' (For air bleeder valves / pneumatic LOTO)
     - 'powerflex_vfd.png' (For VFD panels, drive faults, and parameter checks)
     - 'photoeye_sensor.png' (For photoelectric sensors, alignment, and reflector checks)
     - 'electrical_disconnect_loto.png' (For main electrical disconnects and LOTO application)
     - 'rwc4_v6_robot_arm.png' (For RWC4 v6 robotic arm calibration, fault recovery, and end-effector checks)

OUTPUT FORMAT:
You MUST respond with valid JSON matching the following structure:
{
  "problem_title": "Short descriptive title of the issue",
  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "subsystem": "Conveyor | VFD/Controls | Sorter | Dock/Boom | Sensor | Hydraulic/Pneumatic",
  "equipment_identified": "Identified machine/component name and model",
  "summary": "Clear, concise technical summary of what was detected and the root cause hypothesis.",
  "safety_warnings": [
    {
      "level": "DANGER" | "WARNING" | "CAUTION",
      "type": "LOTO | ARC_FLASH | PINCH_POINT | STORED_ENERGY | WORKING_AT_HEIGHTS",
      "message": "Specific safety action (e.g. Disconnect Main 480V Breaker at Panel DP-3, perform Try-Step with Cat III 600V meter, apply Safety Prop bar before working under leveler lip)."
    }
  ],
  "required_ppe": ["Arc Flash Shield", "Class 00 Insulated Gloves", "Kevlar Cut-5 Gloves", "Safety Glasses", "Steel Toe Boots"],
  "required_tools": ["Calibrated Fluke Multimeter", "Metric Allen Hex Set", "Torque Wrench (25-50 ft-lbs)", "Jam Pole", "Wire Stripper/Ferrule Crimper"],
  "visual_markers": [
    {
      "label": "Fault / Component tag",
      "description": "What to look at in the image",
      "box_2d": [0, 0, 0, 0]
    }
  ],
  "steps": [
    {
      "step_number": 1,
      "title": "Short step header",
      "instruction": "Detailed, practical step-by-step instructions written for an RME technician.",
      "safety_note": "Optional specific hazard warning for this single step or null",
      "specs": "Optional electrical or mechanical spec (e.g. 'Target: 480VAC +/- 5%, Torque: 35 ft-lbs, Air: 90 PSI') or null",
      "visual_reference": "Optional filename if visually verifying a standard component (e.g., 'pneumatic_lockout_valve.png') or null",
      "pro_tip": "Amazon RME best practice tip for longevity or quick diagnosis"
    }
  ],
  "quick_verification": "Final test procedure to confirm the fix before releasing equipment back to Operations.",
  "spoken_summary": "A natural, crisp 2-to-3 sentence audio script designed to be read aloud via Bluetooth headphones to the technician."
}
`;

const OCR_PROMPT = `
You are an expert Optical Character Recognition (OCR) and technical specification extractor for industrial warehouse equipment at Amazon MCC1.
Analyze the provided image of an industrial nameplate, sensor label, motor tag, VFD label, or electrical component.

Return a valid JSON object with the following fields:
{
  "manufacturer": "e.g. SEW-Eurodrive / Allen-Bradley / Banner / Baldor / Siemens",
  "model_number": "Exact model or part number",
  "serial_number": "Serial number if visible",
  "equipment_type": "3-Phase Induction Motor | VFD Inverter | Photoeye Sensor | Gearbox | Breaker",
  "electrical_specs": {
    "voltage": "e.g. 230/460 VAC",
    "full_load_amps_fla": "e.g. 4.8 / 2.4 A",
    "frequency_hz": "60 Hz",
    "phase": "3 Phase",
    "horsepower_hp": "e.g. 2.0 HP",
    "rpm": "e.g. 1750 RPM"
  },
  "mechanical_specs": {
    "gear_ratio": "e.g. 15.4:1",
    "frame_size": "e.g. 56C",
    "torque_rating": "e.g. 120 Nm",
    "shaft_diameter": "e.g. 1-1/8 in"
  },
  "sensor_specs": {
    "sensing_range": "e.g. 0-300 mm",
    "output_type": "PNP / NPN / IO-Link",
    "supply_voltage": "10-30 VDC",
    "pinout": "Pin 1: Brown (+24V), Pin 2: White (NC), Pin 3: Blue (0V), Pin 4: Black (NO)"
  },
  "replacement_notes": "Key compatibility requirements or Amazon stock equivalent recommendations."
}
`;

const PASSDOWN_PROMPT = `
You are an Amazon RME Area Maintenance Manager / Lead synthesizing a shift handoff report for Amazon MCC1 (Rancho Cordova Cross-Dock).
Given the following list of maintenance logs, repairs, and inspections completed during this shift, generate a professional, high-impact Shift Passdown formatted in Markdown.

Include:
1. Executive Summary & Site Health (Line uptime, major breakdowns, SEV escalations)
2. Completed Work Orders & Corrective Actions
3. Open / Pending Follow-ups for the Oncoming Shift
4. Parts Used & Re-order Alerts
5. 5S & Safety Status
`;

// Application State
const state = {
  currentTab: 'tab-diagnostic',
  mediaStream: null,
  facingMode: 'environment', // Rear camera default for tablets
  capturedImageBase64: null,
  activeDiagnosticData: null,
  isRecordingVoice: false,
  recognition: null,
  audioElement: new Audio(),
  currentStepIndex: 0,
  voiceId: 'en-US-GuyNeural',
  ttsRate: '+10%',
  isOnline: navigator.onLine,
  geminiApiKey: localStorage.getItem('rme_gemini_api_key') || '',
  hasBackend: true,
  passdownLogs: JSON.parse(localStorage.getItem('rme_passdown_logs') || '[]')
};

// ==========================================================================
// INITIALIZATION
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  initCameraControls();
  initVoiceInput();
  initEquipmentPresets();
  initDiagnosticRunner();
  initPassdown();
  initOCR();
  initCalculators();
  initSettings();
  initNetworkMonitoring();
  initPWA();

  // Check if running on GitHub Pages (serverless mode)
  await checkBackendAvailability();
});

async function checkBackendAvailability() {
  try {
    const res = await fetch('/api/config', { method: 'GET', cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      state.hasBackend = true;
      if (!state.geminiApiKey && data.gemini_configured) {
        state.geminiApiKey = 'BACKEND_CONFIGURED';
      }
    } else {
      state.hasBackend = false;
    }
  } catch (err) {
    state.hasBackend = false;
    console.log('Running in GitHub Pages / Serverless Client Mode');
  }

  // Pre-fill settings if saved
  const cfgKey = document.getElementById('cfgGeminiKey');
  if (cfgKey && state.geminiApiKey && state.geminiApiKey !== 'BACKEND_CONFIGURED') {
    cfgKey.value = state.geminiApiKey;
  }
}

// ==========================================================================
// TABS NAVIGATION
// ==========================================================================

function initTabs() {
  const tabButtons = document.querySelectorAll('.nav-tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  state.currentTab = tabId;
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });

  if (tabId === 'tab-passdown') {
    loadPassdownList();
  }
}

// ==========================================================================
// CAMERA & IMAGE CANVAS HUB
// ==========================================================================

function initCameraControls() {
  const btnToggleCam = document.getElementById('btnToggleCam');
  const btnSnapPhoto = document.getElementById('btnSnapPhoto');
  const btnFlipCam = document.getElementById('btnFlipCam');
  const btnClearImage = document.getElementById('btnClearImage');
  const fileUploadInput = document.getElementById('fileUploadInput');

  btnToggleCam.addEventListener('click', async () => {
    if (state.mediaStream) {
      stopCamera();
    } else {
      await startCamera();
    }
  });

  btnSnapPhoto.addEventListener('click', () => {
    if (!state.mediaStream) return;
    captureFrameFromVideo();
  });

  btnFlipCam.addEventListener('click', async () => {
    state.facingMode = state.facingMode === 'environment' ? 'user' : 'environment';
    stopCamera();
    await startCamera();
  });

  btnClearImage.addEventListener('click', () => {
    clearCapturedImage();
  });

  fileUploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      loadImageToCanvas(event.target.result);
    };
    reader.readAsDataURL(file);
  });
}

async function startCamera() {
  const liveVideo = document.getElementById('liveVideo');
  const imageCanvas = document.getElementById('imageCanvas');
  const viewportPlaceholder = document.getElementById('viewportPlaceholder');
  const viewportCard = document.getElementById('viewportCard');
  const btnSnapPhoto = document.getElementById('btnSnapPhoto');
  const btnFlipCam = document.getElementById('btnFlipCam');
  const camBtnText = document.getElementById('camBtnText');

  try {
    const constraints = {
      video: {
        facingMode: { ideal: state.facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    state.mediaStream = stream;
    liveVideo.srcObject = stream;
    liveVideo.style.display = 'block';
    imageCanvas.style.display = 'none';
    viewportPlaceholder.style.display = 'none';
    viewportCard.classList.add('active-stream');

    btnSnapPhoto.style.display = 'flex';
    btnFlipCam.style.display = 'flex';
    camBtnText.textContent = 'Stop Camera';
    showToast('Camera active. Tap "Snap Photo" when focused on issue.', 'info');
  } catch (err) {
    console.error('Camera access error:', err);
    showToast('Could not access camera. You can still upload photos.', 'error');
  }
}

function stopCamera() {
  const liveVideo = document.getElementById('liveVideo');
  const viewportCard = document.getElementById('viewportCard');
  const btnSnapPhoto = document.getElementById('btnSnapPhoto');
  const btnFlipCam = document.getElementById('btnFlipCam');
  const camBtnText = document.getElementById('camBtnText');

  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(t => t.stop());
    state.mediaStream = null;
  }

  liveVideo.style.display = 'none';
  viewportCard.classList.remove('active-stream');
  btnSnapPhoto.style.display = 'none';
  btnFlipCam.style.display = 'none';
  camBtnText.textContent = 'Start Camera';
}

function captureFrameFromVideo() {
  const liveVideo = document.getElementById('liveVideo');
  const imageCanvas = document.getElementById('imageCanvas');
  const btnClearImage = document.getElementById('btnClearImage');
  const captureStatusLabel = document.getElementById('captureStatusLabel');

  imageCanvas.width = liveVideo.videoWidth || 1280;
  imageCanvas.height = liveVideo.videoHeight || 720;
  const ctx = imageCanvas.getContext('2d');
  ctx.drawImage(liveVideo, 0, 0, imageCanvas.width, imageCanvas.height);

  state.capturedImageBase64 = imageCanvas.toDataURL('image/jpeg', 0.88);
  stopCamera();

  imageCanvas.style.display = 'block';
  btnClearImage.style.display = 'flex';
  captureStatusLabel.textContent = 'Photo Captured';
  showToast('Photo captured! Ready for diagnostic dispatch.', 'success');
}

function loadImageToCanvas(dataUrl) {
  const imageCanvas = document.getElementById('imageCanvas');
  const liveVideo = document.getElementById('liveVideo');
  const viewportPlaceholder = document.getElementById('viewportPlaceholder');
  const btnClearImage = document.getElementById('btnClearImage');
  const captureStatusLabel = document.getElementById('captureStatusLabel');

  stopCamera();
  const img = new Image();
  img.onload = () => {
    imageCanvas.width = img.width;
    imageCanvas.height = img.height;
    const ctx = imageCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    state.capturedImageBase64 = dataUrl;
    liveVideo.style.display = 'none';
    viewportPlaceholder.style.display = 'none';
    imageCanvas.style.display = 'block';
    btnClearImage.style.display = 'flex';
    captureStatusLabel.textContent = 'Image Loaded';
    showToast('Equipment photo loaded successfully.', 'info');
  };
  img.src = dataUrl;
}

function clearCapturedImage() {
  const imageCanvas = document.getElementById('imageCanvas');
  const viewportPlaceholder = document.getElementById('viewportPlaceholder');
  const btnClearImage = document.getElementById('btnClearImage');
  const captureStatusLabel = document.getElementById('captureStatusLabel');

  stopCamera();
  state.capturedImageBase64 = null;
  const ctx = imageCanvas.getContext('2d');
  ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
  imageCanvas.style.display = 'none';
  viewportPlaceholder.style.display = 'flex';
  btnClearImage.style.display = 'none';
  captureStatusLabel.textContent = 'Ready';
}

function drawVisualMarkers(markers) {
  if (!markers || !markers.length || !state.capturedImageBase64) return;
  const imageCanvas = document.getElementById('imageCanvas');
  const ctx = imageCanvas.getContext('2d');

  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, imageCanvas.width, imageCanvas.height);

    markers.forEach((m, idx) => {
      if (m.box_2d && m.box_2d.length === 4 && (m.box_2d[2] > 0 || m.box_2d[3] > 0)) {
        const [ymin, xmin, ymax, xmax] = m.box_2d;
        const x = (xmin / 1000) * imageCanvas.width;
        const y = (ymin / 1000) * imageCanvas.height;
        const w = ((xmax - xmin) / 1000) * imageCanvas.width;
        const h = ((ymax - ymin) / 1000) * imageCanvas.height;

        ctx.strokeStyle = '#FF9900';
        ctx.lineWidth = Math.max(4, imageCanvas.width / 300);
        ctx.strokeRect(x, y, w, h);

        const tick = Math.min(w, h) * 0.2;
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = Math.max(5, imageCanvas.width / 250);
        ctx.beginPath(); ctx.moveTo(x, y + tick); ctx.lineTo(x, y); ctx.lineTo(x + tick, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + w, y + h - tick); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - tick, y + h); ctx.stroke();

        ctx.fillStyle = 'rgba(7, 10, 16, 0.85)';
        const text = m.label || `Fault Zone #${idx+1}`;
        ctx.font = `bold ${Math.max(16, imageCanvas.width / 40)}px Inter, sans-serif`;
        const textWidth = ctx.measureText(text).width;
        ctx.fillRect(x, Math.max(0, y - 28), textWidth + 16, 26);
        ctx.fillStyle = '#FF9900';
        ctx.fillText(text, x + 8, Math.max(18, y - 9));
      }
    });
  };
  img.src = state.capturedImageBase64;
}

// ==========================================================================
// VOICE INPUT & BLUETOOTH AUDIO (SPEECH RECOGNITION & TTS)
// ==========================================================================

function initVoiceInput() {
  const btnToggleMic = document.getElementById('btnToggleMic');
  const inputDescription = document.getElementById('inputDescription');
  const micStatusText = document.getElementById('micStatusText');

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micStatusText.textContent = 'Voice (No Browser Mic)';
    return;
  }

  state.recognition = new SpeechRecognition();
  state.recognition.continuous = true;
  state.recognition.interimResults = true;
  state.recognition.lang = 'en-US';

  state.recognition.onstart = () => {
    state.isRecordingVoice = true;
    btnToggleMic.classList.add('recording');
    micStatusText.textContent = 'Listening...';
  };

  state.recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    if (transcript.trim()) {
      inputDescription.value = transcript;
    }
  };

  state.recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    stopVoiceRecognition();
  };

  state.recognition.onend = () => {
    stopVoiceRecognition();
  };

  btnToggleMic.addEventListener('click', () => {
    if (state.isRecordingVoice) {
      state.recognition.stop();
      stopVoiceRecognition();
    } else {
      try {
        state.recognition.start();
      } catch (err) {
        console.error('Error starting speech:', err);
      }
    }
  });
}

function stopVoiceRecognition() {
  const btnToggleMic = document.getElementById('btnToggleMic');
  const micStatusText = document.getElementById('micStatusText');
  state.isRecordingVoice = false;
  btnToggleMic.classList.remove('recording');
  micStatusText.textContent = 'Voice Dictation';
}

function speakText(text, onComplete) {
  const audioHudBar = document.getElementById('audioHudBar');
  const playAudioText = document.getElementById('playAudioText');

  if (!text || !text.trim()) return;

  state.audioElement.pause();
  state.audioElement.src = '';
  window.speechSynthesis && window.speechSynthesis.cancel();

  audioHudBar.classList.add('playing');
  playAudioText.textContent = 'Playing...';

  // If backend available, try Edge-TTS stream
  if (state.hasBackend) {
    const ttsUrl = `/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(state.voiceId)}&rate=${encodeURIComponent(state.ttsRate)}`;
    state.audioElement.src = ttsUrl;
    
    state.audioElement.onended = () => {
      audioHudBar.classList.remove('playing');
      playAudioText.textContent = 'Read Aloud';
      if (onComplete) onComplete();
    };

    state.audioElement.onerror = () => {
      fallbackWebSpeech(text, onComplete);
    };

    state.audioElement.play().catch(() => {
      fallbackWebSpeech(text, onComplete);
    });
  } else {
    // 100% Client-Side Web Speech Synthesis for GitHub Pages
    fallbackWebSpeech(text, onComplete);
  }
}

function fallbackWebSpeech(text, onComplete) {
  const audioHudBar = document.getElementById('audioHudBar');
  const playAudioText = document.getElementById('playAudioText');

  if ('speechSynthesis' in window) {
    const cleanText = text.replace(/[*_#`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.1;
    utterance.onend = () => {
      audioHudBar.classList.remove('playing');
      playAudioText.textContent = 'Read Aloud';
      if (onComplete) onComplete();
    };
    utterance.onerror = () => {
      audioHudBar.classList.remove('playing');
      playAudioText.textContent = 'Read Aloud';
    };
    window.speechSynthesis.speak(utterance);
  } else {
    audioHudBar.classList.remove('playing');
    playAudioText.textContent = 'Read Aloud';
  }
}

// ==========================================================================
// DIRECT CLIENT-SIDE GEMINI API ENGINE (FOR GITHUB PAGES HOSTING)
// ==========================================================================

async function callDirectGemini(systemInstruction, userText, imageBase64) {
  let apiKey = state.geminiApiKey;
  if (!apiKey || apiKey === 'BACKEND_CONFIGURED') {
    apiKey = prompt('Please enter your Google Gemini API Key to run diagnostics:');
    if (apiKey) {
      apiKey = apiKey.trim();
      state.geminiApiKey = apiKey;
      localStorage.setItem('rme_gemini_api_key', apiKey);
      const cfgKey = document.getElementById('cfgGeminiKey');
      if (cfgKey) cfgKey.value = apiKey;
    } else {
      throw new Error('Gemini API Key is required.');
    }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
  
  const parts = [];
  if (imageBase64) {
    let rawB64 = imageBase64;
    let mimeType = 'image/jpeg';
    if (rawB64.includes(';base64,')) {
      mimeType = rawB64.split(';base64,')[0].replace('data:', '');
      rawB64 = rawB64.split(';base64,')[1];
    }
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: rawB64
      }
    });
  }
  parts.push({ text: userText });

  const payload = {
    system_instruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [{ parts: parts }],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.2
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errText}`);
  }

  const result = await response.json();
  const textOutput = result.candidates[0].content.parts[0].text;
  return JSON.parse(textOutput.trim().replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim());
}

// ==========================================================================
// EQUIPMENT QUICK-SELECT PRESETS
// ==========================================================================

function initEquipmentPresets() {
  const chips = document.querySelectorAll('.preset-chip');
  const inputDescription = document.getElementById('inputDescription');
  const selectSubsystem = document.getElementById('selectSubsystem');

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const presetText = chip.getAttribute('data-preset');
      const cat = chip.getAttribute('data-cat');
      
      inputDescription.value = presetText;
      if (cat) {
        selectSubsystem.value = cat;
      }
      showToast(`Preset: ${chip.textContent.trim()}`, 'info');
    });
  });
}

// ==========================================================================
// DIAGNOSTIC ENGINE & STEP-BY-STEP CHECKLIST
// ==========================================================================

function initDiagnosticRunner() {
  const btnRunDiagnostic = document.getElementById('btnRunDiagnostic');
  const btnPlayAudio = document.getElementById('btnPlayAudio');
  const btnNextAudioStep = document.getElementById('btnNextAudioStep');
  const btnRepeatHazard = document.getElementById('btnRepeatHazard');
  const btnResetDiag = document.getElementById('btnResetDiag');
  const btnResolveLog = document.getElementById('btnResolveLog');

  btnRunDiagnostic.addEventListener('click', runDiagnostic);

  btnPlayAudio.addEventListener('click', () => {
    if (!state.activeDiagnosticData) return;
    if (state.audioElement && !state.audioElement.paused) {
      state.audioElement.pause();
      document.getElementById('audioHudBar').classList.remove('playing');
      document.getElementById('playAudioText').textContent = 'Read Aloud';
    } else {
      readCurrentStepAloud();
    }
  });

  btnNextAudioStep.addEventListener('click', () => {
    if (!state.activeDiagnosticData || !state.activeDiagnosticData.steps) return;
    state.currentStepIndex = (state.currentStepIndex + 1) % state.activeDiagnosticData.steps.length;
    readCurrentStepAloud();
  });

  btnRepeatHazard.addEventListener('click', () => {
    if (!state.activeDiagnosticData) return;
    const hazards = state.activeDiagnosticData.safety_warnings || [];
    if (hazards.length) {
      speakText(`Safety Alert: ${hazards[0].message}`);
    } else {
      speakText("Always verify Zero Energy and apply LOTO before touching equipment.");
    }
  });

  btnResetDiag.addEventListener('click', () => {
    clearCapturedImage();
    document.getElementById('inputDescription').value = '';
    document.getElementById('diagResultContainer').style.display = 'none';
    document.getElementById('diagEmptyState').style.display = 'flex';
    state.activeDiagnosticData = null;
  });

  btnResolveLog.addEventListener('click', () => {
    if (!state.activeDiagnosticData) return;
    prefillPassdownFromDiagnostic(state.activeDiagnosticData);
    switchTab('tab-passdown');
    showToast('Work order pre-filled into Shift Passdown!', 'success');
  });
}

async function runDiagnostic() {
  const inputDescription = document.getElementById('inputDescription');
  const inputLineId = document.getElementById('inputLineId');
  const selectSubsystem = document.getElementById('selectSubsystem');
  const btnRunDiagnostic = document.getElementById('btnRunDiagnostic');
  const btnRunText = document.getElementById('btnRunText');
  const diagnosticSpinner = document.getElementById('diagnosticSpinner');

  const desc = inputDescription.value.trim();
  if (!desc && !state.capturedImageBase64) {
    showToast('Please provide a description or snap a photo of the issue.', 'error');
    return;
  }

  btnRunDiagnostic.disabled = true;
  btnRunText.textContent = 'ANALYZING MCC1 EQUIPMENT...';
  diagnosticSpinner.style.display = 'block';

  const userQuery = `
EQUIPMENT DIAGNOSTIC REQUEST:
- Facility: Amazon MCC1 (Rancho Cordova Cross-Dock)
- Line / Asset Location: ${inputLineId.value || 'MCC1-General'}
- Equipment Category: ${selectSubsystem.value}
- Technician's Description: ${desc || 'Visual inspection from tablet camera'}
`;

  try {
    let data;
    if (state.hasBackend) {
      // Try backend first
      const res = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: desc || 'Visual fault inspection from tablet camera',
          category: selectSubsystem.value,
          line_id: inputLineId.value || 'MCC1-General',
          image_base64: state.capturedImageBase64
        })
      });
      if (res.ok) {
        data = await res.json();
      } else {
        // Fallback to direct Gemini
        data = await callDirectGemini(RME_SYSTEM_PROMPT, userQuery, state.capturedImageBase64);
      }
    } else {
      // 100% Client-Side Direct Gemini Call (GitHub Pages)
      data = await callDirectGemini(RME_SYSTEM_PROMPT, userQuery, state.capturedImageBase64);
    }

    state.activeDiagnosticData = data;
    renderDiagnosticResult(data);

    if (data.spoken_summary) {
      speakText(data.spoken_summary);
    }
    showToast('Diagnostic completed with safety protocols.', 'success');

  } catch (err) {
    console.error('Diagnostic error:', err);
    showToast(`Diagnostic failed: ${err.message || 'Check connection'}`, 'error');
  } finally {
    btnRunDiagnostic.disabled = false;
    btnRunText.textContent = 'RUN AI DIAGNOSTIC';
    diagnosticSpinner.style.display = 'none';
  }
}

function renderDiagnosticResult(data) {
  const diagEmptyState = document.getElementById('diagEmptyState');
  const diagResultContainer = document.getElementById('diagResultContainer');
  const badgeSeverity = document.getElementById('badgeSeverity');
  const labelSubsystem = document.getElementById('labelSubsystem');
  const textProblemTitle = document.getElementById('textProblemTitle');
  const textProblemSummary = document.getElementById('textProblemSummary');
  const safetyAlertsWrapper = document.getElementById('safetyAlertsWrapper');
  const ppeTagsContainer = document.getElementById('ppeTagsContainer');
  const toolsTagsContainer = document.getElementById('toolsTagsContainer');
  const stepsListContainer = document.getElementById('stepsListContainer');
  const textQuickVerification = document.getElementById('textQuickVerification');

  diagEmptyState.style.display = 'none';
  diagResultContainer.style.display = 'flex';

  const sev = (data.severity || 'MEDIUM').toUpperCase();
  badgeSeverity.textContent = sev;
  badgeSeverity.className = `severity-pill ${sev.toLowerCase()}`;
  labelSubsystem.textContent = `${data.subsystem || 'MCC1'} &bull; ${data.equipment_identified || 'Equipment'}`;
  textProblemTitle.textContent = data.problem_title || 'Equipment Fault Detected';
  textProblemSummary.textContent = data.summary || 'Follow the step-by-step procedure below.';

  safetyAlertsWrapper.innerHTML = '';
  const warnings = data.safety_warnings || [];
  if (!warnings.length) {
    warnings.push({
      level: 'WARNING',
      type: 'LOTO & ZERO ENERGY',
      message: 'Perform standard LOTO at local disconnect and verify zero energy before opening panels or touching moving components.'
    });
  }

  warnings.forEach(w => {
    const isDanger = w.level === 'DANGER';
    const alertCard = document.createElement('div');
    alertCard.className = `safety-alert-card ${isDanger ? 'danger' : 'warning'}`;
    alertCard.innerHTML = `
      <div class="safety-icon-wrap">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <div class="safety-content">
        <div class="safety-badge-type">${w.type || 'SAFETY PROTOCOL'} &bull; ${w.level}</div>
        <div class="safety-text">${w.message}</div>
      </div>
    `;
    safetyAlertsWrapper.appendChild(alertCard);
  });

  ppeTagsContainer.innerHTML = '';
  (data.required_ppe || ['Cut-5 Gloves', 'Safety Glasses', 'Steel Toe Boots']).forEach(ppe => {
    const tag = document.createElement('span');
    tag.className = 'tag-item ppe';
    tag.innerHTML = `🛡️ ${ppe}`;
    ppeTagsContainer.appendChild(tag);
  });

  toolsTagsContainer.innerHTML = '';
  (data.required_tools || ['Fluke Multimeter', 'Metric Hex Keys']).forEach(t => {
    const tag = document.createElement('span');
    tag.className = 'tag-item tool';
    tag.innerHTML = `🔧 ${t}`;
    toolsTagsContainer.appendChild(tag);
  });

  stepsListContainer.innerHTML = '';
  state.currentStepIndex = 0;
  const steps = data.steps || [];

  steps.forEach((s, idx) => {
    const stepCard = document.createElement('div');
    stepCard.className = 'step-card';
    stepCard.id = `step-card-${idx}`;

    stepCard.innerHTML = `
      <div class="step-checkbox-wrap">
        <div class="custom-step-checkbox" data-index="${idx}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="display:none;"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>
      <div class="step-body">
        <div class="step-header-row">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="step-num-badge">STEP ${s.step_number || idx+1}</span>
            <span class="step-title">${s.title}</span>
          </div>
          <button class="header-btn" style="width:34px; height:34px;" title="Read Step Aloud" onclick="readSpecificStepAloud(${idx})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
        </div>
        <div class="step-instruction">${s.instruction}</div>
        ${s.specs ? `<div class="step-spec-callout">⚡ SPEC: ${s.specs}</div>` : ''}
        ${s.safety_note ? `<div style="color:var(--danger-red); font-size:0.8rem; font-weight:700;">⚠️ ${s.safety_note}</div>` : ''}
        ${s.pro_tip ? `<div class="step-protip">💡 <strong>MCC1 Pro-Tip:</strong> ${s.pro_tip}</div>` : ''}
        ${s.visual_reference ? `<div class="step-image-wrap"><img src="images/${s.visual_reference}" alt="Visual Reference" class="step-visual-img" /></div>` : ''}
      </div>
    `;

    const checkbox = stepCard.querySelector('.custom-step-checkbox');
    checkbox.addEventListener('click', () => {
      const isCompleted = stepCard.classList.toggle('completed');
      checkbox.querySelector('svg').style.display = isCompleted ? 'block' : 'none';
      updateStepsProgress();
    });

    stepsListContainer.appendChild(stepCard);
  });

  updateStepsProgress();
  textQuickVerification.textContent = data.quick_verification || 'Run conveyor at 50% speed for 2 minutes to verify smooth operation.';

  if (data.visual_markers && data.visual_markers.length) {
    drawVisualMarkers(data.visual_markers);
  }
}

function updateStepsProgress() {
  const steps = document.querySelectorAll('.step-card');
  const completed = document.querySelectorAll('.step-card.completed');
  const label = document.getElementById('stepsProgressLabel');
  if (label) {
    label.textContent = `${completed.length} of ${steps.length} Done`;
  }
}

function readCurrentStepAloud() {
  if (!state.activeDiagnosticData || !state.activeDiagnosticData.steps) return;
  const steps = state.activeDiagnosticData.steps;
  const s = steps[state.currentStepIndex];
  if (!s) return;

  const textToRead = `Step ${s.step_number || state.currentStepIndex+1}: ${s.title}. ${s.instruction} ${s.specs ? 'Specification: ' + s.specs : ''}`;
  document.getElementById('audioHudStatus').textContent = `Reading Step ${s.step_number || state.currentStepIndex+1} of ${steps.length}`;
  speakText(textToRead);
}

function readSpecificStepAloud(idx) {
  state.currentStepIndex = idx;
  readCurrentStepAloud();
}
window.readSpecificStepAloud = readSpecificStepAloud;

// ==========================================================================
// TAB 2: SHIFT PASSDOWN & HANDOFF LOGGER
// ==========================================================================

function initPassdown() {
  const btnAdd = document.getElementById('btnAddPassdownEntry');
  const btnGen = document.getElementById('btnGeneratePassdownReport');
  const btnCloseModal = document.getElementById('btnClosePassdownModal');
  const btnCopy = document.getElementById('btnCopyPassdown');

  btnAdd.addEventListener('click', addPassdownEntry);
  btnGen.addEventListener('click', generatePassdownSummary);
  btnCloseModal.addEventListener('click', () => {
    document.getElementById('passdownReportModal').classList.remove('open');
  });

  btnCopy.addEventListener('click', () => {
    const text = document.getElementById('passdownReportText').textContent;
    navigator.clipboard.writeText(text).then(() => {
      showToast('Passdown report copied to clipboard!', 'success');
    });
  });

  loadPassdownList();
}

async function loadPassdownList() {
  const container = document.getElementById('passdownListContainer');
  const badge = document.getElementById('passdownCountBadge');
  
  let entries = [];
  if (state.hasBackend) {
    try {
      const res = await fetch('/api/passdown');
      if (res.ok) {
        const data = await res.json();
        entries = data.entries || [];
      }
    } catch (e) {
      entries = state.passdownLogs;
    }
  } else {
    entries = state.passdownLogs;
  }

  badge.textContent = entries.length;

  if (!entries.length) {
    container.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:30px;">No maintenance entries logged for this shift yet.</div>';
    return;
  }

  container.innerHTML = '';
  entries.forEach(e => {
    const item = document.createElement('div');
    item.className = 'passdown-item-card';
    item.innerHTML = `
      <div class="passdown-item-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="severity-pill ${e.severity ? e.severity.toLowerCase() : 'medium'}">${e.severity || 'MEDIUM'}</span>
          <strong style="color:var(--amazon-orange); font-size:0.95rem;">${e.asset_id} (${e.equipment_type})</strong>
        </div>
        <button class="header-btn" style="width:30px; height:30px; color:var(--danger-red);" onclick="deletePassdownItem('${e.id}')">&times;</button>
      </div>
      <div style="font-size:0.88rem; font-weight:700; color:var(--text-primary);">${e.problem}</div>
      <div style="font-size:0.84rem; color:var(--text-secondary);">${e.action_taken}</div>
      <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); border-top:1px solid var(--border-subtle); padding-top:6px; margin-top:4px;">
        <span>Parts: ${e.parts_used || 'None'}</span>
        <span>Downtime: ${e.downtime_minutes} min &bull; ${e.timestamp || ''}</span>
      </div>
    `;
    container.appendChild(item);
  });
}

async function addPassdownEntry() {
  const assetId = document.getElementById('pdAssetId').value.trim();
  const equipType = document.getElementById('pdEquipType').value;
  const severity = document.getElementById('pdSeverity').value;
  const downtime = parseInt(document.getElementById('pdDowntime').value) || 0;
  const problem = document.getElementById('pdProblem').value.trim();
  const action = document.getElementById('pdAction').value.trim();
  const parts = document.getElementById('pdParts').value.trim() || 'None';

  if (!assetId || !problem || !action) {
    showToast('Please fill in Asset ID, Problem, and Action taken.', 'error');
    return;
  }

  const newEntry = {
    id: `WO-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    technician: 'RME Tech',
    asset_id: assetId,
    equipment_type: equipType,
    problem: problem,
    action_taken: action,
    parts_used: parts,
    downtime_minutes: downtime,
    status: 'COMPLETED',
    severity: severity
  };

  if (state.hasBackend) {
    try {
      await fetch('/api/passdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntry)
      });
    } catch (e) {
      state.passdownLogs.unshift(newEntry);
      localStorage.setItem('rme_passdown_logs', JSON.stringify(state.passdownLogs));
    }
  } else {
    state.passdownLogs.unshift(newEntry);
    localStorage.setItem('rme_passdown_logs', JSON.stringify(state.passdownLogs));
  }

  showToast('Work order logged to shift passdown.', 'success');
  document.getElementById('pdAssetId').value = '';
  document.getElementById('pdProblem').value = '';
  document.getElementById('pdAction').value = '';
  document.getElementById('pdParts').value = '';
  document.getElementById('pdDowntime').value = '0';
  loadPassdownList();
}

async function deletePassdownItem(id) {
  if (state.hasBackend) {
    try {
      await fetch(`/api/passdown/${id}`, { method: 'DELETE' });
    } catch (e) {
      state.passdownLogs = state.passdownLogs.filter(e => e.id !== id);
      localStorage.setItem('rme_passdown_logs', JSON.stringify(state.passdownLogs));
    }
  } else {
    state.passdownLogs = state.passdownLogs.filter(e => e.id !== id);
    localStorage.setItem('rme_passdown_logs', JSON.stringify(state.passdownLogs));
  }
  loadPassdownList();
}
window.deletePassdownItem = deletePassdownItem;

function prefillPassdownFromDiagnostic(data) {
  const lineId = document.getElementById('inputLineId').value;
  document.getElementById('pdAssetId').value = lineId || 'MCC1-Equip';
  document.getElementById('pdProblem').value = data.problem_title || 'Equipment Fault';
  document.getElementById('pdAction').value = `Executed step-by-step diagnostic. ${data.summary || ''}`;
  document.getElementById('pdSeverity').value = data.severity || 'MEDIUM';
}

async function generatePassdownSummary() {
  const modal = document.getElementById('passdownReportModal');
  const reportText = document.getElementById('passdownReportText');
  modal.classList.add('open');
  reportText.textContent = 'Generating AI synthesis of all shift work orders for Amazon MCC1...';

  const entries = state.hasBackend ? (await (await fetch('/api/passdown')).json()).entries : state.passdownLogs;

  if (!entries || !entries.length) {
    reportText.textContent = 'No work orders logged for this shift yet.';
    return;
  }

  let promptContent = 'SHIFT: Front-Half Days (FHD)\nFACILITY: Amazon MCC1 (Rancho Cordova Cross-Dock)\n\nLOGGED WORK ORDERS:\n';
  entries.forEach((e, idx) => {
    promptContent += `${idx+1}. [${e.severity || 'MEDIUM'}] Asset: ${e.asset_id} (${e.equipment_type}) - Problem: ${e.problem} - Fix: ${e.action_taken} - Parts: ${e.parts_used} - DT: ${e.downtime_minutes} min - Status: ${e.status}\n`;
  });

  try {
    if (state.hasBackend) {
      const res = await fetch('/api/passdown/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_name: 'FHD Shift - MCC1', entries: entries })
      });
      const data = await res.json();
      reportText.textContent = data.summary || 'Summary unavailable.';
    } else {
      // Direct call
      let apiKey = state.geminiApiKey;
      if (!apiKey) {
        apiKey = prompt('Enter Gemini API Key:');
        state.geminiApiKey = apiKey;
        localStorage.setItem('rme_gemini_api_key', apiKey);
      }
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: PASSDOWN_PROMPT }] },
          contents: [{ parts: [{ text: promptContent }] }]
        })
      });
      const data = await res.json();
      reportText.textContent = data.candidates[0].content.parts[0].text;
    }
  } catch (err) {
    reportText.textContent = 'Error generating AI shift passdown summary.';
  }
}

// ==========================================================================
// TAB 3: NAMEPLATE & SENSOR OCR SCANNER
// ==========================================================================

function initOCR() {
  const ocrFileInput = document.getElementById('ocrFileInput');
  const btnRunOCR = document.getElementById('btnRunOCR');
  const ocrPreviewImage = document.getElementById('ocrPreviewImage');
  const ocrPlaceholder = document.getElementById('ocrPlaceholder');
  let ocrBase64 = null;

  ocrFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      ocrBase64 = event.target.result;
      ocrPreviewImage.src = ocrBase64;
      ocrPreviewImage.style.display = 'block';
      ocrPlaceholder.style.display = 'none';
      btnRunOCR.disabled = false;
    };
    reader.readAsDataURL(file);
  });

  btnRunOCR.addEventListener('click', async () => {
    if (!ocrBase64) return;
    const spinner = document.getElementById('ocrSpinner');
    const btnText = document.getElementById('btnRunOcrText');
    btnRunOCR.disabled = true;
    spinner.style.display = 'block';
    btnText.textContent = 'READING NAMEPLATE...';

    try {
      let data;
      if (state.hasBackend) {
        const res = await fetch('/api/ocr-nameplate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: ocrBase64 })
        });
        if (res.ok) {
          data = await res.json();
        } else {
          data = await callDirectGemini(OCR_PROMPT, "Read all specs from nameplate", ocrBase64);
        }
      } else {
        data = await callDirectGemini(OCR_PROMPT, "Read all specs from nameplate", ocrBase64);
      }

      renderOCRResult(data);
      showToast('Nameplate specs extracted!', 'success');
    } catch (err) {
      showToast(`OCR analysis failed: ${err.message}`, 'error');
    } finally {
      btnRunOCR.disabled = false;
      spinner.style.display = 'none';
      btnText.textContent = 'EXTRACT SPECIFICATIONS';
    }
  });
}

function renderOCRResult(data) {
  document.getElementById('ocrEmptyState').style.display = 'none';
  const card = document.getElementById('ocrResultCard');
  card.style.display = 'flex';

  document.getElementById('ocrManufacturer').textContent = data.manufacturer || 'Unknown Manufacturer';
  document.getElementById('ocrEquipType').textContent = data.equipment_type || 'Industrial Asset';
  document.getElementById('ocrModel').textContent = data.model_number || 'N/A';

  const elec = data.electrical_specs || {};
  document.getElementById('ocrVoltage').textContent = elec.voltage || 'N/A';
  document.getElementById('ocrFLA').textContent = elec.full_load_amps_fla || 'N/A';
  document.getElementById('ocrHPRPM').textContent = `${elec.horsepower_hp || 'N/A'} / ${elec.rpm || 'N/A'}`;

  const mech = data.mechanical_specs || {};
  document.getElementById('ocrGearRatio').textContent = `${mech.gear_ratio || 'N/A'} (Frame: ${mech.frame_size || 'N/A'})`;

  const sensor = data.sensor_specs || {};
  document.getElementById('ocrPinout').textContent = sensor.pinout || (sensor.output_type ? `${sensor.output_type} (${sensor.supply_voltage || ''})` : 'Standard 3-Wire');

  document.getElementById('ocrReplacementNotes').innerHTML = `<strong>Stock Advice:</strong> ${data.replacement_notes || 'Verify mounting dimensions before installing.'}`;
}

// ==========================================================================
// TAB 4: RME FIELD CALCULATORS
// ==========================================================================

function initCalculators() {
  // 1. Belt Tension
  const calcSpan = document.getElementById('calcSpan');
  const calcBeltTension = document.getElementById('calcBeltTension');
  const calcBeltProfile = document.getElementById('calcBeltProfile');
  const calcBeltHzResult = document.getElementById('calcBeltHzResult');

  function updateBeltHz() {
    const L = parseFloat(calcSpan.value) || 24;
    const T = parseFloat(calcBeltTension.value) || 45;
    const m = parseFloat(calcBeltProfile.value) || 0.0065;
    const g = 386.4;
    const hz = (1 / (2 * L)) * Math.sqrt((T * g) / m);
    calcBeltHzResult.textContent = `${hz.toFixed(1)} Hz`;
  }

  [calcSpan, calcBeltTension, calcBeltProfile].forEach(el => el.addEventListener('input', updateBeltHz));
  updateBeltHz();

  // 2. Motor FLA
  const calcMotorHP = document.getElementById('calcMotorHP');
  const calcMotorVolts = document.getElementById('calcMotorVolts');
  const calcFlaResult = document.getElementById('calcFlaResult');
  const calcFlaSubtext = document.getElementById('calcFlaSubtext');

  function updateMotorFLA() {
    const hp = parseFloat(calcMotorHP.value) || 3.0;
    const volts = parseInt(calcMotorVolts.value) || 480;
    let fla = 0;
    let wire = '14 AWG';
    let breaker = '15A';

    if (volts === 480) { fla = hp * 1.6; }
    else if (volts === 240) { fla = hp * 3.2; }
    else if (volts === 208) { fla = hp * 3.6; }
    else { fla = hp * 16.0; }

    if (fla > 30) { wire = '8 AWG'; breaker = '50A'; }
    else if (fla > 20) { wire = '10 AWG'; breaker = '35A'; }
    else if (fla > 15) { wire = '12 AWG'; breaker = '25A'; }

    calcFlaResult.textContent = `${fla.toFixed(1)} A`;
    calcFlaSubtext.textContent = `Est. FLA &bull; Min ${wire} THHN &bull; ${breaker} MCP Breaker`;
  }

  [calcMotorHP, calcMotorVolts].forEach(el => el.addEventListener('input', updateMotorFLA));
  updateMotorFLA();

  // 3. Torque Specs
  const calcBoltSize = document.getElementById('calcBoltSize');
  const calcBoltGrade = document.getElementById('calcBoltGrade');
  const calcTorqueResult = document.getElementById('calcTorqueResult');

  const torqueMap = {
    '3/8': { grade5: 30, grade8: 45, stainless: 20 },
    '1/2': { grade5: 75, grade8: 105, stainless: 45 },
    '5/8': { grade5: 150, grade8: 210, stainless: 95 },
    '3/4': { grade5: 260, grade8: 380, stainless: 170 },
    'M8': { grade5: 18, grade8: 26, stainless: 14 },
    'M10': { grade5: 38, grade8: 52, stainless: 28 },
    'M12': { grade5: 65, grade8: 90, stainless: 48 }
  };

  function updateTorque() {
    const size = calcBoltSize.value;
    const grade = calcBoltGrade.value;
    const ftLbs = (torqueMap[size] && torqueMap[size][grade]) || 75;
    const nm = Math.round(ftLbs * 1.3558);
    calcTorqueResult.textContent = `${ftLbs} ft-lbs (${nm} Nm)`;
  }

  [calcBoltSize, calcBoltGrade].forEach(el => el.addEventListener('change', updateTorque));
  updateTorque();

  // 4. Hydraulic Lift Force
  const calcCylinderBore = document.getElementById('calcCylinderBore');
  const calcHydPressure = document.getElementById('calcHydPressure');
  const calcHydForceResult = document.getElementById('calcHydForceResult');

  function updateHydForce() {
    const bore = parseFloat(calcCylinderBore.value) || 3.5;
    const psi = parseFloat(calcHydPressure.value) || 2200;
    const area = Math.PI * Math.pow(bore / 2, 2);
    const forceLbs = Math.round(area * psi);
    const forceTons = (forceLbs / 2000).toFixed(1);
    calcHydForceResult.textContent = `${forceLbs.toLocaleString()} lbs (${forceTons} Tons)`;
  }

  [calcCylinderBore, calcHydPressure].forEach(el => el.addEventListener('input', updateHydForce));
  updateHydForce();
}

// ==========================================================================
// SETTINGS & MODAL MANAGEMENT
// ==========================================================================

function initSettings() {
  const btnOpen = document.getElementById('btnOpenSettings');
  const btnClose = document.getElementById('btnCloseSettingsModal');
  const btnSave = document.getElementById('btnSaveSettings');
  const btnTestVoice = document.getElementById('btnTestVoice');
  const btnFullscreen = document.getElementById('btnFullscreen');
  const modal = document.getElementById('settingsModal');

  btnOpen.addEventListener('click', () => modal.classList.add('open'));
  btnClose.addEventListener('click', () => modal.classList.remove('open'));

  btnSave.addEventListener('click', async () => {
    const geminiKey = document.getElementById('cfgGeminiKey').value.trim();
    state.voiceId = document.getElementById('cfgVoiceSelect').value;
    state.ttsRate = document.getElementById('cfgTtsRate').value;

    if (geminiKey) {
      state.geminiApiKey = geminiKey;
      localStorage.setItem('rme_gemini_api_key', geminiKey);
      if (state.hasBackend) {
        await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gemini_api_key: geminiKey })
        }).catch(() => {});
      }
    }

    modal.classList.remove('open');
    showToast('Settings saved successfully.', 'success');
  });

  btnTestVoice.addEventListener('click', () => {
    state.voiceId = document.getElementById('cfgVoiceSelect').value;
    state.ttsRate = document.getElementById('cfgTtsRate').value;
    speakText("RME Sentinel audio ready. Testing Bluetooth headset transmission at Amazon MCC1.");
  });

  btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => console.log(e));
    } else {
      document.exitFullscreen();
    }
  });
}

// ==========================================================================
// NETWORK & OFFLINE QUEUE MONITORING
// ==========================================================================

function initNetworkMonitoring() {
  const networkDot = document.getElementById('networkDot');
  const networkText = document.getElementById('networkText');
  const banner = document.getElementById('offlineSyncBanner');
  const btnForceSync = document.getElementById('btnForceSync');

  function updateStatus(online) {
    state.isOnline = online;
    if (online) {
      networkDot.className = 'status-dot';
      networkText.textContent = 'ONLINE';
      banner.classList.remove('visible');
    } else {
      networkDot.className = 'status-dot offline';
      networkText.textContent = 'OFFLINE';
      banner.classList.add('visible');
    }
  }

  window.addEventListener('online', () => updateStatus(true));
  window.addEventListener('offline', () => updateStatus(false));
  btnForceSync && btnForceSync.addEventListener('click', () => showToast('Online sync active.', 'info'));
}

// ==========================================================================
// PWA & SERVICE WORKER
// ==========================================================================

function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.log('SW registration note:', err);
    });
  }
}

// ==========================================================================
// UTILITIES: TOAST NOTIFICATIONS
// ==========================================================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  
  let bg = '#1e293b';
  let border = '#334155';
  if (type === 'success') { bg = 'rgba(16, 185, 129, 0.9)'; border = '#10B981'; }
  else if (type === 'error') { bg = 'rgba(239, 68, 68, 0.9)'; border = '#EF4444'; }
  else if (type === 'info') { bg = 'rgba(15, 23, 42, 0.95)'; border = '#FF9900'; }

  toast.style.cssText = `
    background: ${bg};
    border: 1.5px solid ${border};
    color: #fff;
    padding: 12px 18px;
    border-radius: 10px;
    font-size: 0.88rem;
    font-weight: 700;
    box-shadow: 0 4px 15px rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    gap: 8px;
    animation: fadeIn 0.2s ease-out;
  `;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
