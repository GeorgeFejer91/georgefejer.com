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
    "media1.mp4": "What do you hear?",
    "media2.mp4": "Rubber hand illusion",
    "media3.mp4": "Barbie doll illusion",
    "media4.mp4": "The Machine to Be Another",
    "media5.mp4": "Respiratory coupling demonstration",
};

let deck;
let scene = null;
let outgoing = null;
let request = 0;
let cueIndex = 0;
const images = new Map();

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
    const video = document.createElement("video");
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
    if (cue.action === "play") {
        if (reverse) {
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
    if (!deck[index] || index === scene?.index) return;
    const generation = ++request;
    try {
        await prepare(deck[index]);
    } catch {
        if (generation === request) status.textContent = "This slide could not load. Select it again to retry.";
        return;
    }
    if (generation !== request) return;
    const old = scene;
    outgoing?.remove();
    outgoing = null;
    if (demoDialog.open) demoDialog.close();
    if (old) for (const layer of old.layers.values()) layer.video?.pause();
    else stage.replaceChildren();
    scene = makeScene(index);
    cueIndex = 0;
    stage.append(scene.pane);
    const duration = old && index < old.index ? old.slide.duration : scene.slide.duration;
    if (old && animate && Math.abs(old.index - index) === 1 && !motion.matches && duration) morph(old, scene, duration);
    else old?.pane.remove();
    updateStatus();
    for (const cue of scene.slide.onEnter) applyCue(cue);
    for (const neighbor of [deck[index - 1], deck[index + 1]]) {
        if (neighbor) prepare(neighbor).catch(() => {});
    }
}

function step(direction) {
    if (!scene) return;
    const groups = scene.slide.steps;
    if (direction > 0 && cueIndex < groups.length) {
        groups[cueIndex++].forEach(cue => applyCue(cue));
        updateStatus();
    } else if (direction < 0 && cueIndex > 0) {
        [...groups[--cueIndex]].reverse().forEach(cue => applyCue(cue, true));
        updateStatus();
    } else {
        show(scene.index + direction);
    }
}

previous.addEventListener("click", () => step(-1));
next.addEventListener("click", () => step(1));
picker.addEventListener("change", () => show(Number(picker.value), false));
stage.addEventListener("click", event => {
    if (!event.target.closest("video")) step(1);
});
document.addEventListener("keydown", event => {
    if (!scene || demoDialog.open || event.altKey || event.ctrlKey || event.metaKey
        || event.target.closest("select, a, video")
        || (event.key === " " && event.target.closest("button"))) return;
    if (["ArrowRight", "PageDown", " ", "ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        step(["ArrowLeft", "PageUp"].includes(event.key) ? -1 : 1);
    } else if (event.key.toLowerCase() === "f" && !fullscreen.hidden) {
        event.preventDefault();
        fullscreen.click();
    } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        show(event.key === "Home" ? 0 : deck.length - 1, false);
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
