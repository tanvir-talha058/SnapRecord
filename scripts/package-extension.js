// Builds a distributable zip of the extension: dist/snaprecord-v<version>.zip
// Only files in EXTENSION_FILES are included — no node_modules, tests,
// docs, or dev config — so the archive is exactly what Chrome loads.
// Run via: npm run package
const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');
const { EXTENSION_FILES } = require('./extension-files');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(REPO_ROOT, 'dist');

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'manifest.json'), 'utf8'));
  const version = manifest.version;

  for (const relPath of EXTENSION_FILES) {
    const fullPath = path.join(REPO_ROOT, relPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`package-extension: expected file missing: ${relPath}`);
    }
  }

  fs.mkdirSync(DIST_DIR, { recursive: true });
  const outputName = `snaprecord-v${version}.zip`;
  const outputPath = path.join(DIST_DIR, outputName);
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  const output = fs.createWriteStream(outputPath);
  const archive = new ZipArchive({ zlib: { level: 9 } });

  output.on('close', () => {
    const sizeKb = (archive.pointer() / 1024).toFixed(1);
    console.log(`Wrote ${path.relative(REPO_ROOT, outputPath)} (${sizeKb} KB, ${EXTENSION_FILES.length} files, v${version})`);
  });

  archive.on('warning', (err) => { throw err; });
  archive.on('error', (err) => { throw err; });
  archive.pipe(output);

  for (const relPath of EXTENSION_FILES) {
    archive.file(path.join(REPO_ROOT, relPath), { name: relPath });
  }

  archive.finalize();
}

main();
