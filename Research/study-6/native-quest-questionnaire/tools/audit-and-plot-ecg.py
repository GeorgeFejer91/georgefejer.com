#!/usr/bin/env python3
"""Independent Study 6 analysis export ECG and label audit.

This script intentionally reads the pulled APK export from the outside. It does
not trust app-internal verifier summaries; it re-joins the lookup, raw long
tables, events, markers, wide psychometrics CSV, demographics CSV, and per-block
ECG CSVs, then writes a compact audit report plus SVG ECG plots.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
import sys
from dataclasses import dataclass
from html import escape
from pathlib import Path
from typing import Any

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover - optional local plotting dependency.
    Image = None
    ImageDraw = None
    ImageFont = None


CONDITIONS = ["HC_HE", "LC_HE", "HC_LE", "LC_LE"]
ITEM_IDS = [
    "SAM1",
    "SAM2",
    "SAM3",
    "valence",
    "arousal",
    "Anger",
    "Disgust",
    "Fear",
    "Happiness",
    "Sadness",
    "Surprise",
    "Ownership",
    "Agency",
]
REQUIRED_EVENTS = {
    "session_ready_prompt_shown",
    "session_start_confirmed",
    "block_assigned",
    "block_started",
    "audio_started",
    "condition_started",
    "audio_stopped_dev_duration",
    "condition_ended",
    "block_ecg_window_closed",
    "questionnaire_started",
    "questionnaire_completed",
    "result_write_success",
    "block_completed",
}


@dataclass
class BlockAudit:
    participant_id: str
    block_order: int
    block_id: str
    vr_condition_id: str
    block_file_stem: str
    audio_variant_id: str
    ecg_file: str
    sample_count: int
    duration_s: float
    effective_hz: float
    ecg_mean_uv: float
    ecg_sd_uv: float
    ecg_min_uv: int
    ecg_max_uv: int
    unique_values: int
    contact_quality_values: str
    first_timestamp_utc: str
    last_timestamp_utc: str


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in fieldnames})


def normalize_export_root(input_path: Path, apk_variant_id: str) -> Path:
    candidates = [
        input_path,
        input_path / "Study6DataExport" / apk_variant_id,
        input_path / apk_variant_id,
    ]
    for candidate in candidates:
        if (candidate / "analysis_ready").is_dir() and (candidate / "raw_context").is_dir():
            return candidate
    raise SystemExit(f"Could not find Study6DataExport/{apk_variant_id} under {input_path}")


def by_id(rows: list[dict[str, Any]], field: str, value: str) -> dict[str, Any]:
    for row in rows:
        if row.get(field) == value:
            return row
    raise KeyError(f"Missing {field}={value}")


def parse_int(value: str, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def parse_float(value: str, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def expected_participants(args: argparse.Namespace, allocation_state: dict[str, Any], psych_rows: list[dict[str, str]]) -> list[str]:
    if args.participants:
        return [value.strip() for value in args.participants.split(",") if value.strip()]
    completed = allocation_state.get("completed_participant_ids") or []
    if completed:
        return list(completed)
    return [row["participant_id"] for row in psych_rows if row.get("participant_id")]


def expected_blocks(lookup: dict[str, Any], apk: dict[str, Any], participant_id: str) -> list[dict[str, Any]]:
    participant = by_id(lookup["participant_allocation"], "participant_id", participant_id)
    condition_perm = by_id(lookup["condition_permutations"], "permutation_id", participant["permutation_id"])
    audio_perm = by_id(lookup["audio_permutations"], "permutation_id", participant["permutation_id"])
    blocks = []
    for condition_block in condition_perm["block_order"]:
        block_order = int(condition_block["block_order"])
        block_id = f"B{block_order:02d}"
        condition_id = condition_block["vr_condition_id"]
        audio_block = next(row for row in audio_perm["audio_order"] if int(row["block_order"]) == block_order)
        condition = by_id(lookup["conditions"], "vr_condition_id", condition_id)
        audio = by_id(lookup["audio_variants"], "audio_variant_id", audio_block["audio_variant_id"])
        stem = f"{apk['apk_file_code']}_{participant_id}_{block_id}_{condition_id}"
        blocks.append(
            {
                "participant_id": participant_id,
                "permutation_id": participant["permutation_id"],
                "allocation_row": participant.get("allocation_row"),
                "block_order": block_order,
                "block_id": block_id,
                "vr_condition_id": condition_id,
                "coherence_level": condition["coherence_level"],
                "energy_noise_level": condition["energy_noise_level"],
                "audio_variant_id": audio["audio_variant_id"],
                "audio_instruction_id": audio["audio_instruction_id"],
                "block_file_stem": stem,
            }
        )
    return blocks


def downsample(values: list[tuple[float, int]], max_points: int = 1200) -> list[tuple[float, int]]:
    if len(values) <= max_points:
        return values
    step = math.ceil(len(values) / max_points)
    return values[::step]


def make_overview_svg(participant_id: str, blocks: list[BlockAudit], series: dict[str, list[tuple[float, int]]], target: Path) -> None:
    width = 1400
    row_height = 210
    left = 170
    right = 40
    top = 50
    bottom = 35
    plot_width = width - left - right
    height = top + bottom + row_height * len(blocks)
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        f'<text x="{left}" y="28" font-family="Arial" font-size="20" font-weight="700">Study 6 ECG overview: {escape(participant_id)}</text>',
    ]
    colors = {
        "HC_HE": "#8b1e3f",
        "LC_HE": "#1f6f8b",
        "HC_LE": "#4f7d2a",
        "LC_LE": "#7b5ea7",
    }
    for index, block in enumerate(blocks):
        row_top = top + index * row_height
        mid = row_top + row_height / 2
        values = series.get(block.block_file_stem, [])
        if values:
            xs = [value[0] for value in values]
            ys = [value[1] for value in values]
            min_x, max_x = min(xs), max(xs)
            min_y, max_y = min(ys), max(ys)
            if max_y == min_y:
                max_y = min_y + 1
            if max_x == min_x:
                max_x = min_x + 1
            points = []
            for x_value, y_value in downsample(values):
                x = left + ((x_value - min_x) / (max_x - min_x)) * plot_width
                y = row_top + 20 + (1 - ((y_value - min_y) / (max_y - min_y))) * (row_height - 45)
                points.append(f"{x:.1f},{y:.1f}")
            parts.append(f'<polyline points="{" ".join(points)}" fill="none" stroke="{colors.get(block.vr_condition_id, "#333")}" stroke-width="1.3"/>')
            parts.append(f'<text x="{left + plot_width - 80}" y="{row_top + row_height - 8}" font-family="Arial" font-size="11" fill="#555">{max_x - min_x:.1f}s</text>')
            parts.append(f'<text x="{left + plot_width + 8}" y="{row_top + 32}" font-family="Arial" font-size="11" fill="#555">{max_y} uV</text>')
            parts.append(f'<text x="{left + plot_width + 8}" y="{row_top + row_height - 24}" font-family="Arial" font-size="11" fill="#555">{min_y} uV</text>')
        parts.append(f'<line x1="{left}" y1="{mid:.1f}" x2="{left + plot_width}" y2="{mid:.1f}" stroke="#dddddd" stroke-width="1"/>')
        label = f"{block.block_id} {block.vr_condition_id} n={block.sample_count} sd={block.ecg_sd_uv:.1f}"
        parts.append(f'<text x="20" y="{row_top + 42}" font-family="Arial" font-size="16" font-weight="700">{escape(label)}</text>')
        parts.append(f'<text x="20" y="{row_top + 66}" font-family="Arial" font-size="12" fill="#555">{block.duration_s:.2f}s @ {block.effective_hz:.1f} Hz</text>')
    parts.append("</svg>")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(parts), encoding="utf-8")


def make_overview_png(participant_id: str, blocks: list[BlockAudit], series: dict[str, list[tuple[float, int]]], target: Path) -> None:
    if Image is None or ImageDraw is None:
        return
    width = 1400
    row_height = 210
    left = 170
    right = 40
    top = 50
    bottom = 35
    plot_width = width - left - right
    height = top + bottom + row_height * len(blocks)
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    try:
        title_font = ImageFont.truetype("arial.ttf", 20)
        label_font = ImageFont.truetype("arial.ttf", 16)
        small_font = ImageFont.truetype("arial.ttf", 12)
    except Exception:
        title_font = label_font = small_font = None
    colors = {
        "HC_HE": (139, 30, 63),
        "LC_HE": (31, 111, 139),
        "HC_LE": (79, 125, 42),
        "LC_LE": (123, 94, 167),
    }
    draw.text((left, 18), f"Study 6 ECG overview: {participant_id}", fill=(0, 0, 0), font=title_font)
    for index, block in enumerate(blocks):
        row_top = top + index * row_height
        mid = row_top + row_height / 2
        values = series.get(block.block_file_stem, [])
        if values:
            xs = [value[0] for value in values]
            ys = [value[1] for value in values]
            min_x, max_x = min(xs), max(xs)
            min_y, max_y = min(ys), max(ys)
            if max_y == min_y:
                max_y = min_y + 1
            if max_x == min_x:
                max_x = min_x + 1
            points = []
            for x_value, y_value in downsample(values):
                x = left + ((x_value - min_x) / (max_x - min_x)) * plot_width
                y = row_top + 20 + (1 - ((y_value - min_y) / (max_y - min_y))) * (row_height - 45)
                points.append((int(x), int(y)))
            if len(points) > 1:
                draw.line(points, fill=colors.get(block.vr_condition_id, (51, 51, 51)), width=2)
            draw.text((left + plot_width - 80, row_top + row_height - 22), f"{max_x - min_x:.1f}s", fill=(85, 85, 85), font=small_font)
            draw.text((left + plot_width + 8, row_top + 24), f"{max_y} uV", fill=(85, 85, 85), font=small_font)
            draw.text((left + plot_width + 8, row_top + row_height - 36), f"{min_y} uV", fill=(85, 85, 85), font=small_font)
        draw.line((left, int(mid), left + plot_width, int(mid)), fill=(221, 221, 221), width=1)
        label = f"{block.block_id} {block.vr_condition_id} n={block.sample_count} sd={block.ecg_sd_uv:.1f}"
        draw.text((20, row_top + 30), label, fill=(0, 0, 0), font=label_font)
        draw.text((20, row_top + 56), f"{block.duration_s:.2f}s @ {block.effective_hz:.1f} Hz", fill=(85, 85, 85), font=small_font)
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target)


def audit(args: argparse.Namespace) -> int:
    export_root = normalize_export_root(Path(args.export_root).resolve(), args.apk_variant_id)
    raw_context = export_root / "raw_context"
    analysis = export_root / "analysis_ready"
    output_dir = Path(args.output_dir).resolve() if args.output_dir else export_root.parent / "ecg-independent-audit"
    output_dir.mkdir(parents=True, exist_ok=True)

    lookup = read_json(raw_context / "condition_audio_lookup.json")
    apk = by_id(lookup["apk_variants"], "apk_variant_id", args.apk_variant_id)
    allocation_state = read_json(raw_context / "allocation_state.json")
    psych_path = analysis / f"study6_{apk['apk_file_code']}_psychometrics_wide.csv"
    psych_rows = read_csv(psych_path)
    demographics_rows = read_csv(analysis / "demographics" / f"study6_{apk['apk_file_code']}_demographics.csv")
    response_rows = read_csv(raw_context / "long_form" / "questionnaire_responses_long.csv")
    marker_rows = read_csv(raw_context / "long_form" / "physiology_markers_long.csv")
    metadata_rows = read_csv(raw_context / "long_form" / "block_metadata_long.csv")

    failures: list[str] = []
    warnings: list[str] = []
    block_audits: list[BlockAudit] = []
    raw_values = {
        (row.get("participant_id"), row.get("vr_condition_id"), row.get("item_id")): row.get("item_value", "")
        for row in response_rows
    }
    psych_by_participant = {row.get("participant_id", ""): row for row in psych_rows}
    demographics_by_participant = {row.get("participant_id", ""): row for row in demographics_rows}
    markers_by_stem: dict[str, list[dict[str, str]]] = {}
    for marker in marker_rows:
        derived = marker.get("derived_block_ecg_file", "")
        if derived:
            stem = Path(derived).stem.replace("_ECG_PolarH10", "")
            markers_by_stem.setdefault(stem, []).append(marker)
    metadata_by_stem = {row.get("block_file_stem", ""): row for row in metadata_rows}
    participants = expected_participants(args, allocation_state, psych_rows)

    for participant_id in participants:
        psych_row = psych_by_participant.get(participant_id)
        if not psych_row:
            failures.append(f"{participant_id}: missing psychometrics wide row")
            continue
        demographics = demographics_by_participant.get(participant_id)
        if not demographics:
            failures.append(f"{participant_id}: missing analysis demographics row")
        elif demographics.get("polar_ready") != "true":
            failures.append(f"{participant_id}: demographics polar_ready is {demographics.get('polar_ready')}")

        plot_series: dict[str, list[tuple[float, int]]] = {}
        participant_blocks: list[BlockAudit] = []
        for block in expected_blocks(lookup, apk, participant_id):
            stem = block["block_file_stem"]
            ecg_path = analysis / "block_ecg" / f"{stem}_ECG_PolarH10.csv"
            raw_ecg_path = raw_context / "raw_files" / "data" / f"{stem}_ECG_PolarH10.csv"
            events_path = raw_context / "raw_files" / "data" / f"{stem}_events.jsonl"
            result_path = raw_context / "raw_files" / "data" / f"{stem}_questionnaire_result.json"
            metadata_path = raw_context / "raw_files" / "data" / f"{stem}_block_metadata.json"

            for path in [ecg_path, raw_ecg_path, events_path, result_path, metadata_path]:
                if not path.exists():
                    failures.append(f"{stem}: missing {path.name}")
            if ecg_path.exists() and raw_ecg_path.exists() and ecg_path.read_bytes() != raw_ecg_path.read_bytes():
                failures.append(f"{stem}: analysis ECG copy differs from raw_context ECG")

            metadata_row = metadata_by_stem.get(stem)
            if not metadata_row:
                failures.append(f"{stem}: missing block_metadata_long row")
            else:
                for field in ["participant_id", "block_id", "vr_condition_id", "audio_variant_id"]:
                    expected = str(block[field])
                    observed = metadata_row.get(field, "")
                    if observed != expected:
                        failures.append(f"{stem}: block_metadata_long {field} expected {expected} observed {observed}")

            if result_path.exists():
                result = read_json(result_path)
                if result.get("participant_id") != participant_id or result.get("block_id") != block["block_id"] or result.get("vr_condition_id") != block["vr_condition_id"]:
                    failures.append(f"{stem}: questionnaire result identity mismatch")

            if events_path.exists():
                events = read_jsonl(events_path)
                event_types = {event.get("event_type") for event in events}
                missing = REQUIRED_EVENTS - event_types
                if missing:
                    failures.append(f"{stem}: missing events {sorted(missing)}")
                for event in events:
                    if event.get("block_file_stem") and event.get("block_file_stem") != stem:
                        failures.append(f"{stem}: event block_file_stem mismatch {event.get('block_file_stem')}")
                    if event.get("vr_condition_id") and event.get("vr_condition_id") != block["vr_condition_id"]:
                        failures.append(f"{stem}: event {event.get('event_type')} condition mismatch {event.get('vr_condition_id')}")

            block_markers = markers_by_stem.get(stem, [])
            marker_types = {marker.get("event_type") for marker in block_markers}
            missing_markers = REQUIRED_EVENTS - marker_types
            if missing_markers:
                failures.append(f"{stem}: missing marker events {sorted(missing_markers)}")
            for marker in block_markers:
                for field in ["participant_id", "block_id", "vr_condition_id", "audio_variant_id"]:
                    expected = str(block[field])
                    observed = marker.get(field, "")
                    if observed != expected:
                        failures.append(f"{stem}: marker {marker.get('event_type')} {field} expected {expected} observed {observed}")

            for item_id in ITEM_IDS:
                column = f"{block['vr_condition_id']}_{item_id}"
                expected_value = raw_values.get((participant_id, block["vr_condition_id"], item_id))
                observed_value = psych_row.get(column)
                if expected_value != observed_value:
                    failures.append(f"{participant_id}: wide {column} expected raw {expected_value} observed {observed_value}")

            ecg_rows = read_csv(ecg_path)
            if not ecg_rows:
                failures.append(f"{stem}: ECG has no rows")
                continue

            sample_indices = [parse_int(row.get("sample_index", "")) for row in ecg_rows]
            polar_timestamps = [parse_int(row.get("polar_sample_timestamp_ns", "")) for row in ecg_rows]
            elapsed = [parse_int(row.get("host_received_elapsed_realtime_ns", "")) for row in ecg_rows]
            ecg_values = [parse_int(row.get("ecg_raw", "")) for row in ecg_rows]
            if any(value <= 0 for value in sample_indices):
                failures.append(f"{stem}: ECG sample_index has non-positive values")
            if any(sample_indices[i] <= sample_indices[i - 1] for i in range(1, len(sample_indices))):
                failures.append(f"{stem}: ECG sample_index is not strictly increasing")
            if any(polar_timestamps[i] < polar_timestamps[i - 1] for i in range(1, len(polar_timestamps))):
                failures.append(f"{stem}: polar timestamps are not monotonic")
            if any(elapsed[i] < elapsed[i - 1] for i in range(1, len(elapsed))):
                failures.append(f"{stem}: host elapsed timestamps are not monotonic")
            for row in ecg_rows[: min(50, len(ecg_rows))]:
                if row.get("participant_id") != participant_id or row.get("block_id") != block["block_id"] or row.get("vr_condition_id") != block["vr_condition_id"]:
                    failures.append(f"{stem}: ECG row identity mismatch")
                    break
                if row.get("device_id", "") in {"", "not_connected"}:
                    failures.append(f"{stem}: ECG device_id missing")
                    break

            duration_s = (polar_timestamps[-1] - polar_timestamps[0]) / 1_000_000_000 if len(polar_timestamps) > 1 else 0.0
            effective_hz = len(ecg_rows) / duration_s if duration_s > 0 else 0.0
            sd = statistics.pstdev(ecg_values) if len(ecg_values) > 1 else 0.0
            unique_values = len(set(ecg_values))
            if len(ecg_rows) < args.min_samples:
                failures.append(f"{stem}: ECG sample count {len(ecg_rows)} below {args.min_samples}")
            if not (args.min_duration_s <= duration_s <= args.max_duration_s):
                failures.append(f"{stem}: ECG duration {duration_s:.2f}s outside {args.min_duration_s}-{args.max_duration_s}s")
            if not (args.min_effective_hz <= effective_hz <= args.max_effective_hz):
                failures.append(f"{stem}: ECG effective Hz {effective_hz:.1f} outside {args.min_effective_hz}-{args.max_effective_hz}")
            if sd < args.min_ecg_sd:
                failures.append(f"{stem}: ECG sd {sd:.2f} suggests flat or placeholder data")
            if unique_values < args.min_unique_values:
                failures.append(f"{stem}: ECG unique value count {unique_values} below {args.min_unique_values}")

            contact_values = sorted(set(row.get("contact_quality", "") for row in ecg_rows))
            offsets = [
                ((parse_int(row.get("polar_sample_timestamp_ns", "")) - polar_timestamps[0]) / 1_000_000_000, parse_int(row.get("ecg_raw", "")))
                for row in ecg_rows
            ]
            plot_series[stem] = offsets
            audit_row = BlockAudit(
                participant_id=participant_id,
                block_order=int(block["block_order"]),
                block_id=block["block_id"],
                vr_condition_id=block["vr_condition_id"],
                block_file_stem=stem,
                audio_variant_id=block["audio_variant_id"],
                ecg_file=ecg_path.name,
                sample_count=len(ecg_rows),
                duration_s=duration_s,
                effective_hz=effective_hz,
                ecg_mean_uv=statistics.fmean(ecg_values),
                ecg_sd_uv=sd,
                ecg_min_uv=min(ecg_values),
                ecg_max_uv=max(ecg_values),
                unique_values=unique_values,
                contact_quality_values="|".join(contact_values),
                first_timestamp_utc=ecg_rows[0].get("host_received_timestamp_utc", ""),
                last_timestamp_utc=ecg_rows[-1].get("host_received_timestamp_utc", ""),
            )
            block_audits.append(audit_row)
            participant_blocks.append(audit_row)

        make_overview_svg(participant_id, participant_blocks, plot_series, output_dir / "plots" / f"{participant_id}_ecg_overview.svg")
        make_overview_png(participant_id, participant_blocks, plot_series, output_dir / "plots" / f"{participant_id}_ecg_overview.png")

    metric_rows = [row.__dict__ for row in block_audits]
    fieldnames = list(BlockAudit.__dataclass_fields__.keys())
    write_csv(output_dir / "ecg_block_metrics.csv", metric_rows, fieldnames)
    report = {
        "pass": not failures,
        "export_root": str(export_root),
        "apk_variant_id": args.apk_variant_id,
        "participants": participants,
        "participant_count": len(participants),
        "block_count": len(block_audits),
        "failures": failures,
        "warnings": warnings,
        "plots_dir": str(output_dir / "plots"),
        "metrics_csv": str(output_dir / "ecg_block_metrics.csv"),
    }
    (output_dir / "ecg_audit_report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if failures:
        print(json.dumps(report, indent=2), file=sys.stderr)
        return 1
    print(f"Study 6 independent ECG audit passed: {len(participants)} participants, {len(block_audits)} blocks.")
    print(output_dir / "ecg_audit_report.json")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit and plot Study 6 ECG analysis export.")
    parser.add_argument("export_root", help="Study6DataExport folder or Study6DataExport/<variant> folder")
    parser.add_argument("--apk-variant-id", default="BG_ENV")
    parser.add_argument("--participants", default="", help="Optional comma-separated participant IDs")
    parser.add_argument("--output-dir", default="")
    parser.add_argument("--min-samples", type=int, default=1800)
    parser.add_argument("--min-duration-s", type=float, default=15.0)
    parser.add_argument("--max-duration-s", type=float, default=25.5)
    parser.add_argument("--min-effective-hz", type=float, default=90.0)
    parser.add_argument("--max-effective-hz", type=float, default=150.0)
    parser.add_argument("--min-ecg-sd", type=float, default=20.0)
    parser.add_argument("--min-unique-values", type=int, default=50)
    args = parser.parse_args()
    return audit(args)


if __name__ == "__main__":
    raise SystemExit(main())
