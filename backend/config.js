const path = require('path');

// Load environment variables (once for the entire app)
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Resolved paths
const DB_PATH = path.resolve(process.env.DB_PATH || path.join(__dirname, 'db.json'));
const VIEWS_DIR = path.join(__dirname, '..', 'views');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Validate required environment variables
if (!process.env.OPENAI_TOKEN) {
    throw new Error('OPENAI_TOKEN environment variable is required. Please set it in your .env file.');
}
if (!process.env.MODEL) {
    throw new Error('MODEL environment variable is required. Please set it in your .env file.');
}

module.exports = {
    OPENAI_TOKEN: process.env.OPENAI_TOKEN,
    MODEL: process.env.MODEL,
    DB_PATH,
    VIEWS_DIR,
    PUBLIC_DIR,
    PORT: 3000,
};
