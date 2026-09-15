# Roaming Bites incident: security learning outcomes

This is the short learning guide for **The Promotion That Wasn't**. It focuses on the security decisions exposed by the evidence rather than retelling the incident.

## Key learning moments

### One operating picture

- **People:** who is affected, who must respond, and who needs support or communication.
- **Data:** what information was accessed, moved, retained, exposed or put at risk.
- **Evidence:** which records support the incident story and which conclusions remain uncertain.
- **Authority:** which sessions, roles, grants or stored decisions allowed each action.
- One observation can update several lanes. An `/etc/shadow` read concerns Data, Evidence and Authority; a merchant report concerns People and establishes public impact.
- Keep **known, inferred and missing** information distinct. Root inside the container is observed, but a lower-to-higher privilege transition is not.

| Phase | Participants should learn to… | Main question |
| --- | --- | --- |
| 1 — Behaviour alert | Correlate several weak signals without treating an anomaly as proof of compromise. | Does a new country, asset burst and credential-seeking draft justify monitoring, step-up authentication or suspension? |
| 2 — URL to tool | Evaluate the full action chain, not each permitted tool in isolation. | Should user-controlled bytes ever move directly from retrieval to execution? |
| 3 — Workspace abuse | Test whether an “ephemeral sandbox” limits privilege, egress and public connector actions. | What can the process reach or publish during its five-minute lifetime? |
| 4 — Public impact | Correlate collection, storage, public sharing and retrieval before declaring exfiltration. | What data left, what proves it, and who needs protection now? |
| 5 — Surviving authority | Revoke every derived form of authority and prove recovery with tests. | Which sessions, jobs, role credentials and OAuth grants survive account suspension? |

## AI and agent security outcomes

| Gap exposed by the scenario | Security concept | Better alternatives |
| --- | --- | --- |
| Retrieval, file writing and process execution are individually allowed. | Excessive agency and unsafe tool composition | Deny dangerous sequences such as retrieve → write → execute; give each job a small tool set; use structured business tools instead of a general shell; require independent policy evaluation before execution. |
| A GitHub Raw file is treated as a campaign helper and executed. | Untrusted external content and supply-chain provenance | Retrieve for inspection only; use approved artifact repositories; require a known digest or signature; scan and quarantine content; never infer trust from a reputable hosting domain. |
| The workspace runs arbitrary commands as root and can install packages. | Least privilege for agent tools and runtime | Run a purpose-built renderer as a non-root user; remove the package manager and shell; make the root filesystem read-only; allow only explicit commands and paths. |
| The agent can save a Nikto scan and site archive to Drive, make the folder public and reuse it later. | Memory, persistence, sharing and cross-session trust | Bind artifacts to merchant, job, origin and expiry; scan before reuse; default connector outputs to private; deny public-link permissions unless a separately authorized product flow requires them. |
| The user sees a creative assistant but the system exposes code execution, network and connector capabilities. | Meaningful human oversight | Show an action preview for external retrieval, execution, sharing and publishing; require step-up authentication for externally visible or security-sensitive actions; let users cancel work. |
| Logs show tool calls, but no single record contains the complete chain. | Agent observability | Record request/session ID, tool, normalized parameters, policy result, approval ID, execution result and destination. Redact secrets and personal data; do not rely on hidden model reasoning as an audit trail. |
| Generated content contains a credential form. | Output handling and abuse prevention | Detect credential fields, brand impersonation and login language; block or route for review; prevent campaign tools from generating functional password collection; test abuse cases before release. |

Relevant OWASP themes include Prompt Injection, Sensitive Information Disclosure, Supply Chain, Improper Output Handling, Excessive Agency and Unbounded Consumption. The strongest mapping in this scenario is **Excessive Agency**: normal capabilities combine into behaviour outside the product's intended purpose.

## Traditional web and application security outcomes

| Gap exposed | What participants investigate | Possible controls |
| --- | --- | --- |
| Password-only login; MFA and new-device alerts are optional. | Account takeover, credential reuse and secure defaults | Require MFA or passkeys; breached-credential checks; risk-based challenges; notify merchants of new devices; step-up authentication before connector, publishing or bulk actions. |
| A valid session is treated as sufficient proof of intent. | Authentication versus transaction authorization | Reauthorize sensitive actions; bind approval to exact parameters, actor and expiry; rate-limit bulk generation and publishing separately. |
| The application fetches a user-supplied URL. | SSRF and unsafe outbound requests | Prefer destination allowlists; validate scheme, host, redirect and resolved IP; block private, loopback, link-local and metadata ranges; revalidate after redirects and DNS resolution; enforce network egress policy too. |
| Retrieved content becomes a shell/process action. | Command injection and trust-boundary failure | Avoid shell invocation; map requests to fixed operations; validate structured parameters; separate fetch, scan and render services; fail closed when policy or audit logging is unavailable. |
| Campaign output impersonates a login page. | Business-logic abuse and unsafe output | Restrict forms and scripts in generated pages; sanitize templates; prohibit password fields; add brand-abuse review; use a controlled preview host with no arbitrary server process. |
| Google Drive authorization outlives the merchant session. | OAuth scope, token storage and revocation | Use minimum scopes; broker tokens server-side; require consent or reauthentication for high-impact operations; revoke refresh/access grants at the provider during containment. |
| The connector can create an anyone-with-link folder and a form writes credentials into it. | Public object exposure and data exfiltration | Block credential fields and handlers in generated pages; keep sensitive outputs private; prohibit inherited public sharing; alert on public permission changes and anonymous downloads. |
| A queued job executes after the account is suspended. | Time-of-check versus time-of-use | Store identifiers, not a permanent authorization decision; check current merchant, incident and connector state when the worker executes; make jobs cancellable and idempotent. |

## Cloud-security concepts taught

- **Shared responsibility:** AWS can provide identity, compute, IAM, logging and network controls; Roaming Bites still owns tenant authorization, agent policy, data purpose and safe product behaviour.
- **Least privilege:** constrain the user, agent tool, ECS task role, execution role, orchestrator role and EC2 node role independently.
- **Blast-radius reduction:** a compromised merchant should not gain a general-purpose root shell, unrestricted egress or reusable cross-session artifacts.
- **Trust boundaries:** user input crosses into the application, model, tool orchestrator, OS process, AWS APIs and external SaaS services. Each crossing needs an explicit control.
- **Ephemeral is not isolated:** five-minute deletion limits local persistence; it does not prevent data access, callbacks, tunnelling or external storage.
- **Defence in depth:** application validation, workload hardening, IAM, metadata isolation, egress control and detection cover different failure modes.
- **Evidence literacy:** distinguish permission from use, upload from public exposure, public exposure from anonymous retrieval, DNS lookup from successful transfer, and control-plane activity from commands inside a workload.
- **Containment as authority removal:** disabling the account is incomplete if queued work, STS credentials, running tasks or third-party OAuth grants remain valid.

## AWS services and concepts investigated

| AWS service or feature | What the exercise teaches | Gap or alternative to discuss |
| --- | --- | --- |
| **Amazon Cognito** | User-pool sessions, MFA, device/IP context, adaptive authentication and token revocation. | Require MFA; send user context for risk evaluation; challenge risky sessions; use token revocation or global sign-out. Application workers must still enforce current account state. |
| **Amazon Bedrock** | Model inference is separate from agent authorization and tool execution. | Bedrock Guardrails can help filter model input/output, but do not decide which customer data or AWS action is authorized. Put tool and data policy in the application/orchestrator. |
| **Amazon ECS** | Short-lived tasks, task definitions, task tags and the distinction between runtime and orchestrator. | Use a minimal non-root image, read-only root filesystem, resource limits and a tightly scoped task definition. Consider Fargate when stronger task isolation fits the design. |
| **Amazon EC2 and IMDS** | An ECS-on-EC2 task may reach host metadata if isolation is weak. | Require IMDSv2 and appropriate hop limits; for ECS `awsvpc`, evaluate `ECS_AWSVPC_BLOCK_IMDS`; minimize the node role. Do not assume IMDSv2 alone prevents container access. |
| **AWS IAM** | Task role, task-execution role, orchestrator role and EC2 node role serve different purposes. | Restrict every role; constrain `iam:PassRole`; use conditions and resource scoping; inspect effective and recently used permissions. An IAM Allow is possibility, not proof of use. |
| **Amazon S3** | Tenant-scoped campaign artifacts and durable storage. | Separate prefixes/access points, block public access, encrypt, log important data events and set lifecycle rules. Do not allow executable files to become trusted merely because they are in S3. |
| **AWS CloudTrail / CloudTrail Lake** | Records AWS API activity such as `RunTask` and `StopTask`; tags support correlation. | It does not record arbitrary container commands. Protect trails centrally and enable log-file validation where forensic integrity matters. |
| **Amazon CloudWatch Logs** | Receives application, agent-tool and instrumented runtime evidence. | Emit structured events with merchant, session, job, workspace, task and policy identifiers; redact secrets; protect retention and log access. |
| **Route 53 Resolver logs and DNS Firewall** | Show DNS queries and can alert on or block selected domains. | DNS evidence is not proof of a successful HTTPS transaction. Control direct-IP egress and alternative DNS paths as well. |
| **VPC Flow Logs** | Show accepted/rejected connections and help correlate an ENI with an ECS task. | They do not show URLs, request bodies or process identity. Combine them with DNS, proxy and runtime evidence. |
| **Amazon GuardDuty** | Threat-intelligence and runtime findings can surface malicious-domain or suspicious workload behaviour. | A finding may identify an EC2 node or workload resource rather than the merchant session. Preserve ECS task, ENI and application identifiers for attribution. |
| **EventBridge, Step Functions or SQS** *(possible designs)* | Queued and asynchronous work can outlive the requesting session. | Make work cancellable; recheck authorization at execution; account for in-flight messages and scheduled executions during containment. These services do not provide business authorization automatically. |

## Missing controls: viable design choices

There is not one mandatory architecture. These are useful alternatives for discussion:

1. **No general-purpose workspace:** expose only `render_campaign(template, data)` and other narrow tools. Lowest flexibility; smallest attack surface.
2. **Restricted workspace:** keep code execution but use a non-root minimal image, no package installation, read-only filesystem, private subnet and allowlisted egress.
3. **Two-stage content pipeline:** retrieve into quarantine, scan and verify, then pass only approved artifacts into a separate renderer with no internet access.
4. **Risk-tiered actions:** allow ordinary draft generation automatically; require step-up authentication and explicit preview for bulk creation, connector writes, external publishing and executable content.
5. **Connector isolation:** keep provider tokens in the broker; use narrow OAuth scopes, short-lived grants where possible, per-operation authorization, private-by-default sharing and provider-side revocation.
6. **Execution-time authorization:** every queued job checks current merchant status, incident hold, policy version, connector grant and artifact provenance before starting compute.

## Evidence-based success criteria

By the end, participants should be able to state:

- Which control should have prevented each transition in the attack path.
- Which log would prove or disprove that the transition occurred.
- Which team owns the application, identity, AWS, workload or SaaS control.
- What must be revoked or cancelled during containment.
- Which query or test demonstrates that recovery is safe.

## References

### AI and application security

- [OWASP AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html)
- [OWASP Top 10 for LLM and GenAI Applications 2025](https://genai.owasp.org/llm-top-10/)
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP OAuth 2.0 Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

### AWS

- [Amazon Cognito adaptive authentication](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-settings-adaptive-authentication.html)
- [Amazon Cognito token revocation](https://docs.aws.amazon.com/cognito/latest/developerguide/token-revocation.html)
- [Amazon Bedrock Guardrails](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html)
- [IAM roles for Amazon ECS tasks](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)
- [Amazon ECS task and container security](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/security-tasks-containers.html)
- [ECS EC2 container-instance security considerations](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ec2-security-considerations.html)
- [Route 53 Resolver DNS Firewall](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resolver-dns-firewall.html)
- [VPC Flow Logs](https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs.html)
- [GuardDuty Runtime Monitoring](https://docs.aws.amazon.com/guardduty/latest/ug/runtime-monitoring.html)
- [CloudTrail log-file integrity validation](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-log-file-validation-intro.html)
- [Amazon S3 Block Public Access](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html)

### External SaaS

- [Google Drive API: share files, folders and drives](https://developers.google.com/workspace/drive/api/guides/manage-sharing)
