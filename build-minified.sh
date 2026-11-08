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
    echo "Usage: ./build-minified.sh [-k knowledge_dir] [-d docs_dir] [-b build_dir] [extra flags...]"
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

# Valores por defeito
K_DIR="knowledge"
D_DIR="docs"
B_DIR="dist"
EXTRA_ARGS=()

# Fazer parse das flags tal como o script Python faz
while [[ $# -gt 0 ]]; do
    case $1 in
        -k)
            K_DIR="$2"
            shift 2
            ;;
        -d)
            D_DIR="$2"
            shift 2
            ;;
        -b)
            B_DIR="$2"
            shift 2
            ;;
        *)
            EXTRA_ARGS+=("$1")
            shift
            ;;
    esac
done

# Resolver os caminhos relativos ao terminal atual ($PWD)
KNOWLEDGE_DIR=$(resolve_path "$K_DIR")
DOCUMENTATION_DIR=$(resolve_path "$D_DIR")
BUILD_DIR=$(resolve_path "$B_DIR")

SCRIPT_ENTRY="${PYTHON_ENTRY:-python3}"

echo -e "${CYAN}==================================================${NC}"
echo -e "${CYAN}=== 1. STARTING PYTHON BUILD ===${NC}"
echo -e "${CYAN}==================================================${NC}"
echo -e "Knowledge Dir : $KNOWLEDGE_DIR"
echo -e "Docs Dir      : $DOCUMENTATION_DIR"
echo -e "Build Dir     : $BUILD_DIR"
if [ ${#EXTRA_ARGS[@]} -gt 0 ]; then
    echo -e "Extra Args    : ${EXTRA_ARGS[*]}"
fi
echo -e ""

# Chamar o Python com os paths absolutos + qualquer flag adicional (ex: -r ai)
echo -e "${CYAN}[*]${NC} Running Python build..."
echo -e "${CYAN}[*]${NC} Command: $SCRIPT_ENTRY $SCRIPT_DIR/src/main.py -k $KNOWLEDGE_DIR -d $DOCUMENTATION_DIR -b $BUILD_DIR ${EXTRA_ARGS[*]}"

"$SCRIPT_ENTRY" "$SCRIPT_DIR/src/main.py" -k "$KNOWLEDGE_DIR" -d "$DOCUMENTATION_DIR" -b "$BUILD_DIR" "${EXTRA_ARGS[@]}"

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
        npx --yes terser "$js_file" -o "$js_file" -c -m
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