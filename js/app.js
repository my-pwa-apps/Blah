import { AppCore } from './core/AppCore.js';

class App {
    static async bootstrap() {
        try {
            const app = new AppCore();
            await app.init();
            
            // Register service worker with corrected path
            if ('serviceWorker' in navigator) {
                try {
                    // Get the base path for GitHub Pages
                    const basePath = '/Blah';
                    const swPath = `${basePath}/service-worker.js`;
                    
                    const registration = await navigator.serviceWorker.register(swPath, {
                        scope: basePath
                    });
                    console.log('ServiceWorker registration successful:', registration.scope);
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

document.addEventListener('DOMContentLoaded', () => App.bootstrap());
