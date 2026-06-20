#!/usr/bin/env python3
import os
import sys
import time
import math
import wave
import struct
import asyncio
import subprocess
import argparse
import json
import speech_recognition as sr
import edge_tts
import ollama

# Default configurations
MODEL_NAME = "dolphin-llama3"
VOICE_NAME = "en-GB-RyanNeural"  # Jarvis British Male voice
HISTORY_FILE = os.path.expanduser("~/.jarvis_history.json")

# System prompt for Jarvis
SYSTEM_PROMPT = (
    "You are Jarvis, a highly intelligent, sophisticated, and helpful AI assistant. "
    "You speak in a polite, natural, and witty manner, similar to Tony Stark's Jarvis. "
    "Keep your responses concise, conversational, and direct, suitable for speech. "
    "Do not use list bullet points, markdown tables, or emojis. Speak like a natural human."
)

# Load/Save history helpers
def load_history():
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_history(history):
    try:
        with open(HISTORY_FILE, 'w') as f:
            json.dump(history[-15:], f)  # Keep last 15 messages
    except Exception as e:
        print(f"Error saving history: {e}")

# Pure Python synthesizer to generate futuristic chime beeps without heavy libraries like numpy
def play_beep(frequencies=[523.25, 659.25], duration=0.08, volume=0.15):
    sample_rate = 16000
    audio_data = bytearray()
    
    # Generate sequential tones
    for freq in frequencies:
        num_samples = int(sample_rate * duration)
        for i in range(num_samples):
            t = i / sample_rate
            # Simple sine wave with linear fade out to prevent clicks
            fade = 1.0 - (i / num_samples)
            sample = int(math.sin(2 * math.pi * freq * t) * volume * fade * 32767)
            audio_data.extend(struct.pack('h', sample))
            
    # Write to a temporary WAV file
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        temp_wav = f.name
        
    try:
        wf = wave.open(temp_wav, 'wb')
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(audio_data)
        wf.close()
        
        # Play using system paplay (PulseAudio/PipeWire)
        subprocess.run(["paplay", temp_wav], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    finally:
        if os.path.exists(temp_wav):
            try:
                os.remove(temp_wav)
            except Exception:
                pass

# Record microphone audio using a subprocess of arecord
# Implements automatic voice activity detection (VAD) via RMS energy thresholds
def record_voice(output_path="temp.wav", threshold=800, silence_seconds=1.5):
    # Start arecord capturing 16-bit 16kHz PCM
    cmd = ["arecord", "-q", "-r", "16000", "-f", "S16_LE", "-t", "raw"]
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    
    frames = []
    chunk_size = 1024  # 512 samples
    sample_rate = 16000
    bytes_per_sample = 2
    chunks_per_second = sample_rate * bytes_per_sample / chunk_size  # ~31.25 chunks/sec
    
    silence_chunks_threshold = int(silence_seconds * chunks_per_second)
    
    started_speaking = False
    silence_counter = 0
    max_recording_time = 15  # Max 15 seconds
    start_time = time.time()
    
    print("\n[J.A.R.V.I.S.] Listening...", end="", flush=True)
    
    while True:
        data = process.stdout.read(chunk_size)
        if not data:
            break
            
        frames.append(data)
        
        # Calculate RMS energy of the chunk
        count = len(data) // 2
        if count > 0:
            shorts = struct.unpack(f"{count}h", data)
            sum_squares = sum(s * s for s in shorts)
            rms = math.sqrt(sum_squares / count)
        else:
            rms = 0
            
        # Voice Activity Detection logic
        if rms > threshold:
            if not started_speaking:
                print(" (Speech detected...) ", end="", flush=True)
                started_speaking = True
            silence_counter = 0
        else:
            if started_speaking:
                silence_counter += 1
                
        # Break recording if silence threshold is met
        if started_speaking and silence_counter >= silence_chunks_threshold:
            break
            
        # Hard limit timeouts
        if time.time() - start_time > max_recording_time:
            break
        if not started_speaking and (time.time() - start_time > 4.5):
            print(" (No speech detected)")
            break
            
    process.terminate()
    process.wait()
    
    print("Processing...")
    
    if not started_speaking or len(frames) < 10:
        return False
        
    # Write to WAV
    wf = wave.open(output_path, 'wb')
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(16000)
    wf.writeframes(b''.join(frames))
    wf.close()
    
    return True

# Transcribe WAV to text using speech_recognition
def transcribe_audio(wav_path="temp.wav"):
    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)
        # Using free Google Speech Recognition API (built into SpeechRecognition wrapper)
        text = recognizer.recognize_google(audio_data)
        return text
    except sr.UnknownValueError:
        print("[System] Could not understand audio.")
        return None
    except sr.RequestError as e:
        print(f"[System] API Request Error: {e}")
        return None
    except Exception as e:
        print(f"[System] Transcription error: {e}")
        return None

# Speak response using edge-tts and ffplay
async def speak_text(text, voice=VOICE_NAME, rate="+10%"):
    import re
    # Remove markdown formatting (bold, italic, headers, backticks, asterisks)
    cleaned_text = re.sub(r'\*\*|__|\*|_|`|#', '', text)
    # Remove emojis using unicode range regex
    emoji_pattern = re.compile(
        '['
        '\U0001f300-\U0001f5ff'
        '\U0001f600-\U0001f64f'
        '\U0001f680-\U0001f6ff'
        '\u2600-\u26ff'
        '\u2700-\u27bf'
        '\U0001f1e6-\U0001f1ff'
        '\U0001f900-\U0001f9ff'
        '\U0001fa70-\U0001faff'
        ']+', flags=re.UNICODE
    )
    cleaned_text = emoji_pattern.sub('', cleaned_text)
    # Clean up double/multiple spaces
    cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()

    temp_mp3 = os.path.expanduser("~/jarvis_temp_speak.mp3")
    try:
        communicate = edge_tts.Communicate(cleaned_text, voice, rate=rate)
        await communicate.save(temp_mp3)
        
        # Play through ffplay (cleanest offline player on your system)
        subprocess.run(
            ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", temp_mp3],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    except Exception as e:
        print(f"\n[System] TTS Playback error: {e}")
    finally:
        if os.path.exists(temp_mp3):
            try:
                os.remove(temp_mp3)
            except Exception:
                pass

# Run Jarvis logic loop
async def run_jarvis_interaction(history, user_text, args):
    print(f"\nYOU: {user_text}")
    
    # Append user message to active history
    history.append({"role": "user", "content": user_text})
    
    print("[J.A.R.V.I.S.] Thinking...", end="", flush=True)
    
    try:
        import httpx
        # Send history to backend API (which handles tools!) and stream sentences
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                "http://localhost:8000/api/chat/stream",
                json={
                    "model": args.model,
                    "messages": history,
                    "system_prompt": SYSTEM_PROMPT
                },
                timeout=30.0
            ) as response:
                if response.status_code != 200:
                    raise Exception(f"Server returned status {response.status_code}")
                
                print("\rJARVIS: ", end="", flush=True)
                full_reply = ""
                
                # Iterate line by line (which correspond to individual sentences)
                async for line in response.aiter_lines():
                    sentence = line.strip()
                    if sentence:
                        print(sentence, end=" ", flush=True)
                        full_reply += sentence + " "
                        # Speak this sentence immediately (blocks until spoken)
                        if not args.mute:
                            await speak_text(sentence, args.voice, args.rate)
                
                print("\n")
                
                # Append Jarvis response to history
                history.append({"role": "assistant", "content": full_reply.strip()})
                save_history(history)
            
    except Exception as e:
        # Fallback to direct Ollama call if server is not running
        print(f"\r[System] Backend server connection failed ({e}). Falling back to direct Ollama...")
        try:
            messages = [{"role": "system", "content": SYSTEM_PROMPT}]
            for msg in history[:-1]:  # Exclude the newly appended user message since we'll rebuild
                role = msg.role if hasattr(msg, 'role') else msg.get('role')
                content = msg.content if hasattr(msg, 'content') else msg.get('content')
                messages.append({"role": role, "content": content})
            messages.append({"role": "user", "content": user_text})
            
            response = ollama.chat(model=args.model, messages=messages)
            ai_response = response.message.content
            
            print(f"\rJARVIS (DIRECT): {ai_response}\n")
            
            # Rebuild history item correctly
            history.append({"role": "assistant", "content": ai_response})
            save_history(history)
            
            if not args.mute:
                await speak_text(ai_response, args.voice, args.rate)
        except Exception as ex:
            print(f"\r[System] Direct Ollama request failed: {ex}")

async def main_async():
    parser = argparse.ArgumentParser(description="J.A.R.V.I.S. Linux background voice terminal client.")
    parser.add_argument("--model", default=MODEL_NAME, help="Ollama model to use.")
    parser.add_argument("--voice", default=VOICE_NAME, help="Edge-TTS voice key.")
    parser.add_argument("--rate", default="+10%", help="Edge-TTS voice rate (e.g. +10%%, -5%%).")
    parser.add_argument("--continuous", action="store_true", help="Run in a continuous interactive voice loop.")
    parser.add_argument("--mute", action="store_true", help="Mute voice feedback output.")
    parser.add_argument("--clear", action="store_true", help="Clear conversation history and exit.")
    
    args = parser.parse_args()
    
    if args.clear:
        if os.path.exists(HISTORY_FILE):
            os.remove(HISTORY_FILE)
            print("History cleared.")
        else:
            print("No history found.")
        sys.exit(0)
        
    history = load_history()
    
    # 1. Continuous Mode (Terminal loop)
    if args.continuous:
        print("====================================================")
        print(" J.A.R.V.I.S. Continuous Speech Terminal Active     ")
        print(f" Model: {args.model} // Voice: {args.voice}")
        print(" Say your commands. Silence completes your prompt.   ")
        print(" Press Ctrl+C to shutdown.                           ")
        print("====================================================")
        
        temp_wav = os.path.expanduser("~/jarvis_temp_rec.wav")
        
        try:
            while True:
                # Play listening chime
                play_beep(frequencies=[523.25, 659.25])
                
                # Record mic audio
                success = record_voice(temp_wav)
                
                if success:
                    # Transcribe
                    text = transcribe_audio(temp_wav)
                    
                    if text:
                        # Process response
                        await run_jarvis_interaction(history, text, args)
                    else:
                        print(" (Awaiting voice commands...)")
                else:
                    # Brief rest before listening again
                    time.sleep(1.0)
                    
        except KeyboardInterrupt:
            print("\nShutting down J.A.R.V.I.S. protocols. Goodbye.")
        finally:
            if os.path.exists(temp_wav):
                try:
                    os.remove(temp_wav)
                except Exception:
                    pass
                    
    # 2. One-Shot Mode (Perfect for Desktop Keybindings / Hotkeys)
    else:
        temp_wav = os.path.expanduser("~/jarvis_temp_rec.wav")
        # Play listen chime
        play_beep(frequencies=[523.25, 659.25])
        
        if record_voice(temp_wav):
            text = transcribe_audio(temp_wav)
            if text:
                await run_jarvis_interaction(history, text, args)
            else:
                # Play cancel sound
                play_beep(frequencies=[400, 300])
        else:
            # Play cancel sound
            play_beep(frequencies=[400, 300])
            
        if os.path.exists(temp_wav):
            try:
                os.remove(temp_wav)
            except Exception:
                pass

if __name__ == "__main__":
    asyncio.run(main_async())
