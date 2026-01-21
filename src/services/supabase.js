import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth helpers
export const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });
    if (error) throw error;
    return data;
};

export const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    if (error) throw error;
    return data;
};

export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
};

export const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
};

export const onAuthStateChange = (callback) => {
    return supabase.auth.onAuthStateChange(callback);
};

// Database helpers - LAMal policies
export const saveLamalPolicy = async (userId, policyData) => {
    const { data, error } = await supabase
        .from('lamal_policies')
        .upsert({
            user_id: userId,
            ...policyData,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    if (error) throw error;
    return data;
};

export const getLamalPolicy = async (userId) => {
    const { data, error } = await supabase
        .from('lamal_policies')
        .select('*')
        .eq('user_id', userId)
        .single();
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data;
};

// User profile
export const saveUserProfile = async (userId, profileData) => {
    const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
            user_id: userId,
            ...profileData,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    if (error) throw error;
    return data;
};

export const getUserProfile = async (userId) => {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
};
