CREATE TABLE public.rating_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
    rating_after_game INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rating_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX ix_rating_history_user_id ON public.rating_history(user_id);

CREATE POLICY "User can view their own rating history" 
ON public.rating_history FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Allow insert for game participants (internal)" 
ON public.rating_history FOR INSERT 
WITH CHECK (true); -- Note: Inserts should be handled by trusted functions or backend logic.
