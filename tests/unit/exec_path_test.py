"""Unit tests for engine/lib/exec_path.py — executables resolve from PATH only, never from the current directory."""
import os
import sys
import tempfile
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'engine', 'lib'))

from exec_path import find_executable  # noqa: E402

NAME = 'aiyu-fake-tool'
FILE = NAME + ('.exe' if os.name == 'nt' else '')


class FindExecutableTest(unittest.TestCase):
    def setUp(self):
        self.cwd = os.getcwd()
        self.dir = tempfile.mkdtemp()
        self.path = os.path.join(self.dir, FILE)
        with open(self.path, 'wb'):
            pass
        if os.name != 'nt':
            os.chmod(self.path, 0o755)

    def tearDown(self):
        os.chdir(self.cwd)
        os.remove(self.path)
        os.rmdir(self.dir)

    def test_resolves_from_path(self):
        with mock.patch.dict(os.environ, {'PATH': self.dir}):
            self.assertEqual(find_executable(NAME), self.path)

    def test_empty_path_is_an_error(self):
        with mock.patch.dict(os.environ, {'PATH': ''}):
            with self.assertRaises(FileNotFoundError):
                find_executable(NAME)

    def test_current_directory_is_not_searched(self):
        other = tempfile.mkdtemp()
        try:
            os.chdir(self.dir)
            with mock.patch.dict(os.environ, {'PATH': other}):
                with self.assertRaises(FileNotFoundError):
                    find_executable(NAME)
        finally:
            os.chdir(self.cwd)
            os.rmdir(other)

    def test_relative_path_entries_are_ignored(self):
        os.chdir(self.dir)
        with mock.patch.dict(os.environ, {'PATH': '.'}):
            with self.assertRaises(FileNotFoundError):
                find_executable(NAME)


if __name__ == '__main__':
    unittest.main()
