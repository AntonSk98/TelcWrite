const express = require('express');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const db = require('./db');
const openai = require('./openai');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..'))); // Serve from project root

// Data storage file (keeping for backward compatibility, but not used)
const SOURCES_DIR = path.join(__dirname, '..', 'sources');

// Ensure sources directory exists
if (!fs.existsSync(SOURCES_DIR)) {
    fs.mkdirSync(SOURCES_DIR, { recursive: true });
}

// API endpoints for data
app.get('/api/data/:key', async (req, res) => {
    try {
        const value = await db.getData(req.params.key);
        res.json({ value });
    } catch (error) {
        console.error('Database read error:', error);
        res.status(500).json({ error: 'Failed to read data' });
    }
});

app.post('/api/data/:key', async (req, res) => {
    try {
        await db.setData(req.params.key, req.body.value);
        res.json({ success: true });
    } catch (error) {
        console.error('Database write error:', error);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// API endpoint to create new file
app.post('/api/create-file', (req, res) => {
    const { filename } = req.body;
    if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
    }

    let finalFilename = filename;
    if (!finalFilename.endsWith('.html')) {
        finalFilename += '.html';
    }

    const filePath = path.join(SOURCES_DIR, finalFilename);

    if (fs.existsSync(filePath)) {
        return res.status(400).json({ error: 'File already exists' });
    }

    try {
        // Read template
        const templatePath = path.join(__dirname, '..', 'generator', 'template.html');
        let templateContent = fs.readFileSync(templatePath, 'utf8');

        // Replace placeholders
        const pageName = finalFilename.replace('.html', '');
        const creationDate = new Date().toISOString().split('T')[0];
        templateContent = templateContent.replace(/{{filename}}/g, pageName);
        templateContent = templateContent.replace(/{{creationDate}}/g, creationDate);

        // Write the file
        fs.writeFileSync(filePath, templateContent);

        res.json({ success: true, filename: finalFilename });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create file' });
    }
});

// API endpoint to delete a file
app.delete('/api/delete-file', async (req, res) => {
    const { filename } = req.body;
    if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
    }

    let finalFilename = filename;
    if (!finalFilename.endsWith('.html')) {
        finalFilename += '.html';
    }

    const filePath = path.join(SOURCES_DIR, finalFilename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    try {
        // Delete the file
        fs.unlinkSync(filePath);

        // Clean up database entries
        const pageName = finalFilename.replace('.html', '');
        await db.deletePageData(pageName);

        res.json({ success: true, filename: finalFilename, message: 'File and associated data deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// API endpoint to list files
app.get('/api/files', (req, res) => {
    try {
        const files = fs.readdirSync(SOURCES_DIR)
            .filter(file => file.endsWith('.html'))
            .map(file => ({
                name: file,
                path: `/sources/${file}`,
                title: file.replace('.html', '')
            }));
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: 'Failed to list files' });
    }
});

// API endpoint to process submission
app.post('/api/process-submission', async (req, res) => {
    const { key } = req.body;
    if (!key) {
        return res.status(400).json({ error: 'Key is required' });
    }

    try {
        // Read content from database
        const taskContent = await db.getTaskContent(key);
        const contentText = await db.getContent(key);

        // Combine task and content
        const fullText = `${taskContent} ${contentText}`.trim();

        if (!fullText) {
            return res.json({
                success: true,
                message: 'No content to process',
                wordCount: 0
            });
        }

        // Use OpenAI to count words
        const wordCount = await openai.countWords(fullText);

        // Return success response
        res.json({
            success: true,
            message: 'Content processed successfully',
            wordCount: wordCount
        });
    } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({ error: 'Failed to process submission' });
    }
});

// Main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Catch-all route: redirect any invalid URLs to the root
app.get('*', (req, res) => {
    res.redirect('/');
});

app.listen(PORT, async () => {
    // Initialize database before accepting requests
    await db.initializeDatabase();

    console.log(`🚀 TelcWrite server running at http://localhost:${PORT}`);
    console.log(`\n📝 Open http://localhost:${PORT} to manage your files\n`);
});