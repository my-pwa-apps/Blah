import { signIn, signUp, signOut } from './auth.js';
import { 
    fetchConversations, 
    fetchMessages, 
    sendMessage, 
    searchUsers, 
    createConversation,
    updateUserProfile,
    uploadAvatar,
    subscribeToMessages
} from './db.js';

let currentUser = null;
let currentConversation = null;
let authInProgress = false;
let messageSubscription = null;

function setupTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Set initial theme
    if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && prefersDark.matches)) {
        document.body.setAttribute('data-theme', 'dark');
        themeToggle.querySelector('.material-icons').textContent = 'light_mode';
    }
    
    // Theme toggle handler
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeToggle.querySelector('.material-icons').textContent = 
            newTheme === 'dark' ? 'light_mode' : 'dark_mode';
    });
    
    // Listen for system theme changes
    prefersDark.addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            document.body.setAttribute('data-theme', e.matches ? 'dark' : 'light');
            themeToggle.querySelector('.material-icons').textContent = 
                e.matches ? 'light_mode' : 'dark_mode';
        }
    });
}

export function initUI() {
    setupTheme();
    setupAuthListeners();
    setupMessageListeners();
    setupProfileListeners();
    setupConversationListeners();
    setupResponsiveListeners();
    
    // Handle online/offline status
    window.addEventListener('online', () => showOnlineStatus(true));
    window.addEventListener('offline', () => showOnlineStatus(false));
    
    // Show initial status
    showOnlineStatus(navigator.onLine);

    // Request notification permission
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
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

    // Show placeholder when no conversation is selected
    messageContainer.innerHTML = '<div class="no-conversation">Type a message to start a self-chat, or select a conversation</div>';
    messageInput.disabled = false;
    sendButton.disabled = false;

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
    const profileModal = document.getElementById('profile-modal');
    const closeProfile = document.getElementById('close-profile');
    const saveProfile = document.getElementById('save-profile');
    const avatarUpload = document.getElementById('avatar-upload');
    const logoutButton = document.getElementById('logout-button');
    const profileName = document.querySelector('.profile-name');

    // Update profile name in header
    if (currentUser) {
        profileName.textContent = currentUser.display_name || currentUser.email;
    }

    userProfile?.addEventListener('click', () => {
        profileModal?.classList.remove('hidden');
        // Pre-fill form fields
        if (currentUser) {
            document.getElementById('display-name').value = currentUser.display_name || '';
            document.getElementById('status-message').value = currentUser.status || '';
            document.getElementById('avatar-preview').src = currentUser.avatar_url || 'images/default-avatar.png';
        }
    });

    closeProfile?.addEventListener('click', () => {
        profileModal?.classList.add('hidden');
    });

    // Close modal when clicking outside
    profileModal?.addEventListener('click', (e) => {
        if (e.target === profileModal) {
            profileModal.classList.add('hidden');
        }
    });

    saveProfile?.addEventListener('click', handleProfileUpdate);
    avatarUpload?.addEventListener('change', handleAvatarUpload);
    logoutButton?.addEventListener('click', handleLogout);
}

function setupConversationListeners() {
    const newConversationBtn = document.getElementById('new-conversation');
    const newConversationModal = document.getElementById('new-conversation-modal');
    const closeNewConversation = document.getElementById('close-new-conversation');
    const userSearch = document.getElementById('user-search');
    const userSearchResults = document.getElementById('user-search-results');

    newConversationBtn?.addEventListener('click', () => {
        if (newConversationModal) {
            newConversationModal.classList.remove('hidden');
            userSearch?.focus();
            // Initialize search results with self-chat option
            handleUserSearch();
        }
    });

    // Close modal when clicking outside
    newConversationModal?.addEventListener('click', (e) => {
        if (e.target === newConversationModal) {
            newConversationModal.classList.add('hidden');
        }
    });

    closeNewConversation?.addEventListener('click', () => {
        document.getElementById('new-conversation-modal').classList.add('hidden');
    });

    userSearch?.addEventListener('input', debounce(handleUserSearch, 300));

    // Add delegation for user selection
    userSearchResults?.addEventListener('click', (e) => {
        const userItem = e.target.closest('.user-search-item');
        if (userItem) {
            const userId = userItem.dataset.userId;
            startNewConversation(userId);
        }
    });
}

function setupResponsiveListeners() {
    const backButton = document.getElementById('back-button');
    const chatArea = document.querySelector('.chat-area');
    
    if (backButton) {
        backButton.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                chatArea.classList.remove('active');
                currentConversation = null;
            }
        });
    }

    // Handle resize events
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            chatArea.classList.remove('active');
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
    const query = document.getElementById('user-search').value?.trim() || '';
    const resultsContainer = document.getElementById('user-search-results');

    if (!resultsContainer) return;

    // Always start with self-chat option
    resultsContainer.innerHTML = `
        <div class="user-search-item ripple" data-user-id="${currentUser.id}">
            <div class="user-avatar">
                <img src="${currentUser.avatar_url || 'images/default-avatar.png'}" alt="Avatar">
            </div>
            <div class="user-info">
                <div class="user-name">${currentUser.display_name || currentUser.email} (Notes to Self)</div>
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
                <div class="user-search-item ripple" data-user-id="${user.id}">
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
    
    // Update profile display
    const profileName = document.querySelector('.profile-name');
    if (profileName) {
        profileName.textContent = profile.display_name || profile.email;
    }
}

export async function renderConversationsList() {
    const conversationsList = document.getElementById('conversations-list');
    conversationsList.innerHTML = '';
    
    try {
        const conversations = await fetchConversations(currentUser.id);
        
        // Better filtering for self-conversations
        const processedConversations = new Map();
        
        conversations.forEach(conv => {
            if (conv.is_self_chat) {
                const existing = processedConversations.get('self');
                if (!existing || new Date(conv.created_at) > new Date(existing.created_at)) {
                    processedConversations.set('self', conv);
                }
            } else {
                processedConversations.set(conv.id, conv);
            }
        });

        // Convert back to array and render
        Array.from(processedConversations.values()).forEach(conversation => {
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
            conversationEl.dataset.conversationId = conversation.id;
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
    const chatArea = document.querySelector('.chat-area');
    
    messageInput.disabled = false;
    sendButton.disabled = false;
    messageContainer.innerHTML = '';
    
    try {
        const messages = await fetchMessages(conversationId);
        renderMessages(messages);
        
        // Setup realtime updates for this conversation
        setupRealtimeMessages(conversationId);
        
        // Remove unread indicator
        const conversationEl = document.querySelector(`[data-conversation-id="${conversationId}"]`);
        if (conversationEl) {
            conversationEl.classList.remove('unread');
        }

        // Show chat area on mobile
        if (window.innerWidth <= 768) {
            chatArea.classList.add('active');
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

function showOnlineStatus(online = true) {
    const status = document.getElementById('status');
    if (!status) return;

    status.textContent = online ? 'Online' : 'Offline';
    status.className = `status-indicator ${online ? '' : 'offline'} show`;
    
    // Hide after 3 seconds
    setTimeout(() => {
        status.classList.remove('show');
    }, 3000);
}

function setupRealtimeMessages(conversationId) {
    // Unsubscribe from previous conversation if any
    if (messageSubscription) {
        messageSubscription.unsubscribe();
    }

    messageSubscription = subscribeToMessages(conversationId, (newMessage) => {
        // Add new message to UI if in same conversation
        if (currentConversation === conversationId) {
            appendMessage(newMessage);
        } else {
            // Show notification and update conversation list
            showNewMessageNotification(conversationId);
            renderConversationsList();
        }
    });
}

function appendMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${message.sender_id === currentUser.id ? 'sent' : 'received'}`;
    messageEl.innerHTML = `
        <div class="message-content">${message.content}</div>
        <div class="message-info">
            ${new Date(message.created_at).toLocaleTimeString()}
        </div>
    `;
    const container = document.getElementById('message-container');
    container.appendChild(messageEl);
    messageEl.scrollIntoView({ behavior: 'smooth' });
}

function showNewMessageNotification(conversationId) {
    // Mark conversation as unread
    const conversationEl = document.querySelector(`[data-conversation-id="${conversationId}"]`);
    if (conversationEl) {
        conversationEl.classList.add('unread');
    }

    // Show system notification if permitted
    if (Notification.permission === 'granted') {
        new Notification('New Message', {
            body: 'You have a new message',
            icon: '/images/icon-192x192.png'
        });
    }
}

// ... add other UI utility functions ...
