// Define functions in global scope
window.discussionHandler = {};

/**
 * Loads discussions based on the specified type
 * @param {string} type - 'all' or 'friends'
 */
window.discussionHandler.loadDiscussions = async function(type) {
    try {
        console.log('Loading discussions in handler');
        
        // Check if database exists first
        const { count, error: countError } = await window.projectSupabase
            .from('discussions')
            .select('*', { count: 'exact', head: true });
            
        if (countError) {
            if (countError.code === '42P01') {
                // Table doesn't exist, trigger setup
                await window.dbSetup.setupDatabase();
                return;
            } else {
                throw countError;
            }
        }
        
        // Fetch discussions (without trying to join replies - we'll handle that separately)
        let { data: discussions, error } = await window.projectSupabase
            .from('discussions')
            .select('*')
            .is('parent_id', null)
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        console.log('Discussions loaded:', discussions);
        
        // Fetch replies for all discussions
        if (discussions && discussions.length > 0) {
            // Get all discussion IDs
            const discussionIds = discussions.map(d => d.id);
            
            // Get replies for these discussions
            let { data: replies, error: repliesError } = await window.projectSupabase
                .from('discussions')
                .select('*')
                .in('parent_id', discussionIds);
                
            if (repliesError) {
                console.error('Error fetching replies:', repliesError);
            } else if (replies) {
                // Attach replies to their parent discussions
                discussions.forEach(discussion => {
                    discussion.replies = replies.filter(reply => reply.parent_id === discussion.id);
                });
            }
        }
        
        displayDiscussions(discussions || [], type);
    } catch (error) {
        console.error('Error fetching discussions:', error);
        
        // Special handling for missing table error
        if (error.code === '42P01') {
            await window.dbSetup.setupDatabase();
        } else {
            document.getElementById('discussions').innerHTML = 
                '<p class="error-message">Failed to load discussions. Please try again later.</p>';
        }
    }
};

/**
 * Displays discussions in the UI
 * @param {Array} discussions - The discussions to display
 * @param {string} type - 'all' or 'friends'
 */
function displayDiscussions(discussions, type) {
    const discussionsContainer = document.getElementById('discussions');
    discussionsContainer.innerHTML = '';
    
    if (!discussions || discussions.length === 0) {
        discussionsContainer.innerHTML = '<p>No discussions found. Be the first to start one!</p>';
        return;
    }
    
    discussions.forEach(discussion => {
        if (type === 'all' || (type === 'friends' && discussion.isFriend)) {
            const discussionElement = window.discussionHandler.renderDiscussion(discussion);
            discussionsContainer.appendChild(discussionElement);
        }
    });
    
    // Add event listeners to reply buttons
    document.querySelectorAll('.reply-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const discussionId = e.target.getAttribute('data-discussion-id');
            openReplyModal(discussionId);
        });
    });
}

/**
 * Creates HTML for media display
 * @param {string} mediaUrl - URL of the media
 * @param {string} mediaType - Type of the media
 * @returns {string} HTML string for media display
 */
function createMediaHtml(mediaUrl, mediaType) {
    if (!mediaUrl) return '';
    
    if (mediaType && mediaType.startsWith('image/')) {
        return `
            <div class="media-container">
                <img src="${mediaUrl}" alt="Discussion media">
            </div>
        `;
    } else if (mediaType && mediaType.startsWith('video/')) {
        return `
            <div class="media-container">
                <video controls>
                    <source src="${mediaUrl}" type="${mediaType}">
                    Your browser does not support video playback.
                </video>
            </div>
        `;
    }
    
    return '';
}

/**
 * Creates HTML for replies display
 * @param {Array} replies - Array of reply objects
 * @returns {string} HTML string for replies display
 */
function createRepliesHtml(replies, parentId = null, depth = 0) {
    if (!replies || replies.length === 0) return '';

    const repliesAtThisLevel = replies.filter(r => r.parent_id === parentId);
    if (repliesAtThisLevel.length === 0) return '';

    return `
        <div class="replies-container ${depth > 0 ? 'nested-replies' : ''}" data-depth="${depth}">
            <div class="replies-header">
                <h4>${repliesAtThisLevel.length} ${repliesAtThisLevel.length === 1 ? 'Reply' : 'Replies'}</h4>
                <button class="collapse-btn" aria-label="Toggle replies">
                    <span class="material-icons">expand_less</span>
                </button>
            </div>
            <div class="replies-content">
                ${repliesAtThisLevel.map(reply => `
                    <div class="reply" data-reply-id="${reply.id}">
                        <div class="reply-content">
                            <p>${escapeHtml(reply.content)}</p>
                            ${createMediaHtml(reply.media_url, reply.media_type)}
                        </div>
                        <div class="reply-actions">
                            <button class="reply-btn" data-parent-id="${reply.id}">
                                <span class="material-icons">reply</span> Reply
                            </button>
                            ${reply.user_id === window.projectSupabase.auth.user()?.id ? `
                                <button class="delete-btn" data-id="${reply.id}">
                                    <span class="material-icons">delete</span>
                                </button>
                            ` : ''}
                        </div>
                        ${createRepliesHtml(replies, reply.id, depth + 1)}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    if (!str) return '';
    
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Creates a new discussion
 * @param {string} title - Discussion title
 * @param {string} content - Discussion content
 * @param {File} mediaFile - Optional media file
 * @returns {Promise} Promise resolving when discussion is created
 */
window.discussionHandler.createNewDiscussion = async function(title, content, mediaFile) {
    console.log('Creating new discussion:', { title, content });
    try {
        let mediaUrl = null;
        let mediaType = null;
        
        // Upload media file if provided
        if (mediaFile) {
            const { data: uploadData, error: uploadError } = await window.projectSupabase.storage
                .from('discussion-media')
                .upload(`${Date.now()}_${mediaFile.name}`, mediaFile);
                
            if (uploadError) {
                throw uploadError;
            }
            
            // Get public URL for the uploaded file
            const { data: { publicUrl } } = window.projectSupabase.storage
                .from('discussion-media')
                .getPublicUrl(uploadData.path);
            
            mediaUrl = publicUrl;
            mediaType = mediaFile.type;
        }
        
        // Create new discussion entry
        const { data, error } = await window.projectSupabase
            .from('discussions')
            .insert([
                { 
                    title, 
                    content, 
                    media_url: mediaUrl,
                    media_type: mediaType,
                    created_at: new Date().toISOString(),
                    parent_id: null // This is a top-level discussion, not a reply
                }
            ])
            .select();
            
        if (error) {
            throw error;
        }
        
        return data[0];
    } catch (error) {
        console.error('Error creating discussion:', error);
        throw error;
    }
};

/**
 * Opens a modal for replying to a discussion
 * @param {string} parentId - ID of the parent discussion
 */
function openReplyModal(parentId) {
    console.log('Opening reply modal for discussion:', parentId);
    
    // First check if there's already a reply modal open
    const existingModal = document.getElementById('replyModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create a reply modal directly in the DOM
    const modal = document.createElement('div');
    modal.id = 'replyModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-reply-modal">&times;</span>
            <h3>Reply to Discussion</h3>
            <form id="replyForm" data-parent-id="${parentId}">
                <div class="form-group">
                    <label for="replyContent">Your Reply</label>
                    <textarea id="replyContent" rows="4" required></textarea>
                </div>
                <div class="form-group">
                    <label for="replyMedia">Add Media (optional)</label>
                    <input type="file" id="replyMedia" accept="image/*,video/*">
                    <div id="replyMediaPreview" class="media-preview"></div>
                </div>
                <button type="submit" class="submit-btn">Post Reply</button>
            </form>
        </div>
    `;
    
    // Append directly to body
    document.body.appendChild(modal);
    
    // Show modal
    modal.style.display = 'block';
    
    // Get other elements
    const closeModalBtn = modal.querySelector('.close-reply-modal');
    const mediaInput = modal.querySelector('#replyMedia');
    const mediaPreview = modal.querySelector('#replyMediaPreview');
    const replyForm = modal.querySelector('#replyForm');
    
    // Handle close button
    closeModalBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    // Handle clicking outside modal
    window.addEventListener('click', function modalOutsideClickHandler(event) {
        if (event.target === modal) {
            modal.remove();
            window.removeEventListener('click', modalOutsideClickHandler);
        }
    });
    
    // Handle media preview
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
    
    // Handle form submission
    replyForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const content = modal.querySelector('#replyContent').value;
        const mediaFile = modal.querySelector('#replyMedia').files[0];
        const parentId = event.target.getAttribute('data-parent-id');
        
        // Show loading state
        const submitBtn = event.target.querySelector('.submit-btn');
        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = 'Posting...';
        submitBtn.disabled = true;
        
        try {
            await addReplyToDiscussion(parentId, content, mediaFile);
            
            // Remove modal safely
            if (document.body.contains(modal)) {
                modal.remove();
            }
            
            // Reload discussions
            window.discussionHandler.loadDiscussions('all');
        } catch (error) {
            console.error('Failed to post reply:', error);
            alert('Failed to post reply. Please try again.');
        } finally {
            // If modal still exists, restore button state
            if (document.body.contains(modal)) {
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
            }
        }
    });
}

/**
 * Adds a reply to a discussion
 * @param {string} parentId - ID of the parent discussion
 * @param {string} content - Reply content
 * @param {File} mediaFile - Optional media file
 * @returns {Promise} Promise resolving when reply is added
 */
async function addReplyToDiscussion(parentId, content, mediaFile) {
    try {
        let mediaUrl = null;
        let mediaType = null;
        
        // Upload media file if provided
        if (mediaFile) {
            const { data: uploadData, error: uploadError } = await window.projectSupabase.storage
                .from('discussion-media')
                .upload(`replies/${Date.now()}_${mediaFile.name}`, mediaFile);
                
            if (uploadError) {
                throw uploadError;
            }
            
            // Get public URL for the uploaded file
            const { data: { publicUrl } } = window.projectSupabase.storage
                .from('discussion-media')
                .getPublicUrl(uploadData.path);
            
            mediaUrl = publicUrl;
            mediaType = mediaFile.type;
        }
        
        // Create new reply entry - Add a title field since it's required
        const { error } = await window.projectSupabase
            .from('discussions')
            .insert([
                { 
                    title: "Reply",   // Add this line to satisfy the NOT NULL constraint
                    content, 
                    media_url: mediaUrl,
                    media_type: mediaType,
                    created_at: new Date().toISOString(),
                    parent_id: parentId
                }
            ]);
            
        if (error) {
            throw error;
        }
    } catch (error) {
        console.error('Error adding reply:', error);
        throw error;
    }
}

window.discussionHandler.renderDiscussion = async function(discussion) {
    const { session } = await window.projectSupabase.auth.getSession();
    const isOwner = session?.user?.id === discussion.user_id;
    
    const discussionEl = document.createElement('div');
    discussionEl.className = 'discussion';
    discussionEl.innerHTML = `
        <div class="discussion-header">
            <h2>${escapeHtml(discussion.title)}</h2>
            ${isOwner ? `
                <button class="delete-btn" data-id="${discussion.id}">
                    <span class="material-icons">delete</span>
                </button>
            ` : ''}
        </div>
        <div class="discussion-content">
            ${escapeHtml(discussion.content)}
        </div>
        <!-- ...rest of discussion content... -->
    `;

    // Add delete handler if owner
    if (isOwner) {
        const deleteBtn = discussionEl.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to delete this discussion?')) {
                try {
                    await window.UserProfile.deleteDiscussion(discussion.id);
                    discussionEl.remove();
                } catch (error) {
                    alert('Failed to delete discussion');
                }
            }
        });
    }

    // Add event handlers for collapse buttons
    discussionEl.querySelectorAll('.collapse-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const container = btn.closest('.replies-container');
            const content = container.querySelector('.replies-content');
            const icon = btn.querySelector('.material-icons');
            
            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon.textContent = 'expand_less';
            } else {
                content.style.display = 'none';
                icon.textContent = 'expand_more';
            }
        });
    });

    // Add event handlers for reply buttons
    discussionEl.querySelectorAll('.reply-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const parentId = btn.getAttribute('data-parent-id');
            openReplyModal(parentId);
        });
    });

    return discussionEl;
};
