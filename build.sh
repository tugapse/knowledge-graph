#!/bin/bash

# Define colors for terminal output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Path configuration
KNOWLEDGE_DIR=${1:-"."} # Uses the passed argument or "." by default
DOCUMENTATION_DIR=${2:-"./docs"} # Uses the passed argument or "./docs" by default

BUILD_DIR="./dist"

echo -e "${CYAN}=== 1. STARTING PYTHON BUILD ===${NC}"
# Calls your main.py file with the correct flags
python3 main.py -k "$KNOWLEDGE_DIR" -d "$DOCUMENTATION_DIR" -b "$BUILD_DIR"

if [ $? -ne 0 ]; then
    echo -e "${RED}[Error] Python build failed. Aborting.${NC}"
    exit 1
fi

echo -e "\n${CYAN}=== 2. STARTING MINIFICATION (NPX) ===${NC}"

# Check if npx is available in the system
if ! command -v npx &> /dev/null; then
    echo -e "${RED}[Error] 'npx' not found. Please install Node.js to continue.${NC}"
    exit 1
fi

# Minify JavaScript files
echo -e "[*] Minifying ${GREEN}JavaScript${NC} files..."
for js_file in "$BUILD_DIR"/*.js; do
    if [ -f "$js_file" ]; then
        filename=$(basename "$js_file")
        echo -e "  -> Minifying $filename..."
        # -c (compress), -m (mangle variables)
        npx --yes terser "$js_file" -o "$js_file" -c -m
    fi
done

# Minify CSS
echo -e "[*] Minifying ${GREEN}CSS${NC} files..."
if [ -f "$BUILD_DIR/styles.css" ]; then
    npx --yes csso-cli "$BUILD_DIR/styles.css" --output "$BUILD_DIR/styles.css"
    echo -e "  -> Minifying styles.css..."
fi

# Minify HTML
echo -e "[*] Minifying ${GREEN}HTML${NC} files..."
if [ -f "$BUILD_DIR/index.html" ]; then
    npx --yes html-minifier-terser \
        --collapse-whitespace \
        --remove-comments \
        --minify-js true \
        --minify-css true \
        "$BUILD_DIR/index.html" -o "$BUILD_DIR/index.html"
    echo -e "  -> Minifying index.html..."
fi

echo -e "\n${GREEN}✔ Build and minification completed successfully in the $BUILD_DIR folder!${NC}"