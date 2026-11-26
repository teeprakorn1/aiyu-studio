"""Pure planning/assembly logic for tools/tts-gen — importable and testable without
network access or any TTS dependency. All functions are deterministic, stdlib only.

Design truth that shapes everything here: aiyu-studio's segments.json maps voice files
to line ranges, so synthesizing ONE FILE PER LINE makes the mapping exact by construction
— no alignment, no guessing. Word timing is a separate, optional layer used only by the
karaoke subtitle mode; it is a provider capability, not an assumption.
"""
import json
import os


def validate_config(cfg, speakers):
    """Validate story/tts.json structure against the speakers present in the dialogue.
    Config shape: {"defaults": {...}, "speakers": {"M": {"provider","voice","rate?"}, ...}}
    Every dialogue speaker must resolve to a provider+voice pair (own entry or defaults)."""
    if not isinstance(cfg, dict):
        raise ValueError('tts.json: expected an object with "speakers"')
    table = cfg.get('speakers')
    if not isinstance(table, dict) or not table:
        raise ValueError('tts.json: "speakers" must be a non-empty object keyed by speaker id')
    defaults = cfg.get('defaults', {}) or {}
    resolved = {}
    for spk in sorted(speakers):
        entry = dict(defaults)
        entry.update(table.get(spk) or {})
        provider, voice = entry.get('provider'), entry.get('voice')
        if not provider or not voice:
            raise ValueError(
                f'tts.json: speaker {spk!r} has no provider+voice '
                f'(set it in "speakers" or "defaults")')
        resolved[spk] = {
            'provider': str(provider),
            'voice': str(voice),
            'rate': str(entry.get('rate', '+0%')),
        }
    unknown = sorted(set(table) - set(speakers))
    return resolved, unknown


def file_name(line_idx, spk, narrator='M'):
    """Production naming convention, single-line form: narrator n<l>-<l>.wav, characters c<l>_<spk>.wav."""
    if spk == narrator:
        return f'n{line_idx:03d}-{line_idx:03d}.wav'
    return f'c{line_idx:03d}_{spk}.wav'


def build_plan(lines, resolved, narrator='M'):
    """Turn parsed dialogue + resolved voice config into synthesis jobs, in line order.
    Each job: {line, spk, txt, provider, voice, rate, file}."""
    jobs = []
    for ln in lines:
        cfg = resolved[ln['spk']]
        jobs.append({
            'line': ln['i'],
            'spk': ln['spk'],
            'txt': ln['txt'],
            'provider': cfg['provider'],
            'voice': cfg['voice'],
            'rate': cfg['rate'],
            'file': file_name(ln['i'], ln['spk'], narrator),
        })
    return jobs


def segments_payload(jobs):
    """Assemble the segments.json payload from completed jobs (all single-line segments).
    Settings mirror the template defaults; the author tunes tempo/gap afterwards as usual."""
    return {
        'settings': {'tempo': 1.0, 'gap': 0.15, 'trimThresh': 500, 'lineGap': 0.06},
        'segments': [[j['file'], j['line'], j['line']] for j in jobs],
    }


def wordtimes_payload(jobs_results):
    """Assemble story/wordtimes.json from per-line synthesis results.
    jobs_results: {line_index: None | [[word, start, end], ...]} relative to the line audio.
    Lines without timing are simply absent — karaoke degrades per-line, never breaks."""
    out = {}
    for line, words in sorted(jobs_results.items()):
        if words:
            out[str(line)] = [[w, round(float(s), 3), round(float(e), 3)] for w, s, e in words]
    return out


def write_draft(path, payload, force=False, kind='segments'):
    """Write a draft json file, refusing to overwrite an existing file unless forced.
    Returns (written_path, skipped)."""
    if os.path.exists(path) and not force:
        return path, True
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write('\n')
    return path, False
