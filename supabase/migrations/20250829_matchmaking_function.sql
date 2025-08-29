CREATE OR REPLACE FUNCTION matchmake_or_create_game(p_player_id uuid)
RETURNS TABLE(game_id uuid, is_new_game boolean) AS $$
DECLARE
    matched_game_id uuid;
BEGIN
    -- Find a waiting game and lock that specific row
    SELECT id INTO matched_game_id
    FROM games
    WHERE status = 'waiting'
      AND (opponent IS NULL OR opponent != p_player_id)
      AND creator != p_player_id
      AND invite_code IS NULL
    LIMIT 1
    FOR UPDATE SKIP LOCKED; -- This is the key change

    IF matched_game_id IS NOT NULL THEN
        -- Found a game, so join it
        UPDATE games
        SET opponent = p_player_id,
            status = 'in_progress',
            players_joined = 2,
            last_move_at = now()
        WHERE id = matched_game_id;

        RETURN QUERY SELECT matched_game_id, false;
    ELSE
        -- No game found, so create a new one
        -- This part is still subject to a race condition where two players
        -- might create a new game at the same time.
        -- A full solution might require a separate queue table or more complex logic.
        -- For now, we will proceed with this improved version.
        BEGIN
            INSERT INTO games (creator, status, players_joined, fen)
            VALUES (p_player_id, 'waiting', 1, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
            RETURNING id INTO matched_game_id;

            RETURN QUERY SELECT matched_game_id, true;
        EXCEPTION WHEN OTHERS THEN
            -- If we failed to insert, it's likely because another player just created a game.
            -- Let's try to find a waiting game again.
            SELECT id INTO matched_game_id
            FROM games
            WHERE status = 'waiting'
              AND (opponent IS NULL OR opponent != p_player_id)
              AND creator != p_player_id
              AND invite_code IS NULL
            LIMIT 1
            FOR UPDATE SKIP LOCKED;

            IF matched_game_id IS NOT NULL THEN
                UPDATE games
                SET opponent = p_player_id,
                    status = 'in_progress',
                    players_joined = 2,
                    last_move_at = now()
                WHERE id = matched_game_id;

                RETURN QUERY SELECT matched_game_id, false;
            ELSE
                -- This should be rare, but if we still can't find a game, raise an error.
                RAISE EXCEPTION 'Matchmaking failed';
            END IF;
        END;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to the authenticated role
GRANT EXECUTE ON FUNCTION public.matchmake_or_create_game(uuid) TO authenticated;