# Release Process

Lumeweft currently publishes alpha releases for Windows only.

## Supported release artifact

- Windows x64 NSIS installer

Windows is the only platform currently tested by the Lumeweft project. macOS and Linux packaging configurations remain in the repository for possible experimental GitHub Actions builds, but those platforms are not currently tested, distributed, or supported.

## Alpha release flow

1. Update the version in `package.json` and `package-lock.json`.
2. Add release notes for the version.
3. Update `README.md` when platform or support status changes.
4. Run the production build and Windows installer packaging locally.
5. Commit and push the release changes to `main`.
6. Create and push an annotated alpha tag such as `v0.3.28-alpha.1`.
7. `.github/workflows/release.yml` builds and uploads the Windows installer.
8. Verify that the GitHub release is marked as a prerelease and contains exactly one user-facing installer asset.

The workflow does not publish Windows Portable, macOS, or Linux packages. GitHub's automatic source archives remain available for developers.

## Safety rules

- Never commit certificates, passwords, API keys, or GitHub tokens.
- Do not publish generated packages from `release/` into Git history.
- Do not label macOS or Linux as supported without real platform testing.
- Alpha releases must clearly state that support and warranty are not provided.
