const express = require('express');
const fs = require('fs');
const path = require('path');
const he = require('he');

// Load environment variables
require('dotenv').config();

const repository = require('./repository');
const openai = require('./openai');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..')));

// Load template once at startup
const TEMPLATE_PATH = path.join(__dirname, '..', 'template', 'template.html');
const TEMPLATE = fs.readFileSync(TEMPLATE_PATH, 'utf8');

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
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
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

// ==================== PAGE ROUTES ====================

/** GET / - Serve the main index page */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

/** GET /doc/:id - Serve document editor page */
app.get('/doc/:id', async (req, res) => {
    try {
        const document = await repository.getDocument(req.params.id);
        if (!document) {
            return res.redirect('/');
        }

        // Replace placeholders in template (escaped to prevent XSS)
        const html = TEMPLATE
            .replace(/{{documentId}}/g, he.encode(document.id))
            .replace(/{{filename}}/g, he.encode(document.title))
            .replace(/{{creationDate}}/g, he.encode(document.creationDate));

        res.send(html);
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
    console.log(`🚀 TelcWrite server running on port ${PORT}`);
});