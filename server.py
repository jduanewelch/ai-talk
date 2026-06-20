import os
import logging
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables
load_dotenv()
import ollama
import edge_tts
from pydantic import BaseModel
from typing import List, Dict

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("jarvis-backend")

app = FastAPI(title="Jarvis AI Voice Assistant")

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure static directory exists
os.makedirs("static", exist_ok=True)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: str = "dolphin-llama3"
    messages: List[ChatMessage]
    system_prompt: str = (
        "You are Jarvis, a highly intelligent, sophisticated, and helpful AI assistant. "
        "You speak in a polite, natural, and witty manner, similar to Tony Stark's Jarvis. "
        "Keep your responses concise, conversational, and direct, suitable for speech. "
        "Do NOT use emojis, bullet points, markdown tables, asterisks, or code formatting in your responses under any circumstances. "
        "Always write pure conversational text that can be spoken directly by a human."
    )

@app.get("/")
async def read_index():
    return FileResponse("static/index.html")

@app.get("/api/models")
async def list_models():
    try:
        models_response = ollama.list()
        models = [model.model for model in models_response.models]
    except Exception as e:
        logger.error(f"Error fetching Ollama models: {e}")
        # Fallback to a hardcoded list if Ollama is temporarily unreachable
        models = ["dolphin-llama3", "gemma2", "smallthinker"]
    
    # Append Google Gemini models
    models.extend(["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"])
    return {"models": models}

@app.get("/api/voices")
async def list_voices():
    # Return a curated list of natural-sounding English voices
    curated_voices = [
        {"id": "en-GB-RyanNeural", "name": "Ryan (Male, British) - Jarvis Style", "gender": "Male", "locale": "en-GB"},
        {"id": "en-GB-SoniaNeural", "name": "Sonia (Female, British)", "gender": "Female", "locale": "en-GB"},
        {"id": "en-US-GuyNeural", "name": "Guy (Male, American)", "gender": "Male", "locale": "en-US"},
        {"id": "en-US-AriaNeural", "name": "Aria (Female, American)", "gender": "Female", "locale": "en-US"},
        {"id": "en-AU-WilliamNeural", "name": "William (Male, Australian)", "gender": "Male", "locale": "en-AU"},
        {"id": "en-US-JennyNeural", "name": "Jenny (Female, American)", "gender": "Female", "locale": "en-US"}
    ]
    return {"voices": curated_voices}

def clean_text_for_speech(text: str) -> str:
    import re
    # Remove markdown formatting (bold, italic, headers, backticks, asterisks)
    text = re.sub(r'\*\*|__|\*|_|`|#', '', text)
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
    text = emoji_pattern.sub('', text)
    # Clean up double/multiple spaces
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# Helper tool functions for Jarvis
def execute_command(command: str) -> str:
    import subprocess
    safe_bases = ['df', 'free', 'uptime', 'uname', 'acpi', 'date', 'ping', 'hostname', 'whoami', 'ls', 'cat', 'grep']
    parts = command.strip().split()
    if not parts:
        return "Error: Empty command."
    base = parts[0]
    
    if base not in safe_bases:
        return f"Error: Command '{base}' is not in the allowed list of safe commands for security reasons."
        
    try:
        res = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=5.0)
        return f"STDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}"
    except subprocess.TimeoutExpired:
        return "Error: Command timed out."
    except Exception as e:
        return f"Error: {e}"

def open_application(app_name: str) -> str:
    import subprocess
    import shlex
    cleaned = shlex.split(app_name)[0]
    allowed_apps = ['firefox', 'chrome', 'chromium', 'vlc', 'calculator', 'gnome-calculator', 'gnome-terminal', 'libreoffice', 'gimp', 'nautilus', 'spotify']
    
    if cleaned not in allowed_apps:
        return f"Error: Application '{cleaned}' is not in the allowed list."
        
    try:
        subprocess.Popen([cleaned], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        return f"Successfully launched {cleaned} in the background."
    except Exception as e:
        return f"Error launching {cleaned}: {e}"

def get_weather(city: str) -> str:
    import urllib.request
    import urllib.parse
    try:
        url = f"https://wttr.in/{urllib.parse.quote(city)}?format=3"
        req = urllib.request.Request(url, headers={'User-Agent': 'curl/7.81.0'})
        with urllib.request.urlopen(req, timeout=5.0) as response:
            return response.read().decode('utf-8').strip()
    except Exception as e:
        return f"Error fetching weather: {e}"

AVAILABLE_TOOLS = {
    'execute_command': execute_command,
    'open_application': open_application,
    'get_weather': get_weather
}

OLLAMA_TOOLS = [
    {
        'type': 'function',
        'function': {
            'name': 'execute_command',
            'description': 'Execute a shell command on the local Linux system. Allowed commands: df, free, uptime, uname, acpi, date, ping, hostname, whoami, ls, cat, grep.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'command': {
                        'type': 'string',
                        'description': 'The exact bash command to execute (e.g. "free -h", "df -h", "uptime").',
                    },
                },
                'required': ['command'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'open_application',
            'description': 'Launch a GUI desktop application on the local Linux system. Allowed applications: firefox, chrome, chromium, vlc, calculator, gnome-calculator, gnome-terminal, libreoffice, gimp, nautilus, spotify.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'app_name': {
                        'type': 'string',
                        'description': 'The exact application executable name (e.g. "firefox", "calculator").',
                    },
                },
                'required': ['app_name'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'get_weather',
            'description': 'Get the current weather conditions for a given city.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'city': {
                        'type': 'string',
                        'description': 'The name of the city (e.g. "London", "Paris").',
                    },
                },
                'required': ['city'],
            },
        },
    }
]

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        # Handle Google Gemini models
        if request.model.startswith("gemini-"):
            env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
            load_dotenv(dotenv_path=env_path, override=True)
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                return {
                    "response": (
                        "I cannot connect to the Gemini protocols because your Gemini API key is missing. "
                        "Please add your GEMINI_API_KEY to the dot env file in the application directory."
                    )
                }
            
            try:
                from google import genai
                from google.genai import types
                
                client = genai.Client(api_key=api_key)
                
                # Format history for Gemini (excluding system prompt and tool results, which are handled in config/sdk)
                gemini_history = []
                for msg in request.messages[:-1]:
                    role = msg.role if hasattr(msg, 'role') else msg.get('role')
                    content = msg.content if hasattr(msg, 'content') else msg.get('content')
                    
                    if role in ["system", "tool"]:
                        continue
                    g_role = "model" if role == "assistant" else "user"
                    gemini_history.append(
                        types.Content(
                            role=g_role,
                            parts=[types.Part(text=content)]
                        )
                    )
                
                # Create chat session with automatic function calling enabled!
                chat_session = client.chats.create(
                    model=request.model,
                    history=gemini_history,
                    config=types.GenerateContentConfig(
                        system_instruction=request.system_prompt,
                        tools=[execute_command, open_application, get_weather]
                    )
                )
                
                last_msg = request.messages[-1]
                last_content = last_msg.content if hasattr(last_msg, 'content') else last_msg.get('content')
                
                logger.info(f"Sending request to Gemini using model: {request.model}")
                response = chat_session.send_message(last_content)
                ai_response = response.text
                
                logger.info(f"Gemini response: {ai_response}")
                return {"response": clean_text_for_speech(ai_response)}
                
            except Exception as e:
                logger.error(f"Error in Gemini chat: {e}")
                return {"response": f"I encountered an error communicating with the Gemini servers: {str(e)}"}

        # Construct the messages list with the system prompt first
        formatted_messages = []
        if request.system_prompt:
            formatted_messages.append({"role": "system", "content": request.system_prompt})
        
        for msg in request.messages:
            # Handle standard dictionaries or ChatMessage models
            role = msg.role if hasattr(msg, 'role') else msg.get('role')
            content = msg.content if hasattr(msg, 'content') else msg.get('content')
            formatted_messages.append({"role": role, "content": content})

        logger.info(f"Sending request to Ollama using model: {request.model}")
        
        # Tool execution loop
        use_tools = True
        for _ in range(3):
            try:
                if use_tools:
                    response = ollama.chat(
                        model=request.model,
                        messages=formatted_messages,
                        tools=OLLAMA_TOOLS
                    )
                else:
                    response = ollama.chat(
                        model=request.model,
                        messages=formatted_messages
                    )
            except Exception as e:
                err_str = str(e)
                # Catch 400 Bad Request or tool-support errors
                if "support tools" in err_str or "400" in err_str:
                    logger.warning(f"Model {request.model} does not support tools. Retrying without tools.")
                    use_tools = False
                    response = ollama.chat(
                        model=request.model,
                        messages=formatted_messages
                    )
                else:
                    raise e
            
            message = response.message
            
            # Check if model requested any tool executions
            if hasattr(message, 'tool_calls') and message.tool_calls:
                formatted_messages.append(message)  # Add model's tool calls to context
                
                for tool in message.tool_calls:
                    tool_name = tool.function.name
                    tool_args = tool.function.arguments
                    logger.info(f"Jarvis is calling tool '{tool_name}' with args: {tool_args}")
                    
                    if tool_name in AVAILABLE_TOOLS:
                        func = AVAILABLE_TOOLS[tool_name]
                        try:
                            result = func(**tool_args)
                        except Exception as e:
                            result = f"Error executing tool: {e}"
                    else:
                        result = f"Error: Tool '{tool_name}' not recognized."
                        
                    logger.info(f"Tool execution result: {result}")
                    
                    # Feed tool execution result back to context
                    formatted_messages.append({
                        "role": "tool",
                        "content": result,
                        "name": tool_name
                    })
                # Re-submit history to continue generation
                continue
                
            ai_response = message.content
            logger.info(f"Ollama response: {ai_response}")
            return {"response": clean_text_for_speech(ai_response)}
            
        return {"response": clean_text_for_speech(response.message.content)}
        
    except Exception as e:
        logger.error(f"Error in chat completion: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tts")
async def text_to_speech(
    text: str = Query(..., description="Text to synthesize"),
    voice: str = Query("en-GB-RyanNeural", description="Voice ID to use"),
    rate: str = Query("+10%", description="Rate of speech (e.g. +10%, -5%)")
):
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
        
    try:
        logger.info(f"Synthesizing text with voice {voice} (rate {rate}): {text[:50]}...")
        
        # We can stream the audio bytes directly
        async def audio_generator():
            communicate = edge_tts.Communicate(text, voice, rate=rate)
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]
                    
        return StreamingResponse(audio_generator(), media_type="audio/mpeg")
    except Exception as e:
        logger.error(f"Error generating TTS: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Mount static files (must be at the end)
app.mount("/", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
