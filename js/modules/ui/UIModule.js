import { BaseModule } from '../BaseModule.js';

export class UIModule extends BaseModule {
    constructor(app) {
        super(app);
        this.currentUser = null;
        this.currentConversation = null;
    }

    async init() {
        this.setupEventListeners();
        this.setupAuthListener();
        this.setupConversationListeners();
        this.setupMessageListeners();
        this.logger.info('UI module initialized');
    }

    setupEventListeners() {
        const loginBtn = document.getElementById('login-button');
        const signupBtn = document.getElementById('signup-button');
        const emailInput = document.getElementById('email-input');
        const passwordInput = document.getElementById('password-input');

        loginBtn?.addEventListener('click', async () => {
            this.logger.info('Login button clicked');
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            if (!email || !password) {
                this.showError('Please enter both email and password');
                return;
            }

            try {
                this.logger.info('Attempting to get auth module');
                const authModule = this.getModule('auth');
                this.logger.info('Auth module retrieved, attempting sign in');
                await authModule.signIn(email, password);
            } catch (error) {
                this.logger.error('Login error:', error);
                this.showError(error.message);
            }
        });

        signupBtn?.addEventListener('click', async () => {
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            if (!email || !password) {
                this.showError('Please enter both email and password');
                return;
            }

            try {
                const { data } = await this.getModule('auth').signUp(email, password);
                if (data) {
                    this.showMessage('Sign up successful! Please check your email for verification.');
                    emailInput.value = '';
                    passwordInput.value = '';
                }
            } catch (error) {
                this.showError(error.message);
            }
        });
    }

    setupAuthListener() {
        this.getModule('auth').onAuthStateChange(async (user) => {
            if (user) {
                this.logger.info('Auth state changed: User logged in');
                const dataModule = this.getModule('data');
                
                // Get or create user profile
                let profile = await dataModule.fetchUserProfile(user.id);
                if (!profile) {
                    profile = await dataModule.createUserProfile({
                        id: user.id,
                        email: user.email,
                        display_name: user.email.split('@')[0],
                        status: 'Available'
                    });
                }
                
                this.showMainApp(profile);
            } else {
                this.logger.info('Auth state changed: User logged out');
                this.showAuthScreen();
            }
        });
    }

    setupConversationListeners() {
        const newConversationBtn = document.getElementById('new-conversation');
        const modal = document.getElementById('new-conversation-modal');

        newConversationBtn?.addEventListener('click', () => {
            this.logger.info('New conversation button clicked');
            modal?.classList.remove('hidden');
            document.getElementById('user-search')?.focus();
        });

        // Close modal handlers
        document.getElementById('close-new-conversation')?.addEventListener('click', () => {
            modal?.classList.add('hidden');
        });

        // User search handler
        document.getElementById('user-search')?.addEventListener('input', async (e) => {
            const query = e.target.value.trim();
            if (query) {
                const users = await this.getModule('data').searchUsers(query);
                this.renderUserSearchResults(users);
            }
        });
    }

    setupMessageListeners() {
        const sendButton = document.getElementById('send-button');
        const messageInput = document.getElementById('message-text');

        sendButton?.addEventListener('click', () => this.handleSendMessage());
        
        messageInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });
    }

    async handleSendMessage() {
        const messageInput = document.getElementById('message-text');
        const content = messageInput?.value.trim();

        if (!content || !this.currentUser) return;

        try {
            this.logger.info('Sending message');
            const dataModule = this.getModule('data');

            // Create self-conversation if none exists
            if (!this.currentConversation) {
                const conversation = await dataModule.createConversation([this.currentUser.id]);
                this.currentConversation = conversation.id;
            }

            await dataModule.sendMessage(
                this.currentConversation,
                this.currentUser.id,
                content
            );

            messageInput.value = '';
            this.logger.info('Message sent successfully');
        } catch (error) {
            this.logger.error('Failed to send message:', error);
            this.showError('Failed to send message');
        }
    }

    renderUserSearchResults(users) {
        const container = document.getElementById('user-search-results');
        if (!container) return;

        container.innerHTML = users.map(user => `
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

        // Add click handlers
        container.querySelectorAll('.user-search-item').forEach(item => {
            item.addEventListener('click', () => {
                this.startNewConversation(item.dataset.userId);
            });
        });
    }

    async startNewConversation(userId) {
        try {
            const conversation = await this.getModule('data').createConversation([
                this.currentUser.id,
                userId
            ]);
            
            document.getElementById('new-conversation-modal')?.classList.add('hidden');
            this.currentConversation = conversation.id;
            
            // Update UI
            await this.loadConversation(conversation.id);
        } catch (error) {
            this.logger.error('Failed to start conversation:', error);
            this.showError('Failed to start conversation');
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'auth-error';
        errorDiv.textContent = message;
        
        const existingError = document.querySelector('.auth-error');
        if (existingError) existingError.remove();
        
        const authForm = document.querySelector('.auth-form');
        authForm?.insertAdjacentElement('afterend', errorDiv);
        
        setTimeout(() => errorDiv.remove(), 5000);
    }

    showMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'auth-message';
        messageDiv.textContent = message;
        
        const existingMessage = document.querySelector('.auth-message');
        if (existingMessage) existingMessage.remove();
        
        const authForm = document.querySelector('.auth-form');
        authForm?.insertAdjacentElement('afterend', messageDiv);
        
        setTimeout(() => messageDiv.remove(), 5000);
    }

    showAuthScreen() {
        document.getElementById('auth-container')?.classList.remove('hidden');
        document.getElementById('app-content')?.classList.add('hidden');
    }

    showMainApp(profile) {
        this.currentUser = profile;
        document.getElementById('auth-container')?.classList.add('hidden');
        document.getElementById('app-content')?.classList.remove('hidden');
        
        const profileName = document.querySelector('.profile-name');
        if (profileName) {
            profileName.textContent = profile.display_name || profile.email;
        }
    }

    showOnlineStatus(online = true) {
        const status = document.getElementById('status');
        if (!status) return;

        status.textContent = online ? 'Online' : 'Offline';
        status.className = `status-indicator ${online ? '' : 'offline'} show`;
        
        setTimeout(() => status.classList.remove('show'), 3000);
    }
}
