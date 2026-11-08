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

import numpy as np
from PIL import Image, ImageChops
import pythoncom
import win32com.client


P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
SOURCE_SHA = "39e4f7134549f2ee5756e1456f575dc6c08f27cfe31780894bc639c85dda1d4c"
CANVAS = (1920, 1080)
EMU_TO_PIXEL = 2 / 12700
TITLES = (
    "Altered States of Viscereality", "Lecture plan", "Immersion and presence", "A visual illusion",
    "Multisensory perception", "Visual context changes what we hear", "Rubber hand illusion",
    "Individual differences in response", "Embodiment and the bodily self", "Body ownership",
    "First-person perspective and self-location", "Experimental manipulation of self-location",
    "Front stroking shifts felt self-location", "Body ownership and the Barbie-doll illusion",
    "Front-stroking full-body illusion", "Back-stroking full-body illusion", "The auditory double",
    "Where does the touch seem to happen?", "The Machine to Be Another",
    "Respiratory coupling of lung mechanics", "Breathwork and peripersonal space",
    "Respiratory coupling demonstration", "Respiratory coupling, slide 23",
    "Respiratory coupling, slide 24", "Respiratory coupling, slide 25",
    "Respiratory coupling, slide 26", "Respiratory coupling, slide 27",
    "Three mappings of breath to space", "Measuring peripersonal space with binaural audio",
    "Resonance Sound SDK", "Viscereality experience", "Experience and physiology on a shared timeline",
    "Acknowledgments", "Design a test of the felt body boundary", "Selected sources",
)


def rels(archive, path):
    if path not in archive.namelist():
        return {}
    return {node.attrib["Id"]: node.attrib["Target"] for node in XML.fromstring(archive.read(path))
            if node.get("TargetMode") != "External"}


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


def read_source(archive):
    package = XML.fromstring(archive.read("ppt/presentation.xml"))
    parent_rels = rels(archive, "ppt/_rels/presentation.xml.rels")
    inventory = []
    for item in package.find(P + "sldIdLst"):
        path = normpath(join("ppt", parent_rels[item.attrib[R + "id"]]))
        directory, name = path.rsplit("/", 1)
        assets = {rid: normpath(join(directory, part))
                  for rid, part in rels(archive, f"{directory}/_rels/{name}.rels").items()}
        slide = XML.fromstring(archive.read(path))
        shapes = {}
        for node in slide.find(f"{P}cSld/{P}spTree"):
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
            shapes[int(identity.get("id"))] = {
                "key": key, "named": named, "video": video, "label": shape_name,
                "gifs": embedded_gifs(node, assets),
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
        if effect.Timing.TriggerType == 1:
            groups.append([])
        kind = effect.EffectType
        command = "play" if kind == 83 else "zoom" if kind == 59 else "hide" if effect.Exit else "show"
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
        sid in cue_ids or data["video"] or data["gifs"] or (data["key"] and data["key"] in neighbors))}
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
    layers = []
    check = background.convert("RGBA")
    for shape in shapes:
        sid = shape.Id
        if sid not in selected or not visibility[sid]:
            continue
        spec = metadata.get(sid, {})
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
        shape.Export(str(scratch / "shape.png"), 2, 1440, 810, 1)
        with Image.open(scratch / "shape.png") as raw:
            aligned = align_sprite(raw.convert("RGBA"), geometry[sid], empty, isolated)
        if not bare_gif:
            for child in nested:
                child.Visible = -1
        shape.Visible = 0
        if aligned is None:
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
            "background": background_name, "layers": layers, "steps": steps, "onEnter": enter}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--web-media", type=Path, required=True, help="The five extracted, web-ready PowerPoint MP4s")
    args = parser.parse_args()
    with args.source.open("rb") as deck_file:
        from hashlib import file_digest
        if file_digest(deck_file, "sha256").hexdigest() != SOURCE_SHA:
            raise ValueError("The input is not the verified final Humboldt deck")
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    with ZipFile(args.source) as archive:
        inventory = read_source(archive)
        for path in archive.namelist():
            if path.startswith("ppt/media/") and path.endswith(".gif"):
                gif = output / Path(path).name
                gif.write_bytes(archive.read(path))
                with Image.open(gif) as image:
                    image.convert("RGBA").save(gif.with_suffix(".webp"), "WEBP", lossless=True)
    for i in range(1, 6):
        filename = f"media{i}.mp4"
        shutil.copyfile(args.web_media / filename, output / filename)

    pythoncom.CoInitialize()
    app = win32com.client.DispatchEx("PowerPoint.Application")
    deck = app.Presentations.Open(str(args.source.resolve()), -1, -1, 0)
    try:
        assert deck.Slides.Count == len(inventory) == len(TITLES)
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
