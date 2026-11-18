
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  title TEXT,
  message TEXT,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_all ON public.notifications;
CREATE POLICY notifications_all ON public.notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.financial_years ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.financial_years ADD COLUMN IF NOT EXISTS annual_budget NUMERIC(15,2) DEFAULT 0;

INSERT INTO income_categories (name) VALUES
('Donations'),('Grants'),('Membership Fees'),('Other Income')
ON CONFLICT (name) DO NOTHING;
INSERT INTO expense_categories (name) VALUES
('Office'),('Transportation'),('Food'),('Utilities'),('Other')
ON CONFLICT (name) DO NOTHING;
INSERT INTO payment_methods (name) VALUES
('Cash'),('Bank Transfer'),('Cheque'),('Mobile Money')
ON CONFLICT (name) DO NOTHING;
