const express = require('express');
const path = require('path');
const { VIEWS_DIR } = require('../config');
const repository = require('../repository');

const router = express.Router();

// ==================== HTMX PARTIALS ====================

/** GET /partials/create-exercise */
router.get('/partials/create-exercise', (req, res) => {
    res.sendFile(path.join(VIEWS_DIR, 'create-exercise.html'));
});

/** GET /partials/action-buttons */
router.get('/partials/action-buttons', (req, res) => {
    res.sendFile(path.join(VIEWS_DIR, 'action-buttons.html'));
});

/**
 * GET /partials/text-list - Server-rendered document list + pagination
 * @query {number} page - Page number (default 1)
 * @query {number} limit - Items per page (default 5)
 */
router.get('/partials/text-list', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 5));
        const { documents, totalItems, totalPages } = await repository.getDocuments({ page, limit });

        res.render('text-list', { documents, page, limit, totalItems, totalPages, formatDate });
    } catch (error) {
        console.error('Error rendering text-list partial:', error);
        res.status(500).send('<div class="alert alert-danger">Fehler beim Laden der Liste</div>');
    }
});

// ==================== PAGES ====================

/** GET /doc/:id - Serve document editor page */
router.get('/doc/:id', async (req, res) => {
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
            contentJson: JSON.stringify(content || {}),
        });
    } catch (error) {
        console.error('Error serving document:', error);
        res.redirect('/');
    }
});

/** Redirect unknown HTML routes to home (exclude static files) */
router.get('*', (req, res, next) => {
    if (path.extname(req.path)) {
        return next();
    }
    res.redirect('/');
});

// ==================== HELPERS ====================

function formatDate(iso) {
    const date = new Date(iso);
    return isNaN(date) ? (iso || '') : date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

module.exports = router;
