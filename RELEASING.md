# Releasing

## How to release a new version

```bash
# 1. Bump version in package.json
# 2. Commit the version bump
git add package.json
git commit -m "Bump version to 1.X.Y"

# 3. Tag and push — CI handles the rest
git tag v1.X.Y
git push origin master v1.X.Y
```

CI will automatically:
1. Create the GitHub Release with notes from the commit log
2. Build `.zip` for both arm64 and x64
3. Upload both artifacts to the release
4. `update-electron-app` picks it up for auto-update to existing users

## Rules

- **Never run `gh release create` manually.** Doing so creates an empty release with no artifacts, which blocks the auto-updater for all users on older versions.
- **Never skip the tag push.** The release workflow only triggers on `v*` tag pushes.
- **Always bump `package.json` before tagging.** The version in the binary must match the tag.
- **Don't reuse a tag.** If a build fails, delete the tag and release, fix the issue, then re-tag.

## Fixing a failed release

```bash
# Delete the broken release and tag
gh release delete v1.X.Y --yes
git push origin --delete v1.X.Y
git tag -d v1.X.Y

# Fix the issue, commit, then re-tag
git tag v1.X.Y
git push origin master v1.X.Y
```

## Code signing (optional)

Builds work without signing (unsigned app). To enable signing and notarization, add these repository secrets in GitHub Settings > Secrets:

| Secret | Value |
|---|---|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` Developer ID certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12` |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID` | Your Apple ID email |
| `APPLE_ID_PASSWORD` | App-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | Your 10-char team ID |
