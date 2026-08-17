import os
import json
import logging
import base64
import re
from datetime import datetime
from typing import List, Dict, Optional, Any
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import edge_tts
from google import genai
from google.genai import types

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rme-sentinel")

app = FastAPI(
    title="Amazon RME Technician AI Copilot",
    description="Intelligent Multimodal Tablet Sidekick for Amazon RME Service Technicians at MCC1",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("static", exist_ok=True)
os.makedirs("data", exist_ok=True)

PASSDOWN_LOG_FILE = "data/passdown_logs.json"

def get_gemini_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured in .env or settings.")
    return genai.Client(api_key=api_key)

# ----------------- PROMPTS & DOMAIN KNOWLEDGE -----------------

RME_SYSTEM_PROMPT = """
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

OUTPUT FORMAT:
You MUST respond with valid JSON matching the following structure so the tablet UI can render interactive step-by-step checklist cards and visual overlays:
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
      "description": "What to look at in the image (e.g. PowerFlex Display showing F004, Photoeye LED amber flashing, worn V-belt teeth)",
      "box_2d": [ymin, xmin, ymax, xmax] // normalized coordinates 0-1000 if image provided, or null
    }
  ],
  "steps": [
    {
      "step_number": 1,
      "title": "Short step header",
      "instruction": "Detailed, practical step-by-step instructions written for an RME technician.",
      "safety_note": "Optional specific hazard warning for this single step or null",
      "specs": "Optional electrical or mechanical spec (e.g. 'Target: 480VAC +/- 5%, Torque: 35 ft-lbs, Air: 90 PSI') or null",
      "pro_tip": "Amazon RME best practice tip for longevity or quick diagnosis"
    }
  ],
  "quick_verification": "Final test procedure to confirm the fix before releasing equipment back to Operations.",
  "spoken_summary": "A natural, crisp 2-to-3 sentence audio script designed to be read aloud via Bluetooth headphones to the technician."
}
"""

OCR_PROMPT = """
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
"""

PASSDOWN_PROMPT = """
You are an Amazon RME Area Maintenance Manager / Lead synthesizing a shift handoff report for Amazon MCC1 (Rancho Cordova Cross-Dock).
Given the following list of maintenance logs, repairs, and inspections completed during this shift, generate a professional, high-impact Shift Passdown formatted in Markdown.

Include:
1. Executive Summary & Site Health (Line uptime, major breakdowns, SEV escalations)
2. Completed Work Orders & Corrective Actions
3. Open / Pending Follow-ups for the Oncoming Shift
4. Parts Used & Re-order Alerts
5. 5S & Safety Status
"""

# ----------------- MODELS -----------------

class DiagnoseRequest(BaseModel):
    description: str
    category: Optional[str] = "General"
    image_base64: Optional[str] = None
    media_type: Optional[str] = "image/jpeg"
    audio_transcript: Optional[str] = None
    line_id: Optional[str] = "MCC1-General"

class OCRRequest(BaseModel):
    image_base64: str
    media_type: Optional[str] = "image/jpeg"

class PassdownEntry(BaseModel):
    id: Optional[str] = None
    timestamp: Optional[str] = None
    technician: str
    asset_id: str
    equipment_type: str
    problem: str
    action_taken: str
    parts_used: Optional[str] = "None"
    downtime_minutes: int = 0
    status: str = "COMPLETED" # COMPLETED, PENDING_PARTS, FOLLOW_UP_REQUIRED
    severity: str = "MEDIUM"

class PassdownGenerateRequest(BaseModel):
    shift_name: str = "Front-Half Days (FHD)"
    entries: Optional[List[PassdownEntry]] = None

# ----------------- HELPERS -----------------

def clean_json_response(raw_text: str) -> Dict[str, Any]:
    """Extract and parse JSON from LLM response."""
    text = raw_text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()
    return json.loads(text)

def load_passdown_entries() -> List[Dict[str, Any]]:
    if not os.path.exists(PASSDOWN_LOG_FILE):
        return []
    try:
        with open(PASSDOWN_LOG_FILE, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading passdowns: {e}")
        return []

def save_passdown_entries(entries: List[Dict[str, Any]]):
    try:
        with open(PASSDOWN_LOG_FILE, "w") as f:
            json.dump(entries, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving passdowns: {e}")

# ----------------- API ENDPOINTS -----------------

@app.get("/")
async def get_index():
    return FileResponse("static/index.html")

@app.post("/api/diagnose")
async def diagnose_equipment(req: DiagnoseRequest):
    """
    Multimodal troubleshooting engine for Amazon RME IXD technicians.
    Processes images, text description, and equipment context via Gemini 2.5 Flash.
    """
    try:
        client = get_gemini_client()
        contents = []

        # If an image is provided
        if req.image_base64:
            # Handle data URL prefix if present
            img_b64 = req.image_base64
            if "," in img_b64:
                img_b64 = img_b64.split(",", 1)[1]
            img_bytes = base64.b64decode(img_b64)
            contents.append(types.Part.from_bytes(data=img_bytes, mime_type=req.media_type or "image/jpeg"))

        user_query = f"""
EQUIPMENT DIAGNOSTIC REQUEST:
- Facility: Amazon MCC1 (Rancho Cordova Cross-Dock)
- Line / Asset Location: {req.line_id}
- Equipment Category: {req.category}
- Technician's Description: {req.description}
"""
        if req.audio_transcript:
            user_query += f"\n- Voice Notes: {req.audio_transcript}"

        contents.append(user_query)

        logger.info(f"Submitting diagnostic request for {req.category} at {req.line_id}")

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=RME_SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.2
            )
        )

        result = clean_json_response(response.text)
        return JSONResponse(content=result)

    except Exception as e:
        logger.error(f"Error in /api/diagnose: {e}")
        # Return a structured fallback if API fails
        return JSONResponse(
            status_code=500,
            content={
                "error": str(e),
                "message": "Failed to complete AI diagnostic. Please check your Gemini API key and network connection."
            }
        )

@app.post("/api/ocr-nameplate")
async def ocr_nameplate(req: OCRRequest):
    """
    Extracts electrical, mechanical, and wiring specifications from motor nameplates and sensors.
    """
    try:
        client = get_gemini_client()
        img_b64 = req.image_base64
        if "," in img_b64:
            img_b64 = img_b64.split(",", 1)[1]
        img_bytes = base64.b64decode(img_b64)

        contents = [
            types.Part.from_bytes(data=img_bytes, mime_type=req.media_type or "image/jpeg"),
            "Read all visible markings, ratings, model numbers, and technical specifications from this equipment nameplate."
        ]

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=OCR_PROMPT,
                response_mime_type="application/json",
                temperature=0.1
            )
        )

        result = clean_json_response(response.text)
        return JSONResponse(content=result)

    except Exception as e:
        logger.error(f"Error in /api/ocr-nameplate: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/api/passdown")
async def get_passdown():
    entries = load_passdown_entries()
    return {"entries": entries}

@app.post("/api/passdown")
async def add_passdown_entry(entry: PassdownEntry):
    entries = load_passdown_entries()
    new_entry = entry.dict()
    if not new_entry.get("id"):
        new_entry["id"] = f"WO-{int(datetime.now().timestamp())}"
    if not new_entry.get("timestamp"):
        new_entry["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    entries.insert(0, new_entry)
    save_passdown_entries(entries)
    return {"success": True, "entry": new_entry}

@app.delete("/api/passdown/{entry_id}")
async def delete_passdown_entry(entry_id: str):
    entries = load_passdown_entries()
    entries = [e for e in entries if e.get("id") != entry_id]
    save_passdown_entries(entries)
    return {"success": True}

@app.post("/api/passdown/generate")
async def generate_passdown_summary(req: PassdownGenerateRequest):
    """
    Synthesize shift entries into an executive Amazon RME passdown report.
    """
    try:
        entries = req.entries if req.entries is not None else load_passdown_entries()
        if not entries:
            return {"summary": "No entries logged for this shift yet."}

        client = get_gemini_client()
        content = f"SHIFT: {req.shift_name}\nFACILITY: Amazon MCC1 (Rancho Cordova Cross-Dock)\n\nLOGGED WORK ORDERS:\n"
        for idx, item in enumerate(entries, 1):
            e = item.dict() if hasattr(item, "dict") else item
            content += f"{idx}. [{e.get('severity', 'MEDIUM')}] Asset: {e.get('asset_id')} ({e.get('equipment_type')}) - Problem: {e.get('problem')} - Fix: {e.get('action_taken')} - Parts: {e.get('parts_used')} - DT: {e.get('downtime_minutes')} min - Status: {e.get('status')}\n"

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[content],
            config=types.GenerateContentConfig(
                system_instruction=PASSDOWN_PROMPT,
                temperature=0.3
            )
        )
        return {"summary": response.text}
    except Exception as e:
        logger.error(f"Error generating passdown summary: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/api/tts")
async def text_to_speech(
    text: str = Query(..., description="Text to synthesize for technician"),
    voice: str = Query("en-US-GuyNeural", description="Natural voice ID"),
    rate: str = Query("+5%", description="Playback rate")
):
    """
    Stream clear technical audio readout for Bluetooth headsets.
    """
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        # Clean text for crisp audio
        cleaned = re.sub(r'[*_#`]', '', text)
        async def audio_generator():
            communicate = edge_tts.Communicate(cleaned, voice, rate=rate)
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]

        return StreamingResponse(audio_generator(), media_type="audio/mpeg")
    except Exception as e:
        logger.error(f"TTS Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/voices")
async def list_voices():
    curated_voices = [
        {"id": "en-US-GuyNeural", "name": "Guy (Male, American Crisp)", "gender": "Male"},
        {"id": "en-US-AriaNeural", "name": "Aria (Female, American Clear)", "gender": "Female"},
        {"id": "en-GB-RyanNeural", "name": "Ryan (Male, British Technical)", "gender": "Male"},
        {"id": "en-US-JennyNeural", "name": "Jenny (Female, American Pro)", "gender": "Female"}
    ]
    return {"voices": curated_voices}

@app.get("/api/config")
async def get_config():
    api_key = os.getenv("GEMINI_API_KEY", "")
    masked_key = f"{api_key[:6]}...{api_key[-4:]}" if len(api_key) > 10 else ("Configured" if api_key else "Missing")
    return {
        "site": "Amazon MCC1 (Rancho Cordova Cross-Dock)",
        "facility_type": "Inbound Cross-Dock (IXD)",
        "gemini_configured": bool(api_key),
        "masked_key": masked_key,
        "model": "gemini-2.5-flash"
    }

@app.post("/api/config")
async def update_config(data: Dict[str, str] = Body(...)):
    new_key = data.get("gemini_api_key")
    if new_key:
        os.environ["GEMINI_API_KEY"] = new_key
        # Update .env file
        try:
            with open(".env", "w") as f:
                f.write(f"GEMINI_API_KEY={new_key}\n")
        except Exception as e:
            logger.warning(f"Could not persist to .env: {e}")
    return {"success": True, "gemini_configured": bool(os.getenv("GEMINI_API_KEY"))}

# Mount static directory for PWA
app.mount("/", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
