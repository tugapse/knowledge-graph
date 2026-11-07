#!/bin/bash

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export PYTHONPATH="${SCRIPT_DIR}${PYTHONPATH:+:${PYTHONPATH}}"

# Define colors for terminal output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

usage() {
    echo -e "${CYAN}Knowledge Graph Build Script${NC}"
    echo ""
    echo "Usage:"
    echo "  ./build-minified.sh [knowledge_dir] [docs_dir] [build_dir]"
    echo ""
    echo "Arguments:"
    echo "  knowledge_dir   Directory containing the knowledge graph input. Default: ./knowledge"
    echo "  docs_dir        Optional docs directory for extra context. Default: ./docs"
    echo "  build_dir       Optional destination directory for static bundle. Default: ./dist"
    echo ""
    echo "Examples:"
    echo "  ./build-minified.sh"
    echo "  ./build-minified.sh ./knowledge ./docs"
    echo "  ./build-minified.sh ./my-knowledge /absolute/path/to/docs ./dist"
    echo ""
    echo "Optional environment:"
    echo "  PYTHON_ENTRY=python3 ./build-minified.sh"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

# Helper to resolve paths relative to the terminal's current working directory ($PWD)
# unless an absolute path (starting with /) is explicitly provided.
resolve_path() {
    local path="$1"
    if [[ "$path" == /* ]]; then
        echo "$path"
    else
        echo "$PWD/$path"
    fi
}

# Path configuration (using defaults if arguments are missing)
KNOWLEDGE_DIR=$(resolve_path "${1:-./knowledge}")
DOCUMENTATION_DIR=$(resolve_path "${2:-./docs}")
BUILD_DIR=$(resolve_path "${3:-./dist}")

# Keep the bundle generation aligned with the reorganized project layout.
SCRIPT_ENTRY="${PYTHON_ENTRY:-python3}"

echo -e "${CYAN}==================================================${NC}"
echo -e "${CYAN}=== 1. STARTING PYTHON BUILD ===${NC}"
echo -e "${CYAN}==================================================${NC}"
echo -e "Knowledge Dir : $KNOWLEDGE_DIR"
echo -e "Docs Dir      : $DOCUMENTATION_DIR"
echo -e "Build Dir     : $BUILD_DIR"
echo -e ""

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