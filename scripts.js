import { createClient } from '@supabase/supabase-js';
import { loadDiscussions } from './discussionHandler.js';

// Supabase configuration
const supabaseUrl = 'https://eawoqpkwyunkmpyuijuq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhd29xcGt3eXVua21weXVpanVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDExNzM4MTYsImV4cCI6MjA1Njc0OTgxNn0.TCrAX91vjEwc_S7eYLE9RwzrNXSh1D_NKZ9XV6VfBRM';
const supabase = createClient(supabaseUrl, supabaseKey);

document.getElementById('allDiscussionsBtn').addEventListener('click', () => {
    loadDiscussions('all', supabase);
});

document.getElementById('friendsDiscussionsBtn').addEventListener('click', () => {
    loadDiscussions('friends', supabase);
});

document.getElementById('darkModeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    document.querySelector('header').classList.toggle('dark-mode');
    document.querySelectorAll('button').forEach(button => {
        button.classList.toggle('dark-mode');
    });
});
