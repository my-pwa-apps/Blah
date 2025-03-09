import { BaseModule } from '../BaseModule.js';
import { FIREBASE_CONFIG } from '../../config.js';
import { initializeApp } from 'firebase/app';
import { 
    getDatabase, 
    ref, 
    set, 
    get,
    push,
    onValue,
    query,
    orderByChild,
    equalTo,
    update,
    remove,
    serverTimestamp 
} from 'firebase/database';
import { AttachmentStorageManager } from './storage/StorageManager.js';

export class DataModule extends BaseModule {
    constructor(app) {
        super(app);
        this.firebase = null;
        this.db = null;
        this.connectionStatus = 'CONNECTING';
        this.activeListeners = new Map();
    }

    async init() {
        try {
            this.firebase = initializeApp(FIREBASE_CONFIG);
            this.db = getDatabase(this.firebase);
            
            // Monitor connection status
            const connectedRef = ref(this.db, '.info/connected');
            onValue(connectedRef, (snap) => {
                this.connectionStatus = snap.val() ? 'CONNECTED' : 'DISCONNECTED';
                this.logger.info(`Database connection status: ${this.connectionStatus}`);
            });
            
            // Initialize storage manager
            this.storageManager = new AttachmentStorageManager(this.app);
            await this.storageManager.init();
            
            this.logger.info('DataModule initialized with Firebase Realtime Database');
        } catch (error) {
            this.logger.error('Failed to initialize Firebase:', error);
            this.connectionStatus = 'ERROR';
            throw error;
        }
    }

    async createUserProfile(profileData) {
        try {
            const userRef = ref(this.db, `profiles/${profileData.id}`);
            await set(userRef, {
                ...profileData,
                created_at: serverTimestamp(),
                updated_at: serverTimestamp()
            });
            return this.fetchUserProfile(profileData.id);
        } catch (error) {
            this.logger.error('Error creating profile:', error);
            throw error;
        }
    }

    async sendMessage(conversationId, senderId, content, attachments = []) {
        try {
            const messagesRef = ref(this.db, `messages/${conversationId}`);
            const newMessageRef = push(messagesRef);
            
            const messageData = {
                id: newMessageRef.key,
                conversation_id: conversationId,
                sender_id: senderId,
                content: content || '',
                created_at: serverTimestamp(),
                attachments: attachments || []
            };
            
            await set(newMessageRef, messageData);
            
            // Update conversation's last message
            const conversationRef = ref(this.db, `conversations/${conversationId}`);
            await update(conversationRef, {
                last_message: {
                    content: content || 'Attachment',
                    sender_id: senderId,
                    created_at: serverTimestamp()
                }
            });

            return messageData;
        } catch (error) {
            this.logger.error('Error sending message:', error);
            throw error;
        }
    }

    subscribeToNewMessages(conversationId, callback) {
        try {
            const messagesRef = ref(this.db, `messages/${conversationId}`);
            
            const unsubscribe = onValue(messagesRef, (snapshot) => {
                if (snapshot.exists()) {
                    const messages = [];
                    snapshot.forEach((childSnapshot) => {
                        messages.push({
                            id: childSnapshot.key,
                            ...childSnapshot.val()
                        });
                    });
                    callback(messages[messages.length - 1]); // Send only the latest message
                }
            });
            
            // Store the unsubscribe function
            this.activeListeners.set(`messages_${conversationId}`, unsubscribe);
            
            return {
                unsubscribe: () => {
                    unsubscribe();
                    this.activeListeners.delete(`messages_${conversationId}`);
                },
                conversationId
            };
            
        } catch (error) {
            this.logger.error('Error setting up message subscription:', error);
            return {
                unsubscribe: () => {},
                conversationId
            };
        }
    }

    // ... implement other methods similarly ...
    
    cleanup() {
        // Unsubscribe from all active listeners
        for (const [key, unsubscribe] of this.activeListeners.entries()) {
            this.logger.info(`Cleaning up listener: ${key}`);
            unsubscribe();
        }
        this.activeListeners.clear();
    }
}
