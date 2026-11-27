"""Resolve external executables from PATH only, never from the current directory."""
import os


def find_executable(name):
    """Return the absolute path of an executable found on PATH.

    @param {str} name - bare command name, e.g. 'ffmpeg'
    @returns {str} absolute path of the first PATH entry that provides it
    @raises FileNotFoundError when no PATH entry provides the executable
    """
    exts = [''] if os.name != 'nt' or os.path.splitext(name)[1] else ['.exe', '.com']
    for d in os.environ.get('PATH', '').split(os.pathsep):
        if not d or not os.path.isabs(d):
            continue
        for ext in exts:
            cand = os.path.join(d, name + ext)
            if os.access(cand, os.X_OK) and not os.path.isdir(cand):
                return cand
    raise FileNotFoundError(f'{name} not found on PATH (the current directory is intentionally not searched)')
