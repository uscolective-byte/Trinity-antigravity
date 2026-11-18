"""Run locally: python -m unittest Local-Desktop/test_trinity_pc_agent.py"""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).with_name("trinity_pc_agent.py")
spec = importlib.util.spec_from_file_location("trinity_pc_agent", SOURCE)
agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)

class LocalAgentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        patches = [
            patch.object(agent, "ROOT", self.root),
            patch.object(agent, "DB", self.root / "tasks.sqlite3"),
            patch.object(agent, "TOKEN_FILE", self.root / "local-token"),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        agent.setup()

    def test_secret_created_and_not_empty(self):
        self.assertGreaterEqual(len(agent.TOKEN_FILE.read_text().strip()), 40)

    def test_proposal_requires_allowlist(self):
        with self.assertRaises(ValueError):
            agent.propose("powershell -EncodedCommand xyz")
        with self.assertRaises(ValueError):
            agent.propose("CustomTool")
        self.assertEqual(agent.propose("Git")["state"], "pending")

    def test_denial_never_runs_installer(self):
        task = agent.propose("NodeJS")
        with patch.object(agent.subprocess, "run", side_effect=AssertionError("must not execute")):
            result = agent.decide(task["id"], False)
        self.assertEqual(result["state"], "denied")

    def test_approval_requires_real_installer_file(self):
        task = agent.propose("Python")
        with patch.object(agent, "INSTALLER", self.root / "missing.ps1"):
            with self.assertRaises(RuntimeError):
                agent.decide(task["id"], True)
        self.assertEqual(agent.get_task(task["id"])["state"], "pending")

    def test_task_cannot_be_approved_twice(self):
        task = agent.propose("Ollama")
        agent.decide(task["id"], False)
        with self.assertRaises(ValueError):
            agent.decide(task["id"], True)

    def test_expired_task_is_recorded_and_never_installs(self):
        task = agent.propose("Git")
        with patch.object(agent.time, "time", return_value=task["created"] + 600), patch.object(
            agent.subprocess, "run", side_effect=AssertionError("must not execute")
        ):
            with self.assertRaisesRegex(ValueError, "expired"):
                agent.decide(task["id"], True)
        self.assertEqual(agent.get_task(task["id"])["state"], "expired")

    def test_status_authorization_rejects_empty_and_non_ascii_tokens(self):
        handler = object.__new__(agent.Handler)
        token = agent.TOKEN_FILE.read_text().strip()
        handler.headers = {"Authorization": "Bearer " + token}
        self.assertTrue(handler.authorized())
        handler.headers = {"Authorization": "Bearer naïve"}
        self.assertFalse(handler.authorized())
        agent.TOKEN_FILE.write_text("")
        handler.headers = {"Authorization": "Bearer "}
        self.assertFalse(handler.authorized())

    def test_install_success_is_not_verified_without_independent_probe(self):
        task = agent.propose("Git")
        script = self.root / "installer.ps1"
        script.write_text("test fixture")
        with patch.object(agent, "INSTALLER", script), patch.object(
            agent.subprocess, "run", return_value=type("Result", (), {
                "returncode": 0, "stdout": "done", "stderr": ""
            })()
        ) as runner:
            result = agent.decide(task["id"], True)
        self.assertEqual(result["state"], "installer_returned_zero_unverified")
        self.assertFalse(runner.call_args.kwargs["check"])
        self.assertNotIn("shell", runner.call_args.kwargs)

if __name__ == "__main__":
    unittest.main()
