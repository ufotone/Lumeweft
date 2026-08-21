# AI Release Handoff

Read this before helping with Velorn commits, tags, or desktop releases.

## Important

Lumeweft currently publishes Windows-only alpha releases. Do not describe macOS or Linux as supported without real platform testing.

The normal release flow is:

1. Commit the release changes.
2. Push `main`.
3. Push an alpha version tag, for example `v0.3.28-alpha.1`.
4. GitHub Actions builds the Windows x64 NSIS installer.
5. GitHub publishes the release as a prerelease after uploading the installer.

The workflow is:

```text
.github/workflows/release.yml
```

The release process doc is:

```text
docs/RELEASE_PROCESS.md
```

## What Gets Built

The GitHub Actions release workflow uploads:

- `Windows Installer`

macOS and Linux may be explored later through experimental GitHub Actions builds, but they are not tested, distributed, or supported now.

Do not upload `.blockmap` or `latest*.yml` files unless auto-update support is added later.

## Release Checklist

1. Check git status.
2. Do not commit generated release folders or local media files unless the user explicitly asks.
3. Confirm `package.json` has the new release version.
4. Confirm `package-lock.json` matches the same version.
5. Run `npm run build`.
6. Commit the release changes.
7. Push `main`.
8. Create and push the version tag:

```bash
git tag -a v0.3.28-alpha.1 -m "Lumeweft v0.3.28-alpha.1"
git push lumeweft refs/tags/v0.3.28-alpha.1
```

9. Monitor `Actions > Release Windows Alpha` until completion.
10. Verify that the prerelease contains only the Windows installer.

## If GitHub Actions Fails

Open the failed job and inspect the last failing step.

Common cases:

- Windows upload fails: check artifact filenames in `package.json` and `.github/workflows/release.yml`.

## Safety Rules

- Never commit `.p12` files.
- Never commit Apple passwords.
- Never commit app-specific passwords.
- Never commit API keys.
- Never commit GitHub tokens.
- Keep secrets in GitHub repository secrets only.

## macOS and Linux

Do not publish macOS or Linux assets as supported releases until those platforms can be tested. Experimental CI packaging, if added later, must be clearly labeled as untested and must not be attached to the normal Windows release automatically.
