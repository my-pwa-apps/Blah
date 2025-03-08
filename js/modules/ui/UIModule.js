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
        await this.setupConversationMonitor(); // Add this line
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
                try {
                    // CRITICAL FIX: Use the explicit isSelfChat property from DataModule
                    const isSelfChat = Boolean(conv.isSelfChat);
                    
                    // Debug logging with more details
                    this.logger.info(`Rendering conversation ${conv.id}:`, {
                        is_self_chat_flag: conv.is_self_chat,
                        isSelfChat: isSelfChat,
                        participantCount: conv.participants?.length,
                        participants: conv.participants?.map(p => p.user_id)
                    });
                    
                    let displayName, avatarUrl;
                    
                    if (isSelfChat) {
                        displayName = 'Notes to Self';
                        avatarUrl = this.currentUser.avatar_url;
                        this.logger.info(`Rendering self-chat: ${conv.id}`);
                    } else {
                        // Find the other participants (not the current user)
                        const otherUsers = conv.participants.filter(p => p.user_id !== this.currentUser.id);
                        
                        if (otherUsers.length > 0) {
                            const otherUser = otherUsers[0];
                            if (otherUser && otherUser.profiles) {
                                displayName = otherUser.profiles.display_name || otherUser.profiles.email || 'Unknown User';
                                avatarUrl = otherUser.profiles.avatar_url;
                                this.logger.info(`Rendering chat with: ${displayName} (${otherUser.user_id}), conversation: ${conv.id}`);
                            } else {
                                displayName = 'Unknown User';
                                avatarUrl = null;
                                this.logger.info(`Rendering chat with unknown user: ${conv.id}`);
                            }
                        } else {
                            // This shouldn't happen with our improved logic, but just in case
                            displayName = 'Unknown Chat';
                            avatarUrl = null;
                            this.logger.warn(`No other participants found for non-self chat: ${conv.id}`);
                        }
                    }
                    
                    // Check if this conversation has unread messages
                    const hasUnread = this._hasUnreadMessages(conv);
                    
                    // Create conversation element
                    const conversationEl = document.createElement('div');
                    conversationEl.className = `conversation-item${conv.id === this.currentConversation ? ' active' : ''}${hasUnread ? ' unread' : ''}`;
                    conversationEl.dataset.conversationId = conv.id;
                    conversationEl.dataset.isSelfChat = String(isSelfChat); // Store as string
                    
                    // Store other user ID for easier lookups (only for non-self chats)
                    if (!isSelfChat && conv.participants) {
                        const otherUsers = conv.participants.filter(p => p.user_id !== this.currentUser.id);
                        if (otherUsers.length > 0) {
                            conversationEl.dataset.otherUserId = otherUsers[0].user_id;
                        }
                    }
                    
                    conversationEl.innerHTML = `
                        <div class="conversation-avatar">
                            <img src="${avatarUrl || 'images/default-avatar.png'}" alt="Avatar">
                        </div>
                        <div class="conversation-details">
                            <div class="conversation-name">${displayName}</div>
                            <div class="conversation-last-message">
                                ${conv.last_message?.content || 'No messages yet'}
                            </div>
                        </div>
                        ${hasUnread ? '<div class="unread-indicator"></div>' : ''}
                    `;
                    
                    // Add click handler
                    conversationEl.addEventListener('click', () => this.loadConversation(conv.id));
                    
                    // Add to list
                    conversationsList.appendChild(conversationEl);
                } catch (err) {
                    this.logger.error(`Error rendering conversation ${conv.id}:`, err);
                }
            }
            
            // Fix mobile layout issues
            this.adjustLayoutForScreenSize();
            
        } catch (error) {
            this.logger.error('Failed to render conversations list:', error);
            this.showError('Failed to load conversations');
        }
    }

    // Improved method to check for unread messages
    _hasUnreadMessages(conversation) {
        if (!conversation.last_message || conversation.last_message.sender_id === this.currentUser.id) {
            return false;
        }
        const lastMessageTime = new Date(conversation.last_message.created_at);
        // Use either the participant record or the conversation user last read time
        const lastReadAt = conversation.userLastRead || 
                          conversation.participants?.find(p => p.user_id === this.currentUser.id)?.last_read_at;
        if (!lastReadAt) return true; // Unread if no read timestamp
        const lastReadTime = new Date(lastReadAt);
        return lastMessageTime > lastReadTime;
    }

    setupMessageListeners() {
        // Create message input area
        const messageInputArea = document.createElement('div');
        messageInputArea.id = 'message-input-area';
        messageInputArea.className = 'message-input';
        
        // Create file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'file-input';
        fileInput.multiple = true;
        fileInput.accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt';
        fileInput.style.display = 'none';
        
        // Create buttons and input
        const attachButton = document.createElement('button');
        attachButton.className = 'attach-button';
        attachButton.innerHTML = '<span class="material-icons">attach_file</span>';
        
        const messageInput = document.createElement('input');
        messageInput.type = 'text';
        messageInput.id = 'message-text';
        messageInput.placeholder = 'Type a message...';
        
        const sendButton = document.createElement('button');
        sendButton.id = 'send-button';
        sendButton.className = 'md-button primary';
        sendButton.innerHTML = '<span class="material-icons">send</span>';
        
        // Assemble the input area
        messageInputArea.appendChild(fileInput);
        messageInputArea.appendChild(attachButton);
        messageInputArea.appendChild(messageInput);
        messageInputArea.appendChild(sendButton);
        
        // Add to chat area
        document.querySelector('.chat-area').appendChild(messageInputArea);
        
        // Initialize attachments array
        this.pendingAttachments = [];
        
        // Add event listeners
        attachButton.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                this.handleFileSelection(fileInput.files);
                fileInput.value = ''; // Clear the input for future selections
            }
        });
        
        // Add message send handlers
        sendButton.addEventListener('click', () => this.handleSendMessage());
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });
    }

    async handleFileSelection(files) {
        const dataModule = this.getModule('data');
        const maxSize = 10 * 1024 * 1024; // 10MB limit
        
        for (const file of files) {
            if (file.size > maxSize) {
                this.showError(`File ${file.name} is too large. Maximum size is 10MB.`);
                continue;
            }
            
            try {
                // Show loading indicator
                const previewArea = document.getElementById('attachment-preview') || this.createAttachmentPreviewArea();
                const loadingItem = document.createElement('div');
                loadingItem.className = 'attachment-preview-item loading';
                loadingItem.innerHTML = `<span>Uploading ${file.name}...</span>`;
                previewArea.appendChild(loadingItem);

                // Upload file
                const attachment = await dataModule.uploadAttachment(file, this.currentUser.id);
                
                // Remove loading indicator
                loadingItem.remove();
                
                // Update UI with successful upload
                this.pendingAttachments.push(attachment);
                this.showAttachmentPreview(attachment);
                
            } catch (error) {
                this.logger.error('Failed to upload file:', error);
                this.showError(`Failed to upload ${file.name}`);
                loadingItem?.remove();
            }
        }
    }

    async handleSendMessage() {
        // Get UI elements
        const messageInput = document.getElementById('message-text');
        const sendButton = document.getElementById('send-button');
        const messageContainer = document.getElementById('message-container');
        
        // Get message content
        const content = messageInput?.value?.trim() || '';
        
        // Check if we have anything to send
        if (!content && this.pendingAttachments.length === 0) {
            return;
        }
        
        // Disable input while sending
        messageInput.disabled = true;
        sendButton.disabled = true;
        
        try {
            const dataModule = this.getModule('data');
            
            // Create self-conversation if none exists
            if (!this.currentConversation) {
                const conversation = await dataModule.createConversation([this.currentUser.id]);
                this.currentConversation = conversation.id;
            }
            
            // Send message with any attachments
            const message = await dataModule.sendMessage(
                this.currentConversation,
                this.currentUser.id,
                content,
                this.pendingAttachments
            );
            
            // Clear input and attachments
            messageInput.value = '';
            this.pendingAttachments = [];
            document.getElementById('attachment-preview')?.remove();
            
            // Add message to UI
            const messageEl = this._createMessageElement(message);
            messageContainer.appendChild(messageEl);
            messageEl.scrollIntoView({ behavior: 'smooth' });
            
            this.logger.info('Message sent successfully');
            
        } catch (error) {
            this.logger.error('Failed to send message:', error);
            this.showError('Failed to send message');
        } finally {
            // Re-enable input
            messageInput.disabled = false;
            sendButton.disabled = false;
            messageInput.focus();
        }
    }

    async loadConversation(conversationId) {
        if (!conversationId) {
            this.logger.error('Cannot load conversation: No ID provided');
            return;
        }
        
        this.logger.info(`Loading conversation: ${conversationId}`);
        this.currentConversation = conversationId;
        
        // Get UI elements
        const messageContainer = document.getElementById('message-container');
        const chatArea = document.querySelector('.chat-area');
        const sidebar = document.querySelector('.sidebar');
        
        if (!messageContainer) {
            this.logger.error('Message container not found');
            return;
        }
        
        // Update UI to show active conversation
        document.querySelectorAll('.conversation-item').forEach(item => {
            if (item.dataset.conversationId === conversationId) {
                item.classList.add('active');
                this.logger.info(`Set active class on conversation ${conversationId}`);
            } else {
                item.classList.remove('active');
            }
        });
        
        // Find the conversation item to get its name and other data
        const conversationItem = document.querySelector(`.conversation-item[data-conversation-id="${conversationId}"]`);
        
        // Update chat header title with correct name
        const chatHeader = document.querySelector('.chat-title');
        if (chatHeader && conversationItem) {
            const nameEl = conversationItem.querySelector('.conversation-name');
            chatHeader.textContent = nameEl ? nameEl.textContent : 'Chat';
            
            // Add data attribute to header to identify chat type
            chatHeader.dataset.isSelfChat = conversationItem.dataset.isSelfChat || 'false';
        }
        
        // For mobile, disable transitions when showing chat area
        if (window.innerWidth <= 768) {
            chatArea?.classList.add('no-transition');
            sidebar?.classList.add('no-transition');
            
            // Force browser to acknowledge the class change
            void chatArea?.offsetWidth;
            
            // Show chat area (especially important on mobile)
            if (chatArea) {
                chatArea.classList.add('active');
            }
            
            // Hide sidebar on mobile
            if (sidebar) {
                sidebar.classList.add('hidden');
            }
            
            // Re-enable transitions after a short delay
            setTimeout(() => {
                chatArea?.classList.remove('no-transition');
                sidebar?.classList.remove('no-transition');
            }, 50);
        } else {
            // For desktop, just update classes
            if (chatArea) {
                chatArea.classList.add('active');
            }
        }
        
        // Check if conversation is in the list, if not, refresh the list
        if (!conversationItem) {
            this.logger.info(`Conversation ${conversationId} not in list, refreshing list`);
            await this.renderConversationsList();
        }

        try {
            const dataModule = this.getModule('data');
            const messages = await dataModule.fetchMessages(conversationId);
            
            // Clear existing messages
            messageContainer.innerHTML = '';
            
            if (messages.length === 0) {
                // Show empty state
                messageContainer.innerHTML = '<div class="no-messages">No messages yet. Start typing to send a message.</div>';
            } else {
                this._renderMessages(messages);
            }
            
            // Scroll to bottom
            messageContainer.scrollTop = messageContainer.scrollHeight;
            
            // Focus the message input
            document.getElementById('message-text')?.focus();
            
            // Mark conversation as read
            await dataModule.markMessagesAsRead(conversationId, this.currentUser.id);
            
            // Remove unread indicator
            const conversationEl = document.querySelector(`.conversation-item[data-conversation-id="${conversationId}"]`);
            if (conversationEl) {
                conversationEl.classList.remove('unread');
                conversationEl.querySelector('.unread-indicator')?.remove();
            }
            
            // Setup real-time subscription for new messages
            this._setupMessageSubscription(conversationId);
        } catch (error) {
            this.logger.error('Failed to load conversation messages:', error);
            this.showError('Failed to load messages');
        }
    }

    async startNewConversation(userId) {
        try {
            this.logger.info(`Starting conversation with user ID: ${userId}`);
            // Create participants array with correct order and structure
            const participants = [];
            // Always include current user first
            participants.push(this.currentUser.id);
            // Check if this is a self-chat or chat with another user
            if (userId !== this.currentUser.id) {
                participants.push(userId);
                this.logger.info(`Creating chat with other user: ${userId}`);
            } else {
                this.logger.info('Creating self-chat conversation');
            }
            const dataModule = this.getModule('data');
            // Create the conversation
            const conversation = await dataModule.createConversation(participants);
            if (!conversation || !conversation.id) {
                throw new Error('Failed to create conversation');
            }
            this.logger.info(`Created conversation with ID: ${conversation.id}`);
            // Close the conversation modal
            const modal = document.getElementById('new-conversation-modal');
            if (modal) modal.classList.add('hidden');
            // Set as current conversation
            this.currentConversation = conversation.id;
            // Update UI in correct sequence
            await this.renderConversationsList();
            // Wait for DOM updates to complete
            await new Promise(resolve => setTimeout(resolve, 300));
            // Now load the conversation
            await this.loadConversation(conversation.id);
            this.logger.info('New conversation created and loaded successfully');
        } catch (error) {
            this.logger.error('Failed to start conversation:', error);
            this.showError('Failed to create conversation: ' + error.message);
        }
    }

    async loadConversationData(conversationId) {
        try {
            this.logger.info(`Loading conversation data for: ${conversationId}`);
            const dataModule = this.getModule('data');
            const messages = await dataModule.fetchMessages(conversationId);
            this.logger.info(`Loaded ${messages.length} messages for conversation ${conversationId}`);
            return messages;
        } catch (error) {
            this.logger.error('Failed to load conversation data:', error);
            return [];
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
        // Render conversations immediately after login
        this.renderConversationsList();
    }

    showOnlineStatus(online = true) {
        const status = document.getElementById('status');
        if (!status) return;
        status.textContent = online ? 'Online' : 'Offline';
        status.className = `status-indicator ${online ? '' : 'offline'} show`;
        setTimeout(() => status.classList.remove('show'), 3000);
    }

    setupThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        if (!themeToggle) return;
        const toggleTheme = () => {
            const currentTheme = document.body.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            themeToggle.querySelector('.material-icons').textContent = 
                newTheme === 'dark' ? 'light_mode' : 'dark_mode';
        };
        themeToggle.addEventListener('click', toggleTheme);
    }

    setupProfileHandlers() {
        const userProfile = document.getElementById('user-profile');
        const profileModal = document.getElementById('profile-modal');
        const closeProfileBtn = document.querySelectorAll('#close-profile, #cancel-profile');  // Get both close buttons    
        userProfile?.addEventListener('click', () => {
            profileModal?.classList.remove('hidden');
            if (this.currentUser) {
                document.getElementById('display-name').value = this.currentUser.display_name || '';
                document.getElementById('status-message').value = this.currentUser.status || '';
                document.getElementById('avatar-preview').src = 
                    this.currentUser.avatar_url || 'images/default-avatar.png';
            }
        });
        // Add click handler to all close buttons
        closeProfileBtn?.forEach(btn => {
            btn.addEventListener('click', () => {
                profileModal?.classList.add('hidden');
            });
        });
        // Close when clicking outside
        profileModal?.addEventListener('click', (e) => {
            if (e.target === profileModal) {
                profileModal.classList.add('hidden');
            }
        });
    }

    setupMobileHandlers() {
        const backButton = document.getElementById('back-button');
        if (backButton) {
            // Remove any existing event listeners to prevent conflicts
            backButton.replaceWith(backButton.cloneNode(true));
            
            // Get the fresh element after replacement
            const newBackButton = document.getElementById('back-button');
            
            // Add a new clean event listener
            newBackButton.addEventListener('click', (e) => {
                // Prevent any default behavior or event propagation
                e.preventDefault();
                e.stopPropagation();
                
                this.logger.info('Back button clicked - handling navigation');
                
                // CRITICAL: First reset conversation state before any UI changes
                this.currentConversation = null;
                
                // Get UI elements
                const chatArea = document.querySelector('.chat-area');
                const sidebar = document.querySelector('.sidebar');
                
                if (!chatArea || !sidebar) {
                    this.logger.error('Required UI elements not found');
                    return;
                }
                
                // Apply all changes synchronously and directly
                try {
                    // Disable all transitions temporarily
                    chatArea.style.transition = 'none';
                    sidebar.style.transition = 'none';
                    
                    // Force browser to process the style changes
                    void chatArea.offsetWidth;
                    void sidebar.offsetWidth;
                    
                    // Update classes immediately
                    chatArea.classList.remove('active');
                    sidebar.classList.remove('hidden');
                    
                    // Update back button visibility
                    newBackButton.style.display = 'none';
                    
                    // Log the state to confirm changes
                    this.logger.info('UI state updated: chat inactive, sidebar visible');
                    
                    // Re-enable transitions after a short delay
                    setTimeout(() => {
                        chatArea.style.transition = '';
                        sidebar.style.transition = '';
                        this.adjustLayoutForScreenSize();
                        this.logger.info('Transitions restored and layout adjusted');
                    }, 50);
                } catch (error) {
                    this.logger.error('Error during back button handling:', error);
                }
                
                return false;
            }, { passive: false });
            
            this.logger.info('Back button handler replaced with improved version');
            
            // Set initial visibility based on screen size
            const isMobile = window.innerWidth <= 768;
            backButton.style.display = (isMobile && this.currentConversation) ? 'flex' : 'none';
        }
        
        // Handle resizing properly
        window.addEventListener('resize', () => {
            this.adjustLayoutForScreenSize();
        });
        
        // Initial adjustment
        this.adjustLayoutForScreenSize();
    }

    adjustLayoutForScreenSize() {
        const isMobile = window.innerWidth <= 768;
        const sidebar = document.querySelector('.sidebar');
        const chatArea = document.querySelector('.chat-area');
        const backButton = document.getElementById('back-button');
        
        if (!sidebar || !chatArea) return;

        this.logger.info(`Adjusting layout for ${isMobile ? 'mobile' : 'desktop'}, conversation: ${this.currentConversation || 'none'}`);

        if (!isMobile) {
            // Desktop layout: both visible side by side (controlled by CSS grid)
            sidebar.classList.remove('hidden');
            chatArea.classList.remove('active', 'hidden');
            
            // Always hide back button on desktop
            if (backButton) backButton.style.display = 'none';
        } else {
            // Mobile layout
            if (this.currentConversation) {
                // Show chat area when conversation is active
                sidebar.classList.add('hidden');
                chatArea.classList.add('active');
                chatArea.classList.remove('hidden');
                
                // Show back button on mobile when in conversation
                if (backButton) backButton.style.display = 'flex';
                
                this.logger.info('Mobile layout: showing chat area');
            } else {
                // Show sidebar when no conversation is selected
                sidebar.classList.remove('hidden');
                chatArea.classList.remove('active');
                chatArea.classList.add('hidden');
                
                // Hide back button when viewing sidebar on mobile
                if (backButton) backButton.style.display = 'none';
                
                this.logger.info('Mobile layout: showing conversation list');
            }
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Setup real-time subscription for new messages
    setupMessageSubscription(conversationId) {
        // Clean up previous subscription if any
        if (this.currentSubscription) {
            this.currentSubscription.unsubscribe();
        }
        this.currentSubscription = this.getModule('data').subscribeToNewMessages(conversationId, (newMessage) => {
            // Only handle if this is the current conversation
            if (this.currentConversation === conversationId) {
                this.handleNewMessage(newMessage);
            } else {
                // Show notification for other conversations
                this.showMessageNotification(newMessage);
                
                // Update conversations list to show unread indicator
                this.renderConversationsList();
            }
        });
    }

    // Handle new incoming message
    handleNewMessage(message) {
        const messageContainer = document.getElementById('message-container');
        const isSent = message.sender_id === this.currentUser.id;
        
        // Don't show our own messages again (already added when sent)
        if (isSent) return;
        
        const messageEl = document.createElement('div');
        messageEl.className = `message received`;
        messageEl.dataset.messageId = message.id;
        messageEl.innerHTML = `
            <div class="message-content">${message.content}</div>
            <div class="message-info">${new Date(message.created_at).toLocaleTimeString()}</div>
        `;
        messageContainer.appendChild(messageEl);
        messageEl.scrollIntoView({ behavior: 'smooth' });
        
        // Mark as read since we're viewing it
        const dataModule = this.getModule('data');
        dataModule.markMessagesAsRead(this.currentConversation, this.currentUser.id);
        
        // Play notification sound for active conversation
        try {
            const notificationModule = this.getModule('notification');
            notificationModule.notify({
                title: 'New Message',
                message: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
                soundType: 'message',
                showNotification: false
            });
        } catch (error) {
            this.logger.error('Error playing notification sound:', error);
            // Fallback to simple notification sound
            this.playNotificationSound();
        }
    }

    // Show notification for new messages
    showMessageNotification(message) {
        try {
            // Use notification module for OS-specific handling
            const notificationModule = this.getModule('notification');
            // Try to get sender name
            const senderName = this.getSenderName(message.sender_id) || 'Someone';
            
            notificationModule.notify({
                title: `New Message from ${senderName}`,
                message: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
                icon: 'images/icon-192x192.png',
                conversationId: message.conversation_id,
                soundType: 'notification'
            });
        } catch (error) {
            this.logger.error('Error showing notification:', error);
            // Fallback to browser notification
            if (Notification.permission === 'granted') {
                const notification = new Notification('New Message', {
                    body: message.content,
                    icon: 'images/icon-192x192.png'
                });
                notification.onclick = () => {
                    window.focus();
                    this.loadConversation(message.conversation_id);
                };
            }
            // Play sound as fallback
            this.playNotificationSound();
        }
    }

    // Play notification sound
    playNotificationSound() {
        try {
            const audio = new Audio('sounds/notification.mp3');
            audio.volume = 0.5;
            audio.play();
        } catch (error) {
            this.logger.error('Failed to play notification sound:', error);
        }
    }

    // Get sender name from conversation
    getSenderName(senderId) {
        const conversation = document.querySelector(`.conversation-item[data-sender-id="${senderId}"]`);
        if (conversation) {
            const nameEl = conversation.querySelector('.conversation-name');
            return nameEl ? nameEl.textContent : null;
        }
        return null;
    }

    setupNotificationHandlers() {
        const profileModal = document.getElementById('profile-modal');
        if (profileModal) {
            // Check if notification settings section already exists
            if (!document.getElementById('notification-settings')) {
                const notificationSection = document.createElement('div');
                notificationSection.className = 'notification-settings';
                notificationSection.id = 'notification-settings';
                notificationSection.innerHTML = `
                    <h3>Notification Settings</h3>
                    <div class="form-group">
                        <label for="enable-sounds">
                            Enable Sounds
                            <input type="checkbox" id="enable-sounds" checked>
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="enable-vibration">
                            Enable Vibration (Mobile)
                            <input type="checkbox" id="enable-vibration" checked>
                        </label>
                    </div>
                    <div class="form-group">
                        <button id="notification-permission" class="md-button">
                            Enable Notifications
                        </button>
                    </div>
                `;
                // Insert before modal buttons
                const modalButtons = profileModal.querySelector('.modal-buttons');
                if (modalButtons) {
                    modalButtons.parentNode.insertBefore(notificationSection, modalButtons);
                } else {
                    profileModal.querySelector('.profile-form').appendChild(notificationSection);
                }

                // Setup notification permission button
                const permissionBtn = document.getElementById('notification-permission');
                if (permissionBtn) {
                    permissionBtn.addEventListener('click', async () => {
                        const notificationModule = this.getModule('notification');
                        const granted = await notificationModule.requestPermission();
                        if (granted) {
                            permissionBtn.disabled = true;
                            permissionBtn.textContent = 'Notifications Enabled';
                            this.showMessage('Notifications enabled!');
                        } else {
                            this.showError('Notification permission denied');
                        }
                    });
                    // Update button state based on current permission
                    if (Notification.permission === 'granted') {
                        permissionBtn.disabled = true;
                        permissionBtn.textContent = 'Notifications Enabled';
                    }
                }

                // Setup toggle handlers
                const soundToggle = document.getElementById('enable-sounds');
                const vibrationToggle = document.getElementById('enable-vibration');
                if (soundToggle && vibrationToggle) {
                    const notificationModule = this.getModule('notification');
                    // Set initial state
                    soundToggle.checked = notificationModule.soundsEnabled;
                    vibrationToggle.checked = notificationModule.vibrationEnabled;
                    // Add change handlers
                    soundToggle.addEventListener('change', () => {
                        notificationModule.soundsEnabled = soundToggle.checked;
                        notificationModule.savePreferences();
                    });
                    vibrationToggle.addEventListener('change', () => {
                        notificationModule.vibrationEnabled = vibrationToggle.checked;
                        notificationModule.savePreferences();
                    });
                }
            }
        }
    }

    // Helper method to render messages
    _renderMessages(messages) {
        const messageContainer = document.getElementById('message-container');
        if (!messageContainer) return;
        
        messages.forEach(message => {
            const messageEl = this._createMessageElement(message);
            if (messageEl) {
                messageContainer.appendChild(messageEl);
            }
        });
        
        // Scroll to the latest message
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }

    // Create a message element based on message data
    _createMessageElement(message) {
        if (!message) return null;
        
        const isSent = message.sender_id === this.currentUser.id;
        const messageEl = document.createElement('div');
        messageEl.className = `message ${isSent ? 'sent' : 'received'}`;
        messageEl.dataset.messageId = message.id;

        // Add delete button for sent messages
        const deleteButton = isSent ? `
            <button class="message-delete" aria-label="Delete message">
                <span class="material-icons">delete</span>
            </button>
        ` : '';

        // Add attachments if present
        const attachments = message.metadata?.attachments || [];
        const attachmentsHtml = attachments.map(attachment => {
            if (attachment.type.startsWith('image/')) {
                return `
                    <div class="attachment image">
                        <img src="${attachment.url}" alt="${attachment.name}" 
                             onclick="window.open('${attachment.url}', '_blank')">
                    </div>
                `;
            } else {
                return `
                    <div class="attachment file">
                        <a href="${attachment.url}" target="_blank">
                            <span class="material-icons">attach_file</span>
                            ${attachment.name}
                        </a>
                    </div>
                `;
            }
        }).join('');

        messageEl.innerHTML = `
            <div class="message-content">${message.content}</div>
            ${attachmentsHtml}
            <div class="message-info">
                ${new Date(message.created_at).toLocaleTimeString()}
                ${deleteButton}
            </div>
        `;

        // Add delete handler
        if (isSent) {
            const deleteBtn = messageEl.querySelector('.message-delete');
            deleteBtn?.addEventListener('click', async () => {
                if (confirm('Are you sure you want to delete this message?')) {
                    try {
                        await this.getModule('data').deleteMessage(message.id, this.currentUser.id);
                        messageEl.remove();
                    } catch (error) {
                        this.showError('Failed to delete message');
                    }
                }
            });
        }

        return messageEl;
    }

    // Improve real-time message subscription
    _setupMessageSubscription(conversationId) {
        try {
            // Log and cleanup any previous subscription
            if (this.currentSubscription) {
                this.logger.info(`Cleaning up previous subscription for conversation ${this.currentSubscription.conversationId || 'unknown'}`);
                try {
                    this.currentSubscription.unsubscribe();
                } catch (err) {
                    this.logger.error('Error cleaning up previous subscription:', err);
                }
                this.currentSubscription = null;
            }
            
            this.logger.info(`Setting up new real-time subscription for conversation ${conversationId}`);
            
            const dataModule = this.getModule('data');
            
            // Create new subscription
            this.currentSubscription = dataModule.subscribeToNewMessages(conversationId, (newMessage) => {
                this.logger.info(`Received real-time message in conversation ${conversationId}:`, newMessage.id);
                
                // Check if we're still viewing this conversation
                if (this.currentConversation === conversationId) {
                    this.logger.info('Message is for current conversation');
                    
                    // Don't show our own messages twice
                    if (newMessage.sender_id !== this.currentUser.id) {
                        this.logger.info('Adding message to UI');
                        this._addMessageToUI(newMessage);
                        
                        // Mark as read
                        dataModule.markMessagesAsRead(conversationId, this.currentUser.id);
                    } else {
                        this.logger.info('Ignoring own message from subscription');
                    }
                } else {
                    this.logger.info('Message is for a different conversation, showing notification');
                    
                    // Show notification for messages in other conversations
                    this._showMessageNotification(newMessage);
                    
                    // Update conversations list for unread indicator
                    this.renderConversationsList();
                }
            });
            
            this.logger.info('Real-time subscription setup completed');
        } catch (error) {
            this.logger.error('Error setting up message subscription:', error);
        }
    }

    // Add a new message to the UI with improved error handling
    _addMessageToUI(message) {
        try {
            this.logger.info(`Adding message ${message.id} to UI`);
            const messageContainer = document.getElementById('message-container');
            if (!messageContainer) {
                this.logger.error('Message container not found');
                return;
            }
            // Check if this message is already in the UI
            const existingMessage = document.querySelector(`.message[data-message-id="${message.id}"]`);
            if (existingMessage) {
                this.logger.info(`Message ${message.id} already exists in UI, skipping`);
                return;
            }
            
            // Create message element
            const messageEl = this._createMessageElement(message);
            if (!messageEl) {
                this.logger.error('Failed to create message element');
                return;
            }
            
            // Remove "no messages" placeholder if present
            const noMessagesEl = messageContainer.querySelector('.no-messages');
            if (noMessagesEl) {
                noMessagesEl.remove();
            }
            
            // Add message to container
            messageContainer.appendChild(messageEl);
            
            // Scroll into view with a small delay to ensure rendering completes
            setTimeout(() => {
                messageEl.scrollIntoView({ behavior: 'smooth' });
            }, 50);
            
            // Play notification sound for active conversation
            this._playIncomingMessageSound();
            
            this.logger.info(`Message ${message.id} successfully added to UI`);
        } catch (error) {
            this.logger.error('Error adding message to UI:', error);
        }
    }

    // Play a subtle sound for incoming messages
    _playIncomingMessageSound() {
        try {
            const notificationModule = this.getModule('notification');
            notificationModule.notify({
                title: 'New Message',
                message: '',
                soundType: 'message',
                showNotification: false
            });
        } catch (error) {
            this.logger.error('Error playing message sound:', error);
        }
    }

    // Add this new method to handle events from other modules
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

        // Add debug panel for real-time connections
        window.addEventListener('keydown', (event) => {
            // Press Ctrl+Shift+D to toggle debug panel
            if (event.ctrlKey && event.shiftKey && event.key === 'D') {
                this._toggleDebugPanel();
            }
        });
    }

    // Improve subscription handling
    _setupMessageSubscription(conversationId) {
        try {
            // Clean up existing subscription
            if (this.currentSubscription) {
                this.logger.info(`Cleaning up previous subscription: ${this.currentSubscription.conversationId}`);
                this.currentSubscription.unsubscribe();
                this.currentSubscription = null;
            }
            
            this.logger.info(`Setting up new subscription for conversation: ${conversationId}`);
            const dataModule = this.getModule('data');
            
            // Set up new subscription
            this.currentSubscription = dataModule.subscribeToNewMessages(conversationId, (message) => {
                this.logger.info(`Received message in conversation ${conversationId}:`, message.id);
                
                // Ignore if we've navigated away
                if (this.currentConversation !== conversationId) {
                    this.logger.info('Message is for a different conversation, showing notification');
                    this._showMessageNotification(message);
                    this.renderConversationsList();
                    return;
                }
                
                // Don't show our own messages twice
                if (message.sender_id === this.currentUser.id) {
                    this.logger.info('Ignoring own message from subscription');
                    return;
                }
                
                // Add message to UI and mark as read
                this._addMessageToUI(message);
                dataModule.markMessagesAsRead(conversationId, this.currentUser.id);
                
                // Play notification sound
                this._playIncomingMessageSound();
            });
            
        } catch (error) {
            this.logger.error('Error setting up message subscription:', error);
        }
    }

    // Add this method to properly show notifications
    _showMessageNotification(message) {
        if (!message) return;
        
        try {
            const notificationModule = this.getModule('notification');
            const senderName = message.profiles?.display_name || message.profiles?.email || 'Someone';
            
            notificationModule.notify({
                title: `New message from ${senderName}`,
                message: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
                conversationId: message.conversation_id,
                soundType: 'notification'
            });
        } catch (error) {
            this.logger.error('Error showing message notification:', error);
        }
    }

    _toggleDebugPanel() {
        let debugPanel = document.getElementById('debug-panel');
        
        if (!debugPanel) {
            // Create debug panel
            debugPanel = document.createElement('div');
            debugPanel.id = 'debug-panel';
            debugPanel.style.cssText = 'position:fixed;bottom:0;right:0;width:300px;height:200px;background:#000;color:#0f0;z-index:9999;overflow:auto;padding:10px;font-family:monospace;font-size:12px;opacity:0.8;';
            
            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Close';
            closeBtn.style.cssText = 'position:absolute;top:5px;right:5px;';
            closeBtn.onclick = () => debugPanel.remove();
            
            const heading = document.createElement('h3');
            heading.textContent = 'Real-Time Debug';
            heading.style.margin = '0 0 10px 0';
            
            const statusDiv = document.createElement('div');
            statusDiv.id = 'rt-status';
            
            const connectionStatus = document.createElement('div');
            connectionStatus.id = 'connection-status';
            
            // Add connection status display
            const dataModule = this.getModule('data');
            const updateStatus = () => {
                const status = dataModule.getConnectionStatus();
                const statusColor = status === 'CONNECTED' ? '#0f0' : 
                                   status === 'CONNECTING' ? '#ff0' : '#f00';
                connectionStatus.innerHTML = `<span style="color:${statusColor}">●</span> Status: ${status}`;
            };
            
            // Update status now and every 2 seconds
            updateStatus();
            const statusInterval = setInterval(updateStatus, 2000);
            
            const testBtn = document.createElement('button');
            testBtn.textContent = 'Test Connection';
            testBtn.style.margin = '10px 0';
            testBtn.onclick = async () => {
                statusDiv.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Testing connection...</div>`;
                try {
                    const dataModule = this.getModule('data');
                    // Create a test channel to check connection
                    const uniqueId = new Date().getTime();
                    const channel = dataModule.supabase.channel(`test-channel-${uniqueId}`);
                    
                    channel.subscribe(status => {
                        statusDiv.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Status: ${status}</div>`;
                        setTimeout(() => channel.unsubscribe(), 2000);
                    });
                } catch (error) {
                    statusDiv.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Error: ${error.message}</div>`;
                }
            };
            
            // Add manual polling fallback button
            const pollBtn = document.createElement('button');
            pollBtn.textContent = 'Enable Polling Fallback';
            pollBtn.style.margin = '0 0 0 10px';
            pollBtn.onclick = () => {
                if (this.currentConversation) {
                    const dataModule = this.getModule('data');
                    dataModule.setupMessagePolling(this.currentConversation, (message) => {
                        this._addMessageToUI(message);
                        statusDiv.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Poll received message: ${message.id}</div>`;
                    });
                    statusDiv.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Polling enabled for conversation ${this.currentConversation}</div>`;
                } else {
                    statusDiv.innerHTML += `<div>[${new Date().toLocaleTimeString()}] No active conversation for polling</div>`;
                }
            };
            
            debugPanel.appendChild(closeBtn);
            debugPanel.appendChild(heading);
            debugPanel.appendChild(connectionStatus);
            debugPanel.appendChild(testBtn);
            debugPanel.appendChild(pollBtn);
            debugPanel.appendChild(statusDiv);
            
            // Clean up when panel is removed
            debugPanel.addEventListener('remove', () => {
                clearInterval(statusInterval);
            });
            
            document.body.appendChild(debugPanel);
        } else {
            debugPanel.remove();
        }
    }

    // Improve real-time message subscription handling
    _setupMessageSubscription(conversationId) {
        try {
            // Clean up existing subscription
            if (this.currentSubscription) {
                this.logger.info(`Cleaning up previous subscription: ${this.currentSubscription.conversationId}`);
                this.currentSubscription.unsubscribe();
                this.currentSubscription = null;
            }
            
            this.logger.info(`Setting up new subscription for conversation: ${conversationId}`);
            const dataModule = this.getModule('data');
            
            // Set up new subscription
            this.currentSubscription = dataModule.subscribeToNewMessages(conversationId, (message) => {
                this.logger.info(`Received message in conversation ${conversationId}:`, message.id);
                
                // Ignore if we've navigated away
                if (this.currentConversation !== conversationId) {
                    this.logger.info('Message is for a different conversation, showing notification');
                    this._showMessageNotification(message);
                    
                    // Update conversation in list without full re-render
                    this._updateConversationWithNewMessage(message);
                    
                    return;
                }
                
                // Don't show our own messages twice
                if (message.sender_id === this.currentUser.id) {
                    this.logger.info('Ignoring own message from subscription');
                    return;
                }
                
                // Add message to UI and mark as read
                this._addMessageToUI(message);
                dataModule.markMessagesAsRead(conversationId, this.currentUser.id);
                
                // Play notification sound
                this._playIncomingMessageSound();
            });
            
        } catch (error) {
            this.logger.error('Error setting up message subscription:', error);
        }
    }

    // New method to update conversation list with a new message without full re-render
    _updateConversationWithNewMessage(message) {
        try {
            const conversationId = message.conversation_id;
            if (!conversationId) return;
            
            // Find the conversation element in the list
            const conversationEl = document.querySelector(`.conversation-item[data-conversation-id="${conversationId}"]`);
            if (!conversationEl) {
                // If conversation not found in list, do a full refresh
                this.logger.info(`Conversation ${conversationId} not in list, refreshing all conversations`);
                this.renderConversationsList();
                return;
            }
            
            // Update last message text
            const lastMessageEl = conversationEl.querySelector('.conversation-last-message');
            if (lastMessageEl) {
                lastMessageEl.textContent = message.content;
            }
            
            // Mark as unread if not current conversation
            if (conversationId !== this.currentConversation && message.sender_id !== this.currentUser.id) {
                conversationEl.classList.add('unread');
                
                // Add unread indicator if not already present
                if (!conversationEl.querySelector('.unread-indicator')) {
                    const indicator = document.createElement('div');
                    indicator.className = 'unread-indicator';
                    conversationEl.appendChild(indicator);
                }
            }
            
            // Move conversation to top of list (newest first)
            const conversationsList = document.getElementById('conversations-list');
            if (conversationsList && conversationsList.firstChild !== conversationEl) {
                conversationsList.removeChild(conversationEl);
                conversationsList.insertBefore(conversationEl, conversationsList.firstChild);
            }
            
            this.logger.info(`Updated conversation ${conversationId} in list with new message`);
        } catch (error) {
            this.logger.error('Error updating conversation in list:', error);
            // Fall back to full refresh on error
            this.renderConversationsList();
        }
    }

    // Add global subscription to track conversations
    async setupConversationMonitor() {
        try {
            const dataModule = this.getModule('data');
            
            // Subscribe to all message inserts (global listener)
            this.globalSubscription = dataModule.subscribeToAllMessages((message) => {
                this.logger.info('Received message from global subscription:', message.id);
                
                // Update conversation in list or add it if it doesn't exist
                this._updateConversationWithNewMessage(message);
            });
            
            this.logger.info('Conversation monitor initialized');
        } catch (error) {
            this.logger.error('Failed to setup conversation monitor:', error);
        }
    }
}
