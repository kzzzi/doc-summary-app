const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const PDFDocument = require('pdfkit');

const FONT_REGULAR = path.join(__dirname, '..', 'assets', 'fonts', 'malgun.ttf');
const FONT_BOLD = path.join(__dirname, '..', 'assets', 'fonts', 'malgunbd.ttf');

// fileSections: [{ title, analysis: { documentType, oneLineSummary, sections: [...] } }]
// Each analysis section is one of:
//   { type: 'fields', title, fields: [{label, value, evidence}] }
//   { type: 'list'|'steps', title, items: [{text, evidence}] }
//   { type: 'text', title, content, evidence }

function withEvidence(text, evidence) {
  return evidence ? `${text} (근거: ${evidence})` : text;
}

function toTxt(docTitle, fileSections) {
  const header = `[${docTitle}]\n\n`;
  const body = fileSections
    .map((fileSection) => {
      const a = fileSection.analysis;
      const parts = [`## ${fileSection.title}`, `문서 유형: ${a.documentType}`, '', '[한 줄 요약]', a.oneLineSummary];

      a.sections.forEach((sec) => {
        parts.push('', `[${sec.title}]`);
        if (sec.type === 'fields') {
          parts.push(sec.fields.map((f) => `- ${f.label}: ${withEvidence(f.value, f.evidence)}`).join('\n'));
        } else if (sec.type === 'steps') {
          parts.push(sec.items.map((it, i) => `${i + 1}. ${withEvidence(it.text, it.evidence)}`).join('\n'));
        } else if (sec.type === 'list') {
          parts.push(sec.items.map((it) => `- ${withEvidence(it.text, it.evidence)}`).join('\n'));
        } else if (sec.type === 'text') {
          parts.push(withEvidence(sec.content, sec.evidence));
        }
      });

      return parts.join('\n');
    })
    .join('\n\n----------------------------\n\n');
  return header + body + '\n';
}

async function toDocx(docTitle, fileSections) {
  const children = [new Paragraph({ text: docTitle, heading: HeadingLevel.HEADING_1 })];

  fileSections.forEach((fileSection, idx) => {
    const a = fileSection.analysis;
    if (idx > 0) children.push(new Paragraph({ text: '' }));

    children.push(new Paragraph({ text: fileSection.title, heading: HeadingLevel.HEADING_2 }));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `문서 유형: ${a.documentType}`, italics: true, color: '888888' })],
        spacing: { after: 200 },
      }),
    );
    children.push(new Paragraph({ text: '한 줄 요약', heading: HeadingLevel.HEADING_3 }));
    children.push(new Paragraph({ text: a.oneLineSummary, spacing: { after: 200 } }));

    a.sections.forEach((sec) => {
      children.push(new Paragraph({ text: sec.title, heading: HeadingLevel.HEADING_3, spacing: { before: 200 } }));

      if (sec.type === 'fields') {
        sec.fields.forEach((f) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${f.label}: `, bold: true }),
                new TextRun({ text: withEvidence(f.value, f.evidence) }),
              ],
              bullet: { level: 0 },
              spacing: { after: 100 },
            }),
          );
        });
      } else if (sec.type === 'steps') {
        sec.items.forEach((it, i) => {
          children.push(
            new Paragraph({ text: `${i + 1}. ${withEvidence(it.text, it.evidence)}`, spacing: { after: 100 } }),
          );
        });
      } else if (sec.type === 'list') {
        sec.items.forEach((it) => {
          children.push(
            new Paragraph({
              text: withEvidence(it.text, it.evidence),
              bullet: { level: 0 },
              spacing: { after: 100 },
            }),
          );
        });
      } else if (sec.type === 'text') {
        children.push(new Paragraph({ text: withEvidence(sec.content, sec.evidence), spacing: { after: 100 } }));
      }
    });
  });

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

function toPdf(docTitle, fileSections) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('Korean', FONT_REGULAR);
    doc.registerFont('Korean-Bold', FONT_BOLD);

    doc.font('Korean-Bold').fontSize(18).fillColor('#1f2430').text(docTitle);
    doc.moveDown(1);

    const heading = (text) => {
      doc.font('Korean-Bold').fontSize(12).fillColor('#3557f0').text(text);
      doc.moveDown(0.3);
    };
    const body = (text) => {
      doc.font('Korean').fontSize(11).fillColor('#000000').text(text, { lineGap: 3 });
      doc.moveDown(0.5);
    };

    fileSections.forEach((fileSection, idx) => {
      const a = fileSection.analysis;
      if (idx > 0) doc.moveDown(1);

      doc.font('Korean-Bold').fontSize(15).fillColor('#1f2430').text(fileSection.title);
      doc.moveDown(0.2);
      doc.font('Korean').fontSize(10).fillColor('#888888').text(`문서 유형: ${a.documentType}`);
      doc.moveDown(0.6);

      heading('한 줄 요약');
      body(a.oneLineSummary);

      a.sections.forEach((sec) => {
        heading(sec.title);
        if (sec.type === 'fields') {
          body(sec.fields.map((f) => `•  ${f.label}: ${withEvidence(f.value, f.evidence)}`).join('\n'));
        } else if (sec.type === 'steps') {
          body(sec.items.map((it, i) => `${i + 1}. ${withEvidence(it.text, it.evidence)}`).join('\n'));
        } else if (sec.type === 'list') {
          body(sec.items.map((it) => `•  ${withEvidence(it.text, it.evidence)}`).join('\n'));
        } else if (sec.type === 'text') {
          body(withEvidence(sec.content, sec.evidence));
        }
      });
    });

    doc.end();
  });
}

module.exports = { toTxt, toDocx, toPdf };
