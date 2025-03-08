export class LoggerModule {
    constructor() {
        this.logs = [];
    }

    log(...args) {
        const message = this.formatMessage('INFO', ...args);
        this.logs.push(message);
        console.log(...args);
    }

    error(...args) {
        const message = this.formatMessage('ERROR', ...args);
        this.logs.push(message);
        console.error(...args);
    }

    warn(...args) {
        const message = this.formatMessage('WARN', ...args);
        this.logs.push(message);
        console.warn(...args);
    }

    formatMessage(level, ...args) {
        return {
            timestamp: new Date(),
            level,
            message: args.map(arg => 
                arg instanceof Error ? arg.stack : String(arg)
            ).join(' ')
        };
    }

    getLogs() {
        return [...this.logs];
    }
}
