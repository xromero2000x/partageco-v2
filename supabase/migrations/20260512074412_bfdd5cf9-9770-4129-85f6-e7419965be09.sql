
-- Révoquer l'exécution publique des fonctions internes
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_auth_email_confirmed() FROM PUBLIC, anon, authenticated;

-- Révoquer anon sur les helpers (les RLS y accèdent via le propriétaire)
REVOKE ALL ON FUNCTION public.has_admin_role(UUID, public.admin_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_any_admin(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_account_status(UUID) FROM PUBLIC, anon;

-- Garder l'accès pour authenticated (utilisé dans les RLS)
GRANT EXECUTE ON FUNCTION public.has_admin_role(UUID, public.admin_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_any_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_account_status(UUID) TO authenticated;
