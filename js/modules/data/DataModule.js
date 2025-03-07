import { BaseModule } from '../BaseModule.js';
import { SUPABASE_CONFIG } from '../../config.js';

export class DataModule extends BaseModule {
    constructor(app) {
        super(app);
        this.supabase = null;
    }

    async init() {
        this.supabase = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
        this.logger.info('Data module initialized');
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
            
            // Update conversation's last message
            await this.supabase
                .from('conversations')
                .update({
                    last_message: {
                        content,
                        sender_id: senderId,
                        created_at: new Date().toISOString()
                    }
                })
                .eq('id', conversationId);
            
            return data;
        } catch (error) {
            this.logger.error('Error sending message:', error);
            throw error;
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
            
            // Use a simpler query that works better with Supabase's structure
            const query = this.supabase
                .from('conversations')
                .select(`
                    id,
                    created_at,
                    is_self_chat,
                    last_message,
                    participants!inner (
                        user_id
                    )
                `)
                .eq('participants.user_id', userId)
                .order('created_at', { ascending: false });
                
            if (skipCache) {
                query.limit(100);
            }
            
            // Execute the query to get conversations
            const { data: conversations, error } = await query;
            
            if (error) throw error;
            
            // If no conversations, return empty array
            if (!conversations || conversations.length === 0) {
                return [];
            }
            
            // For each conversation, fetch the participants with profile data
            const conversationsWithProfiles = await Promise.all(conversations.map(async (conv) => {
                // Get all participants for this conversation
                const { data: participants, error: participantsError } = await this.supabase
                    .from('participants')
                    .select(`
                        user_id,
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
                    return { ...conv, enrichedParticipants: [] };
                }
                
                return { ...conv, enrichedParticipants: participants || [] };
            }));
            
            // Process conversations - keep one self-chat and ALL other chats
            let processedConversations = [];
            let selfChat = null;
            
            for (const conv of conversationsWithProfiles) {
                const isSelfChat = conv.is_self_chat || (conv.enrichedParticipants.length === 1);
                
                if (isSelfChat) {
                    // Only keep the most recent self-chat
                    if (!selfChat || new Date(conv.created_at) > new Date(selfChat.created_at)) {
                        selfChat = conv;
                        this.logger.info(`Selected self-chat: ${conv.id}`);
                    }
                } else {
                    // Always include regular chats
                    processedConversations.push(conv);
                    this.logger.info(`Including regular chat: ${conv.id} with ${conv.enrichedParticipants.length} participants`);
                }
            }
            
            // Add the self-chat at the beginning if we have one
            if (selfChat) {
                processedConversations.unshift(selfChat);
            }
            
            return processedConversations;
        } catch (error) {
            this.logger.error('Error fetching conversations:', error);
            return [];
        }
    }
}
