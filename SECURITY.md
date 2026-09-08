# Security Policy

## Supported versions

Security fixes are provided for the latest release and the current `main`
branch.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability.

Use GitHub's private vulnerability reporting feature for this repository. If
that feature is unavailable, contact the repository owner through the email
address listed on their GitHub profile.

Include:

- The affected page, module, or API endpoint.
- Reproduction steps and required input.
- The security impact.
- A minimal proof of concept, when safe to provide.

Do not include real user data, credentials, private deck files, or copyrighted
material that you are not permitted to share.

## Security model

Better YGO is local-first and has no account or cloud-sync backend. The optional
deck-source proxy is restricted to HTTPS YGOPRODeck hosts, validates redirects,
and limits response size. Browser data remains subject to the security of the
device, browser profile, and third-party services selected by the user.
