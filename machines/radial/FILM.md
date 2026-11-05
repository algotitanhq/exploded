# The film

The tour (40 s) is recorded frame by frame from `machines/radial/r2800-film`, the same code as the page, with the
capture tools of the teardown skill ([whaleyxbt/claude-motion](https://github.com/whaleyxbt/claude-motion)). They need
the skill installed (`SKILL_DIR`), headless Chrome with a real GPU, `ffmpeg` and Python 3.

```sh
cd machines/radial
node r2800-shared/make-timeline.mjs                     # r2800-film/timeline.json (beats) and events.json (every spark, the run at 100 Hz)
node "$SKILL_DIR/sims/build.mjs" ./r2800-film
echo '{"lang":"en"}' > /tmp/en.json                     # or fr / es
node "$SKILL_DIR/sims/capture.mjs" r2800-film --timeline r2800-film/timeline.json --config /tmp/en.json --size 1600x900 --dpr 1.2 --stills beats --cols 3 --out teardown-out/beats.png
node "$SKILL_DIR/sims/capture.mjs" r2800-film --timeline r2800-film/timeline.json --config /tmp/en.json --size 1600x900 --dpr 1.2 --out teardown-out/silent.mp4
python3 "$SKILL_DIR/run_sfx.py" r2800-shared/score.py   # teardown-out/radial-score.wav, mastered to −14 LUFS
ffmpeg -y -i teardown-out/silent.mp4 -i teardown-out/radial-score.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart teardown-out/radial-en.mp4
```

The share card is a frame of the film without the console, the star from the front at idle:

```sh
echo '{"lang":"en","clean":true}' > /tmp/clean.json
node "$SKILL_DIR/sims/capture.mjs" r2800-film --config /tmp/clean.json --size 1600x900 --dpr 1.2 --still 11 --out teardown-out/og-src.png
ffmpeg -y -i teardown-out/og-src.png -vf "scale=1200:-1,crop=1200:630:0:(ih-630)/2" -map_metadata -1 og.png
```

On macOS, Playwright's headless shell may get no WebGL context; point the capture at Chrome:
`CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.

The sound is built on the same timeline: the starter's whine, a cough for each spark that lights while the engine
catches (the missed ones stay silent), a thud per firing while they come slower than ~12 a second on screen, then a
growl whose pulse is the firing rate on screen, and the propeller's wash.
