class WebSocketManager {
    constructor(config) {
        this.url = config.url;
        this.onMessage = config.onMessage;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.ws = null;
        this.connect();
    }

    connect() {
        try {
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
        setTimeout(() => this.connect(), 3000 * this.reconnectAttempts);
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
