const express = require('express');
const fs = require('fs');
const { DB_PATH } = require('../config');
const repository = require('../repository');
const openai = require('../services/openai');
const pdfExport = require('../services/pdf-export');

const router = express.Router();

// ==================== CONTENT ====================

/**
 * GET /api/data/:documentId
 * Retrieve content for a document
 */
router.get('/data/:documentId', async (req, res) => {
    const { documentId } = req.params;
    try {
        if (!documentId) {
            return res.status(400).json({ error: 'documentId parameter is required' });
        }
        const content = await repository.getContent(documentId);
        res.json({ content });
    } catch (error) {
        console.error('Database read error:', error);
        res.status(500).json({ error: 'Failed to fetch content by document id: ' + documentId });
    }
});

/**
 * POST /api/data/:documentId
 * Create or update content for a document
 */
router.post('/data/:documentId', async (req, res) => {
    try {
        const { documentId } = req.params;
        if (!documentId) {
            return res.status(400).json({ error: 'documentId parameter is required' });
        }
        await repository.upsertContent({ documentId, ...req.body });
        res.json({ success: true });
    } catch (error) {
        console.error('Database write error:', error);
        res.status(500).json({ error: 'Failed to save content' });
    }
});

// ==================== DOCUMENTS ====================

/**
 * GET /api/documents
 * List documents with pagination
 */
router.get('/documents', async (req, res) => {
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
 */
router.post('/documents', async (req, res) => {
    const { title } = req.body;
    if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title is required to create a document' });
    }

    try {
        const document = await repository.createDocument(title.trim());
        res.set('HX-Trigger', 'refreshList, documentCreated');
        res.json({ success: true, document });
    } catch (error) {
        if (error.code === repository.DUPLICATE_DOCUMENT) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Error creating document:', error);
        res.status(500).json({ error: 'Failed to create document' });
    }
});

/**
 * DELETE /api/documents/:id
 * Delete a document and its associated content
 */
router.delete('/documents/:id', async (req, res) => {
    try {
        await repository.deleteDocument(req.params.id);
        res.set('HX-Trigger', 'refreshList, documentDeleted');
        res.json({ success: true });
    } catch (error) {
        if (error.code === repository.DOCUMENT_NOT_FOUND) {
            return res.status(404).json({ error: error.message });
        }
        console.error('Error deleting document:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

// ==================== REVIEW ====================

/**
 * POST /api/content/review/:documentId
 * Submit document content for AI review
 */
router.post('/content/review/:documentId', async (req, res) => {
    const { documentId } = req.params;
    if (!documentId) {
        return res.status(400).json({ error: 'documentId is required' });
    }

    try {
        const content = await repository.getContent(documentId);
        if (!content || !content.submissionText) {
            return res.status(400).json({ error: 'No submission text found for review' });
        }

        const review = await openai.reviewContent({
            taskContent: content.task,
            contentText: content.submissionText,
        });

        await repository.upsertContent({
            ...content,
            documentId,
            reviewScore: review.score,
            reviewFeedback: review.feedback,
            correction: review.correction,
        });

        res.json({ success: true, message: 'AI review completed successfully' });
    } catch (error) {
        console.error('Error while reviewing content:', error);
        res.status(500).json({ error: 'Failed to review content' });
    }
});

// ==================== EXPORT ====================

/**
 * GET /api/export/pdf
 * Generate and download a PDF of all documents
 */
router.get('/export/pdf', async (req, res) => {
    try {
        const data = await repository.getAllDocumentsWithContent();
        if (!data || !data.length) {
            return res.status(404).json({ error: 'Keine Daten zum Exportieren' });
        }
        const pdfBuffer = await pdfExport.generatePdf(data);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="Klar.pdf"',
            'Content-Length': pdfBuffer.length,
        });
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'PDF-Erstellung fehlgeschlagen' });
    }
});

/** GET /api/db/export - Download raw database as JSON */
router.get('/db/export', (req, res) => {
    res.download(DB_PATH, 'klar_backup.json');
});

/** POST /api/db/import - Import database from JSON */
router.post('/db/import', express.json({ limit: '10mb' }), async (req, res) => {
    try {
        const data = req.body;
        if (!data || !Array.isArray(data.documents) || !Array.isArray(data.contents)) {
            return res.status(400).json({ error: 'Ungültiges Datenbankformat' });
        }
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        await repository.initializeDatabase();
        res.json({ success: true });
    } catch (error) {
        console.error('Error importing database:', error);
        res.status(500).json({ error: 'Import fehlgeschlagen' });
    }
});

module.exports = router;
