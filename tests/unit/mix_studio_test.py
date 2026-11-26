# mix_studio_test.py — unit tests for pure audio functions in engine/mix-studio.py
# The script executes at import time, so we extract the pure functions by source.
import array, re, unittest, os, math

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = open(os.path.join(HERE, '..', '..', 'engine', 'mix-studio.py'), encoding='utf-8').read()

def extract(name):
    m = re.search(r'^def ' + name + r'\(.*?\n(?=\S)', SRC, re.S | re.M)
    assert m, f'{name} not found in mix-studio.py'
    ns = {'array': array, 'TRIM_THRESH': 500}
    exec(m.group(0), ns)
    return ns[name]

wave_peaks = extract('wave_peaks')
trim_edges = extract('trim_edges')

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
        # 2.0s in, expect ~1.0-1.2s out (pad included), definitely not full length
        self.assertLess(len(out), len(raw) * 0.75)
        self.assertGreater(len(out), 48000 * 0.8)  # keeps the tone body (in bytes: 1s = 48000B)

    def test_pure_silence_returns_untrimmed(self):
        raw = pcm_silence(1.0)
        out = trim_edges(raw)
        self.assertEqual(len(out), len(raw))

if __name__ == '__main__':
    unittest.main()
