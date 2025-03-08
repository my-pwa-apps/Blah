import { APP_CONFIG } from './config.js';

// Register service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful');
            })
            .catch(error => {
                console.log('ServiceWorker registration failed: ', error);
            });
    });
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Import and initialize modules dynamically
    Promise.all([
        import('./js/app.js'),
        import('./js/ui.js')
    ]).then(([app, ui]) => {
        app.default();
        ui.initUI();
    }).catch(error => {
        console.error('Error loading modules:', error);
    });
});
