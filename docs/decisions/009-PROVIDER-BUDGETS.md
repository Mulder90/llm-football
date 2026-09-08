# Decision 009 — Separate provider spending ceilings

Status: accepted with the user's approval of the cleanup and broadcast-polish pass before another paid match.

## Decision

Keep the existing combined USD estimate ceiling and permit an additional cap for each provider. The generator and fixed-situation evaluation reserve every concurrently dispatched request plus its permitted repair attempts, grouped by provider, before starting any request at that boundary. Stop and checkpoint an incomplete result if either provider or the combined ceiling cannot fund the full reservation. A depleted provider never leaves the other team making an unmatched paid decision.

Reserve input conservatively using the existing maximum input-byte count as a token upper estimate, plus the output-token limit. Replace each receipt's reservation with reported usage when available. A failed or cancelled request without reported usage keeps the full reservation. Generation derives provider totals from receipts; evaluation sums receipts across every tested model from that provider. Retain both caps and provider totals in run provenance/reporting.

CLI flags are `--openai-usd` and `--gemini-usd`. Generation also accepts `GENERATION_MAX_OPENAI_USD` and `GENERATION_MAX_GEMINI_USD`. Zero forbids dispatch; omitted caps add no constraint beyond the combined ceiling. These are optional run constraints, not a recording-version migration. All values are USD. Exchange rates, actual account balances and provider prices must be checked separately before a future run; the runner does not query or store credit balances.

## Alternatives and limits

A combined ceiling alone cannot protect a smaller provider balance. A separate external polling guard can react only after some requests are already in flight. Pre-dispatch paired reservations put the constraint at the existing scheduling boundary without another process, database or asynchronous budget ledger.

The caps bound the application's conservative estimates, not the provider's final invoice. Existing request, retry, input and output bounds still apply. No provider configuration, pricing assumption or football decision policy changes in this slice.

## Verification and revisit

Offline tests cover either provider being unable to fund a repair, multiple evaluation models sharing a provider, exhaustion after repairs, unknown usage on cancellation and external provenance validation. Existing public recordings replay unchanged. Revisit if generation gains resumable jobs or dynamically selected providers; do not introduce that machinery in advance.
