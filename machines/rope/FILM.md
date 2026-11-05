# The film

The tour (40 s) is recorded frame by frame from `machines/rope/agc-film`, the same code as the page, with the capture
tools of the teardown skill ([whaleyxbt/claude-motion](https://github.com/whaleyxbt/claude-motion)). They need the
skill installed (`SKILL_DIR`), headless Chrome with a real GPU, `ffmpeg` and Python 3.

```sh
cd machines/rope
node agc-shared/make-timeline.mjs                       # agc-film/timeline.json (beats) and sfx.json (keys, alarms, calls)
node "$SKILL_DIR/sims/build.mjs" ./agc-film
echo '{"lang":"en"}' > teardown-out/en.json             # or fr / es
node "$SKILL_DIR/sims/capture.mjs" agc-film --timeline agc-film/timeline.json --config teardown-out/en.json --size 1600x900 --dpr 1.2 --stills beats --cols 4 --out teardown-out/beats.png
node "$SKILL_DIR/sims/capture.mjs" agc-film --config teardown-out/en.json --size 1600x900 --dpr 1.2 --out teardown-out/silent.mp4
python3 "$SKILL_DIR/run_sfx.py" agc-shared/score.py     # teardown-out/rope-score.wav, mastered to −14 LUFS
ffmpeg -y -i teardown-out/silent.mp4 -i teardown-out/rope-score.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart teardown-out/rope-en.mp4
```

The share card is the film at 6 s (the trays open) without the console: `node "$SKILL_DIR/sims/capture.mjs" agc-film --config /tmp/clean.json --size 1600x900 --dpr 1.2 --still 6 --out teardown-out/og-src.png` with `{"lang":"en","clean":true}`, then `ffmpeg -y -i teardown-out/og-src.png -vf "crop=iw:iw*630/1200:0:(ih-iw*630/1200)/2,scale=1200:630" -map_metadata -1 og.png`.

On macOS, Playwright's headless shell may get no WebGL context; point the capture at Chrome:
`CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.

`{"lang":"en","clean":true}` records the machine without the console.
