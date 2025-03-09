import { BaseModule } from '../BaseModule.js';

export class StorageFixerModule extends BaseModule {
    constructor(app) {
        super(app);
        this.supabase = null;
    }
    
    async init() {
        this.supabase = this.getModule('data').supabase;
        this.logger.info('Storage Fixer module initialized');
    }
    
    async createAttachmentsBucket() {
        try {
            this.logger.info('Attempting to create attachments bucket directly');
            
            // Try direct bucket creation
            const { data, error } = await this.supabase.storage.createBucket('attachments', {
                public: true,
                fileSizeLimit: 10485760, // 10MB
                allowedMimeTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf', 'text/*']
            });
            
            if (error) {
                this.logger.error('Error creating bucket:', error);
                return { 
                    success: false, 
                    error: error.message,
                    needsPolicy: error.message.includes('policy')
                };
            }
            
            this.logger.info('Successfully created attachments bucket:', data);
            return { success: true, data };
            
        } catch (error) {
            this.logger.error('Error in bucket creation:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }
    
    async createDefaultPolicies() {
        try {
            const policies = [
                {
                    name: "Authenticated users can read attachments",
                    definition: "bucket_id = 'attachments' AND auth.role() = 'authenticated'",
                    operation: "SELECT" 
                },
                {
                    name: "Users can upload their own attachments",
                    definition: "bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1] AND auth.role() = 'authenticated'",
                    operation: "INSERT"
                }
            ];
            
            const results = [];
            
            for (const policy of policies) {
                try {
                    // Use rpc to create policy
                    const { data, error } = await this.supabase.rpc('create_storage_policy', {
                        policy_name: policy.name,
                        policy_definition: policy.definition,
                        policy_operation: policy.operation,
                        policy_bucket: 'attachments'
                    });
                    
                    results.push({
                        policy: policy.name,
                        success: !error,
                        error: error?.message || null
                    });
                } catch (policyError) {
                    results.push({
                        policy: policy.name,
                        success: false,
                        error: policyError.message
                    });
                }
            }
            
            return results;
        } catch (error) {
            this.logger.error('Error creating policies:', error);
            return [{ policy: 'all', success: false, error: error.message }];
        }
    }
    
    // Add a method to test bucket access
    async testBucketAccess() {
        const tests = [];
        
        // Test 1: Check if bucket exists
        try {
            const { data: buckets, error } = await this.supabase.storage.listBuckets();
            const foundBucket = buckets?.find(b => 
                b.name.toLowerCase() === 'attachments' || 
                b.id.toLowerCase() === 'attachments'
            );
            
            tests.push({
                name: 'Bucket exists',
                success: !error && foundBucket,
                details: foundBucket ? `Found bucket: ${foundBucket.id}` : 'Bucket not found',
                error: error?.message || null
            });
        } catch (error) {
            tests.push({
                name: 'Bucket exists',
                success: false,
                details: 'Error checking buckets',
                error: error.message
            });
        }
        
        // Test 2: Try to list files in the bucket
        try {
            const { data, error } = await this.supabase.storage
                .from('attachments')
                .list();
                
            tests.push({
                name: 'List files',
                success: !error,
                details: error ? 'Failed to list files' : `Listed ${data?.length || 0} files`,
                error: error?.message || null
            });
        } catch (error) {
            tests.push({
                name: 'List files',
                success: false,
                details: 'Error listing files',
                error: error.message
            });
        }
        
        // Test 3: Try to create a tiny test file
        try {
            const testFile = new Blob(['test'], { type: 'text/plain' });
            const testPath = `test-${Date.now()}.txt`;
            
            const { data, error } = await this.supabase.storage
                .from('attachments')
                .upload(testPath, testFile);
                
            const success = !error && data;
            
            // If upload worked, try to delete it
            if (success) {
                await this.supabase.storage
                    .from('attachments')
                    .remove([testPath]);
            }
            
            tests.push({
                name: 'Create test file',
                success,
                details: success ? 'Successfully created and deleted test file' : 'Failed to create test file',
                error: error?.message || null
            });
        } catch (error) {
            tests.push({
                name: 'Create test file',
                success: false,
                details: 'Error testing file creation',
                error: error.message
            });
        }
        
        return tests;
    }
}
