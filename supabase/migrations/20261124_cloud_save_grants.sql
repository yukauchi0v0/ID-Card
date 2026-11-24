-- 2026-11-24 補齊資料表權限
--
-- 前一版 migration 只建了 RLS 政策，忘了給 PostgREST 使用的角色 table
-- 權限。沒有這份 GRANT，已登入的使用者查 cards / profiles /
-- card_versions 會得到「permission denied for table ...」（42501），
-- 即使 RLS 政策允許也一樣。
--
-- 這份檔案可以重複執行。

-- authenticated：登入後讀寫自己的資料，實際可見範圍仍由 RLS 決定。
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.cards to authenticated;
grant select, insert on public.card_versions to authenticated;

-- anon 不需要直接碰這三張表：觀看端只透過 get_public_card() 讀取。
revoke all on public.profiles from anon;
revoke all on public.cards from anon;
revoke all on public.card_versions from anon;

-- Storage：讓登入者可以上傳/覆蓋/刪除自己資料夾底下的檔案。
-- 實際能不能存取仍由 storage.objects 的 RLS 政策決定。
grant select, insert, update, delete on storage.objects to authenticated;
