import { signIn, signUp, signOut } from './auth.js';
import { 
    fetchConversations, 
    fetchMessages, 
    sendMessage, 
    searchUsers, 
    createConversation,
    updateUserProfile,
    uploadAvatar
} from './db.js';

let currentUser = null;
let currentConversation = null;
let authInProgress = false;

export function initUI() {
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

function setupMessageListeners() {
    const sendButton = document.getElementById('send-button');
    const messageInput = document.getElementById('message-text');
    const messageContainer = document.getElementById('message-container');

    // Create default self-conversation if none exists
    if (!currentConversation) {
        startSelfConversation();
    }

    sendButton.addEventListener('click', () => handleSendMessage());
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
}

function setupProfileListeners() {
    const userProfile = document.getElementById('user-profile');
    const closeProfile = document.getElementById('close-profile');
    const saveProfile = document.getElementById('save-profile');
    const avatarUpload = document.getElementById('avatar-upload');
    const logoutButton = document.getElementById('logout-button');

    userProfile.addEventListener('click', () => {
        document.getElementById('profile-modal').classList.remove('hidden');
    });

    closeProfile.addEventListener('click', () => {
        document.getElementById('profile-modal').classList.add('hidden');
    });

    saveProfile.addEventListener('click', handleProfileUpdate);
    avatarUpload.addEventListener('change', handleAvatarUpload);
    logoutButton.addEventListener('click', handleLogout);
}

function setupConversationListeners() {
    const newConversationBtn = document.getElementById('new-conversation');
    const closeNewConversation = document.getElementById('close-new-conversation');
    const userSearch = document.getElementById('user-search');
    const userSearchResults = document.getElementById('user-search-results');

    newConversationBtn.addEventListener('click', () => {
        document.getElementById('new-conversation-modal').classList.remove('hidden');
        userSearch.value = '';
        userSearchResults.innerHTML = '';
        userSearch.focus();
    });

    closeNewConversation.addEventListener('click', () => {
        document.getElementById('new-conversation-modal').classList.add('hidden');
    });

    userSearch.addEventListener('input', debounce(handleUserSearch, 300));

    // Add delegation for user selection
    userSearchResults.addEventListener('click', (e) => {
        const userItem = e.target.closest('.user-search-item');
        if (userItem) {
            const userId = userItem.dataset.userId;
            startNewConversation(userId);
        }
    });
}

function setupResponsiveListeners() {
    const backButton = document.getElementById('back-button');
    
    backButton.addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('active');
        backButton.classList.add('hidden');
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            document.getElementById('sidebar').classList.remove('active');
            backButton.classList.add('hidden');
        }
    });
}

async function handleSendMessage() {
    const messageInput = document.getElementById('message-text');
    const content = messageInput.value.trim();

    if (!content) return;

    try {
        messageInput.disabled = true;
        
        // If no conversation is selected, start a self-conversation
        if (!currentConversation) {
            const selfConversation = await createConversation([currentUser.id]);
            currentConversation = selfConversation.id;
            await renderConversationsList();
        }

        const message = await sendMessage(currentConversation, currentUser.id, content);
        messageInput.value = '';
        
        // Add the new message to the UI immediately
        const messageEl = document.createElement('div');
        messageEl.className = 'message sent';
        messageEl.innerHTML = `
            <div class="message-content">${content}</div>
            <div class="message-info">
                ${new Date().toLocaleTimeString()}
            </div>
        `;
        document.getElementById('message-container').appendChild(messageEl);
        messageEl.scrollIntoView({ behavior: 'smooth' });
        
        // Refresh conversations list to update last message
        await renderConversationsList();
    } catch (error) {
        showError('Failed to send message');
        console.error(error);
    } finally {
        messageInput.disabled = false;
        messageInput.focus();
    }
}

async function handleUserSearch() {
    const query = document.getElementById('user-search').value.trim();
    const resultsContainer = document.getElementById('user-search-results');

    // Always show self-chat option first
    resultsContainer.innerHTML = `
        <div class="user-search-item" data-user-id="${currentUser.id}">
            <div class="user-avatar">
                <img src="${currentUser.avatar_url || 'images/default-avatar.png'}" alt="Avatar">
            </div>
            <div class="user-info">
                <div class="user-name">${currentUser.display_name} (Self Chat)</div>
                <div class="user-email">${currentUser.email}</div>
            </div>
        </div>
    `;

    if (!query) return;

    try {
        const users = await searchUsers(query);
        const otherUsers = users
            .filter(user => user.id !== currentUser.id)
            .map(user => `
                <div class="user-search-item" data-user-id="${user.id}">
                    <div class="user-avatar">
                        <img src="${user.avatar_url || 'images/default-avatar.png'}" alt="Avatar">
                    </div>
                    <div class="user-info">
                        <div class="user-name">${user.display_name || user.email}</div>
                        <div class="user-email">${user.email}</div>
                    </div>
                </div>
            `).join('');
        
        resultsContainer.innerHTML += otherUsers;
    } catch (error) {
        showError('Failed to search users');
        console.error(error);
    }
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

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
            const isSelfChat = conversation.is_self_chat;
            let displayName, avatarUrl;

            if (isSelfChat) {
                displayName = 'Notes to Self';
                avatarUrl = currentUser.avatar_url;
            } else {
                // Get the other participant's profile
                const otherParticipant = conversation.participants
                    .find(p => p.user_id !== currentUser.id)?.profiles;
                
                displayName = otherParticipant?.display_name || otherParticipant?.email || 'Unknown User';
                avatarUrl = otherParticipant?.avatar_url;
            }
            
            const conversationEl = document.createElement('div');
            conversationEl.className = 'conversation-item';
            conversationEl.innerHTML = `
                <div class="conversation-avatar">
                    <img src="${avatarUrl || 'images/default-avatar.png'}" alt="Avatar">
                </div>
                <div class="conversation-details">
                    <div class="conversation-name">${displayName}</div>
                    <div class="conversation-last-message">
                        ${conversation.last_message?.content || 'No messages yet'}
                    </div>
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
    const messageInput = document.getElementById('message-text');
    const sendButton = document.getElementById('send-button');
    
    messageInput.disabled = false;
    sendButton.disabled = false;
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

async function handleProfileUpdate() {
    const displayName = document.getElementById('display-name').value.trim();
    const statusMessage = document.getElementById('status-message').value.trim();
    
    if (!displayName) {
        showError('Display name is required');
        return;
    }
    
    try {
        const updatedProfile = await updateUserProfile({
            id: currentUser.id,
            display_name: displayName,
            status: statusMessage
        });
        
        currentUser = updatedProfile;
        showMessage('Profile updated successfully');
        document.getElementById('profile-modal').classList.add('hidden');
    } catch (error) {
        showError('Failed to update profile');
        console.error(error);
    }
}

async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showError('Please select an image file');
        return;
    }
    
    try {
        const avatarUrl = await uploadAvatar(currentUser.id, file);
        document.getElementById('avatar-preview').src = avatarUrl;
        document.getElementById('profile-image').src = avatarUrl;
        showMessage('Avatar updated successfully');
    } catch (error) {
        showError('Failed to upload avatar');
        console.error(error);
    }
}

async function handleLogout() {
    try {
        await signOut();
        currentUser = null;
        currentConversation = null;
        document.getElementById('profile-modal').classList.add('hidden');
    } catch (error) {
        showError('Failed to logout');
        console.error(error);
    }
}

async function startNewConversation(otherUserId) {
    try {
        // If selecting self, use existing self-conversation or create new one
        if (otherUserId === currentUser.id) {
            const conversations = await fetchConversations(currentUser.id);
            const selfChat = conversations.find(c => c.is_self_chat);
            
            if (selfChat) {
                currentConversation = selfChat.id;
            } else {
                const conversation = await createConversation([currentUser.id]);
                currentConversation = conversation.id;
            }
        } else {
            const conversation = await createConversation([currentUser.id, otherUserId]);
            currentConversation = conversation.id;
        }
        
        // Close the new conversation modal
        document.getElementById('new-conversation-modal').classList.add('hidden');
        
        // Clear the search
        document.getElementById('user-search').value = '';
        document.getElementById('user-search-results').innerHTML = '';
        
        // Refresh conversations list and open the new conversation
        await renderConversationsList();
        await loadConversation(currentConversation);
    } catch (error) {
        showError('Failed to start conversation');
        console.error(error);
    }
}

// ... add other UI utility functions ...
