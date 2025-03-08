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
        
        // Set up a status channel to monitor real-time connection status
        this._setupConnectionMonitoring();
        
        this.logger.info('Data module initialized');
    }

    // Add connection status monitoring
    _setupConnectionMonitoring() {
        try {
            // Create a status channel to monitor connection state
            const statusChannel = this.supabase.channel('status-channel');
            
            statusChannel
                .on('system', { event: 'presence_state' }, () => {
                    this.connectionStatus = 'CONNECTED';
                    this.logger.info('Supabase real-time connection established');
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        this.connectionStatus = 'CONNECTED';
                        this.logger.info('Real-time status channel connected');
                    } else if (status === 'CHANNEL_ERROR') {
                        this.connectionStatus = 'ERROR';
                        this.logger.error('Real-time connection error');
                    } else if (status === 'CLOSED' || status === 'TIMED_OUT') {
                        this.connectionStatus = 'DISCONNECTED';
                        this.logger.warn('Real-time connection closed or timed out');
                        
                        // Try to reconnect after 3 seconds
                        setTimeout(() => {
                            this.logger.info('Attempting to reconnect status channel');
                            statusChannel.subscribe();
                        }, 3000);
                    }
                });
        } catch (error) {
            this.logger.error('Failed to setup connection monitoring:', error);
        }
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

    // Update the sendMessage method to accept metadata
    async sendMessage(conversationId, senderId, content, metadata = {}) {
        try {
            // Ensure metadata is a plain object
            const safeMetadata = {
                ...metadata,
                attachments: metadata.attachments || [],
                device_id: metadata.device_id,
                timestamp: new Date().toISOString()
            };

            const { data, error } = await this.supabase
                .from('messages')
                .insert({
                    conversation_id: conversationId,
                    sender_id: senderId,
                    content,
                    metadata: safeMetadata // Make sure this is a valid JSONB object
                })
                .select('*')
                .single();

            if (error) throw error;
            
            // Update conversation's last message
            await this._updateConversationLastMessage(conversationId, content, senderId, safeMetadata);
            
            return data;
        } catch (error) {
            this.logger.error('Error sending message:', error);
            throw error;
        }
    }

    // Add helper method for updating last message
    async _updateConversationLastMessage(conversationId, content, senderId, metadata) {
        try {
            const lastMessage = {
                content: metadata.attachments?.length ? 
                    `📎 ${content || 'Attachment'}` : content,
                sender_id: senderId,
                created_at: new Date().toISOString()
            };

            await this.supabase
                .from('conversations')
                .update({ last_message: lastMessage })
                .eq('id', conversationId);
        } catch (error) {
            this.logger.error('Error updating last message:', error);
        }
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
                    metadata,
                    conversation_id,
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

    // Update the subscription handler to include metadata in the query
    subscribeToNewMessages(conversationId, callback) {
        this.logger.info(`Setting up real-time subscription for conversation: ${conversationId}`);
        
        try {
            const uniqueId = new Date().getTime();
            const channelName = `message_updates:${conversationId}:${uniqueId}`;
            
            const channel = this.supabase
                .channel(channelName)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`
                }, async (payload) => {
                    // Always fetch full message data to get metadata and profile
                    if (payload.new) {
                        const { data: message } = await this.supabase
                            .from('messages')
                            .select(`
                                id,
                                content,
                                created_at,
                                sender_id,
                                metadata,
                                conversation_id,
                                profiles (*)
                            `)
                            .eq('id', payload.new.id)
                            .single();

                        if (message) {
                            callback(message);
                        }
                    }
                });
            
            channel.subscribe();
            
            return {
                unsubscribe: () => channel.unsubscribe(),
                conversationId
            };
        } catch (error) {
            this.logger.error(`Failed to create subscription:`, error);
            return {
                unsubscribe: () => {},
                conversationId
            };
        }
    }

    // Add helper method for subscription error handling
    async _handleSubscriptionError(channel, conversationId) {
        this.logger.info(`Attempting to reconnect to conversation ${conversationId}`);
        try {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            await channel.subscribe();
        } catch (error) {
            this.logger.error(`Reconnection failed for conversation ${conversationId}:`, error);
        }
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

    // Add polling fallback for when real-time fails
    async setupMessagePolling(conversationId, callback, interval = 3000) {
        this.logger.info(`Setting up message polling for conversation: ${conversationId}`);
        
        let lastTimestamp = new Date().toISOString();
        let timerId = null;
        
        const checkForNewMessages = async () => {
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
                        callback(message);
                    });
                }
            } catch (error) {
                this.logger.error('Error during message polling:', error);
            }
        };
        
        timerId = setInterval(checkForNewMessages, interval);
        
        return {
            stop: () => {
                if (timerId) {
                    clearInterval(timerId);
                    this.logger.info(`Stopped polling for conversation: ${conversationId}`);
                }
            },
            conversationId
        };
    }

    // Add a method to subscribe to all new messages (global updates)
    subscribeToAllMessages(callback) {
        this.logger.info('Setting up global real-time subscription for all conversations');
        
        try {
            // Create unique channel name
            const uniqueId = new Date().getTime();
            const channelName = `all_messages:${uniqueId}`;
            
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

    async deleteMessage(messageId, userId) {
        try {
            // Verify user owns the message first
            const { data: message, error: fetchError } = await this.supabase
                .from('messages')
                .select('sender_id')
                .eq('id', messageId)
                .single();

            if (fetchError) throw fetchError;
            if (!message || message.sender_id !== userId) {
                throw new Error('Cannot delete message: Not the sender');
            }

            // Delete the message
            const { error: deleteError } = await this.supabase
                .from('messages')
                .delete()
                .eq('id', messageId);

            if (deleteError) throw deleteError;
            
            this.logger.info(`Message ${messageId} deleted successfully`);
            return true;
        } catch (error) {
            this.logger.error('Error deleting message:', error);
            throw error;
        }
    }

    async uploadFile(file, userId) {
        try {
            const fileName = `${userId}/${Date.now()}-${file.name}`;
            const { data, error } = await this.supabase
                .storage
                .from('attachments')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            // Get public URL for the file
            const { data: { publicUrl } } = this.supabase
                .storage
                .from('attachments')
                .getPublicUrl(data.path);

            return {
                url: publicUrl,
                path: data.path,
                type: file.type,
                size: file.size,
                name: file.name
            };
        } catch (error) {
            this.logger.error('Error uploading file:', error);
            throw error;
        }
    }
}
