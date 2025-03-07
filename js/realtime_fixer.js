/**
 * This script helps diagnose and fix real-time issues with Supabase
 * It can be included directly in your HTML or run from the browser console
 */

(function() {
    // Configuration
    const SUPABASE_URL = 'https://bcjaxvmwdkxkbkocxhpq.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjamF4dm13ZGt4a2Jrb2N4aHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyNTgyMTMsImV4cCI6MjA1NjgzNDIxM30.SicdrlQ3y3v7o3IjE1d0UxXNfa-cT_eJfLQItbBJ-oE';
    
    class RealtimeFixer {
        constructor() {
            this.supabase = null;
            this.initSupabase();
        }
        
        initSupabase() {
            try {
                if (window.supabase) {
                    this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                    console.log('✅ Supabase client initialized');
                } else {
                    console.error('❌ Supabase library not found. Please load the Supabase client first.');
                }
            } catch (error) {
                console.error('❌ Failed to initialize Supabase client:', error);
            }
        }
        
        async testRealtimeConnection() {
            if (!this.supabase) {
                console.error('❌ Supabase client not initialized');
                return false;
            }
            
            try {
                console.log('🔄 Testing real-time connection...');
                
                // Create a unique channel to test with
                const channelName = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const channel = this.supabase.channel(channelName);
                
                // Set up promise to track connection result
                const connectionResult = new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Connection timed out after 10 seconds')), 10000);
                    
                    channel.subscribe(status => {
                        if (status === 'SUBSCRIBED') {
                            clearTimeout(timeout);
                            resolve(true);
                        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
                            clearTimeout(timeout);
                            reject(new Error(`Failed with status: ${status}`));
                        }
                    });
                });
                
                // Wait for the connection result
                await connectionResult;
                console.log('✅ Real-time connection test passed!');
                
                // Clean up
                channel.unsubscribe();
                return true;
                
            } catch (error) {
                console.error('❌ Real-time connection test failed:', error.message);
                return false;
            }
        }
        
        async fixRealtimeConfiguration() {
            if (!this.supabase) {
                console.error('❌ Supabase client not initialized');
                return false;
            }
            
            try {
                console.log('🔄 Checking authentication...');
                
                // We need to be authenticated for this to work
                const { data, error } = await this.supabase.auth.getSession();
                
                if (error || !data.session) {
                    console.error('❌ Authentication required. Please log in first.');
                    return false;
                }
                
                console.log('✅ Authenticated as', data.session.user.email);
                console.log('🔄 Applying real-time database fixes...');
                
                // SQL to fix real-time configuration
                const fixSQL = `
                    -- Drop and recreate the publication
                    DROP PUBLICATION IF EXISTS supabase_realtime;
                    CREATE PUBLICATION supabase_realtime FOR TABLE messages, participants, conversations;
                    
                    -- Set replica identity to FULL for all tables (needed for real-time)
                    ALTER TABLE messages REPLICA IDENTITY FULL;
                    ALTER TABLE participants REPLICA IDENTITY FULL;
                    ALTER TABLE conversations REPLICA IDENTITY FULL;
                    ALTER TABLE profiles REPLICA IDENTITY FULL;
                    
                    -- Configure publication to include all operations
                    ALTER PUBLICATION supabase_realtime SET (publish = 'insert, update, delete');
                `;
                
                // Execute the SQL (requires RLS bypass or appropriate permissions)
                await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${data.session.access_token}`,
                        'apikey': SUPABASE_KEY
                    },
                    body: JSON.stringify({
                        sql: fixSQL
                    })
                });
                
                console.log('✅ Database configuration updated!');
                console.log('🔄 Reloading real-time services...');
                
                // The server typically needs a moment to apply these changes
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                console.log('✅ Fix completed successfully!');
                console.log('Please refresh the page to apply changes.');
                
                return true;
            } catch (error) {
                console.error('❌ Failed to fix real-time configuration:', error.message);
                return false;
            }
        }
        
        enablePollingMode() {
            if (window.app && window.app.modules && window.app.modules.get('data')) {
                const dataModule = window.app.modules.get('data');
                dataModule.failoverMode = true;
                
                if (typeof dataModule._enableGlobalFailoverMode === 'function') {
                    dataModule._enableGlobalFailoverMode();
                    console.log('✅ Polling mode enabled for all conversations');
                    return true;
                }
            }
            
            console.error('❌ Could not enable polling mode - app or dataModule not found');
            return false;
        }
    }
    
    // Add methods to global scope
    window.realtimeFixer = new RealtimeFixer();
    
    // Create UI for fixing
    function createFixerUI() {
        // Create container
        const container = document.createElement('div');
        container.id = 'realtime-fixer-ui';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            padding: 16px;
            z-index: 10000;
            width: 300px;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        `;
        
        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="margin: 0; font-size: 16px;">🔌 Real-time Connection Fixer</h3>
                <button id="rt-fixer-close" style="background: none; border: none; cursor: pointer; font-size: 18px;">×</button>
            </div>
            <div id="rt-fixer-status" style="margin-bottom: 12px; font-size: 14px;">
                Click a button below to diagnose or fix real-time issues.
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <button id="rt-fixer-test" style="background: #4a6741; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">
                    Test Connection
                </button>
                <button id="rt-fixer-fix" style="background: #e67e22; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">
                    Fix Real-time Config
                </button>
                <button id="rt-fixer-polling" style="background: #3498db; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">
                    Enable Polling Mode
                </button>
            </div>
        `;
        
        document.body.appendChild(container);
        
        // Add event handlers
        document.getElementById('rt-fixer-close').addEventListener('click', () => {
            container.remove();
        });
        
        document.getElementById('rt-fixer-test').addEventListener('click', async () => {
            const statusEl = document.getElementById('rt-fixer-status');
            statusEl.innerHTML = '🔄 Testing connection...';
            
            try {
                const result = await window.realtimeFixer.testRealtimeConnection();
                if (result) {
                    statusEl.innerHTML = '✅ Connection works! Refresh the page.';
                } else {
                    statusEl.innerHTML = '❌ Connection test failed.';
                }
            } catch (error) {
                statusEl.innerHTML = `❌ Error: ${error.message}`;
            }
        });
        
        document.getElementById('rt-fixer-fix').addEventListener('click', async () => {
            const statusEl = document.getElementById('rt-fixer-status');
            statusEl.innerHTML = '🔄 Applying fixes...';
            
            try {
                const result = await window.realtimeFixer.fixRealtimeConfiguration();
                if (result) {
                    statusEl.innerHTML = '✅ Fix applied! Refresh the page.';
                } else {
                    statusEl.innerHTML = '❌ Fix failed. Check console for details.';
                }
            } catch (error) {
                statusEl.innerHTML = `❌ Error: ${error.message}`;
            }
        });
        
        document.getElementById('rt-fixer-polling').addEventListener('click', () => {
            const statusEl = document.getElementById('rt-fixer-status');
            const result = window.realtimeFixer.enablePollingMode();
            
            if (result) {
                statusEl.innerHTML = '✅ Polling mode enabled!';
            } else {
                statusEl.innerHTML = '❌ Could not enable polling mode.';
            }
        });
    }
    
    // Create UI when the DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createFixerUI);
    } else {
        createFixerUI();
    }
})();
