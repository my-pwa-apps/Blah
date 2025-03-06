/**
 * GitHub Sync Indicator
 * Provides a visual indicator showing if GitHub Pages sync is working
 */
(function() {
    // Configuration
    const version = "1.0.0"; // Change this with every update
    const buildTime = new Date().toISOString();
    
    // Create and insert the indicator into the DOM
    function createSyncIndicator() {
        // Only create if it doesn't exist yet
        if (document.getElementById('github-sync-indicator')) return;
        
        // Create the indicator elements
        const indicator = document.createElement('div');
        indicator.id = 'github-sync-indicator';
        indicator.className = 'github-sync-indicator';
        indicator.innerHTML = `
            <span class="sync-status-icon sync-status-active" id="syncStatusIcon"></span>
            <span id="syncStatus">GitHub Sync: Active</span>
            <span class="sync-timestamp" id="syncTimestamp">Last update: ${new Date().toLocaleString()}</span>
        `;
        
        // Add styles
        const styles = document.createElement('style');
        styles.textContent = `
            .github-sync-indicator {
                position: fixed;
                top: 0;
                right: 0;
                background: #24292e;
                color: white;
                padding: 8px 15px;
                font-size: 14px;
                border-bottom-left-radius: 8px;
                z-index: 9999;
                display: flex;
                align-items: center;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }
            
            .sync-status-icon {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                margin-right: 8px;
            }
            
            .sync-status-active {
                background-color: #2cbe4e;
                box-shadow: 0 0 8px #2cbe4e;
                animation: pulse 1.5s infinite;
            }
            
            .sync-status-inactive {
                background-color: #cb2431;
            }
            
            .sync-timestamp {
                font-size: 12px;
                margin-left: 8px;
                opacity: 0.8;
            }
            
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
        `;
        
        // Add to the document
        document.head.appendChild(styles);
        document.body.appendChild(indicator);
        
        // Add version to console
        console.log(`%cGitHub Sync Indicator | Version: ${version} | Build: ${buildTime}`, 
            'background: #24292e; color: white; padding: 5px 10px; border-radius: 3px;');
    }
    
    // Initialize when the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createSyncIndicator);
    } else {
        createSyncIndicator();
    }
})();
