"""@file align_phoneme.py — phoneme-grade word timing via wav2vec2 CTC forced alignment.

Aligns each vo/*.wav file against the transcript lines segments.json says it contains —
no ASR anywhere: the text is known exactly, alignment just finds WHEN each character is
spoken. Output: story/wordtimes.phoneme.json in the exact schema mix-studio.py merges
into talk.js for karaoke subtitles and rvw() keyword reveals.

Usage: python align_phoneme.py [project] [--model HF_ID] [--write] [--force]

Optional tool with heavy isolated dependencies (torch + transformers — gigabytes).
Install into its own venv: pip install -r requirements.txt — the core pipeline,
fuzzy auto-segment path, and tests never import any of this. The CTC trellis and
span logic live in lib_ctc.py and run without torch.
"""
import argparse
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'engine', 'lib'))

import lib_ctc  # noqa: E402
import mix_audio  # noqa: E402
from exec_path import find_executable  # noqa: E402

SR = 16000
DEFAULT_MODEL = 'airesearch/wav2vec2-large-xlsr-53-th'


def fail(msg):
    print(f'align-phoneme: error: {msg}', file=sys.stderr)
    sys.exit(1)


def decode_wav_f32(path):
    """Decode any audio file to mono 16kHz float32 PCM via ffmpeg (already a project dep).
    @returns {bytes} raw little-endian f32 samples"""
    r = subprocess.run([find_executable('ffmpeg'), '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1',
                        '-ar', str(SR), '-'], capture_output=True)
    if r.returncode != 0:
        fail(f'ffmpeg failed decoding {os.path.basename(path)}: {r.stderr.decode(errors="replace")[-300:]}')
    return r.stdout


def load_model(model_id):
    """Load wav2vec2 CTC model + processor. Heavy: downloads GBs on first run."""
    try:
        import torch  # noqa: F401
        from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
    except ImportError:
        fail('torch/transformers not installed — this tool needs its own venv: '
             'pip install -r tools/phoneme-align/requirements.txt (gigabytes, opt-in by design)')
    print(f'align-phoneme: loading {model_id} (first run downloads the model)…')
    processor = Wav2Vec2Processor.from_pretrained(model_id)
    model = Wav2Vec2ForCTC.from_pretrained(model_id)
    model.eval()
    return processor, model


def transcript_tokens(processor, text):
    """Encode transcript characters to token ids using the model's own tokenizer.
    Characters outside the vocab are dropped with a warning. Spaces map to the model's word delimiter if it has one.
    @returns {tuple[list[int], list[int]]} token ids and the transcript index each id came from"""
    vocab = processor.tokenizer.get_vocab()
    ids, index, dropped = [], [], set()
    for i, ch in enumerate(text):
        key = ch
        if key not in vocab and ch == ' ' and '|' in vocab:
            key = '|'
        if key in vocab:
            ids.append(vocab[key])
            index.append(i)
        else:
            dropped.add(ch)
    if dropped:
        print(f'align-phoneme: warning: {len(dropped)} chars outside model vocab dropped: '
              + ''.join(sorted(dropped))[:40], file=sys.stderr)
    return ids, index


def align_file(processor, model, pcm_bytes, transcript, frame_sec=0.02):
    """Forced-align one audio buffer against its known transcript.
    @returns {list[list]} [[word, start, end], ...] seconds relative to file start"""
    import numpy as np
    import torch
    samples = torch.from_numpy(np.frombuffer(pcm_bytes, dtype=np.float32).copy())
    with torch.no_grad():
        logits = model(samples.unsqueeze(0)).logits[0]
    emission = torch.log_softmax(logits, dim=-1).tolist()
    ids, index = transcript_tokens(processor, transcript)
    blank = processor.tokenizer.pad_token_id
    spans = lib_ctc.align_spans(emission, ids, frame_sec, 0 if blank is None else blank)
    mapped = [(index[pos - 1] + 1, s, e) for pos, s, e in spans]
    return lib_ctc.group_words_by_runs(mapped, transcript)


def main():
    ap = argparse.ArgumentParser(description='phoneme-grade wordtimes.json via wav2vec2 forced alignment')
    ap.add_argument('project', nargs='?', default='.', help='project directory (default: cwd)')
    ap.add_argument('--model', default=DEFAULT_MODEL, help=f'huggingface wav2vec2 CTC model (default: {DEFAULT_MODEL})')
    ap.add_argument('--write', action='store_true', help='write story/wordtimes.json instead of wordtimes.phoneme.json')
    ap.add_argument('--force', action='store_true', help='allow overwriting an existing target file')
    args = ap.parse_args()

    proj = os.path.abspath(args.project)
    seg_path = os.path.join(proj, 'story', 'segments.json')
    dia_path = os.path.join(proj, 'story', 'dialogue.txt')
    if not os.path.isfile(seg_path):
        fail('no story/segments.json — run the mix prep first (segments must be final)')
    if not os.path.isfile(dia_path):
        fail('no story/dialogue.txt')
    with open(dia_path, encoding='utf-8') as f:
        dialogue = mix_audio.parse_dialogue_text(f.read())
    lines = {ln['i']: ln['txt'] for ln in dialogue}
    with open(seg_path, encoding='utf-8') as f:
        spec = json.load(f)
    try:
        segs = mix_audio.validate_segments(spec['segments'], len(dialogue))
    except (KeyError, TypeError, ValueError) as exc:
        fail(f'story/segments.json: {exc}')

    processor, model = load_model(args.model)

    out = {}
    for file_name, a, b in segs:
        wav = os.path.join(proj, 'vo', file_name)
        if not os.path.isfile(wav):
            print(f'align-phoneme: warning: vo/{file_name} missing — skipped', file=sys.stderr)
            continue
        transcript = ' '.join(lines.get(i, '') for i in range(a, b + 1)).strip()
        if not transcript:
            continue
        pcm = decode_wav_f32(wav)
        rows = align_file(processor, model, pcm, transcript)
        if rows:
            out[str(a)] = rows
            print(f'align-phoneme: {file_name} lines {a}–{b}: {len(rows)} chunks aligned')

    if not out:
        fail('nothing aligned — check vo files and transcripts')

    target = os.path.join(proj, 'story', 'wordtimes.json' if args.write else 'wordtimes.phoneme.json')
    if os.path.exists(target) and not args.force:
        fail(f'{os.path.basename(target)} already exists — pass --force to overwrite (never clobbering by default)')
    with open(target, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f'align-phoneme: wrote {os.path.relpath(target, proj)}'
          + ('' if args.write else ' — rename/copy to story/wordtimes.json then re-run npm run mix'))


if __name__ == '__main__':
    main()
