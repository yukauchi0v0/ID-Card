-- 2026-11-24 雲端存檔：profiles / cards / card_versions / storage
--
-- 在 Supabase Dashboard → SQL Editor 貼上整份執行即可。
-- 這份 migration 只會建立第一版需要的東西；重新執行是安全的（IF NOT EXISTS）。

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles：每個登入使用者一列；card_code 就是 viewer 網址的短代碼
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  card_code text not null unique,
  created_at timestamptz not null default now()
);

-- card_code 由資料庫產生，前端不能指定；8 碼英數，避開容易混淆的 0/o/1/l
create or replace function public.generate_card_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'abcdefghijkmnpqrstuvwxyz23456789';
  code text := '';
begin
  for i in 1..8 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return code;
end;
$$;

-- 第一次登入時自動建立 profile；撞號就重試
create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.profiles;
  attempt int := 0;
begin
  select * into existing from public.profiles where id = auth.uid();
  if found then
    return existing;
  end if;

  loop
    attempt := attempt + 1;
    begin
      insert into public.profiles (id, display_name, card_code)
      values (auth.uid(), '', public.generate_card_code())
      returning * into existing;
      return existing;
    exception when unique_violation then
      if attempt >= 5 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- cards：每位使用者一張草稿
-- ---------------------------------------------------------------------------
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  targets jsonb not null default '[]'::jsonb,
  mind_path text,
  signature text,
  published_version_id uuid,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- card_versions：已發布快照；viewer 只會拿到最新一版
-- ---------------------------------------------------------------------------
create table if not exists public.card_versions (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  version int not null,
  manifest jsonb not null,
  published_at timestamptz not null default now(),
  unique (card_id, version)
);

alter table public.cards
  drop constraint if exists cards_published_version_fk;
alter table public.cards
  add constraint cards_published_version_fk
  foreign key (published_version_id) references public.card_versions (id) on delete set null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.cards enable row level security;
alter table public.card_versions enable row level security;

drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 同一組卡蓋圖可以跨帳號沿用：使用者換帳號或在新裝置登入時，製作端
-- 會依 signature 找到舊草稿並把檔案複製過來（見 js/studio/cloud.js）。
-- 因此已登入使用者可以「查得到」別人的草稿列，但只有本人能修改。
create index if not exists cards_signature_idx on public.cards (signature);

drop policy if exists "cards select own" on public.cards;
create policy "cards select own" on public.cards
  for select using (auth.uid() = user_id);

drop policy if exists "cards select by signature" on public.cards;
create policy "cards select by signature" on public.cards
  for select to authenticated using (true);

-- 列表查詢（沒有指定 user_id）只回傳自己的那一列，避免輪詢時把
-- 所有人的名片都列出來；用簽章查單筆時才會看到別人的那一列。
create or replace function public.my_cards()
returns setof public.cards
language sql
security definer
set search_path = public
stable
as $$
  select * from public.cards where user_id = auth.uid();
$$;

revoke all on function public.my_cards() from public;
grant execute on function public.my_cards() to authenticated;

drop policy if exists "cards insert own" on public.cards;
create policy "cards insert own" on public.cards
  for insert with check (auth.uid() = user_id);

drop policy if exists "cards update own" on public.cards;
create policy "cards update own" on public.cards
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "versions select own" on public.card_versions;
create policy "versions select own" on public.card_versions
  for select using (
    exists (select 1 from public.cards c where c.id = card_id and c.user_id = auth.uid())
  );

drop policy if exists "versions insert own" on public.card_versions;
create policy "versions insert own" on public.card_versions
  for insert with check (
    exists (select 1 from public.cards c where c.id = card_id and c.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 公開讀取：viewer 不登入也能拿到已發布的 manifest
-- ---------------------------------------------------------------------------
create or replace function public.get_public_card(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select v0.manifest into v
  from public.profiles p
  join public.cards c on c.user_id = p.id
  join public.card_versions v0 on v0.id = c.published_version_id
  where p.card_code = p_code;

  return v;
end;
$$;

revoke all on function public.get_public_card(text) from public;
grant execute on function public.get_public_card(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage：card-assets bucket
-- 路徑規則：{user_id}/draft/... 只有本人讀寫；{user_id}/published/... 公開讀、本人寫
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('card-assets', 'card-assets', true, 62914560)
on conflict (id) do update set public = true, file_size_limit = 62914560;

drop policy if exists "card assets read" on storage.objects;
create policy "card assets read" on storage.objects
  for select using (
    bucket_id = 'card-assets'
    and (
      (storage.foldername(name))[2] = 'published'
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

drop policy if exists "card assets insert own" on storage.objects;
create policy "card assets insert own" on storage.objects
  for insert with check (
    bucket_id = 'card-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "card assets update own" on storage.objects;
create policy "card assets update own" on storage.objects
  for update using (
    bucket_id = 'card-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "card assets delete own" on storage.objects;
create policy "card assets delete own" on storage.objects
  for delete using (
    bucket_id = 'card-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
