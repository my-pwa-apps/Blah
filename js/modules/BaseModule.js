export class BaseModule {
    constructor(app) {
        this.app = app;
        this.logger = app.logger;
    }

    async init() {
        throw new Error('Module must implement init method');
    }

    cleanup() {
        // Optional cleanup method
    }
    
    getModule(name) {
        return this.app.getModule(name);
    }
}
