#!/usr/bin/env bun
// Подчистка картинок карт, снятых с игры (список — excluded-cards.ts, общий
// со стоп-листом конвертера): публикация в docs/ (webp + ключи images.json)
// и сырые исходники в IMAGES_PATH.
//
// Сырые файлы — оригиналы генераций, их git не хранит, поэтому по умолчанию
// они НЕ удаляются, а переезжают в карантин `<raw>/_removed/` (конвертер его
// не видит — его glob не заходит в подпапки). Безвозвратное удаление — --delete.
//
// Usage:
//   bun run cleanup                    # docs/ + raw из IMAGES_PATH (raw → _removed/)
//   bun run cleanup --dry-run          # только показать, ничего не трогать
//   bun run cleanup --delete           # raw удалять насовсем вместо карантина
//   bun run cleanup --docs-only        # только публикация (docs/ + images.json)
//   bun run cleanup --raw-only         # только сырые
//   bun run cleanup /path/to/raws      # явный путь к сырым вместо IMAGES_PATH

import { EXCLUDED_CARDS } from "./excluded-cards";
import { join, basename } from "path";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const hardDelete = args.includes("--delete");
const docsOnly = args.includes("--docs-only");
const rawOnly = args.includes("--raw-only");
const rawDirArg = args.find(a => !a.startsWith("--"));

if (docsOnly && rawOnly) {
  console.error("Error: --docs-only and --raw-only are mutually exclusive");
  process.exit(1);
}

// `id[__skin_<v>][__form_<v>]` — сегменты через `__`, первый и есть id карты.
const isExcluded = (fileBase: string) => EXCLUDED_CARDS.has(fileBase.split("__")[0]);
const tag = dryRun ? "[dry] " : "";

let docsFiles = 0;
let indexKeys = 0;
let rawFiles = 0;

// ---- Публикация: docs/*.webp + docs/images.json ---------------------------
if (!rawOnly) {
  const docsDir = join(import.meta.dir, "docs");
  for (const file of new Bun.Glob("*.webp").scanSync({ cwd: docsDir, onlyFiles: true })) {
    if (!isExcluded(basename(file, ".webp"))) continue;
    console.log(`${tag}docs: - ${file}`);
    if (!dryRun) rmSync(join(docsDir, file));
    docsFiles++;
  }

  const indexPath = join(docsDir, "images.json");
  if (existsSync(indexPath)) {
    const index: Record<string, string[]> = await Bun.file(indexPath).json();
    for (const id of Object.keys(index)) {
      if (!EXCLUDED_CARDS.has(id)) continue;
      console.log(`${tag}images.json: - "${id}"`);
      delete index[id];
      indexKeys++;
    }
    // Ровно тот же формат, что пишет convert-to-webp.ts (без хвостового \n).
    if (!dryRun && indexKeys) await Bun.write(indexPath, JSON.stringify(index, null, 2));
  }
}

// ---- Сырые исходники: карантин _removed/ или --delete ---------------------
if (!docsOnly) {
  const rawDir = rawDirArg ?? process.env.IMAGES_PATH;
  if (!rawDir) {
    console.error("Error: raw dir is not set — pass a path or set IMAGES_PATH in .env");
    process.exit(1);
  }
  if (!existsSync(rawDir)) {
    console.error(`Error: directory not found: ${rawDir}`);
    process.exit(1);
  }

  const quarantine = join(rawDir, "_removed");
  for (const file of new Bun.Glob("*.{png,jpg,jpeg,webp}").scanSync({ cwd: rawDir, onlyFiles: true })) {
    if (!isExcluded(file.replace(/\.(png|jpe?g|webp)$/i, ""))) continue;
    console.log(`${tag}raw: ${file} ${hardDelete ? "(delete)" : "→ _removed/"}`);
    if (!dryRun) {
      if (hardDelete) {
        rmSync(join(rawDir, file));
      } else {
        mkdirSync(quarantine, { recursive: true });
        renameSync(join(rawDir, file), join(quarantine, file));
      }
    }
    rawFiles++;
  }
}

console.log("\n========== REPORT ==========");
if (dryRun) console.log("DRY RUN — ничего не тронуто");
if (!rawOnly) console.log(`docs webp removed: ${docsFiles}; images.json keys removed: ${indexKeys}`);
if (!docsOnly) console.log(`raw files ${hardDelete ? "deleted" : "quarantined to _removed/"}: ${rawFiles}`);
console.log(`excluded cards in list: ${EXCLUDED_CARDS.size}`);
console.log("============================");
