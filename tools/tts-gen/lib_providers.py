"""Provider abstraction for tools/tts-gen — thin network shells over documented APIs.

Capability tiers:
  tier A — audio + word timing (karaoke-capable): edge, elevenlabs
  tier B — audio only: gemini (karaoke unavailable; main workflow unaffected)

Provider contract:
  synthesize(text, voice, rate, out_wav_path) -> {'words': [[word, start, end]] | None}
  — writes a wav file (16-bit mono) to out_wav_path, returns word timing when available.

HONESTY NOTE: edge, elevenlabs, and gemini were each verified against the live service with
one Thai sample (2026-11-27). Other voices, languages, and models are untested. They are thin
shells; treat each new voice or model as a test.
"""
import base64
import json
import os
import subprocess
import tempfile
import sys
import wave

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'engine', 'lib'))
from exec_path import find_executable  # noqa: E402

GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'
GEMINI_TTS_MODEL = 'gemini-3.8-flash-tts'
ELEVENLABS_TTS_MODEL = 'eleven_v4'


def _post_json(url, payload, headers, timeout=120):
    """POST JSON and return the parsed response using only the standard library.
    (project law: python stdlib only — requests is a third-party dependency)
    HTTP and network failures are re-raised as RuntimeError without request headers, so API keys never reach logs."""
    import urllib.error
    import urllib.request
    body = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=body, method='POST',
                                 headers=dict({'Content-Type': 'application/json'}, **headers))
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode('utf-8', errors='replace')[:300]
        raise RuntimeError(f'HTTP {exc.code} from provider: {detail}') from None
    except urllib.error.URLError as exc:
        raise RuntimeError(f'provider unreachable: {exc.reason}') from None


def _to_wav(src_path, out_wav, rate_hz=48000):
    """Convert any ffmpeg-decodable audio to the production wav shape (mono s16)."""
    subprocess.run(
        [find_executable('ffmpeg'), '-v', 'error', '-y', '-i', src_path,
         '-ac', '1', '-ar', str(rate_hz), '-acodec', 'pcm_s16le', out_wav],
        capture_output=True, check=True)


def _pcm_to_wav(pcm_bytes, out_wav, rate_hz, sampwidth=2):
    """Wrap raw little-endian PCM in a wav container without a decode round-trip."""
    with wave.open(out_wav, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(sampwidth)
        wf.setframerate(rate_hz)
        wf.writeframes(pcm_bytes)


def _write_audio(raw, out_wav, rate_hz=24000):
    """Normalize provider audio into the production wav shape.
    WAV containers are decoded as-is; anything else is treated as raw L16 PCM at rate_hz."""
    with tempfile.TemporaryDirectory() as td:
        src = os.path.join(td, 'src.wav')
        if raw[:4] == b'RIFF':
            with open(src, 'wb') as f:
                f.write(raw)
        else:
            _pcm_to_wav(raw, src, rate_hz)
        _to_wav(src, out_wav)


def synth_edge(text, voice, rate, out_wav):
    """edge-tts — free, no key. Word timing arrives free inside the synthesis stream
    via SubMaker word-boundary cues (the key discovery from MoneyPrinterTurbo)."""
    import asyncio
    import edge_tts

    async def stream_to(mp3_path, boundary):
        comm = edge_tts.Communicate(text, voice, rate=rate or '+0%', boundary=boundary)
        words = []
        with open(mp3_path, 'wb') as f:
            async for chunk in comm.stream():
                if chunk['type'] == 'audio':
                    f.write(chunk['data'])
                elif chunk['type'] == 'WordBoundary':
                    s = chunk['offset'] / 1e7
                    e = (chunk['offset'] + chunk['duration']) / 1e7
                    w = str(chunk.get('text', '')).strip()
                    if w:
                        words.append([w, s, e])
        return words

    async def run(mp3_path):
        try:
            return await stream_to(mp3_path, 'WordBoundary')
        except edge_tts.exceptions.NoAudioReceived:
            return await stream_to(mp3_path, 'SentenceBoundary')

    with tempfile.TemporaryDirectory() as td:
        mp3 = os.path.join(td, 'out.mp3')
        words = asyncio.run(run(mp3))
        _to_wav(mp3, out_wav)
    return {'words': words or None}


def synth_elevenlabs(text, voice, rate, out_wav):
    """ElevenLabs with-timestamps endpoint — returns audio + per-character alignment,
    grouped here into words at whitespace/punctuation boundaries. Verified live with one Thai
    sample. Needs ELEVENLABS_API_KEY in the environment."""
    import urllib.parse
    key = os.environ.get('ELEVENLABS_API_KEY')
    if not key:
        raise RuntimeError('elevenlabs provider needs ELEVENLABS_API_KEY in the environment')
    data = _post_json(
        f'https://api.elevenlabs.io/v1/text-to-speech/{urllib.parse.quote(voice, safe="")}/with-timestamps?output_format=mp3_44100_128',
        {'text': text, 'model_id': ELEVENLABS_TTS_MODEL},
        {'xi-api-key': key})
    audio = base64.b64decode(data['audio_base64'])
    with tempfile.TemporaryDirectory() as td:
        mp3 = os.path.join(td, 'out.mp3')
        with open(mp3, 'wb') as f:
            f.write(audio)
        _to_wav(mp3, out_wav)

    al = data.get('alignment') or {}
    chars, starts, ends = al.get('characters', []), al.get('character_start_times_seconds', []), al.get('character_end_times_seconds', [])
    words, cur, ws, we = [], '', None, None
    for ch, s, e in zip(chars, starts, ends):
        if ch.isspace() or ch in '.,!?;:—–-':
            if cur:
                words.append([cur, ws, we])
            cur, ws = '', None
            continue
        if ws is None:
            ws = s
        cur, we = cur + ch, e
    if cur:
        words.append([cur, ws, we])
    return {'words': words or None}


def _gemini_audio(data):
    """Extract the audio bytes from an Interactions API response: its last audio block, as the SDK's output_audio returns."""
    blocks = [block for step in data.get('steps') or [] if step.get('type') == 'model_output'
              for block in step.get('content') or [] if block.get('type') == 'audio' and block.get('data')]
    if not blocks:
        raise RuntimeError('gemini response has no audio block (expected steps[].content[] with type "audio")')
    return base64.b64decode(blocks[-1]['data'])


def synth_gemini(text, voice, rate, out_wav):
    """Google Gemini TTS through the Interactions API (speech_config voice, audio response).
    Tier B: no word timing. Verified live with one Thai sample. Needs GEMINI_API_KEY,
    sent in the x-goog-api-key header and never in the URL."""
    key = os.environ.get('GEMINI_API_KEY')
    if not key:
        raise RuntimeError('gemini provider needs GEMINI_API_KEY in the environment')
    data = _post_json(
        GEMINI_INTERACTIONS_URL,
        {'model': GEMINI_TTS_MODEL,
         'input': [{'type': 'user_input', 'content': [{'type': 'text', 'text': text}]}],
         'response_format': {'type': 'audio'},
         'generation_config': {'speech_config': [{'voice': voice}]}},
        {'x-goog-api-key': key})
    _write_audio(_gemini_audio(data), out_wav)
    return {'words': None}


PROVIDERS = {
    'edge': {
        'fn': synth_edge,
        'tier': 'A',
        'experimental': False,
        'desc': 'edge-tts — free, no key, word timing included (verified against live service)',
    },
    'elevenlabs': {
        'fn': synth_elevenlabs,
        'tier': 'A',
        'experimental': False,
        'desc': 'ElevenLabs with-timestamps (eleven_v4) — needs ELEVENLABS_API_KEY, word timing included; verified with one Thai sample',
    },
    'gemini': {
        'fn': synth_gemini,
        'tier': 'B',
        'experimental': False,
        'desc': 'Google Gemini TTS (Interactions API) — needs GEMINI_API_KEY (free or paid tier), no word timing; verified with one Thai sample',
    },
}


def get_provider(name):
    """Resolve a provider entry by name with a clear error for unknown names."""
    if name not in PROVIDERS:
        known = ', '.join(sorted(PROVIDERS))
        raise ValueError(f'unknown TTS provider {name!r} — known: {known}')
    return PROVIDERS[name]


def list_voices(provider):
    """Voices from a provider's own service listing. Only edge exposes one; other providers take voice names from story/tts.json.

    @param {str} provider - provider name
    @returns {list[dict]} voice records sorted by locale and short name
    """
    if provider != 'edge':
        raise ValueError(f'voice listing is implemented for edge only; set {provider!r} voice names directly in story/tts.json')
    try:
        import edge_tts
    except ImportError:
        raise RuntimeError('edge-tts is not installed: pip install -r tools/tts-gen/requirements.txt') from None
    import asyncio
    voices = asyncio.run(edge_tts.list_voices())
    return sorted(voices, key=lambda v: (v.get('Locale', ''), v.get('ShortName', '')))
