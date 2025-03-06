/**
 * Discussion Repair Script
 * Repairs issues with discussion loading on the main page
 * Version: 1.0.2
 */
(function() {
    console.log('%c[Discussion Repair] Script loaded', 'color: #FF5722; font-weight: bold');
    
    // Configuration
    const config = {
        version: '1.0.2',
        containerId: 'discussions-container',
        debugMode: true,
        syncIndicator: true
    };
    
    // Run the repair when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runRepair);
    } else {
        runRepair();
    }
    
    function runRepair() {
        console.log('%c[Discussion Repair] Starting repair process...', 'color: #FF5722; font-weight: bold');
        
        // 1. Fix missing container issue
        ensureContainerExists();
        
        // 2. Add sync indicator
        if (config.syncIndicator) {
            addSyncIndicator();
        }
        
        // 3. Check for discussionHandler
        checkAndRepairHandler();
        
        console.log('%c[Discussion Repair] Repair complete', 'color: #FF5722; font-weight: bold');
    }
    
    function ensureContainerExists() {
        let container = document.getElementById(config.containerId);
        
        if (!container) {
            console.log('%c[Discussion Repair] Container not found, creating it', 'color: #FF5722');
            
            container = document.createElement('div');
            container.id = config.containerId;
            container.className = 'discussions-container';
            container.style.border = '1px solid #ddd';
            container.style.borderRadius = '4px';
            container.style.margin = '20px 0';
            container.style.padding = '15px';
            
            // Find best place to insert the container
            const mainContent = document.querySelector('main') || 
                                document.querySelector('.content') || 
                                document.querySelector('.container');
            
            if (mainContent) {
                mainContent.appendChild(container);
            } else {
                // Last resort - add to body
                document.body.appendChild(container);
            }
            
            console.log('%c[Discussion Repair] Container created', 'color: #FF5722');
        } else {
            console.log('%c[Discussion Repair] Container exists, no need to create it', 'color: #FF5722');
        }
    }
    
    function checkAndRepairHandler() {
        // Fix WebSocket issues before proceeding
        fixWebSocketIssues();
        
        // Check if handler exists
        if (!window.discussionHandler) {
            console.log('%c[Discussion Repair] discussionHandler not found, creating fallback', 'color: #FF5722');
            createFallbackHandler();
        } else if (!window.discussionHandler.loadDiscussions) {
            console.log('%c[Discussion Repair] discussionHandler exists but loadDiscussions method is missing', 'color: #FF5722');
            patchHandlerMethods();
        } else {
            console.log('%c[Discussion Repair] discussionHandler seems valid, trying to load discussions', 'color: #FF5722');
            setTimeout(() => {
                try {
                    window.discussionHandler.loadDiscussions();
                } catch (e) {
                    console.error('%c[Discussion Repair] Error when loading discussions:', 'color: #FF5722', e);
                    createFallbackHandler();
                }
            }, 500);
        }
    }
    
    function fixWebSocketIssues() {
        console.log('%c[Discussion Repair] Checking for WebSocket issues', 'color: #FF5722');
        
        // Disable WebSocket manager if it's causing errors
        if (window.WebSocketManager && window.WebSocketManager.prototype) {
            console.log('%c[Discussion Repair] Patching WebSocketManager', 'color: #FF5722');
            
            const originalConnect = window.WebSocketManager.prototype.connect;
            window.WebSocketManager.prototype.connect = function() {
                if (window.location.protocol === 'https:' && this.url && this.url.startsWith('ws://')) {
                    console.log('%c[Discussion Repair] Preventing insecure WebSocket connection on HTTPS', 'color: #FF5722');
                    return; // Skip connection
                }
                
                // Skip connection to placeholder URLs
                if (this.url && this.url.includes('your-server-url')) {
                    console.log('%c[Discussion Repair] Skipping connection to placeholder URL', 'color: #FF5722');
                    return;
                }
                
                return originalConnect.apply(this, arguments);
            };
        }
        
        // Fix any existing socket managers
        if (window.discussionHandler && window.discussionHandler._socketManager) {
            console.log('%c[Discussion Repair] Disabling active socket manager', 'color: #FF5722');
            try {
                window.discussionHandler._socketManager.disconnect();
                window.discussionHandler._socketManager = null;
            } catch (e) {
                console.error('Error disabling socket manager:', e);
            }
        }
    }
    
    function createFallbackHandler() {
        const container = document.getElementById(config.containerId);
        if (!container) return;
        
        console.log('%c[Discussion Repair] Creating fallback handler', 'color: #FF5722');
        
        // Create mock data
        window.discussions = window.discussions || [
            { id: 'repair1', title: 'Repaired Discussion 1', content: 'This discussion was created by the repair script' },
            { id: 'repair2', title: 'Repaired Discussion 2', content: 'If you see this, it means the repair script is working' }
        ];
        
        // Clear container
        container.innerHTML = '';
        
        // Create status message
        const status = document.createElement('div');
        status.style.padding = '10px';
        status.style.marginBottom = '15px';
        status.style.backgroundColor = '#FFF9C4';
        status.style.borderLeft = '4px solid #FBC02D';
        status.textContent = 'Using repaired discussion handler (v' + config.version + ')';
        container.appendChild(status);
        
        // Render discussions
        window.discussions.forEach(discussion => {
            const item = document.createElement('div');
            item.className = 'discussion-item';
            item.style.background = '#fff';
            item.style.borderRadius = '8px';
            item.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
            item.style.padding = '15px';
            item.style.marginBottom = '10px';
            
            const title = document.createElement('h3');
            title.textContent = discussion.title;
            title.style.margin = '0 0 10px 0';
            
            const content = document.createElement('p');
            content.textContent = discussion.content;
            content.style.margin = '0';
            
            item.appendChild(title);
            item.appendChild(content);
            container.appendChild(item);
        });
        
        // Create a minimal API for compatibility
        window.discussionHandler = {
            loadDiscussions: () => {
                console.log('%c[Discussion Repair] Using fallback loadDiscussions', 'color: #FF5722');
                return true;
            },
            addDiscussion: () => {},
            addReply: () => {},
            cleanup: () => {}
        };
    }
    
    function patchHandlerMethods() {
        console.log('%c[Discussion Repair] Patching handler methods', 'color: #FF5722');
        
        window.discussionHandler = window.discussionHandler || {};
        
        window.discussionHandler.loadDiscussions = window.discussionHandler.loadDiscussions || function() {
            console.log('%c[Discussion Repair] Using patched loadDiscussions', 'color: #FF5722');
            createFallbackHandler();
            return true;
        };
        
        window.discussionHandler.addDiscussion = window.discussionHandler.addDiscussion || function() {};
        window.discussionHandler.addReply = window.discussionHandler.addReply || function() {};
        window.discussionHandler.cleanup = window.discussionHandler.cleanup || function() {};
    }
    
    function addSyncIndicator() {
        const indicator = document.createElement('div');
        indicator.style.position = 'fixed';
        indicator.style.bottom = '10px';
        indicator.style.right = '10px';
        indicator.style.backgroundColor = '#24292e';
        indicator.style.color = 'white';
        indicator.style.padding = '8px 12px';
        indicator.style.borderRadius = '4px';
        indicator.style.fontSize = '12px';
        indicator.style.zIndex = '9999';
        indicator.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        indicator.textContent = `Repair Script v${config.version}`;
        
        document.body.appendChild(indicator);
    }
})();
