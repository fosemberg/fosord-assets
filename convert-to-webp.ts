import sharp from "sharp";
import { join, basename } from "path";

const imagesPath = process.env.IMAGES_PATH;

if (!imagesPath) {
  console.error("Error: IMAGES_PATH is not set in .env");
  process.exit(1);
}

if (!(await Bun.file(imagesPath).exists())) {
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

console.log(`Found ${pngFiles.length} PNG file(s), converting...`);

for (const file of pngFiles) {
  const inputPath = join(imagesPath, file);
  const outputName = basename(file, ".png") + ".webp";
  const outputPath = join(outputDir, outputName);

  try {
    await sharp(inputPath).webp().toFile(outputPath);
    console.log(`✓ ${file} → docs/${outputName}`);
  } catch (err) {
    console.error(`✗ ${file}: ${(err as Error).message}`);
  }
}

console.log("Done.");
