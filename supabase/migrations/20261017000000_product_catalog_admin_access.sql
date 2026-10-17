-- product_catalog had RLS on with no policies, so only the service role could
-- see it. Admins now read/write it directly: the admin Products page lists
-- catalogue items that aren't in any client store yet, and catalogue imports
-- (scripts/import-internal-catalogue.mjs) write to it with an admin session.
create policy product_catalog_admin_all on public.product_catalog
  for all
  using (public.is_admin())
  with check (public.is_admin());
