import { measureLineStats, measureNaturalWidth, prepare } from "./vendor/pretext-1.0.0/layout.js";

const index = document.querySelector(".site-index, [data-fit-controls]");
const labels = [...index.querySelectorAll(".index-link > span, [data-fit] > span")];
const preparedLabels = new WeakMap();
const inset = (styles, ...names) => names.reduce((sum, name) => sum + (parseFloat(styles[name]) || 0), 0);

function measureLabel(label) {
    const link = label.parentElement;
    const style = getComputedStyle(label);
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const letterSpacing = parseFloat(style.letterSpacing) || 0;
    const text = label.textContent;
    const key = JSON.stringify([text, font, letterSpacing, document.documentElement.lang]);
    let entry = preparedLabels.get(label);
    if (entry?.key !== key) {
        entry = { key, text: prepare(text, font, { letterSpacing }) };
        preparedLabels.set(label, entry);
    }

    const box = link.getBoundingClientRect();
    const linkStyle = getComputedStyle(link);
    const width = box.width - inset(linkStyle, "paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth") - 2;
    const height = box.height - inset(linkStyle, "paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth");
    const lineHeight = parseFloat(style.lineHeight);
    const naturalWidth = measureNaturalWidth(entry.text);

    return width > 0
        && naturalWidth <= width
        && measureLineStats(entry.text, width).lineCount === 1
        && lineHeight <= height + 0.5
        && (parseFloat(style.wordSpacing) || 0) === 0
        ? "fit" : "reflow";
}

function startMeasurement() {
    let pending = false;
    const schedule = () => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
            pending = false;
            const results = labels.map(measureLabel);
            labels.forEach((label, i) => {
                if (label.parentElement.dataset.fit !== results[i]) label.parentElement.dataset.fit = results[i];
            });
        });
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(index);
    labels.forEach(label => observer.observe(label));
    const textChanges = new MutationObserver(schedule);
    textChanges.observe(index, { childList: true, characterData: true, subtree: true });
    textChanges.observe(document.documentElement, { attributes: true, attributeFilter: ["lang", "dir"] });
    window.addEventListener("resize", schedule);
    document.fonts.addEventListener("loadingdone", schedule);
    schedule();
}

if (index && typeof Intl.Segmenter === "function" && typeof ResizeObserver === "function" && typeof MutationObserver === "function" && document.fonts
    && document.createElement("canvas").getContext("2d")) {
    document.fonts.ready.then(startMeasurement);
}
