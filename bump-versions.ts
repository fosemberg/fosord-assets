import { join, basename } from "path";

/**
 * Per-image cache-bust ledger — `docs/versions.json`.
 *
 * The game client builds card-image URLs as `<id>[__skin_<v>].webp?v=<ver>`
 * with one GLOBAL `ver` baked into the bundle, so a regenerated image would
 * sit behind the old cached URL until the next global bump (which refetches
 * the WHOLE catalogue for everyone). This ledger fixes that per image: it maps
 * a published file's base name (`goblin`, `goblin__skin_bw`) to a short
 * content hash of its webp, and the client uses that hash as the `?v=` for
 * exactly that file. Only REGENERATED images get an entry — brand-new files
 * need no bust and absent entries keep the global default, so shipping the
 * ledger causes zero mass refetch.
 *
 * The file is committed (it's persistent state, not a build artifact) and
 * updated incrementally by the regen flows (gen-art daemon / manual regen)
 * right after `bun run start` re-encoded the named files:
 *
 *   bun run bump goblin dragon__skin_bw
 *
 * Hashes are content-derived, so re-running on unchanged files is a no-op.
 */

export const VERSIONS_FILE = "versions.json";

/** Read the ledger, dropping anything that isn't a plain name→string map. */
export async function readVersions(docsDir: string): Promise<Record<string, string>> {
  try {
    const parsed = JSON.parse(await Bun.file(join(docsDir, VERSIONS_FILE)).text()) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [name, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === "string" && v) out[name] = v;
      }
      return out;
    }
  } catch {
    /* no ledger yet / corrupt — start clean */
  }
  return {};
}

/** Short content hash of a published webp — the `?v=` value. */
export async function hashWebp(docsDir: string, name: string): Promise<string | null> {
  const file = Bun.file(join(docsDir, `${name}.webp`));
  if (!(await file.exists())) return null;
  const bytes = await file.arrayBuffer();
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex").slice(0, 8);
}

/**
 * Stamp fresh content hashes for `names` into the ledger and write it back
 * (keys sorted — stable diffs). Names may come with or without `.webp`.
 * Returns the updated map plus the names whose webp is missing on disk —
 * callers treat those as a failed publish, not a silent skip.
 */
export async function bumpVersions(
  docsDir: string,
  names: string[],
): Promise<{ versions: Record<string, string>; missing: string[] }> {
  const versions = await readVersions(docsDir);
  const missing: string[] = [];
  for (const raw of names) {
    const name = basename(raw).replace(/\.webp$/i, "");
    const hash = await hashWebp(docsDir, name);
    if (!hash) {
      missing.push(name);
      continue;
    }
    versions[name] = hash;
  }
  const sorted = Object.fromEntries(Object.entries(versions).sort(([a], [b]) => a.localeCompare(b)));
  await Bun.write(join(docsDir, VERSIONS_FILE), JSON.stringify(sorted, null, 2) + "\n");
  return { versions: sorted, missing };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const dirIdx = args.indexOf("--dir");
  const docsDir = dirIdx !== -1 ? args[dirIdx + 1] : join(import.meta.dir, "docs");
  const names = args.filter((a, i) => a !== "--dir" && i !== dirIdx + 1);
  if (!names.length) {
    console.error("Usage: bun run bump-versions.ts [--dir docs] <name> [<name>...]  (name = webp base name, e.g. goblin__skin_bw)");
    process.exit(1);
  }
  const { versions, missing } = await bumpVersions(docsDir, names);
  for (const name of names.map((n) => basename(n).replace(/\.webp$/i, ""))) {
    if (versions[name]) console.log(`  ${name} → v=${versions[name]}`);
  }
  if (missing.length) {
    console.error(`Missing webp for: ${missing.join(", ")} — run the publish (bun run start) first`);
    process.exit(1);
  }
  console.log(`${VERSIONS_FILE}: ${Object.keys(versions).length} pinned image(s)`);
}
