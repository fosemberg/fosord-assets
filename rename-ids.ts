#!/usr/bin/env bun
/**
 * Переезд карт на новые id: переименовать файлы арта и ключи индексов.
 *
 * Зачем отдельный скрипт. Id карты — это имя файла (`<id>.webp`,
 * `<id>__skin_bw.webp`) и ключ в `docs/versions.json`/`docs/images.json`.
 * Когда id карты меняется в игре, арт надо переименовать здесь — иначе картинка
 * просто перестанет находиться.
 *
 * И, главное, ТО ЖЕ САМОЕ надо сделать в репозитории ИСХОДНЫХ png
 * (`$ASSETS_RAW`): `convert-to-webp.ts` пересобирает `images.json` из списка
 * png с нуля, поэтому оставленный там png под старым именем вернёт
 * старый ключ (и старый файл) в следующем же прогоне `bun run start`.
 *
 * Использование:
 *   bun run rename-ids.ts <map.json> [--dir docs] [--ext webp] [--dry-run]
 *
 * `map.json` — плоский объект `{"старый_id": "новый_id"}`. Переименование идёт `git mv`, если папка
 * под гитом, иначе обычным rename. Столкновение с уже существующим файлом —
 * ошибка: молча перезаписать чужой арт хуже, чем остановиться.
 */
import { readdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const flagValue = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};
const mapPath = args.find(a => !a.startsWith("--") && a !== flagValue("--dir", "") && a !== flagValue("--ext", ""));
if (!mapPath) {
  console.error("usage: bun run rename-ids.ts <map.json> [--dir docs] [--ext webp] [--dry-run]");
  process.exit(1);
}
const dir = flagValue("--dir", "docs");
const ext = flagValue("--ext", "webp").replace(/^\./, "");

const map: Record<string, string> = await Bun.file(mapPath).json();
const files = (await readdir(dir)).filter(f => f.endsWith(`.${ext}`));

// Имя файла — `id` плюс необязательный хвост вариантов (`__skin_bw`,
// `__form_storm`). Переименовывается только id, хвост едет как есть.
const moves: Array<[string, string]> = [];
for (const file of files) {
  const name = file.slice(0, -(ext.length + 1));
  const at = name.indexOf("__");
  const id = at < 0 ? name : name.slice(0, at);
  const next = map[id];
  if (!next) continue;
  const target = `${next}${at < 0 ? "" : name.slice(at)}.${ext}`;
  if (existsSync(join(dir, target))) {
    console.error(`✗ ${file} → ${target}: цель уже существует`);
    process.exit(1);
  }
  moves.push([file, target]);
}

console.log(`${dir}: ${moves.length} файл(ов) к переименованию${dryRun ? " (dry-run)" : ""}`);
if (!dryRun) {
  const gitTracked = (await Bun.$`git rev-parse --is-inside-work-tree`.nothrow().quiet()).exitCode === 0;
  for (const [from, to] of moves) {
    if (gitTracked) await Bun.$`git mv ${join(dir, from)} ${join(dir, to)}`.quiet();
    else await rename(join(dir, from), join(dir, to));
  }
}
for (const [from, to] of moves) console.log(`  ${from} → ${to}`);

// Индексы: ключ `versions.json` — имя файла без расширения (то есть с хвостом
// варианта), ключ `images.json` — голый id. Оба переписываются в том формате,
// в каком их пишут `bump-versions.ts` (отсортированно, с переводом строки) и
// `convert-to-webp.ts` (порядок исходного списка png, без перевода строки).
const rekey = async (path: string, sorted: boolean, trailingNewline: boolean, keyOf: (k: string) => string) => {
  if (!existsSync(path)) return;
  const data: Record<string, unknown> = await Bun.file(path).json();
  let changed = 0;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    const nk = keyOf(k);
    if (nk !== k) changed++;
    out[nk] = v;
  }
  const entries = sorted ? Object.entries(out).sort(([a], [b]) => a.localeCompare(b)) : Object.entries(out);
  if (!dryRun) {
    await Bun.write(path, JSON.stringify(Object.fromEntries(entries), null, 2) + (trailingNewline ? "\n" : ""));
  }
  console.log(`${path}: ${changed} ключ(ей) переименовано`);
};
const idOf = (k: string) => map[k] ?? k;
const fileKeyOf = (k: string) => {
  const at = k.indexOf("__");
  return at < 0 ? idOf(k) : idOf(k.slice(0, at)) + k.slice(at);
};
await rekey(join(dir, "versions.json"), true, true, fileKeyOf);
await rekey(join(dir, "images.json"), false, false, idOf);
