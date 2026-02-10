-- 002_bootstrap_company_schema.sql

-- 1. Create public.users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  company_id UUID REFERENCES public.companies(id),
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'company',
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

-- 2. Update companies table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'slug') THEN
        ALTER TABLE public.companies ADD COLUMN slug TEXT UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'plan') THEN
        ALTER TABLE public.companies ADD COLUMN plan TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'status') THEN
        ALTER TABLE public.companies ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
END $$;

-- 3. Update subscriptions table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'company_id') THEN
        ALTER TABLE public.subscriptions ADD COLUMN company_id UUID REFERENCES public.companies(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'provider') THEN
        ALTER TABLE public.subscriptions ADD COLUMN provider TEXT DEFAULT 'manual';
    END IF;
END $$;

-- 4. Update whatsapp_accounts table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_accounts' AND column_name = 'company_id') THEN
        ALTER TABLE public.whatsapp_accounts ADD COLUMN company_id UUID REFERENCES public.companies(id);
    END IF;
    -- Also ensure phone_number_id is present (it was in keys, but just in case)
    -- And status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_accounts' AND column_name = 'status') THEN
        ALTER TABLE public.whatsapp_accounts ADD COLUMN status TEXT DEFAULT 'disconnected';
    END IF;
END $$;

-- 5. Create monthly_usage table
CREATE TABLE IF NOT EXISTS public.monthly_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id),
  conversations INTEGER DEFAULT 0,
  templates INTEGER DEFAULT 0,
  agents INTEGER DEFAULT 1,
  month DATE DEFAULT CURRENT_DATE, -- Storing first day of month usually
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(company_id, month)
);
