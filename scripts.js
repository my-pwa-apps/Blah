// Register service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful');
            })
            .catch(error => {
                console.log('ServiceWorker registration failed: ', error);
            });
    });
}

// Helper function to check online status
function updateOnlineStatus() {
    const statusIndicator = document.getElementById('status');
    if (navigator.onLine) {
        statusIndicator.textContent = 'Online';
        statusIndicator.classList.remove('offline');
    } else {
        statusIndicator.textContent = 'Offline';
        statusIndicator.classList.add('offline');
    }
}

// Listen for online/offline events
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// Message handling
const messageContainer = document.getElementById('message-container');
const messageInput = document.getElementById('message-text');
const sendButton = document.getElementById('send-button');

// Load messages from local storage
let messages = JSON.parse(localStorage.getItem('messages')) || [];
renderMessages();

// Send message function
function sendMessage() {
    const text = messageInput.value.trim();
    if (text) {
        const message = {
            text,
            type: 'sent',
            timestamp: new Date().getTime()
        };
        messages.push(message);
        saveMessages();
        renderMessages();
        messageInput.value = '';
        
        // Simulate received message after a short delay (for demo purposes)
        setTimeout(() => {
            const reply = {
                text: `Reply to "${text}"`,
                type: 'received',
                timestamp: new Date().getTime()
            };
            messages.push(reply);
            saveMessages();
            renderMessages();
        }, 1000);
    }
}

// Save messages to local storage
function saveMessages() {
    localStorage.setItem('messages', JSON.stringify(messages));
}

// Render all messages
function renderMessages() {
    messageContainer.innerHTML = '';
    messages.forEach(message => {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.type}`;
        messageElement.textContent = message.text;
        messageContainer.appendChild(messageElement);
    });
    
    // Scroll to the bottom
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

// Event listeners
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});
