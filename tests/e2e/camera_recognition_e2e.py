import os
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / ".runtime" / "e2e"
BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:5174")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

DENIED_CAMERA_SCRIPT = """
(() => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices) return;
    Object.defineProperty(mediaDevices, 'getUserMedia', {
        configurable: true,
        value: async () => {
            throw new DOMException('Permission denied', 'NotAllowedError');
        },
    });
})();
"""


def rgb_to_yuv(color):
    red, green, blue = color
    return (
        round(16 + (65.738 * red + 129.057 * green + 25.064 * blue) / 256),
        round(128 + (-37.945 * red - 74.494 * green + 112.439 * blue) / 256),
        round(128 + (112.439 * red - 94.154 * green - 18.285 * blue) / 256),
    )


def create_camera_fixture():
    width, height = 640, 480
    chroma_width, chroma_height = width // 2, height // 2
    background = rgb_to_yuv((52, 54, 50))
    y_channel = bytearray([background[0]]) * (width * height)
    cb_channel = bytearray([background[1]]) * (chroma_width * chroma_height)
    cr_channel = bytearray([background[2]]) * (chroma_width * chroma_height)

    def fill_rectangle(bounds, color):
        left, top, right, bottom = bounds
        y_value, cb_value, cr_value = rgb_to_yuv(color)
        for row in range(top, bottom):
            start = row * width + left
            y_channel[start:start + right - left] = bytes([y_value]) * (
                right - left
            )
        for row in range(top // 2, (bottom + 1) // 2):
            start = row * chroma_width + left // 2
            length = (right + 1) // 2 - left // 2
            cb_channel[start:start + length] = bytes([cb_value]) * length
            cr_channel[start:start + length] = bytes([cr_value]) * length

    for x in (20, 340):
        fill_rectangle((x, 36, x + 280, 444), (215, 189, 120))
        fill_rectangle((x + 7, 43, x + 273, 437), (242, 223, 168))
        fill_rectangle((x + 14, 50, x + 266, 430), (215, 189, 120))
        fill_rectangle((x + 31, 123, x + 249, 344), (46, 99, 113))
        fill_rectangle((x + 25, 351, x + 255, 421), (246, 240, 221))

    payload = (
        b"FRAME\n" +
        bytes(y_channel) +
        bytes(cb_channel) +
        bytes(cr_channel)
    )
    fixture = ARTIFACTS / "camera-card-grid.y4m"
    fixture.write_bytes(
        f"YUV4MPEG2 W{width} H{height} F10:1 Ip A1:1 C420jpeg\n".encode() +
        payload * 12
    )
    return fixture


def launch_browser(playwright, camera_fixture):
    camera_args = [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        f"--use-file-for-fake-video-capture={camera_fixture}",
    ]
    try:
        return playwright.chromium.launch(
            headless=True,
            args=camera_args,
        )
    except Exception:
        return playwright.chromium.launch(
            headless=True,
            executable_path=CHROME,
            args=[
                *camera_args,
                "--disable-breakpad",
                "--disable-crash-reporter",
                "--no-first-run",
            ],
        )


def assert_no_overflow(page):
    dimensions = page.evaluate(
        """() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
        })"""
    )
    assert dimensions["scrollWidth"] <= dimensions["clientWidth"] + 1, dimensions


ARTIFACTS.mkdir(parents=True, exist_ok=True)
CAMERA_FIXTURE = create_camera_fixture()

with sync_playwright() as playwright:
    browser = launch_browser(playwright, CAMERA_FIXTURE)
    context = browser.new_context(
        viewport={"width": 1440, "height": 1000},
        permissions=["camera"],
    )
    errors = []

    multi = context.new_page()
    multi.on("pageerror", lambda error: errors.append(str(error)))
    multi.goto(f"{BASE_URL}/recognize/", wait_until="domcontentloaded")
    multi.get_by_role("button", name="打开摄像头").click()
    multi.wait_for_function(
        "() => document.querySelector('.camera-stage video')?.videoWidth > 0"
    )
    assert "摄像头已就绪" in multi.locator(".camera-footer").inner_text()
    multi.evaluate(
        """() => {
            window.__firstTrack = document.querySelector(
                '.camera-stage video',
            ).srcObject.getVideoTracks()[0];
        }"""
    )
    assert multi.evaluate("() => window.__firstTrack.readyState") == "live"
    multi.get_by_title("切换前后摄像头").click()
    multi.wait_for_function(
        """() => window.__firstTrack.readyState === 'ended' &&
            document.querySelector('.camera-stage video')
                ?.srcObject?.getVideoTracks()[0]?.readyState === 'live'"""
    )
    multi.evaluate(
        """() => {
            window.__secondTrack = document.querySelector(
                '.camera-stage video',
            ).srcObject.getVideoTracks()[0];
        }"""
    )

    multi.get_by_role("button", name="多卡", exact=True).click()
    assert multi.locator(".camera-guide--multi").count() == 1
    multi.get_by_role("button", name="拍摄并识别").click()
    multi.wait_for_function(
        "() => document.querySelectorAll('.region-box').length === 2",
        timeout=60_000,
    )
    assert multi.locator(".layout-switch button.active").inner_text() == "自动"
    assert multi.evaluate("() => window.__secondTrack.readyState") == "ended"
    assert_no_overflow(multi)
    multi.screenshot(
        path=ARTIFACTS / "recognition-camera-multi.png",
        full_page=True,
    )

    single = context.new_page()
    single.on("pageerror", lambda error: errors.append(str(error)))
    single.goto(f"{BASE_URL}/recognize/", wait_until="domcontentloaded")
    single.get_by_role("button", name="打开摄像头").click()
    single.wait_for_function(
        "() => document.querySelector('.camera-stage video')?.videoWidth > 0"
    )
    assert single.locator(".camera-guide--single").count() == 1
    single.get_by_role("button", name="拍摄并识别").click()
    single.wait_for_function(
        "() => document.querySelectorAll('.region-box').length === 1",
        timeout=60_000,
    )
    assert single.locator(".layout-switch button.active").inner_text() == "单卡"

    closing = context.new_page()
    closing.goto(f"{BASE_URL}/recognize/", wait_until="domcontentloaded")
    closing.get_by_role("button", name="打开摄像头").click()
    closing.wait_for_function(
        "() => document.querySelector('.camera-stage video')?.videoWidth > 0"
    )
    closing.evaluate(
        """() => {
            window.__closingTrack = document.querySelector(
                '.camera-stage video',
            ).srcObject.getVideoTracks()[0];
        }"""
    )
    closing.get_by_title("关闭摄像头").click()
    assert closing.locator(".camera-workspace").count() == 0
    assert closing.evaluate("() => window.__closingTrack.readyState") == "ended"

    mobile = context.new_page()
    mobile.set_viewport_size({"width": 390, "height": 844})
    mobile.goto(f"{BASE_URL}/recognize/", wait_until="domcontentloaded")
    mobile.get_by_role("button", name="打开摄像头").click()
    mobile.wait_for_function(
        "() => document.querySelector('.camera-stage video')?.videoWidth > 0"
    )
    assert_no_overflow(mobile)
    mobile.screenshot(
        path=ARTIFACTS / "recognition-camera-mobile.png",
        full_page=True,
    )
    mobile.get_by_title("关闭摄像头").click()

    denied_context = browser.new_context(
        viewport={"width": 900, "height": 700},
    )
    denied_context.add_init_script(DENIED_CAMERA_SCRIPT)
    denied = denied_context.new_page()
    denied.on("pageerror", lambda error: errors.append(str(error)))
    denied.goto(f"{BASE_URL}/recognize/", wait_until="domcontentloaded")
    denied.get_by_role("button", name="打开摄像头").click()
    denied.get_by_text(
        "未获得摄像头权限，请在浏览器设置中允许访问",
        exact=True,
    ).wait_for()
    assert denied.get_by_role(
        "button",
        name="拍摄并识别",
    ).is_disabled()
    denied.screenshot(
        path=ARTIFACTS / "recognition-camera-denied.png",
        full_page=True,
    )

    assert not errors, errors
    print({
        "multi_regions": multi.locator(".region-box").count(),
        "single_regions": single.locator(".region-box").count(),
        "released_tracks": True,
        "permission_denied": True,
        "page_errors": errors,
    })
    denied_context.close()
    browser.close()
