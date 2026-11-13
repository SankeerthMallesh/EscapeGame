# Escape from Joury

A first-person Halloween horror game in **one HTML file**: `escape-from-joury.html`.
Three.js is packed inside the file and every sound is made in code, so it plays offline with nothing else to download.

## How to play

1. Download `escape-from-joury.html`.
2. Double-click it to open it in Chrome, Edge, Firefox or Safari.
3. Click **PLAY**. Headphones make it much scarier.

| Key | Action |
|---|---|
| WASD | Move |
| Mouse | Look (click the game to lock the mouse; if your browser blocks that, click and drag) |
| Shift | Sprint (uses stamina, and it's loud) |
| C | Crouch (slow, quiet, harder to spot) |
| F | Flashlight on/off (in the cabin it also switches to the UV light once you find it) |
| E | Free a kid, pick something up, inspect, use the keypad |
| M | Big map |
| Esc | Pause |

## The game

- **Backstory:** 6 short cinematic slides (Skip button in the corner).
- **Island:** find the 10 kids hidden at 10 landmarks. Yellow dots on the minimap show where they are; they turn green once saved.
- **Joury** wakes up about 25 seconds in (Normal). He stalks you, teleports behind you, and gets faster with every kid you save. Don't stare at him too long.
- **Caught?** You wake up in his cabin with a countdown. Find the 4 hidden digits, type them on the door keypad, and escape while he's stunned.
- **Boat parts** (hull planks, oars, engine and fuel can) appear only after all 10 kids are saved. Bring them to the dock to build the boat and escape at sunrise.

## Why it's scary

Joury isn't a random monster. He's a kid who lost one Minecraft match, said "NOT GG. NEVER GG.", and then never logged off. A year later, on Halloween, every kid who laughed at him got the same message: *"joury: who wants a rematch?"* The island is the map he built for it. The horror comes from that story leaking into the game itself:

- **The game talks back.** A multiplayer-style chat sits in the corner. The kids you haven't found yet type to you, scared and getting worse. Then Joury starts typing too. He comments on what you're doing, and when he catches you the chat says *[SERVER] You were eliminated by Joury.*
- **He won't let you quit.** The first time he catches you, the game pretends to crash with a "not responding" box. Then the box changes, because he doesn't let people quit.
- **His diary.** Torn pages are nailed to posts around the island. Read them in order and you learn what a year of staying online did to him, from Day 1 to Day 365.
- **He hunts by sound and light.** Sprinting, walking on wood, and a flashlight beam all draw him in. Crouch with the light off and he can walk right past you. He can also copy the kids' voices to lure you somewhere.
- **The storm.** Rain, thunder, and lightning that lights up the whole island for a moment. Sometimes it shows you he's standing much closer than you thought.
- **The pumpkins warn you.** Jack-o'-lanterns go dark when he's near them, so a line of lights going out is him coming towards you.

## Graphics

Everything you see is generated in code when the game loads. There are no image files.

- **Realistic surfaces:** grass, packed dirt, dead leaves, bark, weathered planks, stained wallpaper, stone, rust, fabric and skin, each with color, bumps and shine.
- **Lighting:** a flashlight with real shadows and a beam in the fog, moonlight through storm clouds, lightning, glowing jack-o'-lanterns with bloom, and a flickering bulb in the cabin.
- **Weather:** heavy rain, wet ground that turns shiny under the flashlight, and puddles that ripple.
- **Camera:** eye adaptation (the picture adjusts when you shine the light on something close), film color grading, grain, vignette, and TV static when Joury is near.
- **Forest:** 950 trees with bark and needle or leaf foliage, plus bushes, stumps, fallen logs, rocks, swaying grass, fireflies and ground mist.
- **Characters:** jointed people with faces, in fabric costumes. The flashback slides about the block game stay blocky on purpose.

**Difficulty:** Easy, Normal or Nightmare. **Graphics:** Low, Medium or High. Use Low if the game feels slow on an older laptop.

## Project files

| Path | What it is |
|---|---|
| `escape-from-joury.html` | The finished game: everything in one file. This is the only file you need to play. |
| `src/shell.html`, `src/style.css` | The page layout and styles. |
| `src/js/` | The game code, one file per part (audio, graphics, textures, models, people, island, player, Joury, scares and weather, cabin, story, HUD, game flow). |
| `vendor/three.iife.min.js` | Three.js r170 (MIT license), packed into the game file by the build. |
| `vendor/fonts/` | The three fonts the game uses (open licenses, see the README there), embedded by the build. |
| `build.mjs` | Joins everything into `escape-from-joury.html`. |
| `tests/` | Automated play-throughs in a headless browser: `flow.cjs` (story → game → rescue → caught → cabin puzzle → escape), `flow2.cjs` (boat parts → ending → Play Again), `flow3.cjs` (caught again → timer runs out → Retry → escape), `scares.cjs`, `crash.cjs` and `stare.cjs` (storm, chat, diary pages, pumpkins, stare-to-catch, fake crash). |

## Changing the game

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
node build.mjs
```

That rebuilds `escape-from-joury.html` from `src/`. To run the automated play-through:

```bash
npm install
npx playwright install chromium
npm test
```

Screenshots from the test run are saved in `tests/shots/`. The tests wait generously because headless browsers draw 3D in software, which can be a hundred times slower than a real graphics card, so a full run can take an hour.
