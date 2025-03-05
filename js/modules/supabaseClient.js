// Supabase client configuration and initialization
const supabaseUrl = 'https://eawoqpkwyunkmpyuijuq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhd29xcGt3eXVua21weXVpanVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDExNzM4MTYsImV4cCI6MjA1Njc0OTgxNn0.TCrAX91vjEwc_S7eYLE9RwzrNXSh1D_NKZ9XV6VfBRM';

// Create the Supabase client
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Export methods to interact with Supabase
const SupabaseClient = {
    // Discussion methods
    async getDiscussions() {
        try {
            const { data, error } = await supabase
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
            const { data, error } = await supabase
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
            const { data, error } = await supabase
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
            const { data, error } = await supabase.storage
                .from('discussion-media')
                .upload(path, file);
                
            if (error) throw error;
            
            const { data: { publicUrl } } = supabase.storage
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
