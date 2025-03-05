import { firebaseConfig } from './firebaseConfig.js';
import { loadDiscussions } from './discussionHandler.js';

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

document.getElementById('allDiscussionsBtn').addEventListener('click', () => {
    loadDiscussions('all');
});

document.getElementById('friendsDiscussionsBtn').addEventListener('click', () => {
    loadDiscussions('friends');
});

document.getElementById('darkModeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    document.querySelector('header').classList.toggle('dark-mode');
    document.querySelectorAll('button').forEach(button => {
        button.classList.toggle('dark-mode');
    });
});
