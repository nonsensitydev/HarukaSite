# Haruka

A minimal, self-hostable coming-soon page with a character-decoding title and VRM avatars. Each refresh shuffles the models, shows every avatar, then settles on Bocchi. Authored walking, wave, and idle clips replace the original procedural greeting; motion transitions blend into one another. Reduced-motion preferences show a static idle pose without cycling or text scrambling.

## Develop

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
```

The development server listens on port 4173. The cloud environment is already isolated; use this checkout directly, without creating a worktree.

## Add characters

Put `.vrm` files in `public/vrms/`, then restart the development server or rebuild. The generated `models.json` includes every VRM file in that folder, sorted by name. Remove `sample.vrm` when replacing it with your own avatars. Ensure you have permission to use and distribute each model. Models are scanned at startup/build time; an already exported static site does not scan its server filesystem.

Each avatar walks in, waves once, then idles. After about eight seconds, the next avatar appears and greets the visitor. Once all models have appeared, `bocchi.vrm` is selected for the final idle (if Bocchi was already last, it simply stays). Without a Bocchi model, the last model in the shuffled list stays. The original sample avatar has been replaced by the supplied characters.

Models are fetched one ahead, keeping at most two decoded avatars in memory. The first model still needs to download before appearing. These files are about 20–26 MB each, so slow mobile connections may take time. Reduced motion loads only one random model and skips automatic rotation.

Five uploaded models are included: Bocchi, Akane, Gothmaid, Miku, and Soldier Catgirl. The supplied AKAI attachment exceeded the environment's 32 MiB inbound transfer limit and is not included. Add a smaller export to `public/vrms/` when available. Embedded model attribution/usage metadata is preserved in each VRM and recorded in `public/licenses/uploaded-models.json`.

## Self host

```sh
npm run build
```

Upload the contents of `dist/` to any static HTTP(S) server. All runtime libraries and models are bundled locally; no backend, API key, PHP, or runtime CDN is required. Serve over HTTP(S), rather than opening `index.html` as a file. If deploying below a subdirectory, build with `npm run build -- --base=/your-path/`.

Use `npm run preview` to serve the production build on port 4173 (stop the dev server first). Adding models requires another build and upload. The landing page intentionally has no navigation, signup form, or extra sections.

## Credits

Rendering: Three.js (MIT) and @pixiv/three-vrm (MIT). Their license texts are in `public/licenses/` and copied into the production export.

Walk, wave, and idle motions are adapted from Tomás Laulhé's (Quaternius) CC0 RobotExpressive animation clips in the official Three.js examples. `public/animations/motions.json` contains 30 fps samples of the authored bone directions, retargeted at runtime to each VRM humanoid. See `public/licenses/animations.txt` for attribution and source. This direction-based adaptation preserves the authored limb motion; it does not reproduce the source rig's finger or twist animation.

## GitHub Pages

The included `.github/workflows/pages.yml` builds and deploys on every push to `main`, or when run manually from the Actions tab. In the repository's **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**. After enabling it, run **Deploy Haruka to GitHub Pages** from **Actions → Run workflow** if the initial run already failed before Pages was enabled.

The workflow builds with `--base=/HarukaSite/` (derived from the repository name), so assets and VRM models work at https://nonsensitydev.github.io/HarukaSite/. You do not need to commit `dist/` or upload the ZIP. For updates, commit source edits or add `.vrm` files to `public/vrms/` and push to `main`.
