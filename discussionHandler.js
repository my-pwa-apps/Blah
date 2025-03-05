export async function loadDiscussions(type, supabase) {
    let { data: discussions, error } = await supabase
        .from('discussions')
        .select('*');

    if (error) {
        console.error('Error fetching discussions:', error);
        return;
    }

    displayDiscussions(discussions, type);
}

function displayDiscussions(discussions, type) {
    const discussionsContainer = document.getElementById('discussions');
    discussionsContainer.innerHTML = '';
    discussions.forEach(discussion => {
        if (type === 'all' || (type === 'friends' && discussion.isFriend)) {
            const discussionElement = document.createElement('div');
            discussionElement.classList.add('discussion');
            discussionElement.innerHTML = `
                <h2>${discussion.title}</h2>
                <p>${discussion.content}</p>
            `;
            discussionsContainer.appendChild(discussionElement);
        }
    });
}
