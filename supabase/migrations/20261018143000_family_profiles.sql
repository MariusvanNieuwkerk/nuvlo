-- Gezinskoppeling. Bestaande kinderen blijven family_id NULL tot de beheerder
-- ze zelf koppelt. Een nieuw account krijgt die rijen dus niet vanzelf.

alter table public.children
  add column if not exists family_id uuid references auth.users (id) on delete cascade;

create index if not exists children_family_id_idx on public.children (family_id);

alter table public.children enable row level security;
alter table public.stories enable row level security;
alter table public.characters enable row level security;
alter table public.image_usage enable row level security;

create policy children_own_family on public.children
  for all to authenticated
  using (family_id = auth.uid())
  with check (family_id = auth.uid());

create policy stories_own_child on public.stories
  for all to authenticated
  using (child_id in (select id from public.children where family_id = auth.uid()))
  with check (child_id in (select id from public.children where family_id = auth.uid()));

create policy characters_own_child on public.characters
  for all to authenticated
  using (child_id in (select id from public.children where family_id = auth.uid()))
  with check (child_id in (select id from public.children where family_id = auth.uid()));

create policy image_usage_own_child on public.image_usage
  for all to authenticated
  using (child_id in (select id from public.children where family_id = auth.uid()))
  with check (child_id in (select id from public.children where family_id = auth.uid()));
