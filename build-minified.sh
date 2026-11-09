#!/usr/bin/env bash

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export PYTHONPATH="${SCRIPT_DIR}${PYTHONPATH:+:${PYTHONPATH}}"

# Cores
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

usage() {
    echo -e "${CYAN}Knowledge Graph Build Script${NC}"
    echo "Usage: ./build-minified.sh [python args...]"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

resolve_path() {
    local path="$1"
    if [[ "$path" == /* ]]; then
        echo "$path"
    else
        echo "$PWD/$path"
    fi
}

# Peek at the arguments to find the build directory (-b) for minification.
# Defaults to "dist" if not provided.
B_DIR="dist"
args=("$@")
for ((i=0; i<${#args[@]}; i++)); do
    if [[ "${args[$i]}" == "-b" ]] && [[ $((i+1)) -lt ${#args[@]} ]]; then
        B_DIR="${args[$((i+1))]}"
        break
    fi
done

BUILD_DIR=$(resolve_path "$B_DIR")
SCRIPT_ENTRY="${PYTHON_ENTRY:-python3}"

echo -e "${CYAN}==================================================${NC}"
echo -e "${CYAN}=== 1. STARTING PYTHON BUILD ===${NC}"
echo -e "${CYAN}==================================================${NC}"
echo -e "Args passed to Python: $@"
echo -e "Minification Target:   $BUILD_DIR\n"

echo -e "${CYAN}[*]${NC} Running Python build..."
echo -e "${CYAN}[*]${NC} Command: $SCRIPT_ENTRY $SCRIPT_DIR/src/main.py $@"

# Pass ALL arguments directly to Python without modifying them
"$SCRIPT_ENTRY" "$SCRIPT_DIR/src/main.py" "$@"

if [ $? -ne 0 ]; then
    echo -e "${RED}[Error] Python build failed. Aborting.${NC}"
    exit 1
fi

echo -e "\n${CYAN}==================================================${NC}"
echo -e "${CYAN}=== 2. STARTING MINIFICATION (NPX) ===${NC}"
echo -e "${CYAN}==================================================${NC}"

if ! command -v npx &> /dev/null; then
    echo -e "${RED}[Error] 'npx' not found. Please install Node.js to continue.${NC}"
    exit 1
fi

echo -e "${CYAN}[*]${NC} Minifying ${GREEN}JavaScript${NC} files..."
for js_file in "$BUILD_DIR"/*.js; do
    if [ -f "$js_file" ]; then
        filename=$(basename "$js_file")
        echo -e "  ${CYAN}->${NC} Minifying $filename..."
        # Safely compress without mangling variables or losing function/class names
        npx --yes terser "$js_file" -o "$js_file" -c keep_fnames=true,keep_classnames=true
    fi
done

echo -e "${CYAN}[*]${NC} Minifying ${GREEN}CSS${NC} files..."
if [ -f "$BUILD_DIR/styles.css" ]; then
    npx --yes csso-cli "$BUILD_DIR/styles.css" --output "$BUILD_DIR/styles.css"
    echo -e "  ${CYAN}->${NC} Minifying styles.css..."
fi

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
echo -e "${GREEN}✔ Build and minification completed successfully in $BUILD_DIR !${NC}"
echo -e "${GREEN}==================================================${NC}"