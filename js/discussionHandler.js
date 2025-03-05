const DiscussionHandler = (function() {
    let wsManager = null;
    
    class Discussion {
        constructor(data) {
            this.id = data.id;
            this.title = data.title;
            this.content = data.content;
            this.type = data.type;
            this.parentId = data.parentId;
        }
        
        render() {
            if (!this.validate()) return null;
            return createDiscussionElement(this);
        }
        
        validate() {
            return Boolean(this.title && this.id);
        }
    }

    function init() {
        wsManager = new WebSocketManager({
            url: 'ws://your-server-url/discussions',
            onMessage: handleRealtimeUpdate
        });
        
        attachEventListeners();
        return {
            loadDiscussions,
            cleanup
        };
    }

    function cleanup() {
        wsManager?.disconnect();
        removeEventListeners();
    }

    function attachEventListeners() {
        window.addEventListener('beforeunload', cleanup);
        // ...existing event listener code...
    }

    function removeEventListeners() {
        window.removeEventListener('beforeunload', cleanup);
        // ...existing removal code...
    }

    function handleRealtimeUpdate(update) {
        try {
            const discussion = new Discussion(update);
            if (!discussion.validate()) return;
            
            const element = discussion.render();
            if (!element) return;
            
            updateDOM(element, discussion);
        } catch (error) {
            console.error('Error handling update:', error);
        }
    }

    function updateDOM(element, discussion) {
        const container = document.getElementById('discussions-container');
        if (!container) return;
        
        element.classList.add('discussion-new');
        
        if (discussion.type === 'reply') {
            appendReply(element, discussion.parentId);
        } else {
            container.insertBefore(element, container.firstChild);
        }
        
        requestAnimationFrame(() => element.classList.remove('discussion-new'));
    }

    function appendReply(element, parentId) {
        const parentDiscussion = document.querySelector(`[data-discussion-id="${parentId}"]`);
        if (parentDiscussion) {
            parentDiscussion.querySelector('.discussion-replies')?.appendChild(element);
        }
    }

    function createDiscussionElement(discussion) {
        if (!discussion?.title || !discussion?.id) {
            console.warn('Invalid discussion data:', discussion);
            return null;
        }
        
        try {
            const element = document.createElement('div');
            element.className = 'discussion-item';
            element.setAttribute('role', 'article');
            element.dataset.discussionId = discussion.id;
            
            const title = document.createElement('h3');
            title.className = 'discussion-title';
            title.textContent = discussion.title || '';
            
            const content = document.createElement('p');
            content.className = 'discussion-content';
            content.textContent = discussion.content || '';
            
            const replies = document.createElement('div');
            replies.className = 'discussion-replies';
            
            element.appendChild(title);
            element.appendChild(content);
            element.appendChild(replies);
            
            return element;
        } catch (error) {
            console.error('Error creating discussion element:', error);
            return null;
        }
    }

    function displayDiscussions(discussions) {
        try {
            const container = document.getElementById('discussions-container');
            if (!container) throw new Error('Discussions container not found');
            
            const fragment = document.createDocumentFragment();
            container.innerHTML = '';
            
            if (!discussions || !Array.isArray(discussions) || !discussions.length) {
                const empty = document.createElement('div');
                empty.className = 'discussion-empty';
                empty.textContent = 'No discussions found';
                fragment.appendChild(empty);
                container.appendChild(fragment);
                return;
            }

            // Debug the discussions data
            console.log('Processing discussions:', JSON.stringify(discussions).substring(0, 200) + '...');
            
            try {
                // First create all valid elements
                const validElements = [];
                
                for (let i = 0; i < discussions.length; i++) {
                    try {
                        const discussion = discussions[i];
                        
                        // Skip invalid discussions
                        if (!discussion) {
                            console.warn('Skipping null discussion at index', i);
                            continue;
                        }
                        
                        // Create a safe discussion object with defaults
                        const safeDiscussion = {
                            id: (discussion.id || `temp-${Date.now()}-${i}`).toString(),
                            title: (discussion.title || '').toString(),
                            content: (discussion.content || '').toString(),
                            type: (discussion.type || 'discussion').toString()
                        };
                        
                        // Skip discussions without titles
                        if (!safeDiscussion.title) {
                            console.warn('Skipping discussion without title at index', i);
                            continue;
                        }
                        
                        // Create the element
                        const element = createDiscussionElement(safeDiscussion);
                        
                        // Only add valid DOM nodes
                        if (element && element.nodeType === Node.ELEMENT_NODE) {
                            validElements.push(element);
                        } else {
                            console.warn('Invalid element created for discussion at index', i);
                        }
                    } catch (err) {
                        console.error('Error processing discussion at index', i, err);
                    }
                }
                
                // Now append all valid elements to the fragment
                if (validElements.length === 0) {
                    const empty = document.createElement('div');
                    empty.className = 'discussion-empty';
                    empty.textContent = 'No valid discussions found';
                    fragment.appendChild(empty);
                } else {
                    validElements.forEach(element => {
                        fragment.appendChild(element);
                    });
                }
            } catch (err) {
                console.error('Error processing discussions:', err);
                const error = document.createElement('div');
                error.className = 'discussion-error';
                error.textContent = 'Error processing discussions';
                fragment.appendChild(error);
            }

            container.appendChild(fragment);
            return true;
        } catch (error) {
            console.error('Error displaying discussions:', error);
            showErrorMessage('Failed to display discussions');
            return false;
        }
    }

    function handleTouchStart(e) {
        this.classList.add('discussion-touch');
    }

    function handleTouchEnd(e) {
        this.classList.remove('discussion-touch');
    }

    function showErrorMessage(message) {
        const container = document.getElementById('discussions-container');
        if (!container) return;
        
        const error = document.createElement('div');
        error.className = 'discussion-error';
        error.textContent = message;
        container.appendChild(error);
    }

    function loadDiscussions() {
        const container = document.getElementById('discussions-container');
        if (!container) return;
        
        container.classList.add('loading');
        
        try {
            // Check if WebSocketManager exists
            if (typeof WebSocketManager !== 'undefined' && wsManager) {
                wsManager.connect();
            } else {
                console.warn('WebSocketManager not initialized');
            }
            
            // Get discussions data with more robust error handling
            let discussionsData = [];
            try {
                // Try to get discussions from window or global scope
                if (typeof window.discussions === 'object' && Array.isArray(window.discussions)) {
                    discussionsData = window.discussions;
                } else if (typeof discussions === 'object' && Array.isArray(discussions)) {
                    discussionsData = discussions;
                } else {
                    // Try to get from data attribute
                    const dataAttr = container.getAttribute('data-discussions');
                    if (dataAttr) {
                        try {
                            discussionsData = JSON.parse(dataAttr);
                        } catch (e) {
                            console.error('Failed to parse discussions data attribute:', e);
                        }
                    }
                }
            } catch (e) {
                console.error('Error accessing discussions data:', e);
            }
            
            // Ensure we have an array
            if (!Array.isArray(discussionsData)) {
                console.warn('Discussions not found or not an array, using empty array');
                discussionsData = [];
            }
            
            displayDiscussions(discussionsData);
        } catch (error) {
            console.error('Error loading discussions:', error);
            showErrorMessage('Failed to load discussions');
        } finally {
            container.classList.remove('loading');
        }
    }

    return { init };
})();

// Export for global use
window.discussionHandler = DiscussionHandler.init();
