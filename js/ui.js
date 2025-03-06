import { signIn, signUp, signOut } from './auth.js';
import { 
    fetchConversations, 
    fetchMessages, 
    sendMessage, 
    searchUsers, 
    createConversation 
} from './db.js';

let currentUser = null;
let currentConversation = null;
let authInProgress = false;

export function initUI() {
    // ... existing auth listeners ...

    // Initialize UI components
    setupAuthListeners();
    setupMessageListeners();
    setupProfileListeners();
    setupConversationListeners();
    setupResponsiveListeners();
}

function setupAuthListeners() {
    const loginBtn = document.getElementById('login-button');
    const signupBtn = document.getElementById('signup-button');
    const logoutBtn = document.getElementById('logout-button');
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');

    signupBtn.addEventListener('click', async () => {
        if (authInProgress) return;
        
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (!email || !password) {
            showError('Please enter both email and password');
            return;
        }
        
        try {
            authInProgress = true;
            signupBtn.disabled = true;
            loginBtn.disabled = true;
            
            const { data } = await signUp(email, password);
            if (data) {
                showMessage('Sign up successful! Please check your email for verification.');
                // Clear the form
                emailInput.value = '';
                passwordInput.value = '';
            }
        } catch (error) {
            showError(error.message);
        } finally {
            authInProgress = false;
            signupBtn.disabled = false;
            loginBtn.disabled = false;
        }
    });

    loginBtn.addEventListener('click', async () => {
        if (authInProgress) return;
        
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (!email || !password) {
            showError('Please enter both email and password');
            return;
        }
        
        try {
            authInProgress = true;
            loginBtn.disabled = true;
            signupBtn.disabled = true;
            
            await signIn(email, password);
        } catch (error) {
            showError('Login failed: ' + error.message);
        } finally {
            authInProgress = false;
            loginBtn.disabled = false;
            signupBtn.disabled = false;
        }
    });

    // Handle Enter key in password field
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loginBtn.click();
        }
    });
}

// ... add other UI setup functions ...

export function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'auth-error';
    errorDiv.textContent = message;
    
    // Remove any existing error
    const existingError = document.querySelector('.auth-error');
    if (existingError) {
        existingError.remove();
    }
    
    // Insert error after the auth form
    const authForm = document.querySelector('.auth-form');
    authForm.insertAdjacentElement('afterend', errorDiv);
    
    // Remove error after 5 seconds
    setTimeout(() => errorDiv.remove(), 5000);
}

export function showMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'auth-message';
    messageDiv.textContent = message;
    
    // Remove any existing message
    const existingMessage = document.querySelector('.auth-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Insert message after the auth form
    const authForm = document.querySelector('.auth-form');
    authForm.insertAdjacentElement('afterend', messageDiv);
    
    // Remove message after 5 seconds
    setTimeout(() => messageDiv.remove(), 5000);
}

export function showLoading(show = true) {
    // Implement loading state
}

export function showAuthScreen() {
    document.getElementById('auth-container').classList.remove('hidden');
    document.getElementById('app-content').classList.add('hidden');
}

export function showMainApp(profile) {
    currentUser = profile;
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('app-content').classList.remove('hidden');
    document.getElementById('profile-image').src = profile.avatar_url || 'images/default-avatar.png';
}

export async function renderConversationsList() {
    const conversationsList = document.getElementById('conversations-list');
    conversationsList.innerHTML = '';
    
    try {
        const conversations = await fetchConversations(currentUser.id);
        
        conversations.forEach(conversation => {
            const otherParticipants = conversation.participants
                .filter(p => p.user_id !== currentUser.id)
                .map(p => p.profiles);
            
            const conversationEl = document.createElement('div');
            conversationEl.className = 'conversation-item';
            conversationEl.innerHTML = `
                <div class="conversation-avatar">
                    <img src="${otherParticipants[0]?.avatar_url || 'images/default-avatar.png'}" alt="Avatar">
                </div>
                <div class="conversation-details">
                    <div class="conversation-name">${otherParticipants[0]?.display_name || 'Unknown User'}</div>
                    <div class="conversation-last-message">${conversation.last_message?.content || 'No messages yet'}</div>
                </div>
            `;
            
            conversationEl.addEventListener('click', () => loadConversation(conversation.id));
            conversationsList.appendChild(conversationEl);
        });
    } catch (error) {
        showError('Failed to load conversations');
        console.error(error);
    }
}

async function loadConversation(conversationId) {
    currentConversation = conversationId;
    const messageContainer = document.getElementById('message-container');
    messageContainer.innerHTML = '';
    
    try {
        const messages = await fetchMessages(conversationId);
        renderMessages(messages);
        
        // Show chat area on mobile
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('active');
            document.getElementById('back-button').classList.remove('hidden');
        }
    } catch (error) {
        showError('Failed to load messages');
        console.error(error);
    }
}

function renderMessages(messages) {
    const messageContainer = document.getElementById('message-container');
    
    messages.forEach(message => {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${message.sender_id === currentUser.id ? 'sent' : 'received'}`;
        messageEl.innerHTML = `
            <div class="message-content">${message.content}</div>
            <div class="message-info">
                ${new Date(message.created_at).toLocaleTimeString()}
            </div>
        `;
        messageContainer.appendChild(messageEl);
    });
    
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

// ... add other UI utility functions ...
