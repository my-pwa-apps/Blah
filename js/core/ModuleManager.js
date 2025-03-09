import { AuthModule } from '../modules/auth/AuthModule.js';
import { DataModule } from '../modules/data/DataModule.js';
import { UIModule } from '../modules/ui/UIModule.js';
import { NotificationModule } from '../modules/notification/NotificationModule.js';
import { StorageFixerModule } from '../modules/data/StorageFixerModule.js';
import { StorageManager } from '../modules/data/storage/StorageManager.js';

export class ModuleManager {
    constructor(app) {
        this.app = app;
        this.modules = new Map();
        this.moduleDefinitions = [
            { name: 'auth', Class: AuthModule },
            { name: 'data', Class: DataModule },
            { name: 'notification', Class: NotificationModule },
            { name: 'storageFixer', Class: StorageFixerModule },
            { name: 'storage', Class: StorageManager }, // Add the storage manager
            { name: 'ui', Class: UIModule } // UI should be initialized last
        ];
    }

    async initializeAll() {
        for (const def of this.moduleDefinitions) {
            await this.initializeModule(def.name, def.Class);
        }
    }

    async initializeModule(name, ModuleClass) {
        try {
            // Cleanup existing module if present
            await this.modules.get(name)?.cleanup();
            
            // Initialize new module
            const module = new ModuleClass(this.app);
            await module.init();
            
            this.modules.set(name, module);
            this.app.logger.info(`Module '${name}' initialized`);
        } catch (error) {
            this.app.logger.error(`Failed to initialize module '${name}':`, error);
            throw error;
        }
    }

    get(name) {
        return this.modules.get(name);
    }

    async cleanup() {
        for (const [name, module] of this.modules) {
            try {
                await module.cleanup();
            } catch (error) {
                this.app.logger.error(`Error cleaning up module '${name}':`, error);
            }
        }
        this.modules.clear();
    }
}
