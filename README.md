# ToolNest

> Every Tool. One Place.

ToolNest is an all-in-one online tools platform — 120 tools across 11 categories
(PDF, image, video, OCR, security, design, AI and more) in a single, fast,
modern web app. Built with **Next.js 16**, **React 19** and **Tailwind CSS v4**.

## Status

This repo currently includes:

- **Public site** (`/`) — hero, category browser, live tool search and a `⌘K`
  command palette over all 120 tools.
- **Admin panel** (`/admin`) — control-center dashboard with KPI cards,
  usage/top-tool charts, activity feed and a live job monitor, plus a
  collapsible slate sidebar covering every admin section.
- **Pricing** (`/pricing`) and **About** (`/about`) pages.
- A data layer defining all **11 categories** and **120 tools**.
- A library of working, client-side tool implementations (see
  `components/tools/`) ready to be wired into individual tool pages.

The individual tool pages (`/tool/[slug]`) and the remaining admin sub-pages are
the next step.

## Getting started

```bash
npm install
npm run dev
```

Then open:

- Public site: http://localhost:3000
- Admin panel: http://localhost:3000/admin

## Scripts

| Command         | Description                       |
| --------------- | --------------------------------- |
| `npm run dev`   | Start the dev server (Turbopack)  |
| `npm run build` | Production build                  |
| `npm run start` | Run the production build          |
| `npm run lint`  | Lint the project                  |

## Project structure

```
app/
  layout.tsx            Root layout (fonts, theme providers)
  (site)/               Public site route group (header + footer)
    page.tsx            Home page
    category/[slug]/    Category pages
    pricing/ about/
  admin/                Admin panel (own slate chrome)
    layout.tsx          Sidebar + topbar shell
    page.tsx            Dashboard
components/
  layout/               Header, footer, logo, theme toggle
  home/                 Home explorer (search + category filter)
  admin/                Sidebar, topbar, charts, stat cards
  tools/                Working tool implementations
  ui/                   Shared primitives (Button)
lib/
  data/                 categories.ts, tools.ts, types.ts
  admin/                nav.ts, mock.ts
  utils.ts
```

## Design system

- **Brand:** deep red `#E8231A` → orange `#FF6B35` gradient.
- **Fonts:** Poppins (display), Inter (body), JetBrains Mono (mono).
- **Theme:** dark by default, light mode supported via `next-themes`.

## Tech stack

- Next.js 16 (App Router) · React 19 · TypeScript (strict)
- Tailwind CSS v4
- `next-themes`, `cmdk`, `lucide-react`
- `pdf-lib`, `qrcode` for in-browser file processing

See `.env.example` for available environment variables.
