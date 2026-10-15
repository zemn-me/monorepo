"""The public package must exclude executables, music, movies, and unrelated paths."""
import unittest
from project.tiberian_sun.assets.package_data import ARCHIVES, ROOT, select_members


class SelectionTest(unittest.TestCase):
    def test_only_game_archives_and_expansion_maps_are_published(self):
        names = [f"{ROOT}/{name.lower()}" for name in ARCHIVES]
        names += [f"{ROOT}/fsgdi01.map", f"{ROOT}/fsnod09.map"]
        names += [f"{ROOT}/{name}" for name in ["SCORES.MIX", "scores01.mix", "MOVIES01.MIX", "MOVIES02.MIX", "GAME.EXE", "SUN.INI", "Themes/themes.ini"]]
        names += [f"elsewhere/{name}" for name in ARCHIVES]
        result = select_members(names)
        self.assertEqual(set(result), ARCHIVES | {"FSGDI01.MAP", "FSNOD09.MAP"})
        self.assertEqual(list(result), sorted(result))

    def test_incomplete_or_ambiguous_release_fails(self):
        names = [f"{ROOT}/{name}" for name in ARCHIVES]
        with self.assertRaisesRegex(ValueError, "Missing required"):
            select_members(names[1:])
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            select_members(names + [names[0].lower().replace(ROOT.lower(), ROOT)])


if __name__ == "__main__":
    unittest.main()
