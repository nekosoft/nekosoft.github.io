const routes = [...document.querySelectorAll('.route')];
const navItems = [...document.querySelectorAll('[data-route]')];
const toast = document.getElementById('toast');
const storageKey = 'rb-incident-state-v6';
const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
let state = {
  decisions: {}, notes: {}, identityReleased: false,
  selectedRoles: [], rolesLocked: false, openedPhases: [], effects: {},
  board: { people: [], data: [], evidence: [], authority: [], service: 'Operational' },
  ...stored
};
state.board = { people: [], data: [], evidence: [], authority: [], service: 'Operational', ...(stored.board || {}) };
state.selectedRoles = Array.isArray(state.selectedRoles) ? state.selectedRoles : [];
state.openedPhases = Array.isArray(state.openedPhases) ? state.openedPhases : [];
state.effects = state.effects || {};
const playablePhases = [1, 3, 4, 5, 6];
const displayPhase = { 1:1, 3:2, 4:3, 5:4, 6:5 };
const previousPlayablePhase = { 1:null, 3:1, 4:3, 5:4, 6:5 };
state.openedPhases = state.openedPhases.filter(id => playablePhases.includes(Number(String(id).replace('phase', ''))));
delete state.decisions.p2; delete state.notes.p2; delete state.effects.p2;

const roleInfo = {
  identity: { name: 'Identity & Cloud Security', icon: '⚿' }, ai: { name: 'Product Engineering', icon: '✦' },
  cloud: { name: 'Platform / SRE', icon: '☁' }, detection: { name: 'Security Operations', icon: '⌕' },
  data: { name: 'ML & Data Operations', icon: '◆' }, comms: { name: 'Communications & PR', icon: '◖' }
};
const phaseReveal = {
  phase1: [['evidence', 'Weak signals correlated']],
  phase2: [['data', 'Restricted customer targeting file copied into agent workspace']],
  phase3: [['authority', 'External URL became an executable process']],
  phase4: [['evidence', 'Nikto output and site archive persisted to a public Drive folder'], ['authority', 'Root process reached instance metadata']],
  phase5: [['people', 'Second merchant report is public'], ['data', 'Captured form submission anonymously downloaded from Drive']],
  phase6: [['authority', 'Queued authorization, Drive grant and public link survived session']]
};
const storyReveals = {
  1: { time:'09:18 UTC', title:'A small alert.<br>A larger question.', body:['Ember & Olive uses Roaming Bites to create promotions for its restaurant. This morning, routine monitoring has raised a low-severity alert connected to the merchant account.', 'The account is still active and the campaign tools appear to be working normally. Your team has been asked to review the recent activity and decide whether the merchant should be contacted or interrupted.'], footer:'Begin with the alert, then test its story against the identity, campaign and AWS records.' },
  2: { time:'09:20 UTC', title:'What travelled<br>with the campaign?', body:['The first review raises questions about the information used to prepare the campaign.', 'Engineering has provided records from the assistant and its temporary workspace—the short-lived area where campaign files are prepared. Your team needs to establish what information entered each part of the system and whether it belonged there.'], footer:'The evidence separates what the AI model received from what its surrounding tools could access.' },
  3: { time:'09:25 UTC', title:'A link enters<br>the workspace.', body:['The investigation now follows activity from the merchant conversation into the temporary workspace.', 'One part of that activity involves an externally hosted campaign helper. Your team needs to determine what Roaming Bites did with it, which safeguards were applied and whether the resulting action was expected.'], footer:'Follow the sequence across the conversation, agent trace, retrieval record and capability policy.' },
  4: { time:'09:36 UTC', title:'The workspace<br>is already gone.', body:['By the time responders arrive, the five-minute workspace and its local files no longer exist.', 'Records remain in several other systems: the running application, AWS, network monitoring and a connected Google Drive account. Your team must use those fragments to reconstruct what occurred and judge how far the activity reached.'], footer:'No single record tells the whole story; time, identity and workspace references connect the evidence.' },
  5: { time:'10:02 UTC', title:'Someone else<br>sees the campaign.', body:['A second merchant contacts support about a page they reached through a Roaming Bites promotion. Soon afterwards, a public Reddit post mentions the same experience.', 'The technical investigation is still under way, but the company may now need to communicate. Your team must separate confirmed facts from assumptions and decide whether to respond publicly.'], footer:'Review what the merchant saw, what the company can prove and what remains unknown.' },
  6: { time:'10:24 UTC', title:'Activity after<br>containment.', body:['Responders have suspended the merchant account, ended its active session and stopped the workspace.', 'A few minutes later, monitoring reports new activity connected to the incident. Your team must establish how it was able to occur and what else must be checked before the service can be considered safe to recover.'], footer:'Compare the timing and lifetime of sessions, queued work, cloud roles and connected-service access.' }
};
const situationData = {
  1: { stage:'Behaviour alert', severity:'LOW', tone:'low', metrics:[['Risk score','62/100','threshold 60'],['Campaign assets','14','in 8 minutes'],['Credential forms','4','of 14 drafts'],['Affected merchants','1','Ember & Olive']], known:'A valid merchant session from a first-seen IP, device and country created an unusual campaign burst.', inferred:'The account may be controlled by someone other than the merchant.', unknown:'Whether the login is malicious or any campaign has been published.', footer:'Identity and product signals are now correlated.' },
  2: { stage:'Data boundary', severity:'MEDIUM', tone:'medium', metrics:[['Audience rows','184','restricted cohort'],['Job mode','Preview','not delivery'],['Authorization decisions','4','all allowed'],['Drive files read','0','during this run']], known:'Records for ctx_2201 show an asset-preview manifest, a staged customer-level CSV and four allowed authorization decisions across the campaign, audience and workspace services.', inferred:'The campaign template and service policies may have affected which inputs were assembled.', unknown:'Whether the file was required for preview generation, accessed after staging or transferred elsewhere.', footer:'The context ID connects the manifest, application audit and authorization records.' },
  3: { stage:'Tool execution', severity:'MEDIUM', tone:'medium', metrics:[['External files','1','retrieved'],['Processes started','1','from retrieved file'],['Human approvals','0','for execution'],['Content checks','2','type + size only']], known:'A merchant-supplied GitHub Raw object was written into the workspace and started with Python.', inferred:'The helper may be connected to the activity that follows.', unknown:'What the code did after process start or whether GitHub itself is involved.', footer:'A legitimate hosting service delivered attacker-selected executable content.' },
  4: { stage:'Runtime abuse', severity:'HIGH', tone:'high', metrics:[['Suspicious domains','2','callback activity'],['Runtime UID','0','container root'],['GuardDuty','8.0','high severity'],['Public Drive folders','1','link-readable']], known:'The task ran as root, installed tools, produced a Nikto scan, read /etc/shadow, reached IMDS paths and saved the scan and site archive to a link-readable Drive folder.', inferred:'The retrieved helper likely initiated the near-immediate external callbacks.', unknown:'Whether AWS credentials were returned or used, and who received the public Drive link.', footer:'Ephemeral compute produced durable, externally readable SaaS state.' },
  5: { stage:'Public impact', severity:'SEV-2', tone:'critical', metrics:[['Public pages','1','phishing page'],['Credential submissions','1','email + password'],['Drive exports','1','anonymous download'],['Affected merchants','1','confirmed']], known:'The fake page accepted one credential submission, stored it in the public Drive folder and an anonymous link user downloaded the file.', inferred:'The anonymous download was performed by the attacker operating the campaign.', unknown:'Whether other people submitted data or the captured credential was used elsewhere.', footer:'Credential collection and external retrieval are confirmed.' },
  6: { stage:'Containment gap', severity:'SEV-2', tone:'critical', metrics:[['Sessions terminated','1','successful'],['Post-containment tasks','1','queued earlier'],['Active grants','1','Drive survived'],['Public folders','1','still readable']], known:'A job accepted before suspension started afterward, the Drive grant remained active and the anyone-with-link folder permission still allowed anonymous access.', inferred:'The later task is continuing pre-authorized work, not a new attacker login.', unknown:'Whether other queued jobs, grants, public shares or copied credentials remain.', footer:'Recovery depends on removing every surviving authority and public access path.' }
};
const situationSignals = [
  { phase:1, time:'09:07', source:'Identity', severity:'info', text:'First-seen IP, device and country for ses_8f21c' },
  { phase:1, time:'09:14', source:'Campaign API', severity:'info', text:'14 assets created in 8 minutes' },
  { phase:1, time:'09:17', source:'RB Detect', severity:'low', text:'Merchant behaviour correlation · risk 62/100' },
  { phase:2, time:'09:10', source:'Data audit', severity:'medium', text:'Restricted audience_184.csv exported to workspace' },
  { phase:3, time:'09:25', source:'Agent trace', severity:'medium', text:'External URL → workspace file → Python process' },
  { phase:4, time:'09:26', source:'GuardDuty', severity:'high', text:'Phishing-domain DNS request attributed to ECS node' },
  { phase:4, time:'09:27', source:'Runtime', severity:'high', text:'uid 0 opened /etc/shadow and reached IMDS' },
  { phase:4, time:'09:28', source:'Drive', severity:'high', text:'Nikto output and site archive uploaded; folder changed to link-readable' },
  { phase:5, time:'09:49', source:'HTTP + Drive', severity:'critical', text:'Credential submission stored, then anonymously downloaded from public folder' },
  { phase:5, time:'09:58', source:'Abuse report', severity:'critical', text:'Public PictoPop sign-in page reported by merchant' },
  { phase:6, time:'10:05', source:'Identity', severity:'info', text:'Session terminated and merchant suspended' },
  { phase:6, time:'10:08', source:'Orchestrator', severity:'critical', text:'Queued job started after suspension' }
];
const evidenceHelp = {
  'p1-siem': { system:'RB Detect · SIEM correlation', action:'Several identity and campaign events have been joined into one alert.', look:'Compare the baseline, contributing signals, entity IDs and why the severity stayed low.' },
  'p1-chat': { system:'Campaign Assistant · merchant conversation', action:'The signed-in merchant session asks the assistant to create campaign assets.', look:'Look at the volume requested, credential-related wording and whether anything was published.' },
  'p1-cloudtrail': { system:'AWS CloudTrail · Amazon ECS API', action:'The campaign service starts the short-lived workspace task.', look:'Find the API caller, task definition, merchant/workspace tags and reported result.' },
  'p1-auth': { system:'Identity service · merchant authentication', action:'A password-backed session is created from a new login context.', look:'Check IP, country, device history, MFA state and the session ID used for correlation.' },
  'p1-asset': { system:'Campaign renderer · generated preview', action:'One generated campaign asset contains a functional-looking sign-in form.', look:'Inspect the brand being represented, requested fields, call to action and publication state.' },
  'p2-context': { system:'Context Assembly · campaign job manifest', action:'The manifest lists the job mode, pipeline template, model-context items, workspace files, audience-export metadata and connector flags for one run.', look:'The Data-access audit and Authorization chain also use context ID ctx_2201. Connector state can be compared by merchant ID and time. Data classes is a governance reference and does not describe a particular run.' },
  'p2-access': { system:'RB Data Audit · application data flow', action:'The audit lists time-ordered application operations performed while the campaign inputs were assembled.', look:'Follow the actor, operation, resource and result columns. Note which components use the same context, segment and file identifiers.' },
  'p2-authority': { system:'RB Authorization Decisions · application policy log', action:'The log records four policy evaluations made by the merchant-facing application and its internal services.', look:'Trace the principal, credential, requested action, resource, evaluated attributes and policy version. Correlate the context, campaign and segment identifiers with the other records.' },
  'p2-classes': { system:'Data handling register · governance record', action:'The register lists the declared classification, intended consumers and retention for each data type.', look:'Compare the declared consumers and retention with the systems and files named in the runtime evidence.' },
  'p2-connector': { system:'Connector broker · Google Drive integration', action:'The administration view records a delegated Drive connection associated with the merchant account.', look:'Examine its status, scope, credential location, content-access conditions and last recorded file activity; correlate times with the other evidence.' },
  'p3-chat': { system:'Campaign Assistant · merchant conversation', action:'The session supplies an external GitHub Raw URL as a campaign helper.', look:'Identify who selected the URL and what approval the assistant appears to request—or omit.' },
  'p3-trace': { system:'Agent trace · model plan and tool decisions', action:'A retrieved file becomes the input to a process-start action.', look:'Follow the plan in order and inspect policy result, human approval and signature requirements.' },
  'p3-retrieval': { system:'Retrieval gateway · outbound web access', action:'The workspace downloads a file from a legitimate public hosting service.', look:'Check host, destination, hash, inspection performed and whether execution risk was evaluated.' },
  'p3-policy': { system:'Campaign workspace · capability policy', action:'The application lists which tools, destinations and processes this run may use.', look:'Read across each row, then consider what happens when individually allowed capabilities are combined.' },
  'p4-guardduty': { system:'Amazon GuardDuty + threat-intel enrichment', action:'DNS activity from an ECS container host matches infrastructure associated with phishing.', look:'Check resource, domain, time and blocked state; then follow the node-to-task-to-workspace correlation.' },
  'p4-cloudwatch': { system:'CloudWatch Logs · workspace runtime telemetry', action:'Processes and file operations inside the short-lived container are recorded.', look:'Look for command, UID, target file, timestamps and result; these are runtime events, not CloudTrail.' },
  'p4-network': { system:'DNS, VPC and HTTP telemetry · network activity', action:'The task resolves external names, opens connections and requests instance metadata paths.', look:'Separate a DNS query, an accepted flow and an HTTP response—they establish different things.' },
  'p4-drive': { system:'Google Workspace + connector audit · Drive activity', action:'The connector preserves the Nikto output and site archive, changes the folder to link-readable and returns a link reference to the compromised session.', look:'Read permissions.create as an API action: file_id names the folder, type=anyone removes an identity requirement, role=reader permits retrieval, and the connector result shows where the link was returned.' },
  'p4-iam': { system:'AWS IAM · workload permission overview', action:'Four roles support the task, ECS runtime, orchestration and EC2 host.', look:'Identify who uses each role, its actions/resources and whether metadata could expose host authority.' },
  'p5-ticket': { system:'Merchant support · direct report', action:'A second merchant reports submitting credentials to the suspicious partner page.', look:'Treat the statement as evidence of what the merchant did, then use system records to confirm collection and retrieval.' },
  'p5-page': { system:'Public web page · reported artifact', action:'A workspace-hosted page imitates a familiar social platform and requests credentials.', look:'Inspect the displayed brand, requested fields, destination and clues that this is not the main product site.' },
  'p5-siem': { system:'RB Detect · cross-source timeline', action:'Runtime, HTTP, Drive and tunnel events are joined from site publication through credential retrieval.', look:'Follow submission_id sub_4c81 from POST /collect to the Drive file, then identify the sharing state and anonymous download.' },
  'p5-forum': { system:'Public forum · external communications evidence', action:'A merchant describes the page publicly and asks whether Roaming Bites was compromised.', look:'Mark verified observations, speculation, potential exposure and the risk of repeating the live link.' },
  'p5-identity': { system:'Merchant care + identity investigation', action:'The account owner confirms the campaign was not theirs and describes their security setup.', look:'Compare the owner statement with authentication records; note which account controls were optional or absent.' },
  'p6-timeline': { system:'RB Detect · containment timeline', action:'Identity, application and ECS containment actions are compared with activity that followed.', look:'Order events precisely and identify which action continued after the session and account were stopped.' },
  'p6-job': { system:'Campaign Jobs · scheduler record', action:'A job accepted earlier begins after the merchant has been suspended.', look:'Compare created, scheduled and started times with when authorization and merchant state were checked.' },
  'p6-cloudtrail': { system:'AWS CloudTrail · Amazon ECS API', action:'The scheduler’s service role starts a new ECS task after containment.', look:'Use the job, merchant and workspace tags to link this service action back to the earlier session.' },
  'p6-drive': { system:'Connector broker · Google Drive grant and sharing state', action:'The provider grant and the public folder permission survive the Roaming Bites login session independently.', look:'Compare revocation effects: stopping the connector grant prevents future broker actions, while removing the anyone-with-link permission stops anonymous reads of existing files.' },
  'p6-authority': { system:'Identity inventory · authority lifetimes', action:'Human tokens, AWS credentials, OAuth grants and cached decisions are compared.', look:'Distinguish credential from authorization decision, then find each lifetime and revocation path.' }
};
const evidenceSystemAbout = {
  'p1-siem':'A security information and event management (SIEM) platform collects, searches and correlates security events from multiple systems.',
  'p1-chat':'An application conversation record preserves the merchant prompts and assistant responses associated with a session.',
  'p1-cloudtrail':'AWS CloudTrail is the audit record of AWS API activity: who called which service operation, with what parameters and result.',
  'p1-auth':'An identity service verifies users, applies login controls and issues the sessions used by the application.',
  'p1-asset':'A rendered preview is application output, not a security log; it shows what the campaign feature actually produced.',
  'p2-context':'A context manifest is an application-generated inventory of information assembled for the model and its tools.',
  'p2-access':'A data-access audit records which application component read, transformed or moved particular data.',
  'p2-authority':'An authorization decision log records whether a principal was allowed to perform an action on a resource and which attributes and policy version were evaluated.',
  'p2-classes':'A data handling register is a governance record defining classification, intended use and retention—not proof of runtime activity.',
  'p2-connector':'A connector administration view shows the configuration and current state of delegated access to an external service.',
  'p3-chat':'An application conversation record preserves the merchant prompts and assistant responses associated with a session.',
  'p3-trace':'An agent trace is a structured application log of the model plan, requested tools and policy decisions around those tools.',
  'p3-retrieval':'A retrieval gateway mediates outbound downloads and records request metadata before content reaches a workspace.',
  'p3-policy':'A capability policy defines what tools and destinations are allowed; it describes authority rather than proving an action occurred.',
  'p4-guardduty':'Amazon GuardDuty is an AWS threat-detection service that analyses AWS telemetry and produces findings; VirusTotal and urlscan add separate reputation context.',
  'p4-cloudwatch':'Amazon CloudWatch Logs stores log events emitted by applications and workloads, including telemetry created inside this container.',
  'p4-network':'Network telemetry combines DNS lookups, connection metadata and HTTP observations; each source sees a different part of communication.',
  'p4-drive':'Google Workspace audit records actions performed against Drive, including use of an application’s delegated OAuth access.',
  'p4-iam':'AWS IAM roles and policies define which AWS identities may perform which actions on which resources; configuration is not proof of use.',
  'p5-ticket':'A support ticket is a business record of what a reporter says happened; it is useful evidence but not an automated measurement.',
  'p5-page':'A captured page is a preserved visual artifact showing what a recipient could see at a particular time.',
  'p5-siem':'A security information and event management (SIEM) platform joins events from multiple systems into a searchable investigation timeline.',
  'p5-forum':'A public forum post is external, human-authored evidence that can establish awareness and reputational impact, but may contain speculation.',
  'p5-identity':'An identity investigation joins technical authentication records with confirmation from the account owner.',
  'p6-timeline':'A security information and event management (SIEM) timeline orders containment and subsequent events collected from different systems.',
  'p6-job':'A scheduler record is application data describing when delayed work was accepted, authorised and started.',
  'p6-cloudtrail':'AWS CloudTrail is the audit record of AWS API activity, including service roles starting ECS tasks.',
  'p6-drive':'A connector status view shows whether delegated OAuth authority still exists independently of the application login.',
  'p6-authority':'An authority inventory is a responder-created comparison of identities, credentials, grants and stored decisions—not one vendor log.'
};
const systemPath = [
  { key:'identity', label:'Merchant identity', detail:'login + session' },
  { key:'assistant', label:'Campaign Assistant', detail:'chat + application' },
  { key:'policy', label:'Data + tool policy', detail:'context + decisions' },
  { key:'workspace', label:'ECS workspace', detail:'five-minute runtime' },
  { key:'services', label:'Drive + internet', detail:'connected services' },
  { key:'effects', label:'External effects', detail:'people + queued work' }
];
const phaseSystemFocus = {
  1:['identity','assistant'], 2:['assistant','policy','workspace'], 3:['assistant','policy','workspace'],
  4:['workspace','services'], 5:['workspace','services','effects'], 6:['identity','workspace','services','effects']
};
const phaseRole = {
  1: { role: 'detection', title: 'Signals joined before the alert aged out', text: 'Security Operations binds the new login, asset burst and credential-form language into one investigation.', gapText: 'Without Security Operations in the room, the identity, campaign-volume and credential-form signals remain separate low-severity events. The team must nominate someone to own correlation and evidence requests.', gapMarker:'Gap · No Security Operations correlation owner', lane: 'evidence', marker: 'Login + campaign signals attributed' },
  2: { role: 'data', title: 'Purpose and exposure are separated', text: 'ML & Data Operations records what entered model context, what entered the workspace, and which people could be affected.', gapText: 'Without ML & Data Operations, nobody can immediately distinguish model context from workspace exports or confirm the affected cohort. Record a data owner and request the context and export manifests.', gapMarker:'Gap · No ML/Data exposure owner', lane: 'data', marker: 'Context and workspace exposure scoped' },
  3: { role: 'ai', title: 'The combined action chain is constrained', text: 'Product Engineering translates the decision into a control over URL → retrieval → execution, rather than treating each tool in isolation.', gapText: 'Without Product Engineering, the team lacks an owner who can turn containment intent into a precise tool-chain control. A broader product restriction may be needed until the URL-to-process path is understood.', gapMarker:'Gap · No Product Engineering control owner', lane: 'authority', marker: 'URL-to-process chain constrained' },
  4: { role: 'cloud', title: 'Ephemeral does not mean evidenceless', text: 'Platform / SRE preserves task, ENI and runtime context and narrows the metadata-exposure question before the next workspace disappears.', gapText: 'Without Platform / SRE, task, ENI, node and runtime evidence are not automatically preserved together. Assign an engineer before another short-lived workspace disappears.', gapMarker:'Gap · No Platform/SRE preservation owner', lane: 'evidence', marker: 'Task, ENI and runtime evidence preserved' },
  5: { role: 'comms', title: 'Public response and merchant care stay joined', text: 'Communications & PR starts direct merchant support while keeping the external statement inside verified facts.', gapText: 'Without Communications & PR, merchant support and the public response have no shared owner. Nominate one spokesperson and keep every statement tied to verified evidence.', gapMarker:'Gap · No Communications/PR owner', lane: 'people', marker: 'Merchant care and public response coordinated' },
  6: { role: 'identity', title: 'Containment follows every authority', text: 'Identity & Cloud Security inventories the session family, provider grant, workload credentials and cached job authorization separately.', gapText: 'Without Identity & Cloud Security, session tokens, OAuth grants, workload credentials and cached job authorization may be treated as one revocation problem. Assign separate owners and validate each authority path.', gapMarker:'Gap · No Identity/Cloud authority owner', lane: 'authority', marker: 'Credential and authorization paths inventoried' }
};
const incidentTimeline = [
  { phase:1, time:'09:07–09:18', stage:'Entry and alert', event:'Password-only login from a first-seen device and country; an asset burst and credential-form language produce a low-severity correlation.' },
  { phase:2, time:'09:10', stage:'Data boundary', event:'An asset-preview job reuses a delivery-oriented bundle, which automatically exports 184 merchant-scoped customer rows and stages the CSV in the tool workspace.' },
  { phase:3, time:'09:25', stage:'Tool chain', event:'The assistant retrieves an attacker-selected file from GitHub Raw and starts it as a Python process without approval or content verification.' },
  { phase:4, time:'09:26–09:34', stage:'Runtime and persistence', event:'The root-running task calls suspicious domains, installs Nikto, reaches IMDS and saves the scan and site archive to a publicly readable Drive folder.' },
  { phase:5, time:'09:46–10:02', stage:'Collection and public harm', event:'A later workspace restores the site, exposes it with LocalTunnel, writes a credential submission to Drive and an anonymous link user downloads it.' },
  { phase:6, time:'10:05–10:08', stage:'Containment gap', event:'The session and merchant are suspended, but a queued job starts because authorization was cached; the Drive grant and public folder permission remain active.' }
];
const actionTypes = { 1:'Detect / mitigate', 2:'Prevent', 3:'Prevent', 4:'Mitigate', 5:'Communicate', 6:'Recover' };
const progressiveSummary = {
  1: {
    overview:'A password-authenticated session from a first-seen device and country creates 14 campaign assets and four drafts asking recipients to verify an account.',
    impact:'No external impact is established. No public link or campaign publication has been observed, and merchant intent has not yet been validated.',
    trigger:'At 09:07, optional MFA and new-device controls allow a valid password to create session ses_8f21c with the merchant’s normal campaign authority.',
    detection:'At 09:17, the SIEM joins the new login context, asset burst and credential-request language into a low-severity score of 62/100. No automated action is taken.',
    conditions:'Strong authentication and new-device verification are optional; a valid merchant session can immediately perform high-impact campaign actions.'
  },
  2: {
    overview:'The suspicious session starts an asset-preview job. The model receives a general audience description and aggregate count, while the reused delivery-oriented bundle automatically exports a restricted row-level customer CSV into the tool workspace.',
    impact:'Customer hashes, last-order timestamps and city-level location enter the workspace. No email addresses, street addresses or GPS coordinates are present, and the row-level file is not sent to the model.',
    trigger:'The asset-preview job reuses campaign_bundle_v2. That template includes audience_member_export by default, and the workspace broker stages every resolved bundle input.',
    detection:'The context manifest, workspace manifest and application audit records reveal the difference between model input and files placed in execution storage.',
    conditions:'The audience query is correctly tenant-scoped, but preview and delivery jobs do not have separate input contracts. Bundle reuse therefore places delivery data in a more capable workspace.'
  },
  3: {
    overview:'The merchant supplies a GitHub Raw URL. The Campaign Assistant downloads render-campaign.py and starts it as a Python process inside the ECS workspace.',
    impact:'Attacker-selected public content executes in the campaign workspace. External callbacks and AWS credential access have not yet been established.',
    trigger:'Application policy approves retrieval and process execution as separate permitted tool calls.',
    detection:'Chat, tool-policy and runtime records show the same request moving from a user-controlled URL to a downloaded file and then an executable process.',
    conditions:'Policy evaluates individual tools but not the combined URL → retrieval → execution path; retrieved content is not verified or separately approved.'
  },
  4: {
    overview:'A root-running ECS workspace executes attacker-selected code, contacts suspicious domains, reaches EC2 metadata paths, runs Nikto and saves the scan and site archive through the merchant’s Drive connector.',
    impact:'The workspace is actively abused and its outputs persist beyond the five-minute disk in a link-readable Drive folder. Metadata reachability creates possible node-role exposure, but returned AWS credentials or their use remain unproven.',
    trigger:'Root execution, package installation, broad egress and metadata reachability give an asset-generation job general-purpose runtime capability.',
    detection:'CloudWatch runtime events, Resolver and VPC Flow Logs, a GuardDuty domain finding, threat-intelligence enrichment and Drive audit records establish different parts of the chain.',
    conditions:'The workspace runs as uid 0, permits package installation and broad outbound access, can reach IMDS, and can use a renewable OAuth grant to create durable, publicly shared Drive artifacts.'
  },
  5: {
    overview:'A later workspace restores the saved archive, hosts a fake login page and uses LocalTunnel to publish it. A submitted email address and password are written to the public Drive folder and then downloaded anonymously.',
    impact:'Little Comet Kitchen reports submitting its credentials. HTTP and Drive records confirm collection, public storage and external retrieval; use of the stolen credential elsewhere remains unknown.',
    trigger:'A stored campaign archive is trusted across workspaces and a process with outbound access can turn a local preview into a public HTTPS site.',
    detection:'Runtime and DNS records connect the restored files and LocalTunnel process to the public URL. HTTP and Drive audit records correlate submission_id sub_4c81 with the stored file, inherited public sharing and anonymous download.',
    conditions:'Cross-session artifacts are not bound to their origin or rescanned. The connector may create link-readable content, and public publishing or sharing requires no separate approval.'
  },
  6: {
    overview:'After the merchant account and active workspace are suspended, a previously accepted job starts a new ECS task. The Drive grant can restore the archive and the existing public folder remains anonymously readable.',
    impact:'Initial containment does not remove every derived authority or public access path. DNS controls block the known callback and tunnel, but execution and Drive accessibility after suspension demonstrate a recovery gap.',
    trigger:'Job authorization is stored at enqueue time without effective expiry or a new merchant-state check at execution.',
    detection:'The application job record links session ses_8f21c to job_91c2; CloudTrail shows the service role starting its task after suspension; connector and DNS records show which later actions succeed or are blocked.',
    conditions:'User sessions, queued decisions, temporary AWS role credentials, renewable OAuth grants and public object permissions have different lifetimes and revocation paths.'
  }
};
const candidateActions = {
  1:'Require strong merchant authentication for high-impact actions and correlate first-seen country/device, asset volume and credential-request language.',
  2:'Minimise the workspace data manifest, block restricted customer exports and log model-context access separately from workspace copies.',
  3:'Mediate external retrieval, verify content before use and prevent retrieved files from becoming executable processes without approval.',
  4:'Run workspaces as non-root, isolate instance metadata, restrict egress, preserve runtime evidence and prohibit public connector sharing by default.',
  5:'Block credential-collection forms, prevent public storage of submissions, alert on anonymous downloads and prepare a holding statement tied to verified facts.',
  6:'Recheck authorization when queued work executes, cancel jobs on suspension, revoke connector grants and remove existing public permissions before recovery.'
};

function saveState() { localStorage.setItem(storageKey, JSON.stringify(state)); }
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[character]);
}
function openedPhaseNumbers() {
  return state.openedPhases
    .map(id => Number(id.replace('phase', '')))
    .filter(number => playablePhases.includes(number))
    .sort((a, b) => a - b);
}
function incidentStarted() { return openedPhaseNumbers().length > 0; }
function canOpenPhase(phase) {
  if (!state.rolesLocked) return false;
  const previous = previousPlayablePhase[phase];
  return phase === 1 || Boolean(previous && state.decisions[`p${previous}`]);
}
function renderPhaseAccess() {
  playablePhases.forEach(phase => {
    const item = document.querySelector(`.nav-item[data-route="phase${phase}"]`);
    const unlocked = canOpenPhase(phase);
    item.disabled = !unlocked;
    item.classList.toggle('locked-phase', !unlocked);
    const visible = displayPhase[phase];
    item.setAttribute('aria-label', unlocked ? `Open Phase ${visible}` : phase === 1 ? 'Lock a response team to open Phase 1' : `Record the Phase ${visible - 1} decision to unlock Phase ${visible}`);
  });
}
function renderSummaryAccess() {
  document.getElementById('summaryNav').classList.toggle('hidden', !incidentStarted());
  document.getElementById('situationNav').classList.toggle('hidden', !incidentStarted());
  document.getElementById('attackPathNav').classList.toggle('hidden', !incidentStarted());
}
function showToast(message) {
  toast.textContent = message; toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2200);
}
function addMarker(lane, label, bonus = false, gap = false) {
  if (!state.board[lane].some(item => item.label === label)) state.board[lane].push({ label, bonus, gap });
}
function migrateBoardMarkers() {
  state.board.data = state.board.data.filter(item => !['Customer cohort fields reached workspace','Restricted customer targeting file copied into agent workspace','Context and workspace exposure scoped'].includes(item.label));
  Object.entries(state.effects).forEach(([key, result]) => {
    const effect = phaseRole[key.slice(1)];
    if (effect && !result.present) addMarker(effect.lane, effect.gapMarker, false, true);
  });
  saveState();
}
function renderBoard() {
  document.getElementById('incidentBoard').classList.toggle('hidden', !state.rolesLocked);
  document.getElementById('teamChips').innerHTML = state.selectedRoles.map(id => `<span class="team-chip role-${id}">${roleInfo[id].name}</span>`).join('');
  const emptyLane = { people:'No affected people revealed', data:'No data exposure revealed', evidence:'No evidence recorded', authority:'No authority path revealed' };
  ['people', 'data', 'evidence', 'authority'].forEach(lane => {
    const target = document.getElementById(`board${lane[0].toUpperCase()}${lane.slice(1)}`);
    const items = state.board[lane];
    target.innerHTML = items.length ? items.map(item => `<span class="board-marker${item.bonus ? ' bonus' : ''}${item.gap ? ' gap' : ''}">${item.label}</span>`).join('') : `<em>${emptyLane[lane]}</em>`;
  });
  const service = document.getElementById('serviceStatus');
  service.textContent = state.board.service;
  service.parentElement.className = `service-state ${state.board.service.toLowerCase()}`;
}
function revealPhase(id) {
  if (!phaseReveal[id] || state.openedPhases.includes(id)) return;
  phaseReveal[id].forEach(([lane, label]) => addMarker(lane, label));
  state.openedPhases.push(id); saveState(); renderBoard(); renderSummaryAccess(); showToast('Incident board updated');
}
function renderSituation() {
  const opened = openedPhaseNumbers();
  const latest = opened[opened.length - 1];
  const data = situationData[latest];
  const reviewButton = document.getElementById('reviewCurrentPhase');
  if (!data) {
    document.getElementById('situationMetrics').innerHTML = '';
    reviewButton.disabled = true;
    return;
  }
  document.getElementById('situationTime').textContent = storyReveals[latest].time;
  document.getElementById('situationPhase').textContent = `Phase ${displayPhase[latest]} of 5`;
  document.getElementById('situationStage').textContent = data.stage;
  const severity = document.getElementById('situationSeverity');
  severity.textContent = data.severity; severity.className = data.tone;
  document.getElementById('situationService').textContent = state.board.service;
  document.getElementById('situationMetrics').innerHTML = data.metrics.map(([label, value, detail]) => `<article><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join('');
  const visibleSignals = situationSignals.filter(signal => opened.includes(signal.phase));
  document.getElementById('signalCount').textContent = `${visibleSignals.length} signal${visibleSignals.length === 1 ? '' : 's'}`;
  document.getElementById('situationSignals').innerHTML = visibleSignals.slice().reverse().map(signal => `<div class="signal-row"><time>${signal.time}</time><span class="signal-severity ${signal.severity}">${signal.severity}</span><b>${signal.source}</b><p>${signal.text}</p></div>`).join('');
  document.getElementById('situationKnown').textContent = data.known;
  document.getElementById('situationInferred').textContent = data.inferred;
  document.getElementById('situationUnknown').textContent = data.unknown;
  document.getElementById('situationFooter').textContent = data.footer;
  reviewButton.disabled = false;
  reviewButton.textContent = `Open Phase ${latest} evidence →`;
  reviewButton.dataset.phase = latest;
}
function openStoryReveal(phase) {
  const story = storyReveals[phase]; if (!story || !document.body.classList.contains('facilitator')) return;
  document.getElementById('revealPhase').textContent = `Phase ${displayPhase[phase]} of 5`;
  document.getElementById('revealTime').textContent = story.time;
  document.getElementById('revealTitle').innerHTML = story.title;
  document.getElementById('revealBody').innerHTML = story.body.map(line => `<p>${line}</p>`).join('') + `<small>${story.footer}</small>`;
  document.getElementById('revealProgressBar').style.width = `${(displayPhase[phase] / 5) * 100}%`;
  const dialog = document.getElementById('phaseRevealDialog');
  if (!dialog.open) dialog.showModal();
}
function navigate(id) {
  if (/^phase\d$/.test(id)) {
    const requestedPhase = Number(id.replace('phase', ''));
    if (!canOpenPhase(requestedPhase)) {
      const accessible = playablePhases.filter(canOpenPhase).pop();
      id = accessible ? `phase${accessible}` : state.rolesLocked ? 'phase1' : 'team';
      showToast(requestedPhase === 1 ? 'Lock four roles to begin' : `Record the Phase ${Math.max(1, (displayPhase[requestedPhase] || 2) - 1)} decision first`);
    }
  }
  if (id === 'summary' && !incidentStarted()) { id = 'briefing'; showToast('The incident summary becomes available when Phase 1 opens'); }
  if (id === 'situation' && !incidentStarted()) { id = 'briefing'; showToast('The live situation appears when Phase 1 opens'); }
  const firstReveal = /^phase\d$/.test(id) && !state.openedPhases.includes(id);
  routes.forEach(route => route.classList.toggle('active-route', route.id === id));
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.route === id));
  const replayStory = document.getElementById('replayStory');
  const phaseMatch = id.match(/^phase([1-6])$/);
  replayStory.classList.toggle('hidden', !phaseMatch);
  replayStory.dataset.phase = phaseMatch ? phaseMatch[1] : '';
  document.body.classList.toggle('situation-mode', id === 'situation');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
  revealPhase(id);
  if (id === 'situation') renderSituation();
  if (id === 'summary') renderSummary();
  if (firstReveal && document.body.classList.contains('facilitator')) window.setTimeout(() => openStoryReveal(Number(id.replace('phase', ''))), 120);
}
navItems.forEach(item => item.addEventListener('click', event => { event.preventDefault(); if (!item.disabled) navigate(item.dataset.route); }));

playablePhases.forEach(phase => {
  const section = document.getElementById(`phase${phase}`);
  const story = storyReveals[phase];
  const banner = document.createElement('article');
  banner.className = 'phase-story';
  banner.innerHTML = `<div class="phase-story-meta"><span>Story update · Phase ${displayPhase[phase]} of 5</span><time>${story.time}</time></div><h2>${story.title}</h2><div class="phase-story-copy">${story.body.map(line => `<p>${line}</p>`).join('')}</div><footer><small>${story.footer}</small><button class="story-reveal-button facilitator-only" type="button"><span>↺</span> Replay fullscreen</button></footer>`;
  banner.querySelector('.story-reveal-button').addEventListener('click', () => openStoryReveal(phase));
  section.prepend(banner);
  const tabs = section.querySelector('.evidence-tabs');
  const contextMap = document.createElement('section');
  contextMap.className = 'evidence-system-map';
  contextMap.innerHTML = `<header><div><span>Evidence correlation path</span><b>Where this phase fits in the system</b></div><a href="architecture.html" target="_blank" rel="noreferrer">Open full architecture ↗</a></header><div class="system-path">${systemPath.map((node, nodeIndex) => `${nodeIndex ? '<i aria-hidden="true">→</i>' : ''}<div class="system-path-node${phaseSystemFocus[phase].includes(node.key) ? ' active' : ''}"><b>${node.label}</b><small>${node.detail}</small></div>`).join('')}</div>`;
  tabs.before(contextMap);
  const orientation = document.createElement('aside');
  orientation.className = 'evidence-orientation';
  orientation.setAttribute('aria-live', 'polite');
  tabs.after(orientation);
  const activeTab = tabs.querySelector('.evidence-tab.active');
  renderEvidenceHelp(activeTab.dataset.target, tabs);
});
function renderEvidenceHelp(targetId, tabs) {
  const help = evidenceHelp[targetId]; if (!help) return;
  const orientation = tabs.nextElementSibling;
  orientation.innerHTML = `<span class="orientation-icon" aria-hidden="true">?</span><div><p><b>${help.system}</b><span>${evidenceSystemAbout[targetId]}</span></p><p><strong>Showing</strong><span>${help.action} <b class="look-label">Look for:</b> ${help.look}</span></p></div>`;
}
document.getElementById('reviewCurrentPhase').addEventListener('click', event => navigate(`phase${event.currentTarget.dataset.phase}`));
document.getElementById('revealToEvidence').addEventListener('click', () => document.getElementById('phaseRevealDialog').close());
document.getElementById('replayStory').addEventListener('click', event => {
  const phase = Number(event.currentTarget.dataset.phase);
  if (phase) openStoryReveal(phase);
});

function renderCrew() {
  const count = state.selectedRoles.length;
  document.getElementById('roleCount').textContent = count;
  document.querySelectorAll('.role-card').forEach(card => {
    const selected = state.selectedRoles.includes(card.dataset.role);
    card.classList.toggle('selected', selected); card.classList.toggle('locked', state.rolesLocked);
    card.disabled = state.rolesLocked || (!selected && count >= 4);
    card.querySelector('i').textContent = selected ? 'Selected' : 'Choose';
  });
  const lock = document.getElementById('lockCrew');
  lock.disabled = count !== 4 || state.rolesLocked; lock.textContent = state.rolesLocked ? 'Team locked' : 'Lock team';
  const begin = document.getElementById('openPhase1');
  begin.disabled = !state.rolesLocked; begin.textContent = state.rolesLocked ? 'Open Phase 1 →' : 'Lock four roles to begin';
  document.getElementById('crewStatus').textContent = state.rolesLocked
    ? 'Team locked. Hidden role effects will appear only after the relevant phase decision.'
    : count === 4 ? 'Four representatives selected. Lock the team when everyone agrees.' : `Choose ${4 - count} more representative${4 - count === 1 ? '' : 's'}.`;
  renderBoard(); renderSummaryAccess();
}
document.querySelectorAll('.role-card').forEach(card => card.addEventListener('click', () => {
  if (state.rolesLocked) return;
  const id = card.dataset.role;
  state.selectedRoles = state.selectedRoles.includes(id) ? state.selectedRoles.filter(role => role !== id) : [...state.selectedRoles, id];
  saveState(); renderCrew();
}));
document.getElementById('lockCrew').addEventListener('click', () => {
  if (state.selectedRoles.length !== 4) return;
  state.rolesLocked = true; saveState(); renderCrew(); showToast('Team locked — two capability gaps remain hidden');
  renderPhaseAccess();
});

document.querySelectorAll('.evidence-tabs').forEach(group => {
  group.addEventListener('click', event => {
    const button = event.target.closest('.evidence-tab'); if (!button) return;
    const section = group.closest('.route');
    section.querySelectorAll('.evidence-tab').forEach(tab => tab.classList.remove('active'));
    section.querySelectorAll('.evidence-view').forEach(view => view.classList.remove('active'));
    button.classList.add('active'); document.getElementById(button.dataset.target).classList.add('active');
    renderEvidenceHelp(button.dataset.target, group);
  });
});

document.querySelectorAll('.decision-card[data-phase]').forEach(card => {
  const outcome = document.createElement('div'); outcome.className = 'role-outcome'; outcome.setAttribute('aria-live', 'polite'); card.appendChild(outcome);
});
function applyRoleEffect(phase) {
  const effect = phaseRole[phase]; if (!effect) return;
  const present = state.selectedRoles.includes(effect.role);
  state.effects[`p${phase}`] = { present };
  if (present) addMarker(effect.lane, effect.marker, true);
  else addMarker(effect.lane, effect.gapMarker, false, true);
  if (phase === '4') state.board.service = 'Restricted';
  if (phase === '6') {
    const choice = state.decisions.p6 || '';
    state.board.service = choice.includes('globally') ? 'Paused' : choice.includes('Keep the product online') ? 'Restricted' : choice.includes('restore the merchant') ? 'Operational' : 'Restricted';
  }
  saveState(); renderRoleOutcome(phase); renderBoard(); renderPhaseAccess();
}
function renderRoleOutcome(phase) {
  const result = state.effects[`p${phase}`]; const effect = phaseRole[phase];
  const card = document.querySelector(`.decision-card[data-phase="${phase}"]`); if (!result || !effect || !card) return;
  const box = card.querySelector('.role-outcome'); const role = roleInfo[effect.role];
  box.className = `role-outcome show${result.present ? '' : ' gap'}`;
  const next = card.querySelector('.commit[data-next]')?.dataset.next;
  const nextLabel = next === 'summary' ? 'Open incident summary →' : next ? `Continue to Phase ${displayPhase[Number(next.replace('phase', ''))]} →` : '';
  box.innerHTML = `${result.present
    ? `<span class="outcome-icon">${role.icon}</span><div><b>${role.name} contribution · ${effect.title}</b><span>${effect.text}</span></div>`
    : `<span class="outcome-icon">◇</span><div><b>Organisational gap revealed · ${role.name}</b><span>${effect.gapText}</span></div>`}
    <div class="outcome-actions"><button class="view-board" type="button">↑ View updated operating picture</button>${next ? `<button class="continue-phase" type="button">${nextLabel}</button>` : ''}</div>`;
  box.querySelector('.view-board').addEventListener('click', () => document.getElementById('incidentBoard').scrollIntoView({ behavior:'smooth', block:'start' }));
  if (next) box.querySelector('.continue-phase').addEventListener('click', () => navigate(next));
}
document.querySelectorAll('.commit').forEach(button => {
  button.addEventListener('click', () => {
    const card = button.closest('.decision-card'); const phase = card.dataset.phase;
    const selected = card.querySelector('input[type="radio"]:checked');
    if (!selected) { card.querySelector('.commit-status').textContent = 'Choose a position first.'; return; }
    state.decisions[`p${phase}`] = selected.value; state.notes[`p${phase}`] = card.querySelector('textarea').value;
    saveState(); applyRoleEffect(phase); card.querySelector('.commit-status').textContent = 'Decision recorded locally.';
    showToast('Decision recorded · outcome remains below');
    card.querySelector('.role-outcome').scrollIntoView({ behavior:'smooth', block:'nearest' });
  });
});
document.querySelectorAll('textarea[data-notes]').forEach(area => {
  area.value = state.notes[area.dataset.notes] || '';
  area.addEventListener('change', () => { state.notes[area.dataset.notes] = area.value; saveState(); });
});
Object.entries(state.decisions).forEach(([name, value]) => {
  const input = document.querySelector(`input[name="${name}"][value="${CSS.escape(value)}"]`); if (input) input.checked = true;
});

function releaseIdentity() {
  state.identityReleased = true; saveState(); applyRoleEffect('5');
  document.querySelector('.reveal-tab').classList.remove('hidden'); document.getElementById('phase5Continue').classList.remove('hidden');
  document.querySelector('[data-target="p5-identity"]').click(); showToast('Identity evidence and role effect released');
}
document.getElementById('lockPublicDecision').addEventListener('click', event => {
  const card = event.currentTarget.closest('.decision-card'); const selected = card.querySelector('input[type="radio"]:checked');
  if (!selected) { card.querySelector('.commit-status').textContent = 'Choose a public-response position first.'; return; }
  state.decisions.p5 = selected.value; state.notes.p5 = card.querySelector('textarea').value; releaseIdentity();
});
if (state.identityReleased) { document.querySelector('.reveal-tab').classList.remove('hidden'); document.getElementById('phase5Continue').classList.remove('hidden'); }
Object.keys(state.effects).forEach(key => renderRoleOutcome(key.slice(1)));

function renderSummary() {
  const opened = openedPhaseNumbers();
  if (!opened.length) return;
  const latestPhase = opened[opened.length - 1];
  const narrative = progressiveSummary[latestPhase];
  const visibleTimeline = incidentTimeline.filter(item => opened.includes(item.phase));
  const recordedDecisions = visibleTimeline.filter(item => state.decisions[`p${item.phase}`]);
  const latestDecision = recordedDecisions[recordedDecisions.length - 1];
  document.getElementById('summaryService').textContent = state.board.service;
  document.getElementById('summaryStatus').textContent = latestPhase === 6 && state.decisions.p6 ? 'Ready for review' : `In progress · Phase ${displayPhase[latestPhase]}`;
  document.getElementById('summarySeverity').textContent = latestPhase >= 5 ? 'SEV-2' : latestPhase >= 4 ? 'SEV-2 proposed' : 'Not yet declared';
  document.getElementById('summaryOverview').textContent = narrative.overview;
  document.getElementById('summaryImpact').textContent = narrative.impact;
  document.getElementById('summaryTrigger').textContent = narrative.trigger;
  document.getElementById('summaryDetection').textContent = narrative.detection;
  document.getElementById('summaryConditions').textContent = narrative.conditions;
  document.getElementById('summaryTeam').innerHTML = state.selectedRoles.length
    ? state.selectedRoles.map(id => `<span class="role-${id}">${roleInfo[id].name}</span>`).join('')
    : '<em>No response team selected</em>';
  document.getElementById('summaryDecisionCount').textContent = `${recordedDecisions.length} decision${recordedDecisions.length === 1 ? '' : 's'} · ${opened.length} of 5 phases opened`;
  document.getElementById('summaryResolution').textContent = latestPhase === 6 && state.decisions.p6
    ? `The team’s recorded recovery position: ${state.decisions.p6}. This remains a proposed response until owners, validation queries and recovery gates are confirmed.`
    : latestDecision
      ? `Final containment has not yet been reached. Latest recorded position from Phase ${displayPhase[latestDecision.phase]}: ${state.decisions[`p${latestDecision.phase}`]}.`
      : 'The team has not recorded a response decision yet; final containment and recovery have not been reached.';
  document.getElementById('summaryTimeline').innerHTML = visibleTimeline.map(item => {
    const decision = state.decisions[`p${item.phase}`] || 'Decision pending';
    const phaseNote = state.notes[`p${item.phase}`]?.trim();
    const effect = phaseRole[item.phase];
    const represented = state.effects[`p${item.phase}`]?.present;
    const outcome = state.effects[`p${item.phase}`] ? (represented ? `${roleInfo[effect.role].name} represented` : `${roleInfo[effect.role].name} gap`) : 'Outcome not revealed';
    const notes = [phaseNote ? `Team note: ${phaseNote}` : ''].filter(Boolean);
    return `<tr><td>${item.time}</td><td><b>${item.stage}</b><small>Phase ${displayPhase[item.phase]}</small></td><td>${item.event}</td><td><b>${escapeHtml(decision)}</b><small>${outcome}</small>${notes.map(note => `<small>${escapeHtml(note)}</small>`).join('')}</td></tr>`;
  }).join('');
  const bonuses = Object.values(state.board).flatMap(value => Array.isArray(value) ? value.filter(item => item.bonus) : []);
  const gaps = Object.values(state.board).flatMap(value => Array.isArray(value) ? value.filter(item => item.gap) : []);
  document.getElementById('summaryStrengths').innerHTML = bonuses.length ? bonuses.map(item => `<span>${item.label}</span>`).join('') : '<em>No team contributions revealed yet.</em>';
  document.getElementById('summaryGaps').innerHTML = gaps.length ? gaps.map(item => `<span>${item.label.replace('Gap · ', '')}</span>`).join('') : '<em>No organisational gaps revealed yet.</em>';
  const actions = visibleTimeline.filter(item => state.decisions[`p${item.phase}`]).map(item => {
    const effect = phaseRole[item.phase];
    const owner = state.selectedRoles.includes(effect.role) ? roleInfo[effect.role].name : `Assign owner · ${roleInfo[effect.role].name} absent`;
    return `<tr><td>${candidateActions[item.phase]}<small>Team decision: ${escapeHtml(state.decisions[`p${item.phase}`])}</small></td><td>${actionTypes[item.phase]}</td><td>${owner}</td><td><span class="pill amber">PROPOSED</span></td></tr>`;
  });
  document.getElementById('summaryActions').innerHTML = actions.length ? actions.join('') : '<tr><td colspan="4">No decisions have been recorded.</td></tr>';
}

document.getElementById('printSummary').addEventListener('click', () => {
  document.body.classList.add('summary-print');
  window.print();
  window.setTimeout(() => document.body.classList.remove('summary-print'), 500);
});

document.getElementById('facilitatorToggle').addEventListener('click', () => {
  document.body.classList.toggle('facilitator');
  if (!document.body.classList.contains('facilitator') && document.getElementById('phaseRevealDialog').open) document.getElementById('phaseRevealDialog').close();
  showToast(document.body.classList.contains('facilitator') ? 'Facilitator controls visible' : 'Participant mode');
});
if (new URLSearchParams(location.search).get('facilitator') === '1') document.body.classList.add('facilitator');
document.getElementById('resetScenario').addEventListener('click', () => {
  if (!window.confirm('Clear the selected team, incident board, decisions and identity reveal?')) return;
  localStorage.removeItem(storageKey); location.href = location.pathname;
});

let remaining = 300; let timerId = null;
const timerDisplay = document.getElementById('timerDisplay'); const timerToggle = document.getElementById('timerToggle');
function drawTimer() {
  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0'); const seconds = (remaining % 60).toString().padStart(2, '0');
  timerDisplay.textContent = `${minutes}:${seconds}`; timerDisplay.style.color = remaining <= 60 ? '#ffb1a8' : '';
}
timerToggle.addEventListener('click', () => {
  if (timerId) { clearInterval(timerId); timerId = null; timerToggle.textContent = 'Start'; return; }
  timerToggle.textContent = 'Pause';
  timerId = setInterval(() => {
    remaining = Math.max(0, remaining - 1); drawTimer();
    if (remaining === 0) { clearInterval(timerId); timerId = null; timerToggle.textContent = 'Start'; showToast('Review time is up'); }
  }, 1000);
});
document.getElementById('timerReset').addEventListener('click', () => { remaining = 300; drawTimer(); });
const dialog = document.getElementById('imageDialog');
document.querySelectorAll('[data-zoomable]').forEach(image => image.addEventListener('click', () => {
  document.getElementById('dialogImage').src = image.src; document.getElementById('dialogImage').alt = image.alt; dialog.showModal();
}));
document.getElementById('closeDialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

migrateBoardMarkers();
renderCrew();
renderPhaseAccess();
const requestedRoute = location.hash.slice(1);
navigate(requestedRoute && document.getElementById(requestedRoute) ? requestedRoute : 'briefing');
