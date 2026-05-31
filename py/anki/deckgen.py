"""Generate Anki pitch-training decks from small JSON specs."""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import shutil
import sqlite3
import struct
import tempfile
import wave
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Literal


AnswerMode = Literal["pitch-class", "pitch-with-octave"]

SHARP_NAMES = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")
FLAT_NAMES = ("C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B")
ENHARMONIC_NAMES = {
    0: ("C", "B#"),
    1: ("C#", "Db"),
    2: ("D",),
    3: ("D#", "Eb"),
    4: ("E", "Fb"),
    5: ("F", "E#"),
    6: ("F#", "Gb"),
    7: ("G",),
    8: ("G#", "Ab"),
    9: ("A",),
    10: ("A#", "Bb"),
    11: ("B", "Cb"),
}
CREATED_SECONDS = 1760000000


@dataclass(frozen=True)
class DeckSpec:
    deck_name: str
    description: str
    answer_mode: AnswerMode
    lowest_midi: int
    highest_midi: int
    duration_seconds: float
    sample_rate: int
    waveform: str


@dataclass(frozen=True)
class Pitch:
    midi: int
    pitch_class: int
    octave: int
    frequency: float

    @property
    def canonical_name(self) -> str:
        return f"{SHARP_NAMES[self.pitch_class]}{self.octave}"

    @property
    def file_stem(self) -> str:
        return self.canonical_name.replace("#", "sharp")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    return parser.parse_args()


def load_spec(path: Path) -> DeckSpec:
    raw = json.loads(path.read_text())
    return DeckSpec(
        deck_name=raw["deckName"],
        description=raw["description"],
        answer_mode=raw["answerMode"],
        lowest_midi=int(raw["lowestMidi"]),
        highest_midi=int(raw["highestMidi"]),
        duration_seconds=float(raw["durationSeconds"]),
        sample_rate=int(raw["sampleRate"]),
        waveform=raw["waveform"],
    )


def midi_to_pitch(midi: int) -> Pitch:
    return Pitch(
        midi=midi,
        pitch_class=midi % 12,
        octave=(midi // 12) - 1,
        frequency=440.0 * (2 ** ((midi - 69) / 12)),
    )


def answer_for_pitch(pitch: Pitch, mode: AnswerMode) -> str:
    names = ENHARMONIC_NAMES[pitch.pitch_class]
    if mode == "pitch-class":
        return " / ".join(names)
    return " / ".join(f"{name}{pitch.octave}" for name in names)


def sine_sample(pitch: Pitch, time_seconds: float) -> float:
    return math.sin(2 * math.pi * pitch.frequency * time_seconds)


def piano_sample(pitch: Pitch, time_seconds: float, sample_rate: int) -> float:
    nyquist = sample_rate / 2
    partials = (
        (1, 1.0),
        (2, 0.48),
        (3, 0.26),
        (4, 0.16),
        (5, 0.1),
        (6, 0.07),
        (8, 0.04),
        (10, 0.025),
    )
    sample = 0.0
    weight_total = 0.0

    for harmonic, weight in partials:
        stretched_frequency = pitch.frequency * harmonic * (1 + 0.00028 * harmonic * harmonic)
        if stretched_frequency >= nyquist:
            continue
        sample += weight * math.sin(2 * math.pi * stretched_frequency * time_seconds)
        weight_total += weight

    if weight_total == 0:
        sample = sine_sample(pitch, time_seconds)
    else:
        sample /= weight_total

    hammer = (
        math.sin(2 * math.pi * 1729 * time_seconds)
        * math.sin(2 * math.pi * 2381 * time_seconds)
        * math.exp(-95 * time_seconds)
    )
    return sample + (0.035 * hammer)


def sample_for_waveform(pitch: Pitch, spec: DeckSpec, time_seconds: float) -> float:
    if spec.waveform == "sine":
        return sine_sample(pitch, time_seconds)
    if spec.waveform == "piano":
        return piano_sample(pitch, time_seconds, spec.sample_rate)
    raise ValueError(f"unsupported waveform: {spec.waveform}")


def write_wav(path: Path, pitch: Pitch, spec: DeckSpec) -> None:
    total_samples = int(spec.duration_seconds * spec.sample_rate)
    attack_seconds = 0.015 if spec.waveform == "sine" else 0.006
    release_samples = max(1, int(0.09 * spec.sample_rate))
    amplitude = 0.28

    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(spec.sample_rate)

        for i in range(total_samples):
            time_seconds = i / spec.sample_rate
            attack = min(1.0, time_seconds / attack_seconds)
            release = min(1.0, (total_samples - i) / release_samples)
            if spec.waveform == "piano":
                decay = (0.82 * math.exp(-2.6 * time_seconds)) + (
                    0.18 * math.exp(-0.75 * time_seconds)
                )
                envelope = min(attack, release) * decay
                amplitude = 0.56
            else:
                envelope = min(attack, release)
            sample = sample_for_waveform(pitch, spec, time_seconds)
            wav.writeframesraw(struct.pack("<h", int(sample * envelope * amplitude * 32767)))


def anki_id(base: int, index: int) -> int:
    return base + index


def guid(index: int) -> str:
    alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    rng = random.Random(index)
    return "".join(rng.choice(alphabet) for _ in range(10))


def create_collection(path: Path, spec: DeckSpec, media_names: list[str]) -> None:
    created_seconds = CREATED_SECONDS
    created_ms = created_seconds * 1000
    deck_id = 1760000000001
    model_id = 1760000000002
    connection = sqlite3.connect(path)
    try:
        connection.executescript(
            """
            create table col (
                id integer primary key,
                crt integer not null,
                mod integer not null,
                scm integer not null,
                ver integer not null,
                dty integer not null,
                usn integer not null,
                ls integer not null,
                conf text not null,
                models text not null,
                decks text not null,
                dconf text not null,
                tags text not null
            );
            create table notes (
                id integer primary key,
                guid text not null,
                mid integer not null,
                mod integer not null,
                usn integer not null,
                tags text not null,
                flds text not null,
                sfld integer not null,
                csum integer not null,
                flags integer not null,
                data text not null
            );
            create table cards (
                id integer primary key,
                nid integer not null,
                did integer not null,
                ord integer not null,
                mod integer not null,
                usn integer not null,
                type integer not null,
                queue integer not null,
                due integer not null,
                ivl integer not null,
                factor integer not null,
                reps integer not null,
                lapses integer not null,
                left integer not null,
                odue integer not null,
                odid integer not null,
                flags integer not null,
                data text not null
            );
            create table revlog (
                id integer primary key,
                cid integer not null,
                usn integer not null,
                ease integer not null,
                ivl integer not null,
                lastIvl integer not null,
                factor integer not null,
                time integer not null,
                type integer not null
            );
            create index ix_notes_usn on notes (usn);
            create index ix_cards_usn on cards (usn);
            create index ix_revlog_usn on revlog (usn);
            """
        )

        model = {
            str(model_id): {
                "id": model_id,
                "name": "Pitch Audio",
                "type": 0,
                "mod": created_seconds,
                "usn": -1,
                "sortf": 1,
                "did": deck_id,
                "tmpls": [
                    {
                        "name": "Recognition",
                        "ord": 0,
                        "qfmt": "<div class=prompt>{{Audio}}</div>",
                        "afmt": "{{FrontSide}}<hr id=answer><div class=answer>{{Answer}}</div>",
                    }
                ],
                "flds": [
                    {"name": "Audio", "ord": 0, "sticky": False, "rtl": False},
                    {"name": "Answer", "ord": 1, "sticky": False, "rtl": False},
                    {"name": "Midi", "ord": 2, "sticky": False, "rtl": False},
                ],
                "css": ".card{font-family:-apple-system,system-ui,sans-serif;font-size:28px;text-align:center;color:#172026;background:#f8fafc}.answer{font-weight:700}",
                "latexPre": "",
                "latexPost": "",
                "req": [[0, "all", [0, 1]]],
            }
        }
        decks = {
            str(deck_id): {
                "id": deck_id,
                "name": spec.deck_name,
                "desc": spec.description,
                "mod": created_seconds,
                "usn": -1,
                "dyn": 0,
                "conf": 1,
                "extendNew": 0,
                "extendRev": 0,
            }
        }
        dconf = {
            "1": {
                "id": 1,
                "name": "Default",
                "replayq": True,
                "new": {"perDay": 20, "delays": [1.0, 10.0], "ints": [1, 4, 7]},
                "rev": {"perDay": 200, "ease4": 1.3, "maxIvl": 36500},
                "lapse": {"delays": [10.0], "mult": 0.0, "minInt": 1},
            }
        }
        conf = {
            "nextPos": 1,
            "estTimes": True,
            "activeDecks": [deck_id],
            "curDeck": deck_id,
            "newSpread": 0,
        }
        connection.execute(
            "insert into col values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                1,
                created_seconds // 86400,
                created_seconds,
                created_ms,
                11,
                0,
                -1,
                0,
                json.dumps(conf),
                json.dumps(model),
                json.dumps(decks),
                json.dumps(dconf),
                json.dumps({}),
            ),
        )

        for index, media_name in enumerate(media_names):
            pitch = midi_to_pitch(spec.lowest_midi + index)
            note_id = anki_id(created_ms, index + 1)
            card_id = anki_id(created_ms, index + 10_001)
            answer = answer_for_pitch(pitch, spec.answer_mode)
            fields = "\x1f".join((f"[sound:{media_name}]", answer, str(pitch.midi)))
            connection.execute(
                "insert into notes values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    note_id,
                    guid(note_id),
                    model_id,
                    created_seconds,
                    -1,
                    "",
                    fields,
                    pitch.midi,
                    pitch.midi,
                    0,
                    "",
                ),
            )
            connection.execute(
                "insert into cards values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    card_id,
                    note_id,
                    deck_id,
                    0,
                    created_seconds,
                    -1,
                    0,
                    0,
                    index + 1,
                    0,
                    2500,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    "",
                ),
            )

        connection.commit()
    finally:
        connection.close()


def build_deck(spec: DeckSpec, output: Path) -> None:
    with tempfile.TemporaryDirectory() as temp_name:
        temp = Path(temp_name)
        media_names: list[str] = []
        media_map: dict[str, str] = {}

        for index, midi in enumerate(range(spec.lowest_midi, spec.highest_midi + 1)):
            pitch = midi_to_pitch(midi)
            media_name = f"pitch_{pitch.file_stem}_midi_{pitch.midi}.wav"
            write_wav(temp / str(index), pitch, spec)
            media_names.append(media_name)
            media_map[str(index)] = media_name

        collection = temp / "collection.anki2"
        create_collection(collection, spec, media_names)
        (temp / "media").write_text(json.dumps(media_map, sort_keys=True))

        output.parent.mkdir(parents=True, exist_ok=True)
        tmp_output = output.with_suffix(output.suffix + ".tmp")
        with zipfile.ZipFile(tmp_output, "w", compression=zipfile.ZIP_STORED) as archive:
            archive.write(collection, "collection.anki2")
            archive.write(temp / "media", "media")
            for index in range(len(media_names)):
                archive.write(temp / str(index), str(index))
        shutil.move(tmp_output, output)


def main() -> None:
    args = parse_args()
    spec = load_spec(args.spec)
    if spec.waveform not in {"sine", "piano"}:
        raise ValueError(f"unsupported waveform: {spec.waveform}")
    if spec.lowest_midi > spec.highest_midi:
        raise ValueError("lowestMidi must be <= highestMidi")
    build_deck(spec, args.out)


if __name__ == "__main__":
    main()
