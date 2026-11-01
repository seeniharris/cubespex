BEGIN;

-- =========================================================
-- 001_INIT.SQL — CUBESPEX DATABASE
-- Supabase / PostgreSQL
-- =========================================================


-- =========================================================
-- 1. PROFILES
-- =========================================================

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    display_name TEXT NOT NULL DEFAULT 'Cuber',
    username TEXT NOT NULL UNIQUE,
    friend_code TEXT NOT NULL UNIQUE,

    avatar_url TEXT,
    bio TEXT,

    privacy_settings JSONB NOT NULL DEFAULT
        '{"profile_public": true, "leaderboard_public": true}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT username_length
        CHECK (char_length(username) BETWEEN 3 AND 20),

    CONSTRAINT username_format
        CHECK (username ~ '^[a-zA-Z0-9_]+$'),

    CONSTRAINT friend_code_length
        CHECK (char_length(friend_code) BETWEEN 4 AND 20),

    CONSTRAINT display_name_length
        CHECK (char_length(trim(display_name)) BETWEEN 1 AND 40),

    CONSTRAINT bio_length
        CHECK (char_length(bio) <= 300)
);


-- =========================================================
-- 2. SESSIONS
-- =========================================================

CREATE TABLE public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE CASCADE,

    event TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Session',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT session_event_not_empty
        CHECK (char_length(trim(event)) > 0),

    CONSTRAINT session_name_length
        CHECK (char_length(name) BETWEEN 1 AND 60),

    UNIQUE (id, user_id)
);


-- =========================================================
-- 3. SOLVES
-- =========================================================

CREATE TABLE public.solves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE CASCADE,

    session_id UUID,

    event TEXT NOT NULL,
    scramble TEXT,

    raw_time DOUBLE PRECISION NOT NULL,

    penalty TEXT NOT NULL DEFAULT 'none',
    final_result TEXT,
    status TEXT NOT NULL DEFAULT 'ok',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT solve_time_positive
        CHECK (raw_time > 0 AND raw_time < 86400),

    CONSTRAINT solve_penalty_valid
        CHECK (penalty IN ('none', '+2', 'DNF')),

    CONSTRAINT solve_status_valid
        CHECK (status IN ('ok', 'DNF')),

    CONSTRAINT solve_event_not_empty
        CHECK (char_length(trim(event)) > 0),

    CONSTRAINT solve_session_owner
        FOREIGN KEY (session_id, user_id)
        REFERENCES public.sessions(id, user_id)
        ON DELETE SET NULL (session_id)
);


-- =========================================================
-- 4. FRIEND REQUESTS
-- =========================================================

CREATE TABLE public.friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    sender_id UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE CASCADE,

    receiver_id UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE CASCADE,

    status TEXT NOT NULL DEFAULT 'pending',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT friend_request_status_valid
        CHECK (status IN ('pending', 'accepted', 'rejected')),

    CONSTRAINT no_self_friend_request
        CHECK (sender_id <> receiver_id),

    UNIQUE (sender_id, receiver_id)
);


-- =========================================================
-- 5. FRIENDSHIPS
-- =========================================================

CREATE TABLE public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE CASCADE,

    friend_id UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT no_self_friendship
        CHECK (user_id <> friend_id),

    UNIQUE (user_id, friend_id)
);


-- =========================================================
-- 6. BLOCKED USERS
-- =========================================================

CREATE TABLE public.blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    blocker_id UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE CASCADE,

    blocked_id UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT no_self_block
        CHECK (blocker_id <> blocked_id),

    UNIQUE (blocker_id, blocked_id)
);


-- =========================================================
-- 7. USER SETTINGS
-- =========================================================

CREATE TABLE public.user_settings (
    user_id UUID PRIMARY KEY
        REFERENCES public.profiles(id) ON DELETE CASCADE,

    timer_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    appearance_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    privacy_settings JSONB NOT NULL DEFAULT '{}'::jsonb,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 8. ACTIVITY
-- =========================================================

CREATE TABLE public.activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE CASCADE,

    activity_date DATE NOT NULL DEFAULT CURRENT_DATE,

    valid_solve_count INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT activity_count_nonnegative
        CHECK (valid_solve_count >= 0),

    UNIQUE (user_id, activity_date)
);


-- =========================================================
-- 9. INDEXES
-- =========================================================

CREATE INDEX idx_solves_user_event
    ON public.solves(user_id, event, created_at DESC);

CREATE INDEX idx_solves_session
    ON public.solves(session_id);

CREATE INDEX idx_sessions_user_event
    ON public.sessions(user_id, event);

CREATE INDEX idx_friend_requests_receiver
    ON public.friend_requests(receiver_id, status);

CREATE INDEX idx_friend_requests_sender
    ON public.friend_requests(sender_id, status);

CREATE INDEX idx_friendships_user
    ON public.friendships(user_id);

CREATE INDEX idx_friendships_friend
    ON public.friendships(friend_id);

CREATE INDEX idx_blocked_users_blocker
    ON public.blocked_users(blocker_id);

CREATE INDEX idx_activity_user_date
    ON public.activity(user_id, activity_date DESC);

CREATE UNIQUE INDEX idx_profiles_username_lower
    ON public.profiles(lower(username));


-- =========================================================
-- 10. UPDATED_AT TRIGGER
-- =========================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_sessions_updated_at
BEFORE UPDATE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_solves_updated_at
BEFORE UPDATE ON public.solves
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =========================================================
-- 11. AUTOMATIC PROFILE CREATION
-- =========================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    generated_username TEXT;
    generated_friend_code TEXT;
    generated_display_name TEXT;
BEGIN
    generated_username :=
        'user_' || replace(NEW.id::text, '-', '')::text;

    generated_friend_code :=
        'CS' || upper(substr(replace(NEW.id::text, '-', ''), 1, 10));

    generated_display_name :=
        COALESCE(
            NULLIF(trim(NEW.raw_user_meta_data ->> 'display_name'), ''),
            'Cuber'
        );

    INSERT INTO public.profiles (
        id,
        display_name,
        username,
        friend_code
    )
    VALUES (
        NEW.id,
        generated_display_name,
        generated_username,
        generated_friend_code
    );

    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id);

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();


-- =========================================================
-- 12. FRIEND REQUEST ACCEPTANCE
-- =========================================================

CREATE OR REPLACE FUNCTION public.accept_friend_request(
    request_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    request_row public.friend_requests%ROWTYPE;
    current_user UUID;
BEGIN
    current_user := auth.uid();

    IF current_user IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT *
    INTO request_row
    FROM public.friend_requests
    WHERE id = request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Friend request not found';
    END IF;

    IF request_row.receiver_id <> current_user THEN
        RAISE EXCEPTION 'Only the receiver can accept this request';
    END IF;

    IF request_row.status <> 'pending' THEN
        RAISE EXCEPTION 'Request is not pending';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.blocked_users
        WHERE (blocker_id = current_user
               AND blocked_id = request_row.sender_id)
           OR (blocker_id = request_row.sender_id
               AND blocked_id = current_user)
    ) THEN
        RAISE EXCEPTION 'Friendship cannot be created';
    END IF;

    UPDATE public.friend_requests
    SET status = 'accepted'
    WHERE id = request_id;

    INSERT INTO public.friendships (user_id, friend_id)
    VALUES
        (current_user, request_row.sender_id),
        (request_row.sender_id, current_user)
    ON CONFLICT (user_id, friend_id) DO NOTHING;

    RETURN TRUE;
END;
$$;


-- =========================================================
-- 13. PUBLIC PROFILE LOOKUP
-- Returns only selected public profile fields.
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_public_profile(
    target_username TEXT
)
RETURNS TABLE (
    display_name TEXT,
    username TEXT,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        p.display_name,
        p.username,
        p.avatar_url,
        p.bio,
        p.created_at
    FROM public.profiles AS p
    WHERE lower(p.username) = lower(target_username)
      AND p.privacy_settings -> 'profile_public' = 'true'::jsonb;
$$;


-- =========================================================
-- 14. GLOBAL LEADERBOARD
-- Best raw solve time per user and event.
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_leaderboard(
    target_event TEXT,
    result_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    username TEXT,
    display_name TEXT,
    avatar_url TEXT,
    best_time DOUBLE PRECISION,
    solve_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        p.username,
        p.display_name,
        p.avatar_url,
        MIN(s.raw_time) AS best_time,
        COUNT(*) AS solve_count
    FROM public.profiles AS p
    JOIN public.solves AS s
      ON s.user_id = p.id
    WHERE s.event = target_event
      AND s.status = 'ok'
      AND s.penalty = 'none'
      AND p.privacy_settings -> 'leaderboard_public' = 'true'::jsonb
    GROUP BY p.id, p.username, p.display_name, p.avatar_url
    ORDER BY MIN(s.raw_time) ASC
    LIMIT GREATEST(1, LEAST(COALESCE(result_limit, 50), 100));
$$;


-- =========================================================
-- 15. ENABLE ROW LEVEL SECURITY
-- =========================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;


-- =========================================================
-- 16. PROFILE POLICIES
-- Direct table access is owner-only.
-- Public profiles are accessed through the safe RPC.
-- =========================================================

CREATE POLICY profiles_select_own
ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY profiles_update_own
ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);


-- =========================================================
-- 17. SESSION POLICIES
-- =========================================================

CREATE POLICY sessions_select_own
ON public.sessions
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY sessions_insert_own
ON public.sessions
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY sessions_update_own
ON public.sessions
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY sessions_delete_own
ON public.sessions
FOR DELETE TO authenticated
USING (auth.uid() = user_id);


-- =========================================================
-- 18. SOLVE POLICIES
-- =========================================================

CREATE POLICY solves_select_own
ON public.solves
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY solves_insert_own
ON public.solves
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY solves_update_own
ON public.solves
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY solves_delete_own
ON public.solves
FOR DELETE TO authenticated
USING (auth.uid() = user_id);


-- =========================================================
-- 19. FRIEND REQUEST POLICIES
-- =========================================================

CREATE POLICY friend_requests_select_participant
ON public.friend_requests
FOR SELECT TO authenticated
USING (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
);

CREATE POLICY friend_requests_insert_sender
ON public.friend_requests
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = sender_id
    AND sender_id <> receiver_id
    AND NOT EXISTS (
        SELECT 1
        FROM public.blocked_users b
        WHERE (b.blocker_id = sender_id AND b.blocked_id = receiver_id)
           OR (b.blocker_id = receiver_id AND b.blocked_id = sender_id)
    )
);

CREATE POLICY friend_requests_update_receiver
ON public.friend_requests
FOR UPDATE TO authenticated
USING (
    auth.uid() = receiver_id
    AND status = 'pending'
)
WITH CHECK (
    auth.uid() = receiver_id
    AND status IN ('accepted', 'rejected')
);


-- =========================================================
-- 20. FRIENDSHIP POLICIES
-- Clients cannot directly create friendships.
-- Use accept_friend_request() instead.
-- =========================================================

CREATE POLICY friendships_select_own
ON public.friendships
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY friendships_delete_own
ON public.friendships
FOR DELETE TO authenticated
USING (auth.uid() = user_id);


-- =========================================================
-- 21. BLOCKED USERS POLICIES
-- =========================================================

CREATE POLICY blocked_users_select_own
ON public.blocked_users
FOR SELECT TO authenticated
USING (auth.uid() = blocker_id);

CREATE POLICY blocked_users_insert_own
ON public.blocked_users
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = blocker_id
    AND blocker_id <> blocked_id
);

CREATE POLICY blocked_users_delete_own
ON public.blocked_users
FOR DELETE TO authenticated
USING (auth.uid() = blocker_id);


-- =========================================================
-- 22. USER SETTINGS POLICIES
-- =========================================================

CREATE POLICY user_settings_select_own
ON public.user_settings
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY user_settings_insert_own
ON public.user_settings
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_settings_update_own
ON public.user_settings
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- =========================================================
-- 23. ACTIVITY POLICIES
-- =========================================================

CREATE POLICY activity_select_own
ON public.activity
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY activity_insert_own
ON public.activity
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY activity_update_own
ON public.activity
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- =========================================================
-- 24. FUNCTION PERMISSIONS
-- =========================================================

REVOKE ALL ON FUNCTION public.accept_friend_request(UUID)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.accept_friend_request(UUID)
TO authenticated;

REVOKE ALL ON FUNCTION public.get_public_profile(TEXT)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_public_profile(TEXT)
TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_leaderboard(TEXT, INTEGER)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(TEXT, INTEGER)
TO anon, authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.set_updated_at()
FROM PUBLIC, anon, authenticated;


-- =========================================================
-- 25. TABLE PERMISSIONS
-- =========================================================

GRANT SELECT, INSERT, DELETE
ON public.sessions, public.solves, public.activity
TO authenticated;

GRANT UPDATE
ON public.sessions, public.solves
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.friend_requests
TO authenticated;

GRANT UPDATE (status)
ON public.friend_requests
TO authenticated;

GRANT SELECT, DELETE
ON public.friendships
TO authenticated;

GRANT SELECT, INSERT, DELETE
ON public.blocked_users
TO authenticated;

GRANT SELECT, INSERT, UPDATE
ON public.user_settings
TO authenticated;

GRANT SELECT
ON public.profiles
TO authenticated;

GRANT UPDATE (
    display_name,
    username,
    avatar_url,
    bio,
    privacy_settings
)
ON public.profiles
TO authenticated;


COMMIT;
