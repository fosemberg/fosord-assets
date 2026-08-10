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
  client appends that hash as the `?v=` of exactly that file, so a
  regenerated image busts caches alone — the untouched catalogue keeps its
  URLs (images absent from the ledger fall back to the client's global
  version). Run it after `bun run start` re-encoded the named files; the
  regen flows (`tools/gen-art/daemon.ts` / `regen.ts` in the game repo) call
  it themselves. The ledger is committed state, not a build artifact.

Tests: `bun test` (the ledger logic — `bump-versions.test.ts`).
