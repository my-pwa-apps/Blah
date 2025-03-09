import { BaseModule } from '../BaseModule.js';

export class AuthModule extends BaseModule {
    constructor(app) {
        super(app);
        this.auth = null;
        this.currentUser = null;
    }

    async init() {
        try {
            this.auth = firebase.auth();
            
            // Set up auth state listener
            this.auth.onAuthStateChanged((user) => {
                this.currentUser = user;
                this._notifyAuthStateListeners(user);
            });
            
            this.logger.info('Auth module initialized with Firebase');
        } catch (error) {
            this.logger.error('Failed to initialize Firebase Auth:', error);
            throw error;
        }
    }

    async signUp(email, password) {
        try {
            const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
            return { data: userCredential.user };
        } catch (error) {
            this.logger.error('Sign up failed:', error);
            throw error;
        }
    }

    async signIn(email, password) {
        try {
            const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
            return { data: userCredential.user };
        } catch (error) {
            this.logger.error('Sign in failed:', error);
            throw error;
        }
    }

    async signOut() {
        try {
            await this.auth.signOut();
            return true;
        } catch (error) {
            this.logger.error('Sign out failed:', error);
            throw error;
        }
    }

    onAuthStateChange(callback) {
        return this.auth.onAuthStateChanged(callback);
    }
}
