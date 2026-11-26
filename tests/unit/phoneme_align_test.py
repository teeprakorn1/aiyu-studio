"""Unit tests for tools/phoneme-align/lib_ctc.py — pure logic only.

get_trellis/backtrack require torch (heavy opt-in dep) and are covered by the dev-time
live verification against edge-tts ground truth instead — documented honestly in
docs/testing. What is tested here: span merging, whitespace-run chunking, and the
spaceless-script (Thai) max_chars splitting — the logic where schema bugs would live.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'tools', 'phoneme-align'))

import lib_ctc  # noqa: E402


class MergeSegmentsTest(unittest.TestCase):
    def test_contiguous_runs_merge_into_spans(self):
        # frames 0-2 token 1, frames 3-4 token 2 — at 20ms/frame
        path = [(0, 1), (1, 1), (2, 1), (3, 2), (4, 2)]
        segs = lib_ctc.merge_segments(path, 0.02)
        self.assertEqual(segs, [(1, 0.0, 0.06), (2, 0.06, 0.1)])

    def test_empty_path(self):
        self.assertEqual(lib_ctc.merge_segments([], 0.02), [])


class SplitRunsTest(unittest.TestCase):
    def test_whitespace_delimits_runs(self):
        self.assertEqual(lib_ctc.split_runs_keep_spaces('ab cd'), [[0, 1], [3, 4]])

    def test_spaceless_script_single_run(self):
        self.assertEqual(lib_ctc.split_runs_keep_spaces('สวัสดี'), [[0, 1, 2, 3, 4, 5]])


class GroupWordsByRunsTest(unittest.TestCase):
    def test_english_words_never_merge_across_spaces(self):
        # transcript 'ab cd', spans 1-based positions
        spans = [(1, 0.0, 0.1), (2, 0.1, 0.2), (4, 0.3, 0.4), (5, 0.4, 0.5)]
        chunks = lib_ctc.group_words_by_runs(spans, 'ab cd')
        self.assertEqual(chunks, [['ab', 0.0, 0.2], ['cd', 0.3, 0.5]])

    def test_thai_spaceless_run_splits_every_max_chars(self):
        transcript = 'กขคดงจชซ'  # 8 chars, no spaces
        spans = [(i + 1, i * 0.1, (i + 1) * 0.1) for i in range(8)]
        chunks = lib_ctc.group_words_by_runs(spans, transcript, max_chars=3)
        self.assertEqual(len(chunks), 3)  # 3+3+2
        self.assertEqual(chunks[0][0], 'กขค')
        self.assertEqual(chunks[1][0], 'ดงจ')
        self.assertEqual(chunks[2][0], 'ชซ')
        # timing spans the piece's first-start to last-end
        self.assertEqual(chunks[0][1], 0.0)
        self.assertEqual(chunks[0][2], 0.3)
        self.assertEqual(chunks[2][1], 0.6)
        self.assertEqual(chunks[2][2], 0.8)

    def test_schema_shape_matches_mix_merge_contract(self):
        spans = [(1, 0.0, 0.1), (2, 0.1, 0.2)]
        chunks = lib_ctc.group_words_by_runs(spans, 'ab')
        row = chunks[0]
        self.assertEqual(len(row), 3)          # [word, start, end]
        self.assertIsInstance(row[0], str)
        self.assertIsInstance(row[1], float)
        self.assertIsInstance(row[2], float)

    def test_unaligned_positions_skipped_not_fatal(self):
        spans = [(1, 0.0, 0.1)]  # position 2 never aligned
        chunks = lib_ctc.group_words_by_runs(spans, 'ab')
        self.assertEqual(chunks, [['a', 0.0, 0.1]])


if __name__ == '__main__':
    unittest.main()
