import { BaseModule } from '../BaseModule.js';
import { SUPABASE_CONFIG } from '../../config.js';

export class DataModule extends BaseModule {
    constructor(app) {
        super(app);
        this.supabase = null;
        this.connectionStatus = 'CONNECTING';
    }

    async init() {
        this.supabase = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
        this.connectionStatus = 'CONNECTING';
        this._setupConnectionMonitoring();
        this.logger.info('Data module initialized');
    }

    _setupConnectionMonitoring() {
        try {
            this._createHeartbeatChannel();
            
            // Add automatic fallback check that runs periodically
            this.connectionCheckInterval = setInterval(() => {
                if (this.connectionStatus === 'DISCONNECTED') {
                    this.logger.info('Connection has been down for a while, considering fallback to polling');
                    this._considerFallbackToPolling();
                }
            }, 30000); // Check every 30 seconds
        } catch (error) {
            this.logger.error('Error setting up connection monitoring:', error);
        }
    }

    // New method to consider fallback to polling
    _considerFallbackToPolling() {
        // Only trigger if we have a current conversation and it's not already polling
        if (this.app && this.app.state) {
            const currentConversationId = this.app.state.get('currentConversation');
            
            if (currentConversationId && 
                (!this.pollingSubscriptions || !this.pollingSubscriptions[currentConversationId])) {
                
                this.logger.info(`Auto-switching to polling mode for conversation: ${currentConversationId}`);
                
                // Notify the UI
                window.dispatchEvent(new CustomEvent('auto-fallback-to-polling', {
                    detail: { conversationId: currentConversationId }
                }));
                
                // Get the current callback from the subscription if available
                let callback = null;
                if (this.app.modules.get('ui') && this.app.modules.get('ui').currentSubscription) {
                    const originalCallback = this.app.modules.get('ui').currentSubscription.callback;
                    if (typeof originalCallback === 'function') {
                        callback = originalCallback;
                    }
                }
                
                // Fall back to a generic callback if needed
                if (!callback) {
                    callback = (message) => {
                        window.dispatchEvent(new CustomEvent('message-received', {
                            detail: { message }
                        }));
                    };
                }
                
                // Start polling
                this._fallbackToPolling(currentConversationId, callback);
            }
        }
    }
    
    // New helper method to create heartbeat channel
    _createHeartbeatChannel() {
        this.heartbeatChannel = this.supabase.channel('heartbeat')
            .subscribe((status) => {
                this.connectionStatus = status;
                this.logger.info(`Real-time connection status: ${status}`);
                
                if (status === 'SUBSCRIBED') {
                    this.connectionStatus = 'CONNECTED';
                } else if (status === 'CLOSED' || status === 'TIMED_OUT') {
                    this.connectionStatus = 'DISCONNECTED';
                    // Try to reconnect with a new channel instance
                    setTimeout(() => {
                        try {
                            // Unsubscribe from the old channel first
                            try {
                                this.heartbeatChannel.unsubscribe();
                            } catch (err) {
                                // Ignore errors during unsubscribe
                            }
                            
                            // Create a completely new channel with timestamp to avoid conflicts
                            this.logger.info('Attempting to recreate heartbeat connection...');
                            this._createHeartbeatChannel();
                        } catch (innerError) {
                            this.logger.error('Failed to recreate heartbeat:', innerError);
                        }
                    }, 3000);
                }
            });
    }

    // Add a method to get current connection status
    getConnectionStatus() {
        return this.connectionStatus;
    }

    async fetchUserProfile(userId) {
        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            
            if (error && error.code !== 'PGRST116') throw error;
            return data;
        } catch (error) {
            this.logger.error('Error fetching profile:', error);
            return null;
        }
    }

    async createUserProfile(profileData) {
        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .insert(profileData)
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            this.logger.error('Error creating profile:', error);
            throw error;
        }
    }

    async createConversation(participants) {
        try {
            // Validate participants
            if (!participants || !participants.length) {
                throw new Error('No participants provided for conversation');
            }
            
            // Check for existing conversation first
            const existingId = await this.findExistingConversation(participants);
            if (existingId) {
                this.logger.info(`Using existing conversation: ${existingId}`);
                return { id: existingId };
            }

            // Create new conversation
            const { data: conversation, error } = await this.supabase
                .from('conversations')
                .insert({
                    is_self_chat: participants.length === 1,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();
                
            if (error) throw error;
            
            this.logger.info(`Created new conversation with ID: ${conversation.id}`);
            
            // Create unique participants array
            const uniqueParticipants = [...new Set(participants)];
            const participantsToInsert = uniqueParticipants.map(userId => ({
                conversation_id: conversation.id,
                user_id: userId
            }));
            
            const { error: participantsError } = await this.supabase
                .from('participants')
                .insert(participantsToInsert);
                
            if (participantsError) throw participantsError;
            
            return conversation;
        } catch (error) {
            this.logger.error('Error creating conversation:', error);
            throw error;
        }
    }

    async findExistingConversation(participants) {
        try {
            // Don't search if no participants
            if (!participants || !participants.length) return null;
            
            this.logger.info(`Finding existing conversation for participants: ${participants.join(', ')}`);
            
            // For self-chats, search by is_self_chat flag
            if (participants.length === 1) {
                const { data, error } = await this.supabase
                    .from('conversations')
                    .select(`
                        id,
                        participants!inner (user_id)
                    `)
                    .eq('is_self_chat', true)
                    .eq('participants.user_id', participants[0]);
                    
                if (error) throw error;
                
                if (data && data.length > 0) {
                    this.logger.info(`Found existing self-chat: ${data[0].id}`);
                    return data[0].id;
                }
                
                return null;
            }
            
            // For regular chats with 2+ participants, we need to check more carefully
            const { data: conversations, error } = await this.supabase
                .from('conversations')
                .select(`
                    id,
                    is_self_chat,
                    participants (user_id)
                `)
                .eq('is_self_chat', false);

            if (error) throw error;
            
            // Check each conversation to see if all participants exactly match
            for (const conv of conversations) {
                if (!conv.participants || conv.participants.length !== participants.length) {
                    continue; // Skip if participant count doesn't match
                }
                
                const participantIds = conv.participants.map(p => p.user_id);
                
                // Check if all participants match exactly (same people, no extras)
                const allMatch = participants.every(id => participantIds.includes(id)) && 
                                 participants.length === participantIds.length;
                                 
                if (allMatch) {
                    this.logger.info(`Found existing conversation: ${conv.id}`);
                    return conv.id;
                }
            }

            return null;
        } catch (error) {
            this.logger.error('Error finding existing conversation:', error);
            return null;
        }
    }

    async sendMessage(conversationId, senderId, content) {
        try {
            // Sanitize and validate input
            content = this._sanitizeInput(content);
            if (!this._validateMessageContent(content)) {
                throw new Error('Invalid message content');
            }

            // Add rate limiting for messages
            if (this._isRateLimited('message_send')) {
                throw new Error('Please wait before sending more messages');
            }

            const { data, error } = await this.supabase
                .from('messages')
                .insert({
                    conversation_id: conversationId,
                    sender_id: senderId,
                    content
                })
                .select()
                .single();

            if (error) throw error;
            this._updateRateLimit('message_send');
            return data;
        } catch (error) {
            this.logger.error('Error sending message:', error);
            throw error;
        }
    }

    _sanitizeInput(content) {
        // Basic XSS prevention
        return content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .trim();
    }

    _validateMessageContent(content) {
        return content && 
               content.length > 0 && 
               content.length <= 2000 && // reasonable message length limit
               !/^\s*$/.test(content);    // not just whitespace
    }

    _isRateLimited(action) {
        const key = `rate_limit_${action}`;
        const limit = JSON.parse(sessionStorage.getItem(key) || '[]');
        const now = Date.now();
        // Keep only recent attempts (last 60 seconds)
        const recent = limit.filter(time => now - time < 60000);
        // Allow 10 messages per minute
        return recent.length >= 10;
    }

    _updateRateLimit(action) {
        const key = `rate_limit_${action}`;
        const limit = JSON.parse(sessionStorage.getItem(key) || '[]');
        limit.push(Date.now());
        sessionStorage.setItem(key, JSON.stringify(limit));
    }

    async fetchMessages(conversationId) {
        try {
            const { data, error } = await this.supabase
                .from('messages')
                .select(`
                    id,
                    content,
                    created_at,
                    sender_id,
                    profiles (*)
                `)
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true });
                
            if (error) throw error;
            return data || [];
        } catch (error) {
            this.logger.error('Error fetching messages:', error);
            return [];
        }
    }

    async searchUsers(query) {
        try {
            // Improved search using ilike for case-insensitive searching
            const { data, error } = await this.supabase
                .from('profiles')
                .select('id, email, display_name, avatar_url')
                .or(`email.ilike.%${query}%,display_name.ilike.%${query}%`)
                .order('display_name', { ascending: true })
                .limit(10);
            
            if (error) throw error;
            
            this.logger.info(`Found ${data?.length || 0} users matching query: ${query}`);
            return data || [];
        } catch (error) {
            this.logger.error('Error searching users:', error);
            return [];
        }
    }

    // Add this new method to clean up duplicate self-chats
    async cleanupSelfChats(userId) {
        try {
            this.logger.info(`Cleaning up duplicate self-chats for user: ${userId}`);
            
            // 1. Find all self-chats for this user
            const { data: selfChats, error } = await this.supabase
                .from('conversations')
                .select('id, created_at')
                .eq('is_self_chat', true)
                .in('id', sb => sb
                    .from('participants')
                    .select('conversation_id')
                    .eq('user_id', userId)
                )
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            
            if (!selfChats || selfChats.length <= 1) {
                this.logger.info('No duplicate self-chats to clean up');
                return; // Nothing to clean up
            }
            
            // 2. Keep the most recent self-chat, delete the rest
            const mostRecentId = selfChats[0].id;
            const idsToDelete = selfChats.slice(1).map(chat => chat.id);
            
            this.logger.info(`Keeping self-chat: ${mostRecentId}, deleting: ${idsToDelete.join(', ')}`);
            
            // 3. Delete the duplicate conversations
            if (idsToDelete.length > 0) {
                const { error: deleteError } = await this.supabase
                    .from('conversations')
                    .delete()
                    .in('id', idsToDelete);
                    
                if (deleteError) throw deleteError;
                
                this.logger.info(`Successfully removed ${idsToDelete.length} duplicate self-chats`);
            }
        } catch (error) {
            this.logger.error('Error cleaning up self-chats:', error);
        }
    }

    // Modify fetchConversations to deduplicate self-chats in the query
    async fetchConversations(userId, skipCache = false) {
        try {
            this.logger.info(`Fetching conversations for user: ${userId}, skipCache: ${skipCache}`);
            
            // Use a direct query to get all conversations the user participates in
            const { data: participantEntries, error: participantError } = await this.supabase
                .from('participants')
                .select(`
                    conversation_id,
                    user_id,
                    last_read_at
                `)
                .eq('user_id', userId);
                
            if (participantError) throw participantError;
            
            // Extract unique conversation IDs
            const conversationIds = [...new Set(participantEntries.map(p => p.conversation_id))];
            this.logger.info(`Found ${conversationIds.length} conversations for user ${userId}`);
            
            if (conversationIds.length === 0) return [];
            
            // Get all conversations by their IDs
            const { data: conversations, error: conversationsError } = await this.supabase
                .from('conversations')
                .select(`
                    id, 
                    created_at,
                    is_self_chat,
                    last_message
                `)
                .in('id', conversationIds);
                
            if (conversationsError) throw conversationsError;
            
            // For each conversation, get all participants with their profiles
            const conversationsWithDetails = await Promise.all(conversations.map(async (conv) => {
                const { data: participants, error: participantsError } = await this.supabase
                    .from('participants')
                    .select(`
                        user_id,
                        last_read_at,
                        profiles:user_id (
                            id,
                            email,
                            display_name,
                            avatar_url
                        )
                    `)
                    .eq('conversation_id', conv.id);
                    
                if (participantsError) {
                    this.logger.error(`Error fetching participants for conversation ${conv.id}:`, participantsError);
                    return { ...conv, participants: [] };
                }
                
                // Add the current user's last read time from our earlier query
                const currentUserEntry = participantEntries.find(p => 
                    p.conversation_id === conv.id && p.user_id === userId
                );
                
                // CRITICAL FIX: Properly identify self chats vs. regular chats
                const isSelfChat = conv.is_self_chat || 
                                  (participants.length === 1 && participants[0].user_id === userId);
                
                return { 
                    ...conv, 
                    participants,
                    userLastRead: currentUserEntry?.last_read_at || null,
                    isSelfChat // Explicitly store this property
                };
            }));
            
            // Separate self-chats and regular chats for different handling
            const selfChats = [];
            const regularChats = new Map(); // Use Map to deduplicate by other user ID
            
            for (const conv of conversationsWithDetails) {
                if (conv.isSelfChat) {
                    selfChats.push(conv);
                } else {
                    // For regular chats, identify the "other" users
                    const otherUsers = conv.participants.filter(p => p.user_id !== userId);
                    
                    // If there are other users, use the first one as the key for deduplication
                    if (otherUsers.length > 0) {
                        const otherUser = otherUsers[0];
                        const otherUserId = otherUser.user_id;
                        
                        // Only keep the most recent conversation with each person
                        const existingConv = regularChats.get(otherUserId);
                        const convLastMessageTime = conv.last_message?.created_at 
                            ? new Date(conv.last_message.created_at) 
                            : new Date(conv.created_at);
                        
                        if (!existingConv) {
                            regularChats.set(otherUserId, conv);
                        } else {
                            // Compare message timestamps and keep the more recent one
                            const existingLastMessageTime = existingConv.last_message?.created_at 
                                ? new Date(existingConv.last_message.created_at) 
                                : new Date(existingConv.created_at);
                            
                            if (convLastMessageTime > existingLastMessageTime) {
                                regularChats.set(otherUserId, conv);
                            }
                        }
                    } else {
                        // This shouldn't happen, but handle just in case
                        regularChats.set(`unknown-${conv.id}`, conv);
                    }
                }
            }
            
            // Choose only the most recent self-chat
            let mostRecentSelfChat = null;
            if (selfChats.length > 0) {
                mostRecentSelfChat = selfChats.reduce((latest, current) => {
                    const latestTime = latest.last_message?.created_at 
                        ? new Date(latest.last_message.created_at) 
                        : new Date(latest.created_at);
                    const currentTime = current.last_message?.created_at 
                        ? new Date(current.last_message.created_at) 
                        : new Date(current.created_at);
                    return currentTime > latestTime ? current : latest;
                }, selfChats[0]);
            }
            
            // Combine results, putting self-chat first if it exists
            const result = [...regularChats.values()];
            if (mostRecentSelfChat) {
                result.unshift(mostRecentSelfChat);
            }
            
            // Sort by most recent message
            result.sort((a, b) => {
                const aTime = a.last_message?.created_at ? new Date(a.last_message.created_at) : new Date(a.created_at);
                const bTime = b.last_message?.created_at ? new Date(b.last_message.created_at) : new Date(b.created_at);
                return bTime - aTime; // newest first
            });
            
            this.logger.info(`Returning ${result.length} conversations (${selfChats.length > 0 ? '1 self-chat' : 'no self-chat'}, ${regularChats.size} regular chats)`);
            return result;
        } catch (error) {
            this.logger.error('Error in fetchConversations:', error);
            return [];
        }
    }

    async _handleSubscriptionError(channel, conversationId, callback) {
        try {
            this.logger.info(`Handling subscription error for conversation ${conversationId}`);
            
            // First, ensure we properly unsubscribe from the old channel
            if (channel) {
                try {
                    channel.unsubscribe();
                    this.logger.info('Successfully unsubscribed from old channel');
                } catch (err) {
                    this.logger.warn('Failed to unsubscribe from old channel:', err);
                }
            }
            
            // Only proceed if we have a callback
            if (!callback || typeof callback !== 'function') {
                this.logger.warn('No callback provided for reconnected channel');
                return null;
            }
            
            // Wait to avoid rapid reconnections
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Don't create a subscription within this method anymore
            // Instead notify the caller that they should recreate the subscription
            window.dispatchEvent(new CustomEvent('subscription-reconnect-needed', { 
                detail: { conversationId } 
            }));
            
            return null;
        } catch (error) {
            this.logger.error('Error handling subscription reconnect:', error);
            return null;
        }
    }

    subscribeToNewMessages(conversationId, callback) {
        // Validate inputs to prevent errors
        if (!conversationId) {
            this.logger.error('Missing conversation ID for subscription');
            return { unsubscribe: () => {}, conversationId: null };
        }
        
        if (!callback || typeof callback !== 'function') {
            this.logger.error('Invalid callback provided to subscribeToNewMessages');
            return { unsubscribe: () => {}, conversationId };
        }
        
        this.logger.info(`Setting up message subscription for conversation: ${conversationId}`);
        
        try {
            // Create a truly unique channel name with timestamp to avoid conflicts
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 10);
            const channelName = `messages:${conversationId}:${timestamp}_${random}`;
            
            this.logger.info(`Creating channel with unique name: ${channelName}`);
            
            // CRITICAL FIX: Change from const to let so it can be reassigned during retries
            let channel = this.supabase.channel(channelName);
            let subscriptionInitiated = false;
            let isSubscribed = false;
            
            // Configure retry mechanism
            const maxRetries = 3;
            let retryCount = 0;
            let retryTimer = null;
            
            // Keep a local reference to the callback
            const safeCallback = payload => {
                try {
                    if (payload && payload.new) {
                        callback(payload.new);
                    }
                } catch (err) {
                    this.logger.error('Error in message callback:', err);
                }
            };
            
            // Configure the channel to listen for changes
            channel.on('postgres_changes', 
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                payload => {
                    this.logger.info(`Received message for conversation ${conversationId}`);
                    safeCallback(payload);
                }
            );
            
            // Handle subscription status
            const handleStatus = (status) => {
                this.logger.info(`Subscription status for ${conversationId}: ${status}`);
                
                if (status === 'SUBSCRIBED') {
                    isSubscribed = true;
                    // ...existing success code...
                    
                } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
                    isSubscribed = false;
                    
                    // Dispatch the subscription error event
                    window.dispatchEvent(new CustomEvent('subscription-error', {
                        detail: { conversationId, status }
                    }));
                    
                    // Try to reconnect if we haven't exceeded max retries
                    if (retryCount < maxRetries) {
                        this.logger.warn(`Subscription failed (${status}). Retry ${retryCount + 1}/${maxRetries} in 5 seconds...`);
                        
                        retryTimer = setTimeout(() => {
                            retryCount++;
                            
                            // Unsubscribe from current channel before creating a new one
                            try {
                                channel.unsubscribe();
                            } catch (err) {
                                this.logger.warn('Error unsubscribing before retry:', err);
                            }
                            
                            // Create a completely new channel with unique name (critical fix)
                            this.logger.info('Creating new channel for retry...');
                            try {
                                const newChannelName = `messages:${conversationId}:${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
                                const newChannel = this.supabase.channel(newChannelName);
                                
                                // Configure the new channel the same as the old one
                                newChannel.on('postgres_changes', 
                                    {
                                        event: 'INSERT',
                                        schema: 'public',
                                        table: 'messages',
                                        filter: `conversation_id=eq.${conversationId}`
                                    },
                                    payload => safeCallback(payload)
                                );
                                
                                // Subscribe to the new channel
                                newChannel.subscribe(handleStatus);
                                
                                // Update the channel reference in the closure
                                channel = newChannel;
                            } catch (err) {
                                this.logger.error('Error creating new channel for retry:', err);
                                
                                // Fall back to polling if subscription fails repeatedly
                                if (retryCount >= maxRetries) {
                                    this.logger.warn('Max retries exceeded, falling back to polling');
                                    this._fallbackToPolling(conversationId, safeCallback);
                                }
                            }
                        }, 5000);
                    } else {
                        // We've exceeded max retries, fall back to polling
                        this.logger.warn('Max retries exceeded, falling back to polling');
                        this._fallbackToPolling(conversationId, safeCallback);
                    }
                }
            };
            
            // Now subscribe and get the initial status
            channel.subscribe(handleStatus);
            
            // Return a custom subscription object with additional info
            return {
                unsubscribe: () => {
                    this.logger.info(`Unsubscribing from ${channelName}`);
                    
                    // Clear any pending retry
                    if (retryTimer) {
                        clearTimeout(retryTimer);
                        retryTimer = null;
                    }
                    
                    // Stop polling if it was started - WITH PROPER VALIDATION
                    if (this.pollingSubscriptions && 
                        this.pollingSubscriptions[conversationId] && 
                        typeof this.pollingSubscriptions[conversationId].stop === 'function') {
                        try {
                            this.pollingSubscriptions[conversationId].stop();
                            delete this.pollingSubscriptions[conversationId];
                            this.logger.info(`Stopped polling fallback for ${conversationId}`);
                        } catch (err) {
                            this.logger.warn(`Error stopping polling for ${conversationId}:`, err);
                        }
                    }
                    
                    // Try to unsubscribe if we actually subscribed
                    if (subscriptionInitiated) {
                        try {
                            channel.unsubscribe();
                        } catch (err) {
                            this.logger.warn('Error during unsubscribe:', err);
                        }
                    }
                },
                checkStatus: () => ({ 
                    isSubscribed, 
                    subscriptionTimedOut,
                    retryCount
                }),
                channelName,
                conversationId
            };
        } catch (error) {
            this.logger.error('Error setting up subscription:', error);
            return {
                unsubscribe: () => {},
                conversationId,
                checkStatus: () => ({ 
                    isSubscribed: false,
                    subscriptionTimedOut: true,
                    retryCount: 0
                })
            };
        }
    }
    
    // Add a new method for polling fallback
    _fallbackToPolling(conversationId, callback) {
        // Initialize polling subscriptions store if needed
        if (!this.pollingSubscriptions) {
            this.pollingSubscriptions = {};
        }
        
        // Stop existing polling if any - WITH PROPER VALIDATION
        if (this.pollingSubscriptions[conversationId] && 
            typeof this.pollingSubscriptions[conversationId].stop === 'function') {
            try {
                this.pollingSubscriptions[conversationId].stop();
                this.logger.info(`Stopped existing polling for conversation ${conversationId}`);
            } catch (err) {
                this.logger.warn(`Error stopping existing polling for ${conversationId}:`, err);
            }
        }
        
        // Set up new polling
        this.logger.info(`Setting up polling fallback for conversation ${conversationId}`);
        const pollingSubscription = this.setupMessagePolling(conversationId, callback);
        this.pollingSubscriptions[conversationId] = pollingSubscription;
        
        // Notify that we're using polling
        window.dispatchEvent(new CustomEvent('polling-fallback-enabled', {
            detail: { conversationId }
        }));
        
        return pollingSubscription;
    }

    // Add polling fallback for when real-time fails - WITH PROPER ERROR HANDLING
    async setupMessagePolling(conversationId, callback, interval = 3000) {
        this.logger.info(`Setting up message polling for conversation: ${conversationId}`);
        
        let lastTimestamp = new Date().toISOString();
        let timerId = null;
        let isActive = true;
        
        const checkForNewMessages = async () => {
            if (!isActive) return;
            
            try {
                const { data, error } = await this.supabase
                    .from('messages')
                    .select(`
                        id,
                        content,
                        created_at,
                        sender_id,
                        conversation_id,
                        profiles:sender_id (
                            id,
                            email,
                            display_name,
                            avatar_url
                        )
                    `)
                    .eq('conversation_id', conversationId)
                    .gt('created_at', lastTimestamp)
                    .order('created_at', { ascending: true });
                    
                if (error) throw error;
                
                if (data && data.length > 0) {
                    // Update timestamp for next poll
                    lastTimestamp = data[data.length - 1].created_at;
                    
                    // Process each new message
                    data.forEach(message => {
                        if (isActive && typeof callback === 'function') {
                            callback(message);
                        }
                    });
                }
            } catch (error) {
                this.logger.error('Error during message polling:', error);
            }
            
            // Schedule next check if still active
            if (isActive) {
                timerId = setTimeout(checkForNewMessages, interval);
            }
        };
        
        // Start the polling process
        timerId = setTimeout(checkForNewMessages, 0);
        
        // Always return a properly structured object with a stop method
        return {
            stop: () => {
                this.logger.info(`Stopping polling for conversation: ${conversationId}`);
                isActive = false;
                if (timerId) {
                    clearTimeout(timerId);
                    timerId = null;
                }
            },
            isActive: () => isActive,
            conversationId
        };
    }

    // Add method to mark messages as read
    async markMessagesAsRead(conversationId, userId) {
        try {
            // Update the participant's last_read_at field instead of conversation's last_read
            const { error } = await this.supabase
                .from('participants')
                .update({
                    last_read_at: new Date().toISOString()
                })
                .eq('conversation_id', conversationId)
                .eq('user_id', userId);
            
            if (error) throw error;
            
            this.logger.info(`Marked conversation ${conversationId} as read for user ${userId}`);
            return true;
        } catch (error) {
            this.logger.error('Error marking messages as read:', error);
            return false;
        }
    }

    // Add a method to subscribe to all new messages (global updates)
    subscribeToAllMessages(callback) {
        this.logger.info('Setting up global real-time subscription for all conversations');
        
        try {
            // Create unique channel name with timestamp
            const uniqueId = new Date().getTime();
            const random = Math.random().toString(36).substring(2, 10);
            const channelName = `all_messages:${uniqueId}_${random}`;
            
            const channel = this.supabase
                .channel(channelName)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages'
                }, async (payload) => {
                    this.logger.info('Received global real-time event for a message');
                    
                    if (!payload.new || !payload.new.id) {
                        this.logger.warn('Received empty payload in global listener');
                        return;
                    }
                    
                    try {
                        // Get complete message with sender profile
                        const { data, error } = await this.supabase
                            .from('messages')
                            .select(`
                                id,
                                content,
                                created_at,
                                sender_id,
                                conversation_id,
                                profiles:sender_id (
                                    id, 
                                    email,
                                    display_name,
                                    avatar_url
                                )
                            `)
                            .eq('id', payload.new.id)
                            .single();
                        
                        if (error) {
                            this.logger.error('Error fetching complete message in global listener:', error);
                            callback(payload.new);
                        } else {
                            callback(data);
                        }
                    } catch (err) {
                        this.logger.error('Error processing message in global listener:', err);
                        callback(payload.new);
                    }
                });
            
            channel.subscribe(async (status, err) => {
                if (status === 'SUBSCRIBED') {
                    this.logger.info('Successfully subscribed to global message updates');
                } else if (status === 'CHANNEL_ERROR') {
                    this.logger.error('Global subscription channel error:', err);
                    await this._handleSubscriptionError(channel, 'global');
                }
            });
            
            return {
                unsubscribe: () => {
                    this.logger.info('Unsubscribing from global message updates');
                    try {
                        channel.unsubscribe();
                    } catch (err) {
                        this.logger.error('Error unsubscribing from global updates:', err);
                    }
                }
            };
        } catch (error) {
            this.logger.error('Failed to create global subscription:', error);
            return {
                unsubscribe: () => {}
            };
        }
    }

    cleanup() {
        // Clear the connection check interval when cleaning up
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
        }
        
        // Unsubscribe from heartbeat
        if (this.heartbeatChannel) {
            try {
                this.heartbeatChannel.unsubscribe();
            } catch (err) {
                this.logger.warn('Error unsubscribing from heartbeat:', err);
            }
        }
        
        // Stop all polling subscriptions
        if (this.pollingSubscriptions) {
            Object.values(this.pollingSubscriptions).forEach(sub => {
                if (sub && typeof sub.stop === 'function') {
                    try {
                        sub.stop();
                    } catch (err) {
                        this.logger.warn('Error stopping polling subscription:', err);
                    }
                }
            });
        }
    }
}
