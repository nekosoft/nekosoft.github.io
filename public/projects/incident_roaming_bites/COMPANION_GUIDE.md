# The Promotion That Wasn't

## Story, evidence and cloud-security companion

This guide explains the five-phase Roaming Bites incident from the facilitator's point of view. It describes why each evidence item exists, what participants can reasonably conclude from it, and which generic and AWS controls are relevant.

The scenario is fictional but follows a realistic failure pattern: a legitimate user identity reaches an AI-enabled application, the application gives an agent more data and execution authority than the merchant understands, and several individually reasonable product features combine into a damaging attack path.

## The product

Roaming Bites lets food trucks and restaurants create marketing campaigns. A merchant asks the Campaign Assistant for copy, images and preview pages. Behind the friendly interface, an orchestrator creates a five-minute ECS workspace in which tools can process files and render assets. Merchants can also connect Google Drive so that campaign material can be reused and saved.

The merchant believes they are using a creative assistant. They are not shown that the assistant can retrieve remote files, start processes, install packages or expose a local web server. That gap between the product promise and the technical capability is central to the exercise.

## What actually happened

An attacker obtained the Ember & Olive merchant password outside Roaming Bites. MFA was optional, the merchant had not enrolled, and new-device verification was disabled by default. The attacker signed in successfully from a new IP, device and country.

The attacker first used ordinary product features. They generated campaign material, asked what saved information was available, and explored the short-lived workspace. They then supplied a script hosted on GitHub Raw. The application treated it as a campaign helper, downloaded it and executed it without a separate approval or integrity check.

The script contacted attacker-controlled domains. The root-running workspace installed scanning tools, ran Nikto against its local website, queried accessible metadata and read `/etc/shadow`. Because local files disappeared after five minutes, the attacker used the merchant's existing Drive connection to preserve the Nikto result and phishing assets. The connector also changed the campaign folder to “anyone with the link can view.” In a later workspace the attacker restored the site, exposed it through LocalTunnel and wrote a submitted email address and password to that public folder. An anonymous client then downloaded the submission through the shared link.

Responders suspended the merchant and stopped the active workspace. A previously queued campaign still ran because authorization had been checked when the job was accepted, not when it was executed. The external Drive grant also remained active. Network controls blocked the later callback, but the containment action had not removed every form of authority.

## How to read the evidence

Every evidence item should answer one of four questions:

1. **Identity:** who or what was authenticated?
2. **Authority:** what was that identity, role, token or workload allowed to do?
3. **Activity:** what action was observed, by which telemetry source?
4. **Impact:** what data, system or person was affected?

Do not treat a single log as the complete truth. CloudTrail records supported AWS API activity; it does not record every command inside a container. VPC Flow Logs show network-flow metadata; they do not normally show the URL path or request body. DNS logs show name resolution, not necessarily a successful application transaction. Application and runtime logs can fill those gaps, but only if the product emits them and protects them from alteration.

## Phase 1 — A campaign breaks the baseline

### Companion story

The security team receives a low-severity ticket. Nothing has been published and no harmful external link has been observed. The alert exists because three weak signals occurred together:

- A successful password login came from a first-seen IP, Windows device and country. The account's 90-day history contains only Dutch locations and three known devices.
- Fourteen assets were generated in eight minutes. The merchant normally creates two per day and has never created more than four in a day.
- Four drafts use “Sign in to claim your campaign credit” and contain email and password fields, while the merchant's historical campaigns advertise food and discounts without requesting credentials.

The combined score is 62 against a low-severity threshold of 60. Each fact has a plausible innocent explanation: travel, a new laptop, campaign experimentation or clumsy wording. Their combination justifies investigation, not a declaration that the merchant is compromised.

### Why the evidence exists

| Evidence | Why it is in the pack | What it proves | What it does not prove |
| --- | --- | --- | --- |
| SIEM correlation | Shows how several weak application and identity signals become one reviewable alert. | The threshold was crossed and identifies the contributing events. | That the scoring model is correct or that malicious activity occurred. |
| Authentication detail | Lets responders compare the session with the merchant's history. | Password authentication succeeded from the displayed context. | Who physically controlled the device or how the password was obtained. |
| Campaign chat | Shows that the suspicious wording and high volume came through a legitimate feature. | The session requested 14 drafts, sign-in copy and email/password fields. | Whether any draft was delivered to a victim. |
| Draft-page screenshot | Lets participants compare the generated output with the request and copy heuristic. | The draft imitates a familiar social platform and requests an email address and password. | That the page was published, that anyone received it, or that credentials were submitted. |
| CloudTrail `RunTask` | Connects the application action to creation of an ECS task. | The orchestrator called ECS and tagged the task with merchant and workspace identifiers. | Commands later executed inside the container. |

### Principles under discussion

- Strong authentication and secure defaults
- Risk-based access rather than password success alone
- Behavioural detection with explainable contributing signals
- Correlation across user identity, application object and cloud workload
- Proportionate response: anomaly is not the same as incident

### Controls

| Generic cloud control | AWS implementation example |
| --- | --- |
| Require phishing-resistant MFA or at least a second factor for merchant administration. | Require MFA in the chosen identity provider. With Amazon Cognito, configure MFA and consider threat protection/adaptive authentication. |
| Challenge a new device or risky session before high-impact actions. | Cognito threat protection can evaluate IP, device and geographic context; the application must pass appropriate context and enforce the resulting decision. |
| Detect deviations in login context, object volume and risky copy. | Emit structured application events to CloudWatch Logs, correlate them in the SIEM, and use CloudWatch alarms or EventBridge for selected response workflows. |
| Preserve a stable join key from user action to workload. | Put merchant, request and workspace identifiers into application events and ECS task tags. Record `RunTask` through CloudTrail. Avoid putting personal data or secrets in tags. |

## Phase 2 — When a URL becomes a tool

### Companion story

The attacker gives the assistant a GitHub Raw URL and describes the file as a campaign builder. Retrieving a public file and running Python are each allowed operations. The dangerous behaviour emerges from their composition: user-controlled URL → downloaded bytes → executable file → process start.

GitHub is not classified as malicious. Legitimate hosting can deliver malicious content. The important decision is not only whether the destination is trusted; it is whether unverified remote bytes can cross the data-to-code boundary and execute with the workspace's authority.

### Why the evidence exists

| Evidence | Why it is in the pack | What it proves | What it does not prove |
| --- | --- | --- | --- |
| Campaign chat | Shows the user's intent and the assistant's representation of its action. | The session supplied the URL and approved using the file. | That the user understood it would be executed as code. |
| Agent/tool trace | Shows the model proposed `web.retrieve` followed by `process.start`. | The application authorized and orchestrated both tool calls. | That the model alone owns the security decision. |
| Retrieval record | Establishes where the bytes came from and where they were written. | A response was retrieved from GitHub Raw and saved in the workspace. | That the content was safe because the HTTP request succeeded. |
| Capability policy | Lets engineers examine the permissions that made the chain possible. | Retrieval, package installation, process execution and broad egress were allowed. | That each allowed capability is independently a vulnerability. |

### Principles under discussion

- Treat external content as untrusted regardless of hosting reputation
- Separate data retrieval from code execution
- Validate the complete tool chain, not only individual calls
- Integrity, provenance and approval for executable content
- SSRF protection, including redirects, private ranges and DNS rebinding

### Controls

| Generic cloud control | AWS implementation example |
| --- | --- |
| Use a dedicated fetch service with scheme, host, redirect, response-size and content-type policy. | Isolate the fetcher in its own subnet and IAM role. Use VPC endpoints for required AWS services and a controlled egress path for approved internet destinations. |
| Resolve and validate every destination, including redirects, against private, loopback, link-local and metadata ranges. | Enforce application validation; security groups and network ACLs provide supporting network boundaries but do not understand URLs. |
| Never automatically execute retrieved content. Require an approved artifact, signature or explicit high-friction decision. | Store approved artifacts in controlled S3/ECR/CodeArtifact locations; use digest pinning, ECR tag immutability or AWS Signer where appropriate. |
| Evaluate combinations such as retrieve → write → execute. | Put a policy-enforcement point in the orchestrator. Step Functions can make stages visible, but the application must define and enforce the security rule. |

## Phase 3 — The five-minute workspace

### Companion story

The executed helper calls two attacker-controlled domains. Inside the workspace, the attacker installs tools, scans the local network, runs Nikto against the local website, reads `/etc/shadow` and queries reachable metadata. The workspace expires after five minutes, deleting its local files. The attacker works around that limitation by saving `nikto-results.json` and the site archive to the merchant's connected Drive, then changing the folder to “anyone with the link can view.”

Ephemeral compute reduced the duration of the foothold but did not make it safe. The process ran as root, had a package manager and shell, could reach broad outbound destinations, could see more metadata than intended, and could transfer results into durable SaaS storage. Public sharing makes that storage readable without the merchant session or OAuth token.

### Why the evidence exists

| Evidence | Why it is in the pack | What it proves | What it does not prove |
| --- | --- | --- | --- |
| GuardDuty finding | Supplies an AWS-native reputation signal for a malicious-domain lookup. | AWS associated the finding with the underlying EC2 resource and observed evidence. | Which ECS task or merchant caused it without correlation. |
| Resolver and VPC Flow records | Show DNS queries and accepted or rejected network flows. | The names were resolved and particular network flows were observed. | The full HTTP request, payload or exact process responsible. |
| CloudWatch runtime events | Show process starts, package installation and selected file activity emitted by the workload instrumentation. | The recorded operations occurred in the tagged workspace. | Complete coverage if an attacker could bypass or disable the logger. |
| `/etc/shadow` access event | Makes the consequence of root execution concrete. | A process opened the file. | That useful password hashes were recovered or cracked. |
| Metadata request | Tests workload-to-host isolation. | The container could reach the displayed metadata path. | Automatically, that host credentials were successfully stolen. |
| Drive audit | Separates persistence from public exposure. | The connector uploaded the Nikto result and archive, then changed the folder to anyone-with-link viewer. | Who possessed or used the link at this point. |
| IAM role overview | Lets participants distinguish task role, execution role and orchestrator role. | Which permissions were configured for each role. | Which permissions were exercised; use activity logs for that. |

### Principles under discussion

- Least privilege and separation of task, execution and orchestration roles
- Workload isolation and metadata-service protection
- Non-root execution, minimal images and reduced Linux capabilities
- Default-deny egress and destination-aware controls
- Defence in depth: five-minute lifetime is only one layer
- Durable, tamper-evident forensic evidence outside the compromised workload
- Correlation from EC2 node → network interface → ECS task → workspace → merchant

### Controls

| Generic cloud control | AWS implementation example |
| --- | --- |
| Run as a non-root UID, remove package managers and shells, drop capabilities and make the root filesystem read-only. | Configure the ECS task definition accordingly and build minimal images in ECR. Scan images with Amazon Inspector/ECR scanning. |
| Give each workload only its application permissions. | Use an ECS **task role** with least privilege. Keep the ECS **execution role** limited to image pull, logging and runtime bootstrap. Restrict the orchestrator's `iam:PassRole` resources and conditions. |
| Prevent containers from reaching host credentials and unnecessary metadata. | For ECS on EC2 with `awsvpc`, use `ECS_AWSVPC_BLOCK_IMDS=true` where applicable and harden IMDS. Consider Fargate where its isolation model fits. Validate the design rather than assuming IMDSv2 alone solves container access. |
| Restrict outbound access to required services and ports. | Use task security groups, private subnets, VPC endpoints, a filtering egress proxy, AWS Network Firewall and Route 53 Resolver DNS Firewall as appropriate. Security groups cannot allow-list domain names by themselves. |
| Detect suspicious DNS, process and file activity. | Enable GuardDuty, and where supported GuardDuty Runtime Monitoring; collect Route 53 Resolver query logs, VPC Flow Logs and ECS application/runtime telemetry. |
| Preserve evidence beyond task deletion. | Send logs to a separate security account, protect S3 destinations with restrictive bucket policies and retention controls, and enable CloudTrail log-file integrity validation for CloudTrail evidence. |
| Prevent an automated connector from publishing sensitive artifacts. | Default Drive objects to restricted, deny `type=anyone` permissions in connector policy, require step-up approval for sharing changes and alert on link-readable files. This is an application/Google control rather than AWS IAM. |

## Phase 4 — Public fallout

### Companion story

A second merchant reports a page that looks like a well-known social platform and asks users to sign in. They submitted an email address and password before the page returned an error. A public forum post claims that Roaming Bites AI is hosting phishing. The phishing page was not deployed to the main frontend: a workspace started a local web server and used LocalTunnel to expose it through outbound connectivity.

The page assigns `submission_id=sub_4c81` to the POST and saves the entry as `captured-submissions.ndjson` in the already-public Drive folder. Drive audit then records an anonymous download from an external IP. These are separate evidentiary steps: the POST proves collection, the upload proves storage, the inherited sharing permission proves exposure, and the anonymous download proves retrieval.

The response team must decide how to respond publicly before the merchant has confirmed compromise. One option is to work with Internal Communications on a short holding statement: agree the verified facts, spokesperson, channel and update cadence before publishing. This phase is about customer harm, merchant care, abuse response and communications under uncertainty; containment and recovery decisions remain in Phase 5.

### Why the evidence exists

| Evidence | Why it is in the pack | What it proves | What it does not prove |
| --- | --- | --- | --- |
| Support ticket | Provides first-party harm reporting and the reported URL. | A recipient says they submitted an email address and password. | Whether the system stored or exported it; telemetry must corroborate that. |
| Page screenshot | Shows brand impersonation and requested behaviour. | The reported page visually requested authentication. | Who created it or where it was hosted without corroborating telemetry. |
| SIEM timeline | Connects Drive restore, web server, tunnel, form POST, submission file and anonymous download. | One submission was collected, stored in a public folder and retrieved outside Roaming Bites. | Who controlled the anonymous client or whether the credential was later used. |
| Forum post | Introduces public pressure and incomplete claims. | The allegation is public and attracting attention. | That every claim in the post is accurate. |
| Merchant statement and identity update | Confirms the merchant did not authorize the activity and reveals weak account controls. | The merchant disputes the actions; MFA was not enrolled and the login was new. | Exactly how the attacker obtained the password. |

### Principles under discussion

- Design for abuse cases, not only compromise of the main application
- Outbound connections can create inbound exposure through a tunnel
- Evidence-based public communication and confidence levels
- Customer notification, victim support and takedown coordination
- Shared responsibility across AWS, the application and external SaaS providers
- Data-exfiltration proof: storage, public permission and external retrieval are different events

### Controls

| Generic cloud control | AWS implementation example |
| --- | --- |
| Block unapproved tunnel and dynamic hosting services from production workloads. | Apply DNS Firewall domain lists and controlled proxy/Network Firewall egress rules. Monitor Resolver logs for newly observed destinations. |
| Maintain an abuse-response path for domains, pages and merchant accounts. | Use application suspension controls and automate evidence preservation with EventBridge/Lambda where safe. AWS WAF protects owned inbound applications; it does not block a workload creating an outbound tunnel. |
| Separate confirmed facts, working hypotheses and unknown impact. | Centralize evidence in the incident system or SIEM; use Security Hub to aggregate relevant AWS findings without presenting it as proof of business impact. |
| Preserve reported content safely. | Capture screenshots, headers and hashes in controlled storage. Do not ask responders to browse a live suspected phishing page from their normal device. |
| Prevent credential collection and public export. | Prohibit password fields and submission handlers in generated previews; keep connector outputs private; alert on public-permission changes, sensitive filenames and anonymous downloads. |

## Phase 5 — The session is gone; the job is not

### Companion story

The team suspends the merchant, terminates the live workspace and blocks the known callback domains. A queued job starts afterward. It had been authorized while the merchant session was valid, so the worker does not check the current account state at execution time. The Drive grant remains valid and supplies the stored archive. The public folder permission also remains active, independently of both the merchant session and the connector grant.

This is an authority-and-access lifecycle failure. A user session, queued job, AWS role session, third-party OAuth grant and public object permission have different lifetimes and different revocation mechanisms. “Disable the account” is not a complete containment plan unless the team knows which derived authorities and anonymous access paths survive it.

### Why the evidence exists

| Evidence | Why it is in the pack | What it proves | What it does not prove |
| --- | --- | --- | --- |
| Containment timeline | Shows which response actions succeeded and what happened afterward. | The account and active task were stopped before the later activity. | That all derived sessions, jobs and grants were revoked. |
| Queued-job detail | Exposes authorization being captured at queue time. | The job retained the merchant reference and source asset. | That every job in the platform has the same defect. |
| Later CloudTrail `RunTask` | Shows the orchestrator created a new workspace after suspension. | An AWS API call started the task under the orchestrator role. | That AWS independently decided the merchant was authorized. |
| Connector and sharing state | Shows the external grant and public permission remained usable. | The broker could retrieve the archive and anonymous readers could still access public files. | That revoking Cognito, IAM or OAuth automatically removes the anyone-with-link permission. |
| Blocked DNS event | Demonstrates that one containment control worked. | The known callback lookup was blocked. | That the new workspace was safe or that no other destination was available. |

### Principles under discussion

- Check authorization when work executes, not only when it is requested
- Revoke derived authority and external grants
- Cancel or quarantine queued and scheduled work
- Make containment and recovery conditions measurable
- Verify control effectiveness through evidence, not completion messages

### Controls

| Generic cloud control | AWS implementation example |
| --- | --- |
| Put only identifiers in queued work; resolve current authorization at execution time. | The worker can check a current merchant-status record before calling `RunTask`. IAM authorizes the worker's AWS action; the application must authorize the merchant operation. |
| Support cancellation and quarantine of work by tenant, user and incident. | Model cancellable job state in the queue database. Stop Step Functions executions or delete EventBridge schedules where those services are used; account for messages already in flight. |
| Revoke all application sessions. | With Cognito, use token revocation or `AdminUserGlobalSignOut` as appropriate. Remember that independently verified JWTs require the relying application to enforce revocation or short expiry correctly. |
| Revoke external connectors and public permissions separately. | Revoke the Google OAuth grant at the broker/provider, invalidate cached connector sessions and prevent refresh. Also remove anyone-with-link permissions or quarantine/delete the exposed objects. Neither action is accomplished by an AWS IAM change. |
| Remove active workload authority. | Stop ECS tasks, restrict the orchestrator role or emergency egress path, and investigate existing STS sessions and task credentials. Avoid broad account-wide denial unless the impact is understood. |
| Define recovery gates as queries. | Examples: no runnable jobs or active workspaces; connector grant revoked; no public Drive permissions or anonymous reads for incident objects; no DNS attempts to known indicators for an agreed period; a test job is rejected when the merchant is suspended. |

## Cross-cutting AWS control map

| Security need | AWS services or features | Important limitation |
| --- | --- | --- |
| Authentication risk and MFA | Amazon Cognito MFA and threat protection, or a federated enterprise identity provider | The application must use the risk signal and protect sensitive actions. |
| AWS API audit | AWS CloudTrail and CloudTrail Lake | Does not record arbitrary shell commands or every data-plane action by default. |
| Workload logs | Amazon CloudWatch Logs, ECS log drivers and application audit events | Coverage depends on what the application/runtime emits; logs from a compromised task may be incomplete. |
| Network metadata | VPC Flow Logs | Does not provide full HTTP content or domain names in ordinary flow records. |
| DNS visibility and control | Route 53 Resolver query logging and DNS Firewall | DNS success is not proof of a successful application connection; direct IP access and alternative resolvers need consideration. |
| Threat detection | Amazon GuardDuty and GuardDuty Runtime Monitoring where supported | A finding may identify the EC2 node or workload resource; business/session attribution still needs tags and correlation. |
| Container authorization | ECS task roles, execution roles, IAM conditions and restricted `iam:PassRole` | IAM cannot enforce business-purpose rules that were never modeled by the application. |
| Container hardening | ECS task-definition controls, minimal ECR images, ECR/Inspector scanning, Fargate where suitable | Vulnerability scanning does not prevent legitimate tools from being abused. |
| Data protection | S3 policies/access points, KMS, Macie and CloudTrail data events | These do not decide whether data should be placed in an AI prompt or general-purpose workspace. |
| Egress restriction | Security groups, VPC endpoints, egress proxy, AWS Network Firewall and DNS Firewall | No single layer sees URL, DNS, IP and process context simultaneously. |
| Evidence integrity | Central security account, protected S3 log archive and CloudTrail log-file validation | Integrity controls do not compensate for telemetry that was never collected. |
| Post-incident revocation | Cognito token revocation, ECS task termination and application job cancellation | External OAuth grants and cached authorization require their own revocation paths. |

## What is broken versus what is merely visible

The pack intentionally includes capabilities that are not yet abused. A visible node or permission is not proof of exploitation.

| Condition | Interpretation |
| --- | --- |
| GitHub Raw is contacted | A legitimate hosting service delivered bytes; this alone does not label GitHub malicious. |
| A DNS query reaches a malicious domain | It is a strong detection clue, but DNS alone does not prove successful data exfiltration. |
| The task runs as root and opens `/etc/shadow` | The runtime boundary is weak and the file was accessed; it does not prove a usable password was recovered. |
| The workspace expires | One persistence location was removed; Drive, queued work, logs and external infrastructure have separate lifetimes. |
| The IAM policy permits an action | The action is possible for that role; CloudTrail or service logs are needed to show whether it occurred. |

## Suggested facilitator outcomes

Participants do not need to identify every service or agree on one perfect response. A strong discussion should reach these conclusions:

- The Phase 1 alert is explainable and proportionate. It supports investigation or a step-up challenge, not certainty.
- AI context is a data flow that needs an explicit purpose, schema, consumer and retention decision.
- The most dangerous agent behaviour is often a permitted sequence of tools rather than one obviously forbidden call.
- Ephemeral infrastructure limits persistence but does not limit authority, egress or impact.
- Cloud control-plane, workload, network and SaaS evidence answer different questions and must be correlated.
- Containment must revoke every surviving form of authority and recovery must be proven with observable tests.

## AWS references

- [Amazon Cognito adaptive authentication](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-settings-adaptive-authentication.html)
- [Amazon Cognito token revocation](https://docs.aws.amazon.com/cognito/latest/developerguide/token-revocation.html)
- [IAM roles for Amazon ECS tasks](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)
- [Amazon ECS task and container security best practices](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/security-tasks-containers.html)
- [Amazon ECS EC2 container-instance security considerations](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ec2-security-considerations.html)
- [AWS Fargate security best practices](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/security-fargate.html)
- [AWS CloudTrail User Guide](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-user-guide.html)
- [CloudTrail log-file integrity validation](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-log-file-validation-intro.html)
- [Route 53 Resolver query logging](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resolver-query-logs.html)
- [Route 53 Resolver DNS Firewall](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resolver-dns-firewall.html)
- [Amazon VPC Flow Logs](https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs.html)
- [Amazon GuardDuty finding types](https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_finding-types.html)

## Safety note

All organizations, identities, addresses, domains and events in the game are fictional. The `.example` domains and documentation-style IP addresses are deliberately inert. The pack contains no working phishing form, live exploit or executable payload.
