# Diary knowledge curation

The scheduled worker builds contextual entry analyses and a human-readable wiki
from the entire completed diary. Original audio and transcript segments remain
the source of truth. The existing per-entry analysis still provides provisional
prose and spoken-date inference while the cloud run is pending; it no longer
triggers the recursive day/week/month/year summary pipeline in production.
Existing aggregate summaries remain readable when their evidence is still valid.

## Runtime

Pulumi provisions a separate coordinator Lambda with a five-minute EventBridge
schedule, a two-minute invocation timeout, and reserved concurrency of one.
The coordinator starts at most one new run per hour, only after source changes.
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
same run; terminal/invalid runs are cleaned up before a later hourly retry.

Validated generations live in S3; one DynamoDB pointer publishes the complete
generation. Both publication and all read surfaces check source fingerprints.
New recordings can coexist with the previous generation. Deleting a source or
correcting its date hides the entire previous generation until rebuilt, because
even uncited prose might depend on the changed source. Legacy summaries with
invalid citations are filtered too. Transcripts stay available if analysis
fails. The website and read-only MCP tools use the same publication checks.

Input snapshots are deleted after cleanup; older output generations are kept
for diagnosis/recovery and are never served without source checks. S3 versioning
retains overwritten or deleted object versions for a 30-day recovery window. Diary deletion therefore removes content from live
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

The existing bucket/table names are unchanged; neither is replaced. The bucket
continues to have versioning enabled and no forced bucket destruction. A lifecycle
rule expires only noncurrent versions after 30 days; current objects never expire. These are declarations and local tests, not verification of
live AWS state or an independently verified backup. Before production deployment,
review the Pulumi preview for any replacement/deletion of journal storage and
verify the existing recordings and recovery copies. No production backup or
restore drill has been performed by this PR.

The normal explicit entry-deletion endpoint and existing duplicate-upload
cleanup remain separate from migration; this is not a blanket ban on deletion
through the application. The hosted agent receives no AWS credentials and has
no network access. The coordinator still shares the upload worker's execution
role; the exact-key cleanup check is an application safeguard, not an IAM deny.

## Recovering deleted or overwritten objects

The bucket-wide lifecycle rule covers audio, metadata, transcripts, summaries,
and curation artifacts. Its 30-day clock starts when an object version becomes
noncurrent, not when the recording was created. An ordinary deletion creates a
delete marker while preserving the preceding version. After 30 days, noncurrent
versions become eligible for permanent removal. The rule also applies to existing
historical versions: those already noncurrent for over 30 days may expire as soon
as it is deployed. There is no expiration rule for current objects.

For recovery, use an operator identity to inspect the object's version history,
retrieve and verify the intended version, then copy that version to the same key
to create a new current version. Do not permanently delete historical versions.
This is S3 object recovery, not automatic application rollback: if diary entry
rows were deleted from DynamoDB, they and any content-hash reservations also need
to be recovered consistently. The versioned `metadata.json` files provide entry
metadata; bucket versioning does not enable DynamoDB point-in-time recovery.
Stop affected processing while restoring a consistent set of records and files.

See AWS's [version expiration semantics](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-expire-general-considerations.html)
and [restoring previous versions](https://docs.aws.amazon.com/AmazonS3/latest/userguide/RestoringPreviousVersions.html).

## Configuration and limits

- `JOURNAL_TABLE_NAME`, `JOURNAL_BUCKET_NAME`: existing private diary stores.
- `OPENAI_IDENTITY_PROVIDER_ID`, `OPENAI_SERVICE_ACCOUNT_ID`: existing AWS
  workload identity configuration. The service account additionally needs
  Agents session create/list/read/delete, event write, turn read, and artifact
  read permissions and access to the configured model.
- `JOURNAL_CURATOR_MODEL`: defaults to `gpt-6-astra`.
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
