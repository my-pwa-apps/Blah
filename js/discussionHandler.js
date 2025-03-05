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
            
            // Check if discussions exist and is an array
            if (!discussions || !Array.isArray(discussions) || !discussions.length) {
                const empty = document.createElement('div');
                empty.className = 'discussion-empty';
                empty.textContent = 'No discussions found';
                fragment.appendChild(empty);
                container.appendChild(fragment);
                return;
            }

            // Create discussion elements with additional error handling
            try {
                const validDiscussions = discussions
                    .map(discussion => {
                        try {
                            // Skip any discussion that's null or undefined
                            if (!discussion) return null;
                            
                            // Create a properly formatted discussion object
                            const discussionObj = {
                                id: discussion.id || `temp-${Date.now()}`,
                                title: discussion.title || '',
                                content: discussion.content || '',
                                type: discussion.type || 'discussion'
                            };
                            
                            // Only create element if title exists
                            if (!discussionObj.title) return null;
                            
                            return createDiscussionElement(discussionObj);
                        } catch (err) {
                            console.warn('Error creating discussion element:', err);
                            return null;
                        }
                    })
                    .filter(element => element instanceof Node); // Only keep valid DOM nodes

                // Add discussions or display empty message if none are valid
                if (!validDiscussions.length) {
                    const empty = document.createElement('div');
                    empty.className = 'discussion-empty';
                    empty.textContent = 'No valid discussions found';
                    fragment.appendChild(empty);
                } else {
                    validDiscussions.forEach(element => {
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
            if (wsManager) {
                wsManager.connect();
            } else {
                console.warn('WebSocketManager not initialized');
            }
            
            // Safe access to discussions variable
            let discussionsData = [];
            
            // Check if discussions is defined in the global scope
            if (typeof window.discussions !== 'undefined') {
                discussionsData = window.discussions;
            } else if (typeof discussions !== 'undefined') {
                discussionsData = discussions;
            } else {
                // If discussions isn't available, fetch from API or use empty array
                console.warn('No discussions data found, using empty array');
            }
            
            // Call displayDiscussions with the safely accessed data
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
