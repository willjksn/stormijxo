/**
 * Makes white/light background transparent in a PNG.
 * Usage: node scripts/make-white-transparent.js <input.png> [output.png]
 * Default output: overwrites input. Requires: npm install sharp
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

  const inputPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : null;
  const outputPath = process.argv[3] ? path.resolve(process.cwd(), process.argv[3]) : inputPath;

  if (!inputPath || !fs.existsSync(inputPath)) {
    console.error("Usage: node scripts/make-white-transparent.js <input.png> [output.png]");
    process.exit(1);
  }

  const image = sharp(inputPath);
  const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const threshold = 248; // pixels with R,G,B all >= this become transparent (white/light)

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r >= threshold && g >= threshold && b >= threshold) {
      data[i + 3] = 0;
    }
  }

  await sharp(data, { raw: { width, height, channels } })
    .png()
    .toFile(outputPath);

  console.log("Written:", outputPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
