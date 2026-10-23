import shutil
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from rollout_monitor import RolloutMonitor


@contextmanager
def test_directory():
    path = Path(__file__).resolve().parent / f".monitor-test-{uuid4().hex}"
    path.mkdir()
    try:
        yield path
    finally:
        shutil.rmtree(path)


class RolloutMonitorTests(unittest.TestCase):
    def test_baselines_existing_files_and_reports_later_growth(self):
        with test_directory() as root:
            rollout = root / "2026" / "10" / "rollout-test.jsonl"
            rollout.parent.mkdir(parents=True)
            rollout.write_bytes(b"synthetic existing bytes")
            monitor = RolloutMonitor(root)

            baseline = monitor.poll()
            self.assertEqual([(event.event_type, event.status) for event in baseline],
                             [("monitor_status", "baseline")])
            rollout.write_bytes(b"synthetic existing bytes plus new bytes")
            changes = monitor.poll()

        self.assertEqual(len(changes), 1)
        self.assertEqual(changes[0].change, "grew")
        self.assertEqual(changes[0].previous_size_bytes, len(b"synthetic existing bytes"))

    def test_ignores_non_rollout_files_and_never_opens_rollout_content(self):
        with test_directory() as root:
            (root / "other.jsonl").write_text("synthetic", encoding="utf-8")
            (root / "rollout-synthetic.jsonl").write_bytes(b"synthetic rollout body")
            monitor = RolloutMonitor(root)

            with patch("builtins.open", side_effect=AssertionError("content was opened")):
                events = monitor.poll()

        self.assertEqual(events[0].file_count, 1)

    def test_incomplete_scan_preserves_baseline_until_recovery(self):
        with test_directory() as root:
            rollout = root / "rollout-synthetic.jsonl"
            rollout.write_bytes(b"synthetic")
            monitor = RolloutMonitor(root)
            monitor.poll()

            with patch("rollout_monitor._scan", side_effect=PermissionError):
                errors = monitor.poll()
            self.assertEqual(errors[0].status, "scan_error")

            rollout.unlink()
            recovered = monitor.poll()

        self.assertEqual(recovered[0].status, "recovered")
        self.assertEqual(recovered[1].change, "missing")


if __name__ == "__main__":
    unittest.main()
