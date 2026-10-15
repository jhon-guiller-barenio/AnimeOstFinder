CREATE TABLE IF NOT EXISTS public.activity_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN (
    'page_view','search','play','favorite_add','favorite_remove','download',
    'chat_open','support_open','sign_in','sign_up','sign_out'
  )),
  clerk_user_id text,
  visitor_id text,
  page_path text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_events_created_at_idx
  ON public.activity_events (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_events_type_created_at_idx
  ON public.activity_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_events_clerk_user_id_created_at_idx
  ON public.activity_events (clerk_user_id, created_at DESC);
