# The Bowery Bugle

Static issue 6 site based on the supplied September 18, 2026 paper photographs.
The photographs are preserved as supplied; selected stories are transcribed in
HTML and excerpts link to their complete printed source. No browser JavaScript,
third-party fonts, tracking, or external asset service is needed.

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
would otherwise block the deployment. No mailbox is provisioned; the site links
to the email and telephone printed in issue 6.

## Validation

Run `bazel test //ts/pulumi/bowerybugle.nyc/...`. The page test parses the shipped
HTML, verifies local navigation and assets, verifies contact links, and checks
every supplied image. The infrastructure tests cover staging isolation, initial
production, and the delegated custom-domain switch.
