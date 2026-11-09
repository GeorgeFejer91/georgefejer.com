import { presentationRemote } from "./remote.js";

const stage = document.querySelector("#live-stage");
const presenter = document.querySelector("#live-presenter");
const toolbar = document.querySelector("#live-navigation");
const previous = document.querySelector("#live-previous");
const next = document.querySelector("#live-next");
const picker = document.querySelector("#live-picker");
const status = document.querySelector("#live-status");
const fullscreen = document.querySelector("#live-fullscreen");
const demo = document.querySelector("#live-demo");
const demoDialog = document.querySelector("#live-demo-dialog");
const demoVideo = demoDialog.querySelector("video");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const asset = file => new URL(`deck/${file}`, import.meta.url).href;
const labels = {
    "media1.wav": "First speech sample",
    "media2.wav": "Second speech sample",
    "media3.mp4": "Synchrony detection demonstration",
    "media4.mp4": "Rubber hand illusion demonstration",
    "media5.mp4": "Front-stroking full-body illusion demonstration",
    "media6.mp4": "Breath-responsive particle field",
};

let deck;
let scene = null;
let outgoing = null;
let request = 0;
let cueIndex = 0;
const images = new Map();
let modelViewer;

function place(element, box, frame = [0, 0, 1920, 1080]) {
    const [x, y, width, height] = box;
    const [left, top, basisWidth, basisHeight] = frame;
    Object.assign(element.style, {
        left: `${100 * (x - left) / basisWidth}%`,
        top: `${100 * (y - top) / basisHeight}%`,
        width: `${100 * width / basisWidth}%`,
        height: `${100 * height / basisHeight}%`,
    });
}

function picture(file, className) {
    const node = new Image();
    node.alt = "";
    node.draggable = false;
    node.className = className;
    node.src = asset(file);
    return node;
}

function prepare(slide) {
    const files = [slide.background, ...slide.layers.flatMap(layer => [
        layer.src, ...(layer.gifs ?? []).map(gif => motion.matches ? gif.src.replace(/\.gif$/, ".webp") : gif.src),
    ])].filter(Boolean);
    return Promise.all(files.map(file => {
        if (!images.has(file)) {
            const img = picture(file, "");
            images.set(file, img.decode().catch(error => {
                images.delete(file);
                throw error;
            }));
        }
        return images.get(file);
    }));
}

function mediaNode(file) {
    const video = document.createElement(file.endsWith(".wav") ? "audio" : "video");
    video.src = asset(file);
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.setAttribute("aria-label", labels[file]);
    return video;
}

function paintLayer(spec) {
    const node = document.createElement("div");
    node.className = "live-layer";
    node.hidden = Boolean(spec.hidden);
    node.dataset.layer = String(spec.id);
    if (spec.key) node.dataset.morphKey = spec.key;
    place(node, spec.box);
    const sprite = spec.src ? picture(spec.src, "live-sprite") : null;
    if (sprite) node.append(sprite);
    for (const gif of spec.gifs ?? []) {
        const crop = document.createElement("span");
        crop.className = "live-gif";
        place(crop, gif.box, spec.box);
        const image = picture(motion.matches ? gif.src.replace(/\.gif$/, ".webp") : gif.src, "");
        const [left, top, right, bottom] = gif.crop;
        place(image, [-left, -top, 1, 1], [0, 0, 1 - left - right, 1 - top - bottom]);
        crop.append(image);
        node.append(crop);
    }
    let video = null;
    if (spec.video) {
        video = mediaNode(spec.video);
        if (spec.src) video.poster = asset(spec.src);
        place(video, spec.videoBox, spec.box);
        node.append(video);
    }
    if (spec.loop) {
        video.muted = true;
        video.loop = true;
        video.controls = false;
    }
    if (spec.audio) {
        video = mediaNode(spec.audio);
        video.controls = false;
        const play = document.createElement("button");
        play.type = "button";
        play.className = "live-media";
        play.setAttribute("aria-label", `Play ${labels[spec.audio].toLowerCase()}`);
        play.addEventListener("click", () => {
            video.currentTime = 0;
            video.play().catch(() => {});
        });
        place(play, spec.mediaBox ?? spec.box, spec.box);
        node.append(video, play);
    }
    if (spec.youtube) {
        const play = document.createElement("button");
        play.type = "button";
        play.className = "live-media";
        play.setAttribute("aria-label", "Play Viscereality in Motion");
        place(play, spec.mediaBox, spec.box);
        play.addEventListener("click", () => {
            const iframe = document.createElement("iframe");
            iframe.className = "live-media";
            iframe.title = "Viscereality in Motion";
            iframe.src = `https://www.youtube-nocookie.com/embed/${spec.youtube}?autoplay=1`;
            iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
            iframe.allowFullscreen = true;
            place(iframe, spec.mediaBox, spec.box);
            play.replaceWith(iframe);
        });
        node.append(play);
    }
    if (spec.model && !motion.matches) {
        const viewer = document.createElement("model-viewer");
        viewer.className = "live-media live-model";
        viewer.setAttribute("alt", spec.label);
        viewer.setAttribute("src", asset(spec.model));
        viewer.setAttribute("autoplay", "");
        viewer.setAttribute("interaction-prompt", "none");
        viewer.setAttribute("shadow-intensity", "0");
        viewer.setAttribute("loading", "eager");
        place(viewer, spec.mediaBox, spec.box);
        viewer.addEventListener("load", () => { if (sprite) sprite.hidden = true; }, { once: true });
        node.append(viewer);
        modelViewer ??= import("./vendor/model-viewer/model-viewer.min.js").catch(() => {});
    }
    return { node, spec, video, animation: null, zoom: [1, 1] };
}

function makeScene(index) {
    const slide = deck[index];
    const pane = document.createElement("div");
    pane.className = "live-pane";
    pane.append(picture(slide.background, "live-background"));
    const layers = new Map();
    for (const spec of slide.layers) {
        if (spec.offstage) continue;
        const layer = paintLayer(spec);
        layers.set(spec.id, layer);
        pane.append(layer.node);
    }
    for (const link of slide.links) {
        const anchor = document.createElement("a");
        anchor.className = "live-link";
        anchor.href = link.href;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.setAttribute("aria-label", link.text);
        place(anchor, link.box);
        pane.append(anchor);
    }
    return { index, slide, pane, layers };
}

function transform(from, to) {
    const [x, y, width, height] = from;
    const [left, top, basisWidth, basisHeight] = to;
    return `translate(${100 * (x - left) / basisWidth}%, ${100 * (y - top) / basisHeight}%) scale(${width / basisWidth}, ${height / basisHeight})`;
}

function morph(old, current, duration) {
    outgoing = old.pane;
    outgoing.inert = true;
    const timing = { duration, easing: "ease-in-out" };
    const animations = [current.pane.animate([{ opacity: 0 }, { opacity: 1 }], timing)];
    const shared = new Map([...old.layers.values()]
        .filter(layer => layer.spec.key && !layer.node.hidden).map(layer => [layer.spec.key, layer]));
    for (const layer of current.layers.values()) {
        const prior = shared.get(layer.spec.key);
        if (!prior || layer.node.hidden) continue;
        animations.push(layer.node.animate([{ transform: transform(prior.spec.box, layer.spec.box) },
                                            { transform: "none" }], timing));
        animations.push(prior.node.animate([{ transform: "none" },
                                            { transform: transform(layer.spec.box, prior.spec.box) }], timing));
    }
    Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
        old.pane.remove();
        if (outgoing === old.pane) outgoing = null;
    });
}

function updateStatus() {
    const { index, slide } = scene;
    const steps = slide.steps.length;
    previous.disabled = index === 0 && cueIndex === 0;
    next.disabled = index === deck.length - 1 && cueIndex === steps;
    picker.value = String(index);
    demo.hidden = !slide.layers.some(layer => layer.offstage);
    status.textContent = `Slide ${index + 1} of ${deck.length} · ${slide.title}${steps ? ` · Cue ${cueIndex} of ${steps}` : ""}`;
}

function applyCue(cue, reverse = false) {
    const layer = scene.layers.get(cue.id);
    if (!layer) return;
    if (cue.action === "play" || cue.action === "pause") {
        if (reverse || cue.action === "pause") {
            layer.video?.pause();
            if (layer.video?.readyState) layer.video.currentTime = 0;
        } else {
            layer.video?.play().catch(() => {});
        }
        return;
    }
    layer.animation?.cancel();
    const duration = motion.matches ? 0 : cue.duration * 1000;
    if (cue.action === "zoom") {
        const after = reverse ? [1, 1] : cue.scale;
        const sprite = layer.node.firstElementChild;
        layer.animation = sprite.animate([
            { transform: `scale(${layer.zoom.join(",")})` },
            { transform: `scale(${after.join(",")})` },
        ], { duration, easing: "ease-in-out" });
        layer.zoom = after;
        sprite.style.transform = `scale(${after.join(",")})`;
        return;
    }
    const hide = (cue.action === "hide") !== reverse;
    if (!hide) layer.node.hidden = false;
    if (!duration || cue.effect === 1) {
        layer.node.hidden = hide;
        return;
    }
    const animation = layer.node.animate([{ opacity: hide ? 1 : 0 }, { opacity: hide ? 0 : 1 }], { duration });
    layer.animation = animation;
    animation.finished.then(() => { layer.node.hidden = hide; }, () => {});
}

async function show(index, animate = true) {
    if (!deck[index] || index === scene?.index) return false;
    const generation = ++request;
    try {
        await prepare(deck[index]);
    } catch {
        if (generation === request) status.textContent = "This slide could not load. Select it again to retry.";
        return false;
    }
    if (generation !== request) return false;
    const old = scene;
    outgoing?.remove();
    outgoing = null;
    if (demoDialog.open) demoDialog.close();
    if (old) {
        for (const layer of old.layers.values()) layer.video?.pause();
        old.pane.querySelectorAll("iframe").forEach(frame => frame.remove());
        old.pane.querySelectorAll("model-viewer").forEach(viewer => viewer.pause?.());
    }
    else stage.replaceChildren();
    scene = makeScene(index);
    cueIndex = 0;
    stage.append(scene.pane);
    const duration = old && index < old.index ? old.slide.duration : scene.slide.duration;
    if (old && animate && Math.abs(old.index - index) === 1 && !motion.matches && duration) morph(old, scene, duration);
    else old?.pane.remove();
    updateStatus();
    for (const cue of scene.slide.onEnter) {
        if (!motion.matches || !scene.layers.get(cue.id)?.spec.loop) applyCue(cue);
    }
    for (const neighbor of [deck[index - 1], deck[index + 1]]) {
        if (neighbor) prepare(neighbor).catch(() => {});
    }
    return true;
}

async function step(direction) {
    if (!scene) return false;
    const groups = scene.slide.steps;
    if (direction > 0 && cueIndex < groups.length) {
        groups[cueIndex++].forEach(cue => applyCue(cue));
        updateStatus();
    } else if (direction < 0 && cueIndex > 0) {
        [...groups[--cueIndex]].reverse().forEach(cue => applyCue(cue, true));
        updateStatus();
    } else {
        return show(scene.index + direction);
    }
    return true;
}

let revision = 0;
const getPosition = () => ({ revision, index: scene?.index ?? 0, cue: cueIndex });
async function navigate(direction) {
    const changed = await step(direction);
    if (changed) revision++;
    return changed;
}
async function mirror({ index, cue }) {
    if (!deck[index] || !Number.isInteger(cue) || cue < 0 || cue > deck[index].steps.length) return;
    await show(index);
    if (scene.index !== index) return;
    while (cueIndex < cue) {
        scene.slide.steps[cueIndex++].filter(effect => !["play", "pause"].includes(effect.action))
            .forEach(effect => applyCue(effect));
    }
    while (cueIndex > cue) [...scene.slide.steps[--cueIndex]].reverse().forEach(effect => applyCue(effect, true));
    updateStatus();
}
const remote = presentationRemote({
    navigate, getPosition, mirror, setPaired: paired => { picker.disabled = paired; },
});
async function requestStep(direction) {
    if (remote.send(direction)) return;
    if (await navigate(direction)) remote.publish();
}
async function jump(index) {
    if (picker.disabled || !await show(index, false)) return;
    revision++;
    remote.publish();
}
previous.addEventListener("click", () => requestStep(-1));
next.addEventListener("click", () => requestStep(1));
picker.addEventListener("change", () => jump(Number(picker.value)));
stage.addEventListener("click", event => {
    if (!event.target.closest("a, button, audio, video, iframe")) requestStep(1);
});
document.addEventListener("keydown", event => {
    if (!scene || document.querySelector("dialog[open]") || event.altKey || event.ctrlKey || event.metaKey
        || event.target.closest("input, select, a, audio, video")
        || (event.key === " " && event.target.closest("button"))) return;
    if (["ArrowRight", "PageDown", " ", "ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        requestStep(["ArrowLeft", "PageUp"].includes(event.key) ? -1 : 1);
    } else if (event.key.toLowerCase() === "f" && !fullscreen.hidden) {
        event.preventDefault();
        fullscreen.click();
    } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        jump(event.key === "Home" ? 0 : deck.length - 1);
    }
});
fullscreen.hidden = !document.fullscreenEnabled;
fullscreen.addEventListener("click", async () => {
    try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await presenter.requestFullscreen();
    } catch {
        status.textContent = "Full screen is unavailable in this browser window.";
    }
});
document.addEventListener("fullscreenchange", () => {
    fullscreen.firstElementChild.textContent = document.fullscreenElement ? "Exit full screen" : "Full screen";
});
demo.addEventListener("click", () => {
    const layer = scene?.slide.layers.find(spec => spec.offstage);
    if (!layer) return;
    demoVideo.src = asset(layer.video);
    demoDialog.showModal();
    demoVideo.play().catch(() => {});
});
demoDialog.addEventListener("close", () => {
    demoVideo.pause();
    demoVideo.removeAttribute("src");
    demoVideo.load();
});
motion.addEventListener("change", () => {
    const index = scene?.index;
    if (index === undefined) return;
    for (const overlay of scene.pane.querySelectorAll(".live-gif img")) {
        overlay.src = motion.matches ? overlay.src.replace(/\.gif$/, ".webp") : overlay.src.replace(/\.webp$/, ".gif");
    }
    for (const { node, spec, video } of scene.layers.values()) {
        if (spec.loop) {
            if (motion.matches) video.pause();
            else video.play().catch(() => {});
        }
        const model = node.querySelector("model-viewer");
        if (model && motion.matches) model.pause?.();
        if (model && !motion.matches) model.play?.();
    }
});

try {
    const response = await fetch(asset("deck.json"));
    if (!response.ok) throw new Error("Presentation data is unavailable");
    deck = await response.json();
    deck.forEach((slide, index) => picker.add(new Option(String(index + 1), String(index))));
    await show(0, false);
    if (scene) toolbar.hidden = false;
} catch {
    status.textContent = "The interactive slides could not load. Reload the page or use the PowerPoint link.";
}
