CREATE OR REPLACE FUNCTION get_leaderboard(time_frame TEXT)
RETURNS TABLE(username TEXT, rating INT, wins BIGINT) AS $$
BEGIN
    IF time_frame = 'all_time' THEN
        RETURN QUERY 
        SELECT p.username, p.rating, p.wins::BIGINT
        FROM public.profiles p
        ORDER BY p.rating DESC;
    ELSE
        RETURN QUERY
        WITH winners AS (
            SELECT 
                CASE 
                    WHEN g.result = '1-0' THEN g.creator
                    WHEN g.result = '0-1' THEN g.opponent
                END as winner_id
            FROM public.games g
            WHERE g.status IN ('checkmate', 'timeout', 'resigned') 
              AND g.created_at >= now() - (CASE WHEN time_frame = 'weekly' THEN '7 days' ELSE '30 days' END)::interval
        )
        SELECT 
            p.username,
            p.rating,
            count(w.winner_id) as wins
        FROM winners w
        JOIN public.profiles p ON w.winner_id = p.id
        WHERE w.winner_id IS NOT NULL
        GROUP BY p.id
        ORDER BY wins DESC;
    END IF;
END;
$$ LANGUAGE plpgsql;