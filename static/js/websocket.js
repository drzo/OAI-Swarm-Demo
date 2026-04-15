class SwarmWebSocket {
    constructor() {
        this.connect();
        this.onUpdateCallbacks = [];
        this.onMessageCallbacks = [];
        this.lastUpdateTime = performance.now();
        this.updateCount = 0;
        this.connectionRetries = 0;
        this.maxRetries = 5;
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
        
        this.ws.onopen = () => {
            console.log('Connected to swarm server');
            document.querySelector('.status-indicator').style.color = '#0f0';
            this.connectionRetries = 0;
        };

        this.ws.onclose = () => {
            console.log('Disconnected from swarm server');
            document.querySelector('.status-indicator').style.color = '#f00';
            
            // Attempt to reconnect with exponential backoff
            if (this.connectionRetries < this.maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, this.connectionRetries), 10000);
                this.connectionRetries++;
                setTimeout(() => this.connect(), delay);
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'state_update') {
                    const now = performance.now();
                    this.updateCount++;
                    
                    // Validate agent data
                    if (!Array.isArray(data.agents)) {
                        console.error('Invalid agent data received:', data);
                        return;
                    }

                    // Log update statistics every 100 updates
                    if (this.updateCount % 100 === 0) {
                        const timeDiff = now - this.lastUpdateTime;
                        const fps = 1000 / (timeDiff / 100);
                        console.log(`Receiving updates at ${fps.toFixed(1)} FPS`);
                        console.log(`Active agents: ${data.agents.length}`);
                        if (data.agents.length > 0) {
                            console.log(`Sample agent position:`, data.agents[0]);
                        }
                        this.lastUpdateTime = now;
                    }
                    
                    // Sync displayed agent count with actual simulation count
                    const agentCountValueEl = document.getElementById('agentCountValue');
                    if (agentCountValueEl) {
                        agentCountValueEl.textContent = data.agents.length;
                    }

                    // Update renderer with error handling
                    if (window.swarmRenderer) {
                        try {
                            window.swarmRenderer.updateAgents(data.agents);
                        } catch (error) {
                            console.error('Error updating renderer:', error);
                        }
                    }
                    
                    // Call all update callbacks with error handling
                    this.onUpdateCallbacks.forEach(callback => {
                        try {
                            callback(data);
                        } catch (error) {
                            console.error('Error in update callback:', error);
                        }
                    });
                } else {
                    // Handle other message types
                    this.onMessageCallbacks.forEach(callback => {
                        try {
                            callback(data);
                        } catch (error) {
                            console.error('Error in message callback:', error);
                        }
                    });
                }
            } catch (error) {
                console.error('Error processing websocket message:', error);
            }
        };
    }

    send(message) {
        if (this.ws.readyState === WebSocket.OPEN) {
            try {
                console.log('Sending message:', message);
                this.ws.send(JSON.stringify(message));
            } catch (error) {
                console.error('Error sending message:', error);
            }
        } else {
            console.warn('WebSocket is not open, message not sent:', message);
        }
    }

    onUpdate(callback) {
        if (typeof callback === 'function') {
            this.onUpdateCallbacks.push(callback);
        }
    }

    onMessage(callback) {
        if (typeof callback === 'function') {
            this.onMessageCallbacks.push(callback);
        }
    }
}

// Initialize WebSocket connection
window.swarmWS = new SwarmWebSocket();
