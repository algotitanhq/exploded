# Release: the public repository, one commit

Same procedure as Uberblok. The working repository stays private; the public repository `algotitanhq/exploded` holds a
single commit, the tree of the validated `main`, without the working history. The owner's Go is the only gate: it
comes before step 3, and the owner sets `PUBLIC_RELEASE=true` on the public repository afterwards (step 4).

## 1. Check the tree

On a clean clone, at the commit of `main` the owner validated:

```sh
SHA=<the validated commit of main>
git switch --detach "$SHA"
npm ci && npm test                       # the figures, the root language choice, the build
git grep -I -n -i -E -f /path/to/private-patterns.txt "$SHA"     # the team's list of private names: nothing
git grep -I -n -E '192\.168\.|10\.[0-9]+\.[0-9]+\.[0-9]+|/home/[a-z]|/Users/[a-z]' "$SHA"
git grep -I -n -E 'BEGIN [A-Z ]*PRIVATE KEY|gh[pousr]_[A-Za-z0-9]{20,}|github_pa[t]_|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|https?://[^/ ]+:[^@/ ]+@' "$SHA"
```

The study material of each machine (photos of real machines, catalogues, papers) is not tracked: it belongs to its
authors (Aesonlabs, iFixit and Wikimedia contributors for Spindl; Quandela, CEA and the paper's authors for Quantum).
Each `machines/<slug>/REFERENCES.md` links it. Check that none of it is in the tree:

```sh
git ls-tree -r --name-only "$SHA" | grep -E '(^|/)refs?/|\.pdf$' && echo "STOP: study material tracked"
```

The binary files are the share cards and the favicon; check that they carry no metadata:

```sh
git ls-tree -r --name-only "$SHA" | grep -E '\.(png|jpe?g|webp|gif)$'
# static/og.png, machines/*/og.png: rendered from the films, written by ffmpeg with -map_metadata -1
```

## 2. Build the one-commit repository

```sh
OUT=$(mktemp -d)/exploded
mkdir -p "$OUT"
git archive --format=tar "$SHA" | tar -x -C "$OUT"
cd "$OUT"
git init -q -b main --template=
git add -A
git -c user.name="<author name>" -c user.email="<author noreply email>" \
  commit -q -m "Exploded: real machines taken apart in the browser (Spindl, Quantum)"
test "$(git rev-list --count HEAD)" = 1 && test -z "$(git remote)" && echo "one commit, no remote"
```

## 3. Publish (after the owner's Go)

```sh
cd "$OUT"
gh repo create algotitanhq/exploded --public --source . --remote origin --push \
  --description "Exploded: real machines, built from code with their real numbers, that you can take apart in the browser" \
  --homepage https://exploded.storagebits.workers.dev
gh repo edit algotitanhq/exploded --add-topic showcase --add-topic threejs --add-topic simulation --add-topic hard-drive --add-topic quantum-computing
gh repo view algotitanhq/exploded --json visibility,defaultBranchRef     # PUBLIC, main
```

The first push runs CI without deploying: `PUBLIC_RELEASE` is not set yet. The `showcase` topic makes the project
appear on blok by itself at the next build.

## 4. First deploy (the owner)

```sh
gh variable set PUBLIC_RELEASE --body true -R algotitanhq/exploded
gh workflow run ci.yml --ref main -R algotitanhq/exploded
gh run watch -R algotitanhq/exploded
curl -sI https://exploded.storagebits.workers.dev/ | head -3          # 302 to /en/ (or the browser's language)
```

The organization secret `CLOUDFLARE_API_TOKEN` must be visible to the new repository (organization settings,
secret access: all repositories, or add `exploded` to the selected ones).

## After the first release

A new machine is a pull request on the public repository, reviewed and merged like any change; the deploy follows
from `main`. The one-commit export above is only for the first publication.
