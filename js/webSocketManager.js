class WebSocketManager {
    constructor(config) {
        this.url = config.url;
        this.onMessage = config.onMessage;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.ws = null;
        this.enabled = config.enabled !== false;
        
        // Only attempt connection if explicitly enabled
        if (this.enabled) {
            this.connect();
        } else {
            console.log('WebSocket connection disabled by configuration');
        }
    }

    connect() {
        try {
            // Check if we're on HTTPS and adjust protocol automatically
            if (window.location.protocol === 'https:' && this.url.startsWith('ws://')) {
                console.log('Upgrading WebSocket connection to WSS for HTTPS site');
                this.url = this.url.replace('ws://', 'wss://');
            }
            
            // Check if it's a placeholder URL and don't connect if it is
            if (this.url.includes('your-server-url')) {
                console.log('Skipping WebSocket connection to placeholder URL');
                return;
            }
            
            console.log('Connecting to WebSocket:', this.url);
            this.ws = new WebSocket(this.url);
            this.setupEventHandlers();
        } catch (error) {
            console.error('WebSocket connection failed:', error);
            this.handleReconnect();
        }
    }

    setupEventHandlers() {
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.onMessage(data);
            } catch (error) {
                console.error('Invalid message format:', error);
            }
        };

        this.ws.onclose = () => this.handleReconnect();
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.handleReconnect();
        };
    }

    handleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        // Exponential backoff for reconnection attempts
        const delay = Math.min(3000 * Math.pow(1.5, this.reconnectAttempts), 30000);
        console.log(`WebSocket reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
        setTimeout(() => this.connect(), delay);
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
