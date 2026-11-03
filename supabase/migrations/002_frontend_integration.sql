-- Additive integration migration for the existing CubeSpex schema. RLS stays enabled.
BEGIN;

-- Local identifiers make retries and guest-to-account imports idempotent.
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE public.solves ADD COLUMN IF NOT EXISTS client_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS sessions_user_client_id_unique ON public.sessions(user_id, client_id) WHERE client_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS solves_user_client_id_unique ON public.solves(user_id, client_id) WHERE client_id IS NOT NULL;

-- A profile search RPC exposes only directory fields, and excludes blocked users.
CREATE OR REPLACE FUNCTION public.search_users(search_query TEXT)
RETURNS TABLE (id UUID, username TEXT, display_name TEXT, avatar_url TEXT, friend_code TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.friend_code
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND lower(search_query) <> ''
    AND (p.username ILIKE '%' || left(search_query, 40) || '%' OR p.friend_code ILIKE '%' || left(search_query, 40) || '%')
    AND p.id <> auth.uid()
    AND COALESCE((p.privacy_settings ->> 'profile_public')::boolean, true)
    AND NOT EXISTS (SELECT 1 FROM public.blocked_users b WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id) OR (b.blocker_id = p.id AND b.blocked_id = auth.uid()))
  ORDER BY p.username LIMIT 25;
$$;

CREATE OR REPLACE FUNCTION public.send_friend_request(target_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE new_request UUID; requester UUID := auth.uid();
BEGIN
  IF requester IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF target_user_id IS NULL OR target_user_id = requester THEN RAISE EXCEPTION 'Invalid friend request target'; END IF;
  IF EXISTS (SELECT 1 FROM public.blocked_users b WHERE (b.blocker_id = requester AND b.blocked_id = target_user_id) OR (b.blocker_id = target_user_id AND b.blocked_id = requester)) THEN RAISE EXCEPTION 'Friend request unavailable'; END IF;
  IF EXISTS (SELECT 1 FROM public.friendships f WHERE f.user_id = requester AND f.friend_id = target_user_id) THEN RAISE EXCEPTION 'Already friends'; END IF;
  INSERT INTO public.friend_requests(sender_id, receiver_id, status) VALUES (requester, target_user_id, 'pending')
  ON CONFLICT (sender_id, receiver_id) DO UPDATE SET status = 'pending', created_at = now() RETURNING id INTO new_request;
  RETURN new_request;
END; $$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(request_id UUID, accept_request BOOLEAN)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE requester UUID := auth.uid();
BEGIN
  IF requester IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF accept_request THEN RETURN public.accept_friend_request(request_id); END IF;
  UPDATE public.friend_requests SET status = 'rejected'
    WHERE id = request_id AND receiver_id = requester AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Pending incoming friend request not found'; END IF;
  RETURN TRUE;
END; $$;

CREATE OR REPLACE FUNCTION public.remove_friend(target_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE requester UUID := auth.uid();
BEGIN
  IF requester IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  DELETE FROM public.friendships WHERE (user_id = requester AND friend_id = target_user_id) OR (user_id = target_user_id AND friend_id = requester);
  RETURN TRUE;
END; $$;

-- Leaderboard RPCs return only public ranking fields and never expose solve rows.
CREATE OR REPLACE FUNCTION public.get_mean_leaderboard(target_event TEXT, result_limit INTEGER DEFAULT 50)
RETURNS TABLE (username TEXT, display_name TEXT, avatar_url TEXT, mean_time DOUBLE PRECISION, solve_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.username, p.display_name, p.avatar_url, AVG(s.raw_time), COUNT(*)
  FROM public.profiles p JOIN public.solves s ON s.user_id = p.id
  WHERE s.event = target_event AND s.status = 'ok' AND s.penalty <> 'DNF'
    AND COALESCE((p.privacy_settings ->> 'leaderboard_public')::boolean, true)
  GROUP BY p.id, p.username, p.display_name, p.avatar_url
  HAVING COUNT(*) >= 5
  ORDER BY AVG(s.raw_time) LIMIT GREATEST(1, LEAST(COALESCE(result_limit, 50), 100));
$$;

CREATE OR REPLACE FUNCTION public.get_friends_leaderboard(target_event TEXT, ranking_metric TEXT DEFAULT 'single', result_limit INTEGER DEFAULT 50)
RETURNS TABLE (username TEXT, display_name TEXT, avatar_url TEXT, best_time DOUBLE PRECISION, mean_time DOUBLE PRECISION, solve_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.username, p.display_name, p.avatar_url, MIN(s.raw_time), AVG(s.raw_time), COUNT(*)
  FROM public.friendships f
  JOIN public.profiles p ON p.id = f.friend_id
  JOIN public.solves s ON s.user_id = p.id
  WHERE f.user_id = auth.uid() AND s.event = target_event AND s.status = 'ok' AND s.penalty <> 'DNF'
    AND COALESCE((p.privacy_settings ->> 'leaderboard_public')::boolean, true)
  GROUP BY p.id, p.username, p.display_name, p.avatar_url
  HAVING ranking_metric <> 'mean' OR COUNT(*) >= 5
  ORDER BY CASE WHEN ranking_metric = 'mean' THEN AVG(s.raw_time) ELSE MIN(s.raw_time) END
  LIMIT GREATEST(1, LEAST(COALESCE(result_limit, 50), 100));
$$;

REVOKE ALL ON FUNCTION public.search_users(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_friend_request(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_friend_request(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_friend(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_mean_leaderboard(TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_friends_leaderboard(TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_users(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_friend_request(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_friend(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mean_leaderboard(TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_friends_leaderboard(TEXT, TEXT, INTEGER) TO authenticated;
COMMIT;
