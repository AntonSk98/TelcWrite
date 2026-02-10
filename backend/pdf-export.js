/**
 * TelcWrite PDF Export — minimalist, single accent color.
 */

let _jsPDFReady = null;

function loadJsPDF() {
    if (_jsPDFReady) return _jsPDFReady;
    _jsPDFReady = new Promise((resolve, reject) => {
        if (window.jspdf?.jsPDF) return resolve(window.jspdf.jsPDF);
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/3.0.3/jspdf.umd.min.js';
        s.onload = () => resolve(window.jspdf.jsPDF);
        s.onerror = () => reject(new Error('Failed to load jsPDF'));
        document.head.appendChild(s);
    });
    return _jsPDFReady;
}

async function generatePdf(data) {
    const jsPDF = await loadJsPDF();
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = pdf.internal.pageSize.getWidth();
    const H = pdf.internal.pageSize.getHeight();
    const M = 24;
    const CW = W - M * 2;
    let y = M;

    const accent = [99, 102, 241]; // #6366f1
    const black = [33, 37, 41];
    const gray = [140, 140, 150];
    const red = [220, 38, 38];   // #dc2626
    const green = [22, 163, 74]; // #16a34a

    function need(h) { if (y + h > H - M) { pdf.addPage(); y = M; } }

    function wrap(str, size, color, leading) {
        pdf.setFontSize(size);
        pdf.setTextColor(...color);
        pdf.setFont('helvetica', 'normal');
        pdf.splitTextToSize(str || '', CW).forEach(line => {
            need(leading + 1);
            pdf.text(line, M, y);
            y += leading;
        });
    }

    /** Render correction text with --removed-- in red and ++added++ in green */
    function wrapCorrection(str, size, leading) {
        if (!str) return;
        pdf.setFontSize(size);
        pdf.setFont('helvetica', 'normal');
        // Parse into colored segments
        const parts = [];
        let last = 0;
        str.replace(/--(.*?)--|\+\+(.*?)\+\+/g, (match, rm, add, idx) => {
            if (idx > last) parts.push({ t: str.slice(last, idx), c: black });
            if (rm !== undefined) { if (parts.length) parts.push({ t: ' ', c: black }); parts.push({ t: rm, c: red }); }
            if (add !== undefined) { if (parts.length) parts.push({ t: ' ', c: black }); parts.push({ t: add, c: green }); }
            last = idx + match.length;
        });
        if (last < str.length) parts.push({ t: str.slice(last), c: black });

        // Render word by word, wrapping when line is full
        let x = M;
        need(leading + 1);
        parts.forEach(({ t, c }) => {
            pdf.setTextColor(...c);
            t.split(/(\n)/).forEach(seg => {
                if (seg === '\n') { y += leading; need(leading + 1); x = M; return; }
                seg.split(/(\s+)/).forEach(word => {
                    if (!word) return;
                    const w = pdf.getTextWidth(word);
                    if (x > M && x + w > M + CW) { y += leading; need(leading + 1); x = M; }
                    pdf.text(word, x, y);
                    x += w;
                });
            });
        });
        y += leading;
    }

    // ── Header ──
    pdf.setFontSize(20);
    pdf.setTextColor(...accent);
    pdf.setFont('helvetica', 'bold');
    pdf.text('TelcWrite', M, y);
    y += 6;
    pdf.setFontSize(8);
    pdf.setTextColor(...gray);
    pdf.setFont('helvetica', 'normal');
    pdf.text(
        new Date().toLocaleDateString('de-DE') + '  \u00b7  ' +
        data.length + ' Dokument' + (data.length !== 1 ? 'e' : ''),
        M, y
    );
    y += 4;
    pdf.setDrawColor(...accent);
    pdf.setLineWidth(0.5);
    pdf.line(M, y, W - M, y);
    y += 10;

    // ── Documents ──
    data.forEach((item, i) => {
        need(20);

        // Title
        pdf.setFontSize(15);
        pdf.setTextColor(...accent);
        pdf.setFont('helvetica', 'bold');
        pdf.text(item.title || 'Ohne Titel', M, y);

        // Date right-aligned
        const d = item.creationDate ? new Date(item.creationDate).toLocaleDateString('de-DE') : '';
        pdf.setFontSize(8);
        pdf.setTextColor(...gray);
        pdf.setFont('helvetica', 'normal');
        pdf.text(d, W - M, y, { align: 'right' });
        y += 5;

        // Score
        if (item.reviewScore != null) {
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            pdf.text(item.reviewScore + ' / 45', M, y);
            y += 5;
        }

        // Sections
        [['Aufgabe', item.task],
        ['Feedback', item.reviewFeedback],
        ].forEach(([label, value]) => {
            if (!value) return;
            need(10);
            pdf.setFontSize(10);
            pdf.setTextColor(...accent);
            pdf.setFont('helvetica', 'bold');
            pdf.text(label, M, y);
            y += 5;
            wrap(value, 9, black, 3.8);
            y += 3;
        });

        // Korrektur with colored diff markers
        if (item.correction) {
            need(10);
            pdf.setFontSize(10);
            pdf.setTextColor(...accent);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Korrigierter Text', M, y);
            y += 5;
            wrapCorrection(item.correction, 9, 3.8);
            y += 3;
        }

        // If no feedback, show notice + submission text
        if (!item.reviewFeedback) {
            need(8);
            pdf.setFontSize(9);
            pdf.setTextColor(...gray);
            pdf.setFont('helvetica', 'italic');
            pdf.text('Noch kein Feedback vorhanden', M, y);
            y += 5;

            if (item.submissionText) {
                need(10);
                pdf.setFontSize(10);
                pdf.setTextColor(...accent);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Einreichung', M, y);
                y += 5;
                wrap(item.submissionText, 9, black, 3.8);
                y += 3;
            }
        }

        // Thin separator
        if (i < data.length - 1) {
            y += 2;
            need(6);
            pdf.setDrawColor(220, 220, 225);
            pdf.setLineWidth(0.15);
            pdf.line(M, y, W - M, y);
            y += 8;
        }
    });

    pdf.save('TelcWrite.pdf');
}

window.TelcWriteExport = { generatePdf };

