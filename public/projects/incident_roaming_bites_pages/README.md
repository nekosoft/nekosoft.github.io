# The Page That Was Ours

> **Facilitator material — contains the full solution.** The console deliberately explains nothing
> before a decision is recorded. This document does. Do not circulate it to participants beforehand.

A dependency-free incident-response tabletop for **mixed rooms** — product, support, legal, trust &amp; safety and data alongside engineering. Six phases, eight seats of which the room fills six, and a split before the final decision.

This is a second, independent scenario set at the same fictional company as [The Promotion That Wasn't](../incident_roaming_bites/). It shares that scenario's stylesheet and nothing else. **You do not need to have played the first one.**

## Run locally

From `public/projects/`:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/incident_roaming_bites_pages/`.

Add `?facilitator=1`, or use the control in the lower-left corner, to reveal the facilitator debrief and the fullscreen story reveals.

## The scenario

Roaming Bites has just launched **Campaign Pages**: the Campaign Assistant now publishes merchant landing pages as real public pages on `*.roamingbites.example`, served over the company's own wildcard certificate. An attacker takes over a merchant account, has the Assistant generate a payout-verification page, and telephones other merchants pointing them at it.

The page is real. It is on the genuine domain. Every browser security indicator is telling the truth. That is why it works.

Nobody in the story is incompetent and nobody except the attacker is malicious. The incident is the composition of five ordinary decisions: a product choice, a real false-positive problem, a reasonable-looking threshold change, a well-intentioned reorganisation, and correct-but-generic support advice.

## The console does not explain the incident

Every artifact carries orientation only: what kind of record it is, what its columns mean, what it
cannot show. No screen states a cause, a conclusion or a judgement before the room commits its
decision for that phase. There are no highlighted rows pointing at the answer, no "why this matters"
callouts, and no phase title that gives away its own finding.

Once a decision is recorded, the phase opens a two-column reveal — **what the evidence establishes**
and **what it does not establish** — scoped strictly to that phase, with no forward references. The
consequence ledger and the incident record fill in the same way, so neither can be opened at the
start and read as a walkthrough.

The consequence of that design: **the facilitator needs this document.** With nothing on screen to
prompt from, you are the one who knows what the evidence supports. Read the phase you are about to
run before you run it.


## Why this one is different

The first scenario is a security team's incident — nine genres of log, and if you don't read logs you are a passenger. This one is built so that every phase carries **both** kinds of evidence:

| Phase | Security-team evidence | Everyone-can-read evidence |
| --- | --- | --- |
| 1 · The call | Authentication records, SIEM correlation | Support call transcript, ticket queue, the preserved page |
| 2 · The page | CloudTrail publish path, agent trace | Assistant conversation, the abuse policy, moderation log |
| 3 · The change | CI pipeline, CloudWatch block-rate metric | The diff, the Jira ticket, the Slack thread |
| 4 · The alerts | WAF finding, SNS topic config, alert lifecycle | Reorg announcement, team charters, the unread queue |
| 5 · The scope | CloudFront access logs, DNS and flow records | The DPA, the impact working sheet |
| 6 · The split | Reconstructed log window | Reddit thread, press queries, both room briefs |

The SNS subscription in Phase 4 is the model artifact: 2,847 alerts delivered successfully, zero failures, to a distribution list that has had no members since February. A security engineer reads it as a misconfiguration; anyone in the room reads it as an org chart. Both are right.

## Seats

Eight seats, each decisive at one phase. **The room fills exactly six of them**, so two lenses are always missing — that is the exercise, not a shortfall. A seat's lens reveals what an option **costs**, never what the evidence **says**. All evidence is open to everyone, always.

| Seat | Decisive at | Phase 6 room |
| --- | --- | --- |
| Merchant Support | 1 · The call | B |
| Trust &amp; Safety | 2 · The page | B |
| Software Engineering | 3 · The change | B |
| Product Owner | 3 · The change | A |
| Security Engineering | 4 · The alerts | B |
| Data &amp; Analytics | 5 · The scope | B |
| Legal, Risk &amp; Privacy | 5 · The scope | A |
| CTO / Exec | 6 · The split | A |

**Choose six; two stay empty.** The picker will not let you fill more, and will not let you lock with fewer. Engineering and Security can each be held by a pair, so rooms from four to twelve people still fill six seats.

**Choose the two gaps deliberately.** Leaving Security Engineering out changes what Phase 5 shows; leaving the CTO out closes an option in Phase 6. Pick the absence that will teach this room something, rather than letting it fall out of headcount.

## Unfilled seats have consequences

Not a marker in the debrief. Three tiers:

1. **Nothing is handed to you.** The lens never fires. The evidence is still there; nobody surfaces what it implies.
2. **Later evidence is materially worse.** Without **Security Engineering** at Phase 4, the WAF finding is not triaged and nobody pulls the full CloudFront retention window. Phase 5 then shows a **two-day** window instead of the real **nine** — 3 confirmed records instead of 11. A team with that seat and a team without it read different numbers off the same system.
3. **Options close.** Without the **CTO**, *pull Campaign Pages offline* is unavailable in Room A. Taking the flagship feature down is not the incident team's decision to make.

A **consequence ledger** tracks the collection window, confirmed records, hours to containment and the DPA notification clock, and the final record states what each empty seat cost. It is a record, not a score.

## The split — Phase 6

The strongest part of the session, and it runs off-screen.

- **Room A leaves** — Product Owner, Legal &amp; Risk, CTO. They draft the public statement and decide what Campaign Pages does tonight.
- **Room B stays** — Support, Trust &amp; Safety, Engineering, Security, Data. They decide whether to engage the Reddit thread and what merchants calling in are told.

Twelve minutes, no contact between rooms. Print both briefs from the Phase 6 screen.

While they are apart, **Room B receives a scope finding Room A does not have**. If Security Engineering was absent, Room A is drafting a statement on a two-day incident while Room B now knows it was nine days. Neither room does anything unreasonable. The rejoin is the lesson.

The asymmetry is *temporal, not permanent* — nobody is denied evidence because of their seat, only because of when they were in the room. At the rejoin, everything is shared and the reconciliation view names the contradiction explicitly. Room B can choose to interrupt Room A before they publish; that is the right call, and the console records what it cost them on the public thread.

## Facilitation

- Ten-minute evidence timer per phase, plus five minutes of discussion. A full run with the split is roughly two hours.
- Decisions are four options, all defensible, each with a stated trade-off. There is no correct answer.
- Every phase opens with a plain-language situation banner. In facilitator mode it opens fullscreen for narration and can be replayed from the top bar.
- Phase 1 requires a locked room; every later phase needs the previous decision recorded.
- Decisions, seats and notes are stored only in this browser's local storage, under a key of its own — playing this scenario will not disturb a session of *The Promotion That Wasn't*.
- Use the browser print command for an offline evidence export, and the record's own print view for the incident write-up.

## Evidence discipline

The scenario is built to teach the distinctions that matter:

- A **support call** establishes what a merchant did, not what the system did.
- A **policy document** states intent. Only the threshold is enforcement.
- A **green build** means the assertions that exist passed — the blocking test was deleted in the same commit.
- **Delivered** is not **read**. SNS reported 2,847 successful deliveries to nobody.
- A **POST** is a request, not a victim. Access logs count requests; only the recovered store counts data.
- A **DNS resolution** is not a transfer.
- **"We did not know"** is not **"we were not told"** — the company's own systems recorded this on 5 May, three separate times.

## Safety

All people, companies, merchants, accounts, IP addresses, domains and events are fictional. External domains use the reserved `.example` namespace and every displayed URL is inert. The preserved phishing page is a styled, non-functional copy: its fields are disabled and submit nowhere. There is no working form, exploit, tracking or external dependency anywhere in this directory.
