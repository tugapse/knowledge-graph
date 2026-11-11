"""Builds the Angular client (``npm run build``) and locates its output."""
import shutil
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIST = PROJECT_ROOT / "dist" / "knowledge-graph" / "browser"

CYAN = "\033[0;36m"
GREEN = "\033[0;32m"
RED = "\033[0;31m"
NC = "\033[0m"


def _npm() -> str:
    npm = shutil.which("npm")
    if not npm:
        print(f"{RED}[Error]{NC} 'npm' not found. Install Node.js to build the client.")
        sys.exit(1)
    return npm


def build_frontend() -> Path:
    """Runs the Angular production build and returns the browser output directory."""
    npm = _npm()
    if not (PROJECT_ROOT / "node_modules").exists():
        print(f"{CYAN}[*]{NC} Installing npm dependencies (npm ci)...")
        if subprocess.run([npm, "ci"], cwd=PROJECT_ROOT).returncode != 0:
            print(f"{RED}[Error]{NC} npm ci failed.")
            sys.exit(1)

    print(f"{CYAN}[*]{NC} Building client (npm run build)...")
    if subprocess.run([npm, "run", "build"], cwd=PROJECT_ROOT).returncode != 0:
        print(f"{RED}[Error]{NC} Client build failed. Aborting.")
        sys.exit(1)

    if not (FRONTEND_DIST / "index.html").exists():
        print(f"{RED}[Error]{NC} Build finished but {FRONTEND_DIST / 'index.html'} is missing.")
        sys.exit(1)
    print(f"{GREEN}[OK]{NC} Client built into {FRONTEND_DIST}")
    return FRONTEND_DIST


def ensure_frontend(rebuild: bool = False) -> Path:
    """Returns the built client, building it first when missing or when asked."""
    if rebuild or not (FRONTEND_DIST / "index.html").exists():
        return build_frontend()
    return FRONTEND_DIST
