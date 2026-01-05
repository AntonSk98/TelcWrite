// Basic JavaScript for the simple HTML framework

// Simple database using server-side JSON file for cross-browser persistence
class ApiClient {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
    }

    async save(key, value) {
        try {
            const response = await fetch(`${this.baseUrl}/api/data/${encodeURIComponent(key)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ value }),
            });
            return response.ok;
        } catch (error) {
            console.error('Server save failed:', error);
            return false;
        }
    }

    async require(key) {
        try {
            const response = await fetch(`${this.baseUrl}/api/data/${encodeURIComponent(key)}`);
            if (response.ok) {
                const data = await response.json();
                return data.value ?? null;
            }
        } catch (error) {
            console.error('Server load failed:', error);
        }
    }
}

// Wait for the DOM to be fully loaded before executing code
document.addEventListener('DOMContentLoaded', async () => {
    const db = new ApiClient();

    const taskTextarea = document.getElementById('task-input');
    const contentTextarea = document.getElementById('content-input');
    const submitBtn = document.getElementById('submit-btn');
    const feedbackSection = await initFeedbackSection();

    await loadSavedContent(taskTextarea, 'task');
    await loadSavedContent(contentTextarea, 'content');

    trackWrittenWordsCount();

    submitBtn.addEventListener('click', () => reviewOnClick());


    if (feedbackSection) {
        makeFileReadonly();
        return;
    }

    if (!taskTextarea || !contentTextarea || !submitBtn) {
        console.error('Required elements not found in the DOM');
        return;
    }


    enableAutosave(taskTextarea, 'task');
    enableAutosave(contentTextarea, 'content');

    trackTextareaInput(contentTextarea);

    function trackWrittenWordsCount() {
        const setWrittenWordsCount = () => {
            const wordCountElement = document.getElementById('word-count');
            const wordCount = countWords(contentTextarea.value);
            wordCountElement.textContent = `${wordCount}`;
        }

        setWrittenWordsCount();


        contentTextarea.addEventListener('input', () => {
            setWrittenWordsCount();
        });
    }

    async function initFeedbackSection() {
        const [score, feedback, correction] = await Promise.all([
            db.require(reviewScoreKey()),
            db.require(reviewFeedbackKey()),
            db.require(reviewCorrectionKey())
        ]);

        if (score === null || !feedback || !correction) {
            return;
        }

        const feedbackSection = document.getElementById('review-section');
        feedbackSection.hidden = false;

        const reviewScoreSpan = document.getElementById('review-score');
        const reviewFeedbackSpan = document.getElementById('review-feedback');
        const reviewReadonlyCorrectionSpan = document.getElementById('review-readonly-correction');
        const reviewEditableCorrectionTextarea = document.getElementById('review-editable-correction');

        enableAutosave(reviewEditableCorrectionTextarea, 'content-review-correction');

        reviewScoreSpan.textContent = score;
        reviewFeedbackSpan.textContent = feedback;

        renderCorrection(correction, reviewReadonlyCorrectionSpan);
        reviewEditableCorrectionTextarea.value = correction;
        reviewEditableCorrectionTextarea.hidden = true;

        reviewReadonlyCorrectionSpan.addEventListener('click', () => {
            reviewReadonlyCorrectionSpan.hidden = true;
            reviewEditableCorrectionTextarea.hidden = false;
            reviewEditableCorrectionTextarea.focus();
        });

        let timeout;

        [{ eventType: 'blur', delay: 500 }, { eventType: 'input', delay: 10000 }].forEach(({ eventType, delay }) => {

            reviewEditableCorrectionTextarea.addEventListener(eventType, () => {
                clearTimeout(timeout);

                timeout = setTimeout(() => {
                    const updatedText = reviewEditableCorrectionTextarea.value;

                    renderCorrection(updatedText, reviewReadonlyCorrectionSpan);

                    reviewReadonlyCorrectionSpan.hidden = false;
                    reviewEditableCorrectionTextarea.hidden = true;
                }, delay);
            });
        })


        feedbackSection.scrollIntoView({ behavior: 'smooth', block: 'start' });



        return feedbackSection;
    }

    function renderCorrection(text, container) {
        // Escape HTML first
        let escaped = text
            .replace(/\\n/g, '\n')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');

        // Regex to match --..-- and ++...++
        const regex = /--(.*?)--|\+\+(.*?)\+\+/g;

        console.log('Rendering correction:', text, '\n', escaped);

        // Replace matches with HTML spans
        const html = escaped.replace(regex, (_, removed, added) => {
            if (removed !== undefined) {
                return `<span class="bg-removed px-1 rounded">${removed}</span>`;
            } else if (added !== undefined) {
                return `<span class="bg-added px-1 rounded">${added}</span>`;
            }
            return '';
        });

        container.innerHTML = html;
    }


    function makeFileReadonly() {
        taskTextarea.disabled = true;
        contentTextarea.disabled = true;
        submitBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-2"></i>Review Again';
        submitBtn.disabled = false;
    }

    function countWords(text) {
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    function taskKey() {
        return key('task');
    }

    function contentKey() {
        return key('content');
    }

    function reviewScoreKey() {
        return key('content-review-score');
    }

    function reviewFeedbackKey() {
        return key('content-review-feedback');
    }

    function reviewCorrectionKey() {
        return key('content-review-correction');
    }

    function key(keySuffix) {
        return `${document.title}-${keySuffix}`;
    }

    function canSubmitWritingForReview() {
        return countWords(contentTextarea.value) >= 100;
    }

    async function loadSavedContent(textarea, keySuffix) {
        try {
            const savedContent = await db.require(key(keySuffix));
            if (savedContent) {
                textarea.value = savedContent;
            }
        } catch (error) {
            console.error(`Failed to load saved content for ${keySuffix}:`, error);
        }
    }

    function enableAutosave(textarea, keySuffix) {
        let saveTimeout;

        textarea.addEventListener('input', function () {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(async () => {
                const success = await db.save(key(keySuffix), textarea.value);
                if (!success) {
                    console.error(`Failed to save content for ${keySuffix}`);
                }
            }, 500);
        });
    }


    function trackTextareaInput(textarea) {
        textarea.addEventListener('input', () => {
            if (!canSubmitWritingForReview()) {
                submitBtn.disabled = true;
                return;
            } else {
                submitBtn.disabled = false;
            }
        });
    }

    async function reviewOnClick() {
        if (!canSubmitWritingForReview()) {
            console.error('Not enough words to submit for review');
            return;
        }

        onContentBeingReviewed();
        const reviewContentCommand = {
            taskId: taskKey(),
            contentId: contentKey()
        }

        try {
            const response = await fetch('/api/content/review', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reviewContentCommand)
            });

            const feedback = await response.json();

            onContentFinishedReview()
        } catch (error) {
            // Ignore errors caused by page reload/navigation
            if (error.name === 'AbortError' || error.name === 'TypeError') {
                console.log('Request cancelled (page reload or navigation)');
                return;
            }
            console.error('Error while submitting content for review:', error);
            onContentFailedReview();
        }
    }

    function onContentBeingReviewed() {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loader"></span> Bitte warten...';
        submitBtn.classList.add('loading');

        // Disable textareas during reviewing
        taskTextarea.disabled = true;
        contentTextarea.disabled = true;

        if (feedbackSection) {
            feedbackSection.hidden = true;
        }
    }

    function onContentFinishedReview() {
        window.location.reload();
    }

    function onContentFailedReview() {
        // Reset button state
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Try Again';
        submitBtn.classList.remove('loading');

        // Re-enable textareas
        taskTextarea.disabled = false;
        contentTextarea.disabled = false;
    }
});