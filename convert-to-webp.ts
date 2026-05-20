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

console.log(`Found ${pngFiles.length} PNG file(s), converting...`);

const CARDS_FILE = "images.json";
const cards: Record<string, string[]> = {};

for (const file of pngFiles) {
  const inputPath = join(imagesPath, file);
  const outputName = basename(file, ".png") + ".webp";
  const outputPath = join(outputDir, outputName);

  const name = basename(file, ".png");
  const variantMatch = name.match(/^(.+)_(\d+)$/);
  if (variantMatch) {
    const [, base, variant] = variantMatch;
    (cards[base] ??= []).push(variant);
  } else {
    cards[name] ??= [];
  }

  if (existsSync(outputPath)) {
    console.log(`- ${file} skipped (already exists)`);
    continue;
  }

  try {
    await sharp(inputPath).withMetadata(metadata).webp().toFile(outputPath);
    console.log(`✓ ${file} → docs/${outputName}`);
  } catch (err) {
    console.error(`✗ ${file}: ${(err as Error).message}`);
  }
}

const cardsPath = join(outputDir, CARDS_FILE);
await Bun.write(cardsPath, JSON.stringify(cards, null, 2));
console.log(`✓ docs/cards.json updated (${Object.keys(cards).length} cards)`);

console.log("Done.");
