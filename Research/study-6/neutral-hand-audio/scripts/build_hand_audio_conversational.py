from __future__ import annotations

"""Conversational experimenter rewrite of the Study 6 neutral hand audio.

This script is self-contained: the spoken wording lives in this file (no
dependency on hand_audio.zip or the older cached prompt clips). It keeps the
established study structure - the same five movement clusters, the same per
cluster durations, and the same four counterbalanced orders - but speaks to the
participant in a warm, guiding experimenter voice with explicit hand guidance,
repetition cues, and strategic pauses.

Timing standard (unchanged):
  - SETUP   00:00-00:20  (20 s intro + get ready)
  - 4 core clusters 00:20-04:20, 60 s each, order counterbalanced per version
  - CIRCLE  04:20-05:00  (40 s close)
  - Every final file is exactly 300.000 s.

Cluster wording is position-independent, so each cluster is rendered once per
language and reused across all four versions. Only the order differs between
versions. This keeps the render small (one clip per unique line per language).

Usage:
  # Preview wording + schedule, no API calls, nothing published is overwritten:
  python scripts/build_hand_audio_conversational.py --dry-run

  # Full ElevenLabs render (needs ffmpeg/ffprobe on PATH and ELEVENLABS_API_KEY set):
  python scripts/build_hand_audio_conversational.py

  # Full local XTTS-v2 render (run with a Python env that has coqui-tts + torch):
  python scripts/build_hand_audio_conversational.py --backend xtts
"""

import argparse
import csv
import hashlib
import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import wave
from dataclasses import dataclass, field
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
LIBRARY_DIR = PROJECT_DIR
FINAL_AUDIO_DIR = LIBRARY_DIR / "audio"
PROMPT_RAW_DIR = LIBRARY_DIR / "prompt_audio_raw"
PROMPT_WAV_DIR = LIBRARY_DIR / "conversational_prompt_wav"
REPORT_DIR = LIBRARY_DIR / "validation_reports"
TRANSCRIPT_DIR = LIBRARY_DIR / "transcripts"
PREVIEW_DIR = LIBRARY_DIR / "conversational_preview"

VOICE_ID = "rt9KyyQmwqa1uhHGJkMa"
MODEL_ID = "eleven_v3"
OUTPUT_FORMAT = "mp3_44100_128"
XTTS_MODEL_NAME = "tts_models/multilingual/multi-dataset/xtts_v2"
XTTS_SPEAKER_WAV = Path(
    r"C:\Users\gfeje\Documents\GitHub\pps-kit\assets\breathing\original_study5\General_Instructions.wav"
)
SAMPLE_RATE = 44_100
SAMPLE_WIDTH = 2
CHANNELS = 1
TARGET_DURATION_S = 300.0
SAFETY_GAP_S = 0.05

DEFAULT_API_KEY_FILE = Path.home() / "Downloads" / "elevenlabs_access_codex.txt"

LANGUAGE_CODES = {"EN": "en", "DE": "de"}
LANGUAGE_NAMES = {"EN": "English", "DE": "German"}

# Counterbalanced core-cluster orders (unchanged from the original study).
VERSION_ORDERS = {
    "V01": ["A", "B", "D", "C"],
    "V02": ["B", "C", "A", "D"],
    "V03": ["D", "A", "C", "B"],
    "V04": ["C", "D", "B", "A"],
}

CLUSTER_LABELS = {
    "EN": {
        "SETUP": "Setup",
        "A": "arms into a V and back",
        "B": "arms up and down",
        "C": "fingers and fists",
        "D": "arms reaching forward",
        "CIRCLE": "closing circle",
    },
    "DE": {
        "SETUP": "Setup",
        "A": "Arme zu einem V und zurueck",
        "B": "Arme heben und senken",
        "C": "Finger und Faeuste",
        "D": "Arme nach vorne strecken",
        "CIRCLE": "Abschluss mit Kreis",
    },
}

# Relative cue offsets within a cluster. Each core cluster gets a start cue and
# one light continuation cue; there is no separate pause/transition cue (the
# next cluster's start cue is the transition).
CORE_CUE_SCHEDULE = [("start", 0.0), ("continue", 30.0)]
CIRCLE_CUE_SCHEDULE = [("start_circle", 0.0), ("close", 30.0)]

CLUSTER_START_TIMES = [20.0, 80.0, 140.0, 200.0]
SETUP_START = 0.0
CIRCLE_START = 260.0

# All spoken wording. WORDING[language][cluster_id][cue_role] -> text.
WORDING = {
    "EN": {
        "SETUP": {
            "setup": (
                "This session takes about five minutes. We will guide you through "
                "a few short hand and arm movements, one after another. To start, "
                "hold both hands up in front of you, turn your palms to face you, "
                "and look at them."
            ),
        },
        "A": {
            "start": (
                "Now, let's do a movement with both arms. Stretch both arms out to "
                "your sides and upward, away from each other, into a wide V shape. "
                "Then bring your hands back down to the center until they nearly "
                "meet. Repeat this a few times, at your own pace."
            ),
            "continue": (
                "Keep opening your arms into the V and back to the center, "
                "continuing at your own speed."
            ),
        },
        "B": {
            "start": (
                "Now let's do the next one, with both arms in front of you. Raise "
                "both arms upward until your hands are about at eye level, then "
                "lower them all the way back down again. Raise and lower your arms, "
                "and go through this a few times, in your own time."
            ),
            "continue": (
                "Continue raising your arms all the way up to eye level and "
                "lowering them, in your own rhythm."
            ),
        },
        "C": {
            "start": (
                "Now let's try a movement with your fingers. Spread all the fingers "
                "of both hands wide apart, stretching them out fully, then curl "
                "them in to make two fists. Open and then close your fingers, and "
                "repeat this several times, at your own speed."
            ),
            "continue": (
                "Carry on spreading your fingers wide and closing them into fists "
                "again, in your own time."
            ),
        },
        "D": {
            "start": (
                "Next, let's do a movement with one arm at a time. Reach your right "
                "arm straight out in front of you, then bring it back. Do the same "
                "with your left arm, forward and back. Alternate between them, and "
                "do this a few times, in your own rhythm."
            ),
            "continue": (
                "Keep reaching each arm forward and back, right and then left, and "
                "carry on at your own pace."
            ),
        },
        "CIRCLE": {
            "start_circle": (
                "Finally, let's do a movement with both hands together. Hold your "
                "hands in front of you and move them around in a circle in the air, "
                "both hands following the same path. Keep tracing the circle, and "
                "repeat it a few times, at your own pace."
            ),
            "close": (
                "Now make the circle smaller and smaller, until both hands come "
                "back to the center and stop. This is the end of the session."
            ),
        },
    },
    "DE": {
        "SETUP": {
            "setup": (
                "Diese Sitzung dauert etwa fuenf Minuten. Wir fuehren Sie "
                "nacheinander durch einige kurze Hand- und Armbewegungen. Halten "
                "Sie zu Beginn beide Haende vor sich, drehen Sie die Handflaechen "
                "zu sich, und schauen Sie sie an."
            ),
        },
        "A": {
            "start": (
                "Nun lassen Sie uns eine Bewegung mit beiden Armen machen. Strecken "
                "Sie beide Arme zur Seite und nach oben aus, voneinander weg, "
                "sodass sie ein weites V bilden. Fuehren Sie die Haende dann wieder "
                "zur Mitte zurueck. Wiederholen Sie das ein paar Mal, in Ihrem "
                "eigenen Tempo."
            ),
            "continue": (
                "Oeffnen Sie die Arme weiter zum V und fuehren Sie sie zurueck zur "
                "Mitte, in Ihrem eigenen Rhythmus."
            ),
        },
        "B": {
            "start": (
                "Machen wir nun die naechste Bewegung, mit beiden Armen vor sich. "
                "Heben Sie beide Arme an, bis Ihre Haende etwa auf Augenhoehe sind, "
                "und senken Sie sie dann wieder ganz nach unten. Heben und senken "
                "Sie die Arme, und wiederholen Sie das mehrmals, ganz nach Belieben."
            ),
            "continue": (
                "Heben und senken Sie beide Arme weiter, bis auf Augenhoehe und "
                "zurueck, so wie Sie moechten."
            ),
        },
        "C": {
            "start": (
                "Versuchen wir nun eine Bewegung mit Ihren Fingern. Spreizen Sie "
                "alle Finger weit auseinander, strecken Sie sie ganz "
                "aus, und ballen Sie sie dann zu zwei Faeusten. Oeffnen und "
                "schliessen Sie die Finger, und wiederholen Sie das einige Male, in "
                "Ihrem eigenen Rhythmus."
            ),
            "continue": (
                "Spreizen und ballen Sie die Finger weiter, oeffnen und "
                "schliessen Sie sie, ganz nach Belieben."
            ),
        },
        "D": {
            "start": (
                "Als naechstes machen wir eine Bewegung mit einem Arm nach dem "
                "anderen. Strecken Sie den rechten Arm gerade vor sich aus und "
                "fuehren Sie ihn zurueck. Machen Sie dasselbe mit dem linken Arm, "
                "vor und zurueck. Wiederholen Sie das mehrmals abwechselnd, so wie "
                "Sie moechten."
            ),
            "continue": (
                "Strecken Sie weiter abwechselnd den rechten und den linken Arm "
                "vor und zurueck, in Ihrem eigenen Tempo."
            ),
        },
        "CIRCLE": {
            "start_circle": (
                "Zum Abschluss machen wir eine Bewegung mit beiden Haenden "
                "zusammen. Halten Sie die Haende vor sich und bewegen Sie sie im "
                "Kreis durch die Luft, beide auf derselben Bahn. Zeichnen Sie den "
                "Kreis weiter, und wiederholen Sie ihn ein paar Mal, ganz nach "
                "Belieben."
            ),
            "close": (
                "Lassen Sie den Kreis nun kleiner und kleiner werden, bis beide "
                "Haende zur Mitte zurueckkommen und stehen bleiben. Dies ist das "
                "Ende der Sitzung."
            ),
        },
    },
}


@dataclass
class Cue:
    version: str
    language: str
    cluster_id: str
    cluster_label: str
    cue_role: str
    start_s: float
    spoken_text: str
    next_cue_start_s: float = TARGET_DURATION_S
    slot_s: float = 0.0
    rendered_duration_s: float = 0.0
    adjusted_duration_s: float = 0.0
    tempo_factor: float = 1.0
    protected_window_s: float = 0.0
    raw_file: str = ""
    wav_file: str = ""


@dataclass
class Cluster:
    version: str
    language: str
    cluster_id: str
    cluster_label: str
    start_s: float
    end_s: float
    duration_s: float


# --------------------------------------------------------------------------- #
# Schedule construction
# --------------------------------------------------------------------------- #
def build_schedule(language: str, version: str) -> tuple[list[Cue], list[Cluster]]:
    order = VERSION_ORDERS[version]
    labels = CLUSTER_LABELS[language]
    words = WORDING[language]
    cues: list[Cue] = []
    clusters: list[Cluster] = []

    # SETUP
    clusters.append(
        Cluster(version, language, "SETUP", labels["SETUP"], SETUP_START, CLUSTER_START_TIMES[0], CLUSTER_START_TIMES[0] - SETUP_START)
    )
    cues.append(
        Cue(version, language, "SETUP", labels["SETUP"], "setup", SETUP_START, words["SETUP"]["setup"])
    )

    # Core clusters in counterbalanced order
    for slot_index, cluster_id in enumerate(order):
        base = CLUSTER_START_TIMES[slot_index]
        end = base + 60.0
        clusters.append(
            Cluster(version, language, cluster_id, labels[cluster_id], base, end, 60.0)
        )
        schedule = CORE_CUE_SCHEDULE
        for cue_role, offset in schedule:
            cues.append(
                Cue(
                    version,
                    language,
                    cluster_id,
                    labels[cluster_id],
                    cue_role,
                    base + offset,
                    words[cluster_id][cue_role],
                )
            )

    # CIRCLE close
    clusters.append(
        Cluster(version, language, "CIRCLE", labels["CIRCLE"], CIRCLE_START, TARGET_DURATION_S, TARGET_DURATION_S - CIRCLE_START)
    )
    for cue_role, offset in CIRCLE_CUE_SCHEDULE:
        cues.append(
            Cue(
                version,
                language,
                "CIRCLE",
                labels["CIRCLE"],
                cue_role,
                CIRCLE_START + offset,
                words["CIRCLE"][cue_role],
            )
        )

    cues.sort(key=lambda item: item.start_s)
    for idx, cue in enumerate(cues):
        cue.next_cue_start_s = cues[idx + 1].start_s if idx + 1 < len(cues) else TARGET_DURATION_S
        cue.slot_s = cue.next_cue_start_s - cue.start_s
    return cues, clusters


def build_all() -> tuple[list[Cue], list[Cluster]]:
    all_cues: list[Cue] = []
    all_clusters: list[Cluster] = []
    for version in sorted(VERSION_ORDERS):
        for language in ("EN", "DE"):
            cues, clusters = build_schedule(language, version)
            all_cues.extend(cues)
            all_clusters.extend(clusters)
    return all_cues, all_clusters


def validate_schedule(cues: list[Cue], clusters: list[Cluster]) -> None:
    by_file: dict[tuple[str, str], list[Cue]] = {}
    for cue in cues:
        by_file.setdefault((cue.version, cue.language), []).append(cue)
    for key, file_cues in by_file.items():
        starts = [cue.start_s for cue in sorted(file_cues, key=lambda item: item.start_s)]
        if starts[0] != 0.0:
            raise RuntimeError(f"{key} does not start at 0: {starts[0]}")
        if starts != sorted(starts):
            raise RuntimeError(f"{key} cue starts not monotonic")
        if any(slot <= 0 for slot in (cue.slot_s for cue in file_cues)):
            raise RuntimeError(f"{key} has a non-positive slot")

    expected = {"SETUP": 20.0, "A": 60.0, "B": 60.0, "C": 60.0, "D": 60.0, "CIRCLE": 40.0}
    by_cluster: dict[tuple[str, str], dict[str, float]] = {}
    for cluster in clusters:
        by_cluster.setdefault((cluster.version, cluster.language), {})[cluster.cluster_id] = cluster.duration_s
    for key, durations in by_cluster.items():
        for cluster_id, want in expected.items():
            got = durations.get(cluster_id)
            if got is None:
                raise RuntimeError(f"{key} missing cluster {cluster_id}")
            if abs(got - want) > 0.001:
                raise RuntimeError(f"{key} cluster {cluster_id} expected {want}s got {got}s")


# --------------------------------------------------------------------------- #
# Audio helpers (require ffmpeg/ffprobe)
# --------------------------------------------------------------------------- #
def read_api_key(api_key_file: Path) -> str:
    api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if api_key:
        return api_key
    if api_key_file.exists():
        return api_key_file.read_text(encoding="utf-8").strip()
    return ""


def request_mp3(api_key: str, text: str, language: str) -> bytes:
    query = urllib.parse.urlencode({"output_format": OUTPUT_FORMAT})
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}?{query}"
    payload = {"text": text, "model_id": MODEL_ID, "language_code": LANGUAGE_CODES[language]}
    body = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json", "Accept": "audio/mpeg", "xi-api-key": api_key}
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            return response.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"ElevenLabs HTTP {exc.code}: {detail}") from exc


def probe_duration(path: Path) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        check=True, capture_output=True, text=True,
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


def convert_audio_to_wav(audio_path: Path, wav_path: Path, target_duration: float | None = None) -> None:
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    command = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(audio_path)]
    if target_duration is not None:
        factor = probe_duration(audio_path) / target_duration
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


def prompt_hash(language: str, text: str, namespace: str = "") -> str:
    return hashlib.sha1(f"{namespace}\n{language}\n{text}".encode("utf-8")).hexdigest()[:16]


def fit_rendered_cue(cue: Cue, raw_path: Path, text_hash: str) -> None:
    wav_path = PROMPT_WAV_DIR / f"{cue.language}_{text_hash}.wav"
    adjusted_path = PROMPT_WAV_DIR / f"{cue.language}_{text_hash}_fit.wav"
    PROMPT_WAV_DIR.mkdir(parents=True, exist_ok=True)

    cue.raw_file = raw_path.name
    cue.rendered_duration_s = probe_duration(raw_path)

    max_duration = max(0.25, cue.slot_s - SAFETY_GAP_S)
    if cue.rendered_duration_s > max_duration:
        convert_audio_to_wav(raw_path, adjusted_path, target_duration=max_duration)
        cue.wav_file = adjusted_path.name
        cue.adjusted_duration_s = probe_duration(adjusted_path)
        cue.tempo_factor = cue.rendered_duration_s / max_duration
    else:
        convert_audio_to_wav(raw_path, wav_path)
        cue.wav_file = wav_path.name
        cue.adjusted_duration_s = probe_duration(wav_path)
        cue.tempo_factor = 1.0

    cue.protected_window_s = cue.next_cue_start_s - (cue.start_s + cue.adjusted_duration_s)
    if cue.protected_window_s < -0.02:
        raise RuntimeError(
            f"Cue overran its slot: {cue.version} {cue.language} {cue.cluster_id}/{cue.cue_role} "
            f"slot={cue.slot_s:.3f}s adjusted={cue.adjusted_duration_s:.3f}s"
        )


def render_cue_elevenlabs(api_key: str, cue: Cue) -> None:
    text_hash = prompt_hash(cue.language, cue.spoken_text)
    raw_path = PROMPT_RAW_DIR / f"{cue.language}_{text_hash}.mp3"
    PROMPT_RAW_DIR.mkdir(parents=True, exist_ok=True)

    if not raw_path.exists():
        raw_path.write_bytes(request_mp3(api_key, cue.spoken_text, cue.language))
    fit_rendered_cue(cue, raw_path, text_hash)


class XttsRenderer:
    def __init__(self, speaker_wav: Path, model_name: str, device: str) -> None:
        if not speaker_wav.exists():
            raise FileNotFoundError(f"XTTS speaker reference not found: {speaker_wav}")
        try:
            import torch
            from TTS.api import TTS
        except ImportError as exc:
            raise RuntimeError(
                "XTTS backend requires coqui-tts, torch, and torchaudio. "
                "Run from the local .venv-xtts environment or install those packages."
            ) from exc

        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "cpu"
        if device == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("XTTS device was set to cuda, but torch.cuda.is_available() is false.")

        self.speaker_wav = speaker_wav
        self.model_name = model_name
        self.device = device
        self.tts = TTS(model_name).to(device)
        speaker_digest = hashlib.sha1(speaker_wav.read_bytes()).hexdigest()[:12]
        self.cache_namespace = f"xtts:{model_name}:{speaker_digest}:split_sentences"

    def render(self, cue: Cue) -> None:
        text_hash = prompt_hash(cue.language, cue.spoken_text, self.cache_namespace)
        raw_path = PROMPT_WAV_DIR / f"XTTS_{cue.language}_{text_hash}_raw.wav"
        PROMPT_WAV_DIR.mkdir(parents=True, exist_ok=True)
        if not raw_path.exists():
            self.tts.tts_to_file(
                text=cue.spoken_text,
                speaker_wav=str(self.speaker_wav),
                language=LANGUAGE_CODES[cue.language],
                file_path=str(raw_path),
                split_sentences=True,
            )
        fit_rendered_cue(cue, raw_path, text_hash)


def assemble_file(version: str, language: str, cues: list[Cue]) -> Path:
    FINAL_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    timeline = bytearray(int(round(TARGET_DURATION_S * SAMPLE_RATE)) * SAMPLE_WIDTH)
    for cue in sorted(cues, key=lambda item: item.start_s):
        pcm = read_wav_pcm(PROMPT_WAV_DIR / cue.wav_file)
        start_byte = int(round(cue.start_s * SAMPLE_RATE)) * SAMPLE_WIDTH
        end_byte = min(start_byte + len(pcm), len(timeline))
        timeline[start_byte:end_byte] = pcm[: end_byte - start_byte]

    temp_wav = FINAL_AUDIO_DIR / f"study6_neutral_hand_audio_{version}_{language}.wav"
    final_mp3 = FINAL_AUDIO_DIR / f"study6_neutral_hand_audio_{version}_{language}.mp3"
    write_wav(temp_wav, bytes(timeline))
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(temp_wav),
         "-c:a", "libmp3lame", "-b:a", "128k", str(final_mp3)],
        check=True,
    )
    temp_wav.unlink(missing_ok=True)
    return final_mp3


# --------------------------------------------------------------------------- #
# Output writers
# --------------------------------------------------------------------------- #
def seconds_to_mmss(seconds: float) -> str:
    rounded = int(round(seconds))
    minutes, secs = divmod(rounded, 60)
    return f"{minutes:02d}:{secs:02d}"


def write_transcripts(cues: list[Cue], clusters: list[Cluster], target_dir: Path, *, rendered: bool) -> None:
    if target_dir.exists():
        for old in target_dir.glob("*.md"):
            old.unlink()
    target_dir.mkdir(parents=True, exist_ok=True)

    cluster_lookup: dict[tuple[str, str], list[Cluster]] = {}
    for cluster in clusters:
        cluster_lookup.setdefault((cluster.version, cluster.language), []).append(cluster)
    by_file: dict[tuple[str, str], list[Cue]] = {}
    for cue in cues:
        by_file.setdefault((cue.version, cue.language), []).append(cue)

    for (version, language), file_cues in sorted(by_file.items()):
        order = " -> ".join(
            cluster.cluster_id
            for cluster in sorted(cluster_lookup[(version, language)], key=lambda item: item.start_s)
            if cluster.cluster_id not in {"SETUP", "CIRCLE"}
        )
        header = [
            f"# Study 6 Neutral Hand Audio (Conversational) - {version} - {LANGUAGE_NAMES[language]}",
            "",
            "Task: Neutral hand movement calibration task, experimenter-guided wording.",
            "Target duration: 05:00 exactly.",
            f"Movement cluster order: {order}",
            "Timing rule: each cue is followed by a protected action window before the next cue.",
            "",
            "| Start | Next cue | Spoken | Protected window | Cluster | Cue role | Spoken wording |",
            "|---:|---:|---:|---:|---|---|---|",
        ]
        lines = list(header)
        for cue in sorted(file_cues, key=lambda item: item.start_s):
            spoken = f"{cue.adjusted_duration_s:.1f} s" if rendered else "n/a (dry-run)"
            window = f"{max(0.0, cue.protected_window_s):.1f} s" if rendered else f"slot {cue.slot_s:.0f} s"
            lines.append(
                f"| {seconds_to_mmss(cue.start_s)} | {seconds_to_mmss(cue.next_cue_start_s)} | "
                f"{spoken} | {window} | {cue.cluster_id} - {cue.cluster_label} | {cue.cue_role} | {cue.spoken_text} |"
            )
        lines.append("")
        lines.append("Audio ends at 05:00 exactly; no terminal instruction is spoken.")
        lines.append("")
        (target_dir / f"study6_neutral_hand_audio_{version}_{language}.md").write_text(
            "\n".join(lines), encoding="utf-8-sig"
        )


def write_timing_library(cues: list[Cue]) -> None:
    fieldnames = [
        "version", "language", "prompt_index", "start_s", "end_s", "start_mmss", "end_mmss",
        "slot_s", "cluster_id", "cluster_label", "cue_role", "rendered_duration_s",
        "adjusted_duration_s", "tempo_factor", "protected_action_window_s", "spoken_text",
    ]
    with (LIBRARY_DIR / "timing_library.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for idx, cue in enumerate(sorted(cues, key=lambda item: (item.version, item.language, item.start_s)), start=1):
            writer.writerow({
                "version": cue.version, "language": cue.language, "prompt_index": idx,
                "start_s": f"{cue.start_s:.3f}", "end_s": f"{cue.next_cue_start_s:.3f}",
                "start_mmss": seconds_to_mmss(cue.start_s), "end_mmss": seconds_to_mmss(cue.next_cue_start_s),
                "slot_s": f"{cue.slot_s:.3f}", "cluster_id": cue.cluster_id, "cluster_label": cue.cluster_label,
                "cue_role": cue.cue_role, "rendered_duration_s": f"{cue.rendered_duration_s:.3f}",
                "adjusted_duration_s": f"{cue.adjusted_duration_s:.3f}", "tempo_factor": f"{cue.tempo_factor:.6f}",
                "protected_action_window_s": f"{cue.protected_window_s:.3f}", "spoken_text": cue.spoken_text,
            })


def write_reports(cues: list[Cue], clusters: list[Cluster], final_files: list[Path]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    with (REPORT_DIR / "cluster_duration_validation.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=["version", "language", "cluster_id", "cluster_label", "start_s", "end_s", "duration_s"])
        writer.writeheader()
        for cluster in sorted(clusters, key=lambda item: (item.version, item.language, item.start_s)):
            writer.writerow({
                "version": cluster.version, "language": cluster.language, "cluster_id": cluster.cluster_id,
                "cluster_label": cluster.cluster_label, "start_s": f"{cluster.start_s:.3f}",
                "end_s": f"{cluster.end_s:.3f}", "duration_s": f"{cluster.duration_s:.3f}",
            })
    with (REPORT_DIR / "prompt_timing_validation.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=["version", "language", "start_s", "end_s", "slot_s", "cluster_id", "cue_role", "rendered_duration_s", "adjusted_duration_s", "tempo_factor", "protected_action_window_s", "spoken_text"])
        writer.writeheader()
        for cue in sorted(cues, key=lambda item: (item.version, item.language, item.start_s)):
            writer.writerow({
                "version": cue.version, "language": cue.language, "start_s": f"{cue.start_s:.3f}",
                "end_s": f"{cue.next_cue_start_s:.3f}", "slot_s": f"{cue.slot_s:.3f}", "cluster_id": cue.cluster_id,
                "cue_role": cue.cue_role, "rendered_duration_s": f"{cue.rendered_duration_s:.3f}",
                "adjusted_duration_s": f"{cue.adjusted_duration_s:.3f}", "tempo_factor": f"{cue.tempo_factor:.6f}",
                "protected_action_window_s": f"{cue.protected_window_s:.3f}", "spoken_text": cue.spoken_text,
            })
    if final_files:
        with (REPORT_DIR / "final_audio_duration_validation.csv").open("w", newline="", encoding="utf-8-sig") as handle:
            writer = csv.DictWriter(handle, fieldnames=["file", "duration_s", "difference_from_300_ms", "size_bytes"])
            writer.writeheader()
            for final_file in sorted(final_files, key=lambda path: path.name):
                duration = probe_duration(final_file)
                writer.writerow({
                    "file": final_file.name, "duration_s": f"{duration:.6f}",
                    "difference_from_300_ms": f"{(duration - TARGET_DURATION_S) * 1000:.3f}",
                    "size_bytes": final_file.stat().st_size,
                })


def write_manifest(
    cues: list[Cue],
    final_files: list[Path],
    *,
    backend: str,
    model_id: str,
    voice_id: str = "",
    speaker_wav: Path | None = None,
    device: str = "",
) -> None:
    final_by_name = {path.name: path for path in final_files}
    file_entries = []
    for version in sorted(VERSION_ORDERS):
        for language in ("EN", "DE"):
            name = f"study6_neutral_hand_audio_{version}_{language}.mp3"
            path = final_by_name.get(name)
            entry = {"version": version, "language": language, "file": name}
            if path and path.exists():
                entry.update({
                    "duration_s": round(probe_duration(path), 6),
                    "size_bytes": path.stat().st_size,
                    "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                })
            file_entries.append(entry)
    manifest = {
        "task": "Study 6 neutral hand movement calibration audio (conversational rewrite)",
        "choreography_version": "v3_conversational_experimenter_voice",
        "tts_backend": backend,
        "voice_id": voice_id,
        "model_id": model_id,
        "speaker_reference_wav": str(speaker_wav) if speaker_wav else "",
        "device": device,
        "output_format": OUTPUT_FORMAT,
        "target_duration_s": TARGET_DURATION_S,
        "sample_rate_hz": SAMPLE_RATE,
        "languages": LANGUAGE_CODES,
        "version_orders": VERSION_ORDERS,
        "files": file_entries,
        "cues": [
            {
                "version": cue.version, "language": cue.language, "start_s": cue.start_s,
                "next_cue_start_s": cue.next_cue_start_s, "cluster_id": cue.cluster_id,
                "cue_role": cue.cue_role, "rendered_duration_s": cue.rendered_duration_s,
                "adjusted_duration_s": cue.adjusted_duration_s, "tempo_factor": cue.tempo_factor,
                "protected_action_window_s": cue.protected_window_s, "text": cue.spoken_text,
            }
            for cue in sorted(cues, key=lambda item: (item.version, item.language, item.start_s))
        ],
    }
    manifest_json = json.dumps(manifest, ensure_ascii=False, indent=2)
    for manifest_name in ("tts_render_manifest.json", "elevenlabs_render_manifest.json"):
        (LIBRARY_DIR / manifest_name).write_text(manifest_json, encoding="utf-8")


def estimate_seconds(text: str) -> float:
    # Rough preview estimate only: ~14.5 characters per second of calm speech.
    return len(text) / 14.5


def write_preview(cues: list[Cue], clusters: list[Cluster]) -> None:
    write_transcripts(cues, clusters, PREVIEW_DIR, rendered=False)
    fieldnames = ["version", "language", "start_mmss", "slot_s", "est_speech_s", "est_pause_s", "cluster_id", "cue_role", "chars", "spoken_text"]
    with (PREVIEW_DIR / "schedule_preview.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for cue in sorted(cues, key=lambda item: (item.version, item.language, item.start_s)):
            est = estimate_seconds(cue.spoken_text)
            writer.writerow({
                "version": cue.version, "language": cue.language, "start_mmss": seconds_to_mmss(cue.start_s),
                "slot_s": f"{cue.slot_s:.1f}", "est_speech_s": f"{est:.1f}",
                "est_pause_s": f"{max(0.0, cue.slot_s - est):.1f}", "cluster_id": cue.cluster_id,
                "cue_role": cue.cue_role, "chars": len(cue.spoken_text), "spoken_text": cue.spoken_text,
            })


def report_tight_slots(cues: list[Cue]) -> list[Cue]:
    tight = []
    for cue in cues:
        if estimate_seconds(cue.spoken_text) > cue.slot_s - SAFETY_GAP_S:
            tight.append(cue)
    return tight


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #
def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Build schedule + wording preview without calling the API or touching published audio.")
    parser.add_argument("--backend", choices=("elevenlabs", "xtts"), default="elevenlabs", help="TTS backend to use for full renders.")
    parser.add_argument("--api-key-file", default=str(DEFAULT_API_KEY_FILE))
    parser.add_argument("--xtts-speaker-wav", default=str(XTTS_SPEAKER_WAV), help="Speaker reference WAV for --backend xtts.")
    parser.add_argument("--xtts-model-name", default=XTTS_MODEL_NAME)
    parser.add_argument("--xtts-device", choices=("auto", "cuda", "cpu"), default="auto")
    args = parser.parse_args()

    cues, clusters = build_all()
    validate_schedule(cues, clusters)

    if args.dry_run:
        write_preview(cues, clusters)
        tight = report_tight_slots(cues)
        unique_en = {c.spoken_text for c in cues if c.language == "EN"}
        unique_de = {c.spoken_text for c in cues if c.language == "DE"}
        total_chars = sum(len(t) for t in unique_en | unique_de)
        print("DRY RUN: schedule valid. No audio rendered, no published files changed.")
        print(f"Unique lines to render: {len(unique_en)} EN + {len(unique_de)} DE = {len(unique_en) + len(unique_de)}.")
        print(f"Approx characters to render (unique lines, both languages): {total_chars}.")
        print(f"Preview written to: {PREVIEW_DIR}")
        if tight:
            print(f"WARNING: {len(tight)} cue(s) may need tempo compression to fit their slot:")
            for cue in tight:
                print(f"  {cue.version} {cue.language} {cue.cluster_id}/{cue.cue_role}: "
                      f"~{estimate_seconds(cue.spoken_text):.1f}s est vs {cue.slot_s:.1f}s slot")
        else:
            print("All cues comfortably fit their slots by estimate.")
        return 0

    manifest_kwargs: dict[str, object]
    if args.backend == "elevenlabs":
        api_key = read_api_key(Path(args.api_key_file))
        if not api_key:
            print("Missing ElevenLabs API key (set ELEVENLABS_API_KEY).", file=sys.stderr)
            return 2
        for cue in cues:
            render_cue_elevenlabs(api_key, cue)
        manifest_kwargs = {
            "backend": "elevenlabs",
            "model_id": MODEL_ID,
            "voice_id": VOICE_ID,
            "speaker_wav": None,
            "device": "",
        }
    else:
        xtts = XttsRenderer(Path(args.xtts_speaker_wav), args.xtts_model_name, args.xtts_device)
        for cue in cues:
            xtts.render(cue)
        manifest_kwargs = {
            "backend": "xtts",
            "model_id": args.xtts_model_name,
            "voice_id": "",
            "speaker_wav": Path(args.xtts_speaker_wav),
            "device": xtts.device,
        }

    final_files: list[Path] = []
    by_file: dict[tuple[str, str], list[Cue]] = {}
    for cue in cues:
        by_file.setdefault((cue.version, cue.language), []).append(cue)
    for (version, language), file_cues in sorted(by_file.items()):
        final_files.append(assemble_file(version, language, file_cues))

    write_transcripts(cues, clusters, TRANSCRIPT_DIR, rendered=True)
    write_timing_library(cues)
    write_reports(cues, clusters, final_files)
    write_manifest(cues, final_files, **manifest_kwargs)
    print(f"Rendered {len(cues)} cues into {len(final_files)} final MP3 files.")
    for final_file in sorted(final_files, key=lambda path: path.name):
        print(f"  {final_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
