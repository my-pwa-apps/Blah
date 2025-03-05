/**
 * Database setup script for Blah Discussion Platform
 * 
 * Run this script once to set up all required tables in your Supabase database.
 */

// Get the Supabase client
const supabase = window.projectSupabase;

async function setupDatabase() {
    try {
        console.log('Starting database setup...');
        
        // Use the Supabase SQL editor to execute these SQL commands:
        const sqlCommands = `
-- Create discussions table
CREATE TABLE IF NOT EXISTS discussions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    media_url TEXT,
    media_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    parent_id UUID REFERENCES discussions(id),
    user_id UUID,
    is_friend BOOLEAN DEFAULT FALSE
);

-- Create index for faster parent_id lookups
CREATE INDEX IF NOT EXISTS idx_discussions_parent_id ON discussions(parent_id);

-- Create storage bucket for media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('discussion-media', 'discussion-media', true)
ON CONFLICT DO NOTHING;

-- Set up storage policy to allow public reading
INSERT INTO storage.policies (name, definition, bucket_id)
VALUES 
(
  'Public Read Access',
  '{ "statement": "SELECT", "effect": "ALLOW", "actions": ["SELECT"], "principal": "*" }',
  'discussion-media'
)
ON CONFLICT DO NOTHING;
`;

        alert('Please execute the provided SQL commands in your Supabase SQL editor to set up the database tables.');
        console.log('SQL commands for setup:', sqlCommands);
        
        // Display instructions
        document.getElementById('discussions').innerHTML = `
            <div class="setup-instructions">
                <h2>Database Setup Required</h2>
                <p>Your Supabase database is not set up yet. Follow these steps:</p>
                <ol>
                    <li>Go to <a href="https://app.supabase.com/project/${supabaseUrl.split('//')[1].split('.')[0]}/sql" target="_blank">Supabase SQL Editor</a></li>
                    <li>Copy the SQL commands below</li>
                    <li>Paste them into the SQL Editor</li>
                    <li>Click "Run" to create the necessary tables</li>
                    <li>Refresh this page when done</li>
                </ol>
                <pre class="sql-code">${sqlCommands}</pre>
            </div>
        `;

        return false;
    } catch (error) {
        console.error('Error setting up database:', error);
        return false;
    }
}

// Check if database exists by trying to query the discussions table
async function checkDatabaseExists() {
    try {
        // Just check if the table exists by fetching a single row
        const { data, error } = await supabase
            .from('discussions')
            .select('id')
            .limit(1);
        
        if (error && error.code === '42P01') {
            // Table doesn't exist
            return await setupDatabase();
        } else if (error) {
            console.error('Error checking database:', error);
            return false;
        }
        
        // Table exists
        return true;
    } catch (error) {
        console.error('Error checking database:', error);
        return false;
    }
}

window.dbSetup = {
    checkDatabaseExists,
    setupDatabase
};
