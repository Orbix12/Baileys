# Security Policy

## Reporting a Vulnerability

Please do not post vulnerability details in public issues, Discord messages, or pull requests before a fix is coordinated. A maintainer-owned public repository and private advisory endpoint have not yet been configured for this source archive. Until one is available, contact the maintainer through a trusted private channel already known to you; do not send auth/session directories, private keys, or account credentials. The owner should enable GitHub Private Vulnerability Reporting after creating the public repository.

Reports should include the affected release/commit, component, impact, and a minimal reproduction. Do not attach auth/session directories, private keys, or account credentials.

## What to include

A useful report contains:

- **Affected versions** (commit SHA or release tag)
- **Component**: socket, signal/crypto, auth state, message decoding, media handling, etc.
- **Impact**: what an attacker can do (read messages, hijack sessions, impersonate, DoS, etc.) and under what preconditions
- **Reproduction**: minimal code, captured stanza, or a deterministic test case. If repro requires a paired account or live connection, describe the setup instead — don't attach session state.
- **Suggested fix** (optional but appreciated)

If a fix touches the wire protocol or signal-protocol session state, please flag that explicitly — those changes need extra coordination because they affect persisted state on every downstream user.

## What we treat as a vulnerability

In scope:

- Auth state / key store leakage or downgrade
- Session, prekey, or sender-key handling that lets a remote party impersonate, replay, or decrypt outside the intended audience
- Memory corruption / RCE via crafted stanzas, media, or protobuf payloads
- Logic bugs that bypass intended access controls (e.g., reading messages from chats the local account isn't part of)
- Vulnerabilities in dependencies that are reachable through Baileys' public API
- Information disclosure (PII, message content, JIDs/phone numbers, tokens) through logs or error messages on default configurations

Out of scope (please file as regular issues or PRs):

- Bugs that only affect availability of the local process (a malformed input that throws an exception in your handler is not a CVE; a malformed input that lets a remote party crash any Baileys client is)
- Issues in third-party WhatsApp clones or forks of Baileys
- Behavior of WhatsApp itself — we don't control the server; report those to Meta
- Missing rate limiting in *your* application — Baileys doesn't add rate limiting on top of WhatsApp's
- Reports that boil down to "the library can be misused for spam." See `CODE_OF_CONDUCT.md` § Project-Specific Conduct; that's a contributions matter, not a vulnerability.

## Coordinated disclosure

Our default timeline:

| Day | Step |
|---|---|
| 0 | Report received, acknowledged within 72h |
| ≤ 7 | Initial assessment shared with reporter; severity and rough timeline agreed |
| ≤ 30 | Fix prepared on a private branch; reporter invited to validate if they want |
| Coordinated date | Fix merged, release published, advisory + CVE published |

If you need to disclose sooner (e.g., active exploitation in the wild), tell us — we'll prioritize accordingly. If a fix is taking longer than 30 days, we'll keep you updated and explain why.

We're happy to credit reporters in the advisory. Tell us how you'd like to be credited (name, handle, organization) or if you'd prefer to remain anonymous.

## Supported versions

The current source line is `1.0.0`. Confirm the npm registry publication status before treating it as a published release. Older source archives may not receive backports. Once a public repository exists, the `main` branch may contain unreleased changes, so production deployments should pin a verified package version.

| Version | Supported |
|---|---|
| `1.0.0` (current source line; registry status must be checked) | Source maintained |
| Earlier versions | No support commitment |

## Operational security for users

A few notes for downstream users — these aren't vulnerabilities in Baileys, but they are common ways production systems leak:

- **`baileys_auth_info/` is equivalent to a long-lived credential.** Store it like an SSH private key. Don't commit it. Don't put it in container images. Encrypt it at rest if you can.
- **Logs leak.** The default logger emits debug-level information that includes JIDs and message metadata. Set `level: 'silent'` or filter aggressively in production.
- **Don't paste auth state into AI tools, screenshots, or support tickets.** It's not redactable — anyone with the directory contents can hijack the session.
- **Pin a release.** Use a tagged release of `@vamxrepan/baileys` in production.

For Baileys upstream documentation, see https://baileys.wiki. Project-specific contact links will be added after the maintainer configures them.
