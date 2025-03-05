/**
 * User authentication module
 * Handles user registration, login, and session management
 */

const UserAuth = {
    /**
     * Register a new user
     * @param {string} email - User email
     * @param {string} password - User password
     * @param {string} username - Username for profile
     * @param {string} displayName - Display name (optional)
     * @returns {Promise<Object>} - Registration result
     */
    async register(email, password, username, displayName = null) {
        try {
            // Check if database is ready
            await window.dbSetup.checkDatabaseExists();
            
            // Register user with Supabase Auth
            const { data: authData, error: authError } = await window.projectSupabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username,
                        display_name: displayName || username
                    }
                }
            });
            
            if (authError) throw authError;
            
            // If registration successful, create user profile
            if (authData.user) {
                try {
                    // Create user profile
                    const { error: profileError } = await window.projectSupabase
                        .from('profiles')
                        .insert({
                            id: authData.user.id,
                            username,
                            display_name: displayName || username,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });
                    
                    if (profileError) {
                        console.error('Error creating user profile:', profileError);
                        throw new Error('Failed to create user profile. Please try again.');
                    }
                    
                    // Create default user preferences
                    const { error: prefError } = await window.projectSupabase
                        .from('user_preferences')
                        .insert({
                            user_id: authData.user.id,
                            dark_mode: false,
                            email_notifications: true
                        });
                    
                    if (prefError) {
                        console.error('Error creating user preferences:', prefError);
                        throw new Error('Failed to create user preferences. Please try again.');
                    }
                    
                    return { user: authData.user, profile: { username, display_name: displayName || username }};
                } catch (error) {
                    // Try to delete the auth user if profile creation fails
                    try {
                        await window.projectSupabase.auth.api.deleteUser(authData.user.id);
                    } catch (deleteError) {
                        console.error('Failed to cleanup auth user:', deleteError);
                    }
                    throw error;
                }
            }
            
            throw new Error('Registration failed. Please try again.');
        } catch (error) {
            console.error('Registration error:', error);
            throw error.message || 'Registration failed. Please try again.';
        }
    },
    
    /**
     * Login a user
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} - Login result
     */
    async login(email, password) {
        try {
            const { data, error } = await window.projectSupabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            // Fetch user profile data
            if (data.user) {
                const profile = await this.getUserProfile(data.user.id);
                return { user: data.user, profile };
            }
            
            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },
    
    /**
     * Logout the current user
     * @returns {Promise<void>}
     */
    async logout() {
        try {
            const { error } = await window.projectSupabase.auth.signOut();
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    },
    
    /**
     * Get current session and user
     * @returns {Promise<Object>} - Current session and user
     */
    async getCurrentSession() {
        try {
            const { data, error } = await window.projectSupabase.auth.getSession();
            if (error) throw error;
            
            // If we have a session, also fetch user profile
            if (data.session) {
                const profile = await this.getUserProfile(data.session.user.id);
                return { session: data.session, user: data.session.user, profile };
            }
            
            return { session: null, user: null, profile: null };
        } catch (error) {
            console.error('Get session error:', error);
            return { session: null, user: null, profile: null };
        }
    },
    
    /**
     * Get user profile
     * @param {string} userId - User ID
     * @returns {Promise<Object>} - User profile
     */
    async getUserProfile(userId) {
        try {
            // Get profile data
            const { data: profile, error: profileError } = await window.projectSupabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
                
            if (profileError) throw profileError;
            
            // Get user preferences
            const { data: preferences, error: prefError } = await window.projectSupabase
                .from('user_preferences')
                .select('*')
                .eq('user_id', userId)
                .single();
                
            if (prefError && prefError.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is fine
                throw prefError;
            }
            
            return { 
                ...profile, 
                preferences: preferences || { dark_mode: false, email_notifications: true }
            };
        } catch (error) {
            console.error('Error fetching user profile:', error);
            throw error;
        }
    },
    
    /**
     * Update user profile
     * @param {Object} profileData - Profile data to update
     * @returns {Promise<Object>} - Updated profile
     */
    async updateProfile(profileData) {
        try {
            const { data: session } = await window.projectSupabase.auth.getSession();
            if (!session.session) throw new Error('No active session');
            
            const userId = session.session.user.id;
            
            // Separate preferences from profile data
            const { dark_mode, email_notifications, ...profileFields } = profileData;
            
            // Update profile
            if (Object.keys(profileFields).length > 0) {
                const { error: profileError } = await window.projectSupabase
                    .from('profiles')
                    .update({
                        ...profileFields,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', userId);
                    
                if (profileError) throw profileError;
            }
            
            // Update preferences if included
            if (dark_mode !== undefined || email_notifications !== undefined) {
                const preferenceUpdates = {};
                if (dark_mode !== undefined) preferenceUpdates.dark_mode = dark_mode;
                if (email_notifications !== undefined) preferenceUpdates.email_notifications = email_notifications;
                
                const { error: prefError } = await window.projectSupabase
                    .from('user_preferences')
                    .update({
                        ...preferenceUpdates,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', userId);
                    
                if (prefError) throw prefError;
            }
            
            // Return updated profile
            return await this.getUserProfile(userId);
        } catch (error) {
            console.error('Profile update error:', error);
            throw error;
        }
    },
    
    /**
     * Upload avatar for current user
     * @param {File} file - Image file for avatar
     * @returns {Promise<string>} - URL of uploaded avatar
     */
    async uploadAvatar(file) {
        try {
            const { data: session } = await window.projectSupabase.auth.getSession();
            if (!session.session) throw new Error('No active session');
            
            const userId = session.session.user.id;
            const filePath = `${userId}/${Date.now()}_${file.name}`;
            
            // Upload file
            const { data: uploadData, error: uploadError } = await window.projectSupabase.storage
                .from('avatars')
                .upload(filePath, file);
                
            if (uploadError) throw uploadError;
            
            // Get public URL
            const { data: urlData } = window.projectSupabase.storage
                .from('avatars')
                .getPublicUrl(uploadData.path);
                
            const avatarUrl = urlData.publicUrl;
            
            // Update profile with new avatar URL
            await this.updateProfile({ avatar_url: avatarUrl });
            
            return avatarUrl;
        } catch (error) {
            console.error('Avatar upload error:', error);
            throw error;
        }
    },
    
    /**
     * Add a friend connection
     * @param {string} friendUsername - Username of the friend to add
     * @returns {Promise<Object>} - Friendship result
     */
    async addFriend(friendUsername) {
        try {
            const { data: session } = await window.projectSupabase.auth.getSession();
            if (!session.session) throw new Error('No active session');
            
            const userId = session.session.user.id;
            
            // Get friend's user ID from username
            const { data: friendData, error: friendError } = await window.projectSupabase
                .from('profiles')
                .select('id')
                .eq('username', friendUsername)
                .single();
                
            if (friendError) throw friendError;
            
            // Create friendship request
            const { data, error } = await window.projectSupabase
                .from('friendships')
                .insert({
                    user_id: userId,
                    friend_id: friendData.id,
                    status: 'pending'
                })
                .select();
                
            if (error) throw error;
            
            return data[0];
        } catch (error) {
            console.error('Add friend error:', error);
            throw error;
        }
    },

    /**
     * Show the auth modal for login/register
     */
    showAuthModal() {
        const modal = document.getElementById('authModal') || this.createAuthModal();
        modal.style.display = 'block';
        this.setupAuthModalEvents(modal);
    },

    /**
     * Create the auth modal if it doesn't exist
     */
    createAuthModal() {
        const modal = document.createElement('div');
        modal.id = 'authModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <div class="auth-container">
                    <div class="auth-tabs">
                        <button id="loginTabBtn" class="auth-tab active">Login</button>
                        <button id="registerTabBtn" class="auth-tab">Register</button>
                    </div>

                    <form id="loginForm" class="auth-form">
                        <div class="form-group">
                            <label for="loginEmail">Email</label>
                            <input type="email" id="loginEmail" required>
                        </div>
                        <div class="form-group">
                            <label for="loginPassword">Password</label>
                            <input type="password" id="loginPassword" required>
                        </div>
                        <div id="loginError" class="error-message"></div>
                        <button type="submit" class="submit-btn">Login</button>
                    </form>
                    
                    <form id="registerForm" class="auth-form" style="display: none;">
                        <div class="form-group">
                            <label for="registerEmail">Email</label>
                            <input type="email" id="registerEmail" required>
                        </div>
                        <div class="form-group">
                            <label for="registerUsername">Username</label>
                            <input type="text" id="registerUsername" required>
                        </div>
                        <div class="form-group">
                            <label for="registerDisplayName">Display Name (optional)</label>
                            <input type="text" id="registerDisplayName">
                        </div>
                        <div class="form-group">
                            <label for="registerPassword">Password</label>
                            <input type="password" id="registerPassword" required minlength="6">
                        </div>
                        <div class="form-group">
                            <label for="registerPasswordConfirm">Confirm Password</label>
                            <input type="password" id="registerPasswordConfirm" required minlength="6">
                        </div>
                        <div id="registerError" class="error-message"></div>
                        <button type="submit" class="submit-btn">Register</button>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        return modal;
    },

    /**
     * Setup event handlers for the auth modal
     */
    setupAuthModalEvents(modal) {
        const closeBtn = modal.querySelector('.close-modal');
        const loginTab = modal.querySelector('#loginTabBtn');
        const registerTab = modal.querySelector('#registerTabBtn');
        const loginForm = modal.querySelector('#loginForm');
        const registerForm = modal.querySelector('#registerForm');
        
        // Close button
        closeBtn.onclick = () => modal.style.display = 'none';
        
        // Close on outside click
        window.onclick = (event) => {
            if (event.target === modal) modal.style.display = 'none';
        };
        
        // Tab switching
        loginTab.onclick = () => {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
        };
        
        registerTab.onclick = () => {
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            registerForm.style.display = 'block';
            loginForm.style.display = 'none';
        };
        
        // Form submissions
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            try {
                await this.login(email, password);
                modal.style.display = 'none';
                loginForm.reset();
            } catch (error) {
                document.getElementById('loginError').textContent = error.message;
            }
        };
        
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('registerEmail').value;
            const username = document.getElementById('registerUsername').value;
            const displayName = document.getElementById('registerDisplayName').value;
            const password = document.getElementById('registerPassword').value;
            const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
            
            if (password !== passwordConfirm) {
                document.getElementById('registerError').textContent = 'Passwords do not match';
                return;
            }
            
            try {
                await this.register(email, password, username, displayName);
                modal.style.display = 'none';
                registerForm.reset();
            } catch (error) {
                document.getElementById('registerError').textContent = error.message;
            }
        };
    }
};

// Make it available globally
window.UserAuth = UserAuth;
console.log('User authentication module loaded');
