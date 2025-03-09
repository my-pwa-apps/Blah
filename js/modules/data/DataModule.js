import { BaseModule } from '../BaseModule.js';
import { FIREBASE_CONFIG } from '../../config.js';

export class DataModule extends BaseModule {
    constructor(app) {
        super(app);
        this.firebase = null;
        this.db = null;
        this.connectionStatus = 'CONNECTING';
        this.activeListeners = new Map();
    }

    async init() {
        try {
            this.firebase = window.firebase.initializeApp(FIREBASE_CONFIG);
            this.db = window.firebase.getDatabase(this.firebase);
            
            // Monitor connection status
            const connectedRef = this.db.ref('.info/connected');
            connectedRef.on('value', (snap) => {
                this.connectionStatus = snap.val() ? 'CONNECTED' : 'DISCONNECTED';
                this.logger.info(`Database connection status: ${this.connectionStatus}`);
            });
            
            this.logger.info('DataModule initialized with Firebase Realtime Database');
        } catch (error) {
            this.logger.error('Failed to initialize Firebase:', error);
            this.connectionStatus = 'ERROR';
            throw error;
        }
    }

    // ...existing methods...

    cleanup() {
        // Unsubscribe from all active listeners
        for (const [key, unsubscribe] of this.activeListeners.entries()) {
            this.logger.info(`Cleaning up listener: ${key}`);
            unsubscribe();
        }
        this.activeListeners.clear();
    }
}
