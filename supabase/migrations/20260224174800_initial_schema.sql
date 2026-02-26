-- TimeGlobe Database Schema Migration (Supabase)
-- Created by: Jihoon [gm] (2026-02-24)
-- Description: Core schema for Epochs, Events, Spatial Data, and Gamification.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==========================================
-- 1. Core Data: Eras & Events
-- ==========================================

-- 1-1. Eras table
CREATE TABLE IF NOT EXISTS public.eras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name JSONB NOT NULL, -- e.g., {"ko": "조선", "en": "Joseon"}
    start_year INTEGER NOT NULL,
    end_year INTEGER NOT NULL,
    description JSONB,
    bgm_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1-2. Events table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    era_id UUID REFERENCES public.eras(id) ON DELETE SET NULL,
    title JSONB NOT NULL,
    start_year INTEGER NOT NULL,
    end_year INTEGER,
    category TEXT NOT NULL,
    location_lat DOUBLE PRECISION NOT NULL,
    location_lng DOUBLE PRECISION NOT NULL,
    is_fog_region BOOLEAN DEFAULT FALSE,
    modern_country JSONB,
    image_url TEXT,
    summary JSONB,
    external_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1-3. EventRelations table (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.event_relations (
    source_event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    target_event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    PRIMARY KEY (source_event_id, target_event_id)
);

-- ==========================================
-- 2. Spatial Data
-- ==========================================

-- 2-1. Borders table (GeoJSON URLs via CDN for performance)
CREATE TABLE IF NOT EXISTS public.borders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    era_id UUID REFERENCES public.eras(id) ON DELETE CASCADE,
    name JSONB NOT NULL,
    geojson_url TEXT NOT NULL, -- Hosted externally to optimize DB load
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 3. Users & Gamification
-- ==========================================

-- 3-1. Users profile table (Maps 1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT,
    is_premium BOOLEAN DEFAULT FALSE,
    travel_tokens INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3-2. UserProgress table (Time Traveler Passport)
CREATE TABLE IF NOT EXISTS public.user_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    user_token INTEGER,
    user_level TEXT,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, event_id)
);

-- 3-3. Quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    question JSONB NOT NULL,
    options JSONB NOT NULL, -- e.g., {"ko": ["A", "B"], "en": ["A", "B"]}
    correct_option_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3-4. UserQuizResults table
CREATE TABLE IF NOT EXISTS public.user_quiz_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    is_correct BOOLEAN NOT NULL,
    solved_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- Required Indexing for Performance
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_events_start_year ON public.events(start_year);
CREATE INDEX IF NOT EXISTS idx_events_era_id ON public.events(era_id);
CREATE INDEX IF NOT EXISTS idx_borders_era_id ON public.borders(era_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON public.user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quiz_results_user_id ON public.user_quiz_results(user_id);
