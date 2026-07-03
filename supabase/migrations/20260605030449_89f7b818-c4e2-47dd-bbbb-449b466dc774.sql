CREATE TABLE public.saved_builds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  page TEXT NOT NULL,
  name TEXT NOT NULL,
  build JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_builds TO authenticated;
GRANT ALL ON public.saved_builds TO service_role;
ALTER TABLE public.saved_builds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own builds" ON public.saved_builds FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER saved_builds_touch BEFORE UPDATE ON public.saved_builds FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();