import os
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / ".runtime" / "e2e"
BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:5174")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROJECT_ID = "e2e-analysis-project"


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
            clientWidth: document.documentElement.clientWidth,
        })"""
    )
    assert dimensions["scrollWidth"] <= dimensions["clientWidth"] + 1, dimensions


ARTIFACTS.mkdir(parents=True, exist_ok=True)

with sync_playwright() as playwright:
    browser = launch_browser(playwright)
    context = browser.new_context(
        viewport={"width": 1440, "height": 1000},
        accept_downloads=True,
    )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(f"{BASE_URL}/", wait_until="domcontentloaded")
    page.evaluate(
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
            "id": PROJECT_ID,
            "revision": 0,
            "kind": "deck",
            "schemaVersion": 3,
            "name": "E2E 构筑分析",
            "deck": {
                "main": (
                    ["14558127"] * 3
                    + ["23434538"] * 3
                    + ["89631139"] * 34
                ),
                "extra": [],
                "side": ["10045474"] * 3 + ["27204311"] * 3,
            },
            "customCards": {},
            "playtest": {
                "roles": {
                    "14558127": ["starter", "handtrap"],
                    "23434538": ["extender", "handtrap"],
                    "10045474": ["handtrap"],
                    "27204311": ["boardbreaker", "handtrap"],
                },
                "autoTaggedCardIds": [
                    "14558127",
                    "23434538",
                    "10045474",
                    "27204311",
                    "89631139",
                ],
                "customRoles": [],
                "goals": [{
                    "id": "goal-analysis",
                    "name": "初动 + 补点",
                    "mode": "all",
                    "conditions": [
                        {
                            "roleId": "starter",
                            "comparator": "atLeast",
                            "count": 1,
                        },
                        {
                            "roleId": "extender",
                            "comparator": "atLeast",
                            "count": 1,
                        },
                    ],
                }],
                "activeGoalId": "goal-analysis",
                "history": [],
            },
            "printQueue": [],
            "createdAt": "2026-09-07T00:00:00.000Z",
            "updatedAt": "2026-09-07T00:00:00.000Z",
        },
    )
    page.evaluate(
        """id => localStorage.setItem(
            'yugioh-card-active-project:deck',
            id
        )""",
        PROJECT_ID,
    )
    page.goto(f"{BASE_URL}/playtest/", wait_until="domcontentloaded")
    wait_for_network(page)
    page.locator(".analysis-panel").wait_for(timeout=120_000)

    page.get_by_label("构筑快照名称").fill("比赛前定稿")
    page.get_by_title("保存当前构筑快照").click()
    assert page.get_by_label("选择构筑快照").locator(
        "option",
        has_text="比赛前定稿",
    ).count() == 1

    page.get_by_label("分析配置名称").fill("通用稳定性")
    page.get_by_title("保存分析配置").click()
    assert page.get_by_label("选择分析配置").locator(
        "option",
        has_text="通用稳定性",
    ).count() == 1

    page.get_by_title("新增换备方案").click()
    page.get_by_role("button", name="添加交换").click()
    assert page.locator(".side-swap-row").count() == 1
    page.get_by_title("应用换备方案").click()
    page.wait_for_function(
        "() => document.querySelector('.role-notice')?.textContent"
        ".includes('已应用')"
    )
    assert page.locator(".lab-header > strong").inner_text() == "40 张主卡组"

    format_select = page.locator(".profile-fields select").first
    format_select.select_option("custom")
    page.get_by_label("自定义禁限卡表").fill("14558127=1")
    page.get_by_role("button", name="应用手动表").click()
    page.locator(".error-list").wait_for()
    assert "3 / 1" in page.locator(".error-list").inner_text()

    page.get_by_text("实卡库存", exact=True).click()
    page.locator(".inventory-toggle input").check()
    page.locator(".inventory-list input").first.fill("1")
    page.get_by_role("button", name="缺卡加入打印队列").click()
    page.wait_for_function(
        "() => document.querySelector('.role-notice')?.textContent"
        ".includes('打印队列')"
    )

    page.get_by_text("赛事", exact=True).locator("..").locator("input").fill(
        "秋季店赛"
    )
    tag_input = page.get_by_text(
        "标签",
        exact=True,
    ).locator("..").locator("input")
    tag_input.fill("竞技, 后攻")
    tag_input.press("Tab")

    with page.expect_download() as download_info:
        page.get_by_role("button", name="分析报告").click()
    report_path = ARTIFACTS / "deck-analysis.html"
    download_info.value.save_as(report_path)
    report = report_path.read_text()
    assert "E2E 构筑分析" in report
    assert "当前构筑" in report
    assert "秋季店赛" in report

    assert page.locator(".role-distribution").count() >= 6
    assert page.locator(".diagnosis-lab").is_visible()
    assert_no_overflow(page)
    page.screenshot(
        path=ARTIFACTS / "analysis-desktop.png",
        full_page=True,
    )

    page.wait_for_timeout(1_000)
    second_page = context.new_page()
    second_page.goto(f"{BASE_URL}/playtest/", wait_until="domcontentloaded")
    second_page.locator(".analysis-panel").wait_for(timeout=120_000)
    page.get_by_text("赛事", exact=True).locator("..").locator("input").fill(
        "跨页同步测试"
    )
    page.wait_for_timeout(1_000)
    second_page.locator(".project-sync-warning").wait_for(timeout=30_000)
    second_page.close()

    page.reload(wait_until="domcontentloaded")
    page.locator(".analysis-panel").wait_for(timeout=120_000)
    assert page.get_by_label("选择构筑快照").locator(
        "option",
        has_text="比赛前定稿",
    ).count() == 1
    assert page.get_by_label("选择换备方案").locator("option").count() == 1
    assert page.get_by_label("选择分析配置").locator(
        "option",
        has_text="通用稳定性",
    ).count() == 1

    page.set_viewport_size({"width": 390, "height": 844})
    assert_no_overflow(page)
    page.screenshot(
        path=ARTIFACTS / "analysis-mobile.png",
        full_page=True,
    )
    assert not errors, errors
    browser.close()

print({
    "report_bytes": report_path.stat().st_size,
    "page_errors": errors,
})
