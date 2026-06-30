from __future__ import annotations

import csv
import hashlib
import importlib.util
import json
import subprocess
import sys
import wave
from dataclasses import dataclass
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
LIBRARY_DIR = PROJECT_DIR
FINAL_AUDIO_DIR = LIBRARY_DIR / "audio"
PROMPT_RAW_DIR = LIBRARY_DIR / "prompt_audio_raw"
CHOREO_WAV_DIR = LIBRARY_DIR / "choreo_v2_prompt_wav"
REPORT_DIR = LIBRARY_DIR / "validation_reports"
TRANSCRIPT_DIR = LIBRARY_DIR / "transcripts"
CLEAN_TRANSCRIPT_DIR = LIBRARY_DIR / "clean_timed_transcripts"

SAMPLE_RATE = 44_100
SAMPLE_WIDTH = 2
CHANNELS = 1
TARGET_DURATION_S = 300.0

ACTIVE_STOP_TEXTS = {
    "EN": "Complete this cycle. Center, stop.",
    "DE": "Beenden Sie den aktuellen Zyklus. Zur Mitte zurück und stoppen.",
}


@dataclass
class Cue:
    version: str
    language: str
    source_file: str
    start_s: float
    cluster_id: str
    cluster_label: str
    cue_role: str
    spoken_text: str
    source_prompt_role: str
    slice_segments: tuple[tuple[float, float | None], ...]
    rendered_duration_s: float = 0.0
    wav_file: str = ""
    next_cue_start_s: float = TARGET_DURATION_S
    protected_window_s: float = 0.0


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


def load_base_builder():
    path = SCRIPT_DIR / "build_hand_audio_from_zip.py"
    spec = importlib.util.spec_from_file_location("study6_hand_audio_base_builder", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load base builder from {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def seconds_to_mmss(seconds: float) -> str:
    rounded = int(round(seconds))
    minutes, secs = divmod(rounded, 60)
    return f"{minutes:02d}:{secs:02d}"


def prompt_hash(language: str, text: str) -> str:
    return hashlib.sha1(f"{language}\n{text}".encode("utf-8")).hexdigest()[:16]


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


def convert_mp3_to_wav(mp3_path: Path, wav_path: Path) -> None:
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(mp3_path),
            "-ac",
            "1",
            "-ar",
            str(SAMPLE_RATE),
            "-sample_fmt",
            "s16",
            str(wav_path),
        ],
        check=True,
    )


def read_wav_pcm(path: Path) -> bytes:
    with wave.open(str(path), "rb") as handle:
        if handle.getnchannels() != CHANNELS or handle.getsampwidth() != SAMPLE_WIDTH or handle.getframerate() != SAMPLE_RATE:
            raise RuntimeError(f"Unexpected WAV format: {path}")
        return handle.readframes(handle.getnframes())


def read_wav_segment(path: Path, start_s: float, end_s: float | None) -> bytes:
    with wave.open(str(path), "rb") as handle:
        if handle.getnchannels() != CHANNELS or handle.getsampwidth() != SAMPLE_WIDTH or handle.getframerate() != SAMPLE_RATE:
            raise RuntimeError(f"Unexpected WAV format: {path}")
        total_frames = handle.getnframes()
        start_frame = max(0, int(round(start_s * SAMPLE_RATE)))
        end_frame = total_frames if end_s is None else min(total_frames, int(round(end_s * SAMPLE_RATE)))
        if end_frame <= start_frame:
            raise RuntimeError(f"Invalid segment {start_s}->{end_s} for {path}")
        handle.setpos(start_frame)
        return handle.readframes(end_frame - start_frame)


def write_wav(path: Path, pcm: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(CHANNELS)
        handle.setsampwidth(SAMPLE_WIDTH)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(pcm)


def cached_raw_path(language: str, text: str) -> Path:
    path = PROMPT_RAW_DIR / f"{language}_{prompt_hash(language, text)}.mp3"
    if not path.exists():
        raise RuntimeError(f"Missing cached ElevenLabs prompt audio: {path}\n{text}")
    return path


def cue_wav(cue: Cue, source_text: str) -> Path:
    raw_path = cached_raw_path(cue.language, source_text)
    source_wav = CHOREO_WAV_DIR / "source" / f"{raw_path.stem}.wav"
    if not source_wav.exists():
        convert_mp3_to_wav(raw_path, source_wav)

    segment_token = "_".join(
        f"{start:.2f}-{('end' if end is None else f'{end:.2f}')}" for start, end in cue.slice_segments
    )
    cue_id = hashlib.sha1(
        f"{cue.language}\n{source_text}\n{segment_token}".encode("utf-8")
    ).hexdigest()[:16]
    output = CHOREO_WAV_DIR / f"{cue.language}_{cue_id}.wav"
    if output.exists():
        return output

    pieces: list[bytes] = []
    silence = b"\x00" * int(round(0.20 * SAMPLE_RATE)) * SAMPLE_WIDTH
    for idx, (start, end) in enumerate(cue.slice_segments):
        if idx:
            pieces.append(silence)
        pieces.append(read_wav_segment(source_wav, start, end))
    write_wav(output, b"".join(pieces))
    return output


def load_schedule():
    base = load_base_builder()
    if not base.SOURCE_DIR.exists() or len(list(base.SOURCE_DIR.glob("*.txt"))) != 8:
        base.reset_source_dir(base.DEFAULT_ZIP)

    all_prompts = []
    all_clusters = []
    for path in sorted(base.SOURCE_DIR.glob("*.txt")):
        prompts, clusters = base.parse_source(path)
        all_prompts.extend(prompts)
        all_clusters.extend(clusters)
    return all_prompts, all_clusters


def build_prompt_lookup(prompts) -> dict[tuple[str, str, str, str], object]:
    lookup = {}
    for prompt in prompts:
        lookup[(prompt.version, prompt.language, prompt.cluster_id, prompt.cue_role)] = prompt
    return lookup


def add_cue(
    cues: list[Cue],
    *,
    cluster: Cluster,
    prompt,
    start_s: float,
    cue_role: str,
    spoken_text: str | None = None,
    source_prompt_role: str | None = None,
    slice_segments: tuple[tuple[float, float | None], ...] = ((0.0, None),),
) -> None:
    cues.append(
        Cue(
            version=cluster.version,
            language=cluster.language,
            source_file=cluster.source_file,
            start_s=start_s,
            cluster_id=cluster.cluster_id,
            cluster_label=cluster.cluster_label,
            cue_role=cue_role,
            spoken_text=prompt.text if spoken_text is None else spoken_text,
            source_prompt_role=prompt.cue_role if source_prompt_role is None else source_prompt_role,
            slice_segments=slice_segments,
        )
    )


def build_cues(prompts, clusters) -> tuple[list[Cue], list[Cluster]]:
    lookup = build_prompt_lookup(prompts)
    cues: list[Cue] = []
    converted_clusters = [
        Cluster(
            version=cluster.version,
            language=cluster.language,
            source_file=cluster.source_file,
            cluster_id=cluster.cluster_id,
            cluster_label=cluster.cluster_label,
            start_s=cluster.start_s,
            end_s=cluster.end_s,
            duration_s=cluster.duration_s,
        )
        for cluster in clusters
    ]

    for cluster in sorted(converted_clusters, key=lambda item: (item.version, item.language, item.start_s)):
        key_base = (cluster.version, cluster.language, cluster.cluster_id)
        if cluster.cluster_id == "SETUP":
            prompt = lookup[(*key_base, "setup")]
            if cluster.language == "EN":
                add_cue(
                    cues,
                    cluster=cluster,
                    prompt=prompt,
                    start_s=cluster.start_s,
                    cue_role="setup",
                    spoken_text=(
                        "Hold both hands where you can see them, near the center of your view, "
                        "palms facing down. Keep them still."
                    ),
                    source_prompt_role="setup",
                    slice_segments=((4.00, 15.04),),
                )
            else:
                add_cue(
                    cues,
                    cluster=cluster,
                    prompt=prompt,
                    start_s=cluster.start_s,
                    cue_role="setup",
                    spoken_text=(
                        "Halten Sie beide Hände sichtbar vor sich, nahe der Mitte Ihres Blickfelds, "
                        "die Handflächen nach unten. Halten Sie sie still."
                    ),
                    source_prompt_role="setup",
                    slice_segments=((3.28, 14.24),),
                )
        elif cluster.cluster_id in {"A", "B", "D"}:
            add_cue(
                cues,
                cluster=cluster,
                prompt=lookup[(*key_base, "start")],
                start_s=cluster.start_s,
                cue_role="start",
            )
            add_cue(
                cues,
                cluster=cluster,
                prompt=lookup[(*key_base, "continue")],
                start_s=cluster.start_s + 28.0,
                cue_role="repeat_cue",
            )
            stop_prompt = lookup[(*key_base, "stop_transition")]
            add_cue(
                cues,
                cluster=cluster,
                prompt=stop_prompt,
                start_s=cluster.start_s + 54.0,
                cue_role="stop_transition",
                spoken_text=ACTIVE_STOP_TEXTS[cluster.language],
                source_prompt_role="ACTIVE_STOP",
            )
        elif cluster.cluster_id == "C":
            left_prompt = lookup[(*key_base, "start_left")]
            right_prompt = lookup[(*key_base, "switch_right")]
            stop_prompt = lookup[(*key_base, "stop_transition")]
            if cluster.language == "EN":
                add_cue(
                    cues,
                    cluster=cluster,
                    prompt=left_prompt,
                    start_s=cluster.start_s,
                    cue_role="left_path_cue",
                    spoken_text=(
                        "Begin now with the left-side reach. Keep your right hand at the center. "
                        "Move your left hand to the left side of the visible space in front of you, "
                        "then bring it back to center."
                    ),
                    source_prompt_role="start_left",
                    slice_segments=((0.0, 13.95),),
                )
                add_cue(
                    cues,
                    cluster=cluster,
                    prompt=right_prompt,
                    start_s=cluster.start_s + 30.0,
                    cue_role="right_path_cue",
                    spoken_text=(
                        "Switch sides now. Keep your left hand at the center. Move your right hand "
                        "to the right side, then keep repeating to the right and back."
                    ),
                    source_prompt_role="switch_right",
                    slice_segments=((0.0, 11.25), (19.64, 20.29)),
                )
            else:
                add_cue(
                    cues,
                    cluster=cluster,
                    prompt=left_prompt,
                    start_s=cluster.start_s,
                    cue_role="left_path_cue",
                    spoken_text=(
                        "Beginnen Sie jetzt mit der Bewegung nach links. Die rechte Hand bleibt in "
                        "der Mitte. Führen Sie die linke Hand nach links in den sichtbaren Raum vor "
                        "Ihnen und dann zurück zur Mitte."
                    ),
                    source_prompt_role="start_left",
                    slice_segments=((0.0, 15.30),),
                )
                add_cue(
                    cues,
                    cluster=cluster,
                    prompt=right_prompt,
                    start_s=cluster.start_s + 30.0,
                    cue_role="right_path_cue",
                    spoken_text=(
                        "Wechseln Sie jetzt die Seite. Die linke Hand bleibt in der Mitte. Führen "
                        "Sie die rechte Hand nach rechts in den sichtbaren Raum vor Ihnen und dann "
                        "zurück zur Mitte. Wiederholen Sie weiter."
                    ),
                    source_prompt_role="switch_right",
                    slice_segments=((0.0, 13.17), (22.99, 25.44)),
                )
            add_cue(
                cues,
                cluster=cluster,
                prompt=stop_prompt,
                start_s=cluster.start_s + 54.0,
                cue_role="stop_transition",
                spoken_text=ACTIVE_STOP_TEXTS[cluster.language],
                source_prompt_role="ACTIVE_STOP",
            )
        elif cluster.cluster_id == "CIRCLE":
            add_cue(
                cues,
                cluster=cluster,
                prompt=lookup[(*key_base, "start_circle")],
                start_s=cluster.start_s,
                cue_role="start_circle",
            )
            stop_prompt = lookup[(cluster.version, cluster.language, "C", "stop_transition")]
            add_cue(
                cues,
                cluster=cluster,
                prompt=stop_prompt,
                start_s=cluster.start_s + 34.0,
                cue_role="stop_transition",
                spoken_text=ACTIVE_STOP_TEXTS[cluster.language],
                source_prompt_role="ACTIVE_STOP",
            )
        else:
            raise RuntimeError(f"Unhandled cluster: {cluster.cluster_id}")

    return cues, converted_clusters


def source_text_for_cue(cue: Cue, lookup: dict[tuple[str, str, str, str], object]) -> str:
    if cue.source_prompt_role == "ACTIVE_STOP":
        return ACTIVE_STOP_TEXTS[cue.language]
    if cue.source_prompt_role.startswith("C."):
        prompt = lookup[(cue.version, cue.language, "C", cue.source_prompt_role.split(".", 1)[1])]
        return prompt.text
    prompt = lookup[(cue.version, cue.language, cue.cluster_id, cue.source_prompt_role)]
    return prompt.text


def render_cues(cues: list[Cue], prompts) -> None:
    lookup = build_prompt_lookup(prompts)
    for cue in cues:
        source_text = source_text_for_cue(cue, lookup)
        wav_path = cue_wav(cue, source_text)
        cue.wav_file = wav_path.name
        cue.rendered_duration_s = probe_duration(wav_path)

    by_file: dict[tuple[str, str], list[Cue]] = {}
    for cue in cues:
        by_file.setdefault((cue.version, cue.language), []).append(cue)

    for file_cues in by_file.values():
        file_cues.sort(key=lambda item: item.start_s)
        for idx, cue in enumerate(file_cues):
            cue.next_cue_start_s = file_cues[idx + 1].start_s if idx + 1 < len(file_cues) else TARGET_DURATION_S
            cue.protected_window_s = cue.next_cue_start_s - (cue.start_s + cue.rendered_duration_s)
            if cue.protected_window_s < -0.02:
                raise RuntimeError(
                    f"Cue overlap: {cue.version} {cue.language} {cue.cluster_id}/{cue.cue_role} "
                    f"at {cue.start_s:.3f}s duration={cue.rendered_duration_s:.3f}s next={cue.next_cue_start_s:.3f}s"
                )


def assemble_files(cues: list[Cue]) -> list[Path]:
    FINAL_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    final_files: list[Path] = []
    by_file: dict[tuple[str, str], list[Cue]] = {}
    for cue in cues:
        by_file.setdefault((cue.version, cue.language), []).append(cue)

    for (version, language), file_cues in sorted(by_file.items()):
        timeline = bytearray(int(round(TARGET_DURATION_S * SAMPLE_RATE)) * SAMPLE_WIDTH)
        for cue in sorted(file_cues, key=lambda item: item.start_s):
            pcm = read_wav_pcm(CHOREO_WAV_DIR / cue.wav_file)
            start_byte = int(round(cue.start_s * SAMPLE_RATE)) * SAMPLE_WIDTH
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
        final_files.append(final_mp3)
    return final_files


def write_reports(cues: list[Cue], clusters: list[Cluster], final_files: list[Path]) -> None:
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
            "protected_action_window_s",
            "spoken_text",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for idx, cue in enumerate(sorted(cues, key=lambda item: (item.version, item.language, item.start_s)), start=1):
            writer.writerow(
                {
                    "version": cue.version,
                    "language": cue.language,
                    "source_file": cue.source_file,
                    "prompt_index": idx,
                    "start_s": f"{cue.start_s:.3f}",
                    "end_s": f"{cue.next_cue_start_s:.3f}",
                    "slot_s": f"{cue.next_cue_start_s - cue.start_s:.3f}",
                    "cluster_id": cue.cluster_id,
                    "cluster_label": cue.cluster_label,
                    "cue_role": cue.cue_role,
                    "rendered_duration_s": f"{cue.rendered_duration_s:.3f}",
                    "adjusted_duration_s": f"{cue.rendered_duration_s:.3f}",
                    "tempo_factor": "1.000000",
                    "slack_s": f"{cue.next_cue_start_s - cue.start_s - cue.rendered_duration_s:.3f}",
                    "protected_action_window_s": f"{cue.protected_window_s:.3f}",
                    "spoken_text": cue.spoken_text,
                }
            )
        for version in sorted({cue.version for cue in cues}):
            for language in sorted({cue.language for cue in cues}):
                writer.writerow(
                    {
                        "version": version,
                        "language": language,
                        "source_file": "",
                        "prompt_index": "",
                        "start_s": "300.000",
                        "end_s": "300.000",
                        "slot_s": "0.000",
                        "cluster_id": "END",
                        "cluster_label": "End",
                        "cue_role": "terminal_marker",
                        "rendered_duration_s": "0.000",
                        "adjusted_duration_s": "0.000",
                        "tempo_factor": "1.000000",
                        "slack_s": "0.000",
                        "protected_action_window_s": "0.000",
                        "spoken_text": "Audio ends. No spoken prompt." if language == "EN" else "Audio endet. Kein gesprochener Hinweis.",
                    }
                )

    with (REPORT_DIR / "cluster_duration_validation.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        fieldnames = ["version", "language", "source_file", "cluster_id", "cluster_label", "start_s", "end_s", "duration_s"]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for cluster in sorted(clusters, key=lambda item: (item.version, item.language, item.start_s)):
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


def write_timing_library(cues: list[Cue]) -> None:
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
            "protected_action_window_s",
            "spoken_text",
            "note",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for idx, cue in enumerate(sorted(cues, key=lambda item: (item.version, item.language, item.start_s)), start=1):
            writer.writerow(
                {
                    "version": cue.version,
                    "language": cue.language,
                    "prompt_index": idx,
                    "start_s": f"{cue.start_s:.3f}",
                    "end_s": f"{cue.next_cue_start_s:.3f}",
                    "start_mmss": seconds_to_mmss(cue.start_s),
                    "end_mmss": seconds_to_mmss(cue.next_cue_start_s),
                    "duration_s": f"{cue.next_cue_start_s - cue.start_s:.3f}",
                    "cluster_id": cue.cluster_id,
                    "cluster_label": cue.cluster_label,
                    "cue_role": cue.cue_role,
                    "is_spoken": "true",
                    "protected_action_window_s": f"{cue.protected_window_s:.3f}",
                    "spoken_text": cue.spoken_text,
                    "note": "",
                }
            )


def write_transcripts(cues: list[Cue], clusters: list[Cluster]) -> None:
    for target in (TRANSCRIPT_DIR, CLEAN_TRANSCRIPT_DIR):
        target.mkdir(parents=True, exist_ok=True)

    cluster_lookup: dict[tuple[str, str], list[Cluster]] = {}
    for cluster in clusters:
        cluster_lookup.setdefault((cluster.version, cluster.language), []).append(cluster)

    by_file: dict[tuple[str, str], list[Cue]] = {}
    for cue in cues:
        by_file.setdefault((cue.version, cue.language), []).append(cue)

    language_names = {"EN": "English", "DE": "German"}
    for (version, language), file_cues in sorted(by_file.items()):
        order = " -> ".join(
            cluster.cluster_id
            for cluster in sorted(cluster_lookup[(version, language)], key=lambda item: item.start_s)
            if cluster.cluster_id not in {"SETUP", "CIRCLE"}
        )
        labels = {
            "EN": {
                "task": "Task: Neutral hand movement calibration task",
                "target": "Target duration: 05:00 exactly",
                "order": f"Movement cluster order: {order}",
                "timing": "Timing rule: each cue is followed by a protected action window before the next cue.",
                "endpoint": "Endpoint rule: the audio ends at 05:00 exactly; no terminal instruction is spoken.",
                "final": "Audio ends at 05:00 exactly.",
            },
            "DE": {
                "task": "Aufgabe: Neutrale Handbewegungs-Kalibrierungsaufgabe",
                "target": "Zieldauer: genau 05:00",
                "order": f"Reihenfolge der Bewegungscluster: {order}",
                "timing": "Zeitregel: Nach jedem Hinweis bleibt ein geschütztes Bewegungsfenster bis zum nächsten Hinweis.",
                "endpoint": "Endregel: Die Audioaufnahme endet genau bei 05:00; es wird kein abschließender Hinweis gesprochen.",
                "final": "Die Audioaufnahme endet genau bei 05:00.",
            },
        }[language]
        lines = [
            f"# Study 6 Neutral Hand Audio Guide - {version} - {language_names[language]}",
            "",
            labels["task"],
            labels["target"],
            labels["order"],
            labels["timing"],
            labels["endpoint"],
            "",
            "| Start | Next cue | Spoken duration | Protected action window | Cluster | Cue role | Spoken wording |",
            "|---:|---:|---:|---:|---|---|---|",
        ]
        for cue in sorted(file_cues, key=lambda item: item.start_s):
            lines.append(
                f"| {seconds_to_mmss(cue.start_s)} | {seconds_to_mmss(cue.next_cue_start_s)} | "
                f"{cue.rendered_duration_s:.1f} s | {max(0.0, cue.protected_window_s):.1f} s | "
                f"{cue.cluster_id} - {cue.cluster_label} | {cue.cue_role} | {cue.spoken_text} |"
            )
        lines.append("")
        lines.append(labels["final"])
        lines.append("")
        text = "\n".join(lines)
        (TRANSCRIPT_DIR / f"study6_neutral_hand_audio_{version}_{language}.md").write_text(text, encoding="utf-8-sig")
        (CLEAN_TRANSCRIPT_DIR / f"study6_hand_audio_{version}_{language}_clean.md").write_text(text, encoding="utf-8-sig")


def write_manifest(cues: list[Cue], final_files: list[Path]) -> None:
    manifest = {
        "task": "Study 6 neutral hand movement calibration audio",
        "choreography_version": "v2_protected_action_windows_from_cached_elevenlabs_audio",
        "target_duration_s": TARGET_DURATION_S,
        "files": [
            {
                "file": path.name,
                "duration_s": round(probe_duration(path), 6),
                "size_bytes": path.stat().st_size,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            }
            for path in sorted(final_files, key=lambda item: item.name)
        ],
        "cues": [
            {
                "version": cue.version,
                "language": cue.language,
                "start_s": cue.start_s,
                "next_cue_start_s": cue.next_cue_start_s,
                "cluster_id": cue.cluster_id,
                "cue_role": cue.cue_role,
                "rendered_duration_s": cue.rendered_duration_s,
                "protected_action_window_s": cue.protected_window_s,
                "source_prompt_role": cue.source_prompt_role,
                "slice_segments": cue.slice_segments,
                "text": cue.spoken_text,
            }
            for cue in sorted(cues, key=lambda item: (item.version, item.language, item.start_s))
        ],
    }
    (LIBRARY_DIR / "elevenlabs_render_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def write_readme() -> None:
    readme = """# Study 6 Neutral Hand Audio Guide Library

This library contains the protected-action-window choreography for the Study 6 neutral hand task. It uses cached ElevenLabs calm-voice prompts and local audio assembly; no new API calls are required for this version.

## Timing Standard

- Total target duration: 300 seconds.
- Setup: 00:00-00:20.
- Four core movement clusters: 00:20-04:20, 60 seconds each.
- Circle close: 04:20-05:00, 40 seconds.
- Core clusters use short cue timing: start cue at +0 s, repeat or switch cue around +28/+30 s, stop cue at +56 s.
- Cues are followed by protected action windows. This avoids saying a timed movement such as "three seconds out, three back" and immediately interrupting it with another spoken instruction.

## Files

- `audio/`: final 05:00 MP3 files.
- `transcripts/`: timed transcripts with spoken duration and protected action-window duration.
- `timing_library.csv`: exact cue timing and protected-window validation.
- `validation_reports/`: final duration, cluster duration, and prompt timing checks.
- `choreo_v2_prompt_wav/`: regenerable local WAV cue cache assembled from cached ElevenLabs MP3 prompts. This folder may be deleted after final MP3 validation to save disk space.
"""
    (LIBRARY_DIR / "BUILD_README.md").write_text(readme, encoding="utf-8")


def main() -> int:
    prompts, clusters = load_schedule()
    cues, converted_clusters = build_cues(prompts, clusters)
    render_cues(cues, prompts)
    final_files = assemble_files(cues)
    write_reports(cues, converted_clusters, final_files)
    write_timing_library(cues)
    write_transcripts(cues, converted_clusters)
    write_manifest(cues, final_files)
    write_readme()
    print(f"Built protected-window choreography from cache: {len(cues)} cues, {len(final_files)} files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
