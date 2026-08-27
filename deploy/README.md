# Deploy — راهنمای دیپلوی روی Netlify

این پوشه شامل تمام فایل‌های لازم برای دیپلوی پروژه روی Netlify است.

---

## فایل‌های این پوشه

| فایل | کاربرد |
|---|---|
| `netlify.toml` | تنظیمات کامل build و deploy برای Netlify |
| `netlify-deploy.yml` | GitHub Actions workflow — باید به `.github/workflows/` کپی شود |
| `README.md` | همین راهنما |

---

## مراحل دیپلوی — گام به گام

### ۱. ساخت سایت در Netlify

1. وارد [app.netlify.com](https://app.netlify.com) شوید
2. روی **Add new site → Import an existing project** کلیک کنید
3. GitHub را انتخاب کنید و مخزن `RoziAteliyer1` را پیدا کنید
4. تنظیمات Build را اینطور پر کنید:

| فیلد | مقدار |
|---|---|
| Base directory | `.` (خالی بگذارید) |
| Build command | `npm ci && npm run build` |
| Publish directory | `.next` |

5. روی **Deploy site** کلیک کنید

---

### ۲. تنظیم Environment Variables در Netlify

در Netlify بروید به: **Site → Site configuration → Environment variables**

این متغیرها را اضافه کنید:

| متغیر | مقدار |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | آدرس پروژه Supabase (مثلاً `https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | کلید anon از Supabase Dashboard |
| `NEXT_PUBLIC_SITE_URL` | آدرس سایت Netlify شما (مثلاً `https://roziateliyer.netlify.app`) |

> مقادیر را از [app.supabase.com](https://app.supabase.com) → Project Settings → API بگیرید.

---

### ۳. فعال‌سازی GitHub Actions (دیپلوی خودکار)

#### الف — کپی workflow

```bash
cp deploy/netlify-deploy.yml .github/workflows/netlify-deploy.yml
```

#### ب — تنظیم Secrets در GitHub

در مخزن GitHub بروید به: **Settings → Secrets and variables → Actions**

دو secret زیر را اضافه کنید:

| Secret | محل دریافت |
|---|---|
| `NETLIFY_AUTH_TOKEN` | Netlify → User settings → Personal access tokens → New token |
| `NETLIFY_SITE_ID` | Netlify → Site → Site configuration → Site ID |

#### ج — push کنید

```bash
git add .
git commit -m "ci: add netlify deploy workflow"
git push
```

بعد از push، workflow به‌صورت خودکار اجرا و سایت دیپلوی می‌شود.

---

### ۴. دریافت Personal Access Token از Netlify

1. وارد Netlify شوید
2. بروید به: **User settings → Applications → Personal access tokens**
3. روی **New access token** کلیک کنید
4. یک نام بدهید (مثلاً `github-actions`)
5. توکن را کپی کنید و در GitHub Secrets با نام `NETLIFY_AUTH_TOKEN` ذخیره کنید

---

### ۵. پیدا کردن Site ID

1. وارد Netlify شوید
2. سایت خود را انتخاب کنید
3. بروید به: **Site configuration → Site details**
4. مقدار **Site ID** را کپی کنید و در GitHub Secrets با نام `NETLIFY_SITE_ID` ذخیره کنید

---

## نکات مهم

- فایل `.env.local` **هرگز** commit نمی‌شود — متغیرها باید مستقیم در Netlify تنظیم شوند
- هر push به branch `master` یا `main` به‌صورت خودکار دیپلوی می‌شود
- برای دیپلوی دستی: GitHub → Actions → Deploy to Netlify → Run workflow
