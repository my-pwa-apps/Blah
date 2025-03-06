/**
 * GitHub Sync Indicator
 * Provides a visual indicator showing if GitHub Pages sync is working
 */
(function() {
    // Configuration
    const version = "1.0.3"; // Change this with every update
    const buildTime = new Date().toISOString();
    const debugMode = false; // Set to false for production
    
    // Create and insert the indicator into the DOM
    function createSyncIndicator() {
        // Skip if not in debug mode
        if (!debugMode && !isDebugModeActive()) return;
        
        // Only create if it doesn't exist yet
        if (document.getElementById('github-sync-indicator')) return;
        
        // Create the indicator elements
        const indicator = document.createElement('div');
        indicator.id = 'github-sync-indicator';
        indicator.className = 'github-sync-indicator';
        indicator.style.position = 'fixed';
        indicator.style.bottom = '10px';
        indicator.style.right = '10px';
        indicator.style.background = 'rgba(36, 41, 46, 0.8)';
        indicator.style.color = 'white';
        indicator.style.padding = '5px 10px';
        indicator.style.fontSize = '12px';
        indicator.style.borderRadius = '4px';
        indicator.style.zIndex = '9999';
        indicator.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        indicator.textContent = `Sync v${version}`;
        
        // Add to the document
        document.body.appendChild(indicator);
        
        // Add version to console
        console.log(`GitHub Sync Indicator | Version: ${version} | Build: ${buildTime}`);
    }
    
    // Check if debug mode is active
    function isDebugModeActive() {
        return document.body.classList.contains('debug-mode');
    }
    
    // Initialize when the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createSyncIndicator);
    } else {
        createSyncIndicator();
    }
    
    // Re-check when debug mode changes
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            setTimeout(createSyncIndicator, 100);
        }
    });
})();
