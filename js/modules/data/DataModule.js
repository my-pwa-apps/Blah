import { BaseModule } from '../BaseModule.js';
import { SUPABASE_CONFIG } from '../../../config.js';

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
}
