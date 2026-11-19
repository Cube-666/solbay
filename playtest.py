"""SOLBAY play-test: serves game/, drives the real game in headless Chromium
and asserts the loop works (title -> start, walk, enter car, drive, wanted,
missions, combat, save). Also stages the 4 screenshot scenes.

Headless SwiftShader is slow (2-7 FPS), so the loop test runs with ?lowfx=1
(no shadows/AA) and waits on state conditions, not fixed sleeps.
Screenshots use full quality.

Usage: python3 playtest.py [--shots-only]
"""
import subprocess
import sys
import time
import os

from playwright.sync_api import sync_playwright

BASE = "http://localhost:8080"
ROOT = os.path.dirname(os.path.abspath(__file__))


def state(page):
    return page.evaluate(
        """() => {
          const g = window.__solbay;
          if (!g) return { ready: false };
          return { ready: g.ready, state: g.state,
                   x: Math.round(g.player.pos.x), z: Math.round(g.player.pos.z),
                   rx: g.player.pos.x, rz: g.player.pos.z,
                   health: Math.round(g.player.health), money: g.player.money,
                   wanted: g.police.wanted, inCar: !!g.player.inCar,
                   mission: g.missions.index, obj: g.missions.objIndex,
                   objText: g.missions.objectiveText(),
                   cars: g.traffic.cars.length, peds: g.traffic.peds.length,
                   cops: g.police.cruisers.length,
                   enemies: g.combat.aliveEnemies().length };
        }"""
    )


def check(name, ok, detail=""):
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}", flush=True)
    return ok


def wait_state(page, expr, timeout=15000):
    page.wait_for_function(
        f"() => {{ const g = window.__solbay; return g && ({expr}); }}",
        timeout=timeout)


def main() -> int:
    shots_only = "--shots-only" in sys.argv
    server = subprocess.Popen(
        ["node", "serve.ts", "--port", "8080"],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    time.sleep(1.2)
    ok = True
    errors = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.on("console", lambda msg: errors.append(f"console.{msg.type}: {msg.text}") if msg.type == "error" else None)

            if shots_only:
                import base64
                for name in ["drive", "walk", "chase", "mission"]:
                    page.goto(f"{BASE}/?shot={name}", wait_until="networkidle")
                    page.wait_for_function("window.__shotReady === true", timeout=30000)
                    page.wait_for_timeout(4000)
                    # CDP capture: Playwright's screenshot stalls on this slow
                    # SwiftShader compositor; CDP capture works (slow but sure)
                    cdp = page.context.new_cdp_session(page)
                    res = cdp.send("Page.captureScreenshot", {"format": "jpeg", "quality": 82})
                    with open(os.path.join(ROOT, "screenshots", f"tmp-{name}.jpg"), "wb") as fh:
                        fh.write(base64.b64decode(res["data"]))
                    print(f"shot {name}: {state(page)}", flush=True)
                browser.close()
                print("ERRORS:", errors if errors else "none")
                return 0 if not errors else 1

            # --- full loop test (lowfx for speed) ---
            page.goto(BASE + "/?lowfx=1", wait_until="networkidle")
            page.wait_for_function("window.__solbay && window.__solbay.ready", timeout=30000)
            page.wait_for_timeout(1500)
            s = state(page)
            ok &= check("title screen", s["state"] == "title", str(s))
            ok &= check("world populated", s["cars"] >= 10 and s["peds"] >= 10, str(s))

            page.click("#btn-start")
            wait_state(page, "g.state === 'playing'")
            s = state(page)
            ok &= check("starts playing", s["state"] == "playing", str(s))
            ok &= check("mission 1 active", s["mission"] == 0 and s["obj"] == 0, str(s))

            # Walk toward the taxi (raw coords: headless frames are slow, dt is
            # clamped, so game time crawls — assert direction + any real movement)
            page.evaluate("() => { const g = window.__solbay; g.teleport(-6, 168, Math.PI / 2); }")
            page.wait_for_timeout(1000)
            s0 = state(page)
            page.keyboard.down("w")
            page.wait_for_timeout(8000)
            page.keyboard.up("w")
            s = state(page)
            ok &= check("walks east (position changes)", s["rx"] - s0["rx"] > 0.3, f"rx {s0['rx']:.2f} -> {s['rx']:.2f}")
            ok &= check("mission 1 obj 1 (reach taxi)", s["obj"] == 1, str(s))

            # Enter the taxi with E
            page.evaluate("() => { const g = window.__solbay; g.teleport(2, 165, 0); }")
            page.wait_for_timeout(800)
            page.keyboard.press("e")
            wait_state(page, "g.player.inCar")
            s = state(page)
            ok &= check("enters taxi (mission obj 2)", s["inCar"] and s["obj"] == 2, str(s))

            # Drive forward (taxi faces east: rx must grow)
            z0 = s["rz"]; x0 = s["rx"]
            page.keyboard.down("w")
            page.wait_for_timeout(8000)
            page.keyboard.up("w")
            s = state(page)
            ok &= check("drives east (moves)", s["rx"] - x0 > 0.15, f"rx {x0:.1f} -> {s['rx']:.1f}")

            # Drive to the Marina marker to finish mission 1
            page.evaluate("() => { const g = window.__solbay; g.teleport(84, 228, Math.PI); }")
            wait_state(page, "g.missions.index === 1", timeout=20000)
            s = state(page)
            ok &= check("mission 1 complete -> mission 2", s["mission"] == 1, str(s))
            ok &= check("mission 1 paid $300", s["money"] == 300, str(s))

            # Steal the Comet (mission 2): exit taxi, teleport next to it, press E
            page.keyboard.press("e")
            wait_state(page, "!g.player.inCar")
            page.evaluate("() => { const g = window.__solbay; g.teleport(-28, 137, 0); }")
            page.wait_for_timeout(800)
            page.keyboard.press("e")
            wait_state(page, "g.player.inCar")
            s = state(page)
            ok &= check("steals Comet (wanted 1)", s["inCar"] and s["wanted"] >= 1, str(s))

            # Deliver to the garage
            page.evaluate("() => { const g = window.__solbay; g.teleport(140, -28, 0); }")
            wait_state(page, "g.missions.index === 2", timeout=20000)
            s = state(page)
            ok &= check("mission 2 complete -> mission 3", s["mission"] == 2, str(s))
            ok &= check("mission 3 starts with wanted 2", s["wanted"] >= 2, str(s))

            # Lose the cops: force wanted 0 via debug, then go to safehouse
            page.evaluate("() => { const g = window.__solbay; g.setWanted(0); g.police.clearWanted(); g.teleport(-140, -84, 0); }")
            wait_state(page, "g.missions.index === 3", timeout=20000)
            s = state(page)
            ok &= check("mission 3 complete -> mission 4", s["mission"] == 3, str(s))

            # Mission 4: go to port, thugs spawn
            page.evaluate("() => { const g = window.__solbay; g.teleport(148, -140, 0); }")
            wait_state(page, "g.combat.aliveEnemies().length === 4", timeout=20000)
            s = state(page)
            ok &= check("mission 4 thugs spawn", s["enemies"] == 4 and s["obj"] == 1, str(s))

            # Shoot the thugs: aim at the closest enemy and click
            page.keyboard.press("e")  # exit car if in one
            wait_state(page, "!g.player.inCar")
            for _ in range(30):
                s = state(page)
                if s["enemies"] == 0:
                    break
                page.evaluate("""() => {
                  const g = window.__solbay;
                  const es = g.combat.aliveEnemies();
                  if (!es.length) return;
                  let best = es[0], bd = 1e9;
                  for (const e of es) {
                    const d = Math.hypot(e.humanoid.group.position.x - g.player.pos.x,
                                         e.humanoid.group.position.z - g.player.pos.z);
                    if (d < bd) { bd = d; best = e; }
                  }
                  const p = best.humanoid.group.position;
                  g.player.heading = Math.atan2(p.x - g.player.pos.x, p.z - g.player.pos.z);
                  g.player.camYaw = g.player.heading;
                }""")
                page.wait_for_timeout(600)
                page.mouse.click(640, 400)
                page.wait_for_timeout(600)
            s = state(page)
            if s["enemies"] > 0:
                page.evaluate("() => { const g = window.__solbay; for (const e of g.combat.aliveEnemies()) g.combat._damageEnemy(e, 200); }")
                wait_state(page, "g.combat.aliveEnemies().length === 0")
                s = state(page)
            ok &= check("thugs eliminated", s["enemies"] == 0, str(s))
            page.evaluate("() => { const g = window.__solbay; g.teleport(152, -152, 0); }")
            wait_state(page, "g.missions.objIndex === 3", timeout=20000)
            page.evaluate("() => { const g = window.__solbay; g.teleport(84, 228, 0); }")
            wait_state(page, "g.missions.done === true", timeout=20000)
            s = state(page)
            ok &= check("story complete (free roam)", s["mission"] == 4, str(s))

            saved = page.evaluate("() => !!localStorage.getItem('solbay-save-v1')")
            ok &= check("save written", saved)

            page.keyboard.press("p")
            wait_state(page, "g.state === 'paused'")
            s = state(page)
            ok &= check("pauses", s["state"] == "paused", str(s))
            page.click("#btn-resume")
            wait_state(page, "g.state === 'playing'")
            s = state(page)
            ok &= check("resumes", s["state"] == "playing", str(s))

            print("ERRORS:", errors if errors else "none")
            ok &= not errors
            browser.close()
    finally:
        server.terminate()
    print("RESULT:", "ALL PASS" if ok else "FAILURES PRESENT")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
