const express = require('express');
const fs = require('fs');
const path = require('path');
const he = require('he');

// Load environment variables
require('dotenv').config();

const repository = require('./repository');
const openai = require('./openai');
const pdfExport = require('./pdf-export');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// ==================== CONTENT API ====================

/**
 * GET /api/data/:documentId
 * Retrieve content for a document
 * @returns {{ content: Object }} Content object for the document
 */
app.get('/api/data/:documentId', async (req, res) => {
    const documentId = req.params.documentId;
    try {
        if (!documentId) {
            return res.status(400).json({ error: 'documentId parameter is required' });
        }
        const content = await repository.getContent(documentId);
        res.json({ content: content });
    } catch (error) {
        console.error('Database read error:', error);
        res.status(500).json({ error: 'Failed to fetch content by document id: ' + documentId });
    }
});

/**
 * POST /api/data/:documentId
 * Create or update content for a document
 * @body {Object} content - Content fields to upsert (task, submissionText, etc.)
 * @returns {{ success: boolean }}
 */
app.post('/api/data/:documentId', async (req, res) => {
    try {
        const documentId = req.params.documentId;
        const contentData = req.body;
        
        if (!documentId) {
            return res.status(400).json({ error: 'documentId parameter is required' });
        }
        
        await repository.upsertContent({
            documentId,
            ...contentData
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Database write error:', error);
        res.status(500).json({ error: 'Failed to save content' });
    }
});

// ==================== DOCUMENT API ====================

/**
 * GET /api/documents
 * List all documents
 * @returns {Array<{id: string, title: string, creationDate: string}>}
 */
app.get('/api/documents', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 5));
        const result = await repository.getDocuments({ page, limit });
        res.json(result);
    } catch (error) {
        console.error('Error listing documents:', error);
        res.status(500).json({ error: 'Failed to list documents' });
    }
});

/**
 * POST /api/documents
 * Create a new document
 * @body {{ title: string }} - Document title
 * @returns {{ success: boolean, document: Object }}
 */
app.post('/api/documents', async (req, res) => {
    const { title } = req.body;
    if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title is required to create a document' });
    }

    try {
        const document = await repository.createDocument(title.trim());
        // Trigger HTMX list refresh + toast
        res.set('HX-Trigger', 'refreshList, documentCreated');
        res.json({ success: true, document });
    } catch (error) {
        if (error === repository.DUPLICATE_DOCUMENT_ERROR) {
            return res.status(400).json({ error: error.message });
        }

        console.error('Error creating document:', error);
        res.status(500).json({ error: 'Failed to create document' });
    }
});

/**
 * DELETE /api/documents/:id
 * Delete a document and its associated content
 * @returns {{ success: boolean }}
 */
app.delete('/api/documents/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        await repository.deleteDocument(id);
        // Trigger HTMX list refresh + toast
        res.set('HX-Trigger', 'refreshList, documentDeleted');
        res.json({ success: true });
    } catch (error) {
        if (error === repository.DOCUMENT_NOT_FOUND_ERROR) {
            return res.status(404).json({ error: 'Document not found' });
        }
        console.error('Error deleting document:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

// ==================== CONTENT REVIEW API ====================

/**
 * POST /api/content/review/:documentId
 * Submit document content for AI review
 * @returns {{ success: boolean, message: string }}
 */
app.post('/api/content/review/:documentId', async (req, res) => {
    const { documentId } = req.params;
    
    if (!documentId) {
        return res.status(400).json({ error: 'documentId is required' });
    }

    try {
        // Get existing content for this document
        const content = await repository.getContent(documentId);
        if (!content || !content.submissionText) {
            return res.status(400).json({ error: 'No submission text found for review' });
        }

        // Call OpenAI for review
        const review = await openai.reviewContent({ 
            taskContent: content.task, 
            contentText: content.submissionText 
        });

        // Update content with review results
        await repository.upsertContent({
            ...content,
            documentId,
            reviewScore: review.score,
            reviewFeedback: review.feedback,
            correction: review.correction
        });

        res.json({
            success: true,
            message: 'AI review completed successfully'
        });
    } catch (error) {
        console.error('Error while reviewing content:', error);
        res.status(500).json({ error: 'Failed to review content' });
    }
});

// ==================== EXPORT API ====================

/**
 * GET /api/export/pdf
 * Generate and download a PDF of all documents
 */
app.get('/api/export/pdf', async (req, res) => {
    try {
        const data = await repository.getAllDocumentsWithContent();
        if (!data || !data.length) {
            return res.status(404).json({ error: 'Keine Daten zum Exportieren' });
        }
        const pdfBuffer = await pdfExport.generatePdf(data);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="Klar.pdf"',
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'PDF-Erstellung fehlgeschlagen' });
    }
});

/** GET /api/db/export - Download raw database as JSON */
app.get('/api/db/export', (req, res) => {
    const dbPath = path.resolve(process.env.DB_PATH || './db.json');
    res.download(dbPath, 'klar_backup.json');
});

/** POST /api/db/import - Import database from JSON */
app.post('/api/db/import', express.json({ limit: '10mb' }), async (req, res) => {
    try {
        const data = req.body;
        if (!data || !Array.isArray(data.documents) || !Array.isArray(data.contents)) {
            return res.status(400).json({ error: 'Ungültiges Datenbankformat' });
        }
        const dbPath = path.resolve(process.env.DB_PATH || './db.json');
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        await repository.initializeDatabase();
        res.json({ success: true });
    } catch (error) {
        console.error('Error importing database:', error);
        res.status(500).json({ error: 'Import fehlgeschlagen' });
    }
});

// ==================== HTMX PARTIAL ROUTES ====================

/** GET /partials/create-text - Serve create text form partial */
app.get('/partials/create-text', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'create-text.html'));
});

/** GET /partials/action-buttons - Serve action buttons partial */
app.get('/partials/action-buttons', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'action-buttons.html'));
});

/**
 * GET /partials/text-list - Server-rendered document list + pagination
 * @query {number} page - Page number (default 1)
 * @query {number} limit - Items per page (default 5)
 */
app.get('/partials/text-list', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 5));
        const result = await repository.getDocuments({ page, limit });

        const { documents, totalItems, totalPages } = result;

        const formatDate = (iso) => {
            const date = new Date(iso);
            return isNaN(date) ? (iso || '') : date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };

        // Build document list HTML
        let listHtml = '';
        if (!documents.length) {
            listHtml = `
                <div class="text-center py-5 text-secondary">
                    <i class="bi bi-file-earmark-text fs-1 d-block mb-2 opacity-25"></i>
                    Noch keine Übungen. Jetzt die erste erstellen!
                </div>`;
        } else {
            listHtml = '<ul class="list-unstyled mb-0">';
            for (const doc of documents) {
                const title = he.encode(doc.title);
                const date = he.encode(formatDate(doc.creationDate));
                const id = he.encode(doc.id);
                listHtml += `
                    <li class="file-item d-flex align-items-center justify-content-between p-2 p-md-3 rounded-2 mb-1">
                        <a href="/doc/${id}"
                           class="d-flex align-items-center gap-2 text-decoration-none text-dark flex-grow-1">
                            <span class="doc-icon d-flex align-items-center justify-content-center rounded-2">
                                <i class="bi bi-file-text"></i>
                            </span>
                            <div>
                                <div class="fw-medium">${title}</div>
                                <small class="text-secondary">${date}</small>
                            </div>
                        </a>
                        <button class="btn btn-sm btn-delete text-secondary"
                                hx-delete="/api/documents/${id}"
                                hx-confirm="&quot;${title}&quot; wirklich löschen?"
                                hx-swap="none">
                            <i class="bi bi-trash3"></i>
                        </button>
                    </li>`;
            }
            listHtml += '</ul>';
        }

        // Build pagination HTML
        let paginationHtml = '';
        if (totalItems > 0) {
            const start = (page - 1) * limit + 1;
            const end = Math.min(page * limit, totalItems);
            const pageInfo = `${start}–${end} von ${totalItems}`;

            // Calculate visible pages
            let pages;
            if (totalPages <= 5) {
                pages = Array.from({ length: totalPages }, (_, i) => i + 1);
            } else if (page <= 2) {
                pages = [1, 2, 3, '…', totalPages];
            } else if (page >= totalPages - 1) {
                pages = [1, '…', totalPages - 2, totalPages - 1, totalPages];
            } else {
                pages = [1, '…', page, '…', totalPages];
            }

            let navItems = '';
            if (totalPages > 1) {
                // Previous button
                navItems += `<li class="page-item ${page <= 1 ? 'disabled' : ''}">
                    <a class="page-link" href="#"
                       hx-get="/partials/text-list?page=${page - 1}&limit=${limit}"
                       hx-target="#text-list" hx-swap="innerHTML">
                        <i class="bi bi-chevron-left"></i>
                    </a>
                </li>`;

                // Page numbers
                for (const p of pages) {
                    if (p === '…') {
                        navItems += `<li class="page-item disabled"><a class="page-link" href="#">…</a></li>`;
                    } else {
                        navItems += `<li class="page-item ${p === page ? 'active' : ''}">
                            <a class="page-link" href="#"
                               hx-get="/partials/text-list?page=${p}&limit=${limit}"
                               hx-target="#text-list" hx-swap="innerHTML">${p}</a>
                        </li>`;
                    }
                }

                // Next button
                navItems += `<li class="page-item ${page >= totalPages ? 'disabled' : ''}">
                    <a class="page-link" href="#"
                       hx-get="/partials/text-list?page=${page + 1}&limit=${limit}"
                       hx-target="#text-list" hx-swap="innerHTML">
                        <i class="bi bi-chevron-right"></i>
                    </a>
                </li>`;
            }

            // Page size selector
            const sizeOptions = [5, 10, 25].map(s =>
                `<option value="${s}" ${s === limit ? 'selected' : ''}>${s}</option>`
            ).join('');

            paginationHtml = `
                <div class="mt-3 d-flex flex-column flex-sm-row align-items-center justify-content-between gap-2">
                    <small class="text-secondary">${he.encode(pageInfo)}</small>
                    ${totalPages > 1 ? `<nav><ul class="pagination pagination-sm mb-0">${navItems}</ul></nav>` : ''}
                    <div class="d-flex align-items-center gap-1">
                        <small class="text-secondary text-nowrap">Pro Seite:</small>
                        <select class="form-select form-select-sm" style="width:auto"
                                hx-get="/partials/text-list" hx-target="#text-list" hx-swap="innerHTML"
                                hx-include="this" name="limit"
                                hx-vals='{"page": "1"}'
                                hx-trigger="change">
                            ${sizeOptions}
                        </select>
                    </div>
                </div>`;
        }

        const html = `
            <div class="card border-0 shadow-sm rounded-3">
                <div class="card-body p-3 p-md-4">
                    <label class="form-label small text-uppercase text-secondary fw-semibold">Meine Übungen</label>
                    ${listHtml}
                    ${paginationHtml}
                </div>
            </div>`;

        res.send(html);
    } catch (error) {
        console.error('Error rendering text-list partial:', error);
        res.status(500).send('<div class="alert alert-danger">Fehler beim Laden der Liste</div>');
    }
});

/** GET /doc/:id - Serve document editor page */
app.get('/doc/:id', async (req, res) => {
    try {
        const document = await repository.getDocument(req.params.id);
        if (!document) {
            return res.redirect('/');
        }

        const content = await repository.getContent(req.params.id);

        res.render('template', {
            documentId: document.id,
            filename: document.title,
            creationDate: new Date(document.creationDate).toLocaleString('de-DE'),
            contentJson: JSON.stringify(content || {})
        });
    } catch (error) {
        console.error('Error serving document:', error);
        res.redirect('/');
    }
});

/** Redirect unknown HTML routes to home (exclude static files) */
app.get('*', (req, res, next) => {
    // Let static files through (they have extensions)
    if (path.extname(req.path)) {
        return next(); // Will result in 404 from Express
    }
    res.redirect('/');
});

app.listen(PORT, async () => {
    await repository.initializeDatabase();
    console.log(`🚀 Klar server running on port ${PORT}`);
});