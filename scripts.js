// Use the global Supabase client from the inline script

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM fully loaded');
    
    // Ensure dbSetup is available
    if (typeof window.dbSetup === 'undefined') {
        console.error('Database setup module not loaded!');
        document.getElementById('discussions').innerHTML = 
            '<p class="error-message">Failed to load application. Please refresh the page.</p>';
        return;
    }
    
    // Check if database exists before proceeding
    try {
        const dbExists = await window.dbSetup.checkDatabaseExists();
        
        if (dbExists) {
            // Load initial discussions
            loadDiscussions('all');
            
            // Set up event listeners
            setupEventListeners();
            
            console.log('Event listeners set up');
        } else {
            console.log('Database setup required');
            // The setup UI is already rendered by checkDatabaseExists
            
            // Disable the new discussion button until database is set up
            document.getElementById('newDiscussionBtn').disabled = true;
        }
    } catch (error) {
        console.error('Error during initialization:', error);
        document.getElementById('discussions').innerHTML = 
            '<p class="error-message">Failed to initialize application. Please refresh the page.</p>';
    }

    // Initialize user interface
    window.UserInterface.init();
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
