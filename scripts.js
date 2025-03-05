// Use Supabase from CDN instead of ES module import
// const { createClient } = supabase;

// Supabase configuration
const supabaseUrl = 'https://eawoqpkwyunkmpyuijuq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhd29xcGt3eXVua21weXVpanVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDExNzM4MTYsImV4cCI6MjA1Njc0OTgxNn0.TCrAX91vjEwc_S7eYLE9RwzrNXSh1D_NKZ9XV6VfBRM';

// Create a single Supabase client for the entire application
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Export for other modules to use
window.projectSupabase = supabase;

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded');
    
    // Load initial discussions
    loadDiscussions('all');
    
    // Set up event listeners
    setupEventListeners();
    
    console.log('Event listeners set up');
});

function setupEventListeners() {
    // Navigation buttons
    document.getElementById('allDiscussionsBtn').addEventListener('click', () => {
        loadDiscussions('all');
    });

    document.getElementById('friendsDiscussionsBtn').addEventListener('click', () => {
        loadDiscussions('friends');
    });

    // Dark mode toggle
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);
    
    // Modal functionality
    setupModalListeners();
    
    // Media preview functionality
    setupMediaPreview();
    
    // Form submission
    setupFormSubmission();
}

function toggleDarkMode() {
    const darkModeElements = [
        document.body, 
        document.querySelector('header'), 
        ...document.querySelectorAll('button')
    ];
    
    darkModeElements.forEach(element => element.classList.toggle('dark-mode'));
    
    // Store preference in local storage
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
}

function setupModalListeners() {
    const modal = document.getElementById('newDiscussionModal');
    const newDiscussionBtn = document.getElementById('newDiscussionBtn');
    const closeModalBtn = document.querySelector('.close-modal');
    
    console.log('Modal elements:', { modal, newDiscussionBtn, closeModalBtn });
    
    newDiscussionBtn.addEventListener('click', () => {
        console.log('New discussion button clicked');
        modal.style.display = 'block';
    });
    
    closeModalBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function setupMediaPreview() {
    const mediaInput = document.getElementById('discussionMedia');
    const mediaPreview = document.getElementById('mediaPreview');
    
    mediaInput.addEventListener('change', () => {
        const file = mediaInput.files[0];
        if (!file) {
            mediaPreview.innerHTML = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            mediaPreview.innerHTML = '';
            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = e.target.result;
                mediaPreview.appendChild(img);
            } else if (file.type.startsWith('video/')) {
                const video = document.createElement('video');
                video.src = e.target.result;
                video.controls = true;
                mediaPreview.appendChild(video);
            }
        };
        reader.readAsDataURL(file);
    });
}

function setupFormSubmission() {
    document.getElementById('newDiscussionForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const title = document.getElementById('discussionTitle').value;
        const content = document.getElementById('discussionContent').value;
        const mediaFile = document.getElementById('discussionMedia').files[0];
        
        // Show loading state
        const submitBtn = event.target.querySelector('.submit-btn');
        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = 'Posting...';
        submitBtn.disabled = true;
        
        try {
            // Use the global function from discussionHandler
            await window.discussionHandler.createNewDiscussion(title, content, mediaFile);
            
            // Reset form and close modal
            document.getElementById('newDiscussionForm').reset();
            document.getElementById('mediaPreview').innerHTML = '';
            document.getElementById('newDiscussionModal').style.display = 'none';
            
            // Reload discussions
            loadDiscussions('all');
        } catch (error) {
            console.error('Failed to create discussion:', error);
            alert('Failed to create discussion. Please try again.');
        } finally {
            // Restore button state
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
        }
    });
}

// Apply dark mode from saved preferences
if (localStorage.getItem('darkMode') === 'true') {
    document.addEventListener('DOMContentLoaded', () => {
        toggleDarkMode();
    });
}

// Simple function to load discussions directly
function loadDiscussions(type) {
    console.log(`Loading discussions: ${type}`);
    // Use the global function from discussionHandler
    window.discussionHandler.loadDiscussions(type);
}
