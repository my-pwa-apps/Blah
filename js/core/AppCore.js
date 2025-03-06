import { ModuleManager } from './ModuleManager.js';
import { StateManager } from './state/StateManager.js';
import { Logger } from './utils/Logger.js';

export class AppCore {
    constructor() {
        this.logger = new Logger();
        this.state = new StateManager();
        this.modules = new ModuleManager(this);
    }

    async init() {
        try {
            await this.modules.initializeAll();
            this._setupGlobalEvents();
            
            // Request notification permission
            if ('Notification' in window && Notification.permission === 'default') {
                await Notification.requestPermission();
            }
            
            this.logger.info('Application initialized successfully');
        } catch (error) {
            this.logger.error('Initialization failed:', error);
            throw error;
        }
    }

    // Changed from private to regular method with underscore prefix
    _setupGlobalEvents() {
        // Handle online/offline status
        window.addEventListener('online', () => {
            this.state.set('isOnline', true);
            this.modules.get('ui').showOnlineStatus(true);
        });
        
        window.addEventListener('offline', () => {
            this.state.set('isOnline', false);
            this.modules.get('ui').showOnlineStatus(false);
        });

        // Handle visibility changes
        document.addEventListener('visibilitychange', () => {
            this.state.set('isVisible', document.visibilityState === 'visible');
        });
    }

    getModule(name) {
        return this.modules.get(name);
    }
}
