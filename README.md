# Escape from Joury

A first-person Halloween horror game in **one HTML file**: `escape-from-joury.html`.
Three.js is packed inside the file and every sound is made in code, so it plays offline with nothing else to download.

## How to play

**Play online:** https://sankeerthmallesh.github.io/EscapeGame/ (works once GitHub Pages is turned on for this repo; see *Publishing* below)

Or play offline:

1. Download `escape-from-joury.html`.
2. Double-click it to open it in Chrome, Edge, Firefox or Safari.
3. Choose **Play alone**, or **Play together** to play online with friends. Headphones make it much scarier.

| Key | Action |
|---|---|
| WASD | Move |
| Mouse | Look (click the game to lock the mouse; if your browser blocks that, click and drag) |
| Shift | Sprint (uses stamina, and it's loud) |
| Right mouse | Aim: focus the flashlight into a long, bright beam (slower movement) |
| Space | Jump |
| Shift + C | Slide (while sprinting) |
| C | Crouch (slow, quiet, harder to spot) |
| F | Flashlight on/off (in the cabin it also switches to the UV light once you find it) |
| E | Free a kid, pick something up, inspect, use the keypad |
| M | Big map |
| Esc | Pause (online: opens the menu, the game keeps going) |
| T | Chat with your friends (online) |
| G | Throw a firecracker (Joury goes to check the noise) |
| Q | Blink behind the nearest survivor (VIP Joury only) |

## The game

- **Backstory:** 6 short cinematic slides (Skip button in the corner).
- **Island:** find the 10 kids hidden at 10 landmarks. Yellow dots on the minimap show where they are; they turn green once saved.
- **Joury** wakes up about 25 seconds in (Normal). He stalks you, teleports behind you, and gets faster with every kid you save. Don't stare at him too long.
- **Caught?** You wake up in his cabin with a countdown. Find the 4 hidden digits, type them on the door keypad, and escape while he's stunned.
- **Boat parts** (hull planks, oars, engine and fuel can) appear only after all 10 kids are saved. Bring them to the dock to build the boat and escape at sunrise.

## Story 2: Joury's House

Choose **Joury's House** on the main menu. A week after the rematch, Vivek blasted phonk in the voice chat for three hours, and Joury, who lives next door, snapped. This time he took **Gabe**.

It plays like a sneaking game:

- **Get in.** The front door is locked. The shed in the back yard has a crowbar, and the back door is only boarded up. Prying the boards off is loud, though.
- **Listen.** When you can hear Joury's phonk, he is sitting at his PC with his back to the door. When the music stops, he is up and walking around the house.
- **The key** to Gabe's room hangs on the wall right next to Joury's chair. Crouch (**C**) to sneak up behind him and take it.
- **Hide** in the wardrobe or the pantry when he chases you. If he saw you get in, he will check.
- **Get caught** and he throws you out on the front lawn. You keep what you found, but if Gabe was with you, he gets dragged back to his room.
- **Free Gabe**, unlock the front door from the inside, and get him out through the front gate.

The phonk in the game is an original cowbell beat made in code, not a real song.

## Play together (online, 2–4 players)

Everyone needs the same `escape-from-joury.html` file (or the same link) and an internet connection.

1. One player chooses **Play together → Host a game**. They get a join code made of 5 items from the game, like 🎃 Pumpkin · 🗝️ Key · 👻 Ghost · 🕯️ Candle · 🛶 Boat.
2. Everyone else chooses **Play together**, taps the same 5 items in the same order and presses **Confirm**. You can also join a game that has already started.
3. The host presses **Start**.

You share one island and one Joury:

- **One Joury hunts all of you.** He goes after whoever he hears or sees, and takes turns haunting each of you, so splitting up finds the kids faster but leaves you alone with him.
- **You see each other:** each friend has their own color, name tag and flashlight beam, and shows up on the map.
- **Getting caught** sends only you to the cabin. Joury drags you away, then comes back for the others. A friend can **bang on the cabin door** to give you 15 more seconds, but Joury hears it.
- **Chat** with **T**. But Joury reads the chat too. Sometimes a message from your friend isn't from your friend, and he can call to you in their voice.
- **The boat:** anyone can carry parts. The map shows who has what. When all four are on the boat, anyone can launch it, and everyone escapes together.
- The ending shows who freed the most kids and who got caught the most.

The game connects browsers directly (WebRTC). The free [PeerJS](https://peerjs.com) service only introduces them, so there is no game server to run. Some strict school or office networks block these connections.

## Codes and referrals

Open **Codes** on the main menu to type in a code. Each one unlocks a bonus for good:

| Code | Bonus |
|---|---|
| `KEYBOARD` | **👑 VIP Joury.** In an online game, press *Play as Joury* in the lobby. You become Joury and hunt your friends: they get a 20-second head start, you see in the dark, you catch them by touching them (or by letting them stare at you), and **Q** blinks you behind the nearest one. A gold "VIP · JOURY" title floats over you. |
| `VIVEK` | Sprint 40% longer. |
| `CANDY` | Your flashlight battery lasts 50% longer. |
| `BRIDGE` | Start every game with 2 extra firecrackers. |
| `REMATCH` | Joury waits 10 seconds longer before he wakes up. |
| `ADMIN` | **Admin panel.** Press **F8** during a game: teleport anywhere, god mode, speed ×2/×3, infinite stamina and battery, freeze/wake/stun Joury, free the kids, finish the boat, launch, show the cabin code, escape the cabin. Online, only the host can change the island and Joury. |

**Referral codes:** everyone gets their own code (like `JRY-PKDQA`) under Codes. Give it to a friend. When they enter it they get a bonus (a longer-lasting flashlight), and whenever the two of you play online together, you both get the **Squad bonus** (stamina comes back 30% faster).

Bonuses are saved in your browser, so they stay after you close the game.

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
- **First-person view:** your arm and flashlight on screen, like a shooter's weapon view: it sways, bobs, drops when you sprint and steadies when you aim. A compass strip at the top marks the kids, boat parts and dock.
- **Ambient occlusion** (Medium and High graphics): soft contact shadows in corners and where things meet the ground.
- **Characters:** jointed people with faces, in fabric costumes. The flashback slides about the block game stay blocky on purpose.

**Difficulty:** Easy, Normal or Nightmare. **Graphics:** Low, Medium or High. Use Low if the game feels slow on an older laptop.

## Project files

| Path | What it is |
|---|---|
| `escape-from-joury.html` | The finished game: everything in one file. This is the only file you need to play. |
| `src/shell.html`, `src/style.css` | The page layout and styles. |
| `src/js/` | The game code, one file per part (audio, graphics, textures, models, people, island, player, Joury, scares and weather, cabin, story, HUD, game flow). |
| `vendor/three.iife.min.js` | Three.js r170 (MIT license), packed into the game file by the build. |
| `vendor/peerjs.min.js` | PeerJS 1.5.4 (MIT license) for online play, packed in the same way. |
| `vendor/fonts/` | The three fonts the game uses (open licenses, see the README there), embedded by the build. |
| `build.mjs` | Joins everything into `escape-from-joury.html`. |
| `tests/` | Automated play-throughs in a headless browser: `flow.cjs` (story → game → rescue → caught → cabin puzzle → escape), `flow2.cjs` (boat parts → ending → Play Again), `flow3.cjs` (caught again → timer runs out → Retry → escape), `house.cjs` (story 2 from start to finish), `admin.cjs` and `admin2.cjs` (every admin button, island and house), `feel.cjs` (hands, jump, aim, slide, compass), `mp.cjs`, `mp2.cjs` and `mp3.cjs` (online: 2–3 players, lobby, sync, chat, caught, door knocking, late joining, leaving), `scares.cjs`, `crash.cjs` and `stare.cjs` (storm, chat, diary pages, pumpkins, stare-to-catch, fake crash). |

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

## Publishing

The game is hosted for free with GitHub Pages. `index.html` sends visitors straight to the game, and `.nojekyll` tells GitHub to serve the files as they are.

1. The repository must be public (Settings → General → Danger Zone → Change visibility). Pages on private repositories needs a paid GitHub plan.
2. Settings → Pages → Build and deployment → Source: **Deploy from a branch**, Branch: **main**, folder **/ (root)** → Save.
3. After a minute or two the game is live at https://sankeerthmallesh.github.io/EscapeGame/. Every push to `main` updates it.
