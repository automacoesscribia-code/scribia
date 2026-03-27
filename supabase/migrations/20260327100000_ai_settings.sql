-- AI Settings: provider, API key, and model configuration
-- Singleton table (max 1 row) managed by super_admin via UI

CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'gemini' CHECK (provider IN ('gemini', 'openai', 'anthropic')),
  api_key TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure only one row exists (singleton pattern)
CREATE UNIQUE INDEX ai_settings_singleton ON ai_settings ((true));

-- Trigger for updated_at
CREATE TRIGGER ai_settings_updated_at
  BEFORE UPDATE ON ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

-- Super admins can read and write
CREATE POLICY "Super admins can manage AI settings"
  ON ai_settings FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Edge functions (service role) can read
CREATE POLICY "Service role can read AI settings"
  ON ai_settings FOR SELECT
  USING (true);

-- Insert default row
INSERT INTO ai_settings (provider, api_key, model)
VALUES ('gemini', '', 'gemini-2.5-flash');

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON ai_settings TO authenticated;
GRANT SELECT ON ai_settings TO service_role;
