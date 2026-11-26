"""Provider abstraction for tools/tts-gen — thin network shells over documented APIs.

Capability tiers:
  tier A — audio + word timing (karaoke-capable): edge, elevenlabs
  tier B — audio only: gemini (karaoke unavailable; main workflow unaffected)

Provider contract:
  synthesize(text, voice, rate, out_wav_path) -> {'words': [[word, start, end]] | None}
  — writes a wav file (16-bit mono) to out_wav_path, returns word timing when available.

HONESTY NOTE: only the edge provider is verified against the live service. elevenlabs
and gemini are implemented per their published API documentation but are EXPERIMENTAL —
untested against the live APIs. They are thin shells; treat first real use as a test.
"""
import base64
import json
import os
import subprocess
import tempfile
import wave


def _to_wav(src_path, out_wav, rate_hz=48000):
    """Convert any ffmpeg-decodable audio to the production wav shape (mono s16)."""
    subprocess.run(
        ['ffmpeg', '-v', 'error', '-y', '-i', src_path,
         '-ac', '1', '-ar', str(rate_hz), '-acodec', 'pcm_s16le', out_wav],
        capture_output=True, check=True)


def _pcm_to_wav(pcm_bytes, out_wav, rate_hz, sampwidth=2):
    """Wrap raw little-endian PCM in a wav container without a decode round-trip."""
    with wave.open(out_wav, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(sampwidth)
        wf.setframerate(rate_hz)
        wf.writeframes(pcm_bytes)


def synth_edge(text, voice, rate, out_wav):
    """edge-tts — free, no key. Word timing arrives free inside the synthesis stream
    via SubMaker word-boundary cues (the key discovery from MoneyPrinterTurbo)."""
    import asyncio
    import edge_tts

    async def stream_to(mp3_path, boundary):
        # verified against edge-tts 7.3.1: word boundaries must be requested explicitly
        # (the default is SentenceBoundary); chunks carry offset/duration in
        # 100-nanosecond units alongside the audio stream.
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
        # word-boundary support is VOICE-SPECIFIC, not language-specific — verified live:
        # th-TH-NiwatNeural emits them, th-TH-PremwadeeNeural answers NoAudioReceived.
        # Detect at runtime: try with boundaries, fall back to plain audio on failure.
        # This can never be a config-time decision.
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
    grouped here into words at whitespace/punctuation boundaries. EXPERIMENTAL: untested
    against the live API. Needs ELEVENLABS_API_KEY in the environment."""
    import requests

    key = os.environ.get('ELEVENLABS_API_KEY')
    if not key:
        raise RuntimeError('elevenlabs provider needs ELEVENLABS_API_KEY in the environment')
    resp = requests.post(
        f'https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps',
        headers={'xi-api-key': key, 'Content-Type': 'application/json'},
        json={'text': text, 'model_id': 'eleven_multilingual_v2',
              'output_format': 'mp3_44100_128'},
        timeout=120)
    resp.raise_for_status()
    data = resp.json()
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


def synth_gemini(text, voice, rate, out_wav):
    """Google Gemini speech generation — PCM audio returned inline, no timing data
    (tier B). EXPERIMENTAL: untested against the live API. Needs GEMINI_API_KEY."""
    import requests

    key = os.environ.get('GEMINI_API_KEY')
    if not key:
        raise RuntimeError('gemini provider needs GEMINI_API_KEY in the environment')
    resp = requests.post(
        f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key={key}',
        headers={'Content-Type': 'application/json'},
        json={
            'contents': [{'parts': [{'text': text}]}],
            'generationConfig': {
                'responseModalities': ['AUDIO'],
                'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': voice}}},
            },
        },
        timeout=120)
    resp.raise_for_status()
    data = resp.json()
    part = data['candidates'][0]['content']['parts'][0]['inline_data']
    pcm = base64.b64decode(part['data'])
    # gemini TTS emits L16 PCM at 24kHz mono
    _pcm_to_wav(pcm, out_wav, rate_hz=24000)
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
        'experimental': True,
        'desc': 'ElevenLabs with-timestamps — paid, needs ELEVENLABS_API_KEY (EXPERIMENTAL: untested live)',
    },
    'gemini': {
        'fn': synth_gemini,
        'tier': 'B',
        'experimental': True,
        'desc': 'Google Gemini TTS — paid, needs GEMINI_API_KEY, no word timing (EXPERIMENTAL: untested live)',
    },
}


def get_provider(name):
    """Resolve a provider entry by name with a clear error for unknown names."""
    if name not in PROVIDERS:
        known = ', '.join(sorted(PROVIDERS))
        raise ValueError(f'unknown TTS provider {name!r} — known: {known}')
    return PROVIDERS[name]
