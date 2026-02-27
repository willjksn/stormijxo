# Legacy HTML files

**The App Router is the only live frontend.** When you run `npm run dev` or deploy the Next.js app, these `.html` files are not served as the main routes. They have been moved to **`legacy-html/`** for reference or archival only.

## Location

All legacy HTML files live under **`legacy-html/`**:

- Root pages: `legacy-html/index.html`, `legacy-html/login.html`, etc.
- Admin: `legacy-html/admin/dashboard.html`, `legacy-html/admin/posts.html`, etc.
- Member: `legacy-html/member/feed.html`, `legacy-html/member/profile.html`, etc.

## Mapping: Legacy HTML → App Router

| Legacy file (in `legacy-html/`) | App Router (canonical) |
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
- **Do not** rely on serving these `.html` files as the primary UI; they live in `legacy-html/` and are not part of the Next.js build. The App Router is the source of truth.
