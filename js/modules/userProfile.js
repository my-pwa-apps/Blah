/**
 * User profile module
 * Handle user profile operations and preferences
 */

const UserProfile = {
    /**
     * Initialize the profile system
     * This checks if the user is logged in and loads their profile
     * @returns {Promise<Object|null>} - Current user profile or null if not logged in
     */
    async init() {
        try {
            const { session, user, profile } = await window.UserAuth.getCurrentSession();
            
            if (session && user && profile) {
                // Apply user preferences from profile
                this.applyUserPreferences(profile.preferences);
                return profile;
            }
            
            return null;
        } catch (error) {
            console.error('Error initializing user profile:', error);
            return null;
        }
    },
    
    /**
     * Apply user preferences to the UI
     * @param {Object} preferences - User preferences object
     */
    applyUserPreferences(preferences) {
        if (!preferences) return;
        
        // Apply dark mode if enabled
        if (preferences.dark_mode) {
            const darkModeElements = [
                document.body, 
                document.querySelector('header'), 
                ...document.querySelectorAll('button')
            ];
            
            darkModeElements.forEach(element => {
                if (element) element.classList.add('dark-mode');
            });
        }
        
        // Store that we've applied preferences
        this.preferencesApplied = true;
    },
    
    /**
     * Toggle dark mode and save preference to database
     * @returns {Promise<boolean>} - New dark mode state
     */
    async toggleDarkMode() {
        try {
            const darkModeElements = [
                document.body, 
                document.querySelector('header'), 
                ...document.querySelectorAll('button')
            ];
            
            // Toggle classes first for immediate feedback
            darkModeElements.forEach(element => {
                if (element) element.classList.toggle('dark-mode');
            });
            
            // Determine new state
            const isDarkMode = document.body.classList.contains('dark-mode');
            
            // Save to database if user is logged in
            const { session } = await window.UserAuth.getCurrentSession();
            if (session) {
                await window.UserAuth.updateProfile({ dark_mode: isDarkMode });
            } else {
                // Fall back to localStorage for non-logged in users
                localStorage.setItem('darkMode', isDarkMode);
            }
            
            return isDarkMode;
        } catch (error) {
            console.error('Error toggling dark mode:', error);
            // Don't revert the UI change even if the save fails
            return document.body.classList.contains('dark-mode');
        }
    },
    
    /**
     * Get user's friends list
     * @returns {Promise<Array>} - List of friends
     */
    async getFriends() {
        try {
            const { session } = await window.UserAuth.getCurrentSession();
            if (!session) return [];
            
            const userId = session.user.id;
            
            // Get accepted friendships where the user is either the requester or the recipient
            const { data: friendships, error } = await window.projectSupabase
                .from('friendships')
                .select(`
                    id,
                    status,
                    friend:profiles!friendships_friend_id_fkey(id, username, display_name, avatar_url)
                `)
                .eq('user_id', userId)
                .eq('status', 'accepted');
                
            if (error) throw error;
            
            const { data: reverseFriendships, error: reverseError } = await window.projectSupabase
                .from('friendships')
                .select(`
                    id,
                    status,
                    friend:profiles!friendships_user_id_fkey(id, username, display_name, avatar_url)
                `)
                .eq('friend_id', userId)
                .eq('status', 'accepted');
                
            if (reverseError) throw reverseError;
            
            // Combine and clean up the results
            const allFriends = [
                ...(friendships || []).map(f => f.friend),
                ...(reverseFriendships || []).map(f => f.friend)
            ];
            
            return allFriends;
        } catch (error) {
            console.error('Error fetching friends:', error);
            return [];
        }
    },
    
    /**
     * Get pending friend requests
     * @returns {Promise<Array>} - List of pending requests
     */
    async getPendingFriendRequests() {
        try {
            const { session } = await window.UserAuth.getCurrentSession();
            if (!session) return [];
            
            const userId = session.user.id;
            
            // Get pending requests sent to this user
            const { data, error } = await window.projectSupabase
                .from('friendships')
                .select(`
                    id,
                    created_at,
                    user:profiles!friendships_user_id_fkey(id, username, display_name, avatar_url)
                `)
                .eq('friend_id', userId)
                .eq('status', 'pending');
                
            if (error) throw error;
            
            return data || [];
        } catch (error) {
            console.error('Error fetching pending friend requests:', error);
            return [];
        }
    },
    
    /**
     * Respond to a friend request
     * @param {string} requestId - The friendship request ID
     * @param {boolean} accept - Whether to accept or reject the request
     * @returns {Promise<boolean>} - Success status
     */
    async respondToFriendRequest(requestId, accept) {
        try {
            const { error } = await window.projectSupabase
                .from('friendships')
                .update({
                    status: accept ? 'accepted' : 'rejected',
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestId);
                
            if (error) throw error;
            
            return true;
        } catch (error) {
            console.error('Error responding to friend request:', error);
            return false;
        }
    },

    /**
     * Delete a discussion or reply
     * @param {string} discussionId - ID of the discussion/reply to delete
     * @returns {Promise<boolean>} - Success status
     */
    async deleteDiscussion(discussionId) {
        try {
            const { error } = await window.projectSupabase
                .from('discussions')
                .delete()
                .eq('id', discussionId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error deleting discussion:', error);
            throw error;
        }
    }
};

// Make the profile module globally available
window.UserProfile = UserProfile;
console.log('User profile module loaded');
