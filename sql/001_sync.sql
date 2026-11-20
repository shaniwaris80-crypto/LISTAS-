-- ARSLAN LISTAS: ejecutar únicamente en un proyecto Supabase nuevo y exclusivo.
-- NO ejecutar en ninguna base de Estambul Delivery.
-- La publicación de código GitHub es pública; la base requiere login y RLS.
BEGIN;
CREATE TABLE IF NOT EXISTS public.arslan_documents (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1),
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.arslan_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.arslan_documents FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.arslan_documents TO authenticated;

DROP POLICY IF EXISTS arslan_owner_read ON public.arslan_documents;
DROP POLICY IF EXISTS arslan_owner_insert ON public.arslan_documents;
DROP POLICY IF EXISTS arslan_owner_update ON public.arslan_documents;
CREATE POLICY arslan_owner_read ON public.arslan_documents FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));
CREATE POLICY arslan_owner_insert ON public.arslan_documents FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()) AND revision = 1);
CREATE POLICY arslan_owner_update ON public.arslan_documents FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.arslan_check_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'La revisión debe aumentar exactamente en 1';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.arslan_check_revision() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.arslan_check_revision() TO authenticated;
DROP TRIGGER IF EXISTS arslan_revision_guard ON public.arslan_documents;
CREATE TRIGGER arslan_revision_guard BEFORE UPDATE ON public.arslan_documents
FOR EACH ROW EXECUTE FUNCTION public.arslan_check_revision();

-- Habilitar cambios de Postgres para refresco inmediato en móviles/PC.
DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_publication_tables
   WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='arslan_documents'
 ) THEN
   EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.arslan_documents';
 END IF;
END;
$$;
COMMIT;