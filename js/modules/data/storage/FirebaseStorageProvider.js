import { BaseModule } from '../../BaseModule.js';
import { FIREBASE_CONFIG } from '../../../config.js';
import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

export class FirebaseStorageProvider extends BaseModule {
    constructor(app) {
        super(app);
        this.name = 'firebase';
        this.firebaseApp = null;
        this.storage = null;
    }
    
    async init() {
        try {
            this.firebaseApp = initializeApp(FIREBASE_CONFIG, 'storage');
            this.storage = getStorage(this.firebaseApp);
            
            this.logger.info('Firebase Storage provider initialized');
            return true;
        } catch (error) {
            this.logger.error('Failed to initialize Firebase Storage:', error);
            return false;
        }
    }
    
    async checkAvailability() {
        try {
            // Simple check - try to list a folder
            const testRef = ref(this.storage, 'test/');
            await getDownloadURL(testRef).catch(() => {});
            return true;
        } catch (error) {
            this.logger.error('Firebase Storage not available:', error);
            return false;
        }
    }
    
    async uploadFile(file, userId) {
        try {
            // Create a unique file path
            const timestamp = Date.now();
            const fileExt = file.name.split('.').pop() || '';
            const safeFileName = `${timestamp}-${Math.random().toString(36).substring(2, 10)}${fileExt ? '.' + fileExt : ''}`;
            const filePath = `${userId}/${safeFileName}`;
            
            // Create a storage reference
            const storageRef = ref(this.storage, filePath);
            
            // Upload the file
            const snapshot = await uploadBytes(storageRef, file);
            
            // Get the download URL
            const url = await getDownloadURL(storageRef);
            
            this.logger.info(`File uploaded to Firebase Storage: ${filePath}`);
            
            return {
                name: file.name,
                path: filePath,
                size: file.size,
                type: file.type,
                url: url,
                storage: this.name
            };
        } catch (error) {
            this.logger.error('Firebase upload error:', error);
            throw error;
        }
    }
    
    async deleteFile(filePath) {
        try {
            const fileRef = ref(this.storage, filePath);
            await deleteObject(fileRef);
            this.logger.info(`File deleted from Firebase Storage: ${filePath}`);
            return true;
        } catch (error) {
            this.logger.error('Error deleting file from Firebase:', error);
            return false;
        }
    }
}
