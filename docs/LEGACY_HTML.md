# Legacy HTML files

**The App Router is the only live frontend.** When you run `npm run dev` or deploy the Next.js app, these `.html` files are not served as the main routes. They are kept for reference or archival only.

## Mapping: Legacy HTML → App Router

| Legacy file | App Router (canonical) |
|-------------|------------------------|
| `index.html` | `app/page.tsx` (landing) |
| `login.html` | `app/login/page.tsx` |
| `signup.html` | `app/signup/page.tsx` |
| `success.html` | `app/success/page.tsx` |
| `terms.html` | `app/terms/page.tsx` |
| `privacy.html` | `app/privacy/page.tsx` |
| `member/index.html` | Redirect / entry → `app/(member)/home/page.tsx` |
| `member/feed.html` | `app/(member)/home/page.tsx` |
| `member/post.html` | `app/(member)/post/[id]/page.tsx` |
| `member/profile.html` | `app/(member)/profile/page.tsx` |
| `member/grid.html` | `app/(member)/grid/page.tsx` |
| `member/calendar.html` | `app/(member)/calendar/page.tsx` (or `app/calendar/`) |
| `member/treats.html` | `app/(member)/treats/page.tsx` |
| `admin/index.html` | `app/admin/` (redirect/layout) |
| `admin/login.html` | `app/admin/login/page.tsx` (or login flow in layout) |
| `admin/dashboard.html` | `app/admin/(authenticated)/dashboard/page.tsx` |
| `admin/posts.html` | `app/admin/(authenticated)/posts/page.tsx` |
| `admin/media.html` | `app/admin/(authenticated)/media/page.tsx` |
| `admin/content.html` | `app/admin/(authenticated)/content/page.tsx` |
| `admin/users.html` | `app/admin/(authenticated)/users/page.tsx` |

## Notes

- **Run the app:** `npm run dev` — use routes like `/`, `/home`, `/post/[id]`, `/admin/dashboard`, etc.
- **Do not** rely on serving these `.html` files as the primary UI; `serve.json` has rewrites disabled so the Next.js app is the source of truth.
- To remove legacy files later, you can move them to a folder like `legacy-html/` or delete them after confirming the App Router covers all flows.
