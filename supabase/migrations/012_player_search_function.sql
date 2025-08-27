CREATE OR REPLACE FUNCTION search_players(search_term TEXT)
RETURNS TABLE(id UUID, username TEXT, rating INT) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.username, p.rating
    FROM public.profiles p
    WHERE p.username ILIKE search_term || '%'
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;