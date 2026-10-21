# Haruka

A minimal, self-hostable coming-soon page with a character-decoding title and VRM avatars animated directly from VRMA files.

## Develop

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
```

The development server listens on port 4173. Cloud tasks are isolated; use this checkout directly without creating a worktree.

## Add characters

Put `.vrm` files in `public/vrms/`, then restart the development server or rebuild. Startup/build scans every VRM in this folder. The generated `models.json` is not committed.

Every refresh shuffles the avatars. During the selected animation, the next avatar appears roughly every 0.8 seconds when downloaded and decoded. All avatars use the same playback timestamp, so a change during a spin continues the same motion. The sequence visits every model, ends on `bocchi.vrm`, finishes the current animation loop, and holds its final pose. If Bocchi was already last, it stays. Without Bocchi, the last shuffled avatar stays.

Only the current and next avatars are decoded at once to limit memory usage on phones. Files are about 20–26 MB each, so slow connections may delay avatar changes; the current avatar keeps animating until the next is ready. Reduced-motion preferences select Bocchi immediately (when present), hold the final pose, and skip cycling and title scrambling.

Included uploaded models: Bocchi, Akane, Gothmaid, Miku, and Soldier Catgirl. The AKAI attachment exceeded the environment's 32 MiB inbound transfer limit and is not included. Add a smaller export to `public/vrms/` when available. Embedded attribution/usage metadata is preserved in the models and recorded in `public/licenses/uploaded-models.json`. Only publish models you have permission to distribute.

## Add animations

Upload `.vrma` files to **`public/vrmas/`** and push to `main`. GitHub Pages rebuilds automatically. Locally, restart `npm run dev` after adding files. All `.vrma` files in that folder are registered automatically, and **one is chosen at random each refresh**. Currently only the supplied `VRMA_02.vrma` is included.

The animation's actual VRMA bone, expression, and gaze tracks are retargeted with `@pixiv/three-vrm-animation`. The previous adapted robot motion and procedural greeting have been removed. Models change during playback without restarting the animation. Use a clip with a comfortable final pose: Bocchi holds the last frame after the full model sequence. At least one VRMA is required.

## Self host

```sh
npm run build
```

Upload the contents of `dist/` to any static HTTP(S) server. Runtime libraries, avatars, and animations are included locally. No API key, backend, PHP, or CDN is required. Serve over HTTP(S), rather than opening `index.html` as a file. If deploying below a subdirectory, build with `npm run build -- --base=/your-path/`.

Use `npm run preview` for the production build (stop the dev server first). For a subdirectory build, also pass that same base to preview, e.g. `npm run preview -- --base=/HarukaSite/`. Adding models or animations to an exported site requires another build and upload.

## Credits

Three.js, @pixiv/three-vrm, and @pixiv/three-vrm-animation are MIT licensed. Library licenses are copied into `public/licenses/` for the static export. VRMA_02 and the character files were supplied by the site owner; their respective licenses still apply.

## GitHub Pages

`.github/workflows/pages.yml` builds and deploys on every push to `main`, or manually from the Actions tab. In **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.

The workflow builds with `--base=/HarukaSite/` (derived from the repository name), so assets work at https://nonsensitydev.github.io/HarukaSite/. Do not commit `dist/` or upload the ZIP for this workflow. Commit source edits, VRMs in `public/vrms/`, or VRMAs in `public/vrmas/` and push to `main`.
