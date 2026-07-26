# One thing your Owner/Admin must do in the dashboard

Your account is **Developer** on Voice-mango. You can deploy functions and push migrations, but you **cannot** change auth settings via CLI (403).

## Enable anonymous sign-in (required for Mango)

1. Open https://supabase.com/dashboard/project/xcxmviucplloumrlqnje/auth/providers
2. Find **Anonymous sign-ins**
3. Turn it **ON**
4. Save

Without this, the app fails with: `anonymous_provider_disabled`

---

## Already done (no action needed)

| Step | Status |
|------|--------|
| `OPENAI_API_KEY` secret | Set by admin |
| Deploy `reflection-deepen` | Done |
| Deploy `reflection-artifact` | Done |
| Deploy `chat` | Done |
| Push migration `001_init.sql` | Done |
| Seed Dickinson poem | Run via CLI (see below if poem missing) |
| `app/.env.local` → hosted URL | Done |

---

## After admin enables anonymous auth

Restart the dev server and test:

```powershell
cd app
npm run dev
```

Open the app, complete a Reflection. Browser console should show:

```
[mango] reflection-deepen: live
```

---

## Optional: re-seed the poem if the opening text doesn't load

```powershell
npx supabase db query --linked --file supabase/seed.sql
```
