from __future__ import annotations

import json
import sqlite3
import tempfile
import zipfile
from pathlib import Path

from deckgen import DeckSpec, answer_for_pitch, build_deck, midi_to_pitch


def test_answer_modes() -> None:
    c_sharp_4 = midi_to_pitch(61)

    assert answer_for_pitch(c_sharp_4, "pitch-class") == "C# / Db"
    assert answer_for_pitch(c_sharp_4, "pitch-with-octave") == "C#4 / Db4"


def test_build_deck_package() -> None:
    spec = DeckSpec(
        deck_name="Pitch Training::Tiny",
        description="Tiny test deck.",
        answer_mode="pitch-with-octave",
        lowest_midi=60,
        highest_midi=61,
        duration_seconds=0.05,
        sample_rate=8000,
        waveform="piano",
    )

    with tempfile.TemporaryDirectory() as temp_name:
        output = Path(temp_name) / "tiny.apkg"
        build_deck(spec, output)

        with zipfile.ZipFile(output) as archive:
            names = set(archive.namelist())
            assert {"collection.anki2", "media", "0", "1"} <= names
            first_audio = archive.read("0")
            assert first_audio[0:4] == b"RIFF"
            assert first_audio[8:12] == b"WAVE"
            assert max(first_audio[44:]) > 0
            media = json.loads(archive.read("media"))
            assert media == {
                "0": "pitch_C4_midi_60.wav",
                "1": "pitch_Csharp4_midi_61.wav",
            }
            archive.extract("collection.anki2", temp_name)

        connection = sqlite3.connect(Path(temp_name) / "collection.anki2")
        try:
            note_count = connection.execute("select count(*) from notes").fetchone()[0]
            card_count = connection.execute("select count(*) from cards").fetchone()[0]
            answers = [
                row[0].split("\x1f")[1]
                for row in connection.execute("select flds from notes order by sfld")
            ]
        finally:
            connection.close()

        assert note_count == 2
        assert card_count == 2
        assert answers == ["C4 / B#4", "C#4 / Db4"]


if __name__ == "__main__":
    test_answer_modes()
    test_build_deck_package()
