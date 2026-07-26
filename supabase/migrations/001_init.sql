create extension if not exists "pgcrypto";

create type text_rights  as enum ('public_domain','openly_licensed','original');
create type entry_mode   as enum ('chart','reflection');
create type input_method as enum ('text','voice');

create table public.texts (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  author         text,
  body           text not null,
  year_published int,
  source_note    text,
  rights         text_rights not null,
  rights_note    text not null,
  register       text[] not null default '{}',
  tone           text[] not null default '{}',
  themes         text[] not null default '{}',
  read_seconds   int  not null default 20,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table public.entries (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  mode               entry_mode not null,
  body               text not null default '',
  input_method       input_method not null default 'text',
  tag                text,
  text_id            uuid references public.texts(id),
  deepening_question text,
  artifact_body      text,
  promoted_from      uuid references public.entries(id) on delete set null,
  is_seeded          boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index entries_user_created_idx on public.entries (user_id, created_at desc);

alter table public.texts   enable row level security;
alter table public.entries enable row level security;

create policy "texts readable when active"
  on public.texts for select to authenticated using (active);

create policy "entries are private to their author"
  on public.entries for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


grant select on public.texts to authenticated;
grant select, insert, update, delete on public.entries to authenticated;
