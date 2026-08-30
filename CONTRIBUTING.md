# Contributing to Lumeweft

Thank you for your contribution.

## Before You Begin

- Please read `README.md` for information on setup and the project background.
- If your changes affect packaging, workflows, documentation, or release behavior, please check `RELEASE_CHECKLIST.md`.
- Please keep the scope of your changes focused. Small, easy-to-review pull requests are preferred over large ones containing multiple, mixed changes.

## Proposing Changes

Lumeweft currently has only one maintainer. Therefore, coordination is required before writing code.
- Whether or not a pull request is processed is at the maintainer's discretion.
- We recommend forking the repository first. Please work on new code or fixes in your fork before submitting an issue or pull request.
- You do not need permission to fork the repository.
- For non-trivial changes, please create an issue first. Describe the problem users are facing and your proposed solution; provided the changes do not break existing code, you may then begin coding.
- Please create one pull request per issue and keep the changes within the agreed scope. Do not include additional ideas in an open PR; instead, create a new issue for them.
- Reviews may take a few days. Please refrain from submitting additional pull requests while one of your PRs is still open.
- Pull requests submitted without prior consultation may be closed without a detailed review.
- Contributions regarding translations, typo corrections, or minor documentation fixes are welcome without a prior issue.

## Development Setup

```bash
npm install
npm run electron:dev
```

Helpful commands:

```bash
npm run build
npm run starter-pack:build
```

## Workflow-Related Changes

If you add or change a built-in workflow:

1. Update `src/config/workflowRegistry.js`.
2. Update `src/config/workflowDependencyPacks.js`.
3. Update any Generate UI labels or behavior that depend on the workflow.
4. Run `npm run starter-pack:build`.
5. Review the generated files under `docs/workflow-starter-pack/`.

## Contributor License Agreement

Before opening a pull request, read `CONTRIBUTOR_LICENSE_AGREEMENT.md`.

By submitting a pull request, you confirm that you have the right to contribute the change and that you agree to the Contributor License Agreement. The pull request template includes a checkbox for this confirmation.

If you are contributing on behalf of an employer, client, school, or other organization, make sure you have permission before submitting the contribution.

## Pull Request Guidelines

- Explain the user problem first, then the implementation.
- Include screenshots or short videos for UI changes when possible.
- Mention any platform-specific testing you performed.
- Call out follow-up work or known limitations clearly.

## Quality Bar

Before opening a PR, please:

- Run `npm run build`.
- Smoke-test the area you changed.
- Avoid committing secrets, tokens, private media, or local settings files.
- Update docs when behavior, setup, or onboarding changes.

## Product Guardrails

Unless the maintainers explicitly decide otherwise, keep these product decisions intact:

- ComfyUI is local-only by default.
- LM Studio integration is local-only.
- Generate dependency preflight should stay enabled.
- Starter Pack docs remain the supported setup bridge for advanced ComfyUI users.

## Code of Conduct

By participating in this project, you agree to follow `CODE_OF_CONDUCT.md`.
