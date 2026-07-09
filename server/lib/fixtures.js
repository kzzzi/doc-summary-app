const fs = require('fs');
const path = require('path');

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');
const MANIFEST_PATH = path.join(FIXTURES_DIR, 'manifest.json');
const VALID_LENGTHS = ['short', 'medium', 'detailed'];

let manifestCache = null;

function loadManifest() {
  if (manifestCache) return manifestCache;
  try {
    manifestCache = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    manifestCache = {};
  }
  return manifestCache;
}

// This demo only recognizes a fixed set of sample documents, each shipped
// with a pre-written analysis at three summary lengths. Anything else (an
// unregistered file, or a length with no variant) has no result to return.
function getFixture(originalName, length) {
  const manifest = loadManifest();
  const variants = manifest[originalName];
  if (!variants) return null;

  const key = VALID_LENGTHS.includes(length) ? length : 'medium';
  const fixtureFile = variants[key];
  if (!fixtureFile) return null;

  try {
    return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, fixtureFile), 'utf8'));
  } catch {
    return null;
  }
}

module.exports = { getFixture };
