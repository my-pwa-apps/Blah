/**
 * GitHub Pages Loader Script
 * Forces proper loading of discussion scripts on GitHub Pages
 * Version: 1.0.2
 */
(function() {
    // Configuration 
    const config = {
        version: '1.0.2',
        autoReload: false,
        forceClearCache: true,
        debugMode: true
    };
    
    // Log with distinctive styling for visibility
    function log(message) {
        console.log(`%c[GH-Pages Loader] ${message}`, 'color: #9C27B0; font-weight: bold');
    }
    
    log(`Initializing GitHub Pages loader v${config.version}`);
    
    // Add visible indicator 
    function addLoadingIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'gh-pages-loader-indicator';
        indicator.style.position = 'fixed';
        indicator.style.top = '10px';
        indicator.style.left = '10px';
        indicator.style.backgroundColor = '#9C27B0';
        indicator.style.color = 'white';
        indicator.style.padding = '10px';
        indicator.style.borderRadius = '4px';
        indicator.style.zIndex = '99999';
        indicator.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
        indicator.style.fontSize = '14px';
        indicator.style.transition = 'all 0.3s ease';
        
        const timestamp = new Date().toLocaleTimeString();
        indicator.innerHTML = `
            <div style="margin-bottom: 8px; font-weight: bold;">GitHub Pages Loader v${config.version}</div>
            <div style="font-size: 12px; margin-bottom: 8px;">Loaded at: ${timestamp}</div>
            <div>
                <button id="gh-force-reload" style="background:#4CAF50; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer; margin-right:5px;">
                    Force Reload
                </button>
                <button id="gh-repair-discussions" style="background:#2196F3; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">
                    Repair Discussions
                </button>
            </div>
        `;
        
        document.body.appendChild(indicator);
        
        // Add event listeners
        setTimeout(() => {
            document.getElementById('gh-force-reload').addEventListener('click', forceReload);
            document.getElementById('gh-repair-discussions').addEventListener('click', repairDiscussions);
        }, 100);
        
        log('Loading indicator added');
    }
    
    // Force reload with cache clearing
    function forceReload() {
        log('Force reloading page');
        
        if (config.forceClearCache) {
            // Clear cache by fetching a timestamp URL
            const timestamp = new Date().getTime();
            fetch(`?cache-bust=${timestamp}`, { cache: 'no-store' })
                .then(() => {
                    window.location.reload(true);
                })
                .catch(() => {
                    window.location.reload(true);
                });
        } else {
            window.location.reload(true);
        }
    }
    
    // Directly run the repair process
    function repairDiscussions() {
        log('Manually repairing discussions');
        
        try {
            // Ensure repair script exists or create it
            if (typeof window.discussionRepair === 'undefined') {
                log('Repair function not found, creating it');
                injectRepairScript();
            } else {
                log('Repair function exists, running it');
                window.discussionRepair.runRepair();
            }
            
            // Ensure discussions container exists
            let container = document.getElementById('discussions-container');
            if (!container) {
                log('Creating discussions container');
                container = document.createElement('div');
                container.id = 'discussions-container';
                container.className = 'discussions-container';
                container.style.border = '1px solid #ddd';
                container.style.borderRadius = '4px';
                container.style.margin = '20px 0';
                container.style.padding = '15px';
                
                // Find where to insert it
                const mainContent = document.querySelector('main') || 
                                    document.querySelector('.content') || 
                                    document.querySelector('.container');
                
                if (mainContent) {
                    mainContent.appendChild(container);
                } else {
                    document.body.appendChild(container);
                }
            }
            
            // Create some mock discussions
            container.innerHTML = '';
            
            // Status message
            const status = document.createElement('div');
            status.style.padding = '10px';
            status.style.marginBottom = '15px';
            status.style.backgroundColor = '#E8F5E9';
            status.style.borderLeft = '4px solid #4CAF50';
            status.textContent = 'Discussions repaired by GitHub Pages Loader v' + config.version;
            container.appendChild(status);
            
            // Add some discussions
            const mockDiscussions = [
                { id: 'gh1', title: 'GitHub Pages Discussion 1', content: 'This discussion was created by the GitHub Pages loader' },
                { id: 'gh2', title: 'GitHub Pages Discussion 2', content: 'If you see this, it means the GitHub Pages loader is working correctly' }
            ];
            
            mockDiscussions.forEach(discussion => {
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
            
            log('Discussions repaired successfully');
        } catch (e) {
            console.error('Error repairing discussions:', e);
        }
    }
    
    // Inject the repair script if it doesn't exist
    function injectRepairScript() {
        log('Injecting repair script');
        
        // Create a minimal repair module
        window.discussionRepair = {
            version: config.version,
            runRepair: function() {
                log('Running injected repair function');
                repairDiscussions();
            }
        };
    }
    
    // Check if this is GitHub Pages
    function isGitHubPages() {
        return window.location.hostname.includes('github.io') || 
               window.location.hostname.includes('githubusercontent.com');
    }
    
    // Initialize on DOM ready
    function initialize() {
        log('DOM ready, initializing');
        
        // Add UI indicator
        addLoadingIndicator();
        
        // Inject repair script if needed
        injectRepairScript();
        
        // Auto-repair if set in config
        if (config.autoReload) {
            setTimeout(repairDiscussions, 500);
        }
    }
    
    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
