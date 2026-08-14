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
  client loads). Two-tone `skin_bw` sets are encoded lossless automatically.
- `bun run mono` — same, narrowed to the two-tone mono skins (`--force` to
  re-publish re-rolled ones).
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
  `images.json` by bare id). `map.json` is a flat `{"old_id": "new_id"}` — the
  same shape as `CARD_ID_MIGRATIONS` in the game repo
  (`common/src/cards/idMigrations.ts`), which is the source of truth for
  renames. **Run it against the raw-PNG repo too**
  (`bun run rename-ids map.json --dir $IMAGES_PATH --ext png`): `bun run start`
  rebuilds `images.json` from the png listing, so a leftover `crusader.png`
  would republish the old file and resurrect the old key on the next run.

Tests: `bun test` — the ledger logic AND the CLI itself
(`bump-versions.test.ts`): the regen flow only ever invokes this through
`bun run bump <name>`, so argument parsing is covered end-to-end.
