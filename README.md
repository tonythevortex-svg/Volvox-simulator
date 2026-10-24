# Volvox Pond Simulator

**An interactive, generative pond of moving, reproducing algae-like colonies and evolving electronic sound.**

Volvox Pond Simulator is a browser-based visual and sonic experiment made with JavaScript and [p5.js](https://p5js.org/). Inspired by *Volvox*—a genus of colonial green algae—it places luminous, spherical colonies in a virtual pond. Colonies drift, rotate, grow, develop daughter colonies and eventually release new colonies. Their changing movement and positions produce a meditative, shifting electronic soundscape.

The work is an **artistic simulation**, not a scientifically accurate model of *Volvox* biology. It explores how simple computational behaviours can create the impression of a living, self-organising environment, and how simulated ecological activity might be experienced through sound and interaction.

## What happens on screen?

- Green, spherical colonies move through a dark pond-like space.
- Individual points suggest the cells making up each colony.
- Colonies grow, reproduce and fade, allowing a changing population to develop over time.
- Each sounding colony contributes to a layered electronic soundscape; pitch and volume change with its position and life cycle.
- In the revised interactive version, clicking creates a new colony at the pointer position and produces a short birth tone.

## Versions included in the uploaded files

These uploads contain **two different versions of the simulator**. They are not interchangeable without choosing which code should be the active `sketch.js`.

| File | Version / behaviour |
| --- | --- |
| `sketch(2).js` | Earlier autonomous simulation: starts with a single colony, develops daughter colonies, uses the p5.sound library, and supports sound/fullscreen shortcuts. |
| `notes.txt` | Revised simulation: contains JavaScript code (despite the `.txt` extension), starts with 13 colonies, supports click-to-spawn, synthesises sound using the browser's native Web Audio API, and includes video/audio recording. |
| `index.html` | Webpage that loads the p5.js libraries, stylesheet and a file named `sketch.js`. |
| `style.css` | Basic full-page styling for the canvas. |
| `p5.js` / `p5.sound.min.js` | Library files supplied with the download. `index.html` currently loads these libraries from a CDN instead; the revised version does not require p5.sound. |

### Controls

| Action | Earlier `sketch(2).js` | Revised code in `notes.txt` |
| --- | --- | --- |
| **S** | Toggle sound | Toggle sound |
| **F** | Toggle fullscreen | Toggle fullscreen |
| **Click** | No click-to-spawn control | Create a colony and activate browser audio |
| **R** | Not available | Start or stop recording video and sound, where supported |

Browsers may require a click or keypress before they allow audio playback. Recording support and export format (MP4 or WebM) depend on the browser.

## How to run

The simulator runs in a web browser and does not require Arduino hardware or a sensor. It can be hosted using GitHub Pages or opened through a local development server.

**Important filename fix:** The supplied `index.html` refers to `sketch.js`, but the uploaded JavaScript file is called `sketch(2).js`. Choose **one** version and prepare it as follows:

1. **Earlier version:** rename `sketch(2).js` to `sketch.js`.
2. **Revised interactive version:** copy the JavaScript code from `notes.txt` into a file named `sketch.js` (or rename `notes.txt` to `sketch.js`).
3. Put that `sketch.js` beside `index.html` and `style.css` in the same folder.
4. Open the folder with a local web server or publish it with GitHub Pages. Once loaded, interact using the controls above.

The supplied `index.html` references p5.js **1.11.11** through jsDelivr. This requires an internet connection unless the script paths are changed to point to locally hosted library files.

### Suggested GitHub structure for preserving versions

If you want visitors to be able to run both versions, keep separate, complete folders:

```text
volvox-pond-simulator/
├── README.md
├── version-01-autonomous/
│   ├── index.html
│   ├── sketch.js
│   └── style.css
└── version-02-interactive/
    ├── index.html
    ├── sketch.js
    └── style.css
```

Each folder needs its own `index.html` referencing the `sketch.js` in that folder. With GitHub Pages enabled, each folder can have its own playable URL, such as `https://YOUR-USERNAME.github.io/volvox-pond-simulator/version-02-interactive/`.

## Adjusting the simulation

The JavaScript code includes editable parameters. In the revised version (`notes.txt`), these include:

- `INITIAL_COLONIES` — number of colonies present when the sketch begins (currently 13).
- `MAX_COLONIES` — maximum number of colonies (currently 90).
- `MAX_AUDIO_VOICES` — maximum simultaneously synthesised colony voices (currently 12).
- `PORTRAIT_W` and `PORTRAIT_H` — canvas dimensions (currently 1080 × 1350).

Additional parameters throughout the code influence growth, movement, life span, reproduction, visual appearance and sound. The earlier version uses a different set of variables and behaviours.

## Technical notes

- **Built with:** JavaScript, p5.js, HTML and CSS.
- **Audio:** p5.sound in the earlier version; native Web Audio oscillators in the revised version.
- **Recording:** Browser MediaRecorder API in the revised version, where supported.
- **Data:** Generative simulation; it does not measure real algae or read live biological data.

## Development and AI acknowledgement

**The code was developed with generative AI assistance (OpenAI ChatGPT)** through an iterative process of prompting, testing, feedback and revision. The artistic concept, creative direction, selection of behaviours and research context were guided by the project author. This repository documents an evolving experimental work rather than a finished scientific model.

## Licence

No licence has been specified for the original project code. Add a `LICENSE` file if you wish to define terms for reuse. The p5.js libraries are third-party dependencies with their own licensing terms.
