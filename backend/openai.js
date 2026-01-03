const OpenAI = require('openai');

// Load environment variables
require('dotenv').config();

// Check for required environment variables
if (!process.env.OPENAI_TOKEN) {
    throw new Error('OPENAI_TOKEN environment variable is required. Please set it in your .env file.');
}
if (!process.env.MODEL) {
    throw new Error('MODEL environment variable is required. Please set it in your .env file.');
}
if (!process.env.PROMPT) {
    throw new Error('PROMPT environment variable is required. Please set it in your .env file.');
}

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_TOKEN,
});

/**
 * Count words in text using OpenAI
 * @param {string} text - The text to count words in
 * @returns {Promise<number>} The word count
 */
async function countWords(text) {
    try {
        const completion = await openai.chat.completions.create({
            model: process.env.MODEL,
            messages: [
                {
                    role: 'system',
                    content: process.env.PROMPT
                },
                {
                    role: 'user',
                    content: text
                }
            ],
            temperature: 0.1,
            max_tokens: 50
        });

        const response = completion.choices[0].message.content.trim();

        // Try to parse the response as JSON
        try {
            const parsed = JSON.parse(response);
            return parsed.wordCount || 0;
        } catch (parseError) {
            // If not JSON, try to extract number from text
            const match = response.match(/\d+/);
            return match ? parseInt(match[0]) : 0;
        }
    } catch (error) {
        console.error('OpenAI API error:', error);
        throw new Error('Failed to count words using AI');
    }
}

module.exports = {
    countWords
};