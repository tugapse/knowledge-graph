#!/usr/bin/env python3
import runpy
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

if __name__ == "__main__":
    runpy.run_path(str(SRC / "main.py"), run_name="__main__")
