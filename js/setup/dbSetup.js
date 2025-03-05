/**
 * Database setup script for Blah Discussion Platform
 */

async function setupDatabase() {
    try {
        console.log('Starting database setup...');
        
        // Create tables using native Supabase methods
        const tables = [
            {
                name: 'profiles',
                query: `
                    id UUID PRIMARY KEY REFERENCES auth.users(id),
                    username TEXT UNIQUE NOT NULL,
                    display_name TEXT,
                    avatar_url TEXT,
                    bio TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                `
            },
            {
                name: 'user_preferences',
                query: `
                    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
                    dark_mode BOOLEAN DEFAULT FALSE,
                    email_notifications BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                `
            }
        ];

        // Create each table
        for (const table of tables) {
            const { error } = await window.projectSupabase
                .from(table.name)
                .select()
                .limit(1)
                .catch(() => ({ error: { code: '42P01' } })); // Table doesn't exist error

            if (error && error.code === '42P01') {
                // Table doesn't exist, create it
                const createResult = await window.projectSupabase
                    .rpc('create_table', { 
                        table_name: table.name,
                        table_definition: table.query
                    });

                if (createResult.error) {
                    console.warn(`Error creating table ${table.name}:`, createResult.error);
                } else {
                    console.log(`Created table ${table.name}`);
                }
            }
        }

        // Set up storage buckets
        const buckets = ['discussion-media', 'avatars'];
        for (const bucket of buckets) {
            const { error } = await window.projectSupabase.storage
                .createBucket(bucket, { public: true })
                .catch(err => ({ error: err }));

            if (error && !error.message.includes('already exists')) {
                console.warn(`Error creating bucket ${bucket}:`, error);
            }
        }

        // Enable Row Level Security (RLS)
        const enableRLS = async (table) => {
            const { error } = await window.projectSupabase
                .from(table)
                .select()
                .limit(1);

            if (!error || error.code !== '42501') { // If no permission error, RLS might be enabled
                return;
            }

            await window.projectSupabase
                .rpc('enable_rls', { table_name: table });
        };

        await Promise.all(['profiles', 'user_preferences'].map(enableRLS));

        console.log('Database setup completed');
        return true;
    } catch (error) {
        console.error('Error setting up database:', error);
        return false;
    }
}

// Check if database exists by trying to query tables
async function checkDatabaseExists() {
    try {
        console.log('Checking if database exists...');
        
        // Try to query both main tables
        const [profilesCheck, prefsCheck] = await Promise.all([
            window.projectSupabase.from('profiles').select('id').limit(1),
            window.projectSupabase.from('user_preferences').select('user_id').limit(1)
        ]);

        if (profilesCheck.error || prefsCheck.error) {
            console.log('Database needs setup');
            return await setupDatabase();
        }

        console.log('Database exists and is ready');
        return true;
    } catch (error) {
        console.error('Database check error:', error);
        // Attempt setup on any error
        return await setupDatabase();
    }
}

// Make sure we initialize dbSetup before it's used
window.dbSetup = {
    checkDatabaseExists,
    setupDatabase
};

// Run check immediately
checkDatabaseExists().then(result => {
    console.log('Database initialization complete:', result);
}).catch(error => {
    console.error('Database initialization failed:', error);
});

console.log('Database setup module loaded');
