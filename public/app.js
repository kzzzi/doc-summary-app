const state = {
  files: [], // File objects staged for upload
  sessionId: null,
  uploadedFiles: [], // [{ name, charCount }]
};

const steps = document.querySelectorAll('.step');
const panels = document.querySelectorAll('.panel');

function goToStep(n) {
  steps.forEach((el) => el.classList.toggle('active', Number(el.dataset.step) === n));
  panels.forEach((el) => el.classList.toggle('active', el.id === `panel-${n}`));
}

document.querySelectorAll('[data-back]').forEach((btn) => {
  btn.addEventListener('click', () => goToStep(Number(btn.dataset.back)));
});

const generateBtn = document.getElementById('generateBtn');

// --- Option help popups ---
const HELP_CONTENT = {
  purpose: {
    title: '요약 목적',
    items: [
      { label: '빠른 요약', desc: '문서의 핵심 내용을 짧게 압축해 빠르게 파악합니다.' },
      { label: '보고용 요약', desc: '공유·보고에 적합하도록 공식적인 문장으로 정리합니다.' },
      { label: '검토용 요약', desc: '핵심 내용과 함께 확인 필요사항, 리스크, 누락 가능성을 점검합니다.' },
    ],
  },
  length: {
    title: '요약 길이',
    items: [
      { label: '짧게', desc: '핵심 내용만 3~5개 항목으로 간단히 요약합니다.' },
      { label: '보통', desc: '핵심 내용과 주요 근거를 함께 정리하는 기본 요약입니다.' },
      { label: '자세히', desc: '문서 구조를 따라 세부 내용, 시사점, 확인 필요사항까지 상세히 정리합니다.' },
    ],
  },
  format: {
    title: '출력 형식',
    items: [
      { label: '목록형', desc: '핵심 내용을 bullet로 정리합니다.' },
      { label: '문장형', desc: '보고서처럼 자연스러운 문단으로 정리합니다.' },
      { label: '표 형식', desc: '항목별로 구분하여 표로 정리합니다.' },
    ],
  },
  extras: {
    title: '추가 추출',
    items: [
      { label: '핵심 키워드', desc: '문서를 대표하는 핵심 키워드를 결과 하단에 표시합니다.' },
      { label: '확인 필요사항', desc: '누락, 모호한 표현, 검토가 필요한 내용을 표시합니다.' },
      { label: '원문 근거', desc: '요약 내용이 나온 페이지 또는 문단을 표시합니다.' },
    ],
  },
};

const helpModalOverlay = document.getElementById('helpModalOverlay');
const helpModalTitle = document.getElementById('helpModalTitle');
const helpModalList = document.getElementById('helpModalList');

function openHelpModal(key) {
  const content = HELP_CONTENT[key];
  if (!content) return;

  helpModalTitle.textContent = content.title;
  helpModalList.innerHTML = '';
  content.items.forEach((item) => {
    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = item.label;
    const span = document.createElement('span');
    span.textContent = item.desc;
    li.appendChild(strong);
    li.appendChild(span);
    helpModalList.appendChild(li);
  });

  helpModalOverlay.hidden = false;
}

function closeHelpModal() {
  helpModalOverlay.hidden = true;
}

document.querySelectorAll('.help-icon').forEach((btn) => {
  btn.addEventListener('click', () => openHelpModal(btn.dataset.help));
});
document.getElementById('helpModalClose').addEventListener('click', closeHelpModal);
helpModalOverlay.addEventListener('click', (e) => {
  if (e.target === helpModalOverlay) closeHelpModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !helpModalOverlay.hidden) closeHelpModal();
});

// --- Step 1: Upload ---
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const uploadError = document.getElementById('uploadError');
const fileChipList = document.getElementById('fileChipList');
const toStep2 = document.getElementById('toStep2');
const modeGroup = document.getElementById('modeGroup');

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function renderFileChips() {
  fileChipList.innerHTML = '';
  state.files.forEach((file, idx) => {
    const li = document.createElement('li');
    li.className = 'file-chip';

    const left = document.createElement('span');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-chip-name';
    nameSpan.textContent = file.name;
    const metaSpan = document.createElement('span');
    metaSpan.className = 'file-chip-meta';
    metaSpan.textContent = formatSize(file.size);
    left.appendChild(nameSpan);
    left.appendChild(metaSpan);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'file-chip-remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      state.files.splice(idx, 1);
      renderFileChips();
    });

    li.appendChild(left);
    li.appendChild(removeBtn);
    fileChipList.appendChild(li);
  });

  toStep2.disabled = state.files.length === 0;
}

function addFiles(newFiles) {
  newFiles.forEach((file) => {
    const exists = state.files.some((f) => f.name === file.name && f.size === file.size);
    if (!exists) state.files.push(file);
  });
  renderFileChips();
}

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer.files.length) {
    addFiles(Array.from(e.dataTransfer.files));
  }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) {
    addFiles(Array.from(fileInput.files));
    fileInput.value = '';
  }
});

toStep2.addEventListener('click', async () => {
  uploadError.textContent = '';
  toStep2.disabled = true;
  const originalLabel = toStep2.textContent;
  toStep2.textContent = '업로드 중...';

  const form = new FormData();
  state.files.forEach((file) => form.append('files', file));

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || '업로드에 실패했습니다.');
    }

    state.sessionId = data.sessionId;
    state.uploadedFiles = data.files;
    modeGroup.hidden = state.uploadedFiles.length <= 1;

    if (data.errors && data.errors.length) {
      alert(`일부 파일을 처리하지 못했습니다:\n${data.errors.map((e) => `- ${e.name}: ${e.error}`).join('\n')}`);
    }

    goToStep(2);
  } catch (err) {
    uploadError.textContent = err.message;
  } finally {
    toStep2.disabled = state.files.length === 0;
    toStep2.textContent = originalLabel;
  }
});

// --- Step 2 -> 3: Analyze ---
const resultContainer = document.getElementById('resultContainer');

function buildTable(headers, rows, emptyMessage, mutedLastCol) {
  if (rows.length === 0) {
    const p = document.createElement('p');
    p.className = 'table-empty';
    p.textContent = emptyMessage || '해당 없음';
    return p;
  }

  const table = document.createElement('table');
  table.className = 'data-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headers.forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    row.forEach((cell, colIdx) => {
      const td = document.createElement('td');
      td.textContent = String(cell);
      if (mutedLastCol && colIdx === row.length - 1) td.classList.add('evidence-cell');
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  return table;
}

// Appends the 원문 근거 (source page/paragraph) as a small, muted footnote
// right after the summary text it supports, rather than folding it into the
// same-size sentence — visually like a note attached to the summary.
function appendEvidenceNote(parent, evidence) {
  if (!evidence) return;
  const note = document.createElement('span');
  note.className = 'evidence-note';
  note.textContent = ` (근거: ${evidence})`;
  parent.appendChild(note);
}

// True if the last syllable of a Hangul word has a batchim (trailing
// consonant) — determines whether "은" or "는" reads naturally after it.
// Falls back to "는" for non-Hangul text (numbers, English, symbols).
function topicParticle(word) {
  const lastChar = word.trim().slice(-1);
  const code = lastChar.codePointAt(0) - 0xac00;
  if (code < 0 || code > 11171) return '는';
  return code % 28 !== 0 ? '은' : '는';
}

function ensureSentenceEnd(text) {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

// Renders one analysis section (fields/list/steps/text) according to the
// selected 출력 형식 (list/prose/table) and 원문 근거 toggle. When 원문 근거 is
// on, it's appended as a small muted note (see appendEvidenceNote) rather
// than folded into the summary sentence itself.
function renderSectionContent(sec, format, showEvidence) {
  if (sec.type === 'text') {
    const p = document.createElement('p');
    p.appendChild(document.createTextNode(sec.content));
    if (showEvidence) appendEvidenceNote(p, sec.evidence);
    return p;
  }

  if (sec.type === 'fields') {
    if (format === 'table') {
      const headers = showEvidence ? ['항목', '내용', '원문 근거'] : ['항목', '내용'];
      return buildTable(
        headers,
        sec.fields.map((f) => (showEvidence ? [f.label, f.value, f.evidence || ''] : [f.label, f.value])),
        null,
        showEvidence,
      );
    }
    if (format === 'prose') {
      const p = document.createElement('p');
      sec.fields.forEach((f, i) => {
        if (i > 0) p.appendChild(document.createTextNode(' '));
        p.appendChild(document.createTextNode(ensureSentenceEnd(`${f.label}${topicParticle(f.label)} ${f.value}`)));
        if (showEvidence) appendEvidenceNote(p, f.evidence);
      });
      return p;
    }
    const ul = document.createElement('ul');
    ul.className = 'plain-list';
    sec.fields.forEach((f) => {
      const li = document.createElement('li');
      const strong = document.createElement('strong');
      strong.textContent = `${f.label}: `;
      li.appendChild(strong);
      li.appendChild(document.createTextNode(f.value));
      if (showEvidence) appendEvidenceNote(li, f.evidence);
      ul.appendChild(li);
    });
    return ul;
  }

  // list or steps
  if (format === 'table') {
    const headers = showEvidence ? ['번호', '내용', '원문 근거'] : ['번호', '내용'];
    return buildTable(
      headers,
      sec.items.map((it, i) => (showEvidence ? [i + 1, it.text, it.evidence || ''] : [i + 1, it.text])),
      null,
      showEvidence,
    );
  }
  if (format === 'prose') {
    const p = document.createElement('p');
    sec.items.forEach((it, i) => {
      if (i > 0) p.appendChild(document.createTextNode(' '));
      p.appendChild(document.createTextNode(ensureSentenceEnd(it.text)));
      if (showEvidence) appendEvidenceNote(p, it.evidence);
    });
    return p;
  }
  const listEl = document.createElement(sec.type === 'steps' ? 'ol' : 'ul');
  listEl.className = 'plain-list';
  sec.items.forEach((it) => {
    const li = document.createElement('li');
    li.appendChild(document.createTextNode(it.text));
    if (showEvidence) appendEvidenceNote(li, it.evidence);
    listEl.appendChild(li);
  });
  return listEl;
}

function buildSection(section, options) {
  const a = section.analysis;
  const { format, purpose, showVerification, showEvidence, showKeywords } = options;
  const wrap = document.createElement('div');
  wrap.className = 'result-section';

  if (section.title) {
    const h = document.createElement('h4');
    h.className = 'result-title';
    h.textContent = section.title;
    wrap.appendChild(h);
  }

  const typeBadge = document.createElement('span');
  typeBadge.className = 'doc-type-badge';
  typeBadge.textContent = a.documentType;
  wrap.appendChild(typeBadge);

  const keywords = showKeywords ? (a.keywords || []) : [];

  const oneLineBox = document.createElement('div');
  oneLineBox.className = 'overview-box';
  const oneLineText = document.createElement('p');
  oneLineText.className = 'overview-text';
  oneLineText.textContent = a.oneLineSummary;
  oneLineBox.appendChild(oneLineText);
  wrap.appendChild(oneLineBox);

  const addBlock = (title, contentEl, highlight) => {
    const block = document.createElement('div');
    block.className = highlight ? 'summary-box summary-box-highlight' : 'summary-box';
    const blockLabel = document.createElement('div');
    blockLabel.className = 'block-label';
    blockLabel.textContent = title;
    block.appendChild(blockLabel);
    block.appendChild(contentEl);
    wrap.appendChild(block);
  };

  // 빠른 요약: collapse everything into one condensed bullet list, skip the
  // type-specific section breakdown entirely. Still respects 출력 형식 and
  // 원문 근거 by routing through the same renderSectionContent as everything else.
  if (purpose === 'quick') {
    const bullets = [];
    a.sections.forEach((sec) => {
      if (sec.key === 'needsVerification') return;
      if (sec.type === 'list' || sec.type === 'steps') {
        sec.items.forEach((it) => bullets.push({ text: it.text, evidence: it.evidence }));
      } else if (sec.type === 'fields') {
        sec.fields.forEach((f) => bullets.push({ text: `${f.label}: ${f.value}`, evidence: f.evidence }));
      } else if (sec.type === 'text') {
        bullets.push({ text: sec.content, evidence: sec.evidence });
      }
    });
    const condensedSection = { type: 'list', items: bullets.slice(0, 5) };
    addBlock('핵심 내용', renderSectionContent(condensedSection, format, showEvidence));
  } else {
    let sections = a.sections.filter((sec) => sec.key !== 'needsVerification' || showVerification);

    // 검토용 요약: pin 확인 필요사항 to the top and highlight it, since this
    // purpose is about checking for risk/gaps before the rest of the content.
    if (purpose === 'review') {
      const verifSec = sections.find((sec) => sec.key === 'needsVerification');
      if (verifSec) {
        addBlock(verifSec.title, renderSectionContent(verifSec, format, showEvidence), true);
        sections = sections.filter((sec) => sec.key !== 'needsVerification');
      }
    }

    sections.forEach((sec) => {
      addBlock(sec.title, renderSectionContent(sec, format, showEvidence));
    });
  }

  if (keywords.length > 0) {
    const tagRow = document.createElement('div');
    tagRow.className = 'tag-row';
    keywords.forEach((kw) => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.textContent = kw;
      tagRow.appendChild(chip);
    });
    addBlock('핵심 키워드', tagRow);
  }

  return wrap;
}

function renderResult(data, options) {
  resultContainer.innerHTML = '';

  if (data.mode === 'individual') {
    data.items.forEach((item) => {
      resultContainer.appendChild(buildSection({ title: item.name, analysis: item.analysis }, options));
    });
  } else {
    const title =
      data.fileNames && data.fileNames.length > 1 ? `통합 분석 (${data.fileNames.length}개 문서)` : null;
    resultContainer.appendChild(buildSection({ title, analysis: data.analysis }, options));
  }
}

generateBtn.addEventListener('click', async () => {
  const modeInput = document.querySelector('input[name="mode"]:checked');
  const mode = modeInput ? modeInput.value : 'combined';
  const length = document.querySelector('input[name="length"]:checked').value;

  const options = {
    purpose: document.querySelector('input[name="purpose"]:checked').value,
    format: document.querySelector('input[name="format"]:checked').value,
    showKeywords: document.querySelector('input[name="extras"][value="keywords"]').checked,
    showVerification: document.querySelector('input[name="extras"][value="verification"]').checked,
    showEvidence: document.querySelector('input[name="extras"][value="evidence"]').checked,
  };

  generateBtn.disabled = true;
  const originalLabel = generateBtn.textContent;
  generateBtn.textContent = '분석 중...';

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId, mode, length }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || '분석에 실패했습니다.');
    }

    renderResult(data, options);
    goToStep(3);
  } catch (err) {
    alert(err.message);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = originalLabel;
  }
});

// --- Step 3: Download / Restart ---
document.querySelectorAll('[data-format]').forEach((btn) => {
  btn.addEventListener('click', () => {
    window.location.href = `/api/download/${state.sessionId}/${btn.dataset.format}`;
  });
});

document.getElementById('restartBtn').addEventListener('click', () => {
  state.files = [];
  state.sessionId = null;
  state.uploadedFiles = [];
  fileInput.value = '';
  renderFileChips();
  resultContainer.innerHTML = '';
  goToStep(1);
});
