-- JANE+ Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/hnyzzvqogrgsadxjyexd/sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- User Profiles Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    birth_date DATE,
    canton TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles
CREATE POLICY "Users can view their own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
    ON public.user_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = user_id);

-- Admin can view all profiles (for admin dashboard)
CREATE POLICY "Admins can view all profiles"
    ON public.user_profiles FOR SELECT
    USING (true);

-- =====================================================
-- LAMal Policies Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.lamal_policies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    assureur TEXT,
    produit TEXT,
    franchise INTEGER,
    modele TEXT,
    prime_mensuelle DECIMAL(10,2),
    region TEXT,
    insurer_name TEXT,
    model TEXT,
    monthly_premium DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on lamal_policies
ALTER TABLE public.lamal_policies ENABLE ROW LEVEL SECURITY;

-- Policies for lamal_policies
CREATE POLICY "Users can view their own policy"
    ON public.lamal_policies FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own policy"
    ON public.lamal_policies FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own policy"
    ON public.lamal_policies FOR UPDATE
    USING (auth.uid() = user_id);

-- Admin can view all policies (for admin dashboard)
CREATE POLICY "Admins can view all policies"
    ON public.lamal_policies FOR SELECT
    USING (true);

-- =====================================================
-- Indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON public.user_profiles(created_at);
CREATE INDEX IF NOT EXISTS idx_lamal_policies_user_id ON public.lamal_policies(user_id);
CREATE INDEX IF NOT EXISTS idx_lamal_policies_created_at ON public.lamal_policies(created_at);

-- =====================================================
-- Function to auto-update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER on_user_profiles_updated
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_lamal_policies_updated
    BEFORE UPDATE ON public.lamal_policies
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
