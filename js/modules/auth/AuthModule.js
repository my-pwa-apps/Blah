import { BaseModule } from '../BaseModule.js';
import { SUPABASE_CONFIG } from '../../config.js';

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
            // Add rate limiting check
            if (this._isRateLimited('signin')) {
                throw new Error('Too many sign in attempts. Please try again later.');
            }

            // Validate input
            if (!this._validateEmail(email) || !this._validatePassword(password)) {
                throw new Error('Invalid email or password format');
            }

            this.logger.info('Attempting sign in for:', email);
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) {
                this._updateRateLimit('signin');
                throw error;
            }

            // Clear rate limit on success
            this._clearRateLimit('signin');
            this.logger.info('Sign in successful');
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

    _isRateLimited(action) {
        const attempts = JSON.parse(sessionStorage.getItem(`${action}_attempts`) || '[]');
        const now = Date.now();
        // Remove attempts older than 15 minutes
        const recentAttempts = attempts.filter(time => now - time < 900000);
        return recentAttempts.length >= 5;
    }

    _updateRateLimit(action) {
        const attempts = JSON.parse(sessionStorage.getItem(`${action}_attempts`) || '[]');
        attempts.push(Date.now());
        sessionStorage.setItem(`${action}_attempts`, JSON.stringify(attempts));
    }

    _clearRateLimit(action) {
        sessionStorage.removeItem(`${action}_attempts`);
    }

    _validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    _validatePassword(password) {
        return password && password.length >= 8;
    }

    // Add CSRF token handling
    _generateCsrfToken() {
        const token = crypto.getRandomValues(new Uint8Array(32))
            .reduce((acc, val) => acc + val.toString(16).padStart(2, '0'), '');
        sessionStorage.setItem('csrf_token', token);
        return token;
    }

    _validateCsrfToken(token) {
        return token === sessionStorage.getItem('csrf_token');
    }
}
