# mix_studio_test.py — unit tests for pure audio/parsing helpers in engine/lib/mix_audio.py
import array, unittest, os, math, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..'))

from engine.lib.mix_audio import (
    wave_peaks, trim_edges, envelope_from_pcm,
    parse_dialogue_text, validate_segments, validate_settings, validate_voice_name, talk_js_payload,
)


def pcm_sine(seconds, amp=12000, freq=440.0, rate=24000):
    n = int(seconds * rate)
    smp = array.array('h', (int(amp * math.sin(2 * math.pi * freq * i / rate)) for i in range(n)))
    return smp.tobytes()


def pcm_silence(seconds, rate=24000):
    return b'\x00' * int(seconds * rate) * 2


class WavePeaksTest(unittest.TestCase):
    def test_bucket_count_and_range(self):
        out = wave_peaks(pcm_sine(2.0), buckets=2048)
        self.assertEqual(len(out), 2048)
        self.assertTrue(all(0 <= x <= 1 for x in out))

    def test_silence_is_zero(self):
        out = wave_peaks(pcm_silence(1.0), buckets=64)
        self.assertTrue(all(x == 0 for x in out))

    def test_loud_signal_peaks_higher_than_quiet(self):
        loud = max(wave_peaks(pcm_sine(1.0, amp=20000), buckets=64))
        quiet = max(wave_peaks(pcm_sine(1.0, amp=2000), buckets=64))
        self.assertGreater(loud, quiet)

    def test_empty_input(self):
        self.assertEqual(wave_peaks(b''), [])


class TrimEdgesTest(unittest.TestCase):
    def test_trims_leading_and_trailing_silence(self):
        raw = pcm_silence(0.5) + pcm_sine(1.0) + pcm_silence(0.5)
        out = trim_edges(raw)
        self.assertLess(len(out), len(raw) * 0.75)
        self.assertGreater(len(out), 48000 * 0.8)

    def test_pure_silence_returns_untrimmed(self):
        raw = pcm_silence(1.0)
        out = trim_edges(raw)
        self.assertEqual(len(out), len(raw))


class EnvelopeTest(unittest.TestCase):
    def test_envelope_shape_and_range(self):
        out = envelope_from_pcm(pcm_sine(1.0))
        self.assertEqual(len(out), 30)
        self.assertTrue(all(0 <= x <= 1 for x in out))
        self.assertGreater(max(out), 0)

    def test_empty_envelope_is_zero(self):
        self.assertEqual(envelope_from_pcm(b''), [0] * 30)


class DialogueValidationTest(unittest.TestCase):
    def test_valid_dialogue_parses_in_order(self):
        lines = parse_dialogue_text('0|M|hello\n1|G|world\n')
        self.assertEqual([x['i'] for x in lines], [0, 1])
        self.assertEqual(lines[1]['spk'], 'G')

    def test_empty_dialogue_is_clear_error(self):
        with self.assertRaisesRegex(ValueError, 'empty'):
            parse_dialogue_text('\n  \n')

    def test_malformed_row_has_line_number(self):
        with self.assertRaisesRegex(ValueError, 'line 2'):
            parse_dialogue_text('0|M|ok\nbroken\n')

    def test_nonsequential_indexes_rejected(self):
        with self.assertRaisesRegex(ValueError, '0..1'):
            parse_dialogue_text('0|M|ok\n2|M|bad\n')


class SegmentValidationTest(unittest.TestCase):
    def test_valid_segments_normalize_to_tuples(self):
        out = validate_segments([['a.wav', 0, 1], ['b.wav', 2, 2]], 3)
        self.assertEqual(out, [('a.wav', 0, 1), ('b.wav', 2, 2)])

    def test_gap_or_overlap_rejected(self):
        with self.assertRaisesRegex(ValueError, 'cover'):
            validate_segments([['a.wav', 0, 0]], 2)
        with self.assertRaisesRegex(ValueError, 'cover'):
            validate_segments([['a.wav', 0, 1], ['b.wav', 1, 2]], 3)

    def test_voice_path_traversal_rejected(self):
        for bad in ['../x.wav', 'dir/x.wav', 'dir\\x.wav', '/tmp/x.wav']:
            with self.assertRaises(ValueError, msg=bad):
                validate_voice_name(bad)


class SettingsValidationTest(unittest.TestCase):
    def test_defaults_match_existing_mix_behavior(self):
        st = validate_settings({})
        self.assertEqual(st, {'gap': 0.15, 'tempo': 1.15, 'trimThresh': 500.0, 'lineGap': 0.06})

    def test_invalid_numeric_values_rejected(self):
        for key, value in [('tempo', 0.1), ('tempo', 'fast'), ('gap', -1), ('lineGap', True)]:
            with self.assertRaises(ValueError, msg=f'{key}={value}'):
                validate_settings({key: value})


class TalkJsPayloadTest(unittest.TestCase):
    def test_script_close_sequence_is_escaped_but_json_remains_parseable(self):
        import json
        payload = talk_js_payload({'dur': 1, 'lines': [{'txt': 'x</script><script>alert(1)</script>'}]})
        self.assertNotIn('</script>', payload)
        body = payload.removeprefix('const TALK=').removesuffix(';\n')
        self.assertEqual(json.loads(body)['lines'][0]['txt'], 'x</script><script>alert(1)</script>')


class MixStudioCliIntegrationTest(unittest.TestCase):
    def test_stub_output_uses_safe_serialized_payload(self):
        import json, subprocess, tempfile
        from pathlib import Path
        root = Path(HERE).resolve().parents[1]
        with tempfile.TemporaryDirectory() as td:
            story = Path(td) / 'story'
            story.mkdir()
            (story / 'dialogue.txt').write_text('0|M|safe </script><script>alert(1)</script> text\n', encoding='utf-8')
            (story / 'segments.json').write_text('{"segments":[["missing.wav",0,0]]}', encoding='utf-8')
            cp = subprocess.run(
                [sys.executable, str(root / 'engine' / 'mix-studio.py'), '--stub'],
                cwd=td, capture_output=True, text=True
            )
            self.assertEqual(cp.returncode, 0, cp.stdout + cp.stderr)
            payload = (Path(td) / 'talk.js').read_text(encoding='utf-8')
            self.assertNotIn('</script>', payload)
            body = payload.removeprefix('const TALK=').removesuffix('\n').removesuffix(';')
            self.assertEqual(json.loads(body)['lines'][0]['txt'], 'safe </script><script>alert(1)</script> text')


if __name__ == '__main__':
    unittest.main()
