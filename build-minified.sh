#!/bin/bash

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export PYTHONPATH="${SCRIPT_DIR}${PYTHONPATH:+:${PYTHONPATH}}"
cd "$SCRIPT_DIR"

# Define colors for terminal output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

usage() {
    echo -e "${CYAN}Knowledge Graph Build Script${NC}"
    echo ""
    echo "Usage:"
    echo "  ./build-minified.sh [knowledge_dir] [docs_dir]"
    echo ""
    echo "Arguments:"
    echo "  knowledge_dir   Directory containing the knowledge graph input. Default: ./knowledge"
    echo "  docs_dir        Optional docs directory for extra context. Default: ./docs"
    echo ""
    echo "Examples:"
    echo "  ./build-minified.sh"
    echo "  ./build-minified.sh ./knowledge ./docs"
    echo "  ./build-minified.sh ./my-knowledge ./my-docs"
    echo ""
    echo "Optional environment:"
    echo "  PYTHON_ENTRY=python3 ./build-minified.sh"
}

# Path configuration
KNOWLEDGE_DIR=${1:-"./knowledge"}
DOCUMENTATION_DIR=${2:-"./docs"}
BUILD_DIR="./dist"

# Keep the bundle generation aligned with the reorganized project layout.
SCRIPT_ENTRY="${PYTHON_ENTRY:-python3}"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

# Re-parse arguments after help check so positional dirs still work normally.
if [[ -n "${1:-}" && "${1:-}" != "-h" && "${1:-}" != "--help" ]]; then
    KNOWLEDGE_DIR="$1"
fi
if [[ -n "${2:-}" ]]; then
    DOCUMENTATION_DIR="$2"
fi

echo -e "${CYAN}==================================================${NC}"
echo -e "${CYAN}=== 1. STARTING PYTHON BUILD ===${NC}"
echo -e "${CYAN}==================================================${NC}"
"$SCRIPT_ENTRY" "$SCRIPT_DIR/src/main.py" -k "$KNOWLEDGE_DIR" -d "$DOCUMENTATION_DIR" -b "$BUILD_DIR"

if [ $? -ne 0 ]; then
    echo -e "${RED}[Error] Python build failed. Aborting.${NC}"
    exit 1
fi

echo -e "\n${CYAN}==================================================${NC}"
echo -e "${CYAN}=== 2. STARTING MINIFICATION (NPX) ===${NC}"
echo -e "${CYAN}==================================================${NC}"

# Check if npx is available in the system
if ! command -v npx &> /dev/null; then
    echo -e "${RED}[Error] 'npx' not found. Please install Node.js to continue.${NC}"
    exit 1
fi

# Minify JavaScript files
echo -e "${CYAN}[*]${NC} Minifying ${GREEN}JavaScript${NC} files..."
for js_file in "$BUILD_DIR"/*.js; do
    if [ -f "$js_file" ]; then
        filename=$(basename "$js_file")
        echo -e "  ${CYAN}->${NC} Minifying $filename..."
        # -c (compress), -m (mangle variables)
        npx --yes terser "$js_file" -o "$js_file" -c -m
    fi
done

# Minify CSS
echo -e "${CYAN}[*]${NC} Minifying ${GREEN}CSS${NC} files..."
if [ -f "$BUILD_DIR/styles.css" ]; then
    npx --yes csso-cli "$BUILD_DIR/styles.css" --output "$BUILD_DIR/styles.css"
    echo -e "  ${CYAN}->${NC} Minifying styles.css..."
fi

# Minify HTML
echo -e "${CYAN}[*]${NC} Minifying ${GREEN}HTML${NC} files..."
if [ -f "$BUILD_DIR/index.html" ]; then
    npx --yes html-minifier-terser \
        --collapse-whitespace \
        --remove-comments \
        --minify-js true \
        --minify-css true \
        "$BUILD_DIR/index.html" -o "$BUILD_DIR/index.html"
    echo -e "  ${CYAN}->${NC} Minifying index.html..."
fi

echo -e "\n${GREEN}==================================================${NC}"
echo -e "${GREEN}✔ Build and minification completed successfully in the $BUILD_DIR folder!${NC}"
echo -e "${GREEN}==================================================${NC}"