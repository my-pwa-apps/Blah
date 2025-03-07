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
        this.setupThemeToggle();
        this.setupProfileHandlers();
        this.setupMobileHandlers();
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
        const startConversationBtn = document.getElementById('start-conversation');
        const userSearch = document.getElementById('user-search');
        let selectedUserId = null;

        newConversationBtn?.addEventListener('click', () => {
            this.logger.info('New conversation button clicked');
            modal?.classList.remove('hidden');
            selectedUserId = null;
            startConversationBtn.disabled = true;
            
            // Add self-chat option immediately
            const userSearchResults = document.getElementById('user-search-results');
            userSearchResults.innerHTML = `
                <div class="user-search-item" data-user-id="${this.currentUser.id}">
                    <div class="user-avatar">
                        <img src="${this.currentUser.avatar_url || 'images/default-avatar.png'}" alt="Avatar">
                    </div>
                    <div class="user-info">
                        <div class="user-name">Notes to Self</div>
                        <div class="user-email">${this.currentUser.email}</div>
                    </div>
                </div>
            `;
            
            // Clear search input
            if (userSearch) {
                userSearch.value = '';
                userSearch.focus();
            }
        });

        // User search input handler with debounce
        userSearch?.addEventListener('input', this.debounce(async (e) => {
            const query = e.target.value.trim();
            await this.handleUserSearch(query);
        }, 300));

        // Handle user selection
        document.getElementById('user-search-results')?.addEventListener('click', (e) => {
            const item = e.target.closest('.user-search-item');
            if (!item) return;

            // Remove previous selection
            document.querySelectorAll('.user-search-item.selected').forEach(el => 
                el.classList.remove('selected'));
            
            // Add new selection
            item.classList.add('selected');
            selectedUserId = item.dataset.userId;
            startConversationBtn.disabled = false;
            
            this.logger.info(`User selected: ${selectedUserId}`);
        });

        // Handle start conversation
        startConversationBtn?.addEventListener('click', async () => {
            if (selectedUserId) {
                this.logger.info(`Starting conversation with selected user: ${selectedUserId}`);
                try {
                    startConversationBtn.disabled = true;
                    startConversationBtn.textContent = "Creating...";
                    await this.startNewConversation(selectedUserId);
                    modal?.classList.add('hidden');
                } catch (error) {
                    this.logger.error("Error starting conversation:", error);
                    this.showError("Failed to start conversation");
                } finally {
                    startConversationBtn.disabled = false;
                    startConversationBtn.textContent = "Start Chat";
                }
            }
        });

        // Close modal handlers
        document.getElementById('close-new-conversation')?.addEventListener('click', () => {
            modal?.classList.add('hidden');
        });
    }

    async handleUserSearch(query) {
        const resultsContainer = document.getElementById('user-search-results');
        if (!resultsContainer) return;
        
        // Always start with self-chat option
        let html = `
            <div class="user-search-item" data-user-id="${this.currentUser.id}">
                <div class="user-avatar">
                    <img src="${this.currentUser.avatar_url || 'images/default-avatar.png'}" alt="Avatar">
                </div>
                <div class="user-info">
                    <div class="user-name">Notes to Self</div>
                    <div class="user-email">${this.currentUser.email}</div>
                </div>
            </div>
        `;

        try {
            if (query && query.length >= 2) { // Only search if query has at least 2 characters
                this.logger.info('Searching users with query:', query);
                const users = await this.getModule('data').searchUsers(query);
                
                // Add other users, excluding current user
                const otherUsersHtml = users
                    .filter(user => user.id !== this.currentUser.id)
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
                
                html += otherUsersHtml;
            }
        } catch (error) {
            this.logger.error('Error searching users:', error);
        } finally {
            resultsContainer.innerHTML = html;
        }
    }

    async renderConversationsList() {
        const conversationsList = document.getElementById('conversations-list');
        if (!conversationsList) return;

        try {
            this.logger.info('Fetching conversations for user:', this.currentUser.id);
            const dataModule = this.getModule('data');
            
            // Force a fresh fetch from the database
            const conversations = await dataModule.fetchConversations(this.currentUser.id, true);
            this.logger.info(`Fetched ${conversations.length} conversations`);
            
            // Add proper logging about the current conversation
            if (this.currentConversation) {
                this.logger.info(`Current conversation ID: ${this.currentConversation}`);
                const exists = conversations.some(c => c.id === this.currentConversation);
                this.logger.info(`Current conversation exists in fetched data: ${exists}`);
            }
            
            // Filter and deduplicate conversations
            const processedConversations = [];
            let selfChat = null;
            
            // Find the most recent self chat (if any)
            conversations.forEach(conv => {
                if (conv.is_self_chat || conv.participants.length === 1) {
                    // If we haven't found a self chat yet, or this one is more recent
                    if (!selfChat || new Date(conv.created_at) > new Date(selfChat.created_at)) {
                        selfChat = conv;
                    }
                } else {
                    processedConversations.push(conv);
                }
            });
            
            // Add the self chat at the beginning if it exists
            if (selfChat) {
                processedConversations.unshift(selfChat);
            }
            
            // Ensure current conversation is included if it exists
            if (this.currentConversation) {
                const currentInList = processedConversations.some(c => c.id === this.currentConversation);
                if (!currentInList) {
                    const currentConv = conversations.find(c => c.id === this.currentConversation);
                    if (currentConv) {
                        this.logger.info('Adding current conversation to list as it was missing');
                        processedConversations.push(currentConv);
                    }
                }
            }
            
            // Debug output processed conversations
            this.logger.info(`Rendering ${processedConversations.length} conversations`);
            
            // Render the conversations
            conversationsList.innerHTML = processedConversations.map(conv => {
                const isSelfChat = conv.is_self_chat || conv.participants.length === 1;
                
                // Handle both data structures: profiles directly on participants or nested
                const otherParticipant = isSelfChat ? null : 
                    conv.participants.find(p => p.user_id !== this.currentUser.id);
                
                const otherProfile = otherParticipant?.profiles || 
                                    (otherParticipant && typeof otherParticipant.profiles === 'undefined' ? otherParticipant : null);
                
                const name = isSelfChat ? 'Notes to Self' : 
                    otherProfile?.display_name || otherProfile?.email || 'Unknown User';
                    
                const avatar = isSelfChat ? this.currentUser.avatar_url : 
                    otherProfile?.avatar_url;
                
                return `
                    <div class="conversation-item${conv.id === this.currentConversation ? ' active' : ''}" 
                         data-conversation-id="${conv.id}">
                        <div class="conversation-avatar">
                            <img src="${avatar || 'images/default-avatar.png'}" alt="Avatar">
                        </div>
                        <div class="conversation-details">
                            <div class="conversation-name">${name}</div>
                            <div class="conversation-last-message">
                                ${conv.last_message?.content || 'No messages yet'}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Add click handlers
            conversationsList.querySelectorAll('.conversation-item').forEach(item => {
                item.addEventListener('click', () => this.loadConversation(item.dataset.conversationId));
            });
            
            this.logger.info('Conversation list rendering complete');
        } catch (error) {
            this.logger.error('Failed to render conversations:', error);
            this.showError('Failed to load conversations');
        }
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
        const messageContainer = document.getElementById('message-container');

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

            // Add message to UI
            const messageEl = document.createElement('div');
            messageEl.className = 'message sent';
            messageEl.innerHTML = `
                <div class="message-content">${content}</div>
                <div class="message-info">
                    ${new Date().toLocaleTimeString()}
                </div>
            `;
            messageContainer.appendChild(messageEl);
            messageEl.scrollIntoView({ behavior: 'smooth' });

            // Clear input
            messageInput.value = '';
            this.logger.info('Message sent successfully');
        } catch (error) {
            this.logger.error('Failed to send message:', error);
            this.showError('Failed to send message');
        }
    }tion
(item => {
    async loadConversation(conversationId) {
        if (!conversationId) {
            this.logger.error('Cannot load conversation: No ID provided');class on conversation ${conversationId}`);
            return;
        }.classList.remove('active');
        
        this.logger.info(`Loading conversation: ${conversationId}`);
        this.currentConversation = conversationId;
        // Check if conversation is in the list, if not, refresh the list
        // Get UI elementsnInList = document.querySelector(`.conversation-item[data-conversation-id="${conversationId}"]`);
        const messageContainer = document.getElementById('message-container');onInList) {
        const chatArea = document.querySelector('.chat-area');conversationId} not in list, refreshing list`);
        const sidebar = document.querySelector('.sidebar');   await this.renderConversationsList();
        }
        if (!messageContainer) {
            this.logger.error('Message container not found');
            return;('active');
        }
        // Hide sidebar on mobile
        // Highlight the active conversation8 && sidebar) {
        this.logger.info('Updating active conversation in UI');
        document.querySelectorAll('.conversation-item').forEach(item => {
            if (item.dataset.conversationId === conversationId) {
                item.classList.add('active');
                this.logger.info(`Set active class on conversation ${conversationId}`);
            } else {
                item.classList.remove('active');onst conversationItem = document.querySelector(`.conversation-item[data-conversation-id="${conversationId}"]`);
            }   if (conversationItem) {
        });                const nameEl = conversationItem.querySelector('.conversation-name');
           chatHeader.textContent = nameEl ? nameEl.textContent : 'Chat';
        // Show chat area
        if (chatArea) {
            chatArea.classList.add('active');
        }
        e('data');
        // On mobile, hide sidebarconst messages = await dataModule.fetchMessages(conversationId);
        if (window.innerWidth <= 768 && sidebar) {
            sidebar.classList.add('hidden');ges
        }
        
        // Update chat header title= 0) {
        const chatHeader = document.querySelector('.chat-title');
        if (chatHeader) {sages yet. Start typing to send a message.</div>';
            const conversationItem = document.querySelector(`.conversation-item[data-conversation-id="${conversationId}"]`);
            if (conversationItem) {
                const nameEl = conversationItem.querySelector('.conversation-name'); {
                chatHeader.textContent = nameEl ? nameEl.textContent : 'Chat';
            }
        }ssageEl.className = `message ${isSent ? 'sent' : 'received'}`;

        try {     <div class="message-content">${message.content}</div>
            const dataModule = this.getModule('data');           <div class="message-info">${new Date(message.created_at).toLocaleTimeString()}</div>
            const messages = await dataModule.fetchMessages(conversationId);        `;
            ainer.appendChild(messageEl);
            // Clear existing messages
            messageContainer.innerHTML = '';}
            
            if (messages.length === 0) {
                // Show empty statemessageContainer.scrollTop = messageContainer.scrollHeight;
                messageContainer.innerHTML = '<div class="no-messages">No messages yet. Start typing to send a message.</div>';
            } else {
                // Render messagesocus();
                messages.forEach(message => {   
                    const isSent = message.sender_id === this.currentUser.id;   } catch (error) {
                    const messageEl = document.createElement('div');            this.logger.error('Failed to load conversation messages:', error);
                    messageEl.className = `message ${isSent ? 'sent' : 'received'}`;ad messages');
                    messageEl.innerHTML = `
                        <div class="message-content">${message.content}</div>
                        <div class="message-info">${new Date(message.created_at).toLocaleTimeString()}</div>
                    `;
                    messageContainer.appendChild(messageEl);
                });this.logger.info(`Creating conversation with user ID: ${userId}`);
            }
            ased on userId
            // Scroll to bottomrentUser.id];
            messageContainer.scrollTop = messageContainer.scrollHeight;
            add the other user if it's not a self-chat
            // Focus the message input
            document.getElementById('message-text')?.focus();   participants.push(userId);
                this.logger.info(`Adding participant: ${userId}`);
        } catch (error) {
            this.logger.error('Failed to load conversation messages:', error);
            this.showError('Failed to load messages');}
        }
    }
onst conversation = await dataModule.createConversation(participants);
    async startNewConversation(userId) {
        try {
            this.logger.info(`Creating conversation with user ID: ${userId}`);    throw new Error('Failed to create conversation - no ID returned');
            
            // Create proper participants array based on userId
            const participants = [this.currentUser.id];this.logger.info(`Conversation created with ID: ${conversation.id}`);
            
            // Only add the other user if it's not a self-chat
            if (userId !== this.currentUser.id) {document.getElementById('new-conversation-modal')?.classList.add('hidden');
                participants.push(userId);
                this.logger.info(`Adding participant: ${userId}`);
            } else {await new Promise(resolve => setTimeout(resolve, 50));
                this.logger.info('Creating self-chat conversation');
            }
            this.currentConversation = conversation.id;
            const dataModule = this.getModule('data');
            const conversation = await dataModule.createConversation(participants);
            await this.renderConversationsList();
            if (!conversation || !conversation.id) {
                throw new Error('Failed to create conversation - no ID returned');
            }0));
            
            this.logger.info(`Conversation created with ID: ${conversation.id}`);g the chat area for the new conversation
            or('.chat-area');
            // Close the modal firstonst sidebar = document.querySelector('.sidebar');
            document.getElementById('new-conversation-modal')?.classList.add('hidden');
            
            // Set current conversation ID immediately
            this.currentConversation = conversation.id;
            
            // Use a more reliable approach:// On mobile, hide the sidebar
            // 1. First load the conversation to ensure it's in the database
            await this.loadConversationData(conversation.id);
            
            // 2. Then render the conversations list
            await this.renderConversationsList();// Now load the conversation explicitly, sending a log message before and after
            ersation: ${conversation.id}`);
            // 3. Wait longer for DOM updates to complete
            await new Promise(resolve => setTimeout(resolve, 300));oaded conversation: ${conversation.id}`);
            
            // 4. Now update the UI to show this conversationd set focus
            const conversationItem = document.querySelector(`.conversation-item[data-conversation-id="${conversation.id}"]`);onst messageInput = document.getElementById('message-text');
            if (conversationItem) {if (messageInput) {
                this.logger.info(`Found conversation in list, highlighting it: ${conversation.id}`);
                // Mark as activeput.focus();
                document.querySelectorAll('.conversation-item').forEach(item => 
                    item.classList.remove('active'));
                conversationItem.classList.add('active');   this.logger.info('Conversation successfully initiated with UI updates');
            } else {   } catch (error) {
                this.logger.warn(`Conversation ${conversation.id} not found in list after rendering`);            this.logger.error('Failed to start conversation:', error);
            }or('Failed to create conversation: ' + error.message);
            
            // Show chat area
            const chatArea = document.querySelector('.chat-area');
            const sidebar = document.querySelector('.sidebar');Error(message) {
            
            if (chatArea) {
                chatArea.classList.add('active');errorDiv.textContent = message;
            }
            ror');
            if (window.innerWidth <= 768 && sidebar) {if (existingError) existingError.remove();
                sidebar.classList.add('hidden');
            }   const authForm = document.querySelector('.auth-form');
                    authForm?.insertAdjacentElement('afterend', errorDiv);
            // Update message container with empty state
            const messageContainer = document.getElementById('message-container');
            if (messageContainer) {
                messageContainer.innerHTML = '<div class="no-messages">No messages yet. Start typing to send a message.</div>';
            }Message(message) {
            
            // Focus the message input
            const messageInput = document.getElementById('message-text');messageDiv.textContent = message;
            if (messageInput) {
                messageInput.value = '';ssage');
                messageInput.focus();if (existingMessage) existingMessage.remove();
            }
               const authForm = document.querySelector('.auth-form');
            this.logger.info('Conversation successfully initiated with UI updates');        authForm?.insertAdjacentElement('afterend', messageDiv);
        } catch (error) {
            this.logger.error('Failed to start conversation:', error);
            this.showError('Failed to create conversation: ' + error.message);
        }
    }    showAuthScreen() {
tById('auth-container')?.classList.remove('hidden');
    // Add new utility method to load conversation data without UI changesp-content')?.classList.add('hidden');
    async loadConversationData(conversationId) {
        try {
            this.logger.info(`Loading conversation data for: ${conversationId}`);MainApp(profile) {
            const dataModule = this.getModule('data');
            const messages = await dataModule.fetchMessages(conversationId);tById('auth-container')?.classList.add('hidden');
            this.logger.info(`Loaded ${messages.length} messages for conversation ${conversationId}`);
            return messages;
        } catch (error) {const profileName = document.querySelector('.profile-name');
            this.logger.error('Failed to load conversation data:', error);
            return [];rofile.display_name || profile.email;
        }   }
    }        
iately after login
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'auth-error';
        errorDiv.textContent = message;
        
        const existingError = document.querySelector('.auth-error');if (!status) return;
        if (existingError) existingError.remove();
           status.textContent = online ? 'Online' : 'Offline';
        const authForm = document.querySelector('.auth-form');        status.className = `status-indicator ${online ? '' : 'offline'} show`;
        authForm?.insertAdjacentElement('afterend', errorDiv);
        
        setTimeout(() => errorDiv.remove(), 5000);
    }

    showMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'auth-message';
        messageDiv.textContent = message;
        tribute('data-theme');
        const existingMessage = document.querySelector('.auth-message');;
        if (existingMessage) existingMessage.remove();
          document.body.setAttribute('data-theme', newTheme);
        const authForm = document.querySelector('.auth-form');            localStorage.setItem('theme', newTheme);
        authForm?.insertAdjacentElement('afterend', messageDiv);xtContent = 
                   newTheme === 'dark' ? 'light_mode' : 'dark_mode';
        setTimeout(() => messageDiv.remove(), 5000);        };
    }

    showAuthScreen() {
        document.getElementById('auth-container')?.classList.remove('hidden');
        document.getElementById('app-content')?.classList.add('hidden');pProfileHandlers() {
    }ser-profile');
'profile-modal');
    showMainApp(profile) {ument.querySelectorAll('#close-profile, #cancel-profile');  // Get both close buttons
        this.currentUser = profile;
        document.getElementById('auth-container')?.classList.add('hidden');
        document.getElementById('app-content')?.classList.remove('hidden');
        
        const profileName = document.querySelector('.profile-name');   document.getElementById('display-name').value = this.currentUser.display_name || '';
        if (profileName) {     document.getElementById('status-message').value = this.currentUser.status || '';
            profileName.textContent = profile.display_name || profile.email;                document.getElementById('avatar-preview').src = 
        }| 'images/default-avatar.png';
        
        // Render conversations immediately after login
        this.renderConversationsList();
    }click handler to all close buttons
seProfileBtn?.forEach(btn => {
    showOnlineStatus(online = true) {            btn.addEventListener('click', () => {
        const status = document.getElementById('status');t.add('hidden');
        if (!status) return;

        status.textContent = online ? 'Online' : 'Offline';
        status.className = `status-indicator ${online ? '' : 'offline'} show`;ose when clicking outside
        fileModal?.addEventListener('click', (e) => {
        setTimeout(() => status.classList.remove('show'), 3000);       if (e.target === profileModal) {
    }                profileModal.classList.add('hidden');

    setupThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        if (!themeToggle) return;

        const toggleTheme = () => {');
            const currentTheme = document.body.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            rea');
            document.body.setAttribute('data-theme', newTheme);const sidebar = document.querySelector('.sidebar');
            localStorage.setItem('theme', newTheme);
            themeToggle.querySelector('.material-icons').textContent =  if (chatArea) chatArea.classList.remove('active');
                newTheme === 'dark' ? 'light_mode' : 'dark_mode';    if (sidebar) sidebar.classList.remove('hidden');
        };
, returning to sidebar');
        themeToggle.addEventListener('click', toggleTheme);
    }
// Handle resizing properly
    setupProfileHandlers() {er('resize', () => {
        const userProfile = document.getElementById('user-profile');e();
        const profileModal = document.getElementById('profile-modal');   });
        const closeProfileBtn = document.querySelectorAll('#close-profile, #cancel-profile');  // Get both close buttons    
        
        userProfile?.addEventListener('click', () => {
            profileModal?.classList.remove('hidden');
            if (this.currentUser) {
                document.getElementById('display-name').value = this.currentUser.display_name || '';stLayoutForScreenSize() {
                document.getElementById('status-message').value = this.currentUser.status || ''; document.querySelector('.chat-area');
                document.getElementById('avatar-preview').src = sidebar');
                    this.currentUser.avatar_url || 'images/default-avatar.png';
            }
        });

        // Add click handler to all close buttons'hidden');
        closeProfileBtn?.forEach(btn => {
            btn.addEventListener('click', () => { else if (!this.currentConversation) {
                profileModal?.classList.add('hidden');       // On mobile with no conversation selected, show sidebar
            });            if (chatArea) chatArea.classList.remove('active');
        });lassList.remove('hidden');

        // Close when clicking outside
        profileModal?.addEventListener('click', (e) => {
            if (e.target === profileModal) {d
                profileModal.classList.add('hidden');
            }
        }); function executedFunction(...args) {
    }

    setupMobileHandlers() {      func.apply(this, args);
        const backButton = document.getElementById('back-button');       };
                   clearTimeout(timeout);
        backButton?.addEventListener('click', () => {            timeout = setTimeout(later, wait);
















































}    }        };            timeout = setTimeout(later, wait);            clearTimeout(timeout);            };                func.apply(this, args);                clearTimeout(timeout);            const later = () => {        return function executedFunction(...args) {        let timeout;    debounce(func, wait) {    // Add debounce utility method    }        }            if (sidebar) sidebar.classList.remove('hidden');            if (chatArea) chatArea.classList.remove('active');            // On mobile with no conversation selected, show sidebar        } else if (!this.currentConversation) {            if (sidebar) sidebar.classList.remove('hidden');            if (chatArea) chatArea.classList.remove('active', 'hidden');            // On desktop, both should be visible        if (!isMobile) {                const isMobile = window.innerWidth <= 768;        const sidebar = document.querySelector('.sidebar');        const chatArea = document.querySelector('.chat-area');    adjustLayoutForScreenSize() {        }        this.adjustLayoutForScreenSize();        // Initial adjustment                });            this.adjustLayoutForScreenSize();        window.addEventListener('resize', () => {        // Handle resizing properly                });            this.logger.info('Back button clicked, returning to sidebar');                        if (sidebar) sidebar.classList.remove('hidden');            if (chatArea) chatArea.classList.remove('active');                        const sidebar = document.querySelector('.sidebar');            const chatArea = document.querySelector('.chat-area');        };
    }
}
