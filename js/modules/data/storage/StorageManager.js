import { BaseModule } from '../../BaseModule.js';

export class StorageManager extends BaseModule {
    constructor(app) {
        super(app);
        this.supabase = null;
        this.maxBase64Size = 2 * 1024 * 1024; // 2MB limit for base64 fallback
    }
    
    async init() {
        // Get supabase client from DataModule
        this.supabase = this.getModule('data').supabase;
        this.logger.info('StorageManager initialized');
    }
    
    async uploadFile(file, userId) {
        try {
            if (!file || !userId) {
                throw new Error('Missing file or user ID for upload');
            }
            
            this.logger.info(`Starting upload for file: ${file.name} (${file.size} bytes, ${file.type})`);
            
            // First try Supabase storage
            try {
                const attachment = await this._uploadToSupabaseStorage(file, userId);
                this.logger.info('File uploaded to Supabase storage successfully');
                return attachment;
            } catch (storageError) {
                this.logger.warn('Supabase storage upload failed, trying base64 fallback', storageError);
                
                // If file is too large for base64, we can't fall back
                if (file.size > this.maxBase64Size) {
                    throw new Error(`File too large for base64 fallback (max ${this.maxBase64Size/1024/1024}MB). Storage bucket error: ${storageError.message}`);
                }
                
                // Try base64 fallback for smaller files
                return await this._uploadAsBase64(file, userId);
            }
        } catch (error) {
            this.logger.error('Error uploading file:', error);
            throw error;
        }
    }
    
    async _uploadToSupabaseStorage(file, userId) {
        // First check if the bucket exists with improved approach
        const bucketExists = await this._checkBucketExists();
        
        if (!bucketExists) {
            throw new Error('Supabase storage bucket not available');
        }
        
        // Create a unique, sanitized filename
        const timestamp = Date.now();
        const fileExt = file.name.split('.').pop() || '';
        const safeFileName = `${timestamp}-${Math.random().toString(36).substring(2, 10)}${fileExt ? '.' + fileExt : ''}`;
        const filePath = `${userId}/${safeFileName}`;
        
        this.logger.info(`Uploading to path: ${filePath}`);
        
        // Upload the file
        const { data, error } = await this.supabase.storage
            .from('attachments')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (error) {
            throw error;
        }
        
        // Get the public URL
        const { data: publicUrlData } = this.supabase.storage
            .from('attachments')
            .getPublicUrl(filePath);
            
        if (!publicUrlData || !publicUrlData.publicUrl) {
            throw new Error('Failed to get public URL for uploaded file');
        }
        
        return {
            name: file.name,
            path: filePath,
            size: file.size,
            type: file.type,
            url: publicUrlData.publicUrl,
            storage: 'supabase'
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
    
    async _checkBucketExists() {
        try {
            // Try different approaches to check if bucket exists
            
            // 1. First try direct bucket API
            try {
                const { data, error } = await this.supabase.storage.getBucket('attachments');
                if (!error) {
                    return true;
                }
            } catch (directError) {
                this.logger.debug('Direct bucket check failed:', directError);
            }
            
            // 2. Try listing all buckets
            try {
                const { data: buckets, error } = await this.supabase.storage.listBuckets();
                
                if (error) {
                    return false;
                }
                
                const bucketExists = buckets?.some(bucket => 
                    bucket.name.toLowerCase() === 'attachments' || 
                    bucket.id.toLowerCase() === 'attachments');
                
                if (bucketExists) {
                    return true;
                }
            } catch (listError) {
                this.logger.debug('Bucket listing failed:', listError);
            }
            
            // 3. Try a simple list operation as a last resort
            try {
                const { data, error } = await this.supabase.storage
                    .from('attachments')
                    .list();
                
                return !error;
            } catch (listError) {
                return false;
            }
            
            return false;
        } catch (error) {
            this.logger.error('Error checking bucket existence:', error);
            return false;
        }
    }
}
