# Image loading – what’s in place and next steps

## What’s implemented

- **Lazy loading** – Media library grid, content picker grid, and admin posts library use `loading="lazy"` so images load as they enter the viewport. Feed and grid already had this; calendar and dashboard thumbnails now use it too.
- **Async decoding** – `decoding="async"` is set on images so decode work doesn’t block the main thread.
- **Placeholder until load** – In the media library, content picker, and admin posts library, a gray placeholder is shown until the image loads (`LazyMediaImage` in `app/components/LazyMediaImage.tsx`), then the image fades in. This reduces layout shift and makes loading feel faster.
- **Hero image** – Tip page hero uses `fetchPriority="high"` and `decoding="async"` so it’s prioritized without blocking.

## Why images can still feel slow

- **Full-size files** – Firebase Storage URLs serve the original file. Large photos (e.g. 2–5 MB) take time to download.
- **No thumbnails** – Every view (library, feed, post) uses the same URL; there’s no smaller “grid” or “card” variant.
- **No image CDN** – Requests go to Firebase; a CDN in front could improve latency in some regions.

## Next steps (optional, for even faster loading)

1. **Generate thumbnails on upload**
   - On upload (e.g. in `uploadToMediaLibrary` or a Cloud Function), generate a smaller version (e.g. 400px or 600px wide) and store it (e.g. `content/media/thumb_...` or in metadata).
   - In the app, use the thumbnail URL in grids/lists and the full URL only on the post detail / lightbox.

2. **Use Next.js Image**
   - Add Firebase Storage (and any CDN) to `images.remotePatterns` in `next.config.ts`.
   - Use `next/image` for key images so Next can optimize format/size and lazy load. Keep using `LazyMediaImage` or plain `<img>` where you need Firebase URLs and custom placeholders.

3. **CDN in front of Firebase Storage**
   - Put a CDN (e.g. Cloudflare, Cloud CDN) in front of your storage bucket so repeated requests are cached and served from edge locations.

4. **Resize/compress on upload**
   - Resize images in the browser before upload (e.g. max 1920px wide, quality 0.85) so stored files are smaller and faster to load everywhere.
