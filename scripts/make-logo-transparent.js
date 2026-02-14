/**
 * Reads assets/logo.png (pink text on black), makes black pixels transparent,
 * writes assets/logo.png (overwrites) so the logo has a transparent background.
 * Run from project root: node scripts/make-logo-transparent.js
 * Requires: npm install sharp (or run from folder with sharp)
 */
const fs = require("fs");
const path = require("path");

async function main() {
  let sharp;
  try {
    sharp = require("sharp");
  } catch (_) {
    console.error("Run: npm install sharp");
    process.exit(1);
  }

  const root = path.resolve(__dirname, "..");
  const defaultInput = path.join(root, "assets", "logo.png");
  const inputPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : defaultInput;
  const outputPath = path.join(root, "assets", "logo.png");
  const tempPath = path.join(root, "assets", "logo-transparent-temp.png");

  if (!fs.existsSync(inputPath)) {
    console.error("Not found:", inputPath);
    console.error("Usage: node scripts/make-logo-transparent.js [path/to/input.png]");
    process.exit(1);
  }

  const image = sharp(inputPath);
  const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const threshold = 45; // pixels with R,G,B all below this become transparent

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r <= threshold && g <= threshold && b <= threshold) {
      data[i + 3] = 0; // set alpha to 0
    }
  }

  await sharp(data, { raw: { width, height, channels } })
    .png()
    .toFile(tempPath);

  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  fs.renameSync(tempPath, outputPath);
  console.log("Written transparent logo to assets/logo.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
