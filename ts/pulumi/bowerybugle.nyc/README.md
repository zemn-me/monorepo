# The Bowery Bugle

Static issue 6 site based on the supplied September 18, 2026 paper photographs.
The supplied photographs are visual references only and are not published.
Selected stories and excerpts are transcribed in HTML. Keep editorial copy
faithful to the zine; do not add taglines, summaries, or promotional headings.
No browser JavaScript,
tracking or external asset service is needed. Blackletter initials use a locally
served Manufacturing Consent font, with its SIL Open Font License included.
It is a visual approximation; the original printed typeface is not confirmed.
Bazel generates `public/drop-caps.css` from that font using
`//go/font/cmd/glyphcss`. The same SVG outline paints each initial and supplies
its CSS wrapping shape. Letters remain in the HTML text for accessibility and
copying; no browser JavaScript is needed. Preview the built public directory so
the generated stylesheet is included.

Font source: [Google Fonts, revision 4e5f06d](https://github.com/google/fonts/tree/4e5f06dbb274a27ebe71ed54ea706b3ee40eabd9/ofl/manufacturingconsent).

## Domain purchase and launch

Route 53 does **not** register `.nyc`. Do not add a `route53domains.Domain`
resource for this TLD: it would fail production deployment. Registration must
be completed with a supporting registrar in the intended owner's account.
Availability and purchase price still need to be checked with that registrar.

Sources checked October 1, 2026:

- [AWS supported TLDs](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/registrar-tld-list.html)
- [.nyc registrant nexus policy](https://www.ownit.nyc/assets/doc/pdf/nyc_Nexus_Policy.pdf)
- [.nyc prohibition on proxy registration](https://www.ownit.nyc/policies/nyc-proxy-registration-policy)

The first production deployment creates a protected Route 53 hosted zone and
exports `boweryBugleNameServers`, while serving the site at
`https://bowerybugle.zemn.me`. It remains unindexed until the custom domain is
ready. Staging always uses `https://bowerybugle.staging.zemn.me` in the existing
zemn.me zone, so the merge queue does not depend on registration.

After registering `bowerybugle.nyc`, set its registrar nameservers to the
production stack's `boweryBugleNameServers` output. Wait for public delegation,
then set `boweryBugleCustomDomainReady: true` on the production component in
`ts/pulumi/stack.ts` in a follow-up PR. That activates the custom hostname,
certificate, and indexing. Do not enable it before delegation: ACM validation
would otherwise block the deployment. No mailbox is provisioned. The printed
email address and telephone number are intentionally omitted from the website.

## Validation

Run `bazel test //ts/pulumi/bowerybugle.nyc/...`. The page test parses the shipped
HTML, verifies local navigation, and checks that contact details and the supplied
photographs are not published. The infrastructure tests cover staging isolation, initial
production, and the delegated custom-domain switch.
