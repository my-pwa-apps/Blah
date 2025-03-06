export class StateManager {
    constructor() {
        this.state = this.loadInitialState();
        this.listeners = new Map();
        
        // Setup persistence
        window.addEventListener('beforeunload', () => this.persistState());
    }

    loadInitialState() {
        const defaultState = {
            currentUser: null,
            currentConversation: null,
            theme: this.detectPreferredTheme(),
            isOnline: navigator.onLine,
            isVisible: document.visibilityState === 'visible',
            notifications: {
                enabled: 'Notification' in window && Notification.permission === 'granted',
                unreadCount: 0
            }
        };

        try {
            const stored = localStorage.getItem('app_state');
            return stored ? { ...defaultState, ...JSON.parse(stored) } : defaultState;
        } catch (error) {
            console.error('Failed to load state:', error);
            return defaultState;
        }
    }

    detectPreferredTheme() {
        const stored = localStorage.getItem('theme');
        if (stored) return stored;
        
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 
            'dark' : 'light';
    }

    persistState() {
        try {
            const persistedState = {
                theme: this.state.theme,
                notifications: this.state.notifications
            };
            localStorage.setItem('app_state', JSON.stringify(persistedState));
        } catch (error) {
            console.error('Failed to persist state:', error);
        }
    }

    // ...existing get/set/subscribe methods...
}
