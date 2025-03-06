import { AppCore } from './core/AppCore.js';

class App {
    static async bootstrap() {
        try {
            const app = new AppCore();
            await app.init();
            
            // Register service worker with corrected path
            if ('serviceWorker' in navigator) {
                try {
                    const registration = await navigator.serviceWorker.register('/service-worker.js', {
                        scope: '/Blah/'
                    });
                    console.log('ServiceWorker registration successful:', registration.scope);
                } catch (error) {
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
