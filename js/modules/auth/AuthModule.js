import { BaseModule } from '../BaseModule.js';
import { FIREBASE_CONFIG } from '../../config.js';

export class AuthModule extends BaseModule {
    constructor(app) {
        super(app);
        this.auth = null;
        this.firebase = null;
        this.currentUser = null;
    }

    async init() {
        try {
            this.firebase = window.firebase.initializeApp(FIREBASE_CONFIG);
            this.auth = window.firebase.getAuth(this.firebase);
            
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
            const userCredential = await window.firebase.createUserWithEmailAndPassword(this.auth, email, password);
            return { data: userCredential.user };
        } catch (error) {
            this.logger.error('Sign up failed:', error);
            throw error;
        }
    }

    async signIn(email, password) {
        try {
            const userCredential = await window.firebase.signInWithEmailAndPassword(this.auth, email, password);
            return { data: userCredential.user };
        } catch (error) {
            this.logger.error('Sign in failed:', error);
            throw error;
        }
    }

    async signOut() {
        try {
            await window.firebase.signOut(this.auth);
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
