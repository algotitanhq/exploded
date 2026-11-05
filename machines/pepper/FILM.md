# The film

The tour (38 s) is recorded frame by frame from `machines/pepper/curta-film`, the same code as the page, with the
capture tools of the teardown skill ([whaleyxbt/claude-motion](https://github.com/whaleyxbt/claude-motion)). They need
the skill installed (`SKILL_DIR`), headless Chrome with a real GPU, `ffmpeg` and Python 3.

```sh
cd machines/pepper
node curta-shared/make-timeline.mjs                     # curta-film/timeline.json (beats), sounds.json (every tick)
node "$SKILL_DIR/sims/build.mjs" ./curta-film
echo '{"lang":"en"}' > /tmp/en.json                     # or fr / es
node "$SKILL_DIR/sims/capture.mjs" curta-film --timeline curta-film/timeline.json --config /tmp/en.json --size 1600x900 --dpr 1.2 --stills beats --cols 4 --out teardown-out/beats.png
node "$SKILL_DIR/sims/capture.mjs" curta-film --timeline curta-film/timeline.json --config /tmp/en.json --size 1600x900 --dpr 1.2 --out teardown-out/silent.mp4
python3 "$SKILL_DIR/run_sfx.py" curta-shared/score.py   # teardown-out/pepper-score.wav, mastered
ffmpeg -y -i teardown-out/silent.mp4 -i teardown-out/pepper-score.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart teardown-out/pepper-en.mp4
```

The share card is frame 0 of the film without the sheet, framed on the calculator, 1200 × 630, without metadata:

```sh
node "$SKILL_DIR/sims/capture.mjs" curta-film --config /tmp/clean.json --size 1600x900 --dpr 1.2 --still 0 --out teardown-out/frame0.png   # {"lang":"en","clean":true}
ffmpeg -y -i teardown-out/frame0.png -vf "crop=1600:840:145:80,scale=1200:630" -map_metadata -1 og.png
```

On macOS, Playwright's headless shell may get no WebGL context; point the capture at Chrome:
`CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.

`{"lang":"en","clean":true}` records the machine without the sheet. The kit's film build inlines Inter and
JetBrains Mono only; `curta-film/main.js` brings in Instrument Serif itself.
