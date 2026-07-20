# Security Policy

## Supported versions

Security fixes target the current release line. Users should reproduce issues
with the latest tagged build before reporting them.

## Reporting a vulnerability

Report vulnerabilities privately to the repository owner through GitHub's
private security-reporting channel when available. Include the affected Suite
version, browser, game runtime fingerprint, reproduction steps, impact, and a
minimal redacted diagnostic export.

Do not publish working exploits or include passwords, cookies, authorization
headers, session identifiers, private messages, or player/account data. The API
Inspector diagnostic export is designed to redact sensitive fields, but its
output should still be reviewed before sharing.

## Security boundaries

The extension runs on supported Tiberium Alliances pages, requests only Chrome
storage plus the declared game hosts, and injects its runtime into the page
context because ClientLib and Qooxdoo live there. Modules must use scoped
permissions and the compatibility/Hub layers. Consequential actions require an
explicit user gesture and confirmation; excluded unattended automation must not
be introduced.
