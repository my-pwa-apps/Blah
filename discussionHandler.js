import { firebaseConfig } from './firebaseConfig.js';

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const db = firebase.database();

export function loadDiscussions(type) {
    const discussionsRef = db.ref('discussions');
    discussionsRef.once('value', (snapshot) => {
        const discussions = snapshot.val();
        displayDiscussions(discussions, type);
    });
}

function displayDiscussions(discussions, type) {
    const discussionsContainer = document.getElementById('discussions');
    discussionsContainer.innerHTML = '';
    for (let id in discussions) {
        if (type === 'all' || (type === 'friends' && discussions[id].isFriend)) {
            const discussion = discussions[id];
            const discussionElement = document.createElement('div');
            discussionElement.classList.add('discussion');
            discussionElement.innerHTML = `
                <h2>${discussion.title}</h2>
                <p>${discussion.content}</p>
            `;
            discussionsContainer.appendChild(discussionElement);
        }
    }
}
