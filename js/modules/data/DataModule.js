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
            // Check for existing conversation first
            const existingId = await this.findExistingConversation(participants);
            if (existingId) {
                return { id: existingId };
            }

            // Create new conversation
            const { data: conversation, error } = await this.supabase
                .from('conversations')
                .insert({
                    is_self_chat: participants.length === 1
                })
                .select()
                .single();
                
            if (error) throw error;
            
            // Create participants
            const participantsToInsert = participants.map(userId => ({
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
            const { data: conversations, error } = await this.supabase
                .from('conversations')
                .select(`
                    id,
                    participants!inner (user_id)
                `)
                .eq('participants.user_id', participants[0]);

            if (error) throw error;

            for (const conv of conversations) {
                const participantIds = conv.participants.map(p => p.user_id);
                const allParticipantsPresent = participants.every(id => 
                    participantIds.includes(id)
                ) && participantIds.length === participants.length;

                if (allParticipantsPresent) {
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
}
