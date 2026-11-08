import { slides } from "./slides.js";

const video = document.querySelector("#presentation");
const navigation = document.querySelector(".slide-navigation");
const previous = document.querySelector("#previous-slide");
const picker = document.querySelector("#slide-picker");
const next = document.querySelector("#next-slide");
const status = document.querySelector("#slide-status");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

let active = 0;
let stopAt = null;
let frameRequest = null;

for (let index = 0; index < slides.length; index++) {
    picker.add(new Option(String(index + 1), String(index)));
}

function showSlide(index) {
    active = index;
    picker.value = String(index);
    previous.disabled = index === 0;
    next.disabled = index === slides.length - 1;
    status.textContent = `Slide ${index + 1} of ${slides.length} · ${slides[index].title}`;
}

function syncPosition() {
    if (video.seeking) return;
    const time = video.currentTime;
    if (stopAt !== null && time >= stopAt) {
        const end = stopAt;
        stopAt = null;
        video.pause();
        if (time - end > 0.04) video.currentTime = end;
        return;
    }
    const index = slides.findLastIndex(slide => slide.entry <= time + 0.025);
    if (index >= 0 && index !== active) showSlide(index);
}

function watchStep() {
    if (frameRequest !== null || stopAt === null || video.paused) return;
    frameRequest = video.requestVideoFrameCallback(() => {
        frameRequest = null;
        syncPosition();
        watchStep();
    });
}

function goTo(index, animate) {
    const slide = slides[index];
    if (!slide || picker.disabled) return;
    const play = animate && !reducedMotion.matches;
    video.pause();
    stopAt = play ? slide.stop : null;
    showSlide(index);
    video.currentTime = play ? slide.entry : slide.still;
    if (play) {
        video.play().catch(error => {
            if (error.name === "AbortError") return;
            stopAt = null;
            status.textContent = "Select Play to continue this slide.";
        });
    }
}

function enableNavigation() {
    const available = video.seekable;
    if (!picker.disabled || !available.length || available.end(available.length - 1) < slides.at(-1).still) return;
    navigation.hidden = false;
    picker.disabled = false;
    showSlide(0);
    syncPosition();
}

previous.addEventListener("click", () => goTo(active - 1, false));
next.addEventListener("click", () => goTo(active + 1, true));
picker.addEventListener("change", () => goTo(Number(picker.value), false));
navigation.addEventListener("keydown", event => {
    if (event.target === picker || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const forward = event.key === "ArrowRight";
        goTo(active + (forward ? 1 : -1), forward);
    }
});
video.addEventListener("timeupdate", syncPosition);
video.addEventListener("seeked", syncPosition);
video.addEventListener("seeking", () => {
    if (stopAt !== null && (video.currentTime + 0.05 < slides[active].entry || video.currentTime > stopAt + 0.05)) {
        stopAt = null;
    }
});
if ("requestVideoFrameCallback" in video) video.addEventListener("play", watchStep);
video.addEventListener("error", () => {
    status.textContent = "The presentation video could not load. Reload the page or download the PowerPoint.";
});
video.addEventListener("loadedmetadata", enableNavigation, { once: true });
video.addEventListener("progress", enableNavigation);
enableNavigation();
