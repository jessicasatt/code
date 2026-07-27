/**
 * Generates simple, temporary placeholder app icons (per SPEC.md: "App
 * icons using simple temporary generated assets"). Replace with real
 * branded artwork whenever design assets are ready — this script just
 * needs to keep the PWA installable in the meantime.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUTPUT_DIR = path.join(process.cwd(), "public", "icons");

function iconSvg(size: number, padding: number): string {
  const inner = size - padding * 2;
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#2a2622" />
  <rect x="${padding}" y="${padding}" width="${inner}" height="${inner}" rx="${inner * 0.22}" fill="#2a2622" stroke="#a8823f" stroke-width="${size * 0.02}" />
  <text
    x="50%" y="54%"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${size * 0.46}"
    fill="#a8823f"
  >J</text>
</svg>`.trim();
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const targets = [
    { name: "icon-192.png", size: 192, padding: 0 },
    { name: "icon-512.png", size: 512, padding: 0 },
    { name: "icon-maskable-512.png", size: 512, padding: 64 },
    { name: "apple-touch-icon.png", size: 180, padding: 0 },
  ];

  for (const target of targets) {
    const svg = Buffer.from(iconSvg(target.size, target.padding));
    const outputPath = path.join(OUTPUT_DIR, target.name);
    await sharp(svg).png().toFile(outputPath);
    console.log(`Wrote ${outputPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
