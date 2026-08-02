import sharp from "sharp";
import { join, basename } from "path";
import { existsSync } from "node:fs";

const imagesPath = process.env.IMAGES_PATH;

if (!imagesPath) {
  console.error("Error: IMAGES_PATH is not set in .env");
  process.exit(1);
}

if (!existsSync(imagesPath)) {
  console.error(`Error: directory not found: ${imagesPath}`);
  process.exit(1);
}

const outputDir = join(import.meta.dir, "docs");
await Bun.$`mkdir -p ${outputDir}`;

const glob = new Bun.Glob("*.png");
const pngFiles = await Array.fromAsync(glob.scan({ cwd: imagesPath, onlyFiles: true }));

if (pngFiles.length === 0) {
  console.log("No PNG files found in", imagesPath);
  process.exit(0);
}

const COPYRIGHT = "Copyright (c) 2026 Mikhail Bugakov. All rights reserved. Unauthorized copying, modification, or distribution is strictly prohibited. License: https://github.com/fosemberg/fosord-assets/blob/main/LICENSE.md";

const metadata = {
  exif: { IFD0: { Copyright: COPYRIGHT } },
} as Parameters<ReturnType<typeof sharp>["withMetadata"]>[0];

const CARDS_FILE = "images.json";
const cards: Record<string, string[]> = {};

// Two-tone ink sets are generated as strictly (0,0,0)/(255,255,255) images
// (gen-art `--skin bw` binarizes every render). Lossy webp would smear gray
// fringes along every stroke and undo that; on flat two-colour art lossless is
// the smaller file anyway. `bun run start` still converts everything; the extra
// `bun run mono` narrows a run down to just the two-tone sets (add --force to
// re-publish ones whose png was re-rolled or re-thresholded).
const MONO_SKINS = new Set(["bw"]);
const isMono = (segments: string[]) =>
  segments.some(s => s.startsWith("skin_") && MONO_SKINS.has(s.slice(5)));

// Structured naming: `id[__skin_<v>][__form_<v>]`. Segments split on `__`;
// the first is the card id, the rest form the variant suffix (e.g. `skin_2`,
// `form_storm`, `skin_2__form_storm`). A bare id is the base image.
const parsed = pngFiles.map(file => {
  const name = basename(file, ".png");
  const [id, ...segments] = name.split("__");
  return { file, name, id, segments, mono: isMono(segments) };
});

// images.json is rebuilt from scratch, so it must always see EVERY png —
// otherwise a filtered run would drop the other half of the catalogue.
for (const { id, segments } of parsed) {
  if (segments.length) (cards[id] ??= []).push(segments.join("__"));
  else cards[id] ??= [];
}

const onlyMono = process.argv.includes("--mono");
const noMono = process.argv.includes("--no-mono");
const force = process.argv.includes("--force");
const queue = parsed.filter(p => (onlyMono ? p.mono : noMono ? !p.mono : true));

const scope = onlyMono ? "mono skins only" : noMono ? "skipping mono skins" : "everything";
console.log(`Found ${pngFiles.length} PNG file(s), converting ${queue.length} (${scope})...`);

const skipped: string[] = [];
const generated: string[] = [];
const failed: string[] = [];

for (const { file, name, mono } of queue) {
  const inputPath = join(imagesPath, file);
  const outputName = name + ".webp";
  const outputPath = join(outputDir, outputName);

  if (existsSync(outputPath) && !force) {
    skipped.push(outputName);
    continue;
  }

  try {
    const webpOptions = mono ? { lossless: true, effort: 6 } : {};
    await sharp(inputPath).withMetadata(metadata).webp(webpOptions).toFile(outputPath);
    generated.push(outputName);
  } catch (err) {
    failed.push(`${file}: ${(err as Error).message}`);
  }
}

const cardsPath = join(outputDir, CARDS_FILE);
await Bun.write(cardsPath, JSON.stringify(cards, null, 2));

console.log("\n========== REPORT ==========");

console.log(`\nSkipped (already exist): ${skipped.length}`);
const HEAD = 2;
const TAIL = 2;
if (skipped.length <= HEAD + TAIL) {
  for (const name of skipped) console.log(`  - ${name}`);
} else {
  for (const name of skipped.slice(0, HEAD)) console.log(`  - ${name}`);
  console.log(`  ... (${skipped.length - HEAD - TAIL} more)`);
  for (const name of skipped.slice(-TAIL)) console.log(`  - ${name}`);
}

console.log(`\nGenerated: ${generated.length}`);
for (const name of generated) console.log(`  + ${name}`);

if (failed.length > 0) {
  console.log(`\nErrors: ${failed.length}`);
  for (const msg of failed) console.log(`  ✗ ${msg}`);
}

console.log(`\nCards in ${CARDS_FILE}: ${Object.keys(cards).length}`);
console.log("============================");
