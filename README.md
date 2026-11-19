# SOLBAY

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Cube-666/solbay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Cube-666/solbay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

SOLBAY is an open-world crime game in the spirit of GTA 6: a sun-soaked coastal city
you explore on foot and by car, with traffic and pedestrians, cars to steal, a wanted
level and police who chase you, a four-mission story, combat, and a HUD with a live
minimap. It runs offline in a desktop browser from its own static files — no network,
no accounts, no Rockstar assets. Everything (city, characters, vehicles, names, story,
art, sound, music) is original.

You are **Dario Cole**, a driver-for-hire in Solbay. Mama Rosa has work for you: fares,
hot cars, heat from the Solbay PD, and one last big score at the Port.

## The city

Solbay is a procedural coastal city: a 7×7 road grid with a downtown of glass towers
(including the 110 m Solbay Tower), a plaza with a fountain, parks full of palm trees,
a parking lot, a container port, and Palm Beach — sand, a marina pier, a yacht, and the
sea to the south. Buildings wear procedural facades (lit windows, shopfronts, neon
signs), roads carry markings and crosswalks, and the sun casts real-time shadows.

## Systems

- **On foot and by car** — third-person character with walk/run animation; arcade
  driving with steering, handbrake, and collisions. Press **E** to get in or out of
  any car.
- **Traffic and pedestrians** — NPC cars cruise the grid, turn at intersections, and
  yield to the car ahead; pedestrians stroll the sidewalks and flee from gunfire and
  speeding cars.
- **Stealing cars** — take any parked or driven car. Stealing is a crime: the driver
  is thrown out and the police take notice.
- **Wanted level and police** — five stars. Crimes raise your heat; cruisers spawn,
  chase, ram, and try to bust you on foot. Stay clean and far away and the stars fade.
  Busted or wasted, you wake up at the hospital 10% lighter.
- **Missions and story** — four jobs with a marker beacon, HUD objective, and distance:
  1. *First Fare* — pick up the taxi and drive the client to the Marina ($300).
  2. *Hot Wheels* — steal the red Comet and deliver it to the garage ($800).
  3. *Heat* — lose a two-star wanted level, then reach the safehouse ($500).
  4. *The Big Score* — clear the Harbor crew at the Port, grab the package, deliver
     it to the yacht ($2,500). Then free roam.
- **Combat** — punch (**F**) and a pistol (mouse click) with tracers and muzzle flash.
  Armed Harbor crew shoot back.
- **HUD with minimap** — mission tracker, money, wanted stars, health bar, speedometer,
  and a live top-down minimap (roads, mission marker, traffic, police, enemies).
- **Start and save** — title screen with Continue, pause, and localStorage saves
  (money, mission, health, position) written on every mission and every 30 seconds.
- **Sound and music** — fully synthesized WebAudio: a synthwave pad/bass loop, engine
  hum, sirens, gunshots, crashes, and mission stingers. No audio files. **M** mutes.

## Controls

| Key | Action |
| --- | ------ |
| W A S D | Move / drive (Shift = run) |
| Mouse drag | Look around |
| E | Enter / exit car |
| Click | Shoot pistol |
| F | Punch |
| Space | Handbrake (while driving) |
| P / Esc | Pause |
| M | Mute |

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step: `game/` is
plain static files (`game/index.html` + ES modules), three.js is vendored under
`game/vendor/`, and nothing is fetched from the network.

## Layout

```
main.ts            entry program: copies game/ + screenshots/ to /output, writes dossier.json
serve.ts           tiny static server for local play (http://localhost:8080)
game/
  index.html       import map (three.js) + HUD + screens
  vendor/
    three.module.min.js   three.js 0.160.0, vendored
  src/
    main.js        boot, game loop, screens, entering/stealing cars, ?shot staging
    city.js        procedural city: roads, buildings, beach, marina, port, props
    textures.js    procedural canvas textures (facades, roads, sidewalks, sand)
    character.js   humanoid factory with walk/run animation
    vehicles.js    car factory: sedan, taxi, sports, truck, police cruiser
    player.js      third-person on-foot + arcade driving controller
    traffic.js     NPC cars and pedestrians
    police.js      wanted stars, cruiser pursuit, busted/wasted
    missions.js    four-mission story chain with marker beacons
    combat.js      pistol, punch, armed enemies, tracers
    audio.js       synthesized WebAudio music + effects
    hud.js         mission tracker, money, stars, health, speed, minimap
    input.js       keyboard/mouse (held keys + queued one-shot presses)
    save.js        localStorage save/load
    util.js        math + canvas-texture helpers
screenshots/      3–4 real renders of the game (first by name is the cover)
```

## License

MIT. See LICENSE.

---

<sub>Entered on [make.fun](https://make.fun/?ref=k11s2hyb&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
