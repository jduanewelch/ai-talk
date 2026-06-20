/* ==========================================================================
   JARVIS // INTERFACE CORE LOGIC
   ========================================================================== */

// DOM Elements
const connectionStatus = document.getElementById('connection-status');
const timeDisplay = document.getElementById('time-display');
const transcriptContainer = document.getElementById('transcript-container');
const clearLogBtn = document.getElementById('clear-log');
const interactionButton = document.getElementById('interaction-button');
const micIcon = document.getElementById('mic-icon');
const centerStage = document.querySelector('.center-stage');
const stateLabel = document.getElementById('state-label');
const stateSub = document.getElementById('state-sub');

// Controls
const modelSelect = document.getElementById('model-select');
const voiceSelect = document.getElementById('voice-select');
const continuousListeningToggle = document.getElementById('continuous-listening-toggle');
const wakewordToggle = document.getElementById('wakeword-toggle');
const voiceOutputToggle = document.getElementById('voice-output-toggle');
const rateSlider = document.getElementById('rate-slider');
const rateValue = document.getElementById('rate-value');

// Diagnostics
const ollamaStatus = document.getElementById('ollama-status');
const micStatus = document.getElementById('mic-status');
const audioStatus = document.getElementById('audio-status');

// Keyboard input
const keyboardInput = document.getElementById('keyboard-input');
const sendBtn = document.getElementById('send-btn');

// Audio Element
const ttsAudio = document.getElementById('tts-audio');

// State Variables
let appState = 'idle'; // 'idle', 'listening', 'thinking', 'speaking'
let recognition = null;
let micStream = null;
let audioCtx = null;
let analyser = null;
let audioSourceNode = null;
let micSourceNode = null;
let isSpacePressed = false;
let chatHistory = [];
let ttsQueue = [];
let isPlayingQueue = false;

// Visualizer Setup
const canvas = document.getElementById('visualizer-canvas');
const ctx = canvas.getContext('2d');
const center = { x: canvas.width / 2, y: canvas.height / 2 };
const innerRadius = 75;
const outerRadius = 180;

// Initialize Clock
function updateClock() {
    const now = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    timeDisplay.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
setInterval(updateClock, 1000);
updateClock();

// Load available models and voices on startup
async function loadDiagnostics() {
    try {
        // Fetch models
        const modelRes = await fetch('/api/models');
        const modelData = await modelRes.json();
        modelSelect.innerHTML = '';
        if (modelData.models && modelData.models.length > 0) {
            modelData.models.forEach(model => {
                const opt = document.createElement('option');
                opt.value = model;
                opt.textContent = model;
                // Auto-select dolphin-llama3 if present
                if (model.includes('dolphin-llama3')) {
                    opt.selected = true;
                }
                modelSelect.appendChild(opt);
            });
            ollamaStatus.textContent = "READY";
            ollamaStatus.className = "stat-value green";
        } else {
            ollamaStatus.textContent = "NO MODELS";
            ollamaStatus.className = "stat-value red";
        }
    } catch (e) {
        console.error("Failed to load models:", e);
        ollamaStatus.textContent = "ERROR";
        ollamaStatus.className = "stat-value red";
    }

    try {
        // Fetch voices
        const voiceRes = await fetch('/api/voices');
        const voiceData = await voiceRes.json();
        voiceSelect.innerHTML = '';
        voiceData.voices.forEach(voice => {
            const opt = document.createElement('option');
            opt.value = voice.id;
            opt.textContent = voice.name;
            if (voice.id === 'en-GB-RyanNeural') {
                opt.selected = true; // Default to Jarvis style
            }
            voiceSelect.appendChild(opt);
        });
    } catch (e) {
        console.error("Failed to load voices:", e);
    }
}
loadDiagnostics();

// Initialize Web Audio API
function initAudio() {
    if (audioCtx) return;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        
        // Connect the <audio> tag
        audioSourceNode = audioCtx.createMediaElementSource(ttsAudio);
        audioSourceNode.connect(audioCtx.destination); // Direct to speakers for playback
        audioSourceNode.connect(analyser);             // To visualizer for rendering
        
        // DO NOT connect the analyser to audioCtx.destination!
        // This ensures the microphone (which connects to the analyser) does not feed back through the speakers.
        
        audioStatus.textContent = "ACTIVE";
        audioStatus.className = "stat-value green";
    } catch (e) {
        console.error("Web Audio API failed to initialize:", e);
        audioStatus.textContent = "FAILED";
        audioStatus.className = "stat-value red";
    }
}

// Log formatting helper
function addLog(sender, content, type = 'system') {
    const now = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const timestampStr = `[${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}]`;
    
    const msgEl = document.createElement('div');
    msgEl.className = `log-message ${type}`;
    msgEl.innerHTML = `
        <span class="timestamp">${timestampStr}</span>
        <span class="sender">${sender}:</span>
        <span class="content">${content}</span>
    `;
    transcriptContainer.appendChild(msgEl);
    transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
}

// Set application states and style updates
function setAppState(state) {
    appState = state;
    centerStage.className = 'center-stage ' + state;
    
    if (state === 'idle') {
        stateLabel.textContent = "STANDBY";
        if (wakewordToggle && wakewordToggle.checked) {
            stateSub.textContent = "SAY 'JARVIS' TO INITIATE LINK";
        } else {
            stateSub.textContent = continuousListeningToggle.checked ? "LISTENING AUTOMATICALLY" : "CLICK CORE OR HOLD SPACEBAR TO TALK";
        }
        micIcon.className = "fa-solid fa-microphone";
    } else if (state === 'listening') {
        stateLabel.textContent = "LISTENING";
        stateSub.textContent = "I AM RECORDING YOUR VOICE...";
        micIcon.className = "fa-solid fa-waveform-lines";
        initAudio();
    } else if (state === 'thinking') {
        stateLabel.textContent = "THINKING";
        stateSub.textContent = "DECRYPTING RESPONSE MATRIX...";
        micIcon.className = "fa-solid fa-spinner fa-spin";
    } else if (state === 'speaking') {
        stateLabel.textContent = "JARVIS";
        stateSub.textContent = "TRANSMITTING VOCAL SYNTHESIS";
        micIcon.className = "fa-solid fa-volume-high";
    }
}

// Play high-tech activation chime using Web Audio API oscillators
function playChime() {
    initAudio();
    if (!audioCtx) return;
    
    try {
        const now = audioCtx.currentTime;
        
        // Osc 1 (C5)
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, now); // C5
        gain1.gain.setValueAtTime(0.08, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.12);
        
        // Osc 2 (E5) after 80ms
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659.25, now + 0.08); // E5
        gain2.gain.setValueAtTime(0.08, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.25);
    } catch (e) {
        console.error("Failed to play chime:", e);
    }
}

// Initialize Speech Recognition
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        addLog("SYSTEM", "Speech recognition API not supported in this browser. Please use Chrome/Chromium.", "system");
        return;
    }
    
    recognition = new SpeechRecognition();
    recognition.continuous = (wakewordToggle && wakewordToggle.checked);
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    recognition.onstart = async () => {
        if (!wakewordToggle.checked) {
            setAppState('listening');
        } else {
            // Update status without breaking idle look
            micStatus.textContent = "WAKE WORD ACTIVE";
            micStatus.className = "stat-value green";
        }
        
        // Connect microphone to Visualizer
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (audioCtx) {
                if (micSourceNode) {
                    micSourceNode.disconnect();
                }
                micSourceNode = audioCtx.createMediaStreamSource(micStream);
                micSourceNode.connect(analyser);
            }
        } catch (e) {
            console.warn("Could not visual-connect microphone stream:", e);
        }
    };
    
    recognition.onresult = (event) => {
        const resultIndex = event.resultIndex;
        const transcript = event.results[resultIndex][0].transcript.trim();
        if (!transcript) return;
        
        if (wakewordToggle && wakewordToggle.checked) {
            if (appState === 'idle') {
                const lowerText = transcript.toLowerCase();
                const wakeWords = ['jarvis', 'travis', 'jarves', 'service', 'charvis', 'jarv', 'garbage', 'harvis'];
                
                let matchedWord = null;
                for (const w of wakeWords) {
                    if (lowerText.includes(w)) {
                        matchedWord = w;
                        break;
                    }
                }
                
                if (matchedWord) {
                    playChime();
                    
                    const index = lowerText.indexOf(matchedWord);
                    const commandText = transcript.substring(index + matchedWord.length).trim();
                    const cleanCommand = commandText.replace(/^[,.\s!?]+/, '');
                    
                    if (cleanCommand.length > 0) {
                        addLog("YOU (WAKE)", transcript, "user");
                        sendPrompt(cleanCommand);
                    } else {
                        addLog("YOU (WAKE)", "Jarvis?", "user");
                        setAppState('listening');
                    }
                }
            } else if (appState === 'listening') {
                addLog("YOU", transcript, "user");
                sendPrompt(transcript);
            }
        } else {
            if (appState === 'listening') {
                addLog("YOU", transcript, "user");
                sendPrompt(transcript);
            }
        }
    };
    
    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
            addLog("SYSTEM", `Speech Recognition Error: ${event.error}`, "system");
        }
        cleanupMic();
        setAppState('idle');
    };
    
    recognition.onend = () => {
        cleanupMic();
        
        // Auto-restart if we are in Wake Word mode and still idle/listening
        if (wakewordToggle && wakewordToggle.checked && (appState === 'idle' || appState === 'listening')) {
            setTimeout(() => {
                if (wakewordToggle.checked && (appState === 'idle' || appState === 'listening')) {
                    try {
                        recognition.start();
                    } catch(e) {}
                }
            }, 300);
        } else if (appState === 'listening') {
            setAppState('idle');
        }
    };
}

function cleanupMic() {
    micStatus.textContent = "DISCONNECTED";
    micStatus.className = "stat-value";
    
    if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
        micStream = null;
    }
    if (micSourceNode) {
        try {
            micSourceNode.disconnect();
        } catch(e){}
        micSourceNode = null;
    }
}

// Start speech capture
function startListening() {
    initAudio();
    
    // We must recreate SpeechRecognition if transitioning between continuous / non-continuous modes
    if (recognition) {
        try {
            recognition.stop();
        } catch(e){}
        recognition = null;
    }
    
    initSpeechRecognition();
    
    if (recognition && (appState === 'idle' || appState === 'listening')) {
        // Resume AudioContext if suspended
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        // Stop any active speech output
        ttsAudio.pause();
        ttsQueue = [];
        isPlayingQueue = false;
        
        try {
            recognition.start();
        } catch (e) {
            console.error("Error starting recognition:", e);
        }
    }
}

// Stop speech capture
function stopListening() {
    if (recognition) {
        try {
            recognition.stop();
        } catch (e) {
            console.error("Error stopping recognition:", e);
        }
    }
}

// Helper to initialize a streaming log message in the console
function startStreamingLog(sender, type = 'ai') {
    const now = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const timestampStr = `[${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}]`;
    
    const msgEl = document.createElement('div');
    msgEl.className = `log-message ${type}`;
    msgEl.innerHTML = `
        <span class="timestamp">${timestampStr}</span>
        <span class="sender">${sender}:</span>
        <span class="content"></span>
    `;
    transcriptContainer.appendChild(msgEl);
    transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
    
    const contentEl = msgEl.querySelector('.content');
    
    return {
        append: (text) => {
            contentEl.textContent += text;
            transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
        },
        element: msgEl
    };
}

// Add a sentence to the TTS playback queue
function queueSentence(sentence) {
    if (!sentence.trim()) return;
    ttsQueue.push(sentence);
    processTTSQueue();
}

// Process the next item in the queue
function processTTSQueue() {
    if (isPlayingQueue) return;
    if (ttsQueue.length === 0) {
        if (appState === 'speaking') {
            setAppState('idle');
            
            // Restart listening in appropriate modes
            if (continuousListeningToggle && continuousListeningToggle.checked) {
                setTimeout(startListening, 400);
            } else if (wakewordToggle && wakewordToggle.checked) {
                setTimeout(startListening, 400);
            }
        }
        return;
    }
    
    const nextSentence = ttsQueue.shift();
    isPlayingQueue = true;
    setAppState('speaking');
    
    // Stop recognition while Jarvis speaks to avoid self-triggering
    if (recognition) {
        try {
            recognition.stop();
        } catch(e){}
    }
    
    try {
        const voice = voiceSelect.value;
        const speedVal = rateSlider ? parseInt(rateSlider.value) : 10;
        const rateParam = (speedVal >= 0 ? '+' : '') + speedVal + '%';
        const audioUrl = `/api/tts?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(nextSentence)}&rate=${encodeURIComponent(rateParam)}`;
        
        ttsAudio.src = audioUrl;
        
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        ttsAudio.play().catch(e => {
            console.error("Audio playback failed:", e);
            isPlayingQueue = false;
            processTTSQueue();
        });
    } catch (e) {
        console.error("processTTSQueue play failed:", e);
        isPlayingQueue = false;
        processTTSQueue();
    }
}

// Send chat message to backend and stream response
async function sendPrompt(text) {
    setAppState('thinking');
    
    // Add user message to local history
    chatHistory.push({ role: 'user', content: text });
    
    // Keep history at a reasonable limit
    if (chatHistory.length > 15) {
        chatHistory = chatHistory.slice(-15);
    }
    
    // Clear any previous TTS queue
    ttsQueue = [];
    isPlayingQueue = false;
    
    try {
        const res = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: modelSelect.value,
                messages: chatHistory
            })
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Server error");
        }
        
        // Setup reader
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullResponse = '';
        let streamLog = null;
        
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep partial line in buffer
            
            for (const line of lines) {
                const sentence = line.trim();
                if (sentence) {
                    // Initialize the log element on the first sentence
                    if (!streamLog) {
                        streamLog = startStreamingLog("JARVIS", "ai");
                    }
                    
                    // Add to log UI
                    streamLog.append(sentence + " ");
                    fullResponse += sentence + " ";
                    
                    // Add to speech queue
                    if (voiceOutputToggle.checked) {
                        queueSentence(sentence);
                    }
                }
            }
        }
        
        // Process final remaining sentence in buffer
        if (buffer.trim()) {
            const sentence = buffer.trim();
            if (!streamLog) {
                streamLog = startStreamingLog("JARVIS", "ai");
            }
            streamLog.append(sentence);
            fullResponse += sentence;
            
            if (voiceOutputToggle.checked) {
                queueSentence(sentence);
            }
        }
        
        // If voice output is not checked, or if there was no response text
        if (!fullResponse.trim()) {
            setAppState('idle');
            if (wakewordToggle.checked) {
                startListening();
            }
        } else {
            // Append assistant response to history
            chatHistory.push({ role: 'assistant', content: fullResponse.trim() });
            
            // If voice output is disabled, transition back to standby immediately
            if (!voiceOutputToggle.checked) {
                setAppState('idle');
                if (wakewordToggle.checked) {
                    startListening();
                }
            }
        }
        
    } catch (e) {
        console.error("Chat request failed:", e);
        addLog("SYSTEM", `Communication breakdown: ${e.message}`, "system");
        setAppState('idle');
        if (wakewordToggle.checked) {
            startListening();
        }
    }
}

// Track end of audio playback
ttsAudio.onended = () => {
    isPlayingQueue = false;
    processTTSQueue();
};

// Event Listeners for controls
interactionButton.addEventListener('mousedown', () => {
    if (appState === 'idle') {
        startListening();
    } else if (appState === 'listening') {
        stopListening();
        setAppState('idle');
    }
});

// Vocal speed slider listener and persistence
if (rateSlider && rateValue) {
    const savedRate = localStorage.getItem('jarvis-vocal-rate');
    if (savedRate !== null) {
        rateSlider.value = savedRate;
        const numRate = parseInt(savedRate);
        rateValue.textContent = (numRate >= 0 ? '+' : '') + numRate + '%';
    }
    rateSlider.addEventListener('input', () => {
        const val = parseInt(rateSlider.value);
        rateValue.textContent = (val >= 0 ? '+' : '') + val + '%';
        localStorage.setItem('jarvis-vocal-rate', val);
    });
}

// Mutually exclusive behavior settings
wakewordToggle.addEventListener('change', () => {
    if (wakewordToggle.checked) {
        continuousListeningToggle.checked = false;
        startListening();
    } else {
        stopListening();
        setAppState('idle');
    }
});

continuousListeningToggle.addEventListener('change', () => {
    if (continuousListeningToggle.checked) {
        wakewordToggle.checked = false;
        // Stop current listener to switch continuous mode off/on
        stopListening();
        setAppState('idle');
    }
});

// Spacebar Push-To-Talk
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && document.activeElement !== keyboardInput) {
        e.preventDefault();
        if (!isSpacePressed && appState === 'idle' && !wakewordToggle.checked) {
            isSpacePressed = true;
            startListening();
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && document.activeElement !== keyboardInput) {
        e.preventDefault();
        if (isSpacePressed) {
            isSpacePressed = false;
            stopListening();
        }
    }
});

// Manual Text Entry
keyboardInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        submitManualText();
    }
});

sendBtn.addEventListener('click', submitManualText);

function submitManualText() {
    const text = keyboardInput.value.trim();
    if (text) {
        addLog("YOU", text, "user");
        sendPrompt(text);
        keyboardInput.value = '';
    }
}

clearLogBtn.addEventListener('click', () => {
    transcriptContainer.innerHTML = '';
    chatHistory = [];
    addLog("SYSTEM", "Transmission history wiped.", "system");
});


/* ==========================================================================
   CANVAS VISUALIZER RENDERING LOOP
   ========================================================================== */

let rotationAngle = 0;
let breathDirection = 1;
let breathScale = 1.0;

function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);
    
    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Setup glow styling
    ctx.shadowBlur = 15;
    
    // 1. Draw central glowing core visual ring
    let primaryGlowColor = 'rgba(0, 240, 255, ';
    if (appState === 'listening') {
        primaryGlowColor = 'rgba(255, 94, 0, ';
    } else if (appState === 'speaking') {
        primaryGlowColor = 'rgba(0, 114, 255, ';
    }
    
    // Idle state slow pulse
    if (appState === 'idle') {
        breathScale += 0.005 * breathDirection;
        if (breathScale > 1.05 || breathScale < 0.95) {
            breathDirection *= -1;
        }
    } else {
        breathScale = 1.0;
    }
    
    ctx.shadowColor = primaryGlowColor + '0.5)';
    ctx.strokeStyle = primaryGlowColor + '0.8)';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.arc(center.x, center.y, innerRadius * breathScale, 0, Math.PI * 2);
    ctx.stroke();

    // Rotate ticks
    rotationAngle += (appState === 'thinking' ? 0.05 : 0.005);
    
    // 2. Render Audio Waveforms
    if (analyser && (appState === 'speaking' || appState === 'listening')) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        
        const numBars = 72; // Circular bars
        const step = (Math.PI * 2) / numBars;
        
        ctx.lineWidth = 3;
        
        for (let i = 0; i < numBars; i++) {
            // Map dataArray values to bar heights
            const dataIndex = Math.floor((i / numBars) * (bufferLength / 2));
            const rawValue = dataArray[dataIndex] || 0;
            const barHeight = (rawValue / 255) * 60; // Max height 60px
            
            const angle = i * step + rotationAngle;
            
            // Start from the inner core boundary
            const startX = center.x + Math.cos(angle) * (innerRadius + 5);
            const startY = center.y + Math.sin(angle) * (innerRadius + 5);
            
            // Radiate outwards
            const endX = center.x + Math.cos(angle) * (innerRadius + 5 + barHeight);
            const endY = center.y + Math.sin(angle) * (innerRadius + 5 + barHeight);
            
            // Set dynamic gradient / color based on frequency
            if (appState === 'listening') {
                ctx.strokeStyle = `rgba(255, ${94 + (rawValue / 2)}, 0, ${0.4 + (rawValue / 255) * 0.6})`;
                ctx.shadowColor = 'rgba(255, 94, 0, 0.4)';
            } else {
                ctx.strokeStyle = `rgba(0, ${150 + (rawValue / 2)}, 255, ${0.4 + (rawValue / 255) * 0.6})`;
                ctx.shadowColor = 'rgba(0, 114, 255, 0.4)';
            }
            
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
    } else {
        // Draw static tech-tick marks when idle or thinking
        const numTicks = 60;
        const step = (Math.PI * 2) / numTicks;
        ctx.lineWidth = 1;
        
        for (let i = 0; i < numTicks; i++) {
            const angle = i * step + rotationAngle;
            const isTickAccent = i % 5 === 0;
            const tickLength = isTickAccent ? 12 : 5;
            
            const startX = center.x + Math.cos(angle) * (innerRadius + 10);
            const startY = center.y + Math.sin(angle) * (innerRadius + 10);
            const endX = center.x + Math.cos(angle) * (innerRadius + 10 + tickLength);
            const endY = center.y + Math.sin(angle) * (innerRadius + 10 + tickLength);
            
            ctx.strokeStyle = isTickAccent ? primaryGlowColor + '0.7)' : primaryGlowColor + '0.3)';
            ctx.shadowColor = isTickAccent ? primaryGlowColor + '0.4)' : 'transparent';
            
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
    }
    
    // 3. Draw outer sweeping sonar scanline
    if (appState === 'thinking') {
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
        ctx.shadowColor = 'rgba(0, 240, 255, 0.3)';
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        ctx.arc(center.x, center.y, outerRadius - 20, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw radar sweep line
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(
            center.x + Math.cos(rotationAngle * 2) * (outerRadius - 20),
            center.y + Math.sin(rotationAngle * 2) * (outerRadius - 20)
        );
        ctx.stroke();
    }
}

// Start visualizer rendering loop
drawVisualizer();
