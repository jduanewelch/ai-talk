#!/bin/bash
echo "Building J.A.R.V.I.S. for Linux..."

# Activate virtual environment if it exists
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Install PyInstaller
pip install pyinstaller

# Compile the application
echo "Compiling the executable..."
pyinstaller --name "JarvisUI" --windowed --add-data "static:static" --add-data "templates:templates" server.py

echo "======================================"
echo "Build complete! Your Linux executable is located in the /dist folder."
echo "======================================"
