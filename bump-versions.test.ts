import { test, expect, beforeEach } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bumpVersions, readVersions, VERSIONS_FILE } from "./bump-versions";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "fosord-versions-"));
});

test("stamps a content hash per named webp and writes the ledger", async () => {
  await Bun.write(join(dir, "goblin.webp"), "art-v1");
  await Bun.write(join(dir, "goblin__skin_bw.webp"), "ink-v1");

  const { versions, missing } = await bumpVersions(dir, ["goblin", "goblin__skin_bw.webp"]);

  expect(missing).toEqual([]);
  expect(versions.goblin).toMatch(/^[0-9a-f]{8}$/);
  expect(versions.goblin__skin_bw).toMatch(/^[0-9a-f]{8}$/);
  expect(versions.goblin).not.toBe(versions.goblin__skin_bw);
  expect(await readVersions(dir)).toEqual(versions);
});

test("content-derived: re-running is a no-op, a re-encoded file changes its hash only", async () => {
  await Bun.write(join(dir, "goblin.webp"), "art-v1");
  await Bun.write(join(dir, "dragon.webp"), "dragon-v1");
  const first = (await bumpVersions(dir, ["goblin", "dragon"])).versions;

  const again = (await bumpVersions(dir, ["goblin"])).versions;
  expect(again).toEqual(first);

  await Bun.write(join(dir, "goblin.webp"), "art-v2 (regenerated)");
  const bumped = (await bumpVersions(dir, ["goblin"])).versions;
  expect(bumped.goblin).not.toBe(first.goblin);
  expect(bumped.dragon).toBe(first.dragon);
});

test("missing webp is reported, present names still land", async () => {
  await Bun.write(join(dir, "goblin.webp"), "art");
  const { versions, missing } = await bumpVersions(dir, ["goblin", "ghost_card"]);
  expect(missing).toEqual(["ghost_card"]);
  expect(versions.goblin).toBeDefined();
  expect(versions.ghost_card).toBeUndefined();
});

test("a corrupt ledger degrades to empty instead of crashing the publish", async () => {
  await Bun.write(join(dir, VERSIONS_FILE), "{broken json");
  await Bun.write(join(dir, "goblin.webp"), "art");
  const { versions } = await bumpVersions(dir, ["goblin"]);
  expect(Object.keys(versions)).toEqual(["goblin"]);
});

test("junk entries are filtered on read, valid ones survive", async () => {
  await Bun.write(join(dir, VERSIONS_FILE), JSON.stringify({ keep: "abc123", drop: 42, nested: { no: 1 } }));
  expect(await readVersions(dir)).toEqual({ keep: "abc123" });
});
