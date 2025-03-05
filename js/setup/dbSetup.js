/**
 * Database setup script for Blah Discussion Platform
 */

// Use the global Supabase client
async function setupDatabase() {
    try {
        console.log('Starting database setup...');
        
        // Execute SQL commands directly through Supabase
        const commands = [
            // Create tables
            `CREATE TABLE IF NOT EXISTS public.profiles (
                id UUID PRIMARY KEY REFERENCES auth.users(id),
                username TEXT UNIQUE NOT NULL,
                display_name TEXT,
                avatar_url TEXT,
                bio TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );`,
            
            `CREATE TABLE IF NOT EXISTS public.user_preferences (
                user_id UUID PRIMARY KEY REFERENCES auth.users(id),
                dark_mode BOOLEAN DEFAULT FALSE,
                email_notifications BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );`,
            
            // Create RLS policies
            `ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;`,
            
            `CREATE POLICY "Public profiles are viewable by everyone"
            ON public.profiles FOR SELECT
            USING (true);`,
            
            `CREATE POLICY "Users can insert their own profile"
            ON public.profiles FOR INSERT
            WITH CHECK (auth.uid() = id);`,
            
            `CREATE POLICY "Users can update their own profile"
            ON public.profiles FOR UPDATE
            USING (auth.uid() = id);`,
            
            `ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;`,
            
            `CREATE POLICY "Users can view own preferences"
            ON public.user_preferences FOR SELECT
            USING (auth.uid() = user_id);`,
            
            `CREATE POLICY "Users can insert own preferences"
            ON public.user_preferences FOR INSERT
            WITH CHECK (auth.uid() = user_id);`,
            
            `CREATE POLICY "Users can update own preferences"
            ON public.user_preferences FOR UPDATE
            USING (auth.uid() = user_id);`
        ];

        // Execute each command separately
        for (const sql of commands) {
            try {
                const { error } = await window.projectSupabase.rpc('exec', { sql });
                if (error) {
                    console.warn('SQL command error (non-fatal):', error);
                    // Continue with other commands
                }
            } catch (err) {
                console.warn('Command execution error (non-fatal):', err);
                // Continue with other commands
            }
        }

        return true;
    } catch (error) {
        console.error('Error setting up database:', error);
        return false;
    }
}

// Check if database exists and set it up if needed
async function checkDatabaseExists() {
    try {
        console.log('Checking if database exists...');
        
        // Try to query the profiles table
        const { error } = await window.projectSupabase
            .from('profiles')
            .select('id')
            .limit(1);
        
        if (error && error.code === '42P01') {
            // Table doesn't exist, run setup
            console.log('Tables do not exist, running setup...');
            return await setupDatabase();
        } else if (error) {
            throw error;
        }
        
        console.log('Database exists and is ready');
        return true;
    } catch (error) {
        console.error('Database check error:', error);
        // Try to run setup anyway
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
    console.log('Database setup complete:', result);
}).catch(error => {
    console.error('Database setup failed:', error);
});

console.log('Database setup module loaded');
