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
        this.setupNotificationHandlers();
        this.setupSpecialEvents(); // Add this line
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
            this.logger.info('Fetching conversations for current user');
            const dataModule = this.getModule('data');
            
            // Get conversations with forced cache refresh
            const conversations = await dataModule.fetchConversations(this.currentUser.id, true);
            
            // Clear list
            conversationsList.innerHTML = '';
            
            if (!conversations || conversations.length === 0) {
                conversationsList.innerHTML = '<div class="no-conversations">No conversations yet. Start a new chat!</div>';
                return;
            }
            
            this.logger.info(`Rendering ${conversations.length} conversations`);
            
            // Render each conversation
            for (const conv of conversations) {
                try {t with others
                    // Log the conversation data for debugging
                    this.logger.info(`Processing conversation ${conv.id}:`, {
                        is_self_chat: conv.is_self_chat,
                        participantCount: conv.participants?.length,
                        userIsOnlyParticipant: conv.participants?.length === 1 && 
                                             conv.participants[0].user_id === this.currentUser.id isSelfChat: isSelfChat,
                    });    is_self_chat_flag: conv.is_self_chat,
                    .length
                    // Explicitly determine self-chat status
                    const isSelfChat = Boolean(conv.is_self_chat) || 
                                     (conv.participants?.length === 1 && 
                                      conv.participants[0].user_id === this.currentUser.id);
                    
                    let displayName, avatarUrl;    displayName = 'Notes to Self';
                    his.currentUser.avatar_url;
                    if (isSelfChat) {
                        displayName = 'Notes to Self';
                        avatarUrl = this.currentUser.avatar_url; => p.user_id !== this.currentUser.id);
                        this.logger.info(`Rendering self-chat: ${conv.id}`);
                    } else {
                        // Find the other user's profile - improved to handle multiple participants
                        const otherUsers = conv.participants?.filter(p => p.user_id !== this.currentUser.id) || [];    if (otherUser?.profiles) {
                        ser.profiles.display_name || otherUser.profiles.email || 'Unknown User';
                        if (otherUsers.length > 0) {es.avatar_url;
                            const otherUser = otherUsers[0];
                            if (otherUser?.profiles) {
                                displayName = otherUser.profiles.display_name || otherUser.profiles.email || 'Unknown User';
                                avatarUrl = otherUser.profiles.avatar_url;
                                this.logger.info(`Rendering chat with: ${displayName}, id: ${conv.id}`);
                            } else {
                                displayName = 'Unknown User';
                                avatarUrl = null;
                                this.logger.info(`Rendering chat with unknown user: ${conv.id}`);
                            }
                        } else {
                            displayName = 'Group Chat';asUnreadMessages(conv);
                            avatarUrl = null;
                            this.logger.info(`Rendering group chat: ${conv.id}`);eate conversation element
                        }onst conversationEl = document.createElement('div');
                    }conversationEl.className = `conversation-item${conv.id === this.currentConversation ? ' active' : ''}${hasUnread ? ' unread' : ''}`;
                    
                    // Check if this conversation has unread messagesfChat); // Explicitly store as string
                    const hasUnread = this._hasUnreadMessages(conv);
                     for notifications
                    // Create conversation element
                    const conversationEl = document.createElement('div');
                    conversationEl.className = `conversation-item${conv.id === this.currentConversation ? ' active' : ''}${hasUnread ? ' unread' : ''}`;
                    conversationEl.dataset.conversationId = conv.id;
                    conversationEl.dataset.isSelfChat = String(isSelfChat); // Explicitly store as string    
                    
                    // Add dataset with sender IDs for easier lookup
                    const participantIds = conv.participants?.map(p => p.user_id).join(',') || '';
                    conversationEl.dataset.participantIds = participantIds;
                    
                    conversationEl.innerHTML = `
                            <img src="${avatarUrl || 'images/default-avatar.png'}" alt="Avatar">
                        </div>mg src="${avatarUrl || 'images/default-avatar.png'}" alt="Avatar">
                        <div class="conversation-details">
                            <div class="conversation-name">${displayName}</div>
                            <div class="conversation-last-message">yName}</div>
                                ${conv.last_message?.content || 'No messages yet'}
                            </div>conv.last_message?.content || 'No messages yet'}
                        </div>div>
                        ${hasUnread ? '<div class="unread-indicator"></div>' : ''}
                    `;  ${hasUnread ? '<div class="unread-indicator"></div>' : ''}
                    `;
                    // Add click handler
                    conversationEl.addEventListener('click', () => this.loadConversation(conv.id));
                    conversationEl.addEventListener('click', () => this.loadConversation(conv.id));
                    // Add to list
                    conversationsList.appendChild(conversationEl);
                } catch (err) {nsList.appendChild(conversationEl);
                    this.logger.error(`Error rendering conversation ${conv.id}:`, err);
                }   this.logger.error(`Error rendering conversation ${conv.id}:`, err);
            }   }
            }
            // Fix mobile layout issues
            this.adjustLayoutForScreenSize();
            this.adjustLayoutForScreenSize();
        } catch (error) {
            this.logger.error('Failed to render conversations list:', error);
            this.showError('Failed to load conversations');ns list:', error);
        }   this.showError('Failed to load conversations');
    }   }
    }
    // Improved method to check for unread messages
    _hasUnreadMessages(conversation) {read messages
        if (!conversation.last_message || conversation.last_message.sender_id === this.currentUser.id) {
            return false;.last_message || conversation.last_message.sender_id === this.currentUser.id) {
        }   return false;
        }
        const lastMessageTime = new Date(conversation.last_message.created_at);
        const lastMessageTime = new Date(conversation.last_message.created_at);
        // Use either the participant record or the conversation user last read time
        const lastReadAt = conversation.userLastRead || 
                          conversation.participants?.find(p => p.user_id === this.currentUser.id)?.last_read_at;p => p.user_id === this.currentUser.id);
                          ead_at) {
        if (!lastReadAt) return true; // Unread if no read timestamp   return true; // Unread if no read timestamp
        }
        const lastReadTime = new Date(lastReadAt);
        return lastMessageTime > lastReadTime;icipant.last_read_at);
    }   return lastMessageTime > lastReadTime;
    }
    setupMessageListeners() {
        const sendButton = document.getElementById('send-button');
        const messageInput = document.getElementById('message-text');
        const messageInput = document.getElementById('message-text');
        sendButton?.addEventListener('click', () => this.handleSendMessage());
        sendButton?.addEventListener('click', () => this.handleSendMessage());
        messageInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {(e) => {
                e.preventDefault();& !e.shiftKey) {
                this.handleSendMessage();
            }   this.handleSendMessage();
        }); }
    }   });
    }
    async handleSendMessage() {
        const messageInput = document.getElementById('message-text');
        const content = messageInput?.value.trim();d('message-text');
        const messageContainer = document.getElementById('message-container');
        const messageContainer = document.getElementById('message-container');
        if (!content || !this.currentUser) return;
        if (!content || !this.currentUser) return;
        try {
            this.logger.info('Sending message');
            const dataModule = this.getModule('data');
            const dataModule = this.getModule('data');
            // Create self-conversation if none exists
            if (!this.currentConversation) {one exists
                const conversation = await dataModule.createConversation([this.currentUser.id]);
                this.currentConversation = conversation.id;eConversation([this.currentUser.id]);
            }   this.currentConversation = conversation.id;
            }
            await dataModule.sendMessage(
                this.currentConversation,
                this.currentUser.id,tion,
                contentrrentUser.id,
            );  content
            );
            // Add message to UI
            const messageEl = document.createElement('div');
            messageEl.className = 'message sent';ent('div');
            messageEl.innerHTML = `message sent';
                <div class="message-content">${content}</div>
                <div class="message-info">t">${content}</div>
                    ${new Date().toLocaleTimeString()}
                </div>new Date().toLocaleTimeString()}
            `;  </div>
            messageContainer.appendChild(messageEl);
            messageEl.scrollIntoView({ behavior: 'smooth' });
            messageEl.scrollIntoView({ behavior: 'smooth' });
            // Clear input
            messageInput.value = '';
            this.logger.info('Message sent successfully');
        } catch (error) {nfo('Message sent successfully');
            this.logger.error('Failed to send message:', error);
            this.showError('Failed to send message');:', error);
        }   this.showError('Failed to send message');
    }   }
    }
    async loadConversation(conversationId) {
        if (!conversationId) {versationId) {
            this.logger.error('Cannot load conversation: No ID provided');
            return;gger.error('Cannot load conversation: No ID provided');
        }   return;
        }
        this.logger.info(`Loading conversation: ${conversationId}`);
        this.currentConversation = conversationId;conversationId}`);
        this.currentConversation = conversationId;
        // Get UI elements
        const messageContainer = document.getElementById('message-container');
        const chatArea = document.querySelector('.chat-area');age-container');
        const sidebar = document.querySelector('.sidebar');');
        const sidebar = document.querySelector('.sidebar');
        if (!messageContainer) {
            this.logger.error('Message container not found');
            return;gger.error('Message container not found');
        }   return;
        }
        // Update UI to show active conversation
        document.querySelectorAll('.conversation-item').forEach(item => {
            if (item.dataset.conversationId === conversationId) {tem => {
                item.classList.add('active');== conversationId) {
                this.logger.info(`Set active class on conversation ${conversationId}`);
            } else {.logger.info(`Set active class on conversation ${conversationId}`);
                item.classList.remove('active');
            }   item.classList.remove('active');
        }); }
        });
        // Check if conversation is in the list, if not, refresh the list
        const conversationInList = document.querySelector(`.conversation-item[data-conversation-id="${conversationId}"]`);
        if (!conversationInList) { document.querySelector(`.conversation-item[data-conversation-id="${conversationId}"]`);
            this.logger.info(`Conversation ${conversationId} not in list, refreshing list`);
            await this.renderConversationsList();ersationId} not in list, refreshing list`);
        }   await this.renderConversationsList();
        }
        // Show chat area (important for mobile)
        if (chatArea) {ea (important for mobile)
            chatArea.classList.add('active');
        }   chatArea.classList.add('active');
        }
        // Hide sidebar on mobile
        if (window.innerWidth <= 768 && sidebar) {
            sidebar.classList.add('hidden');bar) {
        }   sidebar.classList.add('hidden');
        }
        // Update chat header title
        const chatHeader = document.querySelector('.chat-title');
        if (chatHeader) {= document.querySelector('.chat-title');
            const conversationItem = document.querySelector(`.conversation-item[data-conversation-id="${conversationId}"]`);
            if (conversationItem) {= document.querySelector(`.conversation-item[data-conversation-id="${conversationId}"]`);
                const nameEl = conversationItem.querySelector('.conversation-name');
                chatHeader.textContent = nameEl ? nameEl.textContent : 'Chat';ame');
            }   chatHeader.textContent = nameEl ? nameEl.textContent : 'Chat';
        }   }
        }
        try {
            const dataModule = this.getModule('data');
            const messages = await dataModule.fetchMessages(conversationId);
            const messages = await dataModule.fetchMessages(conversationId);
            // Clear existing messages
            messageContainer.innerHTML = '';
            messageContainer.innerHTML = '';
            if (messages.length === 0) {
                // Show empty state 0) {
                messageContainer.innerHTML = '<div class="no-messages">No messages yet. Start typing to send a message.</div>';
            } else {ageContainer.innerHTML = '<div class="no-messages">No messages yet. Start typing to send a message.</div>';
                this._renderMessages(messages);
            }   this._renderMessages(messages);
            }
            // Scroll to bottom
            messageContainer.scrollTop = messageContainer.scrollHeight;
            messageContainer.scrollTop = messageContainer.scrollHeight;
            // Focus the message input
            document.getElementById('message-text')?.focus();
            document.getElementById('message-text')?.focus();
            // Mark conversation as read
            await dataModule.markMessagesAsRead(conversationId, this.currentUser.id);
            await dataModule.markMessagesAsRead(conversationId, this.currentUser.id);
            // Remove unread indicator
            const conversationEl = document.querySelector(`.conversation-item[data-conversation-id="${conversationId}"]`);
            if (conversationEl) {= document.querySelector(`.conversation-item[data-conversation-id="${conversationId}"]`);
                conversationEl.classList.remove('unread');
                conversationEl.querySelector('.unread-indicator')?.remove();
            }   conversationEl.querySelector('.unread-indicator')?.remove();
            }
            // Setup real-time subscription for new messages
            this._setupMessageSubscription(conversationId);s
        } catch (error) {ssageSubscription(conversationId);
            this.logger.error('Failed to load conversation messages:', error);
            this.showError('Failed to load messages');tion messages:', error);
        }   this.showError('Failed to load messages');
    }   }
    }
    async startNewConversation(userId) {
        try {rtNewConversation(userId) {
            this.logger.info(`Starting conversation with user ID: ${userId}`);
            this.logger.info(`Starting conversation with user ID: ${userId}`);
            // Create participants array with correct order and structure
            const participants = [];rray with correct order and structure
            const participants = [];
            // Always include current user first
            participants.push(this.currentUser.id);
            participants.push(this.currentUser.id);
            // Check if this is a self-chat or chat with another user
            if (userId !== this.currentUser.id) {at with another user
                participants.push(userId);r.id) {
                this.logger.info(`Creating chat with other user: ${userId}`);
            } else {.logger.info(`Creating chat with other user: ${userId}`);
                this.logger.info('Creating self-chat conversation');
            }   this.logger.info('Creating self-chat conversation');
            }
            const dataModule = this.getModule('data');
            const dataModule = this.getModule('data');
            // Create the conversation
            const conversation = await dataModule.createConversation(participants);
            if (!conversation || !conversation.id) {eateConversation(participants);
                throw new Error('Failed to create conversation');
            }   throw new Error('Failed to create conversation');
            }
            this.logger.info(`Created conversation with ID: ${conversation.id}`);
            this.logger.info(`Created conversation with ID: ${conversation.id}`);
            // Close the conversation modal
            const modal = document.getElementById('new-conversation-modal');
            if (modal) modal.classList.add('hidden');w-conversation-modal');
            if (modal) modal.classList.add('hidden');
            // Set as current conversation
            this.currentConversation = conversation.id;
            this.currentConversation = conversation.id;
            // Update UI in correct sequence
            await this.renderConversationsList();
            await this.renderConversationsList();
            // Wait for DOM updates to complete
            await new Promise(resolve => setTimeout(resolve, 300));
            await new Promise(resolve => setTimeout(resolve, 300));
            // Now load the conversation
            await this.loadConversation(conversation.id);
            await this.loadConversation(conversation.id);
            this.logger.info('New conversation created and loaded successfully');
        } catch (error) {nfo('New conversation created and loaded successfully');
            this.logger.error('Failed to start conversation:', error);
            this.showError('Failed to create conversation: ' + error.message);
        }   this.showError('Failed to create conversation: ' + error.message);
    }   }
    }
    async loadConversationData(conversationId) {
        try {dConversationData(conversationId) {
            this.logger.info(`Loading conversation data for: ${conversationId}`);
            const dataModule = this.getModule('data');a for: ${conversationId}`);
            const messages = await dataModule.fetchMessages(conversationId);
            this.logger.info(`Loaded ${messages.length} messages for conversation ${conversationId}`);
            return messages;(`Loaded ${messages.length} messages for conversation ${conversationId}`);
        } catch (error) {es;
            this.logger.error('Failed to load conversation data:', error);
            return [];r.error('Failed to load conversation data:', error);
        }   return [];
    }   }
    }
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'auth-error';ement('div');
        errorDiv.textContent = message;r';
        errorDiv.textContent = message;
        const existingError = document.querySelector('.auth-error');
        if (existingError) existingError.remove();or('.auth-error');
        if (existingError) existingError.remove();
        const authForm = document.querySelector('.auth-form');
        authForm?.insertAdjacentElement('afterend', errorDiv);
        authForm?.insertAdjacentElement('afterend', errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
    }   setTimeout(() => errorDiv.remove(), 5000);
    }
    showMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'auth-message';ent('div');
        messageDiv.textContent = message;age';
        messageDiv.textContent = message;
        const existingMessage = document.querySelector('.auth-message');
        if (existingMessage) existingMessage.remove();('.auth-message');
        if (existingMessage) existingMessage.remove();
        const authForm = document.querySelector('.auth-form');
        authForm?.insertAdjacentElement('afterend', messageDiv);
        authForm?.insertAdjacentElement('afterend', messageDiv);
        setTimeout(() => messageDiv.remove(), 5000);
    }   setTimeout(() => messageDiv.remove(), 5000);
    }
    showAuthScreen() {
        document.getElementById('auth-container')?.classList.remove('hidden');
        document.getElementById('app-content')?.classList.add('hidden');den');
    }   document.getElementById('app-content')?.classList.add('hidden');
    }
    showMainApp(profile) {
        this.currentUser = profile;
        document.getElementById('auth-container')?.classList.add('hidden');
        document.getElementById('app-content')?.classList.remove('hidden');
        document.getElementById('app-content')?.classList.remove('hidden');
        const profileName = document.querySelector('.profile-name');
        if (profileName) {= document.querySelector('.profile-name');
            profileName.textContent = profile.display_name || profile.email;
        }   profileName.textContent = profile.display_name || profile.email;
        }
        // Render conversations immediately after login
        this.renderConversationsList();tely after login
    }   this.renderConversationsList();
    }
    showOnlineStatus(online = true) {
        const status = document.getElementById('status');
        if (!status) return;ent.getElementById('status');
        if (!status) return;
        status.textContent = online ? 'Online' : 'Offline';
        status.className = `status-indicator ${online ? '' : 'offline'} show`;
        status.className = `status-indicator ${online ? '' : 'offline'} show`;
        setTimeout(() => status.classList.remove('show'), 3000);
    }   setTimeout(() => status.classList.remove('show'), 3000);
    }
    setupThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        if (!themeToggle) return;ent.getElementById('theme-toggle');
        if (!themeToggle) return;
        const toggleTheme = () => {
            const currentTheme = document.body.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';);
            document.body.setAttribute('data-theme', newTheme);: 'dark';
            localStorage.setItem('theme', newTheme); newTheme);
            themeToggle.querySelector('.material-icons').textContent = 
                newTheme === 'dark' ? 'light_mode' : 'dark_mode';ent = 
        };      newTheme === 'dark' ? 'light_mode' : 'dark_mode';
        };
        themeToggle.addEventListener('click', toggleTheme);
    }   themeToggle.addEventListener('click', toggleTheme);
    }
    setupProfileHandlers() {
        const userProfile = document.getElementById('user-profile');
        const profileModal = document.getElementById('profile-modal');
        const closeProfileBtn = document.querySelectorAll('#close-profile, #cancel-profile');  // Get both close buttons    
        const closeProfileBtn = document.querySelectorAll('#close-profile, #cancel-profile');  // Get both close buttons    
        userProfile?.addEventListener('click', () => {
            profileModal?.classList.remove('hidden');{
            if (this.currentUser) {.remove('hidden');
                document.getElementById('display-name').value = this.currentUser.display_name || '';
                document.getElementById('status-message').value = this.currentUser.status || ''; '';
                document.getElementById('avatar-preview').src = = this.currentUser.status || '';
                    this.currentUser.avatar_url || 'images/default-avatar.png';
            }       this.currentUser.avatar_url || 'images/default-avatar.png';
        }); }
        });
        // Add click handler to all close buttons
        closeProfileBtn?.forEach(btn => { buttons
            btn.addEventListener('click', () => {
                profileModal?.classList.add('hidden');
            }); profileModal?.classList.add('hidden');
        }); });
        });
        // Close when clicking outside
        profileModal?.addEventListener('click', (e) => {
            if (e.target === profileModal) {k', (e) => {
                profileModal.classList.add('hidden');
            }   profileModal.classList.add('hidden');
        }); }
    }   });
    }
    setupMobileHandlers() {
        const backButton = document.getElementById('back-button');
        backButton?.addEventListener('click', () => {ack-button');
            this.logger.info('Back button clicked, returning to sidebar');
            const chatArea = document.querySelector('.chat-area');debar');
            const sidebar = document.querySelector('.sidebar');');
            if (chatArea) chatArea.classList.remove('active');;
            if (sidebar) sidebar.classList.remove('hidden'););
        }); if (sidebar) sidebar.classList.remove('hidden');
        });
        // Handle resizing properly
        window.addEventListener('resize', () => {
            this.adjustLayoutForScreenSize();=> {
        }); this.adjustLayoutForScreenSize();
        });
        // Initial adjustment
        this.adjustLayoutForScreenSize();
    }   this.adjustLayoutForScreenSize();
    }
    adjustLayoutForScreenSize() {
        const isMobile = window.innerWidth <= 768;
        const sidebar = document.querySelector('.sidebar');
        const chatArea = document.querySelector('.chat-area');
        const chatArea = document.querySelector('.chat-area');
        if (!sidebar || !chatArea) return;

        if (!isMobile) {
            // Desktop layout: both visible
            sidebar.classList.remove('hidden');move('active', 'hidden');
            chatArea.classList.remove('active', 'hidden');
        } else { sidebar
            // Mobile layout
            if (this.currentConversation) {chatArea) chatArea.classList.remove('active');
                // Show chat area when conversation is active
                sidebar.classList.add('hidden');ow chat area
                chatArea.classList.add('active');
                chatArea.classList.remove('hidden');   if (chatArea) chatArea.classList.add('active');
            } else {   }
                // Show sidebar when no conversation is selected    }
                sidebar.classList.remove('hidden');
                chatArea.classList.remove('active');ait) {
                chatArea.classList.add('hidden');
            }unction(...args) {
        }
        
        this.logger.info(`Layout adjusted for ${isMobile ? 'mobile' : 'desktop'}, conversation: ${this.currentConversation || 'none'}`);  func.apply(this, args);
    }

    debounce(func, wait) {  timeout = setTimeout(later, wait);
        let timeout;   };
        return function executedFunction(...args) {    }
            const later = () => {
                clearTimeout(timeout);ssages
                func.apply(this, args);
            };on if any
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);   this.currentSubscription.unsubscribe();
        };}
    }

    // Setup real-time subscription for new messagesssages(conversationId, (newMessage) => {
    setupMessageSubscription(conversationId) {
        // Clean up previous subscription if anyrsationId) {
        if (this.currentSubscription) {.handleNewMessage(newMessage);
            this.currentSubscription.unsubscribe();
        }ons
        this.showMessageNotification(newMessage);
        const dataModule = this.getModule('data');
        this.currentSubscription = dataModule.subscribeToNewMessages(conversationId, (newMessage) => { show unread indicator
            // Only handle if this is the current conversation   this.renderConversationsList();
            if (this.currentConversation === conversationId) { }
                this.handleNewMessage(newMessage);   });
            } else {    }
                // Show notification for other conversations
                this.showMessageNotification(newMessage);age
                
                // Update conversations list to show unread indicator-container');
                this.renderConversationsList();const isSent = message.sender_id === this.currentUser.id;
            }
        });wn messages again (already added when sent)
    }if (isSent) return;

    // Handle new incoming message'div');
    handleNewMessage(message) {
        const messageContainer = document.getElementById('message-container');geId = message.id;
        const isSent = message.sender_id === this.currentUser.id;
        
        // Don't show our own messages again (already added when sent)  <div class="message-info">${new Date(message.created_at).toLocaleTimeString()}</div>
        if (isSent) return;
        
        const messageEl = document.createElement('div');messageEl.scrollIntoView({ behavior: 'smooth' });
        messageEl.className = `message received`;
        messageEl.dataset.messageId = message.id;
        messageEl.innerHTML = `
            <div class="message-content">${message.content}</div>dataModule.markMessagesAsRead(this.currentConversation, this.currentUser.id);
            <div class="message-info">${new Date(message.created_at).toLocaleTimeString()}</div>
        `;ay notification sound for active conversation
        messageContainer.appendChild(messageEl);
        messageEl.scrollIntoView({ behavior: 'smooth' });this.getModule('notification');
        ({
        // Mark as read since we're viewing it
        const dataModule = this.getModule('data');ent.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
        dataModule.markMessagesAsRead(this.currentConversation, this.currentUser.id);
         showNotification: false
        // Play notification sound for active conversation
        try {
            const notificationModule = this.getModule('notification');ation sound:', error);
            notificationModule.notify({ation sound
                title: 'New Message',   this.playNotificationSound();
                message: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),   }
                soundType: 'message',    }
                showNotification: false
            });ges
        } catch (error) {geNotification(message) {
            this.logger.error('Error playing notification sound:', error);
            // Fallback to simple notification sound
            this.playNotificationSound();const notificationModule = this.getModule('notification');
        }
    }
const senderName = this.getSenderName(message.sender_id) || 'Someone';
    // Show notification for new messages
    showMessageNotification(message) {
        try {
            // Use notification module for OS-specific handlingng(0, 100) + (message.content.length > 100 ? '...' : ''),
            const notificationModule = this.getModule('notification');
            onversation_id,
            // Try to get sender name soundType: 'notification'
            const senderName = this.getSenderName(message.sender_id) || 'Someone';
            
            notificationModule.notify({this.logger.error('Error showing notification:', error);
                title: `New Message from ${senderName}`,
                message: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
                icon: 'images/icon-192x192.png',
                conversationId: message.conversation_id,otification('New Message', {
                soundType: 'notification'
            }); icon: 'images/icon-192x192.png'
        } catch (error) {});
            this.logger.error('Error showing notification:', error);
            k = () => {
            // Fallback to browser notification
            if (Notification.permission === 'granted') {  this.loadConversation(message.conversation_id);
                const notification = new Notification('New Message', {   };
                    body: message.content,}
                    icon: 'images/icon-192x192.png'
                });
                   this.playNotificationSound();
                notification.onclick = () => {   }
                    window.focus();    }
                    this.loadConversation(message.conversation_id);
                };d
            }icationSound() {
            
            // Play sound as fallbackudio('sounds/notification.mp3');
            this.playNotificationSound();= 0.5;
        }
    }
   this.logger.error('Failed to play notification sound:', error);
    // Play notification sound   }
    playNotificationSound() {    }
        try {
            const audio = new Audio('sounds/notification.mp3');onversation
            audio.volume = 0.5;
            audio.play();= document.querySelector(`.conversation-item[data-sender-id="${senderId}"]`);
        } catch (error) {
            this.logger.error('Failed to play notification sound:', error);'.conversation-name');
        }   return nameEl ? nameEl.textContent : null;
    }
   return null;
    // Get sender name from conversation    }
    getSenderName(senderId) {
        const conversation = document.querySelector(`.conversation-item[data-sender-id="${senderId}"]`);
        if (conversation) {= document.getElementById('profile-modal');
            const nameEl = conversation.querySelector('.conversation-name');
            return nameEl ? nameEl.textContent : null;
        }
        return null;);
    }tings';
ation-settings';
    setupNotificationHandlers() {
        const profileModal = document.getElementById('profile-modal');s</h3>
        if (profileModal) {
            // Check if notification settings section already existse-sounds">
            if (!document.getElementById('notification-settings')) {
                const notificationSection = document.createElement('div');ut type="checkbox" id="enable-sounds" checked>
                notificationSection.className = 'notification-settings';label>
                notificationSection.id = 'notification-settings';
                notificationSection.innerHTML = `
                    <h3>Notification Settings</h3>>
                    <div class="form-group">
                        <label for="enable-sounds">ut type="checkbox" id="enable-vibration" checked>
                            Enable Soundslabel>
                            <input type="checkbox" id="enable-sounds" checked>
                        </label>
                    </div>-permission" class="md-button">
                    <div class="form-group">e Notifications
                        <label for="enable-vibration">button>
                            Enable Vibration (Mobile)  </div>
                            <input type="checkbox" id="enable-vibration" checked>
                        </label>
                    </div>= profileModal.querySelector('.modal-buttons');
                    <div class="form-group">
                        <button id="notification-permission" class="md-button">lButtons.parentNode.insertBefore(notificationSection, modalButtons);
                            Enable Notifications
                        </button>   profileModal.querySelector('.profile-form').appendChild(notificationSection);
                    </div>                }
                `;
                // Insert before modal buttons
                const modalButtons = profileModal.querySelector('.modal-buttons');= document.getElementById('notification-permission');
                if (modalButtons) {
                    modalButtons.parentNode.insertBefore(notificationSection, modalButtons);
                } else {
                    profileModal.querySelector('.profile-form').appendChild(notificationSection);= await notificationModule.requestPermission();
                }

                // Setup notification permission buttonEnabled';
                const permissionBtn = document.getElementById('notification-permission');.showMessage('Notifications enabled!');
                if (permissionBtn) {
                    permissionBtn.addEventListener('click', async () => {   this.showError('Notification permission denied');
                        const notificationModule = this.getModule('notification'); }
                        const granted = await notificationModule.requestPermission();
                        if (granted) {ission
                            permissionBtn.disabled = true;ranted') {
                            permissionBtn.textContent = 'Notifications Enabled';
                            this.showMessage('Notifications enabled!');   permissionBtn.textContent = 'Notifications Enabled';
                        } else {   }
                            this.showError('Notification permission denied');                }
                        }
                    });
                    // Update button state based on current permission
                    if (Notification.permission === 'granted') {lementById('enable-vibration');
                        permissionBtn.disabled = true;
                        permissionBtn.textContent = 'Notifications Enabled';dule = this.getModule('notification');
                    }
                }
d = notificationModule.vibrationEnabled;
                // Setup toggle handlers
                const soundToggle = document.getElementById('enable-sounds');
                const vibrationToggle = document.getElementById('enable-vibration');undToggle.checked;
                if (soundToggle && vibrationToggle) { notificationModule.savePreferences();
                    const notificationModule = this.getModule('notification');
                    // Set initial state
                    soundToggle.checked = notificationModule.soundsEnabled; vibrationToggle.checked;
                    vibrationToggle.checked = notificationModule.vibrationEnabled; notificationModule.savePreferences();
                    // Add change handlers   });
                    soundToggle.addEventListener('change', () => {   }
                        notificationModule.soundsEnabled = soundToggle.checked;   }
                        notificationModule.savePreferences();   }
                    });    }
                    vibrationToggle.addEventListener('change', () => {
                        notificationModule.vibrationEnabled = vibrationToggle.checked;messages
                        notificationModule.savePreferences();
                    });ent.getElementById('message-container');
                }if (!messageContainer) return;
            }
        }
    }= this._createMessageElement(message);

    // Helper method to render messages   messageContainer.appendChild(messageEl);
    _renderMessages(messages) { }
        const messageContainer = document.getElementById('message-container');   });
        if (!messageContainer) return;    }
        
        messages.forEach(message => {d on message data
            const messageEl = this._createMessageElement(message); {
            if (messageEl) {if (!message) return null;
                messageContainer.appendChild(messageEl);
            }tUser.id;
        });
    } 'sent' : 'received'}`;
geId = message.id;
    // Create a message element based on message data
    _createMessageElement(message) {
        if (!message) return null;  <div class="message-info">${new Date(message.created_at).toLocaleTimeString()}</div>
        
        const isSent = message.sender_id === this.currentUser.id;   return messageEl;
        const messageEl = document.createElement('div');    }
        messageEl.className = `message ${isSent ? 'sent' : 'received'}`;
        messageEl.dataset.messageId = message.id;
        messageEl.innerHTML = `
            <div class="message-content">${message.content}</div>on if any
            <div class="message-info">${new Date(message.created_at).toLocaleTimeString()}</div>
        `;ribe();
        return messageEl;   this.currentSubscription = null;
    }}

    // Improve real-time message subscriptionthis.logger.info(`Setting up message subscription for conversation ${conversationId}`);
    _setupMessageSubscription(conversationId) {
        try {
            // Log and cleanup any previous subscription{
            if (this.currentSubscription) {this.logger.info(`Received real-time message update for conversation ${conversationId}`);
                this.logger.info(`Cleaning up previous subscription for conversation ${this.currentSubscription.conversationId || 'unknown'}`);
                try {sation
                    this.currentSubscription.unsubscribe();sationId) {
                } catch (err) {
                    this.logger.error('Error cleaning up previous subscription:', err);s.currentUser.id) {
                }
                this.currentSubscription = null;this._addMessageToUI(newMessage);
            }
            
            this.logger.info(`Setting up new real-time subscription for conversation ${conversationId}`);   dataModule.markMessagesAsRead(conversationId, this.currentUser.id);
            
            const dataModule = this.getModule('data');
             conversations
            // Create new subscriptionthis._showMessageNotification(newMessage);
            this.currentSubscription = dataModule.subscribeToNewMessages(conversationId, (newMessage) => {
                this.logger.info(`Received real-time message in conversation ${conversationId}:`, newMessage.id); show unread indicator
                   this.renderConversationsList();
                // Check if we're still viewing this conversation }
                if (this.currentConversation === conversationId) {   });
                    this.logger.info('Message is for current conversation');    }
                    
                    // Don't show our own messages twicee UI
                    if (newMessage.sender_id !== this.currentUser.id) {
                        this.logger.info('Adding message to UI');ent.getElementById('message-container');
                        if (!messageContainer) return;
                        // Add message to UI
                        this._addMessageToUI(newMessage);
                        ment.querySelector(`.message[data-message-id="${message.id}"]`);
                        // Mark as readif (existingMessage) return;
                        dataModule.markMessagesAsRead(conversationId, this.currentUser.id);
                    } else {= this._createMessageElement(message);
                        this.logger.info('Ignoring own message from subscription');
                    }
                } else {erySelector('.no-messages');
                    this.logger.info('Message is for a different conversation, showing notification');if (noMessagesEl) noMessagesEl.remove();
                    
                    // Show notification for messages in other conversations
                    this._showMessageNotification(newMessage);
                    messageEl.scrollIntoView({ behavior: 'smooth' });
                    // Update conversations list for unread indicator
                    this.renderConversationsList();
                }   this._playIncomingMessageSound();
            });   }
                }
            this.logger.info('Real-time subscription setup completed');
        } catch (error) {coming messages
            this.logger.error('Error setting up message subscription:', error);mingMessageSound() {
        }
    }= this.getModule('notification');

    // Add a new message to the UI with improved error handling({
    _addMessageToUI(message) {Message',
        try {
            this.logger.info(`Adding message ${message.id} to UI`);
            const messageContainer = document.getElementById('message-container'); showNotification: false
               });
            if (!messageContainer) {
                this.logger.error('Message container not found');
                return;   this.logger.error('Error playing message sound:', error);
            }   }
                }
            // Check if this message is already in the UI
            const existingMessage = document.querySelector(`.message[data-message-id="${message.id}"]`);n other conversations
            if (existingMessage) {ageNotification(message) {
                this.logger.info(`Message ${message.id} already exists in UI, skipping`);
                return;= this.getModule('notification');
            }
            
            // Create message elementne';
            const messageEl = this._createMessageElement(message);
            if (!messageEl) {   senderName = message.profiles.display_name || message.profiles.email || 'Someone';
                this.logger.error('Failed to create message element');}
                return;
            }
            
            // Remove "no messages" placeholder if present0) + (message.content.length > 100 ? '...' : ''),
            const noMessagesEl = messageContainer.querySelector('.no-messages');onversation_id,
            if (noMessagesEl) { soundType: 'notification'
                noMessagesEl.remove();   });
            }
            
            // Add message to container   this.logger.error('Error showing message notification:', error);
            messageContainer.appendChild(messageEl);   }
                }
            // Scroll into view with a small delay to ensure rendering completes
            setTimeout(() => {
                messageEl.scrollIntoView({ behavior: 'smooth' });
            }, 50);
                    const chatArea = document.querySelector('.chat-area');
            // Play notification sound for active conversation
            this._playIncomingMessageSound();        if (!sidebar || !chatArea) return;
            
            this.logger.info(`Message ${message.id} successfully added to UI`);
        } catch (error) {
            this.logger.error('Error adding message to UI:', error);
        }Area.classList.remove('active', 'hidden');
    }

    // Improve real-time message subscription
    _setupMessageSubscription(conversationId) {ion is active
        // Clean up previous subscription if any
        if (this.currentSubscription) {
            this.currentSubscription.unsubscribe();Area.classList.remove('hidden');
            this.currentSubscription = null;
        }n is selected
        
        this.logger.info(`Setting up message subscription for conversation ${conversationId}`);');
           chatArea.classList.add('hidden');
        const dataModule = this.getModule('data');   }
        this.currentSubscription = dataModule.subscribeToNewMessages(conversationId, (newMessage) => {}
            this.logger.info(`Received real-time message update for conversation ${conversationId}`);
               this.logger.info(`Layout adjusted for ${isMobile ? 'mobile' : 'desktop'}, conversation: ${this.currentConversation || 'none'}`);
            // Only handle if this is still the current conversation   }
            if (this.currentConversation === conversationId) {
















































































































}    }        this.logger.info(`Layout adjusted for ${isMobile ? 'mobile' : 'desktop'}, conversation: ${this.currentConversation || 'none'}`);                }            }                chatArea.classList.add('hidden');                chatArea.classList.remove('active');                sidebar.classList.remove('hidden');                // Show sidebar when no conversation is selected            } else {                chatArea.classList.remove('hidden');                chatArea.classList.add('active');                sidebar.classList.add('hidden');                // Show chat area when conversation is active            if (this.currentConversation) {            // Mobile layout        } else {            chatArea.classList.remove('active', 'hidden');            sidebar.classList.remove('hidden');            // Desktop layout: both visible        if (!isMobile) {        if (!sidebar || !chatArea) return;        const chatArea = document.querySelector('.chat-area');        const sidebar = document.querySelector('.sidebar');        const isMobile = window.innerWidth <= 768;    adjustLayoutForScreenSize() {    }        }            this.logger.error('Error showing message notification:', error);        } catch (error) {            }                });                    soundType: 'notification'                    conversationId: message.conversation_id,                    message: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),                    title: `New Message from ${senderName}`,                notificationModule.notify({                                }                    senderName = message.profiles.display_name || message.profiles.email || 'Someone';                if (message.profiles) {                let senderName = 'Someone';                // Try to get sender name            if (notificationModule) {            const notificationModule = this.getModule('notification');        try {    _showMessageNotification(message) {    // Show notification for messages in other conversations    }        }            this.logger.error('Error playing message sound:', error);        } catch (error) {            }                });                    showNotification: false                    soundType: 'message',                    message: '',                    title: 'New Message',                notificationModule.notify({            if (notificationModule) {            const notificationModule = this.getModule('notification');        try {    _playIncomingMessageSound() {    // Play a subtle sound for incoming messages    }        }            this._playIncomingMessageSound();            // Play notification sound                        messageEl.scrollIntoView({ behavior: 'smooth' });            messageContainer.appendChild(messageEl);            // Add message and scroll into view                        if (noMessagesEl) noMessagesEl.remove();            const noMessagesEl = messageContainer.querySelector('.no-messages');            // Remove "no messages" indicator if present        if (messageEl) {        const messageEl = this._createMessageElement(message);                if (existingMessage) return;        const existingMessage = document.querySelector(`.message[data-message-id="${message.id}"]`);        // Check if this message already exists in the UI                if (!messageContainer) return;        const messageContainer = document.getElementById('message-container');    _addMessageToUI(message) {    // Add a new message to the UI    }        });            }                this.renderConversationsList();                // Update conversations list to show unread indicator                                this._showMessageNotification(newMessage);                // Show notification for messages in other conversations            } else {                }                    dataModule.markMessagesAsRead(conversationId, this.currentUser.id);                    // Mark as read since we're viewing it                                        this._addMessageToUI(newMessage);                    // Add the message to the UI                if (newMessage.sender_id !== this.currentUser.id) {                // Don't add our own messages again    // Add this new method to handle events from other modules
    setupSpecialEvents() {
        // Listen for notification click events
        window.addEventListener('open-conversation', (event) => {
            const { conversationId } = event.detail;
            if (conversationId) {
                this.logger.info(`Open conversation event received for: ${conversationId}`);
                this.loadConversation(conversationId);
            }
        });
        
        // Could add more special events here as needed
    }
}
