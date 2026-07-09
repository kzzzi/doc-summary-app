const path = require('path');
const crypto = require('crypto');
const fs = require('fs/promises');
const express = require('express');
const multer = require('multer');

const { extractText, SUPPORTED_EXTENSIONS } = require('./lib/extractText');
const { getFixture } = require('./lib/fixtures');
const { toTxt, toDocx, toPdf } = require('./lib/exporters');

const app = express();
const PORT = process.env.PORT || 4000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const MAX_FILE_SIZE = 40 * 1024 * 1024; // 40MB (covers the largest sample docx)
const MAX_FILES = 10;

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
});

// In-memory store for the demo: sessionId -> { files: [{ id, name, text, charCount }], lastResult }
const sessions = new Map();

function setDownloadHeaders(res, filename, contentType) {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  res.setHeader('Content-Type', contentType);
}

function toSections(session) {
  const { lastResult, files } = session;
  if (!lastResult) return null;

  if (lastResult.mode === 'individual') {
    return lastResult.items.map((item) => ({ title: item.name, analysis: item.analysis }));
  }

  const title = files.length > 1 ? `통합 분석 (${files.length}개 문서)` : files[0].name;
  return [{ title, analysis: lastResult.analysis }];
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.post('/api/upload', upload.array('files', MAX_FILES), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: '업로드된 파일이 없습니다.' });
  }

  const results = [];
  const errors = [];

  for (const file of req.files) {
    // busboy decodes multipart filenames as latin1 by default; browsers send
    // them as raw UTF-8 bytes, so non-ASCII names (e.g. Korean) come out as
    // mojibake unless we reinterpret the bytes as UTF-8.
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName).toLowerCase();

    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      errors.push({ name: originalName, error: `지원하지 않는 파일 형식입니다 (${ext || '확장자 없음'})` });
      await fs.unlink(file.path).catch(() => {});
      continue;
    }

    try {
      const text = await extractText(file.path, originalName);
      if (!text) {
        errors.push({ name: originalName, error: '문서에서 텍스트를 추출하지 못했습니다.' });
      } else {
        results.push({ id: crypto.randomUUID(), name: originalName, text, charCount: text.length });
      }
    } catch (err) {
      errors.push({ name: originalName, error: err.message });
    } finally {
      await fs.unlink(file.path).catch(() => {});
    }
  }

  if (results.length === 0) {
    return res.status(422).json({ error: '문서에서 텍스트를 추출하지 못했습니다.', errors });
  }

  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, { files: results, lastResult: null });

  res.json({
    sessionId,
    files: results.map((f) => ({ name: f.name, charCount: f.charCount })),
    errors,
  });
});

// This demo only shows results for a fixed set of registered sample
// documents (see server/fixtures) — there is no live analysis engine.
function analyzeFile(file, length) {
  const fixture = getFixture(file.name, length);
  if (!fixture) {
    const err = new Error(`"${file.name}"은(는) 등록된 샘플 문서가 아닙니다. 이 데모는 지정된 샘플 문서에서만 결과를 확인할 수 있습니다.`);
    err.code = 'NOT_A_SAMPLE';
    throw err;
  }
  return fixture;
}

app.post('/api/analyze', (req, res) => {
  const { sessionId, mode, length } = req.body || {};
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: '세션을 찾을 수 없습니다. 다시 업로드해주세요.' });
  }

  try {
    let result;

    if (session.files.length > 1 && mode === 'individual') {
      const items = session.files.map((f) => ({ name: f.name, analysis: analyzeFile(f, length) }));
      result = { mode: 'individual', items };
    } else if (session.files.length === 1) {
      const analysis = analyzeFile(session.files[0], length);
      result = { mode: 'combined', fileNames: [session.files[0].name], analysis };
    } else {
      // No pre-baked fixture exists for an arbitrary combination of files.
      throw Object.assign(
        new Error('여러 문서를 하나로 합친 통합 분석은 이 데모에서 지원하지 않습니다. 문서를 하나씩 분석해주세요.'),
        { code: 'NOT_A_SAMPLE' },
      );
    }

    session.lastResult = result;
    res.json(result);
  } catch (err) {
    res.status(err.code === 'NOT_A_SAMPLE' ? 422 : 500).json({ error: err.message });
  }
});

app.get('/api/download/:sessionId/:format', async (req, res) => {
  const { sessionId, format } = req.params;
  const session = sessions.get(sessionId);
  const sections = session && toSections(session);

  if (!sections) {
    return res.status(404).json({ error: '다운로드할 분석 결과가 없습니다.' });
  }

  const docTitle =
    session.files.length > 1
      ? `문서 분석 모음 (${session.files.length}건)`
      : path.basename(session.files[0].name, path.extname(session.files[0].name));

  try {
    if (format === 'txt') {
      setDownloadHeaders(res, `${docTitle}.txt`, 'text/plain; charset=utf-8');
      return res.send(toTxt(docTitle, sections));
    }
    if (format === 'docx') {
      const buffer = await toDocx(docTitle, sections);
      setDownloadHeaders(
        res,
        `${docTitle}.docx`,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      return res.send(buffer);
    }
    if (format === 'pdf') {
      const buffer = await toPdf(docTitle, sections);
      setDownloadHeaders(res, `${docTitle}.pdf`, 'application/pdf');
      return res.send(buffer);
    }
    return res.status(400).json({ error: '지원하지 않는 다운로드 형식입니다.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `파일 용량이 너무 큽니다. 파일당 최대 ${MAX_FILE_SIZE / 1024 / 1024}MB까지 업로드할 수 있습니다.` });
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: `파일은 최대 ${MAX_FILES}개까지 업로드할 수 있습니다.` });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`문서 분석 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
