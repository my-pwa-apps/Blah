import { loadDiscussions } from './discussionHandler.js';

// Firebase configuration
var firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const db = firebase.database();

document.getElementById('allDiscussionsBtn').addEventListener('click', () => {
    loadDiscussions('all');
});

document.getElementById('friendsDiscussionsBtn').addEventListener('click', () => {
    loadDiscussions('friends');
});
