// Basic JavaScript for the simple HTML framework

// Simple database using server-side JSON file for cross-browser persistence
class ServerDB {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
    }

    async set(key, value) {
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
            // Fallback to localStorage
            localStorage.setItem(key, value);
            return false;
        }
    }

    async get(key) {
        try {
            const response = await fetch(`${this.baseUrl}/api/data/${encodeURIComponent(key)}`);
            if (response.ok) {
                const data = await response.json();
                return data.value || null;
            }
        } catch (error) {
            console.error('Server load failed:', error);
        }

        // Fallback to localStorage
        return localStorage.getItem(key);
    }
}

// Wait for the DOM to be fully loaded before executing code
document.addEventListener('DOMContentLoaded', async function() {
    const db = new ServerDB();

    // Auto-save functionality for both textareas
    const taskTextarea = document.getElementById('task-input');
    const contentTextarea = document.getElementById('content-input');

    // Function to setup auto-save for a textarea
    function setupAutoSave(textarea, keySuffix) {
        if (!textarea) return;

        const storageKey = `${document.title}-${keySuffix}`;

        // Load saved content on page load
        db.get(storageKey).then(savedContent => {
            if (savedContent) {
                textarea.value = savedContent;
            }
        }).catch(error => {
            console.error(`Failed to load saved content for ${keySuffix}:`, error);
        });

        // Save content on every input (with debouncing)
        let saveTimeout;
        textarea.addEventListener('input', function() {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(async () => {
                const success = await db.set(storageKey, textarea.value);
                if (!success) {
                    console.warn(`Failed to save content for ${keySuffix}`);
                }
            }, 300); // Save after 300ms of no typing
        });
    }

    // Setup auto-save for both textareas
    setupAutoSave(taskTextarea, 'task');
    setupAutoSave(contentTextarea, 'content');

    // Submit button functionality
    const submitBtn = document.getElementById('submit-btn');

    // Function to count words
    function countWords(text) {
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    // Function to update submit button state
    function updateSubmitButton() {
        const taskWords = countWords(taskTextarea.value);
        const contentWords = countWords(contentTextarea.value);
        const totalWords = taskWords + contentWords;

        submitBtn.disabled = totalWords < 100;
    }

    // Auto-expand textareas with max height limit
    // (Function moved to global scope above)

    // Initialize textareas
    [taskTextarea, contentTextarea].forEach(textarea => {
        if (textarea) {
            // Auto-expand on input
            textarea.addEventListener('input', function() {
                updateSubmitButton();
            });

            // Auto-expand on load if there's content
            if (textarea.value.trim()) {
                // Content is already loaded
            }
        }
    });

    if (submitBtn) {
        submitBtn.addEventListener('click', async function() {
            const taskContent = taskTextarea.value.trim();
            const contentText = contentTextarea.value.trim();
            const totalWords = countWords(taskContent) + countWords(contentText);

            if (totalWords < 100) {
                alert(`Please write at least 100 words. You currently have ${totalWords} words.`);
                return;
            }

            // Show loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="loader"></span> Processing...';
            submitBtn.classList.add('loading');

            // Disable textareas during processing
            taskTextarea.disabled = true;
            contentTextarea.disabled = true;
            taskTextarea.style.opacity = '0.6';
            contentTextarea.style.opacity = '0.6';

            try {
                // Send request to backend
                const response = await fetch('/api/process-submission', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ key: document.title })
                });

                const result = await response.json();

                if (response.ok) {
                    alert(`✅ Success! ${result.message}\nWord count: ${result.wordCount}`);
                } else {
                    alert(`❌ Error: ${result.error}`);
                }
            } catch (error) {
                console.error('Submission error:', error);
                alert('❌ Error: Failed to submit content. Please try again.');
            } finally {
                // Reset button state
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Submit';
                submitBtn.classList.remove('loading');

                // Re-enable textareas
                taskTextarea.disabled = false;
                contentTextarea.disabled = false;
                taskTextarea.style.opacity = '1';
                contentTextarea.style.opacity = '1';
            }
        });

        // Initial button state
        updateSubmitButton();
    }
});