# The film

The tour (42 s) is recorded frame by frame from `machines/quantum/qpu-film`, the same code as the page, with the
capture tools of the teardown skill ([whaleyxbt/claude-motion](https://github.com/whaleyxbt/claude-motion)). They need
the skill installed (`SKILL_DIR`), headless Chrome with a real GPU, `ffmpeg` and Python 3.

```sh
cd machines/quantum
node qpu-shared/make-timeline.mjs                       # qpu-film/timeline.json (beats) and clicks.json (every click)
node "$SKILL_DIR/sims/build.mjs" ./qpu-film
echo '{"lang":"en"}' > /tmp/en.json                     # or fr / es
node "$SKILL_DIR/sims/capture.mjs" qpu-film --timeline qpu-film/timeline.json --config /tmp/en.json --size 1600x900 --dpr 1.2 --stills beats --cols 4 --out teardown-out/beats.png
node "$SKILL_DIR/sims/capture.mjs" qpu-film --timeline qpu-film/timeline.json --config /tmp/en.json --size 1600x900 --dpr 1.2 --out teardown-out/silent.mp4
python3 "$SKILL_DIR/run_sfx.py" qpu-shared/score.py     # teardown-out/quantum-score.wav, mastered to −14 LUFS
ffmpeg -y -i teardown-out/silent.mp4 -i teardown-out/quantum-score.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart teardown-out/quantum-en.mp4
```

On macOS, Playwright's headless shell may get no WebGL context; point the capture at Chrome:
`CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.

`{"lang":"en","clean":true}` records the machine without the console.
