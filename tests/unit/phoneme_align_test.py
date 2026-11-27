"""Unit tests for tools/phoneme-align/lib_ctc.py — pure logic, no torch or model required."""
import math
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'tools', 'phoneme-align'))

import lib_ctc  # noqa: E402


def peaked(frames, vocab, p_hit=0.9):
    miss = (1.0 - p_hit) / (vocab - 1)
    rows = []
    for lab in frames:
        row = [math.log(miss)] * vocab
        row[lab] = math.log(p_hit)
        rows.append(row)
    return rows


class MergeSegmentsTest(unittest.TestCase):
    def test_contiguous_runs_merge_into_spans(self):
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
        spans = [(1, 0.0, 0.1), (2, 0.1, 0.2), (4, 0.3, 0.4), (5, 0.4, 0.5)]
        chunks = lib_ctc.group_words_by_runs(spans, 'ab cd')
        self.assertEqual(chunks, [['ab', 0.0, 0.2], ['cd', 0.3, 0.5]])

    def test_thai_spaceless_run_splits_every_max_chars(self):
        transcript = 'กขคดงจชซ'
        spans = [(i + 1, i * 0.1, (i + 1) * 0.1) for i in range(8)]
        chunks = lib_ctc.group_words_by_runs(spans, transcript, max_chars=3)
        self.assertEqual(len(chunks), 3)
        self.assertEqual(chunks[0][0], 'กขค')
        self.assertEqual(chunks[1][0], 'ดงจ')
        self.assertEqual(chunks[2][0], 'ชซ')
        self.assertEqual(chunks[0][1], 0.0)
        self.assertEqual(chunks[0][2], 0.3)
        self.assertEqual(chunks[2][1], 0.6)
        self.assertEqual(chunks[2][2], 0.8)

    def test_schema_shape_matches_mix_merge_contract(self):
        spans = [(1, 0.0, 0.1), (2, 0.1, 0.2)]
        chunks = lib_ctc.group_words_by_runs(spans, 'ab')
        row = chunks[0]
        self.assertEqual(len(row), 3)
        self.assertIsInstance(row[0], str)
        self.assertIsInstance(row[1], float)
        self.assertIsInstance(row[2], float)

    def test_unaligned_positions_skipped_not_fatal(self):
        spans = [(1, 0.0, 0.1)]
        chunks = lib_ctc.group_words_by_runs(spans, 'ab')
        self.assertEqual(chunks, [['a', 0.0, 0.1]])


class TrellisAlignmentTest(unittest.TestCase):
    A, B, SP, C, D = 1, 2, 3, 4, 5
    TOKENS = [A, B, SP, C, D]
    FRAMES = [A, A, B, B, SP, C, C, D, D, 0]

    def spans(self):
        return lib_ctc.align_spans(peaked(self.FRAMES, 6), self.TOKENS, 1.0)

    def test_peaked_frames_recover_token_starts(self):
        starts = {pos: s for pos, s, _ in self.spans()}
        self.assertEqual(starts[1], 0.0)
        self.assertEqual(starts[2], 2.0)
        self.assertEqual(starts[3], 4.0)
        self.assertEqual(starts[4], 5.0)
        self.assertLessEqual(abs(starts[5] - 7.0), 1.0)

    def test_every_token_gets_a_span_in_order(self):
        spans = self.spans()
        self.assertEqual([pos for pos, _, _ in spans], [1, 2, 3, 4, 5])
        self.assertTrue(all(s <= e for _, s, e in spans))
        self.assertTrue(all(spans[i][2] <= spans[i + 1][1] for i in range(len(spans) - 1)))

    def test_word_chunks_follow_the_alignment(self):
        chunks = lib_ctc.group_words_by_runs(self.spans(), 'AB CD')
        self.assertEqual([c[0] for c in chunks], ['AB', 'CD'])
        self.assertEqual(chunks[0][1], 0.0)
        self.assertLessEqual(abs(chunks[1][1] - 5.0), 1.0)

    def test_fewer_frames_than_tokens_yields_no_spans(self):
        self.assertEqual(lib_ctc.align_spans(peaked([1, 2], 6), self.TOKENS, 1.0), [])

    def test_empty_token_list_yields_no_spans(self):
        self.assertEqual(lib_ctc.align_spans(peaked(self.FRAMES, 6), [], 1.0), [])


if __name__ == '__main__':
    unittest.main()
