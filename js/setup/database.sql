-- Run this in Supabase SQL Editor

-- Create tables
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    dark_mode BOOLEAN DEFAULT FALSE,
    email_notifications BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can delete their own profile"
    ON public.profiles FOR DELETE
    USING (auth.uid() = id);

-- User preferences policies
CREATE POLICY "Users can view own preferences"
    ON public.user_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
    ON public.user_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
    ON public.user_preferences FOR UPDATE
    USING (auth.uid() = user_id);

-- Discussion policies
CREATE POLICY "Discussions are viewable by everyone"
    ON public.discussions FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can create discussions"
    ON public.discussions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own discussions"
    ON public.discussions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own discussions"
    ON public.discussions FOR DELETE
    USING (auth.uid() = user_id);

-- Storage policies
INSERT INTO storage.policies (name, definition, bucket_id)
VALUES 
    ('Avatar Public Read Access',
     jsonb_build_object(
        'name', 'Avatar Public Read Access',
        'statement', 'SELECT',
        'effect', 'ALLOW',
        'actions', ARRAY['SELECT'],
        'principal', '*'
     ),
     'avatars'
    ) ON CONFLICT DO NOTHING;

INSERT INTO storage.policies (name, definition, bucket_id)
VALUES 
    ('Avatar Upload Access',
     jsonb_build_object(
        'name', 'Avatar Upload Access',
        'statement', 'INSERT',
        'effect', 'ALLOW',
        'actions', ARRAY['INSERT'],
        'principal', jsonb_build_object('id', 'authenticated'),
        'condition', 'bucket_id = ''avatars'' AND auth.uid()::text = (storage.foldername(name))[1]'
     ),
     'avatars'
    ) ON CONFLICT DO NOTHING;
