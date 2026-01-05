const express = require('express');
const fs = require('fs');
const path = require('path');
const he = require('he');

// Load environment variables
require('dotenv').config();

const db = require('./db');
const openai = require('./openai');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const BASE_PATH = process.env.BASE_PATH || path.join(__dirname, '..');
app.use(express.static(BASE_PATH));

// Load template once at startup
const TEMPLATE_PATH = path.join(BASE_PATH, 'template', 'template.html');
const TEMPLATE = fs.readFileSync(TEMPLATE_PATH, 'utf8');

// API Endpoint to retrieve data by key
app.get('/api/data/:key', async (req, res) => {
    try {
        const value = await db.getData(req.params.key);
        res.json({ value });
    } catch (error) {
        console.error('Database read error:', error);
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// API Endpoint to store data by key
app.post('/api/data/:key', async (req, res) => {
    try {
        await db.setData(req.params.key, req.body.value);
        res.json({ success: true });
    } catch (error) {
        console.error('Database write error:', error);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// ==================== DOCUMENT API ====================

// List all documents
app.get('/api/documents', async (req, res) => {
    try {
        const documents = await db.getDocuments();
        res.json(documents);
    } catch (error) {
        console.error('Error listing documents:', error);
        res.status(500).json({ error: 'Failed to list documents' });
    }
});

// Create a new document
app.post('/api/documents', async (req, res) => {
    const { title } = req.body;
    if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title is required' });
    }

    try {
        const document = await db.createDocument(title.trim());
        res.json({ success: true, document });
    } catch (error) {
        if (error.message.includes('already exists')) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Error creating document:', error);
        res.status(500).json({ error: 'Failed to create document' });
    }
});

// Delete a document
app.delete('/api/documents/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        await db.deleteDocument(id);
        res.json({ success: true });
    } catch (error) {
        if (error.message === 'Document not found') {
            return res.status(404).json({ error: 'Document not found' });
        }
        console.error('Error deleting document:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

// ==================== CONTENT REVIEW API ====================

app.post('/api/content/review', async (req, res) => {
    const reviewContentCommand = req.body;
    if (!reviewContentCommand) {
        return res.status(400).json({ error: 'Review content command is required' });
    }

    try {
        const taskContent = await db.getData(reviewContentCommand.taskId);
        const contentText = await db.getData(reviewContentCommand.contentId);
        const review = await openai.reviewContent({ taskContent, contentText });

        await db.setData(`${reviewContentCommand.contentId}-review-score`, review.score);
        await db.setData(`${reviewContentCommand.contentId}-review-feedback`, review.feedback);
        await db.setData(`${reviewContentCommand.contentId}-review-correction`, review.correction);

        res.json({
            success: true,
            message: 'AI review completed successfully'
        });
    } catch (error) {
        console.error('Error while reviewing content:', error);
        res.status(500).json({ error: 'Failed to review content' } );
    }
});

// ==================== PAGE ROUTES ====================

// Main page (file manager)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Document page - serve template dynamically
app.get('/doc/:id', async (req, res) => {
    try {
        const document = await db.getDocument(req.params.id);
        if (!document) {
            return res.redirect('/');
        }

        // Replace placeholders in template (escaped to prevent XSS)
        const html = TEMPLATE
            .replace(/{{filename}}/g, he.encode(document.title))
            .replace(/{{creationDate}}/g, he.encode(document.creationDate));

        res.send(html);
    } catch (error) {
        console.error('Error serving document:', error);
        res.redirect('/');
    }
});

// Catch-all route: redirect any invalid URLs to the root
app.get('*', (req, res) => {
    res.redirect('/');
});

app.listen(PORT, async () => {
    await db.initializeDatabase();
    console.log(`🚀 TelcWrite server running at http://localhost:${PORT}`);
    console.log(`📝 Open http://localhost:${PORT} to manage your documents\n`);
});