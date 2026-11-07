import sys
import unittest
from pathlib import Path

SRC_DIR = Path(__file__).resolve().parents[1] / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from graph_loader import canonical_key, extract_fs_hierarchy, load_graph_data
from main import resolve_cli_path


class GraphLoaderTests(unittest.TestCase):
    def test_canonical_key_strips_known_roots_and_extensions(self):
        self.assertEqual(canonical_key("src/agent/tools/bridge.py"), "agent/tools/bridge")
        self.assertEqual(canonical_key(".KnowledgeGraph/agent/tools.json"), "agent/tools")

    def test_extract_fs_hierarchy_uses_top_level_grouping(self):
        data = extract_fs_hierarchy("agent/tools/bridge")
        self.assertEqual(data["level_1"], "AGENT")
        self.assertIsNone(data["level_2"])
        self.assertIsNone(data["level_3"])

    def test_load_graph_data_returns_nodes_and_links_for_known_project(self):
        result = load_graph_data("/home/fabio/Code/knowledge-graph")
        self.assertIsInstance(result, dict)
        self.assertIn("nodes", result)
        self.assertIn("links", result)

    def test_resolve_cli_path_uses_current_directory_for_empty_value(self):
        self.assertEqual(resolve_cli_path(""), str(Path.cwd()))
        self.assertEqual(resolve_cli_path("docs"), "docs")
        self.assertIsNone(resolve_cli_path(None))


if __name__ == "__main__":
    unittest.main()
