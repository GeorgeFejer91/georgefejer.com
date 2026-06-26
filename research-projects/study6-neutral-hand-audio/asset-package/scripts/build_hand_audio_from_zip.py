from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import wave
import zipfile
from dataclasses import dataclass
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
REPO_DIR = PROJECT_DIR.parent
DEFAULT_ZIP = Path.home() / "Downloads" / "hand_audio.zip"
DEFAULT_API_KEY_FILE = Path.home() / "Downloads" / "elevenlabs_access_codex.txt"
LIBRARY_DIR = PROJECT_DIR
SOURCE_DIR = LIBRARY_DIR / "source_transcripts_from_zip"
FINAL_AUDIO_DIR = LIBRARY_DIR / "audio"
PROMPT_RAW_DIR = LIBRARY_DIR / "prompt_audio_raw"
PROMPT_WAV_DIR = LIBRARY_DIR / "prompt_audio_wav"
REPORT_DIR = LIBRARY_DIR / "validation_reports"
LEGACY_OUTPUTS = [
    LIBRARY_DIR / "audio_raw",
    LIBRARY_DIR / "audio_segments",
    LIBRARY_DIR / "continuous_tts_scripts",
    LIBRARY_DIR / "render_report.csv",
]

VOICE_ID = "IVxgxz5EgbHtWNcgBjOV"
MODEL_ID = "eleven_v3"
OUTPUT_FORMAT = "mp3_44100_128"
SAMPLE_RATE = 44_100
SAMPLE_WIDTH = 2
CHANNELS = 1
TARGET_DURATION_S = 300.0
SAFETY_GAP_S = 0.05

LANGUAGE_CODES = {
    "EN": "en",
    "DE": "de",
}


@dataclass
class Prompt:
    version: str
    language: str
    source_file: str
    index: int
    start_s: float
    end_s: float
    slot_s: float
    cluster_id: str
    cluster_label: str
    text: str
    cue_role: str = ""
    rendered_duration_s: float = 0.0
    adjusted_duration_s: float = 0.0
    tempo_factor: float = 1.0
    slack_s: float = 0.0
    raw_file: str = ""
    wav_file: str = ""


@dataclass
class Cluster:
    version: str
    language: str
    source_file: str
    cluster_id: str
    cluster_label: str
    start_s: float
    end_s: float
    duration_s: float


def seconds_to_stamp(seconds: float) -> str:
    rounded = int(round(seconds))
    minutes, secs = divmod(rounded, 60)
    return f"{minutes}:{secs:02d}"


def seconds_to_mmss(seconds: float) -> str:
    rounded = int(round(seconds))
    minutes, secs = divmod(rounded, 60)
    return f"{minutes:02d}:{secs:02d}"


def stamp_to_seconds(minutes: str, seconds: str) -> float:
    return float(int(minutes) * 60 + int(seconds))


def read_api_key(api_key_file: Path) -> str:
    api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if api_key:
        return api_key
    if api_key_file.exists():
        return api_key_file.read_text(encoding="utf-8").strip()
    return ""


def reset_source_dir(zip_path: Path) -> None:
    if SOURCE_DIR.exists():
        shutil.rmtree(SOURCE_DIR)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as archive:
        archive.extractall(SOURCE_DIR)


def clean_line(line: str) -> str:
    return " ".join(line.strip().split())


def rewrite_vr_perspective_prompt(prompt: Prompt) -> None:
    text_lower = prompt.text.lower()

    if prompt.language == "EN":
        if prompt.cluster_id == "SETUP":
            prompt.text = (
                "This task runs for about five minutes. Hold both hands where you can see them, "
                "near the center of your view, palms facing down. Keep them still here until "
                "the first movement begins."
            )
        elif prompt.cluster_id == "A" and "move both hands apart" in text_lower:
            prompt.text = (
                "Start apart and together. Palms down. Move out, then back until the hands nearly "
                "touch. Three seconds out, three back. Keep repeating."
            )
        elif prompt.cluster_id == "A" and text_lower.startswith("out until"):
            prompt.text = (
                "Continue the same movement: out to a comfortable distance... and back in until "
                "they nearly touch."
            )
        elif prompt.cluster_id == "A" and "keep the same slow" in text_lower:
            prompt.text = "Keep the same slow, even pace. Let the hands move continuously out and back."
        elif prompt.cluster_id == "B" and "turn the palms to face up" in text_lower:
            prompt.text = (
                "Now begin the palm rotation. With both hands at the center, turn the palms to "
                "face up. Hold a moment, then turn the palms back down. Up... and down, at a steady pace."
            )
        elif prompt.cluster_id == "B" and text_lower.startswith("palms up"):
            prompt.text = "Continue the same rotation: palms up... hold... and palms down."
        elif prompt.cluster_id == "B" and "keep turning" in text_lower:
            prompt.text = "Keep turning slowly, up and down, at the same steady pace."
        elif prompt.cluster_id == "D" and "open them until" in text_lower:
            prompt.text = (
                "Now begin opening and closing both hands. Open them until the fingers are spread "
                "wide, then close them into a loose fist. About two seconds each way. Repeat this "
                "open-and-close movement."
            )
        elif prompt.cluster_id == "D" and text_lower.startswith("open your fingers"):
            prompt.text = "Continue the same movement: open your fingers wide... and close into a loose fist."
        elif prompt.cluster_id == "D" and "keep opening" in text_lower:
            prompt.text = "Keep opening and closing at the same slow rate."
        elif prompt.cluster_id == "C" and "right hand out to the right" in text_lower:
            prompt.text = (
                "Now switch sides. Keep your left hand at the center, and move your right hand "
                "to the right side of the space in front of you, then back to the center. To the "
                "right... and back. Repeat this right-side movement."
            )
        elif prompt.cluster_id == "C" and "left hand" in text_lower and "arm is almost straight" in text_lower:
            prompt.text = (
                "Now keep your right hand at the center. With your left hand, move to the left "
                "side of the space in front of you, then bring it back to the center. To the left... "
                "and back. Repeat this left-side movement."
            )
        elif prompt.cluster_id == "CIRCLE" and prompt.start_s == 260.0:
            prompt.text = (
                "Now draw a circle with both hands together at the center. Make it medium-sized, "
                "turning in one direction. Keep tracing the same circle again and again at a slow, "
                "even pace."
            )
        elif prompt.cluster_id == "CIRCLE" and prompt.start_s == 280.0:
            prompt.text = (
                "Continue the circle at the same size for a few more moments. Then let the circle "
                "grow smaller and smaller, until your hands return to the center and stop, palms "
                "facing down."
            )

    elif prompt.language == "DE":
        if prompt.cluster_id == "SETUP":
            prompt.text = (
                "Diese Aufgabe dauert etwa fünf Minuten. Halten Sie beide Hände sichtbar vor sich, "
                "nahe der Mitte Ihres Blickfelds, die Handflächen nach unten. Halten Sie sie hier "
                "still, bis die erste Bewegung beginnt."
            )
        elif prompt.cluster_id == "A" and "führen sie beide hände langsam" in text_lower:
            prompt.text = (
                "Auseinander und zusammen. Hände nach außen, dann zurück bis fast zusammen. "
                "Drei Sekunden raus, drei zurück. Wiederholen."
            )
        elif prompt.cluster_id == "A" and text_lower.startswith("nach außen"):
            prompt.text = (
                "Weiter mit derselben Bewegung: nach außen bis zu einem gut sichtbaren Abstand ... "
                "und zurück zur Mitte, bis sie sich fast berühren."
            )
        elif prompt.cluster_id == "A" and "halten sie weiterhin" in text_lower:
            prompt.text = "Halten Sie weiterhin ein langsames, gleichmäßiges Tempo: nach außen und zurück."
        elif prompt.cluster_id == "B" and "drehen sie die handflächen nach oben" in text_lower:
            prompt.text = (
                "Beginnen Sie mit der Handflächendrehung. Hände in der Mitte. Handflächen nach "
                "oben drehen, kurz halten, dann nach unten. Weiter im gleichmäßigen Tempo."
            )
        elif prompt.cluster_id == "B" and text_lower.startswith("handflächen nach oben"):
            prompt.text = "Weiter mit derselben Drehung: Handflächen nach oben ... halten ... und nach unten."
        elif prompt.cluster_id == "B" and "drehen sie sie weiter" in text_lower:
            prompt.text = "Drehen Sie sie weiter langsam nach oben und nach unten, im gleichen Tempo."
        elif prompt.cluster_id == "D" and "öffnen sie sie" in text_lower:
            prompt.text = (
                "Beginnen Sie mit Öffnen und Schließen. Finger weit öffnen, dann locker schließen. "
                "Etwa zwei Sekunden je Richtung. Wiederholen Sie diese Bewegung."
            )
        elif prompt.cluster_id == "D" and "die finger weit öffnen" in text_lower:
            prompt.text = "Weiter mit derselben Bewegung: Finger weit öffnen ... und zu einer lockeren Faust schließen."
        elif prompt.cluster_id == "D" and "öffnen und schließen" in text_lower:
            prompt.text = "Öffnen und schließen Sie weiter, im gleichen langsamen Tempo."
        elif prompt.cluster_id == "C" and "rechte hand nach rechts" in text_lower:
            prompt.text = (
                "Wechseln Sie nun die Seite. Die linke Hand bleibt in der Mitte. Führen Sie die "
                "rechte Hand nach rechts in den sichtbaren Raum vor Ihnen und dann zurück zur "
                "Mitte. Nach rechts ... und zurück. Wiederholen Sie diese Bewegung nach rechts."
            )
        elif prompt.cluster_id == "C" and "linke hand" in text_lower and "arm fast gestreckt" in text_lower:
            prompt.text = (
                "Die rechte Hand bleibt in der Mitte. Führen Sie die linke Hand nach links in "
                "den sichtbaren Raum vor Ihnen und dann zurück zur Mitte. Nach links ... und "
                "zurück. Wiederholen Sie diese Bewegung nach links."
            )
        elif prompt.cluster_id == "CIRCLE" and prompt.start_s == 260.0:
            prompt.text = (
                "Zeichnen Sie nun mit beiden Händen zusammen einen Kreis in die Luft. Der Kreis "
                "ist mittelgroß und dreht in eine Richtung. Zeichnen Sie denselben Kreis immer "
                "wieder, in langsamem, gleichmäßigem Tempo."
            )
        elif prompt.cluster_id == "CIRCLE" and prompt.start_s == 280.0:
            prompt.text = (
                "Führen Sie den Kreis noch einige Momente in derselben Größe weiter. Dann lassen "
                "Sie ihn kleiner werden, bis beide Hände in der Mitte stillstehen, Handflächen "
                "nach unten."
            )


def shorten_short_slot_prompt(prompt: Prompt) -> None:
    text_lower = prompt.text.lower()

    if prompt.slot_s <= 5.001:
        if prompt.language == "EN":
            if "bring both hands together at the center" in text_lower:
                prompt.text = "Hands together at center, palms down."
            elif "rest both hands" in text_lower or "bring both hands to rest" in text_lower:
                prompt.text = "Return to center, hands visible, palms down."
        elif prompt.language == "DE":
            if "beide hände in der mitte zusammen" in text_lower or "führen sie nun beide hände in der mitte zusammen" in text_lower:
                prompt.text = "Hände zusammen, Mitte, Handflächen nach unten."
            elif "lassen sie nun beide hände" in text_lower or "führen sie nun beide hände zurück" in text_lower:
                prompt.text = "Mitte, sichtbar, Handflächen nach unten."


SCAFFOLDED_PROMPTS: dict[str, dict[str, list[tuple[str, str]]]] = {
    "EN": {
        "SETUP": [
            (
                "setup",
                "This task runs for about five minutes. Hold both hands where you can see them, "
                "near the center of your view, palms facing down. Keep them still. When the next "
                "cue begins, start the first movement.",
            )
        ],
        "A": [
            (
                "start",
                "Start apart and together. Palms down. Move out, then back until the hands "
                "nearly touch. Three seconds out, three back. Keep repeating.",
            ),
            (
                "continue",
                "Continue repeating the same movement. Out to a comfortable distance... back "
                "until the hands nearly touch. Keep the pace slow and even.",
            ),
            (
                "final_repetitions",
                "Last repetitions of this pattern. Complete one or two more out-and-back cycles "
                "at the same pace.",
            ),
            ("stop_transition", "Complete this cycle. Center, stop."),
        ],
        "B": [
            (
                "start",
                "Now begin the palm rotation. With both hands at the center, turn the palms to "
                "face up. Hold a moment, then turn the palms back down. Up... and down, at a "
                "steady pace.",
            ),
            (
                "continue",
                "Continue the same rotation. Palms up... hold... palms down. Keep both hands "
                "centered and repeat steadily.",
            ),
            (
                "final_repetitions",
                "Last repetitions of palm rotation. Complete one or two more up-and-down cycles "
                "at the same pace.",
            ),
            ("stop_transition", "Complete this cycle. Center, stop."),
        ],
        "D": [
            (
                "start",
                "Begin now with opening and closing. Open both hands until the fingers are "
                "spread wide, then close into a loose fist. About two seconds each way. Start "
                "now, and keep repeating.",
            ),
            (
                "continue",
                "Continue the same opening and closing. Fingers open wide... then close loosely. "
                "Keep the motion slow and even.",
            ),
            (
                "final_repetitions",
                "Last repetitions of opening and closing. Complete one or two more "
                "open-and-close cycles at the same pace.",
            ),
            ("stop_transition", "Complete this cycle. Center, stop."),
        ],
        "C": [
            (
                "start_left",
                "Begin now with the left-side reach. Keep your right hand at the center. Move "
                "your left hand to the left side of the visible space in front of you, then "
                "bring it back to center. Start the first reach now. To the left... and back. "
                "Keep repeating this left-side movement.",
            ),
            (
                "switch_right",
                "Switch sides now. Keep your left hand at the center. Move your right hand to "
                "the right side of the visible space in front of you, then bring it back to "
                "center. Start the first right-side reach now. To the right... and back. Keep "
                "repeating.",
            ),
            ("stop_transition", "Both hands center, palms down."),
        ],
        "CIRCLE": [
            (
                "start_circle",
                "Begin now with both hands together at the center. Draw a medium-sized circle "
                "in the air, turning in one direction. Start the first circle now, and keep "
                "tracing the same circle slowly.",
            ),
            (
                "shrink_stop",
                "Continue the circle for a few more moments. Then make each circle smaller "
                "than the last. Bring both hands back to the center, palms down, and stop when "
                "the task ends.",
            ),
        ],
        "END": [("terminal_marker", "Audio ends. No spoken prompt.")],
    },
    "DE": {
        "SETUP": [
            (
                "setup",
                "Diese Aufgabe dauert etwa fünf Minuten. Halten Sie beide Hände sichtbar vor "
                "sich, nahe der Mitte Ihres Blickfelds, die Handflächen nach unten. Halten Sie "
                "sie still. Wenn der nächste Hinweis beginnt, starten Sie die erste Bewegung.",
            )
        ],
        "A": [
            (
                "start",
                "Auseinander und zusammen. Hände nach außen, dann zurück bis fast zusammen. "
                "Drei Sekunden raus, drei zurück. Wiederholen.",
            ),
            (
                "continue",
                "Wiederholen Sie dieselbe Bewegung weiter. Nach außen bis zu einem gut "
                "sichtbaren Abstand ... zurück, bis die Hände sich fast berühren. Langsam und "
                "gleichmäßig.",
            ),
            (
                "final_repetitions",
                "Letzte Wiederholungen dieses Musters. Machen Sie noch ein oder zwei Zyklen "
                "nach außen und zurück, im gleichen Tempo.",
            ),
            ("stop_transition", "Mitte, sichtbar, Handflächen nach unten."),
        ],
        "B": [
            (
                "start",
                "Beginnen Sie mit der Handflächendrehung. Hände in der Mitte. Handflächen nach "
                "oben drehen, kurz halten, dann nach unten. Weiter im gleichmäßigen Tempo.",
            ),
            (
                "continue",
                "Wiederholen Sie dieselbe Drehung weiter. Handflächen nach oben ... halten ... "
                "nach unten. Beide Hände bleiben in der Mitte.",
            ),
            (
                "final_repetitions",
                "Letzte Wiederholungen der Handflächendrehung. Machen Sie noch ein oder zwei "
                "Zyklen nach oben und nach unten, im gleichen Tempo.",
            ),
            ("stop_transition", "Mitte, sichtbar, Handflächen nach unten."),
        ],
        "D": [
            (
                "start",
                "Beginnen Sie jetzt mit Öffnen und Schließen. Öffnen Sie beide Hände, bis die "
                "Finger weit gespreizt sind, dann locker schließen. Etwa zwei Sekunden je "
                "Richtung. Starten Sie jetzt und wiederholen Sie weiter.",
            ),
            (
                "continue",
                "Wiederholen Sie dieselbe Öffnen-und-Schließen-Bewegung weiter. Finger weit "
                "öffnen ... dann locker schließen. Langsam und gleichmäßig.",
            ),
            (
                "final_repetitions",
                "Letzte Wiederholungen von Öffnen und Schließen. Machen Sie noch ein oder "
                "zwei Zyklen, im gleichen Tempo.",
            ),
            ("stop_transition", "Mitte, sichtbar, Handflächen nach unten."),
        ],
        "C": [
            (
                "start_left",
                "Beginnen Sie jetzt mit der Bewegung nach links. Die rechte Hand bleibt in der "
                "Mitte. Führen Sie die linke Hand nach links in den sichtbaren Raum vor Ihnen "
                "und dann zurück zur Mitte. Starten Sie die erste Wiederholung jetzt. Nach "
                "links ... und zurück. Wiederholen Sie diese Bewegung nach links.",
            ),
            (
                "switch_right",
                "Wechseln Sie jetzt die Seite. Die linke Hand bleibt in der Mitte. Führen Sie "
                "die rechte Hand nach rechts in den sichtbaren Raum vor Ihnen und dann zurück "
                "zur Mitte. Starten Sie die erste Wiederholung nach rechts jetzt. Nach rechts "
                "... und zurück. Wiederholen Sie weiter.",
            ),
            ("stop_transition", "Hände zusammen, Mitte, Handflächen nach unten."),
        ],
        "CIRCLE": [
            (
                "start_circle",
                "Beginnen Sie jetzt mit beiden Händen zusammen in der Mitte. Zeichnen Sie einen "
                "mittelgroßen Kreis in die Luft, in eine Richtung. Starten Sie den ersten Kreis "
                "jetzt und zeichnen Sie langsam weiter.",
            ),
            (
                "shrink_stop",
                "Führen Sie den Kreis noch einige Momente weiter. Dann wird jeder Kreis kleiner "
                "als der letzte. Bringen Sie beide Hände zurück zur Mitte, Handflächen nach "
                "unten, und stoppen Sie am Ende.",
            ),
        ],
        "END": [("terminal_marker", "Audio endet. Kein gesprochener Hinweis.")],
    },
}


def apply_scaffolded_prompts(prompts: list[Prompt]) -> None:
    by_cluster: dict[str, list[Prompt]] = {}
    for prompt in prompts:
        by_cluster.setdefault(prompt.cluster_id, []).append(prompt)

    for cluster_id, cluster_prompts in by_cluster.items():
        cluster_prompts.sort(key=lambda item: item.start_s)
        language = cluster_prompts[0].language
        templates = SCAFFOLDED_PROMPTS.get(language, {}).get(cluster_id)
        if templates is None:
            continue
        if len(cluster_prompts) != len(templates):
            raise RuntimeError(
                f"{cluster_prompts[0].source_file} {cluster_id} has {len(cluster_prompts)} prompts, "
                f"expected {len(templates)}"
            )
        for prompt, (cue_role, text) in zip(cluster_prompts, templates):
            prompt.cue_role = cue_role
            prompt.text = text


def parse_version_language(path: Path) -> tuple[str, str]:
    name = path.name.lower()
    version_match = re.search(r"version[_\s-]*(\d+)", name)
    if not version_match:
        raise ValueError(f"Cannot parse version from {path.name}")
    version = f"V{int(version_match.group(1)):02d}"
    language = "DE" if name.endswith("_de.txt") or "_de" in name or "handaufgabe" in name else "EN"
    return version, language


def parse_source(path: Path) -> tuple[list[Prompt], list[Cluster]]:
    version, language = parse_version_language(path)
    raw_text = path.read_text(encoding="utf-8-sig")
    lines = raw_text.splitlines()

    current_cluster_id = "SETUP"
    current_cluster_label = "Setup"
    pending_cluster_start: tuple[str, str, float] | None = None
    clusters: list[Cluster] = []
    prompts: list[Prompt] = []
    current_prompt: dict[str, object] | None = None

    def finish_prompt() -> None:
        nonlocal current_prompt
        if current_prompt is None:
            return
        text_parts = current_prompt["parts"]
        text = " ".join(part for part in text_parts if part).strip()
        if not text:
            current_prompt = None
            return
        prompts.append(
            Prompt(
                version=version,
                language=language,
                source_file=path.name,
                index=len(prompts) + 1,
                start_s=float(current_prompt["start_s"]),
                end_s=0.0,
                slot_s=0.0,
                cluster_id=str(current_prompt["cluster_id"]),
                cluster_label=str(current_prompt["cluster_label"]),
                text=text,
            )
        )
        current_prompt = None

    def close_previous_cluster(next_start: float) -> None:
        nonlocal pending_cluster_start
        if pending_cluster_start is None:
            return
        cluster_id, label, start_s = pending_cluster_start
        clusters.append(
            Cluster(
                version=version,
                language=language,
                source_file=path.name,
                cluster_id=cluster_id,
                cluster_label=label,
                start_s=start_s,
                end_s=next_start,
                duration_s=next_start - start_s,
            )
        )
        pending_cluster_start = None

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if re.fullmatch(r"-+", stripped):
            continue

        heading_match = re.match(r"---\s*(.+?)\s*---", stripped)
        if heading_match:
            finish_prompt()
            heading = heading_match.group(1)
            cluster_match = re.match(r"Cluster\s+([A-Z]):\s*(.+)", heading, flags=re.IGNORECASE)
            if cluster_match:
                current_cluster_id = cluster_match.group(1).upper()
                current_cluster_label = clean_line(cluster_match.group(2))
            else:
                current_cluster_id = "CIRCLE"
                current_cluster_label = clean_line(heading)
            continue

        if stripped.startswith("[pause") or stripped.startswith("[Pause"):
            continue

        timestamp_match = re.match(r"^\[(\d+):(\d{2})\]\s*(.*)$", stripped)
        if timestamp_match:
            finish_prompt()
            start_s = stamp_to_seconds(timestamp_match.group(1), timestamp_match.group(2))
            if start_s == TARGET_DURATION_S:
                close_previous_cluster(start_s)
                current_cluster_id = "END"
                current_cluster_label = "End"
            elif current_cluster_id != "SETUP" and pending_cluster_start is None:
                if prompts:
                    close_previous_cluster(start_s)
                else:
                    close_previous_cluster(start_s)
                pending_cluster_start = (current_cluster_id, current_cluster_label, start_s)
            elif current_cluster_id == "SETUP" and pending_cluster_start is None:
                pending_cluster_start = ("SETUP", "Setup", start_s)

            current_prompt = {
                "start_s": start_s,
                "cluster_id": current_cluster_id,
                "cluster_label": current_cluster_label,
                "parts": [clean_line(timestamp_match.group(3))],
            }
            continue

        if current_prompt is not None:
            current_prompt["parts"].append(clean_line(stripped))

    finish_prompt()

    prompts.sort(key=lambda prompt: prompt.start_s)
    for idx, prompt in enumerate(prompts):
        prompt.index = idx + 1
        next_start = prompts[idx + 1].start_s if idx + 1 < len(prompts) else TARGET_DURATION_S
        prompt.end_s = next_start
        prompt.slot_s = max(0.0, next_start - prompt.start_s)
        rewrite_vr_perspective_prompt(prompt)
        shorten_short_slot_prompt(prompt)
    apply_scaffolded_prompts(prompts)

    derived_clusters: list[Cluster] = []
    active_prompt = prompts[0]
    active_id = active_prompt.cluster_id
    active_label = active_prompt.cluster_label
    active_start = active_prompt.start_s
    for prompt in prompts[1:]:
        if prompt.cluster_id != active_id:
            if active_id != "END":
                derived_clusters.append(
                    Cluster(
                        version=version,
                        language=language,
                        source_file=path.name,
                        cluster_id=active_id,
                        cluster_label=active_label,
                        start_s=active_start,
                        end_s=prompt.start_s,
                        duration_s=prompt.start_s - active_start,
                    )
                )
            active_id = prompt.cluster_id
            active_label = prompt.cluster_label
            active_start = prompt.start_s

    if active_id != "END":
        derived_clusters.append(
            Cluster(
                version=version,
                language=language,
                source_file=path.name,
                cluster_id=active_id,
                cluster_label=active_label,
                start_s=active_start,
                end_s=TARGET_DURATION_S,
                duration_s=TARGET_DURATION_S - active_start,
            )
        )

    return prompts, derived_clusters


def request_mp3(api_key: str, text: str, language: str) -> bytes:
    query = urllib.parse.urlencode({"output_format": OUTPUT_FORMAT})
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}?{query}"
    payload = {
        "text": text,
        "model_id": MODEL_ID,
        "language_code": LANGUAGE_CODES[language],
    }
    body = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
        "xi-api-key": api_key,
    }
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            return response.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"ElevenLabs HTTP {exc.code}: {detail}") from exc


def probe_duration(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def atempo_chain(factor: float) -> str:
    factors: list[float] = []
    remaining = factor
    while remaining < 0.5:
        factors.append(0.5)
        remaining /= 0.5
    while remaining > 2.0:
        factors.append(2.0)
        remaining /= 2.0
    factors.append(remaining)
    return ",".join(f"atempo={item:.6f}" for item in factors)


def convert_mp3_to_wav(mp3_path: Path, wav_path: Path, target_duration: float | None = None) -> None:
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    command = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(mp3_path),
    ]
    if target_duration is not None:
        duration = probe_duration(mp3_path)
        factor = duration / target_duration
        command.extend(["-af", atempo_chain(factor)])
    command.extend(["-ac", "1", "-ar", str(SAMPLE_RATE), "-sample_fmt", "s16", str(wav_path)])
    subprocess.run(command, check=True)


def write_wav(path: Path, pcm: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(CHANNELS)
        handle.setsampwidth(SAMPLE_WIDTH)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(pcm)


def read_wav_pcm(path: Path) -> bytes:
    with wave.open(str(path), "rb") as handle:
        if handle.getnchannels() != CHANNELS or handle.getsampwidth() != SAMPLE_WIDTH or handle.getframerate() != SAMPLE_RATE:
            raise RuntimeError(f"Unexpected WAV format: {path}")
        return handle.readframes(handle.getnframes())


def render_prompt(api_key: str, prompt: Prompt) -> None:
    if prompt.slot_s <= 0:
        prompt.rendered_duration_s = 0.0
        prompt.adjusted_duration_s = 0.0
        prompt.tempo_factor = 1.0
        prompt.slack_s = 0.0
        prompt.raw_file = ""
        prompt.wav_file = ""
        return

    text_hash = hashlib.sha1(f"{prompt.language}\n{prompt.text}".encode("utf-8")).hexdigest()[:16]
    raw_path = PROMPT_RAW_DIR / f"{prompt.language}_{text_hash}.mp3"
    wav_path = PROMPT_WAV_DIR / f"{prompt.language}_{text_hash}.wav"
    adjusted_path = PROMPT_WAV_DIR / f"{prompt.language}_{text_hash}_fit.wav"

    PROMPT_RAW_DIR.mkdir(parents=True, exist_ok=True)
    PROMPT_WAV_DIR.mkdir(parents=True, exist_ok=True)

    if not raw_path.exists():
        raw_path.write_bytes(request_mp3(api_key=api_key, text=prompt.text, language=prompt.language))

    prompt.raw_file = raw_path.name
    prompt.rendered_duration_s = probe_duration(raw_path)

    max_duration = max(0.25, prompt.slot_s - SAFETY_GAP_S)
    if prompt.rendered_duration_s > max_duration and prompt.slot_s > 0:
        convert_mp3_to_wav(raw_path, adjusted_path, target_duration=max_duration)
        prompt.wav_file = adjusted_path.name
        prompt.adjusted_duration_s = probe_duration(adjusted_path)
        prompt.tempo_factor = prompt.rendered_duration_s / max_duration
    else:
        convert_mp3_to_wav(raw_path, wav_path)
        prompt.wav_file = wav_path.name
        prompt.adjusted_duration_s = probe_duration(wav_path)
        prompt.tempo_factor = 1.0

    prompt.slack_s = prompt.slot_s - prompt.adjusted_duration_s
    if prompt.slack_s < -0.02:
        raise RuntimeError(
            f"Prompt overran its slot after adjustment: {prompt.source_file} {prompt.index} "
            f"slot={prompt.slot_s:.3f}s adjusted={prompt.adjusted_duration_s:.3f}s"
        )


def assemble_file(version: str, language: str, prompts: list[Prompt]) -> Path:
    total_samples = int(round(TARGET_DURATION_S * SAMPLE_RATE))
    timeline = bytearray(total_samples * SAMPLE_WIDTH)

    for prompt in prompts:
        if prompt.start_s >= TARGET_DURATION_S:
            continue
        wav_path = PROMPT_WAV_DIR / prompt.wav_file
        pcm = read_wav_pcm(wav_path)
        start_byte = int(round(prompt.start_s * SAMPLE_RATE)) * SAMPLE_WIDTH
        end_byte = min(start_byte + len(pcm), len(timeline))
        timeline[start_byte:end_byte] = pcm[: end_byte - start_byte]

    temp_wav = FINAL_AUDIO_DIR / f"study6_neutral_hand_audio_{version}_{language}.wav"
    final_mp3 = FINAL_AUDIO_DIR / f"study6_neutral_hand_audio_{version}_{language}.mp3"
    write_wav(temp_wav, bytes(timeline))
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(temp_wav),
            "-c:a",
            "libmp3lame",
            "-b:a",
            "128k",
            str(final_mp3),
        ],
        check=True,
    )
    temp_wav.unlink(missing_ok=True)
    return final_mp3


def write_reports(all_prompts: list[Prompt], all_clusters: list[Cluster], final_files: list[Path]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    with (REPORT_DIR / "prompt_timing_validation.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        fieldnames = [
            "version",
            "language",
            "source_file",
            "prompt_index",
            "start_s",
            "end_s",
            "slot_s",
            "cluster_id",
            "cluster_label",
            "cue_role",
            "rendered_duration_s",
            "adjusted_duration_s",
            "tempo_factor",
            "slack_s",
            "spoken_text",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for prompt in all_prompts:
            writer.writerow(
                {
                    "version": prompt.version,
                    "language": prompt.language,
                    "source_file": prompt.source_file,
                    "prompt_index": prompt.index,
                    "start_s": f"{prompt.start_s:.3f}",
                    "end_s": f"{prompt.end_s:.3f}",
                    "slot_s": f"{prompt.slot_s:.3f}",
                    "cluster_id": prompt.cluster_id,
                    "cluster_label": prompt.cluster_label,
                    "cue_role": prompt.cue_role,
                    "rendered_duration_s": f"{prompt.rendered_duration_s:.3f}",
                    "adjusted_duration_s": f"{prompt.adjusted_duration_s:.3f}",
                    "tempo_factor": f"{prompt.tempo_factor:.6f}",
                    "slack_s": f"{prompt.slack_s:.3f}",
                    "spoken_text": prompt.text,
                }
            )

    with (REPORT_DIR / "cluster_duration_validation.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        fieldnames = ["version", "language", "source_file", "cluster_id", "cluster_label", "start_s", "end_s", "duration_s"]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for cluster in all_clusters:
            writer.writerow(
                {
                    "version": cluster.version,
                    "language": cluster.language,
                    "source_file": cluster.source_file,
                    "cluster_id": cluster.cluster_id,
                    "cluster_label": cluster.cluster_label,
                    "start_s": f"{cluster.start_s:.3f}",
                    "end_s": f"{cluster.end_s:.3f}",
                    "duration_s": f"{cluster.duration_s:.3f}",
                }
            )

    with (REPORT_DIR / "final_audio_duration_validation.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        fieldnames = ["file", "duration_s", "difference_from_300_ms", "size_bytes"]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for final_file in sorted(final_files, key=lambda path: path.name):
            duration = probe_duration(final_file)
            writer.writerow(
                {
                    "file": final_file.name,
                    "duration_s": f"{duration:.6f}",
                    "difference_from_300_ms": f"{(duration - TARGET_DURATION_S) * 1000:.3f}",
                    "size_bytes": final_file.stat().st_size,
                }
            )


def validate_schedule(all_prompts: list[Prompt], all_clusters: list[Cluster]) -> None:
    by_file: dict[tuple[str, str], list[Prompt]] = {}
    for prompt in all_prompts:
        by_file.setdefault((prompt.version, prompt.language), []).append(prompt)

    for key, prompts in by_file.items():
        starts = [prompt.start_s for prompt in prompts]
        if starts[0] != 0.0 or starts[-1] != TARGET_DURATION_S:
            raise RuntimeError(f"{key} does not start at 0 and end at 300: {starts[0]}->{starts[-1]}")
        if starts != sorted(starts):
            raise RuntimeError(f"{key} timestamps are not monotonic")

    by_cluster_set: dict[tuple[str, str], dict[str, float]] = {}
    for cluster in all_clusters:
        by_cluster_set.setdefault((cluster.version, cluster.language), {})[cluster.cluster_id] = cluster.duration_s

    expected = {"SETUP": 20.0, "A": 60.0, "B": 60.0, "C": 60.0, "D": 60.0, "CIRCLE": 40.0}
    for key, durations in by_cluster_set.items():
        for cluster_id, expected_duration in expected.items():
            actual = durations.get(cluster_id)
            if actual is None:
                raise RuntimeError(f"{key} missing cluster {cluster_id}")
            if abs(actual - expected_duration) > 0.001:
                raise RuntimeError(f"{key} cluster {cluster_id} expected {expected_duration}s got {actual}s")


def write_clean_transcripts(all_prompts: list[Prompt]) -> None:
    clean_dir = LIBRARY_DIR / "clean_timed_transcripts"
    if clean_dir.exists():
        shutil.rmtree(clean_dir)
    clean_dir.mkdir(parents=True, exist_ok=True)

    by_file: dict[tuple[str, str], list[Prompt]] = {}
    for prompt in all_prompts:
        by_file.setdefault((prompt.version, prompt.language), []).append(prompt)

    for (version, language), prompts in by_file.items():
        note = {
            "EN": "Only positive-duration rows are spoken. The audio ends exactly at 5:00 with no terminal prompt.",
            "DE": "Nur Zeilen mit positiver Dauer werden gesprochen. Die Audioaufnahme endet genau bei 5:00 ohne abschließenden gesprochenen Hinweis.",
        }[language]
        endpoint = {
            "EN": "Audio ends at 5:00 exactly. No additional instruction is spoken.",
            "DE": "Die Audioaufnahme endet genau bei 5:00. Es wird kein zusätzlicher Hinweis gesprochen.",
        }[language]
        lines = [
            f"# Study 6 Hand Movement Calibration Task - {version} - {language}",
            "",
            "Non-spoken pause markers from the source ZIP have been removed. Prompt starts are scheduled by timestamp.",
            note,
            "",
            "| Start | End | Slot | Cluster | Cue role | Spoken text |",
            "|---:|---:|---:|---|---|---|",
        ]
        for prompt in sorted(prompts, key=lambda item: item.start_s):
            if prompt.slot_s <= 0:
                continue
            lines.append(
                f"| {seconds_to_stamp(prompt.start_s)} | {seconds_to_stamp(prompt.end_s)} | "
                f"{prompt.slot_s:.0f} s | {prompt.cluster_id} | {prompt.cue_role} | {prompt.text} |"
            )
        lines.append("")
        lines.append(endpoint)
        lines.append("")
        (clean_dir / f"study6_hand_audio_{version}_{language}_clean.md").write_text(
            "\n".join(lines),
            encoding="utf-8-sig",
        )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def remove_legacy_outputs() -> None:
    for path in LEGACY_OUTPUTS:
        if path.is_dir():
            shutil.rmtree(path)
        elif path.exists():
            path.unlink()


def write_timing_library(all_prompts: list[Prompt]) -> None:
    with (LIBRARY_DIR / "timing_library.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        fieldnames = [
            "version",
            "language",
            "prompt_index",
            "start_s",
            "end_s",
            "start_mmss",
            "end_mmss",
            "duration_s",
            "cluster_id",
            "cluster_label",
            "cue_role",
            "is_spoken",
            "spoken_text",
            "note",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for prompt in sorted(all_prompts, key=lambda item: (item.version, item.language, item.start_s)):
            is_spoken = prompt.slot_s > 0
            writer.writerow(
                {
                    "version": prompt.version,
                    "language": prompt.language,
                    "prompt_index": prompt.index,
                    "start_s": f"{prompt.start_s:.3f}",
                    "end_s": f"{prompt.end_s:.3f}",
                    "start_mmss": seconds_to_mmss(prompt.start_s),
                    "end_mmss": seconds_to_mmss(prompt.end_s),
                    "duration_s": f"{prompt.slot_s:.3f}",
                    "cluster_id": prompt.cluster_id,
                    "cluster_label": prompt.cluster_label,
                    "cue_role": prompt.cue_role,
                    "is_spoken": "true" if is_spoken else "false",
                    "spoken_text": prompt.text if is_spoken else "",
                    "note": "" if is_spoken else prompt.text,
                }
            )


def write_action_blocks(all_prompts: list[Prompt], all_clusters: list[Cluster]) -> None:
    cluster_lookup = {
        (cluster.version, cluster.language, cluster.cluster_id): cluster
        for cluster in all_clusters
    }
    seen: set[tuple[str, str, str]] = set()
    rows: list[dict[str, str]] = []

    for prompt in sorted(all_prompts, key=lambda item: (item.language, item.cluster_id, item.start_s)):
        if prompt.slot_s <= 0:
            continue
        key = (prompt.language, prompt.cluster_id, prompt.cue_role)
        if key in seen:
            continue
        seen.add(key)
        cluster = cluster_lookup[(prompt.version, prompt.language, prompt.cluster_id)]
        rows.append(
            {
                "language": prompt.language,
                "cluster_id": prompt.cluster_id,
                "cluster_label": prompt.cluster_label,
                "cue_role": prompt.cue_role,
                "relative_start_s": f"{prompt.start_s - cluster.start_s:.3f}",
                "relative_end_s": f"{prompt.end_s - cluster.start_s:.3f}",
                "slot_s": f"{prompt.slot_s:.3f}",
                "spoken_text": prompt.text,
            }
        )

    with (LIBRARY_DIR / "action_blocks.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        fieldnames = [
            "language",
            "cluster_id",
            "cluster_label",
            "cue_role",
            "relative_start_s",
            "relative_end_s",
            "slot_s",
            "spoken_text",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_public_transcripts(all_prompts: list[Prompt], all_clusters: list[Cluster]) -> None:
    transcript_dir = LIBRARY_DIR / "transcripts"
    if transcript_dir.exists():
        shutil.rmtree(transcript_dir)
    transcript_dir.mkdir(parents=True, exist_ok=True)

    cluster_lookup: dict[tuple[str, str], list[Cluster]] = {}
    for cluster in all_clusters:
        cluster_lookup.setdefault((cluster.version, cluster.language), []).append(cluster)

    by_file: dict[tuple[str, str], list[Prompt]] = {}
    for prompt in all_prompts:
        by_file.setdefault((prompt.version, prompt.language), []).append(prompt)

    language_names = {"EN": "English", "DE": "German"}
    for (version, language), prompts in sorted(by_file.items()):
        clusters = sorted(cluster_lookup[(version, language)], key=lambda item: item.start_s)
        order = " -> ".join(cluster.cluster_id for cluster in clusters if cluster.cluster_id not in {"SETUP", "CIRCLE"})
        labels = {
            "EN": {
                "task": "Task: Neutral hand movement calibration task",
                "target": "Target duration: 05:00 exactly",
                "order": f"Movement cluster order: {order}",
                "timing": "Timing rule: each row starts at the listed timestamp. If the prompt finishes early, the participant continues the cued action until the next timestamp.",
                "endpoint": "Endpoint rule: the audio ends at 05:00 exactly; no terminal instruction is spoken after the final row.",
                "final": "Audio ends at 05:00 exactly.",
            },
            "DE": {
                "task": "Aufgabe: Neutrale Handbewegungs-Kalibrierungsaufgabe",
                "target": "Zieldauer: genau 05:00",
                "order": f"Reihenfolge der Bewegungscluster: {order}",
                "timing": "Zeitregel: Jede Zeile beginnt am angegebenen Zeitpunkt. Wenn der Hinweis früher endet, führt die Person die angegebene Bewegung bis zum nächsten Zeitpunkt weiter.",
                "endpoint": "Endregel: Die Audioaufnahme endet genau bei 05:00; nach der letzten Zeile wird kein abschließender Hinweis gesprochen.",
                "final": "Die Audioaufnahme endet genau bei 05:00.",
            },
        }[language]
        lines = [
            f"# Study 6 Neutral Hand Audio Guide - {version} - {language_names.get(language, language)}",
            "",
            labels["task"],
            labels["target"],
            labels["order"],
            labels["timing"],
            labels["endpoint"],
            "",
            "| Start | End | Duration | Cluster | Cue role | Spoken wording |",
            "|---:|---:|---:|---|---|---|",
        ]
        for prompt in sorted(prompts, key=lambda item: item.start_s):
            if prompt.slot_s <= 0:
                continue
            lines.append(
                f"| {seconds_to_mmss(prompt.start_s)} | {seconds_to_mmss(prompt.end_s)} | "
                f"{prompt.slot_s:.0f} s | {prompt.cluster_id} - {prompt.cluster_label} | "
                f"{prompt.cue_role} | {prompt.text} |"
            )
        lines.append("")
        lines.append(labels["final"])
        lines.append("")
        (transcript_dir / f"study6_neutral_hand_audio_{version}_{language}.md").write_text(
            "\n".join(lines),
            encoding="utf-8-sig",
        )


def write_render_manifest(all_prompts: list[Prompt], final_files: list[Path]) -> None:
    final_by_name = {path.name: path for path in final_files}
    file_entries = []
    for version in sorted({prompt.version for prompt in all_prompts}):
        for language in sorted({prompt.language for prompt in all_prompts}):
            file_name = f"study6_neutral_hand_audio_{version}_{language}.mp3"
            path = final_by_name.get(file_name, FINAL_AUDIO_DIR / file_name)
            entry = {
                "version": version,
                "language": language,
                "file": file_name,
                "relative_path": str(path.relative_to(LIBRARY_DIR)).replace("\\", "/") if path.exists() else "",
            }
            if path.exists():
                entry.update(
                    {
                        "duration_s": round(probe_duration(path), 6),
                        "size_bytes": path.stat().st_size,
                        "sha256": sha256_file(path),
                    }
                )
            file_entries.append(entry)

    manifest = {
        "task": "Study 6 neutral hand movement calibration audio",
        "voice_id": VOICE_ID,
        "model_id": MODEL_ID,
        "output_format": OUTPUT_FORMAT,
        "target_duration_s": TARGET_DURATION_S,
        "sample_rate_hz": SAMPLE_RATE,
        "languages": LANGUAGE_CODES,
        "files": file_entries,
        "prompts": [
            {
                "version": prompt.version,
                "language": prompt.language,
                "source_file": prompt.source_file,
                "prompt_index": prompt.index,
                "start_s": prompt.start_s,
                "end_s": prompt.end_s,
                "slot_s": prompt.slot_s,
                "cluster_id": prompt.cluster_id,
                "cluster_label": prompt.cluster_label,
                "cue_role": prompt.cue_role,
                "is_spoken": prompt.slot_s > 0,
                "rendered_duration_s": round(prompt.rendered_duration_s, 6),
                "adjusted_duration_s": round(prompt.adjusted_duration_s, 6),
                "tempo_factor": round(prompt.tempo_factor, 6),
                "slack_s": round(prompt.slack_s, 6),
                "raw_file": prompt.raw_file,
                "wav_file": prompt.wav_file,
                "text": prompt.text if prompt.slot_s > 0 else "",
                "note": "" if prompt.slot_s > 0 else prompt.text,
            }
            for prompt in sorted(all_prompts, key=lambda item: (item.version, item.language, item.start_s))
        ],
    }
    (LIBRARY_DIR / "elevenlabs_render_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def write_readme(all_clusters: list[Cluster]) -> None:
    orders: dict[str, list[str]] = {}
    for version in sorted({cluster.version for cluster in all_clusters}):
        version_clusters = [
            cluster
            for cluster in all_clusters
            if cluster.version == version and cluster.language == "EN" and cluster.cluster_id not in {"SETUP", "CIRCLE"}
        ]
        orders[version] = [cluster.cluster_id for cluster in sorted(version_clusters, key=lambda item: item.start_s)]

    order_lines = [
        "| Version | Core action order from 00:20 to 04:20 |",
        "|---|---|",
    ]
    for version, order in orders.items():
        order_lines.append(f"| {version} | {' -> '.join(order)} |")

    readme = f"""# Study 6 Neutral Hand Audio Guide Library

This library defines eight five-minute neutral hand-movement audio guides: four English versions and four German versions. The versions use the same action set and the same cue timing, but the four core movement clusters appear in different orders.

## Timing Standard

- Total target duration: 300 seconds.
- Setup: 00:00-00:20.
- Four core movement clusters: 00:20-04:20, 60 seconds each.
- Circle close: 04:20-05:00.
- Every version contains the same cluster durations: SETUP 20 s, A 60 s, B 60 s, C 60 s, D 60 s, CIRCLE 40 s.
- Within each language, cue wording is identical whenever the same cue role and cluster recur.
- The prompt text tells participants when to begin, continue, complete final repetitions, and stop or transition. Any remaining silence inside a slot is intentional continuation time for the currently cued movement.

## Version Orders

{chr(10).join(order_lines)}

## Files

- `audio/`: final 05:00 MP3 files rendered with the ElevenLabs calm voice.
- `transcripts/`: participant-facing timed transcripts derived from the exact render schedule.
- `clean_timed_transcripts/`: ZIP-derived cleaned transcripts with cue roles and no non-spoken pause markers.
- `timing_library.csv`: exact prompt timing, cue role, spoken text, and terminal marker status for every Version x Language file.
- `action_blocks.csv`: standardized cue wording by language, cluster, cue role, and within-cluster timing.
- `validation_reports/`: prompt duration, cluster duration, and final MP3 duration checks.
- `elevenlabs_render_manifest.json`: render metadata, file hashes, prompt text, rendered durations, and tempo-fit values.
- `source_transcripts_from_zip/`: the source scripts extracted from `hand_audio.zip`.

## Rendering

Use `scripts/build_hand_audio_from_zip.py`. The script reads `~/Downloads/hand_audio.zip`, assigns the standardized scaffolded cue wording, renders prompt audio with ElevenLabs voice `{VOICE_ID}`, assembles exact 300-second MP3 files, and writes the validation reports.

The API key should be provided only through `ELEVENLABS_API_KEY` or the temporary file `~/Downloads/elevenlabs_access_codex.txt`. Do not commit API keys.
"""
    (LIBRARY_DIR / "BUILD_README.md").write_text(readme, encoding="utf-8")


def write_library_files(all_prompts: list[Prompt], all_clusters: list[Cluster], final_files: list[Path]) -> None:
    LIBRARY_DIR.mkdir(parents=True, exist_ok=True)
    remove_legacy_outputs()
    write_timing_library(all_prompts)
    write_action_blocks(all_prompts, all_clusters)
    write_public_transcripts(all_prompts, all_clusters)
    write_render_manifest(all_prompts, final_files)
    write_readme(all_clusters)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", default=str(DEFAULT_ZIP))
    parser.add_argument("--api-key-file", default=str(DEFAULT_API_KEY_FILE))
    parser.add_argument("--skip-render", action="store_true")
    args = parser.parse_args()

    zip_path = Path(args.zip)
    if not zip_path.exists():
        print(f"Missing ZIP file: {zip_path}", file=sys.stderr)
        return 2

    reset_source_dir(zip_path)
    source_files = sorted(SOURCE_DIR.glob("*.txt"))
    if len(source_files) != 8:
        raise RuntimeError(f"Expected 8 text scripts in ZIP, found {len(source_files)}")

    all_prompts: list[Prompt] = []
    all_clusters: list[Cluster] = []
    for path in source_files:
        prompts, clusters = parse_source(path)
        all_prompts.extend(prompts)
        all_clusters.extend(clusters)

    validate_schedule(all_prompts, all_clusters)
    write_clean_transcripts(all_prompts)

    final_files: list[Path] = []
    if not args.skip_render:
        api_key = read_api_key(Path(args.api_key_file))
        if not api_key:
            print("Missing ElevenLabs API key from env or key file.", file=sys.stderr)
            return 2

        FINAL_AUDIO_DIR.mkdir(parents=True, exist_ok=True)

        prompts_by_file: dict[tuple[str, str], list[Prompt]] = {}
        for prompt in all_prompts:
            render_prompt(api_key, prompt)
            prompts_by_file.setdefault((prompt.version, prompt.language), []).append(prompt)

        for (version, language), prompts in sorted(prompts_by_file.items()):
            prompts.sort(key=lambda prompt: prompt.start_s)
            final_files.append(assemble_file(version, language, prompts))

    write_reports(all_prompts, all_clusters, final_files)
    write_library_files(all_prompts, all_clusters, final_files)
    print(f"Processed {len(source_files)} scripts, {len(all_prompts)} prompts, {len(all_clusters)} clusters.")
    if final_files:
        print("Final files:")
        for final_file in sorted(final_files, key=lambda path: path.name):
            print(f"  {final_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
