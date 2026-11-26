"""Unit tests for tools/tts-gen — pure planning/assembly logic only.
No network access anywhere: providers are fakes injected into the plan layer."""
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'tools', 'tts-gen'))

import lib_plan  # noqa: E402
import lib_providers  # noqa: E402


def lines_fixture():
    return [
        {'i': 0, 'spk': 'M', 'txt': 'line zero'},
        {'i': 1, 'spk': 'M', 'txt': 'line one'},
        {'i': 2, 'spk': 'H', 'txt': 'character speaks'},
    ]


class ValidateConfigTest(unittest.TestCase):
    def test_resolves_defaults_and_overrides(self):
        cfg = {'defaults': {'provider': 'edge', 'voice': 'th-TH-PremwadeeNeural'},
               'speakers': {'H': {'voice': 'th-TH-NiwatNeural'}}}
        resolved, unknown = lib_plan.validate_config(cfg, {'M', 'H'})
        self.assertEqual(unknown, [])
        self.assertEqual(resolved['M']['voice'], 'th-TH-PremwadeeNeural')
        self.assertEqual(resolved['H']['voice'], 'th-TH-NiwatNeural')
        self.assertEqual(resolved['H']['provider'], 'edge')  # inherited from defaults
        self.assertEqual(resolved['M']['rate'], '+0%')

    def test_missing_voice_is_error(self):
        with self.assertRaises(ValueError) as ctx:
            lib_plan.validate_config({'speakers': {'M': {'provider': 'edge'}}}, {'M'})
        self.assertIn("'M'", str(ctx.exception))

    def test_empty_speakers_is_error(self):
        with self.assertRaises(ValueError):
            lib_plan.validate_config({'speakers': {}}, {'M'})

    def test_unknown_speaker_entries_reported(self):
        cfg = {'defaults': {'provider': 'edge', 'voice': 'v'}, 'speakers': {'Z': {'voice': 'x'}}}
        _, unknown = lib_plan.validate_config(cfg, {'M'})
        self.assertEqual(unknown, ['Z'])


class BuildPlanTest(unittest.TestCase):
    def test_per_line_files_and_naming(self):
        resolved = {'M': {'provider': 'edge', 'voice': 'v', 'rate': '+0%'},
                    'H': {'provider': 'edge', 'voice': 'w', 'rate': '+0%'}}
        jobs = lib_plan.build_plan(lines_fixture(), resolved)
        self.assertEqual(len(jobs), 3)
        self.assertEqual(jobs[0]['file'], 'n000-000.wav')  # narrator single-line convention
        self.assertEqual(jobs[2]['file'], 'c002_H.wav')    # character convention
        self.assertEqual([j['line'] for j in jobs], [0, 1, 2])  # order preserved

    def test_segments_payload_is_exact_by_construction(self):
        resolved = {'M': {'provider': 'edge', 'voice': 'v', 'rate': '+0%'},
                    'H': {'provider': 'edge', 'voice': 'w', 'rate': '+0%'}}
        jobs = lib_plan.build_plan(lines_fixture(), resolved)
        payload = lib_plan.segments_payload(jobs)
        self.assertEqual(payload['segments'],
                         [['n000-000.wav', 0, 0], ['n001-001.wav', 1, 1], ['c002_H.wav', 2, 2]])
        self.assertIn('tempo', payload['settings'])


class WordtimesTest(unittest.TestCase):
    def test_payload_rounds_and_omits_untimed_lines(self):
        results = {0: [['hello', 0.012345, 0.4]], 1: None, 2: [['hi', 0.0, 0.2], ['there', 0.25, 0.5]]}
        wt = lib_plan.wordtimes_payload(results)
        self.assertNotIn('1', wt)  # tier-B provider line absent, never breaks
        self.assertEqual(wt['0'], [['hello', 0.012, 0.4]])
        self.assertEqual(len(wt['2']), 2)

    def test_empty_when_no_provider_times(self):
        self.assertEqual(lib_plan.wordtimes_payload({0: None, 1: None}), {})


class WriteDraftTest(unittest.TestCase):
    def test_refuses_overwrite_without_force(self):
        with tempfile.TemporaryDirectory() as td:
            path = os.path.join(td, 'x.json')
            _, skipped = lib_plan.write_draft(path, {'a': 1})
            self.assertFalse(skipped)
            _, skipped = lib_plan.write_draft(path, {'a': 2})
            self.assertTrue(skipped)
            with open(path, encoding='utf-8') as f:
                self.assertEqual(json.load(f), {'a': 1})  # untouched
            _, skipped = lib_plan.write_draft(path, {'a': 2}, force=True)
            self.assertFalse(skipped)
            with open(path, encoding='utf-8') as f:
                self.assertEqual(json.load(f), {'a': 2})


class ProviderRegistryTest(unittest.TestCase):
    def test_edge_is_only_verified_provider(self):
        for name, p in lib_providers.PROVIDERS.items():
            if name == 'edge':
                self.assertFalse(p['experimental'])
                self.assertEqual(p['tier'], 'A')
            else:
                self.assertTrue(p['experimental'], f'{name} must be labeled experimental until live-tested')

    def test_unknown_provider_clear_error(self):
        with self.assertRaises(ValueError) as ctx:
            lib_providers.get_provider('nonexistent')
        self.assertIn('edge', str(ctx.exception))  # error lists known providers

    def test_paid_providers_fail_fast_without_keys(self):
        os.environ.pop('ELEVENLABS_API_KEY', None)
        os.environ.pop('GEMINI_API_KEY', None)
        for name in ('elevenlabs', 'gemini'):
            with self.assertRaises(RuntimeError) as ctx:
                lib_providers.PROVIDERS[name]['fn']('hi', 'voice', '+0%', 'out.wav')
            self.assertIn('API_KEY', str(ctx.exception))


if __name__ == '__main__':
    unittest.main()
