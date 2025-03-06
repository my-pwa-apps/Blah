import { AuthModule } from './modules/auth/AuthModule.js';
import { DataModule } from './modules/data/DataModule.js';
import { UIModule } from './modules/ui/UIModule.js';
import { LoggerModule } from './modules/utils/LoggerModule.js';

class AppManager {
    constructor() {
        this.modules = new Map();
        this.logger = new LoggerModule();
    }

    async init() {
        try {
            // Initialize core modules
            await this.initModule('auth', new AuthModule(this));
            await this.initModule('data', new DataModule(this));
            await this.initModule('ui', new UIModule(this));
            
            // Setup auth state monitoring
            this.modules.get('auth').onAuthStateChange(this.handleAuthChange.bind(this));
            
            this.logger.log('Application initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize application:', error);
        }
    }

    async initModule(name, module) {
        try {
            await module.init();
            this.modules.get(name)?.cleanup?.();
            this.modules.set(name, module);
            this.logger.log(`Module '${name}' initialized`);
        } catch (error) {
            this.logger.error(`Failed to initialize module '${name}':`, error);
            throw error;
        }
    }

    async handleAuthChange(user) {
        try {
            if (user) {
                this.logger.log('User authenticated:', user.email);
                
                const dataModule = this.modules.get('data');
                const uiModule = this.modules.get('ui');
                
                // Get or create user profile
                let profile = await dataModule.fetchUserProfile(user.id);
                if (!profile) {
                    profile = await dataModule.createUserProfile({
                        id: user.id,
                        email: user.email,
                        display_name: user.email.split('@')[0],
                        status: 'Available'
                    });
                }
                
                // Initialize UI with user data
                uiModule.showMainApp(profile);
                uiModule.renderConversationsList();
            } else {
                this.logger.log('User signed out');
                this.modules.get('ui').showAuthScreen();
            }
        } catch (error) {
            this.logger.error('Auth state change error:', error);
        }
    }

    getModule(name) {
        return this.modules.get(name);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new AppManager();
    app.init();
    
    // Make app instance available for debugging
    window.app = app;
});
