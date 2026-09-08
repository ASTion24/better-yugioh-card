import base64
import os
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / ".runtime" / "e2e"
BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:5174")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BLUE_EYES_SOURCE = (
    "data:image/jpeg;base64,"
    + base64.b64encode(
        (ROOT / "src" / "assets" / "image" / "blue-eyes-old.jpg").read_bytes()
    ).decode("ascii")
)


def launch_browser(playwright):
    try:
        return playwright.chromium.launch(headless=True)
    except Exception:
        return playwright.chromium.launch(
            headless=True,
            executable_path=CHROME,
            args=["--disable-breakpad", "--disable-crash-reporter", "--no-first-run"],
        )


def create_card_grid(page):
    data_url = page.evaluate(
        """() => {
            const canvas = document.createElement('canvas');
            canvas.width = 1100;
            canvas.height = 760;
            const context = canvas.getContext('2d');
            context.fillStyle = '#343632';
            context.fillRect(0, 0, canvas.width, canvas.height);
            const drawCard = x => {
                context.fillStyle = '#d7bd78';
                context.fillRect(x, 28, 469, 684);
                context.strokeStyle = '#f2dfa8';
                context.lineWidth = 8;
                context.strokeRect(x + 12, 40, 445, 660);
                context.fillStyle = '#2e6371';
                context.fillRect(x + 53, 144, 363, 369);
                context.fillStyle = '#f6f0dd';
                context.fillRect(x + 40, 520, 389, 130);
                context.fillStyle = '#161712';
                context.font = '28px Georgia';
                context.fillText('89631139', x + 22, 690);
            };
            drawCard(40);
            drawCard(591);
            return canvas.toDataURL('image/png');
        }"""
    )
    return base64.b64decode(data_url.split(",", 1)[1])


def create_artwork_grid(page):
    data_url = page.evaluate(
        """async (source) => {
            const artwork = new Image();
            artwork.src = source;
            await artwork.decode();
            const canvas = document.createElement('canvas');
            canvas.width = 1100;
            canvas.height = 760;
            const context = canvas.getContext('2d');
            context.fillStyle = '#343632';
            context.fillRect(0, 0, canvas.width, canvas.height);
            const drawCard = x => {
                context.fillStyle = '#d7bd78';
                context.fillRect(x, 28, 469, 684);
                context.strokeStyle = '#f2dfa8';
                context.lineWidth = 8;
                context.strokeRect(x + 12, 40, 445, 660);
                context.drawImage(artwork, x + 52, 144, 366, 369);
                context.fillStyle = '#f6f0dd';
                context.fillRect(x + 40, 520, 389, 130);
            };
            drawCard(40);
            drawCard(591);
            return canvas.toDataURL('image/png');
        }""",
        BLUE_EYES_SOURCE,
    )
    return base64.b64decode(data_url.split(",", 1)[1])


def create_structured_deck_sheet(page):
    data_url = page.evaluate(
        """async (source) => {
            const artwork = new Image();
            artwork.src = source;
            await artwork.decode();
            const canvas = document.createElement('canvas');
            canvas.width = 980;
            canvas.height = 1362;
            const context = canvas.getContext('2d');
            context.fillStyle = '#fafafa';
            context.fillRect(0, 0, canvas.width, canvas.height);
            const drawCard = (x, y) => {
                context.fillStyle = '#d7bd78';
                context.fillRect(x, y, 92, 135);
                context.strokeStyle = '#3c3328';
                context.lineWidth = 2;
                context.strokeRect(x + 1, y + 1, 90, 133);
                context.drawImage(artwork, x + 10, y + 23, 72, 73);
                context.fillStyle = '#f6f0dd';
                context.fillRect(x + 8, y + 98, 76, 26);
            };
            const drawRow = (y, count) => {
                for (let column = 0; column < count; column += 1) {
                    drawCard(14 + column * 95, y);
                }
            };
            [48, 186, 323, 461].forEach(y => drawRow(y, 10));
            drawRow(699, 10);
            drawRow(837, 5);
            drawRow(1074, 10);
            drawRow(1212, 5);
            return canvas.toDataURL('image/png');
        }""",
        BLUE_EYES_SOURCE,
    )
    return base64.b64decode(data_url.split(",", 1)[1])


def create_unknown_card(page):
    data_url = page.evaluate(
        """() => {
            const canvas = document.createElement('canvas');
            canvas.width = 590;
            canvas.height = 860;
            const context = canvas.getContext('2d');
            context.fillStyle = '#d7bd78';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.strokeStyle = '#3c3328';
            context.lineWidth = 8;
            context.strokeRect(12, 12, 566, 836);
            context.fillStyle = '#2e6371';
            context.fillRect(66, 146, 458, 464);
            context.fillStyle = '#f6f0dd';
            context.fillRect(54, 650, 482, 142);
            return canvas.toDataURL('image/png');
        }"""
    )
    return base64.b64decode(data_url.split(",", 1)[1])


def assert_no_overflow(page):
    dimensions = page.evaluate(
        """() => ({
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: document.documentElement.clientWidth,
            panelWidth: document.querySelector('.recognition-panel')?.scrollWidth,
            panelClientWidth: document.querySelector('.recognition-panel')?.clientWidth,
        })"""
    )
    assert dimensions["documentWidth"] <= dimensions["viewportWidth"] + 1, dimensions
    if dimensions["panelWidth"] is not None:
        assert dimensions["panelWidth"] <= (
            dimensions["panelClientWidth"] + 1
        ), dimensions


ARTIFACTS.mkdir(parents=True, exist_ok=True)

with sync_playwright() as playwright:
    browser = launch_browser(playwright)
    context = browser.new_context(
        viewport={"width": 1440, "height": 1000},
        permissions=["clipboard-read", "clipboard-write"],
    )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(f"{BASE_URL}/print/", wait_until="domcontentloaded")
    page.wait_for_selector(".print-app")
    fixture = create_card_grid(page)

    page.get_by_role(
        "button",
        name="卡牌图像识别",
        exact=False,
    ).click()
    page.locator(
        ".recognition-panel input[type=file]",
    ).set_input_files({
        "name": "blue-eyes-grid.png",
        "mimeType": "image/png",
        "buffer": fixture,
    })
    page.wait_for_selector(".recognition-item")
    assert page.locator(".region-box").count() == 2
    assert page.locator(".recognition-item").count() == 1
    assert "合计 2" in page.locator(".results-summary").inner_text()
    assert_no_overflow(page)
    page.screenshot(
        path=ARTIFACTS / "recognition-desktop.png",
        full_page=True,
    )

    page.wait_for_function(
        """() => document.querySelector('.recognized-identity strong')
            ?.textContent.includes('青眼白龙')""",
        timeout=180_000,
    )
    assert "89631139" in page.locator(".recognized-identity").inner_text()
    assert "已确认 2" in page.locator(".results-summary").inner_text()
    page.get_by_role("button", name="导入 2 张").click()
    page.wait_for_selector(".recognition-panel", state="detached")
    blue_eyes = page.locator(".deck-card-tile").filter(has_text="青眼白龙")
    blue_eyes.wait_for(timeout=60_000)
    assert "×2" in blue_eyes.inner_text()
    main_count = page.locator(".section-check").filter(
        has_text="主卡组",
    ).locator("strong")
    assert main_count.inner_text().strip() == "2"

    visual_page = context.new_page()
    visual_requests = []
    visual_page.on("pageerror", lambda error: errors.append(str(error)))
    visual_page.on("request", lambda request: visual_requests.append(request.url))
    visual_page.goto(f"{BASE_URL}/print/", wait_until="domcontentloaded")
    visual_page.wait_for_selector(".print-app")
    artwork_fixture = create_artwork_grid(visual_page)
    visual_page.get_by_role(
        "button",
        name="卡牌图像识别",
        exact=False,
    ).click()
    visual_page.locator(
        ".recognition-panel input[type=file]",
    ).set_input_files({
        "name": "blue-eyes-artwork-grid.png",
        "mimeType": "image/png",
        "buffer": artwork_fixture,
    })
    visual_page.wait_for_selector(".recognition-item")
    visual_page.wait_for_function(
        """() => {
            const names = [...document.querySelectorAll(
                '.recognized-identity strong',
            )];
            return names.length > 0 &&
                names.every(node => node.textContent.includes('青眼白龙'));
        }""",
        timeout=60_000,
    )
    assert visual_page.locator(
        ".recognition-item.confident",
    ).count() == visual_page.locator(".recognition-item").count()
    assert any(
        "card-fingerprints" in request
        for request in visual_requests
    )
    assert not any(
        request.startswith("https://cdn.jsdelivr.net/npm/tesseract")
        for request in visual_requests
    )
    visual_page.screenshot(
        path=ARTIFACTS / "recognition-visual-match.png",
        full_page=True,
    )

    sections_page = context.new_page()
    sections_page.on("pageerror", lambda error: errors.append(str(error)))
    sections_page.goto(f"{BASE_URL}/print/", wait_until="domcontentloaded")
    sections_page.wait_for_selector(".print-app")
    sections_fixture = create_structured_deck_sheet(sections_page)
    sections_page.get_by_role(
        "button",
        name="卡牌图像识别",
        exact=False,
    ).click()
    sections_page.locator(
        ".recognition-panel input[type=file]",
    ).set_input_files({
        "name": "structured-deck-sheet.png",
        "mimeType": "image/png",
        "buffer": sections_fixture,
    })
    sections_page.wait_for_function(
        "() => document.querySelectorAll('.region-box').length === 70",
    )
    grouped_sections = sections_page.locator(
        ".recognition-item",
    ).evaluate_all(
        """items => items.reduce((result, item) => {
            const section = item.querySelector('select').value;
            const count = Number(
                item.querySelector('.recognized-crop > span')
                    .textContent.slice(1),
            );
            result[section] = (result[section] || 0) + count;
            return result;
        }, {})"""
    )
    assert grouped_sections == {"main": 40, "extra": 15, "side": 15}
    assert sections_page.locator(".recognition-item").count() == 3
    sections_page.wait_for_function(
        """() => {
            const names = [...document.querySelectorAll(
                '.recognized-identity strong',
            )];
            return names.length === 3 &&
                names.every(node => node.textContent.includes('青眼白龙'));
        }""",
        timeout=60_000,
    )
    sections_page.get_by_role("button", name="导入 70 张").click()
    sections_page.wait_for_selector(".recognition-panel", state="detached")
    section_counts = {}
    for label, key in [
        ("主卡组", "main"),
        ("额外", "extra"),
        ("副卡组", "side"),
    ]:
        section_counts[key] = sections_page.locator(
            ".section-check",
        ).filter(has_text=label).locator("strong").inner_text().strip()
    assert section_counts == {"main": "40", "extra": "15", "side": "15"}
    sections_page.screenshot(
        path=ARTIFACTS / "recognition-sections.png",
        full_page=True,
    )

    pending_page = context.new_page()
    pending_page.on("pageerror", lambda error: errors.append(str(error)))
    pending_page.goto(f"{BASE_URL}/print/", wait_until="domcontentloaded")
    pending_page.wait_for_selector(".print-app")
    pending_fixture = create_unknown_card(pending_page)
    pending_page.get_by_role(
        "button",
        name="卡牌图像识别",
        exact=False,
    ).click()
    pending_page.locator(
        ".recognition-panel input[type=file]",
    ).set_input_files({
        "name": "unknown-card.png",
        "mimeType": "image/png",
        "buffer": pending_fixture,
    })
    pending_page.wait_for_function(
        """() => {
            const review = document.querySelector('.review-command');
            const retry = document.querySelector('.recognize-command');
            return review && !review.disabled &&
                review.textContent.includes('处理 1 张待确认') &&
                retry?.textContent.includes('重新识别');
        }""",
        timeout=180_000,
    )
    assert "1 组待确认" in pending_page.locator(
        ".pending-review-banner",
    ).inner_text()
    assert pending_page.locator(".review-command").get_attribute(
        "title",
    ) == "还有 1 张卡片需要确认"
    pending_box = pending_page.locator(
        ".recognition-item.review, "
        ".recognition-item.error, "
        ".recognition-item.unresolved",
    ).first.bounding_box()
    results_box = pending_page.locator(
        ".recognition-results",
    ).bounding_box()
    assert pending_box["y"] >= results_box["y"]
    assert pending_box["y"] + pending_box["height"] <= (
        results_box["y"] + results_box["height"] + 1
    )
    pending_page.locator(".review-command").click()
    assert pending_page.evaluate(
        """() => Boolean(
            document.activeElement?.closest('.recognition-item.review, ' +
                '.recognition-item.error, .recognition-item.unresolved'),
        )"""
    )
    pending_page.screenshot(
        path=ARTIFACTS / "recognition-pending-review.png",
        full_page=True,
    )

    home_page = context.new_page()
    home_page.on("pageerror", lambda error: errors.append(str(error)))
    home_page.goto(f"{BASE_URL}/", wait_until="domcontentloaded")
    image_workspace = home_page.get_by_role(
        "link",
        name="卡牌图像识别",
        exact=False,
    )
    assert image_workspace.get_attribute("href") == "./recognize/"
    entry_rows = home_page.locator(
        ".workspace-commands a",
    ).evaluate_all(
        "links => links.map(link => Math.round(link.getBoundingClientRect().y))"
    )
    assert len(entry_rows) == 6
    assert len(set(entry_rows)) == 1
    home_page.screenshot(
        path=ARTIFACTS / "recognition-home-entry.png",
        full_page=True,
    )
    home_page.locator(
        '.quick-file-command + input[type="file"]',
    ).set_input_files({
        "name": "home-image-grid.png",
        "mimeType": "image/png",
        "buffer": artwork_fixture,
    })
    home_page.wait_for_selector(".recognition-panel")
    home_page.get_by_title("关闭").click()
    home_page.wait_for_selector(".recognition-panel", state="detached")
    home_page.locator(".quick-text-command textarea").fill(
        "#main\n89631139\n89631139\n#extra\n!side\n"
    )
    home_page.get_by_title("解析并打开卡组").click()
    home_page.wait_for_url("**/print/", timeout=30_000)
    home_page.wait_for_function(
        """() => document.querySelector(
            '.section-check strong',
        )?.textContent.trim() === '2'""",
    )

    standalone = context.new_page()
    standalone.on("pageerror", lambda error: errors.append(str(error)))
    standalone.goto(
        f"{BASE_URL}/recognize/",
        wait_until="domcontentloaded",
    )
    standalone.wait_for_selector(".recognition-app")
    standalone_fixture = create_artwork_grid(standalone)
    standalone.locator(
        ".recognition-panel input[type=file]",
    ).set_input_files({
        "name": "blue-eyes-artwork-grid.png",
        "mimeType": "image/png",
        "buffer": standalone_fixture,
    })
    standalone.get_by_role(
        "button",
        name="复制文本",
    ).wait_for(timeout=60_000)
    assert standalone.locator(".image-import-trigger").count() == 0
    assert standalone.locator(".import-command").count() == 0
    standalone.get_by_role("button", name="复制文本").click()
    copied_ydk = standalone.evaluate(
        "() => navigator.clipboard.readText()"
    )
    assert "#main\n89631139\n89631139\n" in copied_ydk
    assert "#extra\n" in copied_ydk
    assert "!side\n" in copied_ydk
    with standalone.expect_download() as download_info:
        standalone.get_by_role("button", name="下载 YDK").click()
    download = download_info.value
    assert download.suggested_filename == "blue-eyes-artwork-grid.ydk"
    assert Path(download.path()).read_text() == copied_ydk
    assert_no_overflow(standalone)
    standalone.screenshot(
        path=ARTIFACTS / "recognition-standalone.png",
        full_page=True,
    )

    standalone.set_viewport_size({"width": 390, "height": 844})
    assert_no_overflow(standalone)
    standalone.screenshot(
        path=ARTIFACTS / "recognition-standalone-mobile.png",
        full_page=True,
    )

    home_mobile = context.new_page()
    home_mobile.set_viewport_size({"width": 390, "height": 844})
    home_mobile.goto(f"{BASE_URL}/", wait_until="domcontentloaded")
    mobile_entry_rows = home_mobile.locator(
        ".workspace-commands a",
    ).evaluate_all(
        "links => links.map(link => Math.round(link.getBoundingClientRect().y))"
    )
    assert len(set(mobile_entry_rows)) == 2
    assert_no_overflow(home_mobile)
    home_mobile.screenshot(
        path=ARTIFACTS / "recognition-home-mobile.png",
        full_page=True,
    )

    mobile = context.new_page()
    mobile.set_viewport_size({"width": 390, "height": 844})
    mobile.goto(f"{BASE_URL}/print/", wait_until="domcontentloaded")
    mobile.wait_for_selector(".print-app")
    mobile.get_by_role(
        "button",
        name="卡牌图像识别",
        exact=False,
    ).click()
    mobile.locator(
        ".recognition-panel input[type=file]",
    ).set_input_files({
        "name": "blue-eyes-grid.png",
        "mimeType": "image/png",
        "buffer": fixture,
    })
    mobile.wait_for_selector(".recognition-item")
    assert_no_overflow(mobile)
    mobile.screenshot(
        path=ARTIFACTS / "recognition-mobile.png",
        full_page=True,
    )

    assert not errors, errors
    print({
        "regions": 2,
        "recognized": "89631139",
        "copies": 2,
        "structured_sections": section_counts,
        "standalone_ydk_bytes": len(copied_ydk.encode()),
        "page_errors": errors,
    })
    browser.close()
