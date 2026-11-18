# Security policy

If you find a security problem in MyPasswordCreator, please report it privately so it can be fixed before it's public.

## How to report

Use GitHub's private vulnerability reporting: go to the **Security** tab of this repository and click **Report a vulnerability**. Only the maintainer sees the report.

Please don't open a public issue for a security problem.

Useful things to include:

- what you found and where (file, page or URL)
- steps to reproduce it
- what an attacker could do with it

## What to expect

- An acknowledgment within 7 days.
- A fix, or an explanation of why it isn't one, as soon as practical. Problems that could expose a password come first.
- Credit in the fix's commit message, if you'd like it.

## Scope

In scope: this repository's code and the live site at mypasswordcreator.com, for example weak or biased randomness, anything that sends a generated or checked password off the device, CSP gaps, XSS, or CSV/formula injection in the bulk export.

Out of scope: rate limits and availability of Have I Been Pwned (a third-party service), problems that need an already-compromised device or browser, and missing security headers that don't lead to a real attack.

This is maintained by one person, in the open. Thank you for helping keep it trustworthy.
