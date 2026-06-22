@echo off
echo Building J.A.R.V.I.S. for Windows...

REM Activate virtual environment if it exists
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
)

REM Install PyInstaller
pip install pyinstaller

REM Compile the application
echo Compiling the executable...
pyinstaller --name "JarvisUI" --windowed --add-data "static;static" --add-data "templates;templates" server.py

echo ======================================
echo Build complete! Your Windows .exe is located in the \dist folder.
echo ======================================
pause
