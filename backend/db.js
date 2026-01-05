const fs = require('fs');
const path = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

// Load environment variables
require('dotenv').config();

// LowDB setup - use DB_PATH from env or default to db.json
const DB_PATH = path.resolve(process.env.DB_PATH || './db.json');
const adapter = new JSONFile(DB_PATH);
const db = new Low(adapter, { documents: [], content: {} });

/**
 * Initialize the database on startup
 */
async function initializeDatabase() {
    try {
        await db.read();
        console.log('💾 Database initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    }
}

// ==================== DOCUMENT OPERATIONS ====================
/**
 * Get all documents
 * @returns {Array} List of documents
 */
async function getDocuments() {
    await db.read();
    return db.data.documents || [];
}

/**
 * Get a document by ID
 * @param {string} id - Document ID
 * @returns {Object|null} Document or null
 */
async function getDocument(id) {
    await db.read();
    return db.data.documents.find(doc => doc.id === id) || null;
}

/**
 * Create a new document
 * @param {string} title - Document title
 * @returns {Object} Created document
 */
async function createDocument(title) {
    await db.read();
    
    // Check if document with same title exists
    const exists = db.data.documents.some(doc => doc.title === title);
    if (exists) {
        throw new Error('Document with this title already exists');
    }
    
    const document = {
        id: generateId(),
        title: title,
        creationDate: new Date().toISOString().split('T')[0]
    };
    
    db.data.documents.push(document);
    await db.write();
    return document;
}

/**
 * Delete a document by ID
 * @param {string} id - Document ID
 */
async function deleteDocument(id) {
    await db.read();
    const index = db.data.documents.findIndex(doc => doc.id === id);
    if (index === -1) {
        throw new Error('Document not found');
    }
    
    const doc = db.data.documents[index];
    db.data.documents.splice(index, 1);
    
    // Clean up associated content
    await deleteDocumentContent(doc.title);
    
    await db.write();
}

/**
 * Delete all content associated with a document
 * @param {string} title - Document title
 */
async function deleteDocumentContent(title) {
    const keysToDelete = [
        `${title}-task`,
        `${title}-content`,
        `${title}-content-review-score`,
        `${title}-content-review-feedback`,
        `${title}-content-review-correction`
    ];
    
    for (const key of keysToDelete) {
        if (db.data.content[key]) {
            delete db.data.content[key];
        }
    }
}

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
}

// ==================== CONTENT OPERATIONS ====================
/**
 * Get data from database by key
 * @param {string} key - The key to retrieve
 * @returns {string} The value or empty string if not found
 */
async function getData(key) {
    try {
        await db.read();
        return db.data.content[key] ?? '';
    } catch (error) {
        console.error('Database read error:', error);
        throw error;
    }
}

/**
 * Set data in database
 * @param {string} key - The key to set
 * @param {string} value - The value to store
 */
async function setData(key, value) {
    try {
        await db.read();
        db.data.content[key] = value;
        await db.write();
    } catch (error) {
        console.error('Database write error:', error);
        throw error;
    }
}

module.exports = {
    initializeDatabase,
    getDocuments,
    getDocument,
    createDocument,
    deleteDocument,
    getData,
    setData,
};