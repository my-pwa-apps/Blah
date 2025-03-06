import { AppCore } from './core/AppCore.js';

class App {
    static async bootstrap() {
        try {
            const app = new AppCore();
            await app.init();
            
            // Register service worker with corrected path
            if ('serviceWorker' in navigator) {
                try {
                    // Get the base path from the current URL
                    const basePath = new URL(window.location.href).pathname;
                    const swPath = `${basePath}service-worker.js`.replace('//', '/');
                    
                    const registration = await navigator.serviceWorker.register(swPath, {
                        scope: basePath
                    });
                    console.log('ServiceWorker registration successful with scope:', registration.scope);
                } catch (error) {
                    // Non-critical error - app can still function without SW
                    console.warn('ServiceWorker registration failed:', error);
                }
            }
            
            return app;
        } catch (error) {
            console.error('Failed to initialize application:', error);
            throw error;
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.bootstrap());
