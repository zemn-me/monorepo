# Diary knowledge curation

The scheduled worker builds contextual entry analyses and a human-readable wiki
from the entire completed diary. Original audio and transcript segments remain
the source of truth. Uploads only transcribe; the scheduled agent supplies entry
prose. Recording timestamps come from upload metadata or embedded audio metadata,
without a separate spoken-date inference call. The recursive day/week/month/year
summary pipeline does not run in production.
Existing aggregate summaries remain readable when their evidence is still valid.

## Runtime

Pulumi provisions a separate coordinator Lambda with a five-minute EventBridge
schedule, a two-minute invocation timeout, and reserved concurrency of one.
The coordinator starts one initial run per 24-hour window, only after source
changes. Failed attempts count toward a maximum of three attempts in that window
(one initial attempt and two retries), spaced at least an hour apart. Success
prevents further starts until the window expires, even if new recordings arrive.
The window starts with the initial attempt and survives cleanup and restarts.
It submits an asynchronous hosted session through the beta OpenAI Agents API,
then returns. Later invocations collect the output and retire the session.
No diary contents are committed to Git or attached to a coding repository.

Each immutable corpus contains all ready transcripts, valid provisional and
legacy summaries, the previous published wiki and analyses, and the output
schema. The sandbox can search this file with shell/Python. Network access and
subagents are disabled; it receives no application credentials. It returns one
complete JSON generation at `/workspace/outputs/journal.json`.

The curator is prompted to create pages for recurring entities (two dates), or
an entity with substantial enduring significance. It preserves page UUIDs and
aliases, distinguishes ambiguous identities, explains later clarifications, and
links mentions to `/journal?wiki=UUID`. This is a model heuristic, not a hard
entity-count rule. Quotes always retain the original transcription, even when
the prose explains a likely transcription error.

The importer checks complete entry coverage, unique IDs, page kinds, links,
footnote indices, and exact `(entryId, segmentId, quote)` evidence against all
original segments. Every entry must cite its own recording and may cite any
other date. Citation validation proves provenance, not that a model's inference
is correct. Invalid or partial output is never published.

## Writing guidance

Provisional entry analyses, legacy summaries, and cloud curation share
`journalWritingInstructions`. It adapts Wikipedia's
[Words to watch](https://en.wikipedia.org/wiki/Wikipedia:Manual_of_Style/Words_to_watch)
and [Writing better articles](https://en.wikipedia.org/wiki/Wikipedia:Writing_better_articles):
concrete facts, concise prose, attributed opinions, precise dates, and headings
that describe the content. Avoid inflated significance, vague attribution,
repetitive caveats, and invented narrative arcs. Preserve the speaker's feelings
and recollections with attribution, and keep citation quotations exact. Public
notability and independent-source requirements do not apply to this private diary.

The hosted curator additionally receives `journalWikiWritingInstructions`, adapted
from Wikipedia's core content policies and article structure guidance:

- [Neutral point of view](https://en.wikipedia.org/wiki/Wikipedia:Neutral_point_of_view):
  distinguish reported events from attributed views, including secondhand accounts.
  Preserve subjective experience without endorsing it or inventing a counterargument.
  Allocate coverage across the diary's history rather than letting a recent or dramatic
  recording dominate; repeated retellings are not independent corroboration.
- [Verifiability](https://en.wikipedia.org/wiki/Wikipedia:Verifiability):
  each cited passage must support the actual claim in context, including its identity,
  timing, certainty, and scope. A genuine quotation on the same topic is insufficient.
  Here the original diary is the source; public publication and independent sourcing
  requirements do not apply.
- [No original research](https://en.wikipedia.org/wiki/Wikipedia:No_original_research):
  combine supported developments across dates without inventing a causal explanation,
  diagnosis, or relationship. Report the speaker's interpretations as interpretations;
  hedging does not make an unsupported inference suitable for publication.
- [Lead sections](https://en.wikipedia.org/wiki/Wikipedia:Manual_of_Style/Lead_section):
  start with a concise overview identifying the subject and its place in Thomas's
  life. Leads carry citations and preserve qualifications just like the body.
- [Summary style](https://en.wikipedia.org/wiki/Wikipedia:Summary_style):
  organize longer pages by subject and useful chronology, with descriptive headings;
  summarize and link related subjects without duplicating whole accounts. Short pages
  do not need artificial sections.

The evidence and attribution guidance also applies to contextual entry analyses;
the page structure guidance does not replace their narrative form. These rules do
not impose public notability thresholds or permit outside research. They preserve
the journal's existing page-eligibility heuristic, exact quotes, and personal scope.

The curator reviews reused prose against this guidance as well as its sources.
Bump `journalCurationVersion` when changing the writing policy so an unchanged
archive becomes eligible for a fresh scheduled generation. The calendar remains
recording navigation; only entities have wiki pages. Local review fixtures are
authored examples, not evidence of model writing quality. Evaluate live prose
separately after deployment; these tests do not spend tokens to grade style.

## Consistency and failure recovery

The DynamoDB `CURATION` item has a conditional version and expiring lease.
Persist the run and session IDs before sending an input event. Input events
use a durable `Idempotency-Key` through the SDK; session creation sends no
input, so recovering an uncertain creation does not duplicate inference.
Cleanup includes sessions recovered by run metadata, cancels active work, and
deletes sessions. Runs time out after two hours. Transport failures retry the
same run without reserving another attempt; terminal/invalid runs are cleaned up
before a retry within the daily budget. Source changes and timeouts also consume
the reserved attempt.

Validated generations live in S3; one DynamoDB pointer publishes the complete
generation. Both publication and all read surfaces check source fingerprints.
New recordings can coexist with the previous generation. Deleting a source or
correcting its date hides the entire previous generation until rebuilt, because
even uncited prose might depend on the changed source. Legacy summaries with
invalid citations are filtered too. Transcripts stay available if analysis
fails. The website and read-only MCP tools use the same publication checks.

Input snapshots are deleted after cleanup; older output generations are kept
for diagnosis/recovery and are never served without source checks. S3 versioning
can retain deleted objects. Diary deletion therefore removes content from live
read surfaces, not every historical storage version or provider retention copy.

## Preservation during migration

The first backfill reads existing ready entries and writes only new `curation/`
objects and the `CURATION` checkpoint. It does not retranscribe audio, update
entry rows, replace stored summaries, or delete original objects. Published
analyses overlay summaries on reads. Legacy calendar summaries remain stored
but are hidden by the calendar UI when curation is enabled.

Cleanup accepts only `curation/runs/<run UUID>/input.json` for its own run;
unexpected checkpoint keys fail before any cleanup. Regression tests compare
all original audio, metadata, transcripts, summaries, content-hash reservations,
and entry records before and after successful publication, invalid output,
agent failure, and timeout. They also observe every object write and deletion.

The existing bucket/table names and storage resources are unchanged. The bucket
continues to have versioning enabled and no expiration lifecycle or forced
bucket destruction. These are declarations and local tests, not verification of
live AWS state or an independently verified backup. Before production deployment,
review the Pulumi preview for any replacement/deletion of journal storage and
verify the existing recordings and recovery copies. No production backup or
restore drill has been performed by this PR.

The normal explicit entry-deletion endpoint and existing duplicate-upload
cleanup remain separate from migration; this is not a blanket ban on deletion
through the application. The hosted agent receives no AWS credentials and has
no network access. The coordinator still shares the upload worker's execution
role; the exact-key cleanup check is an application safeguard, not an IAM deny.

## Configuration and limits

- `JOURNAL_TABLE_NAME`, `JOURNAL_BUCKET_NAME`: existing private diary stores.
- `OPENAI_IDENTITY_PROVIDER_ID`, `OPENAI_SERVICE_ACCOUNT_ID`: existing AWS
  workload identity configuration. The service account additionally needs
  Agents session create/list/read/delete, event write, turn read, and artifact
  read permissions and access to the configured model.
- `JOURNAL_CURATOR_MODEL`: defaults to `gpt-6-astra`.
- `OPENAI_CURATOR_API_KEY`: optional dedicated credential for Agents curation.
  When absent, curation uses workload identity. Audio transcription continues using
  workload identity in either case.
  Production Submit reads `github-actions-openai-curator-api-key` from GCP
  Secret Manager and supplies it only to the curator Lambda, marked as a
  Pulumi secret. Staging, upload workers, and public API Lambdas do not receive
  this key. It never enters the hosted sandbox.
- `JOURNAL_CURATION_ENABLED=true`: disables hierarchical refresh in API flows.
  The production journal worker always uses the curator for scheduled events.

The complete document is limited to 48 MiB, and the gzipped corpus to 9 MiB.
It is split into inline files below 4 MiB each. Oversized histories fail
explicitly; they are never silently truncated. Larger histories require a
different corpus transport before raising these bounds. The current approach
revisits the full archive after changes; it does not implement incremental
entity dependency tracking or a hard per-run token budget.

Check Lambda errors and the journal's `curation.status` when a run stalls. A
successful local fixture test does not establish production Agents entitlement
or workload-identity permissions. Verify those with a deployed run before
considering rollout complete. This PR's tests use deterministic fixtures and
the real generated SDK against a simulated HTTP service; they do not upload
the private diary to a live agent.

Before deploying the API-key fallback, create and seed the secret in GCP project
`extreme-cycling-441523-a9`, and grant `roles/secretmanager.secretAccessor` on
that secret to the existing GitHub WIF principal set with
`attribute.workflow_scope/submit`. Submit reads the value before Pulumi runs;
the deployment then adopts the secret container and manages that binding.
Use a restricted OpenAI project key with Agents read/write, Responses write,
and List models read. Rotate it by adding a new GCP secret version and running
Submit; the Lambda receives the value at deployment time. To restore workload
identity, remove the dedicated key from the curator's deployment configuration.

API reference: [Agents API overview](https://developers.openai.com/api/docs/guides/agents-api/overview).

## Local verification

The development journal's **Add sample entries** control also runs a
deterministic curator through the production importer. The wiki browser test
uses this control, searches for Maya, opens her page and follows an audio
citation. It saves desktop and phone screenshots as test outputs.

Run Bazel tests for `//project/me/zemn/api/server/...`,
`//project/me/zemn/api/cmd/localserver/...`, `//project/me/zemn/app/journal/...`,
`//project/me/zemn/hook/...`, and `//ts/pulumi/testing/...`.
Run `//project/me/zemn/testing:integration_test --test_filter=TestJournal`
for browser coverage and build `//project/me/zemn:build` for static export.
