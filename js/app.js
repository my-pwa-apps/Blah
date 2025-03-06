import { AppCore } from './core/AppCore.js';

class App {
    static async bootstrap() {
        try {
            const app = new AppCore();
            await app.init();
            
            // Register service worker
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('ServiceWorker registered:', registration.scope);
            }
            
            // Store app instance for debugging only in development
            if (process.env.NODE_ENV === 'development') {
                window.app = app;
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
