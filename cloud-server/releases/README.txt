Place your electron-builder release artifacts here.
electron-updater expects the following files for each release:

Windows (x64):
  Biznex BOS Setup 1.x.x.exe
  latest.yml

Linux (x64):
  Biznex BOS-1.x.x.AppImage
  latest-linux.yml

Linux (ARM / Raspberry Pi):
  biznex-bos_1.x.x_armv7l.deb
  latest-linux.yml   (same file, contains entries for both archs)

How to populate this folder:
  1. Run `npm run build:win` or `npm run build:linux` in the app folder
  2. Copy the output from dist/ into this releases/ folder
  3. Restart / redeploy the license server

The /releases/ HTTP endpoint on this server is public (no auth required)
so that electron-updater can download updates without a login token.
