/**
 * Discussion Handler Module
 * Handles discussion rendering and real-time updates
 */
window.discussionHandler = (function() {
    // Private state
    let socketManager = null;
    let initialized = false;
    let discussionsContainer = null;
    
    /**
     * Initialize the discussion handler
     */
    function init() {
        if (initialized) return;
        
        try {
            discussionsContainer = document.getElementById('discussions-container');
            if (!discussionsContainer) {
                console.error('Discussion container not found');
                return;
            }
            
            // Initialize WebSocket if available
            if (typeof WebSocketManager === 'function') {
                initWebSocket();
            }
            
            // Attach event listeners
            window.addEventListener('beforeunload', cleanup);
            
            initialized = true;
            console.log('Discussion handler initialized');
            
            return {
                loadDiscussions,
                addDiscussion,
                addReply,
                cleanup
            };
        } catch (error) {
            console.error('Failed to initialize discussion handler:', error);
            return {
                loadDiscussions: () => showError('Handler initialization failed'),
                cleanup: () => {}
            };
        }
    }
    
    /**
     * Set up WebSocket connection
     */
    function initWebSocket() {
        try {
            socketManager = new WebSocketManager({
                url: 'ws://your-server-url/discussions',
                onMessage: handleSocketMessage
            });
        } catch (error) {
            console.error('WebSocket initialization failed:', error);
        }
    }
    
    /**
     * Handle incoming WebSocket messages
     */
    function handleSocketMessage(data) {
        try {
            if (!data || typeof data !== 'object') return;
            
            if (data.type === 'reply' && data.parentId) {
                addReply(data);
            } else {
                addDiscussion(data);
            }
        } catch (error) {
            console.error('Failed to handle WebSocket message:', error);
        }
    }
    
    /**
     * Load discussions from data source
     */
    function loadDiscussions() {
        if (!discussionsContainer) {
            console.error('Discussion container not available');
            return false;
        }
        
        discussionsContainer.classList.add('loading');
        showStatus('Loading discussions...');
        
        try {
            // Find discussions data source
            let discussionsData = findDiscussionsData();
            
            // Clear existing discussions
            clearDiscussions();
            
            // Handle empty discussions
            if (!discussionsData || !discussionsData.length) {
                showEmpty('No discussions available');
                return true;
            }
            
            // Render discussions
            renderDiscussions(discussionsData);
            return true;
        } catch (error) {
            console.error('Failed to load discussions:', error);
            showError('Failed to load discussions');
            return false;
        } finally {
            discussionsContainer.classList.remove('loading');
        }
    }
    
    /**
     * Try to find discussions data from various sources
     */
    function findDiscussionsData() {
        // Try window property first
        if (window.discussions && Array.isArray(window.discussions)) {
            return window.discussions;
        }
        
        // Try global variable
        if (typeof discussions !== 'undefined' && Array.isArray(discussions)) {
            return discussions;
        }
        
        // Try data attribute
        if (discussionsContainer) {
            const dataAttr = discussionsContainer.getAttribute('data-discussions');
            if (dataAttr) {
                try {
                    const parsed = JSON.parse(dataAttr);
                    if (Array.isArray(parsed)) return parsed;
                } catch (e) {
                    console.warn('Failed to parse discussions data attribute');
                }
            }
        }
        
        // Return empty array if no data found
        return [];
    }
    
    /**
     * Clear all discussions from container
     */
    function clearDiscussions() {
        if (discussionsContainer) {
            // Create a new div to replace the content (safer than innerHTML)
            const newContent = document.createElement('div');
            newContent.id = discussionsContainer.id;
            newContent.className = discussionsContainer.className;
            
            // Replace the old element with the new empty one
            discussionsContainer.parentNode.replaceChild(newContent, discussionsContainer);
            discussionsContainer = newContent;
        }
    }
    
    /**
     * Render discussions to the container
     */
    function renderDiscussions(discussions) {
        if (!discussionsContainer) return;
        
        // Use document fragment for better performance
        const fragment = document.createDocumentFragment();
        let validCount = 0;
        
        // Process each discussion
        for (let i = 0; i < discussions.length; i++) {
            try {
                const discussion = discussions[i];
                if (!isValidDiscussion(discussion)) continue;
                
                const element = createDiscussionElement(discussion);
                if (element) {
                    fragment.appendChild(element);
                    validCount++;
                }
            } catch (error) {
                console.warn(`Error rendering discussion at index ${i}:`, error);
            }
        }
        
        // Show empty message if no valid discussions
        if (validCount === 0) {
            showEmpty('No valid discussions found');
            return;
        }
        
        // Append all discussions at once
        discussionsContainer.appendChild(fragment);
    }
    
    /**
     * Check if discussion object is valid
     */
    function isValidDiscussion(discussion) {
        return (
            discussion &&
            typeof discussion === 'object' &&
            typeof discussion.title === 'string' &&
            discussion.title.trim() !== ''
        );
    }
    
    /**
     * Create a discussion DOM element
     */
    function createDiscussionElement(discussion) {
        try {
            // Create safe discussion object with defaults
            const safeDiscussion = {
                id: String(discussion.id || `temp-${Date.now()}`),
                title: String(discussion.title || ''),
                content: String(discussion.content || ''),
                type: String(discussion.type || 'discussion')
            };
            
            // Skip if no title
            if (!safeDiscussion.title.trim()) return null;
            
            // Create main element
            const element = document.createElement('div');
            element.className = 'discussion-item';
            element.setAttribute('role', 'article');
            element.dataset.discussionId = safeDiscussion.id;
            
            // Create title
            const title = document.createElement('h3');
            title.className = 'discussion-title';
            title.textContent = safeDiscussion.title;
            element.appendChild(title);
            
            // Create content
            const content = document.createElement('p');
            content.className = 'discussion-content';
            content.textContent = safeDiscussion.content;
            element.appendChild(content);
            
            // Create replies container
            const replies = document.createElement('div');
            replies.className = 'discussion-replies';
            element.appendChild(replies);
            
            // Add touch handlers for mobile
            element.addEventListener('touchstart', function() {
                this.classList.add('discussion-touch');
            });
            
            element.addEventListener('touchend', function() {
                this.classList.remove('discussion-touch');
            });
            
            return element;
        } catch (error) {
            console.error('Failed to create discussion element:', error);
            return null;
        }
    }
    
    /**
     * Add a new discussion to the container
     */
    function addDiscussion(discussion) {
        if (!discussionsContainer || !isValidDiscussion(discussion)) return null;
        
        try {
            const element = createDiscussionElement(discussion);
            if (!element) return null;
            
            element.classList.add('discussion-new');
            
            // Add to the beginning of the list
            if (discussionsContainer.firstChild) {
                discussionsContainer.insertBefore(element, discussionsContainer.firstChild);
            } else {
                discussionsContainer.appendChild(element);
            }
            
            // Remove highlight after animation
            setTimeout(() => {
                element.classList.remove('discussion-new');
            }, 300);
            
            return element;
        } catch (error) {
            console.error('Failed to add discussion:', error);
            return null;
        }
    }
    
    /**
     * Add a reply to an existing discussion
     */
    function addReply(reply) {
        if (!discussionsContainer || !isValidDiscussion(reply) || !reply.parentId) return null;
        
        try {
            const parentEl = discussionsContainer.querySelector(`[data-discussion-id="${reply.parentId}"]`);
            if (!parentEl) return null;
            
            const repliesEl = parentEl.querySelector('.discussion-replies');
            if (!repliesEl) return null;
            
            const element = createDiscussionElement(reply);
            if (!element) return null;
            
            element.classList.add('discussion-reply', 'discussion-new');
            repliesEl.appendChild(element);
            
            // Remove highlight after animation
            setTimeout(() => {
                element.classList.remove('discussion-new');
            }, 300);
            
            return element;
        } catch (error) {
            console.error('Failed to add reply:', error);
            return null;
        }
    }
    
    /**
     * Show error message in container
     */
    function showError(message) {
        if (!discussionsContainer) return;
        
        try {
            const errorEl = document.createElement('div');
            errorEl.className = 'discussion-error';
            errorEl.textContent = message || 'An error occurred';
            
            clearDiscussions();
            discussionsContainer.appendChild(errorEl);
        } catch (error) {
            console.error('Failed to show error message:', error);
        }
    }
    
    /**
     * Show empty message in container
     */
    function showEmpty(message) {
        if (!discussionsContainer) return;
        
        try {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'discussion-empty';
            emptyEl.textContent = message || 'No discussions found';
            
            discussionsContainer.appendChild(emptyEl);
        } catch (error) {
            console.error('Failed to show empty message:', error);
        }
    }
    
    /**
     * Show status message in container
     */
    function showStatus(message) {
        if (!discussionsContainer) return;
        
        try {
            const statusEl = document.createElement('div');
            statusEl.className = 'discussion-status';
            statusEl.textContent = message || 'Loading...';
            
            clearDiscussions();
            discussionsContainer.appendChild(statusEl);
        } catch (error) {
            console.error('Failed to show status message:', error);
        }
    }
    
    /**
     * Clean up resources
     */
    function cleanup() {
        try {
            if (socketManager) {
                socketManager.disconnect();
                socketManager = null;
            }
            
            window.removeEventListener('beforeunload', cleanup);
            initialized = false;
        } catch (error) {
            console.error('Failed to clean up discussion handler:', error);
        }
    }
    
    // Return public API
    return init();
})();
