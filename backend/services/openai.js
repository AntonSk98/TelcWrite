const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { OPENAI_TOKEN, MODEL } = require('../config');

const REVIEW_PROMPT = fs.readFileSync(
    path.join(__dirname, 'prompt-review.txt'),
    'utf8'
);

const GENERATE_PROMPT = fs.readFileSync(
    path.join(__dirname, 'prompt-generate.txt'),
    'utf8'
);

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: OPENAI_TOKEN,
});

/**
 * Review content using OpenAI and get feedback
 * @param {Object} reviewContentCommand - The review command
 * @param {string} reviewContentCommand.taskContent - The task/prompt description
 * @param {string} reviewContentCommand.contentText - The user's submission text to review
 * @returns {Promise<{score: number, feedback: string, correction: string}>} Review result with score, feedback and corrected text
 * @throws {Error} If OpenAI API call fails
 */
async function reviewContent(reviewContentCommand) {
    try {
        const completion = await openai.chat.completions.create({
            model: MODEL,
            messages: [
                {
                    role: 'system',
                    content: REVIEW_PROMPT
                },
                {
                    role: 'user',
                    content: JSON.stringify(reviewContentCommand)
                }
            ]
        });

        const feedback = completion.choices[0].message.content;
        const result = JSON.parse(feedback);

        if (typeof result.score !== 'number' || typeof result.feedback !== 'string' || typeof result.correction !== 'string') {
            throw new Error('Invalid response shape from OpenAI: missing score, feedback, or correction');
        }

        return result;
    } catch (error) {
        console.error('OpenAI API error:', error);
        throw new Error('Failed to get review from OpenAI');
    }
}

module.exports = {
    reviewContent,
    generateExercise,
};

/**
 * Generate a TELC B1 writing exercise using AI
 * @param {string} [instructions=''] - Optional topic/instructions to guide generation
 * @returns {Promise<{title: string, task: string}>} Generated exercise with title and task
 * @throws {Error} If OpenAI API call fails
 */
async function generateExercise(instructions = '') {
    try {
        const userMessage = instructions
            ? `Generate a new exercise about: ${instructions}`
            : 'Generate a new exercise.';

        const completion = await openai.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: GENERATE_PROMPT },
                { role: 'user', content: userMessage },
            ],
        });

        const result = JSON.parse(completion.choices[0].message.content);

        if (typeof result.title !== 'string' || typeof result.task !== 'string') {
            throw new Error('Invalid response shape from OpenAI: missing title or task');
        }

        return result;
    } catch (error) {
        console.error('OpenAI API error (generateExercise):', error);
        throw new Error('Failed to generate exercise from OpenAI');
    }
}