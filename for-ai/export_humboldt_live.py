"""Export the Humboldt PowerPoint into a static browser deck using desktop PowerPoint."""

import argparse
from collections import Counter
from hashlib import sha256
from pathlib import Path
from posixpath import join, normpath
from tempfile import TemporaryDirectory
from xml.etree import ElementTree as XML
from zipfile import ZipFile
import json
import shutil
import subprocess
from urllib.parse import urlparse

import numpy as np
from PIL import Image, ImageChops
import pythoncom
from pywintypes import com_error
import win32com.client


P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
CANVAS = (1920, 1080)
EMU_TO_PIXEL = 2 / 12700
TITLES = (
    "Altered States of Viscereality", "1. VR as an Experiential Medium", "Immersion",
    "Which view feels more real?", "Presence", "First-person perspective",
    "2. Perceptual Mechanisms", "Sense of a bodily self", "Top-down expectations",
    "Bottom-up sensory information", "Prediction error", "Instant perceptual learning",
    "Synchrony detection", "The illusion varies by person", "Dimensions of self-experience",
    "Narrative self and minimal self", "3. Perspective, Self-Location, and Body Ownership",
    "Body swap illusions and out-of-body experiences", "Front stroking", "Back stroking",
    "Dimensions of bodily self-consciousness", "Body ownership", "First-person perspective",
    "Self-location", "Front-stroking full-body illusion", "Disownership",
    "Back-stroking full-body illusion", "Front stroking and back stroking",
    "The Library of Ourselves", "Viscereality in Motion", "4. Altered States of Viscereality",
    "Peripersonal Space", "Coupling Breath to Virtual Space", "Testing the Felt Boundaries of the Body",
    "Box-Breathing Entrainment", "Felt Extent of Self", "Thank you for your attention.",
)


def rels(archive, path, external=False):
    if path not in archive.namelist():
        return {}
    return {node.attrib["Id"]: node.attrib["Target"] for node in XML.fromstring(archive.read(path))
            if (node.get("TargetMode") == "External") == external}


def props(node):
    return next((item for parent in node for item in parent if item.tag == P + "cNvPr"), None)


def absolute_box(transform, transform_parent):
    if transform is None:
        return None
    offset, extent = transform.find(A + "off"), transform.find(A + "ext")
    if offset is None or extent is None:
        return None
    sx, sy, tx, ty = transform_parent
    return [sx * int(offset.get("x")) + tx, sy * int(offset.get("y")) + ty,
            sx * int(extent.get("cx")), sy * int(extent.get("cy"))]


def embedded_gifs(node, assets, parent=(1, 1, 0, 0)):
    if node.tag == P + "grpSp":
        xfrm = node.find(f"{P}grpSpPr/{A}xfrm")
        box = absolute_box(xfrm, parent)
        offset, extent = xfrm.find(A + "chOff"), xfrm.find(A + "chExt")
        sx, sy = box[2] / int(extent.get("cx")), box[3] / int(extent.get("cy"))
        child_parent = (sx, sy, box[0] - sx * int(offset.get("x")), box[1] - sy * int(offset.get("y")))
        return [gif for child in node for gif in embedded_gifs(child, assets, child_parent)]
    if node.tag != P + "pic":
        return []
    blip = node.find(f"{P}blipFill/{A}blip")
    part = assets.get(blip.get(R + "embed")) if blip is not None else None
    if not part or not part.endswith(".gif"):
        return []
    xfrm = node.find(f"{P}spPr/{A}xfrm")
    box = absolute_box(xfrm, parent)
    if not box:
        return []
    crop = node.find(f"{P}blipFill/{A}srcRect")
    return [{
        "id": int(props(node).get("id")),
        "src": Path(part).name,
        "box": [round(value * EMU_TO_PIXEL, 2) for value in box],
        "crop": [int(crop.get(key, "0")) / 100000 if crop is not None else 0
                 for key in ("l", "t", "r", "b")],
    }]


def has_model_animation(archive, part):
    with archive.open(part) as stream:
        header = stream.read(20)
        if header[:4] != b"glTF" or header[16:20] != b"JSON":
            return False
        return bool(json.loads(stream.read(int.from_bytes(header[12:16], "little"))).get("animations"))


def read_source(archive):
    package = XML.fromstring(archive.read("ppt/presentation.xml"))
    parent_rels = rels(archive, "ppt/_rels/presentation.xml.rels")
    inventory = []
    for item in package.find(P + "sldIdLst"):
        path = normpath(join("ppt", parent_rels[item.attrib[R + "id"]]))
        directory, name = path.rsplit("/", 1)
        assets = {rid: normpath(join(directory, part))
                  for rid, part in rels(archive, f"{directory}/_rels/{name}.rels").items()}
        links = rels(archive, f"{directory}/_rels/{name}.rels", external=True)
        slide = XML.fromstring(archive.read(path))
        shapes = {}
        for node in slide.find(f"{P}cSld/{P}spTree"):
            if node.tag.endswith("}AlternateContent"):
                node = node[0][0]
            identity = props(node)
            if identity is None:
                continue
            shape_name = identity.get("name", "")
            blip = node.find(f"{P}blipFill/{A}blip")
            image = assets.get(blip.get(R + "embed")) if blip is not None else None
            text = "".join(t.text or "" for t in node.iter(A + "t")).strip()
            named = shape_name.startswith("!!")
            key = (shape_name if named else image if image else f"text:{text}" if len(text) > 8 else None)
            videos = [assets.get(e.get(R + "embed"), "") for e in node.iter()
                      if e.tag.rsplit("}", 1)[-1] == "media"]
            video = next((Path(p).name for p in videos if p.endswith(".mp4")), None)
            audio = next((Path(p).name for p in videos if p.endswith(".wav")), None)
            model = next((assets[e.get(R + "embed")] for e in node.iter()
                          if e.tag.endswith("}model3d") and e.get(R + "embed") in assets), None)
            online = next((links.get(e.get(R + "link"), "") for e in node.iter(A + "videoFile")), "")
            youtube = urlparse(online)
            youtube_id = (youtube.path.removeprefix("/embed/") if youtube.hostname == "www.youtube.com"
                          and youtube.path.startswith("/embed/") else None)
            link = next((links.get(e.get(R + "id")) for e in node.iter(A + "hlinkClick")
                         if links.get(e.get(R + "id"), "").startswith("https://")), None)
            shapes[int(identity.get("id"))] = {
                "key": key, "named": named, "video": video, "label": shape_name,
                "gifs": embedded_gifs(node, assets), "audio": audio, "model": Path(model).name if model else None,
                "animated_model": bool(model and has_model_animation(archive, model)),
                "youtube": youtube_id, "link": link, "text": text,
            }
        for scale in slide.iter(P + "animScale"):
            target = scale.find(f"{P}cBhvr/{P}tgtEl/{P}spTgt")
            by = scale.find(P + "by")
            if target is not None and by is not None and int(target.get("spid")) in shapes:
                shapes[int(target.get("spid"))]["zoom"] = [int(by.get(axis)) / 100000 for axis in ("x", "y")]
        keys = Counter(s["key"] for s in shapes.values())
        for shape in shapes.values():
            if keys[shape["key"]] > 1:
                shape["key"] = None
        inventory.append(shapes)
    return inventory


def animations(slide, metadata):
    groups, on_enter = [], []
    sequence = slide.TimeLine.MainSequence
    for index in range(1, sequence.Count + 1):
        effect = sequence(index)
        spec = metadata[effect.Shape.Id]
        if spec.get("model"):
            continue
        if effect.Timing.TriggerType == 1:
            groups.append([])
        kind = effect.EffectType
        command = ("play" if kind == 83 else "pause" if kind in (84, 85) else
                   "zoom" if kind == 59 and metadata[effect.Shape.Id].get("zoom") else
                   "hide" if effect.Exit else "show")
        cue = {
            "id": effect.Shape.Id,
            "action": command,
            "effect": kind,
            "duration": round(effect.Timing.Duration, 3),
        }
        if command == "zoom":
            cue["scale"] = metadata[cue["id"]]["zoom"]
        (groups[-1] if groups else on_enter).append(cue)
    return groups, on_enter


def overlaps(a, b):
    return (a[0] < b[0]+b[2] and b[0] < a[0]+a[2]
            and a[1] < b[1]+b[3] and b[1] < a[1]+a[3])


def display_box(shape):
    return [2 * value for value in (shape.Left, shape.Top, shape.Width, shape.Height)]


def gif_children(shape, targets):
    if shape.Id in targets:
        yield shape
    if shape.Type == 6:
        for index in range(1, shape.GroupItems.Count + 1):
            yield from gif_children(shape.GroupItems(index), targets)


def slide_png(slide, path):
    slide.Export(str(path), "PNG", *CANVAS)
    with Image.open(path) as image:
        return image.convert("RGB")


def align_sprite(sprite, box, empty, isolated):
    alpha_box = sprite.getchannel("A").getbbox()
    if not alpha_box:
        return None
    delta = np.asarray(ImageChops.difference(empty, isolated))
    changed = np.where(np.max(delta, axis=2) > 6)
    left = round(box[0] + (box[2] - sprite.width) / 2)
    top = round(box[1] + (box[3] - sprite.height) / 2)
    if len(changed[0]):
        def position(first, last, limit, low, high, guess):
            possible = []
            if first > 1:
                possible.append(first - low)
            if last < limit - 2:
                possible.append(last + 1 - high)
            return round(sum(possible) / len(possible)) if possible and all(
                abs(p - guess) <= 45 for p in possible) else guess
        left = position(int(changed[1].min()), int(changed[1].max()), CANVAS[0],
                        alpha_box[0], alpha_box[2], left)
        top = position(int(changed[0].min()), int(changed[0].max()), CANVAS[1],
                       alpha_box[1], alpha_box[3], top)
    return sprite.crop(alpha_box), [left + alpha_box[0], top + alpha_box[1],
                                    alpha_box[2] - alpha_box[0], alpha_box[3] - alpha_box[1]]


def save_sprite(image, output, work):
    image.save(work, "WEBP", lossless=True, method=3)
    key = sha256(work.read_bytes()).hexdigest()[:20] + ".webp"
    target = output / key
    if not target.exists():
        shutil.copyfile(work, target)
    return key


def extract_sprite(shape, box, empty, isolated, path):
    """Use the in-place raster when a shape export changes the painted geometry."""
    try:
        shape.Export(str(path), 2, 1440, 810, 1)
        with Image.open(path) as raw:
            candidate = align_sprite(raw.convert("RGBA"), box, empty, isolated)
    except com_error:
        candidate = None
    if candidate is not None:
        sprite, bounds = candidate
        reconstructed = empty.convert("RGBA")
        reconstructed.alpha_composite(sprite, dest=tuple(bounds[:2]))
        error = np.asarray(ImageChops.difference(reconstructed.convert("RGB"), isolated)).mean()
        if error < .18:
            return candidate
    delta = ImageChops.difference(empty, isolated).convert("L").point(lambda value: 255 if value else 0)
    bounds = delta.getbbox()
    if bounds is None:
        return candidate
    sprite = isolated.crop(bounds).convert("RGBA")
    sprite.putalpha(delta.crop(bounds))
    x, y, right, bottom = bounds
    return sprite, [x, y, right - x, bottom - y]


def export_slide(slide, index, inventory, output, scratch):
    metadata = inventory[index]
    shapes = [slide.Shapes(i) for i in range(1, slide.Shapes.Count + 1)]
    geometry = {s.Id: display_box(s) for s in shapes}
    steps, enter = animations(slide, metadata)
    cue_ids = {cue["id"] for group in [enter, *steps] for cue in group}
    previous_keys = {s["key"] for s in inventory[index - 1].values()} if index else set()
    next_keys = {s["key"] for s in inventory[index + 1].values()} if index + 1 < len(inventory) else set()
    neighbors = previous_keys | next_keys
    selected = {sid for sid, data in metadata.items() if (
        sid in cue_ids or any(data[k] for k in ("video", "audio", "model", "youtube", "gifs"))
        or (data["key"] and data["key"] in neighbors))}
    for shape in shapes:
        if any(previous.Id in selected and overlaps(geometry[previous.Id], geometry[shape.Id])
               for previous in shapes[:shape.ZOrderPosition - 1]):
            selected.add(shape.Id)

    visibility = {s.Id: s.Visible for s in shapes}
    initial_hidden = {cue["id"] for group in steps for cue in group if cue["action"] == "show"}
    for shape in shapes:
        if shape.Id in initial_hidden:
            shape.Visible = 0
    reference = slide_png(slide, scratch / "reference.png")
    for shape in shapes:
        shape.Visible = visibility[shape.Id]
    for shape in shapes:
        if shape.Id in selected:
            shape.Visible = 0
    background = slide_png(slide, scratch / "background.png")
    background_name = f"slide-{index + 1:02}.webp"
    background.save(output / background_name, "WEBP", quality=92, method=4)
    for shape in shapes:
        shape.Visible = 0
    empty = slide_png(slide, scratch / "empty.png") if selected else None
    layers, links = [], []
    check = background.convert("RGBA")
    for shape in shapes:
        sid = shape.Id
        spec = metadata.get(sid, {})
        if spec.get("link") and overlaps(geometry[sid], [0, 0, *CANVAS]):
            links.append({"box": geometry[sid], "href": spec["link"], "text": spec["text"] or spec["link"]})
        if sid not in selected or not visibility[sid]:
            continue
        shape.Visible = -1
        gif_layers = spec.get("gifs", [])
        bare_gif = len(gif_layers) == 1 and gif_layers[0]["id"] == sid
        if not bare_gif:
            nested = list(gif_children(shape, {gif["id"] for gif in gif_layers}))
            for child in nested:
                child.Visible = 0
        if spec.get("video") and not overlaps(geometry[sid], [0, 0, *CANVAS]):
            layers.append({"id": sid, "video": spec["video"], "label": spec["label"], "offstage": True})
            shape.Visible = 0
            continue

        isolated = slide_png(slide, scratch / "isolated.png")
        aligned = extract_sprite(shape, geometry[sid], empty, isolated, scratch / "shape.png")
        if not bare_gif:
            for child in nested:
                child.Visible = -1
        shape.Visible = 0
        if aligned is None:
            if spec.get("audio") or spec.get("animated_model") or spec.get("youtube"):
                media = {k: spec[k] for k in ("audio", "youtube") if spec.get(k)}
                if spec.get("animated_model"):
                    media["model"] = spec["model"]
                layers.append({"id": sid, "box": geometry[sid], "mediaBox": geometry[sid],
                               "label": spec["label"], **media})
                continue
            if gif_layers:
                layers.append({"id": sid, "box": geometry[sid], "gifs": gif_layers,
                               **({"key": spec["key"]} if spec.get("key") else {})})
                continue
            if sid in cue_ids:
                raise ValueError(f"Animation object {sid} on slide {index+1} has no visible pixels")
            continue
        sprite, box = aligned
        layer = {"id": sid, "box": box, "src": save_sprite(sprite, output, scratch / "sprite.webp")}
        if spec.get("key"):
            layer["key"] = spec["key"]
        if gif_layers:
            layer["gifs"] = gif_layers
        if spec.get("video"):
            layer.update({"video": spec["video"], "label": spec["label"], "videoBox": geometry[sid]})
            if spec["video"] == "media6.mp4":
                layer["loop"] = True
        for kind in ("audio", "youtube"):
            if spec.get(kind):
                layer.update({kind: spec[kind], "mediaBox": geometry[sid], "label": spec["label"]})
        if spec.get("animated_model"):
            layer.update({"model": spec["model"], "mediaBox": geometry[sid], "label": spec["label"]})
        if sid in initial_hidden:
            layer["hidden"] = True
        elif not bare_gif and overlaps(box, [0, 0, *CANVAS]):
            check.alpha_composite(sprite, dest=(box[0], box[1]))
        layers.append(layer)
    for shape in shapes:
        shape.Visible = visibility[shape.Id]
    error = np.asarray(ImageChops.difference(check.convert("RGB"), reference)).mean()
    print(f"Slide {index+1:02}: {len(layers):2} layers, {len(steps):2} cues, "
          f"initial raster difference {error:.2f}/255", flush=True)
    return {"title": TITLES[index], "duration": round(slide.SlideShowTransition.Duration * 1000),
            "background": background_name, "layers": layers, "steps": steps, "onEnter": enter, "links": links}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    with ZipFile(args.source) as archive, TemporaryDirectory() as scratch:
        inventory = read_source(archive)
        used = {asset for slide in inventory for spec in slide.values()
                for asset in [spec["video"], spec["audio"], spec["model"] if spec["animated_model"] else None,
                              *(gif["src"] for gif in spec["gifs"])] if asset}
        for path in archive.namelist():
            filename = Path(path).name
            if not path.startswith("ppt/media/") or filename not in used:
                continue
            target = output / filename
            if path.endswith(".mp4"):
                extracted = Path(scratch) / filename
                extracted.write_bytes(archive.read(path))
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(extracted), "-c", "copy",
                                "-movflags", "+faststart", str(target)], check=True)
            else:
                target.write_bytes(archive.read(path))
            if path.endswith(".gif"):
                with Image.open(target) as image:
                    image.convert("RGBA").save(target.with_suffix(".webp"), "WEBP", lossless=True)

    pythoncom.CoInitialize()
    app = win32com.client.DispatchEx("PowerPoint.Application")
    deck = app.Presentations.Open(str(args.source.resolve()), -1, -1, 0)
    try:
        assert deck.Slides.Count == len(inventory) == len(TITLES)
        assert all(deck.Slides(i + 1).SlideShowTransition.EntryEffect == 3954 for i in range(len(inventory)))
        with TemporaryDirectory() as scratch:
            slides = [export_slide(deck.Slides(i + 1), i, inventory, output, Path(scratch))
                      for i in range(len(inventory))]
        (output / "deck.json").write_text(json.dumps(slides, ensure_ascii=False, separators=(",", ":")) + "\n",
                                          encoding="utf-8", newline="\n")
    finally:
        deck.Saved = True
        deck.Close()
        if app.Presentations.Count == 0:
            app.Quit()


if __name__ == "__main__":
    main()
