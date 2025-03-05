/**
 * Discussion Debugger
 * Helps troubleshoot issues with the discussion handler
 */
console.log('%c[DiscussionDebugger] Script loading', 'color: #8B008B; font-weight: bold');

window.discussionDebugger = (function() {
    console.log('%c[DiscussionDebugger] Inside IIFE', 'color: #8B008B; font-weight: bold');
    
    function init() {
        console.log('%c[DiscussionDebugger] Initializing', 'color: #8B008B; font-weight: bold');
        
        // Run diagnostics immediately
        setTimeout(diagnose, 0);
        
        return {
            diagnose,
            inspectDOM,
            checkDataSources,
            testDiscussionRendering
        };
    }
    
    /**
     * Run a full diagnostic on the discussion system
     */
    function diagnose() {
        console.log('%c[DiscussionDebugger] Running diagnostics...', 'color: #8B008B');
        
        // Check environment
        console.log('User Agent:', navigator.userAgent);
        console.log('Window Size:', window.innerWidth, 'x', window.innerHeight);
        
        // Check DOM
        inspectDOM();
        
        // Check data sources
        checkDataSources();
        
        // Check discussion handler
        if (window.discussionHandler) {
            console.log('Discussion handler is present in window');
            console.log('Discussion handler type:', typeof window.discussionHandler);
            console.log('Has loadDiscussions method:', Boolean(window.discussionHandler.loadDiscussions));
        } else {
            console.error('Discussion handler not found on window object');
        }
        
        // Test rendering
        testDiscussionRendering();
        
        console.log('%c[DiscussionDebugger] Diagnostics complete', 'color: #8B008B; font-weight: bold');
    }
    
    /**
     * Inspect the DOM for discussion-related elements
     */
    function inspectDOM() {
        console.log('%c[DiscussionDebugger] Inspecting DOM', 'color: #8B008B');
        
        const container = document.getElementById('discussions-container');
        
        if (!container) {
            console.error('No discussions container found in DOM');
            return;
        }
        
        console.log('Container details:', {
            id: container.id,
            className: container.className,
            visibility: window.getComputedStyle(container).visibility,
            display: window.getComputedStyle(container).display,
            childCount: container.childNodes.length
        });
        
        // Check if the container is actually visible in the viewport
        const rect = container.getBoundingClientRect();
        console.log('Container position:', {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            inViewport: (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= window.innerHeight &&
                rect.right <= window.innerWidth
            )
        });
    }
    
    /**
     * Check all possible data sources for discussions
     */
    function checkDataSources() {
        console.log('%c[DiscussionDebugger] Checking data sources', 'color: #8B008B');
        
        // Check window property
        if (window.discussions !== undefined) {
            console.log('window.discussions exists:', {
                type: typeof window.discussions,
                isArray: Array.isArray(window.discussions),
                length: Array.isArray(window.discussions) ? window.discussions.length : 'N/A',
                sample: Array.isArray(window.discussions) && window.discussions.length > 0 ? 
                    JSON.stringify(window.discussions[0]).substring(0, 100) + '...' : 'N/A'
            });
        } else {
            console.log('window.discussions is undefined');
        }
        
        // Check global variable
        if (typeof discussions !== 'undefined') {
            console.log('global discussions exists:', {
                type: typeof discussions,
                isArray: Array.isArray(discussions),
                length: Array.isArray(discussions) ? discussions.length : 'N/A',
                sample: Array.isArray(discussions) && discussions.length > 0 ? 
                    JSON.stringify(discussions[0]).substring(0, 100) + '...' : 'N/A'
            });
        } else {
            console.log('global discussions is undefined');
        }
        
        // Check data attributes
        const container = document.getElementById('discussions-container');
        if (container) {
            const dataAttr = container.getAttribute('data-discussions');
            if (dataAttr) {
                console.log('data-discussions attribute found:', dataAttr.substring(0, 100) + '...');
                try {
                    const parsed = JSON.parse(dataAttr);
                    console.log('data-discussions parsed successfully:', {
                        type: typeof parsed,
                        isArray: Array.isArray(parsed),
                        length: Array.isArray(parsed) ? parsed.length : 'N/A'
                    });
                } catch (e) {
                    console.error('Failed to parse data-discussions attribute:', e);
                }
            } else {
                console.log('No data-discussions attribute found');
            }
        }
    }
    
    /**
     * Test rendering a simple discussion item
     */
    function testDiscussionRendering() {
        console.log('%c[DiscussionDebugger] Testing discussion rendering', 'color: #8B008B');
        
        const container = document.getElementById('discussions-container');
        if (!container) {
            console.error('Cannot test rendering - no container found');
            return;
        }
        
        try {
            // Create a test discussion element
            const testDiv = document.createElement('div');
            testDiv.className = 'discussion-debug-test';
            testDiv.textContent = 'Debug Test Discussion';
            testDiv.style.padding = '10px';
            testDiv.style.margin = '10px';
            testDiv.style.border = '2px dashed #8B008B';
            
            console.log('Test element created successfully');
            
            // Try to append to the container
            try {
                container.appendChild(testDiv);
                console.log('Test element successfully appended to container');
            } catch (e) {
                console.error('Failed to append test element to container:', e);
            }
        } catch (e) {
            console.error('Failed to create test element:', e);
        }
    }
    
    return init();
})();

// Run diagnostics immediately
console.log('%c[DiscussionDebugger] Running immediate diagnose', 'color: #8B008B; font-weight: bold');
try {
    // Force DOM test regardless of other code
    const container = document.getElementById('discussions-container');
    console.log('%c[DiscussionDebugger] Container check:', 'color: #8B008B', container);
    
    if (container) {
        const emergencyTest = document.createElement('div');
        emergencyTest.textContent = 'EMERGENCY DEBUG TEST';
        emergencyTest.style.background = 'purple';
        emergencyTest.style.color = 'white';
        emergencyTest.style.padding = '5px';
        emergencyTest.style.margin = '5px';
        container.appendChild(emergencyTest);
        console.log('%c[DiscussionDebugger] Emergency append test successful', 'color: green; font-weight: bold');
    }
} catch (e) {
    console.error('%c[DiscussionDebugger] CRITICAL ERROR in emergency test:', 'color: red; background: yellow', e);
}
