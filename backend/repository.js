const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const { DB_PATH } = require('./config');

const adapter = new JSONFile(DB_PATH);
const db = new Low(adapter, { documents: [], contents: [] });

// Error codes (Node.js convention)
const DUPLICATE_DOCUMENT = 'DUPLICATE_DOCUMENT';
const DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND';

function createError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

/** Sort documents by creation date (newest first) */
function sortByNewest(docs) {
    return docs.slice().sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));
}

/**
 * Initialize the database on startup
 */
async function initializeDatabase() {
    await db.read();
    console.log('💾 Database initialized successfully');
}

// ==================== DOCUMENT OPERATIONS ====================

/**
 * Get documents with pagination
 * @param {Object} options - Pagination options
 * @param {number} [options.page=1] - Page number (1-based)
 * @param {number} [options.limit=5] - Items per page
 * @returns {Promise<{documents: Array, page: number, limit: number, totalItems: number, totalPages: number}>}
 */
async function getDocuments({ page = 1, limit = 5 } = {}) {
    await db.read();
    const allDocuments = sortByNewest(db.data.documents || []);
    const totalItems = allDocuments.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const safePage = Math.max(1, Math.min(page, totalPages));
    const start = (safePage - 1) * limit;

    return {
        documents: allDocuments.slice(start, start + limit),
        page: safePage,
        limit,
        totalItems,
        totalPages,
    };
}

/**
 * Get a document by ID
 * @param {string} id - Document ID
 * @returns {Promise<{id: string, title: string, creationDate: string}|null>}
 */
async function getDocument(id) {
    await db.read();
    return db.data.documents.find(doc => doc.id === id) || null;
}

/**
 * Create a new document
 * @param {string} title - Document title
 * @returns {Promise<{id: string, title: string, creationDate: string}>} Created document
 * @throws {Error} code=DUPLICATE_DOCUMENT if title already exists
 */
async function createDocument(title) {
    await db.read();

    if (db.data.documents.some(doc => doc.title === title)) {
        throw createError(DUPLICATE_DOCUMENT, 'Document with this title already exists');
    }

    const document = {
        id: generateId(),
        title,
        creationDate: new Date().toISOString(),
    };

    db.data.documents.push(document);
    await db.write();
    return document;
}

/**
 * Delete a document and its associated content
 * @param {string} id - Document ID
 * @throws {Error} code=DOCUMENT_NOT_FOUND if not found
 */
async function deleteDocument(id) {
    await db.read();

    const docIndex = db.data.documents.findIndex(doc => doc.id === id);
    if (docIndex === -1) {
        throw createError(DOCUMENT_NOT_FOUND, 'Document not found');
    }

    db.data.documents.splice(docIndex, 1);

    const contentIndex = db.data.contents.findIndex(c => c.documentId === id);
    if (contentIndex !== -1) {
        db.data.contents.splice(contentIndex, 1);
    }

    await db.write();
}

/** Generate a unique ID */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
}

// ==================== CONTENT OPERATIONS ====================

/**
 * Get content for a document
 * @param {string} documentId
 * @returns {Promise<Object>} Content object or empty object if not found
 */
async function getContent(documentId) {
    await db.read();
    return db.data.contents.find(c => c.documentId === documentId) || {};
}

/**
 * Upsert content (insert or replace)
 * @param {Object} upsertContentCommand
 * @param {string} upsertContentCommand.documentId - Required
 * @throws {Error} If documentId is missing
 */
async function upsertContent(upsertContentCommand) {
    await db.read();

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

    const index = db.data.contents.findIndex(
        c => c.documentId === upsertContentCommand.documentId
    );

    if (index !== -1) {
        db.data.contents.splice(index, 1, content);
    } else {
        db.data.contents.push(content);
    }

    await db.write();
}

/**
 * Get all documents with their associated content (for export/PDF)
 * @returns {Promise<Array<Object>>}
 */
async function getAllDocumentsWithContent() {
    await db.read();
    return sortByNewest(db.data.documents || []).map(doc => {
        const content = (db.data.contents || []).find(c => c.documentId === doc.id) || {};
        return {
            id: doc.id,
            title: doc.title,
            creationDate: doc.creationDate,
            task: content.task || '',
            submissionText: content.submissionText || '',
            reviewScore: content.reviewScore ?? null,
            reviewFeedback: content.reviewFeedback || '',
            correction: content.correction || '',
        };
    });
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