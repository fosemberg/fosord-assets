import { basename, join } from "path";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { bumpVersions, VERSIONS_FILE } from "./bump-versions";

/**
 * Re-publish named card art and stamp its cache-bust version — `bun run regen`.
 *
 * This does NOT draw anything: the art itself is regenerated in the game repo
 * (`tools/gen-art/regen.ts`, which pays fal.ai and then drives this repo for
 * you). Use this one when the raw png in `$IMAGES_PATH` is ALREADY the new
 * art — hand-edited, re-thresholded, copied in, or regenerated with
 * `--skip-publish` — and only the published side is stale.
 *
 * It exists because `bun run start` deliberately skips any png whose webp is
 * already there, so a re-rolled png silently keeps its old webp; and even
 * once re-encoded, clients hold the old bytes until `docs/versions.json`
 * pins a fresh hash for that one file. Doing both by hand is three commands
 * with an easy-to-miss middle step.
 *
 *   bun run regen blind_diviner              # base + every variant of the id
 *   bun run regen blind_diviner__skin_bw     # exactly that one file
 *   bun run regen a b__skin_2 --dry-run      # show what would be re-encoded
 *
 * A bare id takes the whole set (base + `__skin_*` / `__form_*`), which is
 * what a prompt change produces; a name that already carries a `__` segment
 * is matched exactly, so a single re-rolled skin doesn't drag its siblings
 * through a needless re-encode (and a needless `?v=` change for clients).
 */

/**
 * Map CLI names onto the png base names that will actually be published.
 *
 * Exported for the test: the whole command is a no-op-or-worse if this is
 * wrong (an unmatched id would silently re-publish nothing, a too-greedy
 * match would bust the cache of untouched variants for every player).
 */
export function resolveTargets(
  args: string[],
  pngNames: string[],
): { targets: string[]; unmatched: string[] } {
  const available = new Set(pngNames);
  const targets = new Set<string>();
  const unmatched: string[] = [];

  for (const raw of args) {
    const name = basename(raw).replace(/\.(png|webp)$/i, "");
    const found: string[] = [];
    if (name.includes("__")) {
      if (available.has(name)) found.push(name);
    } else {
      // Prefix guard is `<id>__`, not `<id>_`: `lava_troll_3` is a card id of
      // its own, not a variant of `lava_troll`.
      for (const png of pngNames) {
        if (png === name || png.startsWith(`${name}__`)) found.push(png);
      }
    }
    if (found.length === 0) unmatched.push(name);
    for (const f of found) targets.add(f);
  }

  return { targets: [...targets].sort(), unmatched };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const names = args.filter(a => !a.startsWith("--"));

  if (names.length === 0) {
    console.error(
      "Usage: bun run regen <id|id__skin_x> [...] [--dry-run]\n" +
        "  <id>            re-publish the base image and every variant of that card\n" +
        "  <id__skin_bw>   re-publish exactly that file",
    );
    process.exit(1);
  }

  const imagesPath = process.env.IMAGES_PATH;
  if (!imagesPath) {
    console.error("Error: IMAGES_PATH is not set in .env");
    process.exit(1);
  }
  if (!existsSync(imagesPath)) {
    console.error(`Error: directory not found: ${imagesPath}`);
    process.exit(1);
  }

  const glob = new Bun.Glob("*.png");
  const pngNames = (await Array.fromAsync(glob.scan({ cwd: imagesPath, onlyFiles: true }))).map(f =>
    basename(f, ".png"),
  );

  const { targets, unmatched } = resolveTargets(names, pngNames);
  if (unmatched.length) {
    console.error(`No raw png in ${imagesPath} for: ${unmatched.join(", ")}`);
    process.exit(1);
  }

  console.log(`Re-publishing ${targets.length} file(s):`);
  for (const name of targets) console.log(`  · ${name}`);
  if (dryRun) {
    console.log("\n--dry-run: nothing deleted, converted or bumped");
    process.exit(0);
  }

  // convert-to-webp.ts skips a png whose webp already exists, so the stale
  // outputs have to go first — that (not --force) is what keeps the run
  // narrowed to these files instead of re-encoding the whole catalogue.
  const docsDir = join(import.meta.dir, "docs");
  for (const name of targets) {
    const webp = join(docsDir, `${name}.webp`);
    if (existsSync(webp)) await unlink(webp);
  }

  const convert = Bun.spawnSync(["bun", join(import.meta.dir, "convert-to-webp.ts")], {
    cwd: import.meta.dir,
    env: process.env,
    stdio: ["inherit", "inherit", "inherit"],
  });
  if (convert.exitCode !== 0) {
    console.error("Publish failed; versions.json left untouched");
    process.exit(1);
  }

  const { versions, missing } = await bumpVersions(docsDir, targets);
  console.log("\nBumped:");
  for (const name of targets) if (versions[name]) console.log(`  ${name} → v=${versions[name]}`);
  if (missing.length) {
    console.error(`Missing webp after publish for: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log(`\n${VERSIONS_FILE}: ${Object.keys(versions).length} pinned image(s)`);
}
