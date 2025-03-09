import { BaseModule } from '../../BaseModule.js';
import { FIREBASE_CONFIG } from '../../../config.js';
import { initializeApp } from 'firebase/app';
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL,
    deleteObject 
} from 'firebase/storage';

export class AttachmentStorageManager extends BaseModule {
    constructor(app) {
        super(app);
        this.firebase = null;
        this.storage = null;
        this.maxBase64Size = 2 * 1024 * 1024;
    }

    async init() {
        try {
            this.firebase = initializeApp(FIREBASE_CONFIG, 'storage');
            this.storage = getStorage(this.firebase);
            this.logger.info('Firebase Storage initialized');
        } catch (error) {
            this.logger.error('Failed to initialize Firebase Storage:', error);
            throw error;
        }
    }

    async uploadFile(file, userId) {
        try {
            if (!file || !userId) {
                throw new Error('Missing file or user ID for upload');
            }

            // Try Firebase Storage first
            try {
                return await this._uploadToFirebaseStorage(file, userId);
            } catch (error) {
                this.logger.warn('Firebase upload failed, trying base64 fallback', error);
                
                if (file.size > this.maxBase64Size) {
                    throw new Error(`File too large for base64 fallback (max ${this.maxBase64Size/1024/1024}MB)`);
                }
                
                return await this._uploadAsBase64(file, userId);
            }
        } catch (error) {
            this.logger.error('Error uploading file:', error);
            throw error;
        }
    }

    async _uploadToFirebaseStorage(file, userId) {
        const timestamp = Date.now();
        const fileExt = file.name.split('.').pop() || '';
        const safeFileName = `${timestamp}-${Math.random().toString(36).substring(2, 10)}${fileExt ? '.' + fileExt : ''}`;
        const filePath = `attachments/${userId}/${safeFileName}`;
        
        const fileRef = ref(this.storage, filePath);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        
        return {
            name: file.name,
            path: filePath,
            size: file.size,
            type: file.type,
            url: url,
            storage: 'firebase'
        };
    }

    async _uploadAsBase64(file, userId) {
        this.logger.info(`Using base64 fallback for file: ${file.name}`);
        
        // Create a unique ID for the file
        const timestamp = Date.now();
        const pseudoPath = `${userId}/${timestamp}-${file.name}`;
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const base64Data = event.target.result;
                    
                    resolve({
                        name: file.name,
                        path: pseudoPath,
                        size: file.size,
                        type: file.type,
                        url: base64Data,
                        storage: 'base64'
                    });
                    
                    this.logger.info(`Base64 encoding successful for: ${file.name}`);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = (error) => {
                reject(error);
            };
            
            reader.readAsDataURL(file);
        });
    }

    async deleteFile(filePath) {
        try {
            const fileRef = ref(this.storage, filePath);
            await deleteObject(fileRef);
            return true;
        } catch (error) {
            this.logger.error('Error deleting file:', error);
            return false;
        }
    }
}
