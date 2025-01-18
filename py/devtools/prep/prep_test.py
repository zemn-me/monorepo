import os
import pytest

from py.devtools.prep.lib import get_sapling_config_dir, ensure_sapling_include, configure_sapling

def test_get_sapling_config_dir(tmp_path):
    assert False, "Forced fail to show that tests do run under pytest."
    git_path = tmp_path / ".git"
    git_path.mkdir()
    assert get_sapling_config_dir(str(tmp_path)) == str(tmp_path / ".git" / "sl")

def test_ensure_sapling_include(tmp_path):
    config_file = tmp_path / "config"
    changed = ensure_sapling_include(str(config_file))
    assert changed
    changed_again = ensure_sapling_include(str(config_file))
    assert not changed_again

def test_configure_sapling(tmp_path):
    configure_sapling(str(tmp_path))
    config_dir = os.path.join(tmp_path, ".sl")
    assert os.path.isfile(os.path.join(config_dir, "config"))

def test_assert():
    assert False, "Another forced fail"

# ---- Important: custom entry point to invoke pytest ----
if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__]))
