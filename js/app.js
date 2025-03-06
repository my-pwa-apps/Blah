import { initAuth, getCurrentUser, onAuthStateChange } from './auth.js';
import { initDatabase, fetchUserProfile, createUserProfile } from './db.js';
import { initUI, showAuthScreen, showMainApp, renderConversationsList } from './ui.js';

// Initialize the application
async function initApp() {
    // Initialize Supabase clients
    initAuth();
    initDatabase();
    
    // Initialize UI components and event listeners
    initUI();
    
    // Listen for auth state changes
    onAuthStateChange(async (user) => {
        if (user) {
            // User is signed in
            console.log('User is signed in:', user.email);
            
            // Check if user profile exists, create if not
            let profile = await fetchUserProfile(user.id);
            if (!profile) {
                // Create default profile for new user
                profile = await createUserProfile({
                    id: user.id,
                    email: user.email,
                    display_name: user.email.split('@')[0],
                    avatar_url: null,
                    status: 'Available'
                });
            }
            
            // Show main app UI
            showMainApp(profile);
            
            // Load conversations
            renderConversationsList();
        } else {
            // User is signed out
            console.log('User is signed out');
            showAuthScreen();
        }
    });
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
