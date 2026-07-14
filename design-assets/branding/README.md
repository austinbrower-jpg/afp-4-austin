# Branding source assets

This folder holds original Battle Bound Branding logo source/export files (`BBBLLC_WEB_IMAGE/`) — the full batch of exported logo lockups, marks, and certification badges (black/white, various sizes, PNG and SVG, plus the original zip archives), kept for reference and future design work.

These are **not** served by the application. Nothing under `design-assets/` is publicly accessible — Next.js only serves files placed in `public/`, and no code, test, or build process references anything in this folder.

The single logo the application actually uses is a plain, unmodified copy of `BBBLLC_WEB_IMAGE/BBBLLC_Web_Logo/_   bbb-mark-black-transparent-2000x2000.png`, checked in separately at:

```
public/branding/battle-bound-branding-logo.png
```

If the production logo ever needs to change, update that file in `public/branding/` directly — this folder is source material, not a build input.
