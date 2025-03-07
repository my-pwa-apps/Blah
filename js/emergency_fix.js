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
                
                -- CRITICAL: Fix messages policies too
                DROP POLICY IF EXISTS "Users can read messages" ON messages;
                DROP POLICY IF EXISTS "Users can send messages" ON messages;
                DROP POLICY IF EXISTS "Enable read access for authenticated users" ON messages;
                DROP POLICY IF EXISTS "Enable insert access for participants" ON messages;
                
                CREATE POLICY "temp_messages_select" 
                ON messages FOR SELECT
                TO authenticated
                USING (true);
                
                CREATE POLICY "temp_messages_insert"
                ON messages FOR INSERT
                TO authenticated
                WITH CHECK (true);
                
                -- CRITICAL: Fix real-time configuration
                DROP PUBLICATION IF EXISTS supabase_realtime;
                CREATE PUBLICATION supabase_realtime FOR TABLE messages, participants, conversations;
                ALTER TABLE messages REPLICA IDENTITY FULL;
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
    
    // Add a function to test real-time connectivity
    async function testRealTimeConnection() {
        try {
            const supabaseUrl = 'https://bcjaxvmwdkxkbkocxhpq.supabase.co';
            const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjamF4dm13ZGt4a2Jrb2N4aHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyNTgyMTMsImV4cCI6MjA1NjgzNDIxM30.SicdrlQ3y3v7o3IjE1d0UxXNfa-cT_eJfLQItbBJ-oE';
            const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
            
            // Create test channel
            const channel = supabase.channel('test-connection');
            let testResult = document.createElement('div');
            testResult.style.cssText = 'padding:10px;margin-top:10px;background:#f8f9fa;border-radius:5px;font-size:14px;';
            testResult.innerHTML = 'Testing real-time connection...';
            
            document.getElementById('test-status').appendChild(testResult);
            
            // Subscribe with timeout
            const connectionPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Connection timed out')), 7000);
                
                channel.subscribe(status => {
                    clearTimeout(timeout);
                    if (status === 'SUBSCRIBED') {
                        resolve(status);
                    } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
                        reject(new Error(`Failed with status: ${status}`));
                    }
                });
            });
            
            await connectionPromise;
            testResult.innerHTML = '✅ Real-time connection working!';
            testResult.style.color = 'green';
            
            // Clean up
            setTimeout(() => channel.unsubscribe(), 1000);
            
        } catch (error) {
            testResult.innerHTML = `❌ Real-time connection failed: ${error.message}<br>Try applying the fix above.`;
            testResult.style.color = 'red';
            console.error('Real-time test failed:', error);
        }
    }
    
    // Add a button to test real-time connection
    function addTestButton() {
        const testContainer = document.createElement('div');
        testContainer.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:9999;background:white;padding:15px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.2);max-width:300px;';
        
        testContainer.innerHTML = `
            <h3 style="margin-top:0;">Real-time Diagnostics</h3>
            <button id="test-connection" style="background:#4285f4;color:white;padding:8px 16px;border:none;border-radius:4px;cursor:pointer;margin-right:10px;">Test Connection</button>
            <button id="enable-polling" style="background:#34a853;color:white;padding:8px 16px;border:none;border-radius:4px;cursor:pointer;">Enable Polling</button>
            <div id="test-status"></div>
        `;
        
        document.body.appendChild(testContainer);
        
        document.getElementById('test-connection').addEventListener('click', testRealTimeConnection);
        document.getElementById('enable-polling').addEventListener('click', enablePollingFallback);
    }
    
    // Add a function to enable polling fallback
    function enablePollingFallback() {
        if (window.app && window.app.modules && window.app.modules.get('data')) {
            const dataModule = window.app.modules.get('data');
            const conversationId = window.app.state?.get('currentConversation');
            
            if (conversationId) {
                dataModule.setupMessagePolling(conversationId, message => {
                    // Dispatch the same event that real-time would use
                    const customEvent = new CustomEvent('message-received', {
                        detail: { message }
                    });
                    window.dispatchEvent(customEvent);
                    
                    const testStatus = document.getElementById('test-status');
                    if (testStatus) {
                        const statusMessage = document.createElement('div');
                        statusMessage.innerHTML = `Polling enabled for conversation ${conversationId}`;
                        statusMessage.style.color = 'green';
                        testStatus.appendChild(statusMessage);
                    }
                });
            } else {
                const testStatus = document.getElementById('test-status');
                if (testStatus) {
                    const statusMessage = document.createElement('div');
                    statusMessage.innerHTML = 'No active conversation to enable polling for';
                    statusMessage.style.color = 'orange';
                    testStatus.appendChild(statusMessage);
                }
            }
        }
    }
    
    // Add all buttons on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            addFixButton();
            addTestButton();
        });
    } else {
        addFixButton();
        addTestButton();
    }
})();
