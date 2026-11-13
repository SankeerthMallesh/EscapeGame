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
| Shift | Sprint (uses stamina) |
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

**Difficulty:** Easy, Normal or Nightmare. **Graphics:** Low, Medium or High. Use Low if the game feels slow on an older laptop.

## Project files

| Path | What it is |
|---|---|
| `escape-from-joury.html` | The finished game: everything in one file. This is the only file you need to play. |
| `src/shell.html`, `src/style.css` | The page layout and styles. |
| `src/js/` | The game code, one file per part (audio, graphics, models, island, player, Joury, cabin, story, HUD, game flow). |
| `vendor/three.iife.min.js` | Three.js r170 (MIT license), packed into the game file by the build. |
| `build.mjs` | Joins everything into `escape-from-joury.html`. |
| `tests/` | Automated play-through in a headless browser (story → game → rescue → caught → cabin → escape → boat → ending). |

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

Screenshots from the test run are saved in `tests/shots/`.
