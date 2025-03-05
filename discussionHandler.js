// Get Supabase client from global scope
const supabase = window.projectSupabase;

// Define functions in global scope
window.discussionHandler = {};

/**
 * Loads discussions based on the specified type
 * @param {string} type - 'all' or 'friends'
 */
window.discussionHandler.loadDiscussions = async function(type) {
    try {
        console.log('Loading discussions in handler');
        
        // Fetch discussions (without trying to join replies - we'll handle that separately)
        let { data: discussions, error } = await supabase
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
            let { data: replies, error: repliesError } = await supabase
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
        document.getElementById('discussions').innerHTML = 
            '<p class="error-message">Failed to load discussions. Please try again later.</p>';
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
            const discussionElement = document.createElement('div');
            discussionElement.classList.add('discussion');
            
            const mediaHtml = createMediaHtml(discussion.media_url, discussion.media_type);
            const repliesHtml = createRepliesHtml(discussion.replies);
            
            discussionElement.innerHTML = `
                <h2>${escapeHtml(discussion.title)}</h2>
                <div class="discussion-content">${escapeHtml(discussion.content)}</div>
                ${mediaHtml}
                ${repliesHtml}
                <button class="reply-btn" data-discussion-id="${discussion.id}">Reply</button>
            `;
            
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
function createRepliesHtml(replies) {
    if (!replies || replies.length === 0) return '';
    
    return `
        <div class="replies-container">
            <h4>${replies.length} ${replies.length === 1 ? 'Reply' : 'Replies'}</h4>
            ${replies.map(reply => `
                <div class="reply">
                    <p>${escapeHtml(reply.content)}</p>
                    ${createMediaHtml(reply.media_url, reply.media_type)}
                </div>
            `).join('')}
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
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('discussion-media')
                .upload(`${Date.now()}_${mediaFile.name}`, mediaFile);
                
            if (uploadError) {
                throw uploadError;
            }
            
            // Get public URL for the uploaded file
            const { data: { publicUrl } } = supabase.storage
                .from('discussion-media')
                .getPublicUrl(uploadData.path);
            
            mediaUrl = publicUrl;
            mediaType = mediaFile.type;
        }
        
        // Create new discussion entry
        const { data, error } = await supabase
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
    // Create a reply modal dynamically
    const modalHtml = `
        <div id="replyModal" class="modal">
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
        </div>
    `;
    
    // Append modal to body
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer.firstChild);
    
    // Get modal elements
    const modal = document.getElementById('replyModal');
    const closeModalBtn = document.querySelector('.close-reply-modal');
    const mediaInput = document.getElementById('replyMedia');
    const mediaPreview = document.getElementById('replyMediaPreview');
    
    // Show modal
    modal.style.display = 'block';
    
    // Handle close button
    closeModalBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    // Handle clicking outside modal
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.remove();
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
    document.getElementById('replyForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const content = document.getElementById('replyContent').value;
        const mediaFile = document.getElementById('replyMedia').files[0];
        const parentId = event.target.getAttribute('data-parent-id');
        
        // Show loading state
        const submitBtn = event.target.querySelector('.submit-btn');
        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = 'Posting...';
        submitBtn.disabled = true;
        
        try {
            await addReplyToDiscussion(parentId, content, mediaFile);
            
            // Remove modal
            modal.remove();
            
            // Reload discussions
            loadDiscussions('all');
        } catch (error) {
            console.error('Failed to post reply:', error);
            alert('Failed to post reply. Please try again.');
        } finally {
            // If modal still exists, restore button state
            if (document.getElementById('replyForm')) {
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
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('discussion-media')
                .upload(`replies/${Date.now()}_${mediaFile.name}`, mediaFile);
                
            if (uploadError) {
                throw uploadError;
            }
            
            // Get public URL for the uploaded file
            const { data: { publicUrl } } = supabase.storage
                .from('discussion-media')
                .getPublicUrl(uploadData.path);
            
            mediaUrl = publicUrl;
            mediaType = mediaFile.type;
        }
        
        // Create new reply entry
        const { error } = await supabase
            .from('discussions')
            .insert([
                { 
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
