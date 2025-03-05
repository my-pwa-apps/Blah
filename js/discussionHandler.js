/**
 * Discussion Handler Module
 * Handles discussion rendering and real-time updates
 */
window.discussionHandler = (function() {
    // Private state
    let socketManager = null;
    let initialized = false;
    let discussionsContainer = null;
    const DEBUG = true; // Enable verbose debugging
    
    /**
     * Debug logger
     */
    function debug(message, ...args) {
        if (!DEBUG) return;
        console.log(`%c[DiscussionHandler] ${message}`, 'color: #6495ED', ...args);
    }
    
    /**
     * Error logger
     */
    function logError(message, error) {
        console.error(`%c[DiscussionHandler ERROR] ${message}`, 'color: #FF6347', error);
        console.trace('Stack trace:');
    }
    
    /**
     * Initialize the discussion handler
     */
    function init() {
        debug('Initializing discussion handler');
        if (initialized) {
            debug('Already initialized, skipping');
            return;
        }
        
        try {
            discussionsContainer = document.getElementById('discussions-container');
            debug('Container found?', Boolean(discussionsContainer));
            
            if (!discussionsContainer) {
                logError('Discussion container not found');
                return null;
            }
            
            debug('Container details:', {
                id: discussionsContainer.id,
                className: discussionsContainer.className,
                childNodes: discussionsContainer.childNodes.length
            });
            
            // Initialize WebSocket if available
            if (typeof WebSocketManager === 'function') {
                debug('WebSocketManager found, initializing');
                initWebSocket();
            } else {
                debug('WebSocketManager not found, skipping websocket initialization');
            }
            
            // Attach event listeners
            window.addEventListener('beforeunload', cleanup);
            
            initialized = true;
            debug('Discussion handler initialized successfully');
            
            return {
                loadDiscussions,
                addDiscussion,
                addReply,
                cleanup
            };
        } catch (error) {
            logError('Failed to initialize discussion handler', error);
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
        debug('loadDiscussions() called');
        
        if (!discussionsContainer) {
            logError('Discussion container not available');
            return false;
        }
        
        discussionsContainer.classList.add('loading');
        showStatus('Loading discussions...');
        
        try {
            debug('Call stack:', new Error().stack);
            debug('Container state before loading:', {
                childNodes: discussionsContainer.childNodes.length,
                innerHTML: discussionsContainer.innerHTML.substring(0, 100) + '...'
            });
            
            // Find discussions data source
            debug('Looking for discussions data');
            let discussionsData = findDiscussionsData();
            
            debug('Found discussions data:', {
                type: Array.isArray(discussionsData) ? 'Array' : typeof discussionsData,
                length: discussionsData?.length || 0,
                sample: JSON.stringify(discussionsData?.slice(0, 1) || {}).substring(0, 100)
            });
            
            // Clear existing discussions
            debug('Clearing existing discussions');
            clearDiscussions();
            
            // Handle empty discussions
            if (!discussionsData || !discussionsData.length) {
                debug('No discussions data found, showing empty message');
                showEmpty('No discussions available');
                return true;
            }
            
            // Render discussions with safer approach
            debug('Beginning to render discussions, count:', discussionsData.length);
            renderDiscussionsSafe(discussionsData);
            
            debug('loadDiscussions completed');
            return true;
        } catch (error) {
            logError('Failed to load discussions', error);
            showError('Failed to load discussions. Please check console for details.');
            return false;
        } finally {
            discussionsContainer.classList.remove('loading');
            debug('Loading state removed');
        }
    }
    
    /**
     * A safer version of renderDiscussions with extra precautions
     */
    function renderDiscussionsSafe(discussions) {
        debug('renderDiscussionsSafe called with', discussions?.length || 0, 'discussions');
        
        if (!discussionsContainer) {
            logError('No discussions container available for rendering');
            return;
        }
        
        if (!discussions) {
            logError('No discussions data provided for rendering');
            showEmpty('No discussions data');
            return;
        }
        
        try {
            // Ensure we're working with an array
            if (!Array.isArray(discussions)) {
                debug('Discussions is not an array, attempting to convert:', discussions);
                
                // Try to convert to array if possible
                if (discussions && typeof discussions === 'object') {
                    if (discussions.discussions && Array.isArray(discussions.discussions)) {
                        debug('Found nested discussions array');
                        discussions = discussions.discussions;
                    } else {
                        try {
                            debug('Treating as single item');
                            discussions = [discussions]; 
                        } catch (e) {
                            logError('Could not convert to array', e);
                            discussions = []; 
                        }
                    }
                } else {
                    debug('Invalid discussions data, using empty array');
                    discussions = [];
                }
            }
            
            debug('Working with', discussions.length, 'discussions');
            
            // Use document fragment for better performance
            debug('Creating document fragment');
            let fragment;
            try {
                fragment = document.createDocumentFragment();
                debug('Fragment created successfully');
            } catch (e) {
                logError('Failed to create document fragment', e);
                return;
            }
            
            let validCount = 0;
            
            // Process each discussion one by one to isolate errors
            for (let i = 0; i < discussions.length; i++) {
                debug(`Processing discussion ${i+1}/${discussions.length}`);
                
                try {
                    const discussion = discussions[i];
                    
                    // Skip if not an object
                    if (!discussion || typeof discussion !== 'object') {
                        debug(`Discussion at index ${i} is not valid:`, discussion);
                        continue;
                    }
                    
                    debug(`Creating element for discussion:`, {
                        id: discussion.id,
                        title: discussion.title?.substring(0, 20) + '...',
                        type: discussion.type
                    });
                    
                    // Try to create an element, with extensive error checking
                    const element = createSafeDiscussionElement(discussion);
                    
                    // Only append valid DOM nodes
                    if (element) {
                        debug(`Checking if element is valid DOM node:`, {
                            nodeType: element.nodeType,
                            isElement: element.nodeType === Node.ELEMENT_NODE,
                            tagName: element.tagName
                        });
                        
                        if (element.nodeType === Node.ELEMENT_NODE) {
                            try {
                                debug(`Appending element ${i} to fragment`);
                                fragment.appendChild(element);
                                validCount++;
                                debug(`Element ${i} appended successfully`);
                            } catch (e) {
                                logError(`Failed to append element ${i} to fragment`, e);
                            }
                        } else {
                            debug(`Element at index ${i} is not a valid DOM node:`, element);
                        }
                    } else {
                        debug(`createSafeDiscussionElement returned null for index ${i}`);
                    }
                } catch (error) {
                    logError(`Error processing discussion at index ${i}`, error);
                }
            }
            
            // Show empty message if no valid discussions
            if (validCount === 0) {
                debug('No valid discussions rendered, showing empty message');
                showEmpty('No valid discussions found');
                return;
            }
            
            // Append all discussions at once
            try {
                debug(`Appending fragment with ${validCount} discussions to container`);
                discussionsContainer.appendChild(fragment);
                debug(`Successfully appended fragment to container`);
            } catch (error) {
                logError('Failed to append fragment to container', error);
                showError('Error displaying discussions');
            }
            
            debug(`Successfully rendered ${validCount} discussions`);
        } catch (error) {
            logError('Failed in renderDiscussionsSafe', error);
            showError('Failed to render discussions');
        }
    }
    
    /**
     * A safer version of createDiscussionElement with more error handling
     */
    function createSafeDiscussionElement(discussion) {
        debug('Creating safe discussion element for:', discussion?.id || 'unknown');
        
        try {
            // Check for empty discussion object
            if (!discussion) {
                debug('Discussion object is null or undefined');
                return null;
            }
            
            // Create safe discussion object with defaults and explicit string conversions
            debug('Sanitizing discussion properties');
            let id, title, content, type;
            
            try {
                id = discussion.id !== undefined ? String(discussion.id) : `temp-${Date.now()}`;
                debug('ID processed:', id);
            } catch (e) {
                logError('Error processing discussion ID', e);
                id = `temp-${Date.now()}`;
            }
            
            try {
                title = discussion.title !== undefined ? String(discussion.title) : '';
                debug('Title processed:', title?.substring(0, 20) + '...');
            } catch (e) {
                logError('Error processing discussion title', e);
                title = '';
            }
            
            try {
                content = discussion.content !== undefined ? String(discussion.content) : '';
                debug('Content processed (length):', content?.length || 0);
            } catch (e) {
                logError('Error processing discussion content', e);
                content = '';
            }
            
            try {
                type = discussion.type !== undefined ? String(discussion.type) : 'discussion';
                debug('Type processed:', type);
            } catch (e) {
                logError('Error processing discussion type', e);
                type = 'discussion';
            }
            
            // Skip if no title after sanitization
            if (!title.trim()) {
                debug('Skipping discussion with empty title');
                return null;
            }
            
            // Create main element
            debug('Creating main element div');
            let element;
            try {
                element = document.createElement('div');
                debug('Element created successfully');
            } catch (e) {
                logError('Failed to create main element div', e);
                return null;
            }
            
            // Add classes and attributes
            try {
                element.className = 'discussion-item';
                element.setAttribute('role', 'article');
                element.dataset.discussionId = id;
                debug('Element attributes set');
            } catch (e) {
                logError('Failed to set element attributes', e);
            }
            
            // Create title element
            let titleElement;
            try {
                debug('Creating title element');
                titleElement = document.createElement('h3');
                titleElement.className = 'discussion-title';
                titleElement.textContent = title;
                debug('Title element created');
            } catch (e) {
                logError('Failed to create title element', e);
                return null;
            }
            
            // Create content element
            let contentElement;
            try {
                debug('Creating content element');
                contentElement = document.createElement('p');
                contentElement.className = 'discussion-content';
                contentElement.textContent = content;
                debug('Content element created');
            } catch (e) {
                logError('Failed to create content element', e);
                return null;
            }
            
            // Create replies container
            let repliesElement;
            try {
                debug('Creating replies element');
                repliesElement = document.createElement('div');
                repliesElement.className = 'discussion-replies';
                debug('Replies element created');
            } catch (e) {
                logError('Failed to create replies element', e);
                return null;
            }
            
            // Explicitly append each child with error handling
            try {
                debug('Appending title to main element');
                element.appendChild(titleElement);
                debug('Title appended successfully');
                
                debug('Appending content to main element');
                element.appendChild(contentElement);
                debug('Content appended successfully');
                
                debug('Appending replies container to main element');
                element.appendChild(repliesElement);
                debug('Replies container appended successfully');
            } catch (error) {
                logError('Failed to append child elements', error);
                return null;
            }
            
            debug('Successfully created discussion element');
            return element;
        } catch (error) {
            logError('Failed to create discussion element', error);
            return null;
        }
    }
    
    /**
     * Try to find discussions data from various sources
     */
    function findDiscussionsData() {
        debug('Looking for discussions data sources');
        
        try {
            // Try window property first
            debug('Checking window.discussions');
            if (window.discussions !== undefined) {
                debug('Found window.discussions:', {
                    type: typeof window.discussions,
                    isArray: Array.isArray(window.discussions),
                    length: Array.isArray(window.discussions) ? window.discussions.length : 'N/A'
                });
                
                if (Array.isArray(window.discussions)) {
                    debug('window.discussions is an array, using it');
                    return window.discussions;
                } else if (typeof window.discussions === 'object') {
                    // Maybe it has a discussions property?
                    debug('window.discussions is an object, checking for nested discussions array');
                    if (window.discussions.discussions && Array.isArray(window.discussions.discussions)) {
                        debug('Found nested discussions array in window.discussions.discussions');
                        return window.discussions.discussions;
                    }
                }
            } else {
                debug('window.discussions is undefined');
            }
            
            // Try global variable
            debug('Checking global discussions variable');
            if (typeof discussions !== 'undefined') {
                debug('Found global discussions variable:', {
                    type: typeof discussions,
                    isArray: Array.isArray(discussions),
                    length: Array.isArray(discussions) ? discussions.length : 'N/A'
                });
                
                if (Array.isArray(discussions)) {
                    debug('Global discussions is an array, using it');
                    return discussions;
                } else if (typeof discussions === 'object') {
                    // Maybe it has a discussions property?
                    debug('Global discussions is an object, checking for nested discussions array');
                    if (discussions.discussions && Array.isArray(discussions.discussions)) {
                        debug('Found nested discussions array in global discussions.discussions');
                        return discussions.discussions;
                    }
                }
            } else {
                debug('Global discussions variable is undefined');
            }
            
            // Try data attribute with more parsing options
            if (discussionsContainer) {
                debug('Checking data-discussions attribute');
                // Try data-discussions attribute
                let dataAttr = discussionsContainer.getAttribute('data-discussions');
                if (dataAttr) {
                    debug('Found data-discussions attribute:', dataAttr.substring(0, 50) + '...');
                    try {
                        const parsed = JSON.parse(dataAttr);
                        debug('Successfully parsed data-discussions attribute:', {
                            type: typeof parsed,
                            isArray: Array.isArray(parsed)
                        });
                        
                        if (Array.isArray(parsed)) {
                            debug('Parsed data-discussions is an array, using it');
                            return parsed;
                        }
                        if (parsed && Array.isArray(parsed.discussions)) {
                            debug('Found nested array in parsed data-discussions');
                            return parsed.discussions;
                        }
                    } catch (e) {
                        logError('Failed to parse discussions data attribute', e);
                    }
                } else {
                    debug('No data-discussions attribute found');
                }
                
                // Try data-discussions-url attribute
                debug('Checking data-discussions-url attribute');
                dataAttr = discussionsContainer.getAttribute('data-discussions-url');
                if (dataAttr) {
                    debug('Found data-discussions-url attribute:', dataAttr);
                    // In a future implementation, we could fetch from this URL
                    debug('Async loading not implemented yet');
                } else {
                    debug('No data-discussions-url attribute found');
                }
            }
            
        } catch (e) {
            logError('Error finding discussion data', e);
        }
        
        // Create mock data for testing
        debug('No discussions data found, creating mock data for debugging');
        try {
            const mockData = [
                { id: 'mock1', title: 'Debug Discussion 1', content: 'This is a mock discussion for debugging' },
                { id: 'mock2', title: 'Debug Discussion 2', content: 'This is another mock discussion' }
            ];
            debug('Created mock data:', mockData);
            return mockData;
        } catch (e) {
            logError('Failed to create mock data', e);
        }
        
        debug('Returning empty array as fallback');
        return [];
    }
    
    /**
     * Clear all discussions from container
     */
    function clearDiscussions() {
        debug('Clearing discussions container');
        
        if (!discussionsContainer) {
            debug('No discussions container to clear');
            return;
        }
        
        try {
            debug('Container before clearing:', {
                childNodes: discussionsContainer.childNodes.length,
                innerHTML: discussionsContainer.innerHTML.substring(0, 50) + '...'
            });
            
            // Create a new div to replace the content (safer than innerHTML)
            const newContent = document.createElement('div');
            newContent.id = discussionsContainer.id;
            newContent.className = discussionsContainer.className;
            
            debug('Created replacement container');
            
            // Replace the old element with the new empty one
            if (discussionsContainer.parentNode) {
                debug('Replacing old container with new one');
                discussionsContainer.parentNode.replaceChild(newContent, discussionsContainer);
                discussionsContainer = newContent;
                debug('Container replaced successfully');
            } else {
                logError('Cannot replace container - no parent node');
            }
        } catch (error) {
            logError('Failed to clear discussions', error);
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
