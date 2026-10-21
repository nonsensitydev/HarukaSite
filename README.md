# Haruka

A minimal, self-hostable coming-soon page: a character-decoding title, a smiling VRM avatar peeking in from the left, one greeting wave, and breathing/blinking idle motion. Multiple models take turns, retreating before the next greeting. Reduced-motion preferences disable the animated greeting, rotation, and text scramble.

## Develop

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
```

The development server listens on port 4173. The cloud environment is already isolated; use this checkout directly, without creating a worktree.

## Add characters

Put `.vrm` files in `public/vrms/`, then restart the development server or rebuild. The generated `models.json` includes every VRM file in that folder, sorted by name. Remove `sample.vrm` when replacing it with your own avatars. Ensure you have permission to use and distribute each model. Models are scanned at startup/build time; an already exported static site does not scan its server filesystem.

Each model enters, waves once, idles, then exits after about 18 seconds when multiple models are available. With one model, it stays and idles. VRM 0.x and 1.0 models are supported through three-vrm; unusual custom rigs or expression mappings may need model-specific tuning.

## Self host

```sh
npm run build
```

Upload the contents of `dist/` to any static HTTP(S) server. All runtime libraries and models are bundled locally; no backend, API key, PHP, or runtime CDN is required. Serve over HTTP(S), rather than opening `index.html` as a file. If deploying below a subdirectory, build with `npm run build -- --base=/your-path/`.

Use `npm run preview` to serve the production build on port 4173 (stop the dev server first). Adding models requires another build and upload. The landing page intentionally has no navigation, signup form, or extra sections.

## Credits

Rendering: Three.js (MIT) and @pixiv/three-vrm (MIT). Their license texts are in `public/licenses/` and copied into the production export.

The included demonstration avatar is `VRM1_Constraint_Twist_Sample` v1.0.1, © 2022 pixiv Inc., from the official pixiv/three-vrm examples. It is not a custom Haruka character. See `public/licenses/sample-model.json` for the embedded license and usage metadata, including the VRM Public License 1.0 URL. Credit is not required by the model; its metadata permits redistribution. The metadata's usage restrictions still apply.

## GitHub Pages

The included `.github/workflows/pages.yml` builds and deploys on every push to `main`, or when run manually from the Actions tab. In the repository's **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**. After enabling it, run **Deploy Haruka to GitHub Pages** from **Actions → Run workflow** if the initial run already failed before Pages was enabled.

The workflow builds with `--base=/HarukaSite/` (derived from the repository name), so assets and VRM models work at https://nonsensitydev.github.io/HarukaSite/. You do not need to commit `dist/` or upload the ZIP. For updates, commit source edits or add `.vrm` files to `public/vrms/` and push to `main`.
