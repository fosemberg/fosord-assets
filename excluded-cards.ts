// Загрузчик стоп-листа снятых с игры карт. Сам список — в excluded-cards.txt
// рядом (по одному id на строку, пустые строки и #-комментарии игнорируются):
// плоский файл читается глазами, правится без кода и греппится из шелла.
// Потребители: convert-to-webp.ts (не публикует эти карты) и
// cleanup-removed-cards.ts (вычищает docs/ и сырые исходники).
import { join } from "path";

const listPath = join(import.meta.dir, "excluded-cards.txt");
const lines = (await Bun.file(listPath).text()).split("\n");

const ids: string[] = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line || line.startsWith("#")) continue;
  if (!/^[a-z0-9_]+$/.test(line)) {
    throw new Error(`excluded-cards.txt:${i + 1}: bad card id "${line}" (expected [a-z0-9_]+)`);
  }
  ids.push(line);
}

export const EXCLUDED_CARDS: ReadonlySet<string> = new Set(ids);

if (EXCLUDED_CARDS.size === 0) {
  // Пустой список — штатное состояние, пока карты банятся софтово
  // (bannedDefaults.ts в репо fosord), а не удаляются с корнем.
  console.log("excluded-cards.txt is empty — no cards are hard-removed.");
}
