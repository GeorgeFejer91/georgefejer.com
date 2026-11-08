"""Check the homepage and presentations index in Chromium (requires Playwright)."""

import argparse
import re
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
NAV = ("Profile", "Research", "Presentations", "Contact")
VIEWPORTS = ((320, 568), (390, 844), (640, 360), (703, 512), (704, 511),
             (704, 512), (1024, 512), (1024, 900), (1440, 900), (1920, 1080))
SPACING = """* { line-height: 1.5 !important; letter-spacing: .12em !important;
word-spacing: .16em !important; } p { margin-block-end: 2em !important; }"""


class SiteHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def send_head(self):
        self.video_bytes = None
        path = Path(self.translate_path(self.path))
        byte_range = re.fullmatch(r"bytes=(\d+)-(\d*)", self.headers.get("Range", ""))
        if path.suffix != ".mp4" or not path.is_file() or not byte_range:
            return super().send_head()

        size = path.stat().st_size
        start = int(byte_range[1])
        end = min(int(byte_range[2]) if byte_range[2] else size - 1, size - 1)
        if start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return None

        self.video_bytes = end - start + 1
        self.send_response(206)
        self.send_header("Content-Type", "video/mp4")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(self.video_bytes))
        self.end_headers()
        source = path.open("rb")
        source.seek(start)
        return source

    def copyfile(self, source, outputfile):
        try:
            if self.video_bytes is None:
                super().copyfile(source, outputfile)
                return
            remaining = self.video_bytes
            while remaining:
                block = source.read(min(65536, remaining))
                if not block:
                    break
                outputfile.write(block)
                remaining -= len(block)
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            if self.video_bytes is None:
                raise


def assert_no_overflow(page):
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), page.viewport_size
    for selector in (".site-index", ".index-nav", ".index-links", ".index-link"):
        assert page.locator(selector).evaluate_all(
            """elements => elements.every(el =>
                el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1)"""
        ), (page.viewport_size, selector)


def measure_panel(page, width, height):
    page.set_viewport_size({"width": width, "height": height})
    assert_no_overflow(page)
    return page.evaluate("""() => {
        const panel = document.querySelector('.site-index');
        const header = document.querySelector('.identity');
        const links = document.querySelectorAll('.index-links .index-link');
        const contact = document.querySelector('.index-contact');
        const panelRect = panel.getBoundingClientRect();
        const top = header.getBoundingClientRect().bottom;
        const first = links[0].getBoundingClientRect();
        const second = links[1].getBoundingClientRect();
        const bottom = contact.getBoundingClientRect().bottom;
        const css = getComputedStyle(panel);
        return {
            vertical: first.top - top,
            horizontal: second.left - first.right,
            type: parseFloat(getComputedStyle(links[0]).fontSize),
            anchored: Math.abs(panelRect.bottom - bottom - parseFloat(css.paddingBottom)) < 1
        };
    }""")


def check_site(browser, url, screenshots):
    page = browser.new_page(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("response", lambda response: errors.append(response.url) if response.status >= 400 else None)
    assert page.goto(url).ok
    page.wait_for_function("document.querySelectorAll('.index-link[data-fit=fit]').length === 4")
    assert tuple(page.get_by_role("navigation").get_by_role("link").all_text_contents()) == NAV
    assert page.locator("html").evaluate("(el) => getComputedStyle(el).backgroundColor") == "rgb(0, 0, 0)"
    assert page.locator("h1").evaluate("(el) => getComputedStyle(el).color") == "rgb(255, 255, 255)"
    assert page.locator(".portrait").evaluate("(el) => el.complete && el.naturalWidth > 0")

    for width, height in VIEWPORTS:
        measure_panel(page, width, height)
    short = measure_panel(page, 1024, 512)
    tall = measure_panel(page, 1024, 900)
    narrow = measure_panel(page, 704, 900)
    wide = measure_panel(page, 1440, 900)
    assert tall["vertical"] > short["vertical"]
    assert wide["horizontal"] > narrow["horizontal"]
    assert wide["type"] >= narrow["type"] and tall["type"] >= short["type"]
    assert all(panel["anchored"] for panel in (short, tall, narrow, wide))

    if screenshots:
        screenshots.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=screenshots / "georgefejer-home.png")

    page.set_viewport_size({"width": 320, "height": 568})
    page.locator(".index-link span").nth(2).evaluate(
        "(el) => el.textContent = 'WissenschaftlicheFachvortraegeUndKonferenzpraesentationen'"
    )
    page.wait_for_function("document.querySelectorAll('.index-link[data-fit=reflow]').length === 1")
    assert_no_overflow(page)
    page.add_style_tag(content="html { font-size: 200%; } " + SPACING)
    page.wait_for_function("document.querySelectorAll('.index-link[data-fit=reflow]').length === 4")
    assert_no_overflow(page)
    assert page.locator(".index-link span").nth(2).evaluate("(el) => el.getBoundingClientRect().height") > 48

    page.goto(url)
    for name in NAV:
        page.keyboard.press("Tab")
        assert page.get_by_role("link", name=name, exact=True).evaluate(
            "(el) => el === document.activeElement && getComputedStyle(el).outlineStyle !== 'none'"
        )
    page.get_by_role("link", name="Profile", exact=True).click()
    assert page.url.endswith("#about")
    assert page.locator("#about").evaluate("(el) => el === document.activeElement")
    for anchor in ("home", "about", "expertise", "projects", "publications", "contact"):
        assert page.locator("#" + anchor).count() == 1

    page.get_by_role("link", name="Presentations", exact=True).click()
    assert page.url.endswith("/Academic/presentations/")
    assert page.get_by_role("heading", name="Presentations", exact=True).count() == 1
    for width, height in VIEWPORTS:
        page.set_viewport_size({"width": width, "height": height})
        assert_no_overflow(page)
    if screenshots:
        page.set_viewport_size({"width": 1200, "height": 760})
        page.screenshot(path=screenshots / "georgefejer-presentations.png")
    page.get_by_role("link", name="Back to George Fejer").click()
    assert page.url == url
    assert not errors, errors

    fallback = browser.new_page(viewport={"width": 320, "height": 568}, java_script_enabled=False)
    fallback.goto(url)
    assert tuple(fallback.get_by_role("navigation").get_by_role("link").all_text_contents()) == NAV
    assert_no_overflow(fallback)
    fallback.get_by_role("link", name="Presentations", exact=True).click()
    assert fallback.url.endswith("/Academic/presentations/")
    fallback.get_by_role("link", name="Back to George Fejer").click()
    assert fallback.url == url


def check_morph_player(browser, url):
    page = browser.new_page(viewport={"width": 1200, "height": 760})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(url + "Academic/presentations/humboldt-viscereality/")
    page.get_by_role("navigation", name="Slide navigation").wait_for(state="visible")
    slides = page.evaluate("async () => (await import('./slides.js')).slides")
    assert len(slides) == 35 and sum(slide["morph"] > 0 for slide in slides) == 34
    assert all(s["entry"] <= s["still"] < s["stop"] for s in slides)
    assert all(a["stop"] < b["entry"] for a, b in zip(slides, slides[1:]))
    assert page.get_by_role("link", name="Download PowerPoint").get_attribute("href").endswith(".pptx")

    next_slide = page.get_by_role("button", name="Next slide")
    previous = page.get_by_role("button", name="Previous slide")
    picker = page.get_by_role("combobox", name="Slide")
    status = page.get_by_role("status")
    assert previous.is_disabled()
    assert picker.locator("option").count() == 35
    next_slide.press("Enter")
    page.wait_for_function(
        """() => { const v = document.querySelector('video');
                   return !v.paused && !v.seeking && v.currentTime > 3; }"""
    )
    assert status.inner_text().startswith("Slide 2 of 35")
    page.wait_for_function(
        """target => { const v = document.querySelector('video');
                       return v.paused && !v.seeking && Math.abs(v.currentTime - target) < .35; }""",
        arg=slides[1]["stop"],
    )
    previous.press("Enter")
    assert status.inner_text().startswith("Slide 1 of 35")

    page.emulate_media(reduced_motion="reduce")
    picker.select_option(label="21")
    assert status.inner_text().startswith("Slide 21 of 35")
    next_slide.click()
    page.wait_for_function(
        """target => { const v = document.querySelector('video');
                       return v.paused && !v.seeking && Math.abs(v.currentTime - target) < .1; }""",
        arg=slides[21]["still"],
    )
    assert status.inner_text().startswith("Slide 22 of 35")
    picker.select_option(label="35")
    assert next_slide.is_disabled()
    assert status.inner_text().startswith("Slide 35 of 35")

    for width, height in ((320, 568), (390, 844), (640, 360)):
        page.set_viewport_size({"width": width, "height": height})
        assert_no_overflow(page)
    page.add_style_tag(content="html { font-size: 200%; } " + SPACING)
    assert_no_overflow(page)
    assert not errors, errors
    page.close()


def check_live_presentation(browser, url):
    page = browser.new_page(viewport={"width": 1200, "height": 820})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(url + "Academic/presentations/")
    page.get_by_role("link", name="Open interactive presentation").click()
    page.get_by_role("navigation", name="Slide navigation").wait_for(state="visible")
    picker = page.get_by_role("combobox", name="Slide")
    next_step = page.get_by_role("button", name="Next", exact=True)
    previous = page.get_by_role("button", name="Previous", exact=True)
    assert picker.locator("option").count() == 35
    assert page.locator("video[src]").count() == 0

    def status_prefix(prefix):
        page.wait_for_function(
            "prefix => document.querySelector('#live-status').textContent.startsWith(prefix)",
            arg=prefix,
        )

    def choose(number):
        picker.select_option(label=str(number))
        status_prefix(f"Slide {number} of 35")

    choose(6)
    mask = page.locator('.live-pane [data-layer="40"]')
    assert mask.is_visible()
    next_step.press("Enter")
    assert "Cue 1 of 9" in page.get_by_role("status").inner_text()
    mask.wait_for(state="hidden")
    previous.press("Enter")
    mask.wait_for(state="visible")

    choose(7)
    clip = page.get_by_label("Rubber hand illusion", exact=True)
    assert clip.evaluate("(video) => video.paused")
    next_step.click()
    page.wait_for_function("document.querySelector('.live-pane video').currentTime > 0.05")
    status_prefix("Slide 7 of 35")
    next_step.click()
    status_prefix("Slide 8 of 35")
    page.wait_for_function("document.querySelectorAll('.live-pane').length === 1")

    choose(21)
    next_step.click()
    page.wait_for_function("""document.querySelector('[data-layer="6"] .live-sprite')
        .style.transform.includes('1.1')""")
    status_prefix("Slide 21 of 35")

    choose(22)
    page.get_by_role("button", name="Play demonstration").click()
    dialog = page.get_by_role("dialog")
    assert dialog.is_visible()
    page.wait_for_function("document.querySelector('dialog video').currentTime > 0.05")
    page.get_by_role("button", name="Close demonstration").click()
    assert not dialog.is_visible()
    page.locator("#live-stage").focus()
    page.keyboard.press("ArrowRight")
    status_prefix("Slide 23 of 35")
    page.wait_for_function("""() => [...document.querySelectorAll('[data-morph-key]')].some(
        node => node.dataset.morphKey === '!!ViscerealityBreathingCarousel' &&
                node.getAnimations().some(anim => anim.playState === 'running' &&
                    anim.effect.getKeyframes().some(frame => frame.transform?.includes('translate')))
    )""")
    page.wait_for_function("document.querySelectorAll('.live-pane').length === 1")

    page.keyboard.press("f")
    page.wait_for_function("document.fullscreenElement?.id === 'live-presenter'")
    page.get_by_role("button", name="Exit full screen").click()
    page.wait_for_function("!document.fullscreenElement")
    page.emulate_media(reduced_motion="reduce")
    next_step.click()
    status_prefix("Slide 24 of 35")
    assert page.locator(".live-pane").count() == 1
    assert page.locator(".live-gif img[src$='.gif']").count() == 0
    choose(35)
    assert next_step.is_disabled()
    page.set_viewport_size({"width": 320, "height": 568})
    page.add_style_tag(content="html { font-size: 200%; } " + SPACING)
    assert_no_overflow(page)
    assert not errors, errors
    page.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--screenshots", type=Path)
    args = parser.parse_args()
    with ThreadingHTTPServer(("127.0.0.1", 0), partial(SiteHandler, directory=ROOT)) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch()
                url = f"http://127.0.0.1:{server.server_port}/"
                check_site(browser, url, args.screenshots)
                check_morph_player(browser, url)
                check_live_presentation(browser, url)
                print(f"Chromium {browser.version}: {len(VIEWPORTS)} viewport pairs, label fitting, "
                      "200% text and spacing, keyboard navigation, presentations, video playback, live Morph and click cues, and no-JS fallback passed.")
        finally:
            server.shutdown()


if __name__ == "__main__":
    main()
