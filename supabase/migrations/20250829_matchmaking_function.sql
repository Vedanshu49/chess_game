CREATE OR REPLACE FUNCTION matchmake_or_create_game(player_id uuid)
RETURNS TABLE(game_id uuid, is_new_game boolean) AS $$
DECLARE
    matched_game_id uuid;
BEGIN
    -- Use a transaction with a specific lock to handle concurrency
    LOCK TABLE games IN EXCLUSIVE MODE;

    -- Try to find a waiting game that this player didn't create
    SELECT id INTO matched_game_id
    FROM games
    WHERE status = 'waiting'
      AND (opponent IS NULL OR opponent != player_id)
      AND creator != player_id
      AND invite_code IS NULL
    LIMIT 1;

    IF matched_game_id IS NOT NULL THEN
        -- Found a game, so join it
        UPDATE games
        SET opponent = player_id,
            status = 'in_progress',
            players_joined = 2,
            updated_at = now()
        WHERE id = matched_game_id;

        RETURN QUERY SELECT matched_game_id, false;
    ELSE
        -- No game found, so create a new one
        INSERT INTO games (creator, status, players_joined)
        VALUES (player_id, 'waiting', 1)
        RETURNING id INTO matched_game_id;

        RETURN QUERY SELECT matched_game_id, true;
    END IF;
END;
$$ LANGUAGE plpgsql;