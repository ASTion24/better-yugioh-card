import json
import os
import re
import sqlite3
import struct
import zipfile
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / ".runtime" / "e2e"
BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:5174")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ARTWORK = ROOT / "src" / "assets" / "image" / "blue-eyes.jpg"
PRERELEASE_CARD_ID = 101307001


def launch_browser(playwright):
    try:
        return playwright.chromium.launch(headless=True)
    except Exception:
        return playwright.chromium.launch(
            headless=True,
            executable_path=CHROME,
            args=["--disable-breakpad", "--disable-crash-reporter", "--no-first-run"],
        )


def wait_for_network(page):
    try:
        page.wait_for_load_state("networkidle", timeout=10_000)
    except PlaywrightTimeoutError:
        pass


def assert_no_overflow(page):
    dimensions = page.evaluate(
        """() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth
        })"""
    )
    assert dimensions["scrollWidth"] <= dimensions["clientWidth"] + 1, dimensions


def png_dimensions(path):
    payload = path.read_bytes()
    assert payload.startswith(b"\x89PNG\r\n\x1a\n")
    return struct.unpack(">II", payload[16:24])


def pdf_page_count(path):
    return len(re.findall(rb"/Type\s*/Page\b", path.read_bytes()))


def create_prerelease_fixture():
    database_path = ARTIFACTS / "test-release.cdb"
    archive_path = ARTIFACTS / "test-prerelease.ypk"
    database_path.unlink(missing_ok=True)
    database = sqlite3.connect(database_path)
    database.executescript("""
        CREATE TABLE datas (
            id INTEGER PRIMARY KEY,
            ot INTEGER,
            alias INTEGER,
            setcode INTEGER,
            type INTEGER,
            atk INTEGER,
            def INTEGER,
            level INTEGER,
            race INTEGER,
            attribute INTEGER,
            category INTEGER
        );
        CREATE TABLE texts (
            id INTEGER PRIMARY KEY,
            name TEXT,
            desc TEXT
        );
    """)
    database.execute(
        "INSERT INTO datas VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (PRERELEASE_CARD_ID, 3, 0, 0, 0x21, 2000, 0, 4, 0x1, 0x10, 0),
    )
    database.execute(
        "INSERT INTO texts VALUES (?, ?, ?)",
        (
            PRERELEASE_CARD_ID,
            "太阳神的咏诗者-地狱诗人",
            "这个卡名的效果1回合只能使用1次。",
        ),
    )
    database.commit()
    database.close()
    with zipfile.ZipFile(
        archive_path,
        "w",
        compression=zipfile.ZIP_DEFLATED,
    ) as archive:
        archive.write(database_path, "test-release.cdb")
        archive.write(ARTWORK, f"pics/{PRERELEASE_CARD_ID}.jpg")
    database_path.unlink()
    return archive_path


def wait_for_data_image(page, locator, timeout=120_000):
    locator.wait_for(timeout=timeout)
    page.wait_for_function(
        """image => image.complete &&
            image.naturalWidth > 0 &&
            image.src.startsWith('data:image/')""",
        arg=locator.element_handle(),
        timeout=timeout,
    )


ARTIFACTS.mkdir(parents=True, exist_ok=True)
PRERELEASE_FIXTURE = create_prerelease_fixture()

with sync_playwright() as playwright:
    browser = launch_browser(playwright)
    context = browser.new_context(
        viewport={"width": 1440, "height": 1000},
        accept_downloads=True,
        permissions=["clipboard-read", "clipboard-write"],
    )
    context.route(
        "**/ygopro-super-pre*.ypk",
        lambda route: route.fulfill(
            status=200,
            body=PRERELEASE_FIXTURE.read_bytes(),
            headers={
                "access-control-allow-origin": "*",
                "cache-control": "no-cache",
                "content-type": "application/octet-stream",
                "etag": '"e2e-prerelease-v1"',
            },
        ),
    )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))

    page.goto(f"{BASE_URL}/", wait_until="domcontentloaded")
    page.wait_for_selector(".workspace-launcher")
    assert page.locator(".workspace-commands a").count() == 6
    assert page.locator('.workspace-commands a[href="./playtest/"]').count() == 1
    assert "本地存储" not in page.locator(".launcher-header").inner_text()
    assert "卡片与构筑工具" in page.locator(".launch-heading").inner_text()
    star_link = page.get_by_role(
        "link",
        name="在 GitHub 上 Star Better YGO",
    )
    assert star_link.get_attribute("href") == (
        "https://github.com/ASTion24/better-yugioh-card"
    )
    assert star_link.get_attribute("target") == "_blank"
    assert_no_overflow(page)

    page.goto(f"{BASE_URL}/batch/", wait_until="domcontentloaded")
    wait_for_network(page)
    page.get_by_role("button", name="示例").click()
    assert page.locator(".batch-list > article").count() == 2
    page.locator(".batch-preview img").wait_for(timeout=60_000)
    assert page.locator(".batch-preview img").evaluate(
        "(image) => image.naturalWidth >= 1394 && image.naturalHeight >= 2031"
    )

    art_input = page.locator(
        'input[type="file"][accept="image/png,image/jpeg,image/webp"]'
        ':not([multiple])'
    )
    art_input.set_input_files(str(ARTWORK))
    page.locator(".cropper-backdrop").wait_for()
    page.locator(".cropper-panel input[type='range']").first.fill("1.35")
    page.get_by_role("button", name="应用裁切").click()
    page.locator(".cropper-backdrop").wait_for(state="detached")
    cropped_artwork = page.locator(".image-field input").input_value()
    assert cropped_artwork.startswith("data:image/jpeg;base64,")
    crop_dimensions = page.evaluate(
        """async source => {
            const image = new Image();
            image.src = source;
            await image.decode();
            return [image.naturalWidth, image.naturalHeight];
        }""",
        cropped_artwork,
    )
    assert crop_dimensions == [1200, 1200]

    name_input = page.get_by_text("卡片名称", exact=True).locator("..").locator("input")
    name_input.fill("批量回归测试卡")
    page.get_by_title("保存批量制卡方案").click()
    page.wait_for_timeout(800)
    assert "批量回归测试卡" in page.locator(".batch-list").inner_text()

    page.get_by_title("全选").click()
    assert "2 张已选" in page.locator(".batch-production-toolbar").inner_text()
    language_select = page.get_by_text(
        "语言",
        exact=True,
    ).locator("..").locator("select")
    language_select.select_option("en")
    page.get_by_title("将当前卡片样式应用到所选卡片").click()
    page.locator(".batch-card-row").nth(1).click()
    assert language_select.input_value() == "en"
    page.locator(".batch-card-row").first.click()
    page.get_by_label("批量字段", exact=True).select_option("rare")
    page.get_by_label("批量字段值", exact=True).select_option("ur")
    page.get_by_role("button", name="应用", exact=True).click()
    with page.expect_download() as download_info:
        page.get_by_title("导出 JSON").click()
    batch_json_path = ARTIFACTS / "batch-data.json"
    download_info.value.save_as(batch_json_path)
    batch_payload = json.loads(batch_json_path.read_text())
    assert all(card["rare"] == "ur" for card in batch_payload["cards"])
    assert all("batchId" not in card for card in batch_payload["cards"])
    page.get_by_title("清除选择").click()

    artwork_files = page.locator(
        'input[type="file"][multiple]'
        '[accept="image/png,image/jpeg,image/webp"]'
    )
    artwork_files.set_input_files([{
        "name": "00000001.jpg",
        "mimeType": "image/jpeg",
        "buffer": ARTWORK.read_bytes(),
    }])
    page.wait_for_function(
        "() => document.querySelector('.status-message')?.textContent"
        ".includes('1 / 1')"
    )
    ready_filter = page.locator(
        ".batch-quality-filters button",
    ).filter(has_text="可生产")
    blocked_filter = page.locator(
        ".batch-quality-filters button",
    ).filter(has_text="阻断")
    assert ready_filter.locator("strong").inner_text() == "1"
    assert blocked_filter.locator("strong").inner_text() == "1"
    ready_filter.click()
    assert page.locator(".batch-list > article").count() == 1
    assert "批量回归测试卡" in page.locator(".batch-list").inner_text()
    blocked_filter.click()
    assert page.locator(".batch-list > article").count() == 1
    assert "静默航路" in page.locator(".batch-list").inner_text()
    page.locator(
        ".batch-quality-filters button",
    ).filter(has_text="全部").click()
    page.locator(".batch-card-row").first.click()
    page.get_by_title("定位下一张待处理卡片").click()
    assert page.locator(".editor-heading h2").inner_text().strip() == "静默航路"
    page.locator(".batch-card-row").first.click()

    first_checkbox = page.locator(
        ".batch-list article",
    ).first.locator("input[type='checkbox']")
    first_checkbox.check()
    assert "当前仅生产所选 1 张" in page.locator(
        ".production-scope",
    ).inner_text()
    with page.expect_download(timeout=180_000) as download_info:
        page.get_by_role("button", name="导出生产包").click()
    production_zip = ARTIFACTS / "batch-production.zip"
    download_info.value.save_as(production_zip)
    with zipfile.ZipFile(production_zip) as archive:
        production_names = archive.namelist()
        assert len([
            name for name in production_names
            if name.startswith("cards/") and name.endswith(".png")
        ]) == 1
        assert "manifest.csv" in production_names
        assert "batch-data.json" in production_names
        manifest = archive.read("manifest.csv").decode()
        assert "批量回归测试卡" in manifest
        assert ",ready," in manifest
        production_payload = json.loads(
            archive.read("batch-data.json").decode()
        )
        assert len(production_payload["cards"]) == 1
        assert "batchId" not in production_payload["cards"][0]
        assert "dataUrl" not in production_payload["cards"][0]

    page.wait_for_timeout(800)
    page.get_by_role("button", name="送往卡组打印工作台").click()
    page.wait_for_url("**/print/**")
    print_custom_tile = page.locator(".deck-card-tile").filter(
        has_text="批量回归测试卡",
    )
    print_custom_tile.wait_for(timeout=60_000)
    page.goto(f"{BASE_URL}/batch/", wait_until="domcontentloaded")
    wait_for_network(page)
    page.locator(".batch-list > article").first.wait_for()
    page.locator(".batch-card-row").first.click()

    with page.expect_download(timeout=120_000) as download_info:
        page.get_by_role("button", name="下载当前 PNG").click()
    png_path = ARTIFACTS / "batch-current.png"
    download_info.value.save_as(png_path)
    width, height = png_dimensions(png_path)
    assert width >= 1394 and height >= 2031

    with page.expect_download(timeout=180_000) as download_info:
        page.get_by_role("button", name="导出全部 PNG").click()
    zip_path = ARTIFACTS / "batch-cards.zip"
    download_info.value.save_as(zip_path)
    with zipfile.ZipFile(zip_path) as archive:
        names = archive.namelist()
        assert len(names) == 2
        assert all(name.endswith(".png") for name in names)
        assert all(archive.read(name).startswith(b"\x89PNG") for name in names)
    page.screenshot(path=ARTIFACTS / "batch-desktop.png", full_page=True)

    page.get_by_title("新增卡片").click()
    batch_password = page.get_by_text(
        "卡片密码",
        exact=True,
    ).locator("..").locator("input")
    batch_password.fill("89631139")
    page.locator(".batch-list article").last.locator("input[type='checkbox']").check()
    page.get_by_title("批量匹配官方资料").click()
    page.wait_for_function(
        "() => document.querySelector('.editor-heading h2')?.textContent"
        ".trim() === '青眼白龙'",
        timeout=120_000,
    )
    page.get_by_title("在单卡DIY工坊中精修").click()
    page.wait_for_url("**/editor/**")
    page.wait_for_selector(".deck-writeback-bar")
    refined_name = page.get_by_text(
        "卡片名称",
        exact=True,
    ).locator("..").locator("input")
    refined_name.fill("批量精修回写卡")
    page.get_by_role("button", name="替换原卡并返回").click()
    page.wait_for_url("**/batch/**")
    page.locator(".batch-list").get_by_text(
        "批量精修回写卡",
        exact=True,
    ).wait_for(timeout=120_000)
    page.get_by_title("创建批量制卡方案副本").click()
    page.wait_for_function(
        "() => document.querySelector('.project-bar select')"
        "?.selectedOptions[0]?.textContent.includes('副本')"
    )

    page.goto(f"{BASE_URL}/print/", wait_until="domcontentloaded")
    wait_for_network(page)
    render_policy = page.locator(".render-policy")
    assert "排版预览" in render_policy.inner_text()
    assert "快速卡图" in render_policy.inner_text()
    assert "PDF 打印" in render_policy.inner_text()
    assert "高清重绘" in render_policy.inner_text()
    assert page.get_by_role("button", name="快速卡图").count() == 0
    assert "PDF · 高清重绘" in page.locator(".preview-footer").inner_text()
    assert "原创卡示例" not in page.locator(".project-bar select").inner_text()
    assert page.get_by_text("0.1 mm", exact=True).count() == 1
    custom_tile = page.locator(".deck-card-tile").filter(
        has_text="批量回归测试卡",
    )
    custom_tile.wait_for(timeout=60_000)
    wait_for_data_image(page, custom_tile.locator("img"), timeout=120_000)
    with page.expect_download(timeout=180_000) as download_info:
        page.get_by_role("button", name="生成打印 PDF").click()
    custom_pdf = ARTIFACTS / "custom-card.pdf"
    download_info.value.save_as(custom_pdf)
    assert custom_pdf.read_bytes().startswith(b"%PDF")

    page.get_by_role("button", name="载入示例").click()
    page.wait_for_timeout(500)
    page.get_by_role("button", name="检查卡组").click()
    page.wait_for_function(
        "() => document.querySelector('.deck-message')?.textContent"
        ".includes('检查完成')",
        timeout=120_000,
    )
    assert "主卡组数量不符合标准构筑" in page.locator(
        ".inspection-panel",
    ).inner_text()
    page.locator(".calibration summary").click()
    with page.expect_download(timeout=60_000) as download_info:
        page.get_by_role("button", name="下载校准测试页").click()
    calibration_pdf = ARTIFACTS / "calibration.pdf"
    download_info.value.save_as(calibration_pdf)
    assert pdf_page_count(calibration_pdf) == 1

    page.get_by_role("button", name="撤销上次导入").click()
    custom_tile.wait_for(timeout=60_000)
    assert "批量回归测试卡" in custom_tile.inner_text()
    page.get_by_role("button", name="载入示例").click()
    page.wait_for_timeout(500)
    page.get_by_role("button", name="追加到当前").click()
    page.locator("#deck-text-input").fill(
        "#main\n46986414\n#extra\n!side",
    )
    main_count = page.locator(".section-check").filter(
        has_text="主卡组",
    ).locator("strong")
    page.wait_for_function(
        "element => element.textContent.trim() === '9'",
        arg=main_count.element_handle(),
    )
    assert "active" in (
        page.get_by_role("button", name="替换当前").get_attribute("class") or ""
    )
    page.get_by_role("button", name="撤销上次导入").click()
    page.wait_for_function(
        "element => element.textContent.trim() === '8'",
        arg=main_count.element_handle(),
    )
    queue = page.locator(".print-queue")
    blue_eyes_queue = queue.locator("article").filter(has_text="89631139")
    blue_eyes_deck = page.locator(".deck-card-tile").filter(has_text="89631139")
    assert blue_eyes_queue.locator("output").inner_text() == "3"
    blue_eyes_queue.get_by_title("减少打印份数").click()
    assert blue_eyes_queue.locator("output").inner_text() == "2"
    assert blue_eyes_deck.locator(".card-count-badge").inner_text() == "×3"
    queue.get_by_title("从卡组重置").click()
    assert blue_eyes_queue.locator("output").inner_text() == "3"

    layout_select = page.get_by_text(
        "排版方式",
        exact=True,
    ).locator("..").locator("select")
    layout_select.select_option("top-right")
    paper_box = page.locator(".paper").bounding_box()
    corner_box = page.locator(".card-slot").first.bounding_box()
    corner_right = page.locator(".card-slot").nth(2).bounding_box()
    assert abs(corner_box["y"] - paper_box["y"]) < 2
    assert abs(
        corner_right["x"] + corner_right["width"] -
        paper_box["x"] - paper_box["width"]
    ) < 2
    layout_select.select_option("cut-efficient")
    assert page.locator(".card-slot").count() == 10
    assert page.locator(".card-slot.rotated").count() == 10
    assert "2 页 A4" in page.locator(".preview-footer").inner_text()
    cut_first = page.locator(".card-slot").first.bounding_box()
    assert abs(cut_first["x"] - paper_box["x"]) < 2
    assert abs(cut_first["y"] - paper_box["y"]) < 2
    layout_select.select_option("dense")
    assert page.locator(".card-slot").count() == 11
    assert page.locator(".card-slot.rotated").count() == 5
    dense_first = page.locator(".card-slot").first.bounding_box()
    assert abs(dense_first["x"] - paper_box["x"]) < 2
    assert abs(dense_first["y"] - paper_box["y"]) < 2
    page.locator(".project-bar input[aria-label='卡组名称']").fill("E2E 卡组")
    blue_eyes_queue.get_by_title("减少打印份数").click()
    page.get_by_title("保存卡组").click()
    page.wait_for_timeout(800)
    page.reload(wait_until="domcontentloaded")
    blue_eyes_queue = page.locator(".print-queue article").filter(
        has_text="89631139",
    )
    blue_eyes_queue.wait_for()
    assert blue_eyes_queue.locator("output").inner_text() == "2"

    page.locator("#deck-text-input").fill("#main\n46986414\n#extra\n!side")
    page.wait_for_timeout(500)
    assert page.locator(".print-queue article").count() == 1
    page.get_by_role("button", name="撤销上次导入").click()
    blue_eyes_queue = page.locator(".print-queue article").filter(
        has_text="89631139",
    )
    assert blue_eyes_queue.locator("output").inner_text() == "2"
    page.locator(".print-queue").get_by_title("从卡组重置").click()

    with page.expect_download(timeout=180_000) as download_info:
        page.locator(".print-queue").get_by_title("导出卡组总览图").click()
    overview_path = ARTIFACTS / "deck-overview.png"
    download_info.value.save_as(overview_path)
    overview_width, overview_height = png_dimensions(overview_path)
    assert overview_width == 1600
    assert overview_height >= 800
    assert overview_path.stat().st_size > 100_000

    blue_eyes_queue.get_by_title("减少打印份数").click()
    layout_select = page.get_by_text(
        "排版方式",
        exact=True,
    ).locator("..").locator("select")
    layout_select.select_option("center")
    page.get_by_text(
        "双面打印卡背",
        exact=True,
    ).locator("..").locator("input").check()
    with page.expect_download(timeout=180_000) as download_info:
        page.get_by_role("button", name="生成打印 PDF").click()
    duplex_pdf = ARTIFACTS / "duplex-standard-back.pdf"
    download_info.value.save_as(duplex_pdf)
    assert pdf_page_count(duplex_pdf) == 4
    assert duplex_pdf.stat().st_size < 15 * 1024 * 1024
    with page.expect_download(timeout=240_000) as download_info:
        page.get_by_role("button", name="生成完整交付包").click()
    delivery_zip = ARTIFACTS / "deck-delivery.zip"
    download_info.value.save_as(delivery_zip)
    with zipfile.ZipFile(delivery_zip) as archive:
        delivery_names = archive.namelist()
        assert any(name.endswith(".pdf") for name in delivery_names)
        assert any(name.endswith("-overview.png") for name in delivery_names)
        assert any(name.endswith(".ydk") for name in delivery_names)
        project_file = next(
            name for name in delivery_names if name.endswith(".ygoproject")
        )
        assert b'"version": 3' in archive.read(project_file)
        assert any(name.endswith("-inspection.txt") for name in delivery_names)
    page.locator(".print-queue").get_by_title("从卡组重置").click()

    source = page.locator(".deck-card-tile").filter(has_text="89631139")
    target = page.locator(".deck-card-tile").filter(has_text="55144522")
    source.drag_to(target)
    page.wait_for_timeout(400)
    main_text = page.locator("#deck-text-input").input_value().split("#extra")[0]
    assert main_text.index("46986414") < main_text.index("89631139")
    source.click()
    page.get_by_role("button", name="在单卡DIY工坊中打开").click()
    page.wait_for_url("**/editor/**")
    page.wait_for_selector(".deck-writeback-bar")
    page.wait_for_function(
        """() => {
            const title = document.querySelector(
                '.document-title small'
            )?.textContent.trim();
            const notice = document.querySelector(
                '.database-message'
            )?.textContent.trim();
            return title === '青眼白龙' &&
                notice?.startsWith('已载入 青眼白龙');
        }""",
        timeout=90_000,
    )
    deck_card_name = page.get_by_text(
        "卡片名称",
        exact=True,
    ).locator("..").locator("input")
    deck_card_name.fill("卡组回写测试卡")
    page.get_by_role("button", name="替换原卡并返回").click()
    page.wait_for_url("**/print/**")
    page.wait_for_function(
        """async () => {
            const request = indexedDB.open('yugioh-card-workspace');
            const database = await new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            const transaction = database.transaction('projects', 'readonly');
            const projects = await new Promise((resolve, reject) => {
                const query = transaction.objectStore('projects').getAll();
                query.onsuccess = () => resolve(query.result);
                query.onerror = () => reject(query.error);
            });
            return projects.some(project =>
                Object.values(project.customCards || {}).some(card =>
                    card.name === '卡组回写测试卡'
                )
            );
        }""",
        timeout=120_000,
    )
    rewritten_project_id = page.evaluate(
        """async () => {
            const request = indexedDB.open('yugioh-card-workspace');
            const database = await new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            const transaction = database.transaction('projects', 'readonly');
            const projects = await new Promise((resolve, reject) => {
                const query = transaction.objectStore('projects').getAll();
                query.onsuccess = () => resolve(query.result);
                query.onerror = () => reject(query.error);
            });
            database.close();
            return projects.find(project =>
                Object.values(project.customCards || {}).some(card =>
                    card.name === '卡组回写测试卡'
                )
            )?.id || '';
        }"""
    )
    assert rewritten_project_id
    page.evaluate(
        """id => localStorage.setItem(
            'yugioh-card-active-project:deck',
            id
        )""",
        rewritten_project_id,
    )
    page.reload(wait_until="domcontentloaded")
    rewritten_tile = page.locator(".deck-card-tile").filter(
        has_text="卡组回写测试卡",
    )
    rewritten_tile.wait_for(timeout=120_000)
    wait_for_data_image(page, rewritten_tile.locator("img"), timeout=120_000)
    assert rewritten_tile.locator(".card-count-badge").inner_text() == "×3"
    page.screenshot(path=ARTIFACTS / "deck-desktop.png", full_page=True)

    original_deck_id = page.locator(".project-bar select").input_value()
    playtest_project_id = "e2e-playtest-project"
    playtest_page = context.new_page()
    playtest_page.on(
        "pageerror",
        lambda error: errors.append(f"playtest: {error}"),
    )
    playtest_page.goto(f"{BASE_URL}/", wait_until="domcontentloaded")
    playtest_page.evaluate(
        """project => new Promise((resolve, reject) => {
            const request = indexedDB.open('yugioh-card-workspace');
            request.onsuccess = () => {
                const database = request.result;
                const transaction = database.transaction('projects', 'readwrite');
                transaction.objectStore('projects').put(project);
                transaction.oncomplete = () => {
                    database.close();
                    resolve();
                };
                transaction.onerror = () => reject(transaction.error);
            };
            request.onerror = () => reject(request.error);
        })""",
        {
            "id": playtest_project_id,
            "kind": "deck",
            "schemaVersion": 2,
            "name": "E2E 对局实验室",
            "deck": {
                "main": (
                    ["14558127"] * 3
                    + ["23434538"] * 3
                    + ["10045474"] * 3
                    + ["89631139"] * 31
                ),
                "extra": [],
                "side": [],
            },
            "customCards": {},
            "createdAt": "2026-09-07T00:00:00.000Z",
            "updatedAt": "2026-09-07T00:00:00.000Z",
        },
    )
    playtest_page.evaluate(
        """id => localStorage.setItem(
            'yugioh-card-active-project:deck',
            id
        )""",
        playtest_project_id,
    )
    playtest_page.goto(
        f"{BASE_URL}/playtest/",
        wait_until="domcontentloaded",
    )
    playtest_page.locator(".goal-editor").wait_for(timeout=120_000)
    handtrap_row = playtest_page.locator(".probability-row").filter(
        has_text="手坑",
    )
    assert "9 / 40" in handtrap_row.inner_text()

    role_cards = playtest_page.locator(".role-card-grid article")
    starter_role = playtest_page.locator(".role-actions button").filter(
        has_text="初动",
    )
    assert starter_role.get_attribute("aria-pressed") == "true"
    role_cards.nth(0).locator(".card-select").click()
    playtest_page.locator(".role-actions button").filter(
        has_text="补点",
    ).click()
    role_cards.nth(1).locator(".card-select").click()
    assert "0.0%" not in playtest_page.locator(".goal-result").inner_text()

    playtest_page.get_by_label("自定义角色名称").fill("一卡动")
    playtest_page.get_by_title("添加自定义角色").click()
    role_cards.nth(3).locator(".card-select").click()
    custom_role_row = playtest_page.locator(".probability-row").filter(
        has_text="一卡动",
    )
    assert "31 / 40" in custom_role_row.inner_text()

    playtest_page.get_by_role("button", name="批量选择").click()
    role_cards.nth(0).locator(".card-select").click()
    role_cards.nth(1).locator(".card-select").click()
    playtest_page.locator(".role-actions button").filter(
        has_text="解场",
    ).click()
    assert role_cards.nth(0).locator(".card-role-tag").filter(
        has_text="解场",
    ).count() == 1
    assert role_cards.nth(1).locator(".card-role-tag").filter(
        has_text="解场",
    ).count() == 1
    playtest_page.get_by_role("button", name="单卡标记").click()

    playtest_page.get_by_role("button", name="添加条件").click()
    goal_condition = playtest_page.locator(".goal-condition").last
    goal_condition.locator("select").nth(0).select_option("brick")
    goal_condition.locator("select").nth(1).select_option("atMost")
    goal_condition.locator("input").fill("1")

    playtest_page.get_by_role("button", name="后攻 5+1").click()
    history_before = int(
        playtest_page.locator(".history-stats > span")
        .nth(0)
        .locator("strong")
        .inner_text()
    )
    playtest_page.get_by_role("button", name="命中", exact=True).click()
    first_hand_card = playtest_page.locator(
        ".opening-hand article",
    ).first
    first_hand_card.get_by_title("锁定卡片").click()
    locked_name = first_hand_card.locator("> span").inner_text()
    playtest_page.get_by_title("保留锁定卡并重抽其余卡片").click()
    playtest_page.wait_for_function(
        """expected => document.querySelector(
            '.opening-hand article > span'
        )?.textContent === expected""",
        arg=locked_name,
        timeout=30_000,
    )
    assert playtest_page.get_by_role(
        "button",
        name="命中",
        exact=True,
    ).is_disabled()
    playtest_page.locator(".opening-hand article").nth(1).get_by_title(
        "从卡组随机换一张",
    ).click()
    playtest_page.get_by_title("重新洗牌并抽取").click()
    history_after = int(
        playtest_page.locator(".history-stats > span")
        .nth(0)
        .locator("strong")
        .inner_text()
    )
    assert history_after == history_before + 1
    playtest_page.get_by_role("button", name="废件手", exact=True).click()
    playtest_page.wait_for_function(
        "() => document.querySelector('.role-notice')?.textContent"
        ".includes('试手数据已保存')",
        timeout=30_000,
    )
    playtest_page.wait_for_function(
        """expected => new Promise((resolve, reject) => {
            const request = indexedDB.open('yugioh-card-workspace');
            request.onsuccess = () => {
                const database = request.result;
                const transaction = database.transaction(
                    'projects',
                    'readonly'
                );
                const read = transaction.objectStore('projects').get(
                    expected.id
                );
                read.onsuccess = () => {
                    const playtest = read.result?.playtest;
                    database.close();
                    resolve(
                        playtest?.goals?.[0]?.conditions?.length === 3 &&
                        playtest?.history?.length === expected.history
                    );
                };
                read.onerror = () => {
                    database.close();
                    reject(read.error);
                };
            };
            request.onerror = () => reject(request.error);
        })""",
        arg={"id": playtest_project_id, "history": history_after},
        timeout=30_000,
    )
    assert_no_overflow(playtest_page)
    playtest_page.screenshot(
        path=ARTIFACTS / "playtest-desktop.png",
        full_page=True,
    )
    playtest_page.reload(wait_until="domcontentloaded")
    playtest_page.locator(".goal-editor").wait_for(timeout=120_000)
    playtest_page.wait_for_function(
        "() => document.querySelectorAll('.goal-condition').length === 3",
        timeout=30_000,
    )
    assert playtest_page.locator(".role-actions button").filter(
        has_text="一卡动",
    ).count() == 1
    assert playtest_page.locator(".goal-condition").count() == 3
    playtest_page.wait_for_function(
        """expected => new Promise((resolve, reject) => {
            const visible = Number(document.querySelector(
                '.history-stats > span strong'
            )?.textContent);
            const request = indexedDB.open('yugioh-card-workspace');
            request.onsuccess = () => {
                const database = request.result;
                const transaction = database.transaction(
                    'projects',
                    'readonly'
                );
                const read = transaction.objectStore('projects').get(
                    expected.id
                );
                read.onsuccess = () => {
                    const persisted = read.result?.playtest?.history?.length;
                    database.close();
                    resolve(
                        visible >= expected.minimum &&
                        persisted >= expected.minimum &&
                        visible === persisted
                    );
                };
                read.onerror = () => {
                    database.close();
                    reject(read.error);
                };
            };
            request.onerror = () => reject(request.error);
        })""",
        arg={"id": playtest_project_id, "minimum": history_after},
        timeout=30_000,
    )
    assert int(
        playtest_page.locator(".history-stats > span")
        .nth(0)
        .locator("strong")
        .inner_text()
    ) >= history_after
    playtest_page.set_viewport_size({"width": 390, "height": 844})
    playtest_page.wait_for_function(
        """() => {
            const images = [...document.querySelectorAll(
                '.role-card-grid img, .opening-hand img'
            )];
            return images.length > 0 &&
                images.every(image => image.complete && image.naturalWidth > 0);
        }""",
        timeout=120_000,
    )
    assert_no_overflow(playtest_page)
    playtest_page.screenshot(
        path=ARTIFACTS / "playtest-mobile.png",
        full_page=True,
    )
    playtest_page.evaluate(
        """id => localStorage.setItem(
            'yugioh-card-active-project:deck',
            id
        )""",
        original_deck_id,
    )
    playtest_page.close()

    page.get_by_title("生成可编辑批量草稿").click()
    page.wait_for_url("**/batch/**", timeout=180_000)
    page.locator(".batch-list > article").first.wait_for(timeout=180_000)
    assert page.locator(".batch-list > article").count() == 5

    page.goto(f"{BASE_URL}/library/", wait_until="domcontentloaded")
    wait_for_network(page)
    assert "加入：E2E 卡组" in page.locator(".result-header").inner_text()

    page.goto(f"{BASE_URL}/?card=89631139", wait_until="domcontentloaded")
    page.wait_for_url("**/editor/**")
    assert page.url.endswith("/editor/?card=89631139")
    wait_for_network(page)
    page.wait_for_function(
        "() => document.querySelector('.document-title small')?.textContent.trim() === '青眼白龙'",
        timeout=90_000,
    )
    assert "已载入" in page.locator(".database-message").inner_text()
    page.get_by_role("button", name="检查更新").click()
    page.wait_for_function(
        "() => document.querySelector('.database-message')?.textContent"
        ".includes('资料')",
        timeout=120_000,
    )
    page.get_by_title("加入当前批量制卡方案").click()
    page.wait_for_function(
        "() => document.querySelector('.database-message')?.textContent"
        ".includes('已加入')",
        timeout=120_000,
    )
    page.locator(".project-bar input[aria-label='单卡草稿名称']").fill("E2E 单卡")
    page.get_by_title("保存单卡草稿").click()
    page.wait_for_function(
        "() => Boolean(document.querySelector('.project-bar select')?.value)",
    )
    card_name_input = page.get_by_text("卡片名称", exact=True).locator("..").locator("input")
    card_name_input.fill("单卡草稿自动保存")
    page.wait_for_timeout(1_000)
    page.goto(f"{BASE_URL}/editor/", wait_until="domcontentloaded")
    page.wait_for_function(
        "() => document.querySelector('.document-title small')?.textContent.trim() === '单卡草稿自动保存'",
        timeout=60_000,
    )
    page.wait_for_function(
        "() => document.querySelector('.render-state')?.textContent.trim() === '实时预览'",
        timeout=60_000,
    )
    page.get_by_role("tab", name="卡图", exact=True).click()
    editor_image_input = page.locator(
        'input[type="file"][accept="image/png,image/jpeg,image/webp"]'
    )
    editor_image_input.set_input_files(str(ARTWORK))
    page.locator(".cropper-backdrop").wait_for()
    page.get_by_role("button", name="应用裁切").click()
    page.locator(".cropper-backdrop").wait_for(state="detached")
    editor_artwork = page.get_by_text(
        "图片地址",
        exact=True,
    ).locator("..").locator("input")
    assert editor_artwork.input_value().startswith("data:image/jpeg;base64,")
    page.wait_for_timeout(500)
    preview_layout = page.evaluate(
        """() => {
            const stage = document.querySelector('.preview-stage').getBoundingClientRect();
            const shell = document.querySelector('.preview-shell').getBoundingClientRect();
            return {stage, shell};
        }"""
    )
    assert preview_layout["shell"]["width"] <= preview_layout["stage"]["width"]
    assert preview_layout["shell"]["height"] <= preview_layout["stage"]["height"]
    page.screenshot(path=ARTIFACTS / "editor-desktop.png", full_page=True)
    page.get_by_role("button", name="Rush").click()
    page.wait_for_function(
        "() => document.querySelector('.document-title span')?.textContent.trim() === 'Rush Duel'",
        timeout=60_000,
    )
    page.goto(f"{BASE_URL}/", wait_until="domcontentloaded")
    page.wait_for_selector(".workspace-launcher")
    deck_text = page.locator(".project-list").inner_text()
    assert "E2E 卡组" in deck_text
    assert "E2E 单卡" not in deck_text
    page.get_by_label("搜索本地卡组").fill("E2E 卡组")
    assert page.locator(".project-list > button").count() == 1
    page.get_by_role("button", name="编辑卡组 E2E 卡组").click()
    page.wait_for_url("**/print/**")
    page.wait_for_function(
        "() => document.querySelector('.project-bar select')"
        "?.selectedOptions[0]?.textContent.trim() === 'E2E 卡组'",
    )
    page.goto(f"{BASE_URL}/", wait_until="domcontentloaded")
    page.wait_for_selector(".workspace-launcher")
    with page.expect_download() as download_info:
        page.get_by_title("备份全部卡组").click()
    workspace_backup = ARTIFACTS / "workspace-backup.ygoworkspace"
    download_info.value.save_as(workspace_backup)
    workspace_payload = json.loads(workspace_backup.read_text())
    assert workspace_payload["format"] == "yugioh-card-workspace"
    assert workspace_payload["projects"]
    assert all(
        project["kind"] == "deck"
        for project in workspace_payload["projects"]
    )
    workspace_payload["projects"].append({
        "id": "ignored-card-draft",
        "kind": "card",
        "name": "不应由首页恢复",
        "cardKind": "yugioh",
        "data": {"name": "不应由首页恢复"},
    })
    workspace_backup.write_text(
        json.dumps(workspace_payload, ensure_ascii=False),
    )
    page.evaluate(
        """async () => {
            const request = indexedDB.open('yugioh-card-workspace');
            const database = await new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            const transaction = database.transaction('projects', 'readwrite');
            transaction.objectStore('projects').clear();
            await new Promise((resolve, reject) => {
                transaction.oncomplete = resolve;
                transaction.onerror = () => reject(transaction.error);
            });
            database.close();
        }"""
    )
    page.reload(wait_until="domcontentloaded")
    page.wait_for_function(
        "() => document.querySelector('.launcher-status span')"
        "?.textContent.trim() === '0 套本地卡组'"
    )
    page.locator(
        ".recent-tools "
        'input[type="file"][accept*=".ygoworkspace"]',
    ).set_input_files(str(workspace_backup))
    page.wait_for_function(
        "() => document.querySelector('.workspace-notice')?.textContent"
        ".includes('已恢复')"
    )
    assert "E2E 卡组" in page.locator(".project-list").inner_text()
    restored_kinds = page.evaluate(
        """async () => {
            const request = indexedDB.open('yugioh-card-workspace');
            const database = await new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            const transaction = database.transaction('projects', 'readonly');
            const records = await new Promise((resolve, reject) => {
                const read = transaction.objectStore('projects').getAll();
                read.onsuccess = () => resolve(read.result);
                read.onerror = () => reject(read.error);
            });
            database.close();
            return records.map(record => record.kind);
        }"""
    )
    assert restored_kinds and set(restored_kinds) == {"deck"}
    page.screenshot(path=ARTIFACTS / "launcher-desktop.png", full_page=True)

    page.goto(f"{BASE_URL}/print/", wait_until="domcontentloaded")
    page.wait_for_function(
        "() => Boolean(document.querySelector('.project-bar select')?.value)",
    )
    page.locator("#deck-text-input").fill(
        "#main\n101307001\n#extra\n!side",
    )
    deck_thumbnail = page.locator(".deck-card-tile").filter(
        has_text="101307001",
    ).locator("img")
    wait_for_data_image(page, deck_thumbnail)
    wait_for_data_image(page, page.locator(".card-slot img").first)
    page.wait_for_function(
        """() => {
            const image = document.querySelector('.card-slot img');
            return image?.src.startsWith('data:image/') &&
                image.naturalWidth >= 1394 &&
                image.naturalHeight >= 2031;
        }""",
        timeout=180_000,
    )

    page.goto(
        f"{BASE_URL}/library/?q=101307001",
        wait_until="domcontentloaded",
    )
    library_thumbnail = page.locator(".card-catalog article").filter(
        has_text="101307001",
    ).locator("img").first
    wait_for_data_image(page, library_thumbnail)

    page.goto(f"{BASE_URL}/editor/", wait_until="domcontentloaded")
    page.get_by_label("卡片数据库搜索").fill("太阳神的咏诗者-地狱诗人")
    page.get_by_role("button", name="匹配").click()
    editor_thumbnail = page.locator(
        ".database-results button",
    ).first.locator("img")
    wait_for_data_image(page, editor_thumbnail)
    page.screenshot(
        path=ARTIFACTS / "prerelease-thumbnails.png",
        full_page=True,
    )

    mobile = context.new_page()
    mobile.set_viewport_size({"width": 390, "height": 844})
    for path, selector in [
        ("/batch/", ".batch-app"),
        ("/library/", ".library-app"),
        ("/print/", ".print-app"),
        ("/editor/", ".card-studio"),
        ("/", ".workspace-launcher"),
    ]:
        mobile.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded")
        mobile.wait_for_selector(selector)
        assert_no_overflow(mobile)
        if path == "/":
            mobile.screenshot(
                path=ARTIFACTS / "launcher-mobile.png",
                full_page=True,
            )
    mobile.goto(f"{BASE_URL}/batch/", wait_until="domcontentloaded")
    mobile.get_by_role("button", name="示例").click()
    mobile.locator(".batch-preview img").wait_for(timeout=60_000)
    mobile.screenshot(path=ARTIFACTS / "batch-mobile.png", full_page=True)

    assert not errors, errors
    print({
        "batch_png": {
            "width": width,
            "height": height,
            "bytes": png_path.stat().st_size,
        },
        "crop_dimensions": crop_dimensions,
        "overview_png": {
            "width": overview_width,
            "height": overview_height,
            "bytes": overview_path.stat().st_size,
        },
        "duplex_pdf": {
            "pages": pdf_page_count(duplex_pdf),
            "bytes": duplex_pdf.stat().st_size,
        },
        "delivery_entries": delivery_names,
        "zip_entries": names,
        "production_entries": production_names,
        "page_errors": errors,
    })
    browser.close()
