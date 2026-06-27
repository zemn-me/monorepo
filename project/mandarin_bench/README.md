# MANDARIN BENCH

MANDARIN BENCH is an essay benchmark based on the 1904 Guangxu 30 Jiachen Enke,
the final Qing imperial examination round before the examination system was
abolished in 1905.

The benchmark does not pretend that these essays have a deterministic answer
key. It provides:

- candidate prompts for the historical exam questions
- judge prompts with a fixed 0-5 rubric
- deterministic score aggregation into pass and rank bands

Run it with Bazel:

```sh
bazel run //project/mandarin_bench:cli -- candidate-prompts
bazel run //project/mandarin_bench:cli -- judge-prompts \
  --answers=$(pwd)/project/mandarin_bench/runs/answers.jsonl
bazel run //project/mandarin_bench:cli -- score \
  --judgements=$(pwd)/project/mandarin_bench/runs/judgements.jsonl
```

To run candidate answers through OpenAI models, set `OPENAI_API_KEY` or pass an
API key file. By default this fetches every model available to the key and tries
each reasoning effort: `none`, `minimal`, `low`, `medium`, `high`, and `xhigh`.
Unsupported model/effort pairs are written as `ok: false` JSONL rows.
Runs are parallelized with a conservative default concurrency of 4; use
`--concurrency=1` for serial execution or raise it if your rate limits allow it.

```sh
OPENAI_API_KEY=... bazel run //project/mandarin_bench:cli -- run-openai \
  --out=$(pwd)/project/mandarin_bench/runs/mandarin_openai_results.jsonl
```

To run every model available to the key on only low and medium reasoning effort:

```sh
bazel run //project/mandarin_bench:cli -- run-openai \
  --efforts=low,medium \
  --timeout-ms=900000 \
  --resume \
  --retry-transient \
  --out=$(pwd)/project/mandarin_bench/runs/openai_all_models_low_medium.jsonl
```

Useful smaller runs:

```sh
bazel run //project/mandarin_bench:cli -- run-openai \
  --api-key-file=$(pwd)/openai.key \
  --model-regex='^(gpt|o)' \
  --efforts=low,xhigh \
  --concurrency=8 \
  --question-ids=metropolitan-history-centralization \
  --out=$(pwd)/project/mandarin_bench/runs/mandarin_openai_results.jsonl

bazel run //project/mandarin_bench:cli -- run-openai \
  --models=gpt-5.1,gpt-5.1-mini \
  --efforts=all \
  --limit-questions=1 \
  --dry-run
```

The OpenAI results file can be fed into `judge-prompts`; rows without an
`answer` are ignored.

To grade generated answers through OpenAI, use `judge-openai`. It defaults to
`gpt-5.5` as the judge model and `medium` reasoning effort.

```sh
bazel run //project/mandarin_bench:cli -- judge-openai \
  --answers=$(pwd)/project/mandarin_bench/runs/openai_all_models_low_medium.jsonl \
  --resume \
  --out=$(pwd)/project/mandarin_bench/runs/judgements_gpt_5_5_medium.jsonl
```

CSV exports for graphing and analysis:

```sh
bazel run //project/mandarin_bench:cli -- analysis-bundle \
  --results=$(pwd)/project/mandarin_bench/runs/mandarin_openai_results.jsonl \
  --judgements=$(pwd)/project/mandarin_bench/runs/judgements.jsonl \
  --out-dir=$(pwd)/project/mandarin_bench/runs/mandarin_analysis
```

That writes:

- `questions.csv`: static question metadata
- `sources.csv`: source metadata
- `criteria.csv`: scoring rubric criteria
- `openai_results.csv`: raw model/effort/question run data
- `judge_scores.csv`: per-question judge scores
- `score_summary.csv`: graph-ready model/effort aggregate scores

`score_summary.csv` is usually the graph input: one row per model and reasoning
effort, with `percent`, `coverage`, `passed`, and rank `band`.

`answers.jsonl` lines look like:

```json
{"question_id":"metropolitan-history-centralization","model":"example-model","answer":"臣对：..."}
```

Human-authored controls are kept separate from model runs because they may cover
only one question rather than the full fourteen-question exam. The current
control files are:

- `runs/human_controls.jsonl`: Liu Chunlin's 1904 human answer, marked with
  `"control": true`
- `runs/human_control_judgements_gpt_5_5_medium.jsonl`: `gpt-5.5` medium judge
  output for that control
- `runs/human_control_judge_scores_gpt_5_5_medium.csv`: per-question score CSV
- `runs/human_control_score_summary_gpt_5_5_medium.csv`: aggregate summary,
  intentionally marked incomplete because the control covers only one question

Judge-score and score-summary CSVs include a `control` column so human-authored
controls can be filtered out of model rankings or analysed separately.

`judgements.jsonl` lines look like:

```json
{"question_id":"metropolitan-history-centralization","scores":{"historical_grounding":4,"question_responsiveness":4,"statecraft_reasoning":4,"classical_register":4,"period_discipline":4},"notes":"..."}
```
