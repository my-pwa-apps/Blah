const UserInterface = {
    /**
     * Initialize the user interface components
     */
    init() {
        // Check required dependencies
        if (!window.UserAuth || !window.UserProfile) {
            console.error('Required modules not loaded: UserAuth or UserProfile missing');
            return;
        }

        // Set up profile icon click handler
        const profileIcon = document.getElementById('profileIcon');
        if (profileIcon) {
            profileIcon.addEventListener('click', () => this.handleProfileClick());
        }
        
        // Listen for auth state changes
        window.projectSupabase.auth.onAuthStateChange((event, session) => {
            this.updateUIForAuthState(event, session);
        });
        
        // Check initial auth state
        this.checkInitialAuthState();

        console.log('User interface initialized');
    },

    /**
     * Update UI elements based on authentication state
     */
    async updateUIForAuthState(event, session) {
        console.log('Auth state changed:', event);
        
        // Update profile icon
        this.updateProfileIcon(session !== null);
        
        // Handle specific events
        if (event === 'SIGNED_IN') {
            // Load user profile data
            await window.UserProfile.init();
            
            // Close any open auth modals
            this.closeAllModals();
            
            // Refresh discussions to show personalized content
            if (window.discussionHandler && window.discussionHandler.loadDiscussions) {
                window.discussionHandler.loadDiscussions('all');
            }
        } else if (event === 'SIGNED_OUT') {
            // Reset to default view
            if (window.discussionHandler && window.discussionHandler.loadDiscussions) {
                window.discussionHandler.loadDiscussions('all');
            }
        }
    },

    /**
     * Close all modal dialogs
     */
    closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
            // If it's a temporary modal, remove it
            if (!modal.id) {
                modal.remove();
            }
        });
    },

    /**
     * Show the authentication modal
     */
    showAuthModal() {
        if (!window.UserAuth) {
            console.error('UserAuth module not loaded');
            return;
        }
        window.UserAuth.showAuthModal();
    },

    /**
     * Show profile modal
     */
    async showProfileModal() {
        try {
            const { session, profile } = await window.UserAuth.getCurrentSession();
            if (!session) {
                this.showAuthModal();
                return;
            }

            // Create default profile data if none exists
            const defaultProfile = {
                display_name: session.user?.email?.split('@')[0] || 'User',
                avatar_url: null,
                bio: '',
                preferences: {
                    dark_mode: false,
                    email_notifications: true
                }
            };

            // Use existing profile data or default
            const userProfile = profile || defaultProfile;

            const modal = document.createElement('div');
            modal.id = 'profileModal';
            modal.className = 'modal';
            modal.style.display = 'block'; // Make sure modal is visible
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close-modal">&times;</span>
                    <h2>Profile Settings</h2>
                    <div class="profile-container">
                        <div class="avatar-section">
                            <div class="avatar-preview">
                                <img src="${userProfile.avatar_url || 'images/default-avatar.png'}" 
                                     alt="Profile Avatar" 
                                     onerror="this.src='images/default-avatar.png'">
                            </div>
                            <input type="file" id="avatarUpload" accept="image/*">
                            <button id="uploadAvatarBtn">Upload New Avatar</button>
                        </div>
                        <form id="profileForm" class="profile-form">
                            <div class="form-group">
                                <label for="displayName">Display Name</label>
                                <input type="text" id="displayName" value="${userProfile.display_name || ''}" required>
                            </div>
                            <div class="form-group">
                                <label for="bio">Bio</label>
                                <textarea id="bio" rows="3">${userProfile.bio || ''}</textarea>
                            </div>
                            <div class="form-group preferences">
                                <label>
                                    <input type="checkbox" id="darkMode" ${userProfile.preferences?.dark_mode ? 'checked' : ''}>
                                    Dark Mode
                                </label>
                                <label>
                                    <input type="checkbox" id="emailNotifications" ${userProfile.preferences?.email_notifications ? 'checked' : ''}>
                                    Email Notifications
                                </label>
                            </div>
                            <div id="profileError" class="error-message"></div>
                            <button type="submit" class="submit-btn">Save Changes</button>
                        </form>
                    </div>
                    <div class="friends-section">
                        <h3>Friends</h3>
                        <div class="invite-friend">
                            <input type="text" id="friendEmail" placeholder="Friend's email">
                            <button id="inviteFriendBtn" class="submit-btn">Invite Friend</button>
                        </div>
                        <div id="friendsList" class="friends-list">
                            <div class="loading">Loading friends...</div>
                        </div>
                    </div>
                    <div class="profile-actions">
                        <button id="logoutBtn" class="danger-btn">Logout</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            this.setupProfileModalEvents(modal, userProfile);
            this.loadFriendsList();
        } catch (error) {
            console.error('Error showing profile modal:', error);
            // Show error message to user
            const errorMsg = document.createElement('div');
            errorMsg.className = 'error-message';
            errorMsg.style.padding = '1rem';
            errorMsg.textContent = 'Failed to load profile. Please try again.';
            document.body.appendChild(errorMsg);
            setTimeout(() => errorMsg.remove(), 3000);
        }
    },

    /**
     * Setup profile modal events
     */
    setupProfileModalEvents(modal, profile) {
        const closeBtn = modal.querySelector('.close-modal');
        const avatarInput = modal.querySelector('#avatarUpload');
        const uploadBtn = modal.querySelector('#uploadAvatarBtn');
        const profileForm = modal.querySelector('#profileForm');
        const logoutBtn = modal.querySelector('#logoutBtn');

        // Close button
        closeBtn.onclick = () => {
            modal.remove();
        };

        // Close on outside click
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.remove();
            }
        };

        // Avatar upload
        uploadBtn.onclick = () => avatarInput.click();
        avatarInput.onchange = async () => {
            const file = avatarInput.files[0];
            if (file) {
                try {
                    uploadBtn.disabled = true;
                    uploadBtn.textContent = 'Uploading...';
                    const avatarUrl = await window.UserAuth.uploadAvatar(file);
                    modal.querySelector('.avatar-preview img').src = avatarUrl;
                } catch (error) {
                    console.error('Avatar upload failed:', error);
                } finally {
                    uploadBtn.disabled = false;
                    uploadBtn.textContent = 'Upload New Avatar';
                }
            }
        };

        // Profile form submission
        profileForm.onsubmit = async (e) => {
            e.preventDefault();
            const submitBtn = profileForm.querySelector('.submit-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';

            try {
                const updates = {
                    display_name: profileForm.querySelector('#displayName').value,
                    bio: profileForm.querySelector('#bio').value,
                    dark_mode: profileForm.querySelector('#darkMode').checked,
                    email_notifications: profileForm.querySelector('#emailNotifications').checked
                };

                await window.UserAuth.updateProfile(updates);
                modal.remove();
                // Refresh UI with new preferences
                await window.UserProfile.init();
            } catch (error) {
                const errorDiv = profileForm.querySelector('#profileError');
                errorDiv.textContent = error.message;
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save Changes';
            }
        };

        // Logout
        logoutBtn.onclick = async () => {
            try {
                await window.UserAuth.logout();
                modal.remove();
                window.location.reload(); // Refresh page to reset state
            } catch (error) {
                console.error('Logout failed:', error);
            }
        };

        // Add friend invitation handler
        const inviteFriendBtn = modal.querySelector('#inviteFriendBtn');
        const friendEmailInput = modal.querySelector('#friendEmail');

        inviteFriendBtn.onclick = async () => {
            const email = friendEmailInput.value.trim();
            if (!email) {
                alert('Please enter a friend\'s email');
                return;
            }

            try {
                inviteFriendBtn.disabled = true;
                inviteFriendBtn.textContent = 'Sending...';
                
                await window.UserAuth.inviteFriend(email);
                
                friendEmailInput.value = '';
                alert('Invitation sent successfully!');
            } catch (error) {
                alert(error.message || 'Failed to send invitation');
            } finally {
                inviteFriendBtn.disabled = false;
                inviteFriendBtn.textContent = 'Invite Friend';
            }
        };
    },

    async loadFriendsList() {
        const friendsList = document.querySelector('#friendsList');
        if (!friendsList) return;

        try {
            const friends = await window.UserAuth.getFriends();
            
            if (!friends || friends.length === 0) {
                friendsList.innerHTML = '<div class="no-friends">No friends yet</div>';
                return;
            }

            friendsList.innerHTML = friends.map(friend => `
                <div class="friend-item">
                    <img src="${friend.avatar_url || 'images/default-avatar.png'}" 
                         alt="${friend.display_name}" 
                         class="friend-avatar"
                         onerror="this.src='images/default-avatar.png'">
                    <span class="friend-name">${friend.display_name}</span>
                </div>
            `).join('');
        } catch (error) {
            friendsList.innerHTML = '<div class="error">Failed to load friends</div>';
        }
    },

    /**
     * Check initial authentication state and update UI
     */
    async checkInitialAuthState() {
        const { session, user } = await window.projectSupabase.auth.getSession();
        this.updateProfileIcon(session !== null);
    },

    /**
     * Update the profile icon appearance based on auth state
     */
    async updateProfileIcon(isLoggedIn) {
        const profileIcon = document.getElementById('profileIcon');
        if (!profileIcon) return;
        
        if (isLoggedIn) {
            try {
                // Get user profile to use avatar if available
                const { profile } = await window.UserAuth.getCurrentSession();
                
                // Add logged-in class first
                profileIcon.classList.add('logged-in');
                
                if (profile && profile.avatar_url) {
                    // Replace icon with avatar image
                    profileIcon.innerHTML = '';
                    profileIcon.classList.remove('material-icons');
                    
                    const avatar = document.createElement('img');
                    avatar.src = profile.avatar_url;
                    avatar.alt = 'Profile Avatar';
                    avatar.className = 'avatar-image';
                    avatar.onerror = () => {
                        profileIcon.innerHTML = 'account_circle';
                        profileIcon.classList.add('material-icons');
                    };
                    
                    profileIcon.appendChild(avatar);
                } else {
                    // Use a different icon for logged in state
                    profileIcon.innerHTML = 'account_circle';
                    profileIcon.classList.add('material-icons');
                }
            } catch (error) {
                console.error('Error updating profile icon:', error);
                profileIcon.innerHTML = 'account_circle';
                profileIcon.classList.add('material-icons');
            }
        } else {
            // Default icon for logged out state
            profileIcon.innerHTML = 'account_circle';
            profileIcon.classList.add('material-icons');
            profileIcon.classList.remove('logged-in');
        }
    },

    handleProfileClick() {
        this.showProfileModal();
    }
};

// Make it available globally
window.UserInterface = UserInterface;
console.log('User interface module loaded');