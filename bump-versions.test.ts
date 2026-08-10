import { test, expect, beforeEach } from "bun:test";
import { mkdtempSync, mkdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bumpVersions, readVersions, parseBumpArgs, VERSIONS_FILE } from "./bump-versions";

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

// Разбор аргументов CLI — единственная точка входа регена
// (`bun run bump <name>` из tools/gen-art/regen.ts). Юнит-тест самой
// bumpVersions() сюда не достаёт, а сломанный разбор рушит реген уже ПОСЛЕ
// оплаченной генерации арта.
test("parseBumpArgs: без --dir имена не съедаются", () => {
  expect(parseBumpArgs(["goblin"])).toEqual({ dir: null, dirMissingValue: false, names: ["goblin"] });
  expect(parseBumpArgs(["goblin", "dragon__skin_bw"]).names).toEqual(["goblin", "dragon__skin_bw"]);
});

test("parseBumpArgs: --dir и его значение выкидываются из имён", () => {
  expect(parseBumpArgs(["--dir", "docs", "goblin"]))
    .toEqual({ dir: "docs", dirMissingValue: false, names: ["goblin"] });
  // Флаг может стоять и после имён.
  expect(parseBumpArgs(["goblin", "--dir", "out"]))
    .toEqual({ dir: "out", dirMissingValue: false, names: ["goblin"] });
});

test("parseBumpArgs: висячий --dir помечается, а не молча берёт дефолт", () => {
  expect(parseBumpArgs(["goblin", "--dir"]))
    .toEqual({ dir: null, dirMissingValue: true, names: ["goblin"] });
});

test("CLI целиком: `bun bump-versions.ts <name>` без --dir пишет леджер рядом со скриптом", async () => {
  // Копия скрипта во временную папку: дефолтный docsDir — join(import.meta.dir,
  // "docs"), так что прогон не трогает настоящий docs/ репозитория.
  const home = mkdtempSync(join(tmpdir(), "fosord-bump-cli-"));
  mkdirSync(join(home, "docs"));
  copyFileSync(join(import.meta.dir, "bump-versions.ts"), join(home, "bump-versions.ts"));
  await Bun.write(join(home, "docs", "goblin__skin_bw.webp"), "ink");

  const r = Bun.spawnSync(["bun", join(home, "bump-versions.ts"), "goblin__skin_bw"]);
  expect(r.stderr.toString()).toBe("");
  expect(r.exitCode).toBe(0);

  expect(await readVersions(join(home, "docs"))).toEqual({
    goblin__skin_bw: expect.stringMatching(/^[0-9a-f]{8}$/) as unknown as string,
  });
});

test("CLI: несколько имён — все попадают в леджер", async () => {
  const home = mkdtempSync(join(tmpdir(), "fosord-bump-cli-"));
  mkdirSync(join(home, "docs"));
  copyFileSync(join(import.meta.dir, "bump-versions.ts"), join(home, "bump-versions.ts"));
  await Bun.write(join(home, "docs", "goblin.webp"), "art");
  await Bun.write(join(home, "docs", "dragon.webp"), "art2");

  const r = Bun.spawnSync(["bun", join(home, "bump-versions.ts"), "goblin", "dragon"]);
  expect(r.exitCode).toBe(0);
  expect(Object.keys(await readVersions(join(home, "docs"))).sort()).toEqual(["dragon", "goblin"]);
});
