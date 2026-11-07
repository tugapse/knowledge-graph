#!/bin/env bash

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

args=("$@")
filtered=()

for arg in "${args[@]}"; do
    if [[ "$arg" == "--build-minified" ]]; then
        continue
    fi
    filtered+=("$arg")
done

if [[ " $* " == *" --build-minified "* ]]; then
    "$SCRIPT_DIR/build-minified.sh" "${filtered[@]}"
    exit $?
fi

PYTHON_ENTRY="${PYTHON_ENTRY:-python3}"
"$PYTHON_ENTRY" "$SCRIPT_DIR/src/main.py" "$@"