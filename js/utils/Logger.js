export class Logger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000;
    }

    info(...args) {
        this._log('INFO', ...args);
    }

    error(...args) {
        this._log('ERROR', ...args);
    }

    warn(...args) {
        this._log('WARN', ...args);
    }

    _log(level, ...args) {
        const message = this._formatMessage(level, ...args);
        this._addToLogs(message);
        
        // Console output with styling
        const style = this._getLogStyle(level);
        console.log(`%c${level}%c ${message.timestamp.toISOString()} -`, style, '', ...args);
    }

    _formatMessage(level, ...args) {
        return {
            timestamp: new Date(),
            level,
            message: args.map(arg => 
                arg instanceof Error ? 
                    { message: arg.message, stack: arg.stack } : 
                    String(arg)
            ).join(' ')
        };
    }

    _addToLogs(message) {
        this.logs.push(message);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
    }

    _getLogStyle(level) {
        const styles = {
            INFO: 'background: #2196F3; color: white; padding: 2px 6px; border-radius: 2px;',
            WARN: 'background: #FFA000; color: white; padding: 2px 6px; border-radius: 2px;',
            ERROR: 'background: #F44336; color: white; padding: 2px 6px; border-radius: 2px;'
        };
        return styles[level] || styles.INFO;
    }

    getLogs(level = null) {
        return level ? 
            this.logs.filter(log => log.level === level) : 
            [...this.logs];
    }

    clear() {
        this.logs = [];
    }
}
