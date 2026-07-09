const fs = require('fs/promises');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const yauzl = require('yauzl');
const CFB = require('cfb');

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.hwpx', '.hwp'];

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeXmlEntities(str) {
  return str.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (match, entity) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return XML_ENTITIES[entity] ?? match;
  });
}

function readZipEntry(zipfile, entry) {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, readStream) => {
      if (err) return reject(err);
      const chunks = [];
      readStream.on('data', (c) => chunks.push(c));
      readStream.on('end', () => resolve(Buffer.concat(chunks)));
      readStream.on('error', reject);
    });
  });
}

// HWPX is a zip of HWPML XML sections (Contents/section0.xml, section1.xml, ...).
// Text runs live in <hp:t> tags, same shape as OOXML's <a:t> in pptx/docx.
function extractHwpx(filePath) {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      const sectionBuffers = new Map();

      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        const match = entry.fileName.match(/^Contents\/section(\d+)\.xml$/i);
        if (!match) {
          zipfile.readEntry();
          return;
        }
        readZipEntry(zipfile, entry)
          .then((buf) => {
            sectionBuffers.set(Number(match[1]), buf.toString('utf8'));
            zipfile.readEntry();
          })
          .catch(reject);
      });

      zipfile.on('end', () => {
        const sections = [...sectionBuffers.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([, xml]) => {
            // Lookahead boundary matters: hp:tab/hp:tbl/hp:tc/hp:tr also start
            // with "hp:t" and would otherwise be mistaken for the text tag.
            // Self-closing empty runs are stripped first so they can't get
            // lazily paired with a later, unrelated </hp:t>.
            const cleaned = xml.replace(/<hp:t(?=[\s>])[^>]*\/>/g, '');
            const runs = [...cleaned.matchAll(/<hp:t(?=[\s>])[^>]*>([\s\S]*?)<\/hp:t>/g)];
            return runs.map((m) => decodeXmlEntities(m[1])).join(' ');
          });
        resolve(sections.join('\n\n').trim());
      });
      zipfile.on('error', reject);
    });
  });
}

// Old binary HWP (v5.0, OLE compound file) has no straightforward full-text
// stream without implementing its proprietary record format. The "PrvText"
// stream holds a plain UTF-16LE preview (roughly the first ~1000 characters)
// which is enough for a demo-level summary, though not the full document body.
function extractHwp(filePath) {
  const cfb = CFB.read(filePath, { type: 'file' });
  const idx = cfb.FullPaths.findIndex((p) => /PrvText$/i.test(p));
  if (idx === -1) return '';
  const entry = cfb.FileIndex[idx];
  return Buffer.from(entry.content).toString('utf16le').trim();
}

async function extractText(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === '.pdf') {
    const buffer = await fs.readFile(filePath);
    const data = await pdfParse(buffer);
    return data.text.trim();
  }

  if (ext === '.docx') {
    const { value } = await mammoth.extractRawText({ path: filePath });
    return value.trim();
  }

  if (ext === '.txt') {
    const buffer = await fs.readFile(filePath, 'utf8');
    return buffer.trim();
  }

  if (ext === '.hwpx') {
    return extractHwpx(filePath);
  }

  if (ext === '.hwp') {
    return extractHwp(filePath);
  }

  throw new Error(`지원하지 않는 파일 형식입니다: ${ext}`);
}

module.exports = { extractText, SUPPORTED_EXTENSIONS };
