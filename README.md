# fosord-assets

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run start
```

This project was created using `bun init` in bun v1.3.13. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Scripts

- `bun run start` — convert every raw PNG from `$IMAGES_PATH` to webp in
  `docs/` and rebuild `docs/images.json` (the card→variants index the game
  client loads). The encoder is picked per file from the name: `__skin_bw`
  (two-tone ink) goes lossless, everything else lossy — no flag to remember.
  Files whose webp already exists are skipped; `--force` re-encodes them
  (the regen flow instead deletes the stale webp for exactly the ids it
  re-rolled, so a normal run republishes them).
- `bun run regen <id|id__skin_x> [...] [--dry-run]` — re-publish named art and
  bump it in one step: drops the stale webp(s), re-runs the conversion and
  stamps `docs/versions.json`. Use it when the raw png in `$IMAGES_PATH` is
  already the new art (hand-edited, re-thresholded, or generated with
  `regen.ts --skip-publish`) — this repo never draws anything; the paid regen
  lives in `tools/gen-art/regen.ts` in the game repo and drives this repo
  itself. A bare id takes the base image and every variant (`__skin_*`,
  `__form_*`); a name that already carries a `__` segment is matched exactly,
  so one re-rolled skin doesn't bust the cache of its untouched siblings.
- `bun run bump <name> [...]` — stamp `docs/versions.json`, the **per-image
  cache-bust ledger**: `name` is a published file's base name (`goblin`,
  `goblin__skin_bw`), the value is a short content hash of its webp. The game
  client reads the ledger from this host (right next to `images.json`) and
  appends that hash as the `?v=` of exactly that file, so a regenerated image
  busts caches alone — the untouched catalogue keeps its URLs (images absent
  from the ledger fall back to the client's global version). Because the
  version lives WITH the file, every environment (prod, dev, the Yandex
  flavour) busts off the same config. Run it after `bun run start` re-encoded
  the named files; the regen flow (`tools/gen-art/regen.ts` in the game repo,
  also the path the review-screen 🔄 daemon takes) calls it itself and commits
  the ledger together with the art. The ledger is committed state, not a build
  artifact; `docs/versions.json` simply doesn't exist until the first regen.
  Optional `--dir <path>` overrides the `docs/` location (tests, dry runs).

- `bun run rename-ids <map.json> [--dir docs] [--ext webp] [--dry-run]` — apply
  a card-id rename to the published art: `git mv`s every `<old>.webp` /
  `<old>__skin_*.webp` and rekeys both indexes (`versions.json` by file name,
  `images.json` by bare id). `map.json` is a flat `{"old_id": "new_id"}`.
  **Run it against the raw-PNG repo too**
  (`bun run rename-ids map.json --dir $IMAGES_PATH --ext png`): `bun run start`
  rebuilds `images.json` from the png listing, so a leftover png under its old
  name would republish the old file and resurrect the old key on the next run.

Tests: `bun test` — the ledger logic AND the CLI itself
(`bump-versions.test.ts`): the regen flow only ever invokes this through
`bun run bump <name>`, so argument parsing is covered end-to-end.
