import { SUPABASE_CONFIG } from '../config.js';

let supabase;

export function initDatabase() {
    // Initialize Supabase client
    supabase = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
    console.log('Supabase Database initialized');
}

// User profile operations
export async function fetchUserProfile(userId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
        if (error && error.code !== 'PGRST116') throw error;
        
        return data;
    } catch (error) {
        console.error('Error fetching user profile:', error.message);
        return null;
    }
}

export async function createUserProfile(profileData) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .insert(profileData)
            .select()
            .single();
            
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error creating user profile:', error.message);
        throw error;
    }
}

export async function updateUserProfile(profileData) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .update(profileData)
            .eq('id', profileData.id)
            .select()
            .single();
            
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error updating user profile:', error.message);
        throw error;
    }
}

export async function uploadAvatar(userId, file) {
    try {
        // Create a unique file path
        const filePath = `avatars/${userId}/${Date.now()}-${file.name}`;
        
        // Upload the file
        const { data, error } = await supabase.storage
            .from('avatars')
            .upload(filePath, file);
            
        if (error) throw error;
        
        // Get the public URL
        const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
            
        // Update the user's profile with the avatar URL
        await updateUserProfile({
            id: userId,
            avatar_url: publicUrlData.publicUrl
        });
        
        return publicUrlData.publicUrl;
    } catch (error) {
        console.error('Error uploading avatar:', error.message);
        throw error;
    }
}

// Conversation operations
export async function fetchConversations(userId) {
    try {
        const { data, error } = await supabase
            .from('conversations')
            .select(`
                id, 
                created_at,
                participants (
                    user_id, 
                    profiles (id, display_name, avatar_url)
                ),
                last_message
            `)
            .eq('participants.user_id', userId);
            
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error fetching conversations:', error.message);
        return [];
    }
}

export async function createConversation(participants) {
    try {
        // First create the conversation
        const { data: conversation, error } = await supabase
            .from('conversations')
            .insert({})
            .select()
            .single();
            
        if (error) throw error;
        
        // Then create the participants
        const participantsToInsert = participants.map(userId => ({
            conversation_id: conversation.id,
            user_id: userId
        }));
        
        const { error: participantsError } = await supabase
            .from('participants')
            .insert(participantsToInsert);
            
        if (participantsError) throw participantsError;
        
        return conversation;
    } catch (error) {
        console.error('Error creating conversation:', error.message);
        throw error;
    }
}

export async function fetchMessages(conversationId) {
    try {
        const { data, error } = await supabase
            .from('messages')
            .select(`
                id, 
                content, 
                created_at, 
                sender_id, 
                profiles (display_name, avatar_url)
            `)
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });
            
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error fetching messages:', error.message);
        return [];
    }
}

export async function sendMessage(conversationId, senderId, content) {
    try {
        const { data, error } = await supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                sender_id: senderId,
                content
            })
            .select()
            .single();
            
        if (error) throw error;
        
        // Update the conversation's last message
        await supabase
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
        console.error('Error sending message:', error.message);
        throw error;
    }
}

export async function searchUsers(query, currentUserId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, display_name, avatar_url')
            .or(`email.ilike.%${query}%,display_name.ilike.%${query}%`)
            .neq('id', currentUserId)
            .limit(10);
            
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error searching users:', error.message);
        return [];
    }
}

// Subscribe to new messages for real-time updates
export function subscribeToMessages(conversationId, callback) {
    return supabase
        .channel(`conversation:${conversationId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
        }, payload => {
            callback(payload.new);
        })
        .subscribe();
}
