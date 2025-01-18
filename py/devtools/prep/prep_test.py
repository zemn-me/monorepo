import os
import pytest
from py.devtools.prep.__main__ import get_sapling_config_dir, ensure_sapling_include, configure_sapling

def test_get_sapling_config_dir(tmp_path):
    # Create a dummy working dir with a .git folder
    git_path = tmp_path / ".git"
    git_path.mkdir()
    # Expect that .git/sl is chosen
    assert get_sapling_config_dir(str(tmp_path)) == str(tmp_path / ".git" / "sl")

def test_ensure_sapling_include(tmp_path):
    config_file = tmp_path / "config"
    # File does not exist initially
    changed = ensure_sapling_include(str(config_file))
    assert changed  # Should create file and prepend line

    # Calling again should detect it's already included
    changed_again = ensure_sapling_include(str(config_file))
    assert not changed_again  # No change made

def test_configure_sapling(tmp_path):
    # This simply ties everything together
    configure_sapling(str(tmp_path))
    # Check presence of the config file
    config_dir = os.path.join(tmp_path, ".sl")
    assert os.path.isfile(os.path.join(config_dir, "config"))
