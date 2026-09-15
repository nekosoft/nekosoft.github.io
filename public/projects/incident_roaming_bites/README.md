# Roaming Bites Incident Console

A dependency-free website for running **The Promotion That Wasn't**, a five-phase incident-response tabletop for groups of four. Teams choose four of six organisational representatives, then use a live People/Data/Evidence/Authority board that reveals simple team effects without changing the shared timeline.

## Run locally

From this directory:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

Open `http://localhost:8080/architecture.html` for the AWS service map plus the interactive attack-path and trust-boundary view. It opens on Phase 1, highlights the services relevant to the selected phase and shows a short clickable path instead of the full incident at once. “All phases” is deliberately the final view.

Open `http://localhost:8080/facilitator.html` for the learning map, phase prompts and official AWS concept links.

The facilitator guide opens with a one-page conversation slide showing how incident response crosses intent, build, deployment, runtime and recovery, plus the essential elements of an incident-response plan.

Open [`COMPANION_GUIDE.md`](COMPANION_GUIDE.md) for the full scenario story, why each evidence item exists, the cloud-security principles under discussion, and generic-to-AWS control mappings.

Open [`LEARNING_OUTCOMES.md`](LEARNING_OUTCOMES.md) for the concise AI, web, cloud and AWS learning outcomes, missing controls and viable design alternatives.

The site can also be opened directly from `index.html`, although a local web server is recommended.

## Facilitation

- Use the ten-minute timer for evidence review.
- Allow another five minutes for discussion.
- After briefing, each group opens a dedicated team-selection step and chooses four organisational representatives from six collectible-style cards. The UI does not reveal where a representative helps until the relevant decision is committed.
- The board is an operating picture, not a score. Evidence-driven markers appear when phases open; decision and role markers appear after commitment.
- The board keeps one incident-response view: People, Data, Evidence and Authority, with known facts, reasonable inferences and missing evidence kept distinct.
- Organisational gaps are also recorded as persistent purple markers in the relevant People, Data, Evidence or Authority lane for the final learning discussion.
- Recording a decision no longer advances automatically. The organisational contribution or gap remains visible below the decision, with separate controls to view the updated operating picture or continue.
- Decisions and notes are stored only in the browser's local storage.
- Phase 1 begins with a low-severity correlation of a first-seen IP/device/country, an asset-generation burst and campaign drafts requesting credentials. None proves compromise on its own.
- Phase 2 follows a GitHub Raw URL from retrieval into Python execution inside the workspace.
- Phase 4 releases the identity evidence only after the public-response choice is locked.
- Phase 5 shows a queued job and Drive grant surviving session termination, then asks for a measurable recovery gate.
- Phase 5 includes an authority-lifetime inventory that distinguishes short-lived tokens, renewable grants, temporary AWS credentials, long-lived access keys and a cached authorization decision that is not itself a credential.
- Every phase begins with a compact, plain-language situation banner above the evidence. It establishes why responders are involved and what they need to investigate, while withholding the cause, technical conclusion and impact for participants to discover. In facilitator mode, the same text opens fullscreen for narration and can be replayed from either the banner or the persistent **↺ Story** control in the top bar.
- The attack-path map sits beneath the state-aware **Live Dashboard** in navigation and is linked from that dashboard. Its sidebar and phase filters expose only phases that have actually opened; **All phases** appears only after Phase 5. The AWS overview uses a compact system-diagram layout with a horizontal core flow, supporting-service row, telemetry band and external-service row. Attack paths read left to right in short rows; longer paths wrap with a labelled continuation instead of requiring horizontal scrolling.
- Phase 1 requires a locked response team; every later phase remains locked until the preceding phase decision is recorded.
- The SIEM-style Live Situation view is an optional overview, not a progression step. It accumulates only metrics, signals and the known/inferred/unknown assessment available through the latest opened phase.
- Every phase includes a six-node evidence correlation path that highlights the relevant parts of the wider system. Each evidence tab defines the type of system being viewed, then gives a short activity and “look for” explanation for participants who are new to cloud or security logs.
- The **Incident summary** is hidden until the first phase opens. It then grows only from phases actually opened, decisions actually recorded and role effects actually revealed, so it can be used as a live incident record without exposing later injects. It includes trigger, detection, impact, resolution, contributing conditions and candidate action items, and has a summary-only print view.
- Add `?facilitator=1` to the URL, or use the control in the lower-left corner, to reveal the facilitator debrief.
- Use the browser print command for a simple offline evidence export.

## Evidence sources represented

- Roaming Bites SIEM correlation view
- CloudTrail ECS API event
- CloudWatch Logs Insights runtime records
- VPC Flow, DNS resolver and HTTP egress records
- GuardDuty phishing-domain finding
- VirusTotal and urlscan-style cached enrichment
- Google Workspace Drive audit
- Drive permission changes and anonymous-link downloads
- Connector grant status and queued-job authorization records
- Application authentication records
- IAM role and policy overview
- Clickable architecture and attack-path diagram
- Facilitator learning guide with official AWS documentation links

CloudTrail is used only for AWS API activity. Commands inside the workspace are shown as application-emitted runtime events in CloudWatch, while network and SaaS events use their corresponding sources.

GuardDuty is represented as attributing the DNS reputation finding to the underlying EC2 node. Participants must use the ECS task, ENI address and workspace tags to correlate it to the short-lived container. VirusTotal and urlscan appear as separate SIEM enrichment sources; neither is presented as a source used internally by GuardDuty.

The GitHub Raw event remains part of the evidence. GitHub is treated as legitimate hosting used to deliver `render-campaign.py`; the observed sequence then shows that file being invoked before the workspace calls back to two suspicious domains. The timing is evidence of a likely relationship, not proof of process-level causation.

Google Drive is both persistence and an exfiltration channel in the later phases. The evidence separately records the Nikto result and site archive being uploaded, the campaign folder changing to anyone-with-link access, a credential submission being written into that folder, and an anonymous client downloading it. Revoking the OAuth grant stops future connector actions but does not by itself remove the existing public permission.

## Reference behavior

- [Google SRE example postmortem](https://sre.google/sre-book/example-postmortem/)
- [Google SRE postmortem culture](https://sre.google/sre-book/postmortem-culture/)
- [Amazon GuardDuty EC2 finding types](https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_finding-types-ec2.html)
- [VirusTotal domain objects](https://docs.virustotal.com/reference/domains-object)
- [urlscan API documentation](https://urlscan.io/docs/api/)

## Facilitator technical answer deck

Open `technical-answer-sheet.html` in a separate tab. It gives a slide-by-slide, field-level explanation of selected CloudTrail, GuardDuty, IAM, application, runtime, network, Drive and authorization evidence. It is linked from the facilitator guide and the facilitator-only debrief, but deliberately omitted from participant navigation so teams can interpret evidence before answers are revealed.

## Safety

All people, companies, accounts, IP addresses and events are fictional. The suspicious domain uses the reserved `.example` namespace and all displayed URLs are inert. Threat-intelligence results are synthetic evidence props. The website contains no working phishing form, exploit or external dependency.
