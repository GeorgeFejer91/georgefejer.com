#!/usr/bin/env python3
"""Rebuild questionnaire PDFs from source PDFs with answer circles.

This is an operator script and intentionally lives in for-ai. It starts from
source packet PDFs that still contain the A-H answer circles and correct MAIA
wording, then patches the labels/instructions and overlays larger spatial-page
text above the pictograph plus a clear X-in-circle response prompt.
"""

from __future__ import annotations

import argparse
import io
import json
import subprocess
import sys
from pathlib import Path

import pdfplumber
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream, TextStringObject
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


PDF_FILES = {
    "print_questionnaire_packet_english.pdf": {"pages": 4, "lang": "en"},
    "print_questionnaire_packet_german.pdf": {"pages": 4, "lang": "de"},
    "spatial_frame_of_reference_questionnaire_blocks.pdf": {"pages": 2, "lang": "en"},
    "spatial_frame_of_reference_questionnaire_blocks_english.pdf": {"pages": 2, "lang": "en"},
    "spatial_frame_of_reference_questionnaire_blocks_german.pdf": {"pages": 2, "lang": "de"},
}

SPATIAL_PARAGRAPHS = {
    "en": (
        "During the VR session you just experienced, how far did your sense of self "
        "extend into the surrounding world? Using the letters and images below, "
        "please indicate how much your SELF felt as if it extended beyond your "
        "physical body. A means your self stopped at your physical body; letters "
        "farther outward indicate greater self-extension into the surrounding space. "
        "The rings are symbolic and do not represent actual distances. Please draw "
        "an X inside one answer circle."
    ),
    "de": (
        "W\u00e4hrend der VR-Sitzung, die Sie gerade erlebt haben, wie weit dehnte "
        "sich Ihr Gef\u00fchl des Selbst in die umgebende Welt aus? Verwenden Sie die "
        "unten stehenden Buchstaben und Bilder, um anzugeben, in welchem Ausma\u00df "
        "sich Ihr SELBST \u00fcber Ihren physischen K\u00f6rper hinaus ausgedehnt "
        "anf\u00fchlte. A bedeutet, dass Ihr Selbst bei Ihrem physischen K\u00f6rper "
        "endete; Buchstaben weiter au\u00dfen zeigen eine st\u00e4rkere Ausdehnung des "
        "Selbst in den umgebenden Raum an. Die Ringe sind symbolisch und stellen "
        "keine tats\u00e4chlichen Entfernungen dar. Bitte setzen Sie ein X in einen "
        "Antwortkreis."
    ),
}

RESPONSE_LABELS = {
    "en": "Response - draw an X inside one circle:",
    "de": "Antwort - X in einen Kreis setzen:",
}

HEADER_LABEL_REPLACEMENTS = {
    "Participant ID": "Name",
    "Teilnehmenden-ID": "Name",
    "Date": "Participant No.",
    "Datum": "Teilnehmenden-Nr.",
    "Time": "Date",
    "Uhrzeit": "Datum",
}

OBSOLETE_PHRASES = [
    "participant id",
    "teilnehmenden-id",
    "date time",
    "datum uhrzeit",
    "uhrzeit",
    "please circle",
    "circle one",
    "bitte kreisen",
    "einkreisen",
]

MOJIBAKE_MARKERS = [
    "\ufffd",
    "\u00c3",
    "\u00c2",
    "\u00e2\u20ac",
]

GERMAN_ASSET_SENTINELS = [
    "K\u00f6rper",
    "f\u00fchle",
    "unangenehm",
    "Aufmerksamkeit",
]

GERMAN_PDF_SENTINELS = [
    "W\u00e4hrend",
    "Gef\u00fchl",
    "Ausma\u00df",
    "K\u00f6rper",
    "\u00fcber",
    "au\u00dfen",
]

ASSET_ENCODING_FILES = [
    Path("content/maia2/de.json"),
    Path("content/maia2/en.json"),
    Path("content/spatial-frame-reference-pictograph.json"),
]

_PDF_FONTS: tuple[str, str] | None = None


def configure_stdio() -> None:
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream is not None and hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")


def repo_root() -> Path:
    return Path(
        subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()
    )


def escaped(text: str) -> str:
    return text.encode("unicode_escape").decode("ascii")


def validate_no_mojibake(context: str, text: str) -> None:
    found = [escaped(marker) for marker in MOJIBAKE_MARKERS if marker in text]
    if found:
        raise ValueError(f"{context}: found mojibake markers: {', '.join(found)}")


def validate_asset_encoding(asset_root: Path) -> None:
    if not asset_root.exists():
        print(f"asset encoding check skipped; missing {asset_root}")
        return

    checked = 0
    for relative_path in ASSET_ENCODING_FILES:
        path = asset_root / relative_path
        if not path.exists():
            continue
        data = path.read_bytes()
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError as error:
            raise ValueError(f"{path}: not valid UTF-8") from error
        validate_no_mojibake(str(path), text)
        if path.suffix == ".json":
            json.loads(text)
        if relative_path.as_posix() == "content/maia2/de.json":
            missing = [escaped(term) for term in GERMAN_ASSET_SENTINELS if term not in text]
            if missing:
                raise ValueError(f"{path}: missing expected German UTF-8 terms: {', '.join(missing)}")
        checked += 1

    if checked:
        print(f"validated UTF-8 source assets in {asset_root}")
    else:
        print(f"asset encoding check skipped; no expected files in {asset_root}")


def register_pdf_fonts() -> tuple[str, str]:
    global _PDF_FONTS
    if _PDF_FONTS is not None:
        return _PDF_FONTS

    font_pairs = [
        (Path(r"C:\Windows\Fonts\arial.ttf"), Path(r"C:\Windows\Fonts\arialbd.ttf")),
        (Path(r"C:\Windows\Fonts\calibri.ttf"), Path(r"C:\Windows\Fonts\calibrib.ttf")),
    ]
    for regular_path, bold_path in font_pairs:
        if not regular_path.exists() or not bold_path.exists():
            continue
        try:
            pdfmetrics.registerFont(TTFont("QuestionnaireSans", str(regular_path)))
            pdfmetrics.registerFont(TTFont("QuestionnaireSans-Bold", str(bold_path)))
        except Exception:
            continue
        _PDF_FONTS = ("QuestionnaireSans", "QuestionnaireSans-Bold")
        return _PDF_FONTS

    _PDF_FONTS = ("Helvetica", "Helvetica-Bold")
    return _PDF_FONTS


def read_blob(root: Path, ref: str, source_dir: str, filename: str) -> bytes:
    source_path = f"{source_dir.rstrip('/')}/{filename}"
    return subprocess.check_output(["git", "show", f"{ref}:{source_path}"], cwd=root)


def close(a: object, b: float, tolerance: float = 0.05) -> bool:
    return abs(float(a) - b) <= tolerance


def text_value(operands: list[object]) -> str:
    return str(operands[0]) if operands else ""


def is_spatial_page(cs: ContentStream) -> bool:
    return any(
        operator == b"Tj" and text_value(operands) in {"Block 1", "Block 2"}
        for operands, operator in cs.operations
    )


def should_blank_at_position(last_tm: tuple[float, float] | None) -> bool:
    if last_tm is None:
        return False
    x, y = last_tm
    return close(x, 30) and (700 <= y <= 746 or close(y, 173))


def is_header_label_position(last_tm: tuple[float, float] | None) -> bool:
    if last_tm is None:
        return False
    _, y = last_tm
    return y > 760


def patch_content_stream(page, pdf_context: PdfReader | PdfWriter) -> bool:
    cs = ContentStream(page.get_contents(), pdf_context)
    spatial = is_spatial_page(cs)

    last_tm: tuple[float, float] | None = None
    for operands, operator in cs.operations:
        if operator == b"Tm" and len(operands) >= 6:
            last_tm = (float(operands[4]), float(operands[5]))
            continue
        if operator != b"Tj" or not operands:
            continue
        text = text_value(operands)
        if is_header_label_position(last_tm) and text in HEADER_LABEL_REPLACEMENTS:
            operands[0] = TextStringObject(HEADER_LABEL_REPLACEMENTS[text])
        elif spatial and should_blank_at_position(last_tm):
            operands[0] = TextStringObject("")

    page.replace_contents(cs)
    return spatial


def overlay_spatial_text(page, lang: str) -> None:
    width = float(page.mediabox.width)
    height = float(page.mediabox.height)
    packet = io.BytesIO()
    pdf = canvas.Canvas(packet, pagesize=(width, height))
    regular_font, bold_font = register_pdf_fonts()

    pdf.setFillColorRGB(0.066667, 0.066667, 0.066667)
    pdf.setFont(regular_font, 10.8)
    lines = simpleSplit(SPATIAL_PARAGRAPHS[lang], regular_font, 10.8, width - 60)
    y = 745.9
    for line in lines:
        pdf.drawString(30, y, line)
        y -= 12.8

    pdf.setFont(bold_font, 12.0)
    pdf.drawString(30, 173, RESPONSE_LABELS[lang])
    pdf.save()

    packet.seek(0)
    overlay = PdfReader(packet).pages[0]
    page.merge_page(overlay)


def rebuild_pdf(filename: str, source_bytes: bytes) -> bytes:
    lang = PDF_FILES[filename]["lang"]
    reader = PdfReader(io.BytesIO(source_bytes))
    writer = PdfWriter(clone_from=reader)

    for page in writer.pages:
        spatial = patch_content_stream(page, writer)
        if spatial:
            overlay_spatial_text(page, lang)

    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def extract_text(pdf_bytes: bytes) -> tuple[int, str]:
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        return len(pdf.pages), text


def validate_pdf(filename: str, pdf_bytes: bytes) -> None:
    expected = PDF_FILES[filename]
    page_count, text = extract_text(pdf_bytes)
    if page_count != expected["pages"]:
        raise ValueError(f"{filename}: expected {expected['pages']} pages, found {page_count}")

    lowered = text.lower()
    validate_no_mojibake(filename, text)
    bad_terms = [phrase for phrase in OBSOLETE_PHRASES if phrase in lowered]
    if bad_terms:
        raise ValueError(f"{filename}: found obsolete wording: {', '.join(bad_terms)}")

    required = ["Name", "Block 1", "Block 2", "X"]
    if expected["lang"] == "en":
        required.extend(["Participant No.", "Date", "answer circle", RESPONSE_LABELS["en"]])
    else:
        required.extend(["Teilnehmenden-Nr.", "Datum", "Antwortkreis", RESPONSE_LABELS["de"]])
        required.extend(GERMAN_PDF_SENTINELS)

    missing = [phrase for phrase in required if phrase not in text]
    if missing:
        raise ValueError(f"{filename}: missing required text: {', '.join(missing)}")


def main() -> None:
    configure_stdio()
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-ref", default="HEAD")
    parser.add_argument("--source-dir", default="print2")
    parser.add_argument("--asset-root")
    parser.add_argument("--skip-asset-encoding-check", action="store_true")
    args = parser.parse_args()

    root = repo_root()
    output_dir = Path(__file__).resolve().parent.parent
    asset_root = Path(args.asset_root) if args.asset_root else root.parent / "maia2-spatial-frame-questionnaire-assets"

    if not args.skip_asset_encoding_check:
        validate_asset_encoding(asset_root)

    for filename in PDF_FILES:
        source_bytes = read_blob(root, args.source_ref, args.source_dir, filename)
        rebuilt = rebuild_pdf(filename, source_bytes)
        validate_pdf(filename, rebuilt)
        target = output_dir / filename
        target.write_bytes(rebuilt)
        print(f"updated {target.relative_to(root)} ({len(rebuilt)} bytes)")


if __name__ == "__main__":
    main()
