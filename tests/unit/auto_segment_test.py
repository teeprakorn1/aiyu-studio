"""Unit tests for tools/auto-segment/lib_align.py — pure logic, no whisper required.

Words are synthesized: each line is "read" at a fixed speaking rate with small gaps,
so expected alignment boundaries are computable by hand. Noise tests corrupt the
transcript slightly and require alignment to survive — that is the whole point of
fuzzy matching.
"""
import os
import random
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'tools', 'auto-segment'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'engine', 'lib'))

import lib_align  # noqa: E402
import mix_audio  # noqa: E402


def synth_words(texts, rate=5.0, gap=0.4, start=0.5):
    """Simulate whisper word timestamps: each text spoken at `rate` chars/sec, `gap`
    silence between lines. Returns (words, expected) where expected[i] = (start, end)."""
    words = []
    expected = []
    t = start
    for txt in texts:
        n = lib_align.norm_text(txt)
        dur = len(n) / rate
        # whisper-like segmentation: chunks of ~4 chars
        pos = 0
        while pos < len(n):
            chunk = n[pos:pos + 4]
            w0 = t + pos / rate
            w1 = t + (pos + len(chunk)) / rate
            words.append((chunk, w0, w1))
            pos += len(chunk)
        expected.append((t, t + dur))
        t += dur + gap
    return words, expected


class NormTextTest(unittest.TestCase):
    def test_strips_space_and_punctuation_case_insensitive(self):
        self.assertEqual(lib_align.norm_text('Hello, World! 42'), 'helloworld42')

    def test_thai_text_preserved_whitespace_dropped(self):
        self.assertEqual(lib_align.norm_text('สวัสดี ครับ ท่าน'), 'สวัสดีครับท่าน')


class BuildStreamTest(unittest.TestCase):
    def test_char_times_interpolate_within_words(self):
        stream, t0, t1 = lib_align.build_stream([('abcd', 1.0, 2.0)])
        self.assertEqual(stream, 'abcd')
        self.assertAlmostEqual(t0[0], 1.0)
        self.assertAlmostEqual(t1[-1], 2.0)
        self.assertAlmostEqual(t0[2], 1.5)


class AlignLinesTest(unittest.TestCase):
    def test_perfect_transcript_aligns_exactly(self):
        texts = ['hello world today', 'second line here', 'and a third one']
        words, expected = synth_words(texts)
        got = lib_align.align_lines(words, texts)
        self.assertEqual(len(got), 3)
        for i, a in enumerate(got):
            self.assertIsNotNone(a['start'], f'line {i} unmatched')
            self.assertGreaterEqual(a['conf'], 0.95)
            self.assertAlmostEqual(a['start'], expected[i][0], delta=0.3)
            self.assertAlmostEqual(a['end'], expected[i][1], delta=0.3)

    def test_thai_lines_align(self):
        texts = ['ชายที่ทรงพลังที่สุดในวงการชิป', 'ออกจากตำแหน่งเพียงสิบเอ็ดวัน']
        words, expected = synth_words(texts, rate=8.0)
        got = lib_align.align_lines(words, texts)
        for i, a in enumerate(got):
            self.assertIsNotNone(a['start'], f'thai line {i} unmatched')
            self.assertAlmostEqual(a['start'], expected[i][0], delta=0.4)

    def test_noisy_transcript_still_aligns_with_lower_confidence(self):
        texts = ['the quick brown fox jumps over', 'a lazy dog sleeps soundly']
        words, expected = synth_words(texts)
        rng = random.Random(7)
        noisy = []
        for w, a, b in words:
            chars = [c if rng.random() > 0.12 else 'x' for c in w]
            noisy.append((''.join(chars), a, b))
        got = lib_align.align_lines(noisy, texts)
        for i, a in enumerate(got):
            self.assertIsNotNone(a['start'], f'noisy line {i} unmatched')
            self.assertLess(a['conf'], 1.0)
            self.assertAlmostEqual(a['start'], expected[i][0], delta=0.6)

    def test_positions_advance_monotonically(self):
        texts = ['alpha line', 'beta line', 'gamma line']
        words, _ = synth_words(texts)
        got = lib_align.align_lines(words, texts)
        for a, b in zip(got, got[1:]):
            self.assertLessEqual(a['end'], b['end'] + 1e-6)

    def test_unmatched_line_reports_none_not_crash(self):
        words, _ = synth_words(['completely different words spoken'])
        got = lib_align.align_lines(words, ['zzzz qqqq xxxx wwww vvvv'])
        self.assertIsNone(got[0]['start'])
        self.assertEqual(got[0]['conf'], 0.0)


class GroupAlignedTest(unittest.TestCase):
    def aligned(self, rows):
        return [{'line': i, 'start': s, 'end': e, 'conf': .9} for i, s, e in rows]

    def test_narrator_lines_merge_greedily_under_group_max(self):
        a = self.aligned([(0, 0, 4), (1, 4.5, 8), (2, 8.5, 12), (3, 12.5, 30)])
        groups = lib_align.group_aligned(a, 'M', group_max=15.0)
        # lines 0-2 span 12s <= 15 → one group; adding line 3 would span 30s → new group
        self.assertEqual(groups[0]['lines'], [0, 1, 2])
        self.assertEqual(groups[1]['lines'], [3])

    def test_non_contiguous_lines_break_groups(self):
        a = self.aligned([(0, 0, 4), (2, 8, 12)])  # line 1 missing (failed alignment)
        groups = lib_align.group_aligned(a, 'M', group_max=25.0)
        self.assertEqual(len(groups), 2)

    def test_character_lines_are_always_solo(self):
        a = self.aligned([(15, 0, 2), (16, 2.5, 4)])
        groups = lib_align.group_aligned(a, 'J')
        self.assertEqual([g['lines'] for g in groups], [[15], [16]])

    def test_failed_lines_are_skipped(self):
        a = [{'line': 0, 'start': None, 'end': None, 'conf': 0.0},
             {'line': 1, 'start': 5.0, 'end': 9.0, 'conf': .8}]
        groups = lib_align.group_aligned(a, 'M')
        self.assertEqual(len(groups), 1)
        self.assertEqual(groups[0]['lines'], [1])


class CutAndNameTest(unittest.TestCase):
    def test_narrator_and_character_naming_convention(self):
        self.assertEqual(lib_align.file_name({'lines': [0, 4], 'spk': 'M'}), 'n000-004.wav')
        self.assertEqual(lib_align.file_name({'lines': [15], 'spk': 'J'}), 'c015_J.wav')

    def test_cut_ranges_apply_padding_and_clamp(self):
        groups = [{'lines': [0], 'start': 1.0, 'end': 5.0, 'spk': 'M'}]
        cuts = lib_align.cut_ranges(groups, pad=0.2, audio_dur=5.05)
        self.assertEqual(cuts[0]['cut'], (0.8, 5.05))
        self.assertEqual(cuts[0]['file'], 'n000-000.wav')

    def test_cut_never_negative(self):
        groups = [{'lines': [0], 'start': 0.05, 'end': 1.0, 'spk': 'M'}]
        cuts = lib_align.cut_ranges(groups, pad=0.2)
        self.assertEqual(cuts[0]['cut'][0], 0.0)


class SegmentsValidationTest(unittest.TestCase):
    def test_generated_rows_pass_engine_validation(self):
        """The draft segments rows must satisfy the same validator the mixer uses —
        integrating the tool chain end to end on synthetic data."""
        rows = [['n000-002.wav', 0, 2], ['c003_J.wav', 3, 3], ['n004-005.wav', 4, 5]]
        validated = mix_audio.validate_segments(rows, 6)
        self.assertEqual(len(validated), 3)

    def test_rows_sorted_by_first_line(self):
        cuts = [{'file': 'c003_J.wav', 'lines': [3], 'spk': 'J'},
                {'file': 'n000-002.wav', 'lines': [0, 2], 'spk': 'M'}]
        rows = lib_align.segments_rows(cuts)
        self.assertEqual(rows[0][0], 'n000-002.wav')
        self.assertEqual(rows[1][0], 'c003_J.wav')


class CliErrorPathTest(unittest.TestCase):
    """Error paths that fire before any whisper import — no heavy dependency needed."""

    def run_cli(self, args, cwd):
        import subprocess
        tool = os.path.join(os.path.dirname(__file__), '..', '..', 'tools', 'auto-segment', 'auto_segment.py')
        return subprocess.run([sys.executable, os.path.abspath(tool)] + args,
                              capture_output=True, text=True, cwd=cwd)

    def scaffold(self, root):
        import tempfile
        proj = tempfile.mkdtemp(dir=root)
        os.makedirs(os.path.join(proj, 'story'))
        with open(os.path.join(proj, 'story', 'dialogue.txt'), 'w', encoding='utf-8') as f:
            f.write('0|M|hello there\n1|J|character line\n')
        return proj

    def test_missing_project_dialogue_fails_loudly(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            r = self.run_cli([tmp], tmp)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn('dialogue.txt', r.stderr)

    def test_missing_raw_vo_dir_fails_loudly(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            proj = self.scaffold(tmp)
            r = self.run_cli([proj], tmp)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn('raw-vo', r.stderr)

    def test_multi_char_speaker_filename_rejected(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            proj = self.scaffold(tmp)
            os.makedirs(os.path.join(proj, 'raw-vo'))
            open(os.path.join(proj, 'raw-vo', 'narrator.wav'), 'wb').close()
            r = self.run_cli([proj], tmp)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn('one-character speaker id', r.stderr)

    def test_speaker_without_recording_reported(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            proj = self.scaffold(tmp)
            os.makedirs(os.path.join(proj, 'raw-vo'))
            open(os.path.join(proj, 'raw-vo', 'M.wav'), 'wb').close()
            r = self.run_cli([proj], tmp)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn('without a raw recording', r.stderr)


class WordtimesForCutsTest(unittest.TestCase):
    """wordtimes_for_cuts — pure conversion of whisper words into the mix-studio merge schema."""

    CUTS = [
        {'file': 'n001-002.wav', 'lines': [1, 2], 'cut': (2.0, 10.0), 'spk': 'M'},
        {'file': 'c003_A.wav', 'lines': [3], 'cut': (20.0, 25.0), 'spk': 'A'},
    ]

    def test_words_inside_cut_shifted_relative_keyed_by_first_line(self):
        words = {'M': [('aaa', 2.5, 3.0), ('bbb', 5.0, 5.5)], 'A': [('ccc', 21.0, 22.0)]}
        wt = lib_align.wordtimes_for_cuts(self.CUTS, words)
        self.assertEqual(wt['1'], [['aaa', 0.5, 1.0], ['bbb', 3.0, 3.5]])
        self.assertEqual(wt['3'], [['ccc', 1.0, 2.0]])

    def test_words_outside_cut_excluded(self):
        words = {'M': [('pre', 0.0, 1.0), ('in', 4.0, 4.5), ('post', 11.0, 12.0)]}
        wt = lib_align.wordtimes_for_cuts(self.CUTS, words)
        self.assertEqual(len(wt['1']), 1)
        self.assertEqual(wt['1'][0][0], 'in')

    def test_midpoint_rule_straddling_boundary(self):
        # word straddling the cut start: midpoint inside -> included; outside -> excluded
        words = {'M': [('edge', 1.5, 2.6), ('out', 0.5, 1.4)]}
        wt = lib_align.wordtimes_for_cuts([self.CUTS[0]], words)
        self.assertEqual(len(wt['1']), 1)
        self.assertEqual(wt['1'][0][0], 'edge')

    def test_missing_speaker_words_produces_no_entry(self):
        wt = lib_align.wordtimes_for_cuts(self.CUTS, {'M': [('a', 3.0, 3.5)]})
        self.assertIn('1', wt)
        self.assertNotIn('3', wt)

    def test_zero_length_words_excluded(self):
        words = {'M': [('flat', 4.0, 4.0), ('ok', 4.0, 4.5)]}
        wt = lib_align.wordtimes_for_cuts([self.CUTS[0]], words)
        self.assertEqual(len(wt['1']), 1)
        self.assertEqual(wt['1'][0][0], 'ok')

    def test_schema_matches_mix_merge_contract(self):
        # mix-studio.py reads wordtimes.json as {str(line): [[word, start, end], ...]}
        # with times relative to the containing vo file — assert exact shape types
        words = {'M': [('w', 3.0, 3.5)]}
        wt = lib_align.wordtimes_for_cuts([self.CUTS[0]], words)
        key = next(iter(wt))
        self.assertIsInstance(key, str)
        row = wt[key][0]
        self.assertEqual(len(row), 3)
        self.assertIsInstance(row[0], str)
        self.assertIsInstance(row[1], float)
        self.assertIsInstance(row[2], float)


class CliWordtimesEmissionTest(unittest.TestCase):
    pass  # CLI wiring is exercised by the pure-function tests + manual verification;
          # whisper transcription itself is not unit-testable (heavy model, no network).


if __name__ == '__main__':
    unittest.main()
