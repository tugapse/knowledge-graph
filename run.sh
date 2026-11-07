#!/usr/bin/env bash

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export PYTHONPATH="${SCRIPT_DIR}${PYTHONPATH:+:${PYTHONPATH}}"

usage() {
    echo "Knowledge Graph Runner"
    echo ""
    echo "Usage:"
    echo "  ./run.sh [--build-minified] [python args...]"
    echo ""
    echo "Description:"
    echo "  This wrapper forwards all normal arguments to the Python app:"
    echo "    python3 src/main.py [args]"
    echo ""
    echo "Examples:"
    echo "  ./run.sh -k ./knowledge -d ./docs"
    echo "  ./run.sh -k ./knowledge -d ./docs -p 8080"
    echo "  ./run.sh --build-minified -k ./knowledge -d ./docs"
    echo ""
    echo "Special flag:"
    echo "  --build-minified   Runs the minified build script instead of the app server."
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

# Variáveis para armazenar o estado e os caminhos
RUN_BUILD=false
PYTHON_ARGS=()
K_DIR=""
D_DIR=""
B_DIR=""

# Parse manual dos argumentos para podermos separar o que vai para o build-minified
while [[ $# -gt 0 ]]; do
    case $1 in
        --build-minified)
            RUN_BUILD=true
            shift # Remove o argumento e avança
            ;;
        -k)
            PYTHON_ARGS+=("$1" "$2")
            K_DIR="$2"
            shift 2
            ;;
        -d)
            PYTHON_ARGS+=("$1" "$2")
            D_DIR="$2"
            shift 2
            ;;
        -b)
            PYTHON_ARGS+=("$1" "$2")
            B_DIR="$2"
            shift 2
            ;;
        *)
            # Qualquer outro argumento (ex: -p 8080) é guardado para o Python
            PYTHON_ARGS+=("$1")
            shift
            ;;
    esac
done

# Se a flag --build-minified foi usada
if [ "$RUN_BUILD" = true ]; then
    # Passamos os argumentos na ordem posicional que o build-minified.sh espera
    # (Se K_DIR/D_DIR/B_DIR estiverem vazios, o build-minified.sh usa os seus defaults)
    "$SCRIPT_DIR/build-minified.sh" "$K_DIR" "$D_DIR" "$B_DIR"
    exit $?
fi

# Caso contrário, corre a app em Python normalmente com as flags originais
PYTHON_ENTRY="${PYTHON_ENTRY:-python3}"
"$PYTHON_ENTRY" "$SCRIPT_DIR/src/main.py" "${PYTHON_ARGS[@]}"