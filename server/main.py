#!/usr/bin/env python3
import argparse
import os
import sys
from pathlib import Path
from typing import Optional

SRC_DIR = Path(__file__).resolve().parent
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from graph_loader import build_production_bundle
from server import run_server


def resolve_cli_path(path_val: Optional[str]) -> Optional[str]:
    if path_val is None:
        return None
    if path_val == "":
        return str(Path.cwd())
    return path_val


def parse_arguments():
    parser = argparse.ArgumentParser(
        prog="python main.py",
        description="KNOWLEDGE GRAPH VISUALIZER HELP",
        epilog=(
            "How to use it:\n"
            "  1) Point -k to your knowledge directory (required).\n"
            "  2) Optionally point -d to your docs directory.\n"
            "  3) Start the local viewer with -p or just use the default port 8080.\n"
            "  4) Use -b to build the client (npm run build) and a static bundle instead of starting the server.\n"
            "  5) Use -r to specify root paths to strip for cleaner hierarchies (e.g. src/ai).\n\n"
            "Examples:\n"
            "  python main.py -k ./knowledge -d ./docs\n"
            "  python main.py -k ./knowledge -d ./docs -p 8080\n"
            "  python main.py -k ./knowledge -d ./docs -b ./dist -r src/ai\n"
            "  python main.py -k ./knowledge -r src/ai lib/core"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        add_help=True,
    )
    parser.add_argument(
        "-k",
        "--knowledge",
        default="_knowledge",
        dest="knowledge_dir",
        help="Path to the knowledge directory to load. This is required.",
    )
    parser.add_argument(
        "-d",
        "--docs",
        default="_docs",
        dest="docs_dir",
        help="Optional path to the docs directory used for additional context.",
    )
    parser.add_argument(
        "-p",
        "--port",
        dest="port",
        type=int,
        default=8080,
        help="Port for the local web viewer. Default: 8080.",
    )
    parser.add_argument(
        "-b",
        "--build",
        dest="build_dir",
        nargs="?",
        const="./dist/site",
        default=None,
        help="Build a static bundle (client + data.json) into this directory instead of starting the server. "
        "Default when the flag has no value: ./dist/site.",
    )
    parser.add_argument(
        "--skip-client-build",
        dest="skip_client_build",
        action="store_true",
        help="With -b: reuse the existing client build instead of running npm run build.",
    )
    parser.add_argument(
        "--rebuild-client",
        dest="rebuild_client",
        action="store_true",
        help="Server mode: run npm run build before serving (otherwise only when no build exists).",
    )
    parser.add_argument(
        "-r",
        "--root",
        dest="root_paths",
        nargs="*",
        default=[],
        help="Optional root paths to strip for canonical grouping (e.g. src/ai app).",
    )
    return parser.parse_args()


def main():
    args = parse_arguments()
    abs_knowledge_dir = os.path.abspath(args.knowledge_dir)
    abs_docs_dir = os.path.abspath(args.docs_dir) if args.docs_dir else None
    abs_build_dir = os.path.abspath(args.build_dir) if args.build_dir else None
    print(f"[Info] Knowledge directory: {abs_knowledge_dir}")
    print(f"[Info] Docs directory: {abs_docs_dir}")
    print(f"[Info] Build directory: {abs_build_dir}")

    if not os.path.exists(abs_knowledge_dir):
        print(f"[Error] Directory does not exist: {abs_knowledge_dir}")
        sys.exit(1)
    
    if args.build_dir:
        build_production_bundle(abs_knowledge_dir, abs_docs_dir, abs_build_dir, args.root_paths,
                                skip_client_build=args.skip_client_build)
        return 0

    run_server(abs_knowledge_dir, abs_docs_dir, args.port, args.root_paths, rebuild_client=args.rebuild_client)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())