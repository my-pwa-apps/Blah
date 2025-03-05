// Use the global Supabase client instead of creating a new one

// Export methods to interact with Supabase
const SupabaseClient = {
    // Discussion methods
    async getDiscussions() {
        try {
            const { data, error } = await window.projectSupabase
                .from('discussions')
                .select('*')
                .is('parent_id', null)
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching discussions:', error);
            throw error;
        }
    },
    
    async getRepliesForDiscussions(discussionIds) {
        try {
            const { data, error } = await window.projectSupabase
                .from('discussions')
                .select('*')
                .in('parent_id', discussionIds);
                
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching replies:', error);
            throw error;
        }
    },
    
    async createDiscussion(discussionData) {
        try {
            const { data, error } = await window.projectSupabase
                .from('discussions')
                .insert([discussionData])
                .select();
                
            if (error) throw error;
            return data[0];
        } catch (error) {
            console.error('Error creating discussion:', error);
            throw error;
        }
    },
    
    // Media methods
    async uploadMedia(file, folder = '') {
        try {
            const path = `${folder}${folder ? '/' : ''}${Date.now()}_${file.name}`;
            const { data, error } = await window.projectSupabase.storage
                .from('discussion-media')
                .upload(path, file);
                
            if (error) throw error;
            
            const { data: { publicUrl } } = window.projectSupabase.storage
                .from('discussion-media')
                .getPublicUrl(data.path);
                
            return {
                url: publicUrl,
                type: file.type
            };
        } catch (error) {
            console.error('Error uploading media:', error);
            throw error;
        }
    }
};

window.SupabaseClient = SupabaseClient;
console.log('Supabase client module loaded');
