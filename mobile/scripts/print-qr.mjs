import QRCode from "qrcode";

const url = process.argv[2];
if (!url) {
  console.error("Usage: node scripts/print-qr.mjs <exp://url> [outfile]");
  process.exit(1);
}
const outfile = process.argv[3] ?? "mobile-qr.png";
await QRCode.toFile(outfile, url, { width: 480, margin: 2 });
console.log(`Wrote ${outfile} for ${url}`);
