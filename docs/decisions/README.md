# Architectural decisions

These records explain approved choices and their evidence. For current behavior, use the [current guides](../README.md); some records include later amendments or describe a superseded implementation.

| Decision                                                                          | Current standing                                                                                                             |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [001 — Deterministic foundation](001-DETERMINISTIC-FOUNDATION.md)                 | Simulation and presentation separation remains active; later records extend the original slice.                              |
| [002 — Match rules](002-MATCH-RULES.md)                                           | Physical/restart foundation remains; 006 sets the current duration.                                                          |
| [003 — Model control and inspection](003-MODEL-CONTROL-AND-INSPECTION.md)         | Paired decisions, validation and provenance remain. Memory, audio, duration and request schemas have later amendments.       |
| [004 — Contact referee](004-CONTACT-REFEREE.md)                                   | Active, with documented rule simplifications.                                                                                |
| [005 — Shorter matches and coordination](005-SHORTER-MATCHES-AND-COORDINATION.md) | Coordination remains; 006 supersedes its two-minute halves.                                                                  |
| [006 — Tactical memory](006-TACTICAL-MEMORY.md)                                   | Current 30-second halves and memory shape; 010 revises memory guidance and decision timing.                                  |
| [007 — Broadcast time](007-BROADCAST-TIME.md)                                     | Active timeline with later nine-second celebration and quiet-audio amendments.                                               |
| [008 — Positional briefs](008-POSITIONAL-BRIEFS.md)                               | Active role guidance; 010 uses a stable request schema in size checks.                                                       |
| [009 — Provider budgets](009-PROVIDER-BUDGETS.md)                                 | Active combined and per-provider estimated ceilings.                                                                         |
| [010 — Carrier choices and requests](010-CARRIER-CHOICES-AND-REQUESTS.md)         | Current carry/pass/shoot guidance, compact memory and request cadence.                                                       |
| [011 — Goalkeeper hand possession](011-GOALKEEPER-HAND-POSSESSION.md)             | Current persistent hand state, distribution, handling histories, timing and replay boundaries.                               |
| [012 — Bounded paired sequences](012-BOUNDED-PAIRED-SEQUENCES.md)                 | One match scheduler for full games and excerpts; scripted provenance, playing-time stops and a shared model-trial allowance. |

| [013 — Catch placement and goal awareness](013-CATCH-PLACEMENT-AND-GOAL-AWARENESS.md) | Legal catch placement, neutral goal geometry and explicit scoring objective; current tackle thresholds retained. |

Add an ADR only when an approved choice constrains future work. Describe the context, decision, principal alternative, consequences, relevant verification and revisit condition. Ordinary filenames and hypothetical systems do not need records.
