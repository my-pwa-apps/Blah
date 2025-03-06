import { BaseModule } from '../BaseModule.js';
import { SUPABASE_CONFIG } from '../../../config.js';

export class AuthModule extends BaseModule {
    constructor(app) {
        super(app);
        this.supabase = null;
    }

    async init() {
        this.supabase = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
        this.logger.info('Auth module initialized');
    }

    async signUp(email, password) {
        try {
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password
            });
            if (error) throw error;
            return data;
        } catch (error) {
            this.logger.error('Sign up failed:', error);
            throw error;
        }
    }

    async signIn(email, password) {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });
            if (error) throw error;
            return data;
        } catch (error) {
            this.logger.error('Sign in failed:', error);
            throw error;
        }
    }

    async signOut() {
        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;
            return true;
        } catch (error) {
            this.logger.error('Sign out failed:', error);
            throw error;
        }
    }

    onAuthStateChange(callback) {
        return this.supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                callback(session.user);
            } else if (event === 'SIGNED_OUT') {
                callback(null);
            }
        });
    }
}
