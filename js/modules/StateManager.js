export class StateManager {
    constructor() {
        this.state = {
            currentUser: null,
            currentConversation: null,
            theme: localStorage.getItem('theme') || 'light',
            isOnline: navigator.onLine
        };
        this.listeners = new Map();
    }

    get(key) {
        return this.state[key];
    }

    set(key, value) {
        const oldValue = this.state[key];
        this.state[key] = value;
        
        if (oldValue !== value) {
            this.notify(key, value, oldValue);
        }
    }

    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key).add(callback);
        
        // Return unsubscribe function
        return () => this.listeners.get(key)?.delete(callback);
    }

    notify(key, newValue, oldValue) {
        this.listeners.get(key)?.forEach(callback => {
            try {
                callback(newValue, oldValue);
            } catch (error) {
                console.error(`Error in state listener for ${key}:`, error);
            }
        });
    }
}
