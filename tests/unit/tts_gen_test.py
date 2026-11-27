"""Unit tests for tools/tts-gen — pure planning/assembly logic only.
No network access anywhere: providers are fakes injected into the plan layer."""
import base64
import http.server
import json
import os
import shutil
import sys
import tempfile
import threading
import types
import unittest
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'tools', 'tts-gen'))

import lib_plan  # noqa: E402
import lib_providers  # noqa: E402


def wav_bytes(seconds=0.1, rate=24000):
    with tempfile.TemporaryDirectory() as td:
        path = os.path.join(td, 'x.wav')
        with wave.open(path, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
            w.writeframes(b'\x00\x00' * int(seconds * rate))
        with open(path, 'rb') as f:
            return f.read()


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
    def test_registry_marks_exactly_the_live_verified_providers(self):
        verified = {'edge', 'elevenlabs', 'gemini'}
        for name, p in lib_providers.PROVIDERS.items():
            self.assertEqual(p['experimental'], name not in verified, f'{name} experimental flag')
        self.assertEqual(lib_providers.PROVIDERS['edge']['tier'], 'A')
        self.assertEqual(lib_providers.PROVIDERS['elevenlabs']['tier'], 'A')
        self.assertEqual(lib_providers.PROVIDERS['gemini']['tier'], 'B')

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


class GeminiProviderTest(unittest.TestCase):
    def setUp(self):
        self._saved = (lib_providers._post_json, lib_providers._to_wav)
        os.environ['GEMINI_API_KEY'] = 'test-key'
        lib_providers._to_wav = lambda src, out, rate_hz=48000: shutil.copyfile(src, out)
        self.td = tempfile.mkdtemp()
        self.out = os.path.join(self.td, 'line.wav')

    def tearDown(self):
        lib_providers._post_json, lib_providers._to_wav = self._saved
        os.environ.pop('GEMINI_API_KEY', None)
        shutil.rmtree(self.td, ignore_errors=True)

    def fake_response(self, block):
        def post(url, payload, headers, timeout=120):
            self.seen = (url, payload, headers)
            return {'steps': [{'type': 'model_output', 'content': [block]}]}
        lib_providers._post_json = post

    def test_request_uses_interactions_endpoint_and_header_key(self):
        self.fake_response({'type': 'audio', 'data': base64.b64encode(wav_bytes()).decode()})
        lib_providers.synth_gemini('สวัสดี', 'Kore', '+0%', self.out)
        url, payload, headers = self.seen
        self.assertEqual(url, lib_providers.GEMINI_INTERACTIONS_URL)
        self.assertNotIn('key=', url)
        self.assertEqual(headers, {'x-goog-api-key': 'test-key'})
        self.assertEqual(payload['generation_config']['speech_config'], [{'voice': 'Kore'}])
        self.assertEqual(payload['response_format'], {'type': 'audio'})
        self.assertEqual(payload['input'][0]['content'][0]['text'], 'สวัสดี')
        self.assertTrue(os.path.getsize(self.out) > 0)

    def test_raw_pcm_response_is_wrapped_as_24khz_wav(self):
        seen_src = {}
        def to_wav(src, out, rate_hz=48000):
            with wave.open(src, 'rb') as w:
                seen_src['rate'] = w.getframerate()
            shutil.copyfile(src, out)
        lib_providers._to_wav = to_wav
        self.fake_response({'type': 'audio', 'data': base64.b64encode(b'\x00\x00' * 2400).decode()})
        lib_providers.synth_gemini('hi', 'Kore', '+0%', self.out)
        self.assertEqual(seen_src['rate'], 24000)

    def test_response_without_audio_block_is_a_clear_error(self):
        self.fake_response({'type': 'text', 'text': 'no audio'})
        with self.assertRaisesRegex(RuntimeError, 'no audio block'):
            lib_providers.synth_gemini('hi', 'Kore', '+0%', self.out)

    def test_last_audio_block_wins_like_output_audio(self):
        early, final = wav_bytes(0.1), wav_bytes(0.3)
        lib_providers._post_json = lambda url, payload, headers, timeout=120: {'steps': [{'type': 'model_output', 'content': [
            {'type': 'audio', 'data': base64.b64encode(early).decode()},
            {'type': 'audio', 'data': base64.b64encode(final).decode()}]}]}
        lib_providers.synth_gemini('hi', 'Kore', '+0%', self.out)
        with open(self.out, 'rb') as f:
            self.assertTrue(f.read() == final, 'synth_gemini must write the last audio block')

    def test_http_errors_are_wrapped_without_request_headers(self):
        class Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                self.rfile.read(int(self.headers.get('Content-Length', 0)))
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'bad request body')
            def log_message(self, *args):
                pass
        server = http.server.HTTPServer(('127.0.0.1', 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            url = f'http://127.0.0.1:{server.server_port}/x'
            with self.assertRaises(RuntimeError) as ctx:
                lib_providers._post_json(url, {'a': 1}, {'x-goog-api-key': 'test-key'})
            self.assertIn('HTTP 400', str(ctx.exception))
            self.assertIn('bad request body', str(ctx.exception))
            self.assertNotIn('test-key', str(ctx.exception))
        finally:
            server.shutdown()
            server.server_close()


class ElevenLabsProviderTest(unittest.TestCase):
    def setUp(self):
        self._saved = (lib_providers._post_json, lib_providers._to_wav)
        os.environ['ELEVENLABS_API_KEY'] = 'test-key'
        lib_providers._to_wav = lambda src, out, rate_hz=48000: shutil.copyfile(src, out)
        self.td = tempfile.mkdtemp()
        self.out = os.path.join(self.td, 'line.wav')

    def tearDown(self):
        lib_providers._post_json, lib_providers._to_wav = self._saved
        os.environ.pop('ELEVENLABS_API_KEY', None)
        shutil.rmtree(self.td, ignore_errors=True)

    def fake_response(self, body):
        def post(url, payload, headers, timeout=120):
            self.seen = (url, payload, headers)
            return body
        lib_providers._post_json = post

    def test_output_format_is_a_query_parameter_and_key_is_a_header(self):
        self.fake_response({'audio_base64': base64.b64encode(wav_bytes()).decode(), 'alignment': None})
        lib_providers.synth_elevenlabs('สวัสดี', 'voice123', '+0%', self.out)
        url, payload, headers = self.seen
        self.assertEqual(url, 'https://api.elevenlabs.io/v1/text-to-speech/voice123/with-timestamps?output_format=mp3_44100_128')
        self.assertNotIn('output_format', payload)
        self.assertEqual(headers, {'xi-api-key': 'test-key'})
        self.assertEqual(payload['text'], 'สวัสดี')

    def test_alignment_groups_characters_into_words(self):
        chars = ['H', 'i', ' ', 't', 'h', 'e', 'r', 'e', '.']
        starts = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
        ends = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
        self.fake_response({'audio_base64': base64.b64encode(wav_bytes()).decode(), 'alignment': {
            'characters': chars, 'character_start_times_seconds': starts, 'character_end_times_seconds': ends}})
        result = lib_providers.synth_elevenlabs('Hi there.', 'voice123', '+0%', self.out)
        self.assertEqual(result, {'words': [['Hi', 0.0, 0.2], ['there', 0.3, 0.8]]})

    def test_missing_alignment_is_untimed_not_an_error(self):
        self.fake_response({'audio_base64': base64.b64encode(wav_bytes()).decode(), 'alignment': None})
        self.assertEqual(lib_providers.synth_elevenlabs('hi', 'voice123', '+0%', self.out), {'words': None})

    def test_default_model_is_one_that_lists_thai(self):
        self.fake_response({'audio_base64': base64.b64encode(wav_bytes()).decode(), 'alignment': None})
        lib_providers.synth_elevenlabs('สวัสดี', 'voice123', '+0%', self.out)
        self.assertIn(self.seen[1]['model_id'], ('eleven_v4', 'eleven_v4_turbo'))


class ListVoicesTest(unittest.TestCase):
    def setUp(self):
        self._saved = sys.modules.get('edge_tts')

    def tearDown(self):
        if self._saved is None:
            sys.modules.pop('edge_tts', None)
        else:
            sys.modules['edge_tts'] = self._saved

    def test_edge_voices_are_sorted_by_locale_and_name(self):
        async def list_voices():
            return [{'ShortName': 'th-TH-NiwatNeural', 'Locale': 'th-TH'},
                    {'ShortName': 'en-US-AriaNeural', 'Locale': 'en-US'}]
        sys.modules['edge_tts'] = types.SimpleNamespace(list_voices=list_voices)
        names = [v['ShortName'] for v in lib_providers.list_voices('edge')]
        self.assertEqual(names, ['en-US-AriaNeural', 'th-TH-NiwatNeural'])

    def test_other_providers_explain_that_voices_come_from_tts_json(self):
        with self.assertRaisesRegex(ValueError, 'edge only'):
            lib_providers.list_voices('gemini')

    def test_missing_edge_tts_is_a_clear_error(self):
        sys.modules['edge_tts'] = None
        with self.assertRaisesRegex(RuntimeError, 'edge-tts is not installed'):
            lib_providers.list_voices('edge')


if __name__ == '__main__':
    unittest.main()
