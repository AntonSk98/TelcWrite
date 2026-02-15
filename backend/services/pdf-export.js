/**
 * Klar – Server-side PDF Export (PDFKit)
 */
const PDFDocument = require('pdfkit');

const ACCENT = '#6366f1';
const BLACK = '#212529';
const GRAY = '#8c8c96';
const RED = '#dc2626';
const GREEN = '#16a34a';
const SEPARATOR = '#dcdce1';

const M = 68;  // margin in points (~24mm)

/**
 * Generate a PDF from document data and return it as a Buffer.
 * @param {Array<Object>} data - Documents with content
 * @returns {Promise<Buffer>}
 */
function generatePdf(data) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: M });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const W = doc.page.width;

        // ── Header ──
        doc.fontSize(20).fillColor(ACCENT).font('Helvetica-Bold')
            .text('Klar', M, M);

        doc.fontSize(8).fillColor(GRAY).font('Helvetica')
            .text(
                new Date().toLocaleDateString('de-DE') + '  \u00b7  ' +
                data.length + ' Dokument' + (data.length !== 1 ? 'e' : ''),
                M, doc.y
            );

        doc.moveDown(0.3);
        const lineY = doc.y;
        doc.strokeColor(ACCENT).lineWidth(0.5)
            .moveTo(M, lineY).lineTo(W - M, lineY).stroke();
        doc.moveDown(1);

        // ── Documents ──
        data.forEach((item, i) => {
            // Title + date
            const titleY = doc.y;
            doc.fontSize(15).fillColor(ACCENT).font('Helvetica-Bold')
                .text(item.title || 'Ohne Titel', M, titleY, { width: W - M * 2 - 80 });

            const d = item.creationDate
                ? new Date(item.creationDate).toLocaleDateString('de-DE')
                : '';
            if (d) {
                doc.fontSize(8).fillColor(GRAY).font('Helvetica')
                    .text(d, M, titleY, { width: W - M * 2, align: 'right' });
            }
            doc.y = Math.max(doc.y, titleY + 18);

            // Score
            if (item.reviewScore != null) {
                doc.fontSize(8).font('Helvetica-Bold').fillColor(BLACK)
                    .text(item.reviewScore + ' / 45', M, doc.y);
                doc.moveDown(0.3);
            }

            // Standard sections
            [['Aufgabe', item.task],
             ['Feedback', item.reviewFeedback]
            ].forEach(([label, value]) => {
                if (!value) return;
                sectionLabel(doc, label);
                doc.fontSize(9).fillColor(BLACK).font('Helvetica')
                    .text(value, M, doc.y, { width: W - M * 2, lineGap: 1.5 });
                doc.moveDown(0.5);
            });

            // Correction with colored diff
            if (item.correction) {
                sectionLabel(doc, 'Korrigierter Text');
                renderCorrection(doc, item.correction, W);
                doc.moveDown(0.5);
            }

            // If no feedback, show notice + submission
            if (!item.reviewFeedback) {
                doc.fontSize(9).fillColor(GRAY).font('Helvetica-Oblique')
                    .text('Noch kein Feedback vorhanden', M, doc.y, { width: W - M * 2 });
                doc.moveDown(0.3);

                if (item.submissionText) {
                    sectionLabel(doc, 'Einreichung');
                    doc.fontSize(9).fillColor(BLACK).font('Helvetica')
                        .text(item.submissionText, M, doc.y, { width: W - M * 2, lineGap: 1.5 });
                    doc.moveDown(0.5);
                }
            }

            // Separator between documents
            if (i < data.length - 1) {
                doc.moveDown(0.3);
                checkPage(doc, 20);
                const sepY = doc.y;
                doc.strokeColor(SEPARATOR).lineWidth(0.15)
                    .moveTo(M, sepY).lineTo(W - M, sepY).stroke();
                doc.moveDown(1.2);
            }
        });

        doc.end();
    });
}

/** Print a section label (e.g. "Aufgabe", "Feedback") */
function sectionLabel(doc, label) {
    checkPage(doc, 20);
    doc.fontSize(10).fillColor(ACCENT).font('Helvetica-Bold')
        .text(label, M, doc.y);
    doc.moveDown(0.2);
}

/**
 * Render correction text with --removed-- in red strikethrough
 * and ++added++ in green bold.
 */
function renderCorrection(doc, text, pageWidth) {
    const CW = pageWidth - M * 2;

    // Parse into segments
    const segments = [];
    let last = 0;
    text.replace(/--(.*?)--|\+\+(.*?)\+\+/g, (match, rm, add, idx) => {
        if (idx > last) segments.push({ t: text.slice(last, idx), color: BLACK });
        if (rm !== undefined) segments.push({ t: rm, color: RED, strike: true });
        if (add !== undefined) segments.push({ t: add, color: GREEN, bold: true });
        last = idx + match.length;
    });
    if (last < text.length) segments.push({ t: text.slice(last), color: BLACK });

    // Render word-by-word for wrapping
    let x = M;
    const fontSize = 9;
    const lineHeight = fontSize * 1.4;
    doc.fontSize(fontSize);

    segments.forEach(seg => {
        const font = seg.bold ? 'Helvetica-Bold' : 'Helvetica';
        doc.font(font).fillColor(seg.color);

        const lines = seg.t.split('\n');
        lines.forEach((line, li) => {
            if (li > 0) {
                x = M;
                doc.y += lineHeight;
                checkPage(doc, lineHeight + 2);
            }
            const words = line.split(/(\s+)/);
            words.forEach(word => {
                if (!word) return;
                const w = doc.widthOfString(word);
                if (x > M && x + w > M + CW) {
                    x = M;
                    doc.y += lineHeight;
                    checkPage(doc, lineHeight + 2);
                }
                doc.text(word, x, doc.y, { lineBreak: false, continued: false });
                x += w;
            });
        });
    });

    doc.y += lineHeight;
    doc.x = M;
}

/** Add a new page if remaining space is insufficient */
function checkPage(doc, needed) {
    const bottom = doc.page.height - M;
    if (doc.y + needed > bottom) {
        doc.addPage();
    }
}

module.exports = { generatePdf };
