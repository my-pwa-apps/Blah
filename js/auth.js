import { SUPABASE_CONFIG } from '../config.js';

let supabase;

export function initAuth() {
    // Initialize Supabase client
    supabase = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
    console.log('Supabase Auth initialized');
}

export async function signUp(email, password) {
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error signing up:', error.message);
        throw error;
    }
}

export async function signIn(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error signing in:', error.message);
        throw error;
    }
}

export async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        
        if (error) throw error;
        
        return true;
    } catch (error) {
        console.error('Error signing out:', error.message);
        throw error;
    }
}

export function getCurrentUser() {
    return supabase.auth.getUser();
}

export function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            callback(session.user);
        } else if (event === 'SIGNED_OUT') {
            callback(null);
        }
    });
}
