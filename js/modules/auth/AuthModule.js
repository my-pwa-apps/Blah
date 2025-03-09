import { BaseModule } from '../BaseModule.js';
import { FIREBASE_CONFIG } from '../../config.js';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged 
} from 'firebase/auth';

export class AuthModule extends BaseModule {
    constructor(app) {
        super(app);
        this.auth = null;
        this.firebase = null;
        this.currentUser = null;
    }

    async init() {
        try {
            this.firebase = initializeApp(FIREBASE_CONFIG);
            this.auth = getAuth(this.firebase);
            
            // Set up auth state listener
            onAuthStateChanged(this.auth, (user) => {
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
            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            return { data: userCredential.user };
        } catch (error) {
            this.logger.error('Sign up failed:', error);
            throw error;
        }
    }

    async signIn(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
            return { data: userCredential.user };
        } catch (error) {
            this.logger.error('Sign in failed:', error);
            throw error;
        }
    }

    async signOut() {
        try {
            await firebaseSignOut(this.auth);
            return true;
        } catch (error) {
            this.logger.error('Sign out failed:', error);
            throw error;
        }
    }

    onAuthStateChange(callback) {
        return onAuthStateChanged(this.auth, callback);
    }
}
