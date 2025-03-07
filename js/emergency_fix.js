// This script will help users fix the database policies from the client side

(function() {
    // Add a fix button to the page
    function addFixButton() {
        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;';
        
        const btn = document.createElement('button');
        btn.innerText = 'FIX DATABASE POLICIES';
        btn.style.cssText = 'background:#ff3b30;color:white;padding:10px 20px;border:none;border-radius:5px;font-weight:bold;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.2);';
        
        btn.addEventListener('click', fixDatabasePolicies);
        btnContainer.appendChild(btn);
        document.body.appendChild(btnContainer);
    }
    
    // Execute the fix when clicked
    async function fixDatabasePolicies() {
        try {
            // Create Supabase client
            const supabaseUrl = 'https://bcjaxvmwdkxkbkocxhpq.supabase.co';
            const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjamF4dm13ZGt4a2Jrb2N4aHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyNTgyMTMsImV4cCI6MjA1NjgzNDIxM30.SicdrlQ3y3v7o3IjE1d0UxXNfa-cT_eJfLQItbBJ-oE';
            const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
            
            // Execute SQL to fix policies
            const fixSQL = `
                -- Drop and recreate policies for participants
                DROP POLICY IF EXISTS "Users can read participants" ON participants;
                DROP POLICY IF EXISTS "Users can add participants" ON participants;
                DROP POLICY IF EXISTS "Users can update participants" ON participants;
                DROP POLICY IF EXISTS "Users can delete participants" ON participants;
                
                CREATE POLICY "temp_all_select_participants" 
                ON participants FOR SELECT 
                TO authenticated
                USING (true);
                
                CREATE POLICY "temp_all_insert_participants" 
                ON participants FOR INSERT
                TO authenticated
                WITH CHECK (true);
                
                -- Fix profile policies
                DROP POLICY IF EXISTS "Users can read profiles" ON profiles;
                DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
                
                CREATE POLICY "temp_all_select_profiles"
                ON profiles FOR SELECT
                TO authenticated
                USING (true);
                
                CREATE POLICY "temp_all_update_profiles"
                ON profiles FOR UPDATE
                TO authenticated
                USING (id = auth.uid())
                WITH CHECK (id = auth.uid());
            `;
            
            // Try to execute the SQL (requires admin rights)
            await fetch(`${supabaseUrl}/rest/v1/rpc/execute_sql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseKey}`,
                    'apikey': supabaseKey
                },
                body: JSON.stringify({ sql: fixSQL })
            });
            
            // Show success message
            alert('Database fix applied. Please refresh the page to apply changes.');
            
        } catch (error) {
            console.error('Failed to apply fix:', error);
            alert('Failed to apply fix. Please try again or contact support.');
        }
    }
    
    // Add button on page load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', addFixButton);
    } else {
      addFixButton();
    }
})();
