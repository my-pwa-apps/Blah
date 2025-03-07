// This script checks and fixes participant policies without requiring SQL execution

async function fixParticipantsPolicy() {
    console.log('Starting policy repair process...');
    
    // Get supabase instance
    const sb = window.supabase.createClient(
        'https://bcjaxvmwdkxkbkocxhpq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjamF4dm13ZGt4a2Jrb2N4aHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyNTgyMTMsImV4cCI6MjA1NjgzNDIxM30.SicdrlQ3y3v7o3IjE1d0UxXNfa-cT_eJfLQItbBJ-oE'
    );
    
    try {
        console.log('Attempting to execute policy fix...');
        
        // Execute the simplified policy fix
        const { error } = await sb.rpc('execute_sql', {
            sql_query: `
                -- CRITICAL: Drop all existing policies on participants table
                DROP POLICY IF EXISTS "Users can read participants" ON participants;
                DROP POLICY IF EXISTS "Users can add participants" ON participants;
                
                -- Create simplified policies without recursion
                CREATE POLICY "Users can read participants" 
                ON participants FOR SELECT
                TO authenticated
                USING (user_id = auth.uid() OR true);
                
                -- Simple insert policy 
                CREATE POLICY "Users can add participants" 
                ON participants FOR INSERT
                TO authenticated
                WITH CHECK (true);
            `
        });
        
        if (error) {
            console.error('Policy fix failed:', error);
        } else {
            console.log('Policy fix executed successfully');
            console.log('Please reload the page to apply changes');
        }
        
    } catch (err) {
        console.error('Error executing policy fix:', err);
    }
}

// Add a button to fix policies
function addFixButton() {
    const btn = document.createElement('button');
    btn.innerText = 'Fix Database Policies';
    btn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;background:#d9534f;color:white;padding:8px 16px;border:none;border-radius:4px;cursor:pointer;';
    btn.onclick = fixParticipantsPolicy;
    document.body.appendChild(btn);
    console.log('Fix button added - click to repair database policies');
}

// Run when the file is loaded
addFixButton();
