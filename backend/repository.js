const Database = require('better-sqlite3');
const path = require('path');

// Database path
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'klar.sqlite');
const db = new Database(DB_PATH);

// Error codes (Node.js convention)
const DUPLICATE_DOCUMENT = 'DUPLICATE_DOCUMENT';
const DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND';

function createError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

/**
 * Initialize the database - create tables if they don't exist
 */
function initializeDatabase() {
    db.pragma('foreign_keys = ON');

    db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            title TEXT UNIQUE NOT NULL,
            creationDate TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS contents (
            documentId TEXT PRIMARY KEY,
            task TEXT DEFAULT '',
            submissionText TEXT DEFAULT '',
            reviewScore INTEGER,
            reviewFeedback TEXT DEFAULT '',
            correction TEXT DEFAULT '',
            FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE
        );
    `);

    console.log('💾 Database initialized');
}

// ==================== DOCUMENT OPERATIONS ====================

/**
 * Get documents with pagination
 */
function getDocuments({ page = 1, limit = 5 } = {}) {
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM documents');
    const totalItems = countStmt.get().count;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const safePage = Math.max(1, Math.min(page, totalPages));
    const offset = (safePage - 1) * limit;

    const stmt = db.prepare(`
        SELECT id, title, creationDate 
        FROM documents 
        ORDER BY creationDate DESC 
        LIMIT ? OFFSET ?
    `);
    const documents = stmt.all(limit, offset);

    return { documents, page: safePage, limit, totalItems, totalPages };
}

/**
 * Get a document by ID
 */
function getDocument(id) {
    const stmt = db.prepare('SELECT id, title, creationDate FROM documents WHERE id = ?');
    return stmt.get(id) || null;
}

/**
 * Create a new document
 */
function createDocument(title) {
    const checkStmt = db.prepare('SELECT id FROM documents WHERE title = ?');
    if (checkStmt.get(title)) {
        throw createError(DUPLICATE_DOCUMENT, 'Document with this title already exists');
    }

    const document = {
        id: generateId(),
        title,
        creationDate: new Date().toISOString(),
    };

    const insertStmt = db.prepare(`
        INSERT INTO documents (id, title, creationDate) 
        VALUES (@id, @title, @creationDate)
    `);
    insertStmt.run(document);

    return document;
}

/**
 * Delete a document and its associated content
 */
function deleteDocument(id) {
    const checkStmt = db.prepare('SELECT id FROM documents WHERE id = ?');
    if (!checkStmt.get(id)) {
        throw createError(DOCUMENT_NOT_FOUND, 'Document not found');
    }

    const deleteContent = db.prepare('DELETE FROM contents WHERE documentId = ?');
    const deleteDoc = db.prepare('DELETE FROM documents WHERE id = ?');

    db.transaction(() => {
        deleteContent.run(id);
        deleteDoc.run(id);
    })();
}

/** Generate a unique ID */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
}

// ==================== CONTENT OPERATIONS ====================

/**
 * Get content for a document
 */
function getContent(documentId) {
    const stmt = db.prepare(`
        SELECT documentId, task, submissionText, reviewScore, reviewFeedback, correction 
        FROM contents 
        WHERE documentId = ?
    `);
    return stmt.get(documentId) || {};
}

/**
 * Upsert content (insert or replace)
 */
function upsertContent(upsertContentCommand) {
    if (!upsertContentCommand.documentId) {
        throw new Error('Missing documentId in content');
    }

    const content = {
        documentId: upsertContentCommand.documentId,
        task: upsertContentCommand.task ?? '',
        submissionText: upsertContentCommand.submissionText ?? '',
        reviewScore: upsertContentCommand.reviewScore ?? null,
        reviewFeedback: upsertContentCommand.reviewFeedback ?? '',
        correction: upsertContentCommand.correction ?? '',
    };

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO contents 
        (documentId, task, submissionText, reviewScore, reviewFeedback, correction)
        VALUES (@documentId, @task, @submissionText, @reviewScore, @reviewFeedback, @correction)
    `);
    stmt.run(content);
}

/**
 * Get all documents with their associated content (for export/PDF)
 */
function getAllDocumentsWithContent() {
    const stmt = db.prepare(`
        SELECT 
            d.id, d.title, d.creationDate,
            COALESCE(c.task, '') as task,
            COALESCE(c.submissionText, '') as submissionText,
            c.reviewScore,
            COALESCE(c.reviewFeedback, '') as reviewFeedback,
            COALESCE(c.correction, '') as correction
        FROM documents d
        LEFT JOIN contents c ON d.id = c.documentId
        ORDER BY d.creationDate DESC
    `);
    return stmt.all();
}

module.exports = {
    initializeDatabase,
    getDocuments,
    getDocument,
    createDocument,
    deleteDocument,
    getContent,
    upsertContent,
    getAllDocumentsWithContent,
    DUPLICATE_DOCUMENT,
    DOCUMENT_NOT_FOUND,
};