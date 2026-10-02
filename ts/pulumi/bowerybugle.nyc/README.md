# The Bowery Bugle

The public site keeps the pink paper and cut-out masthead, with a PDF archive
starting at issues 1–6. There are no fabricated PDFs, transcribed articles,
photographs, or public contact details. Issues without a PDF have no link or placeholder copy. Published PDFs have a
“Read” link. The author can add or delete issue rows independently of PDFs.

## Author publishing

The public archive stays read-only even for signed-in authors. Its footer shows
“Log in” for readers and “Edit” for signed-in authors; both open `/manage.html`.
Both pages
render the same issue-list component. The management page adds per-row upload,
replacement, PDF removal and issue deletion controls after login, plus an
“Add issue” form. Changes take effect immediately; readers see them on their
next load. Removing a PDF retains the issue row; deleting an issue hides the
whole row. Stored PDF versions are retained, and previously issued signed
links can remain usable until they expire (15 minutes). Revision checks prevent
a pending upload from restoring a deleted issue or removed PDF. Deletions of
the initial issues are persisted as tombstones so they do not reappear.

Only the server-configured
`bowerybugle@gmail.com` address can receive a login link. The link carries an
eight-digit SHA-256 TOTP code in its URL fragment and requires a confirmation
click. Codes use fixed 12-hour UTC windows (00:00–12:00 and 12:00–00:00).
The email states the exact window-end timestamp; this is up to 12 hours of
remaining validity, not 12 hours from delivery. Only the current window is
accepted. Reuse within that window is intentional: there are no challenge
records or replay markers, so a link can establish multiple sessions until
expiry. This uses the TOTP calculation with an explicitly replayable policy.

Each deployment owns a persistent KMS HMAC-256 master key. At cold start,
Lambda derives the author seed using HMAC-SHA256 over the site origin, login
purpose and normalized email. The master key stays in KMS; only its identifier
is in Lambda configuration. Staging and production use distinct keys and
origins. The derived seed remains in process memory. No per-request secrets
are stored. Sessions still last seven days, store only token hashes, and use a
Secure, HttpOnly, SameSite=Strict host cookie; logging out revokes that session.
It does not invalidate an emailed code that is still within its window.

Login email is limited to one per minute and ten per hour. Verification is
limited to ten attempts per minute and 100 per 12-hour window. These counters
are shared across Lambda instances. Write requests require the configured
website origin.

The author adds an issue, then uploads a PDF up to 50 MiB on that row. Uploads go directly
to a private S3 bucket using a 15-minute POST policy restricted to one key,
PDF content type, and file size. The backend checks size, type and PDF signature
before publishing. This is file-format screening, not malware scanning.
The archive pins the exact inspected S3 object version, so replaying a still-valid
upload form cannot replace the published bytes. Replacing an issue is explicit
in the upload button; older object versions remain recoverable. Reader links
redirect to short-lived S3 PDF URLs on a separate origin. Publication and upload
consumption are one DynamoDB transaction. PDFs and metadata are separate from
static assets and protected from production stack deletion.

The Go backend follows the repository's Lambda HTTP adapter and OCI image
pattern. The shared Website component proxies `/api/*` to API Gateway with no
caching and forwards the Origin header and session cookie. No authentication
headers, secrets or author email are embedded in the public JavaScript.

## Email setup

Pulumi creates an SES domain identity, verification TXT record and DKIM records
for the active site domain. The sender is `login@<site domain>`. Production also
creates the author's recipient identity; AWS sends a one-time verification
email to the author. The author must accept that verification if SES is still
in its sandbox. Staging reuses that account-wide recipient verification and
never creates another author identity. No Gmail password or mailbox access is
needed. SES permissions restrict delivery to the author address.

This PR does not send login emails or deploy infrastructure. After merge,
confirm the AWS verification email, request a login link on the deployed site,
and publish a real PDF. Actual SES delivery and S3 browser uploads need this
live check; automated tests use isolated mail/storage doubles and signed policies.
See [SES sandbox requirements](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html).

## Domain purchase and launch

Route 53 does **not** register `.nyc`. Do not add a `route53domains.Domain`
resource for this TLD: it would fail production deployment. Registration must
be completed with a supporting registrar in the intended owner's account.
Availability and purchase price still need to be checked with that registrar.

Recommended registrar: **DNSimple**. Its published standard .nyc registration
and renewal price is **US $40.60/year**, with no DNSimple hosting subscription
required for registration. The exact domain's availability and any premium
pricing still require a registrar check. The registry RDAP lookup for
`bowerybugle.nyc` returned 404 on October 1, 2026; this alone does not establish
that the name is registerable or available at standard pricing.

Pulumi now owns purchase and delegation through the DNSimple provider in
account **178973**. Production creates a protected, retained `RegisteredDomain`
with auto-renewal and transfer lock, plus a `DomainDelegation` pointing at the
existing Route 53 nameservers. WHOIS privacy and trustee services are disabled
for .nyc. No premium-price authorization is supplied. DNS records, certificates,
CloudFront and the API stay on AWS. Staging never creates registrar resources,
reads the DNSimple token, or purchases a domain.

Activation is versioned in `boweryBugleProduction` in `ts/pulumi/stack.ts`,
because CI creates temporary Automation API workspaces. Set
`boweryBugleRegistration` to an object containing the intended owner's positive
integer `contactId` and optional `extendedAttributes` map. It is currently
`undefined`, so no purchase occurs. Keep `boweryBugleCustomDomainReady: false`
until public DNS delegation resolves.

The DNSimple Monorepo API token is stored directly in GCP Secret Manager as
version 1 of `bowery-bugle-dnsimple-token` in `extreme-cycling-441523-a9`.
The first production deployment imports and protects that existing container;
secret versions remain managed directly in Secret Manager. Pulumi grants
the existing CI deploy service account access and reads `latest` only when
registration is enabled. The provider input is marked secret so Pulumi encrypts
it in state. No token or registrant address belongs in Git or stack outputs.

Before configuring `boweryBugleRegistration`, complete DNSimple billing, create the intended
owner's registrant contact, confirm .nyc eligibility and any required extended
attributes, and verify the exact domain's availability and price.
Add the registration settings to `boweryBugleProduction` in a PR; after merge,
the production deployment purchases and delegates the domain.
These settings must remain enabled after purchase: the protected resources block
accidental removal. If registration was purchased outside Pulumi, import it
before deployment instead of attempting another purchase.

Registration is disabled until these prerequisites are supplied. This PR does
not purchase the domain or change the live hostname.

Registrar references checked October 1, 2026:

- [DNSimple .nyc pricing](https://dnsimple.com/tlds/nyc-domains)
- [Pulumi RegisteredDomain](https://www.pulumi.com/registry/packages/dnsimple/api-docs/registereddomain/)
- [Pulumi DomainDelegation](https://www.pulumi.com/registry/packages/dnsimple/api-docs/domaindelegation/)
- [DNSimple provider configuration](https://www.pulumi.com/registry/packages/dnsimple/installation-configuration/)

Other sources checked October 1, 2026:

- [AWS supported TLDs](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/registrar-tld-list.html)
- [.nyc registrant nexus policy](https://www.ownit.nyc/assets/doc/pdf/nyc_Nexus_Policy.pdf)
- [.nyc prohibition on proxy registration](https://www.ownit.nyc/policies/nyc-proxy-registration-policy)

The first production deployment creates a protected Route 53 hosted zone and
exports `boweryBugleNameServers`, while serving the site at
`https://bowerybugle.zemn.me`. It remains unindexed until the custom domain is
ready. Staging always uses `https://bowerybugle.staging.zemn.me` in the existing
zemn.me zone, so the merge queue does not depend on registration.

After the registration deployment, DNSimple delegation is set automatically to
`boweryBugleNameServers`. Wait for public delegation, then set
`boweryBugleCustomDomainReady` to `true` in `boweryBugleProduction` in a
follow-up PR. That activates the custom hostname, certificate, SES identity, and
indexing. Do not enable it before delegation: ACM validation would otherwise
block the deployment. No mailbox is provisioned. The printed
email address and telephone number are intentionally omitted from the website.

## Validation

Run `bazel test //project/nyc/bowerybugle/... //ts/pulumi/bowerybugle.nyc/... //ts/pulumi/lib/website/... //:bazel_lint`.
The Go HTTP tests cover login, intentional code reuse, window expiry, throttling, origin checks,
upload rejection, publication, replacement and immutable reads. TOTP tests include the RFC 6238 SHA-256 vectors and exact 12-hour boundaries. SDK tests
inspect signed upload constraints and version-specific object reads. Browser
DOM tests cover login confirmation, publishing, failed-upload retry and logout.
Infrastructure tests cover all domain modes, private versioned storage,
restricted email permissions, and uncached same-origin API forwarding.
