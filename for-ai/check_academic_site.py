"""Check the homepage and presentations index in Chromium (requires Playwright)."""

import argparse
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--screenshots", type=Path)
    args = parser.parse_args()
    with ThreadingHTTPServer(("127.0.0.1", 0), partial(SiteHandler, directory=ROOT)) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch()
                check_site(browser, f"http://127.0.0.1:{server.server_port}/", args.screenshots)
                print(f"Chromium {browser.version}: {len(VIEWPORTS)} viewport pairs, label fitting, "
                      "200% text and spacing, keyboard navigation, presentations, and no-JS fallback passed.")
        finally:
            server.shutdown()


if __name__ == "__main__":
    main()
