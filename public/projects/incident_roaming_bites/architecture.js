const nodeData = {
  attacker: { title:'Attacker', service:'External browser and network', status:'compromised', statusText:'Malicious', phase:'Phase 1', summary:'An unknown person uses a merchant password obtained outside Roaming Bites.', runtime:'A normal browser on a new Windows device. No specialist client or exploit is required for the initial access.', permission:'Whatever the merchant account and its active session are allowed to do. MFA and new-device verification were not enforced.', evidence:'Authentication logs record a password-only login at 09:07 from a device, IP address and country not seen for this merchant in the previous 90 days. Campaign audit logs then show 14 assets and four credential-form drafts from that session. The combination supports account misuse; it does not reveal how the password was obtained.', boundary:'Crosses from an untrusted device into the merchant identity boundary.', question:'Which high-impact actions should require more than a valid password?' },
  merchant: { title:'Merchant account', service:'Amazon Cognito-backed application identity', status:'compromised', statusText:'Compromised', phase:'Phases 1–6', summary:'The Ember & Olive account is the attacker’s entry point and the authority behind every later request.', runtime:'Roaming Bites merchant session for marketing@ember-olive.example.', permission:'Read brand assets and campaign history; create campaigns; use an existing Drive grant; request campaign previews.', evidence:'Cognito and application audit records tie session ses_8f21c to the 09:07 login and the suspicious campaign actions. At 10:02, Ember & Olive confirms it did not create that campaign. Together these establish misuse of the merchant account; a valid session alone would only show successful authentication.', boundary:'The application treats authenticated merchant intent as trusted input.', question:'What damage should a single compromised merchant identity be permitted to cause?' },
  targets: { title:'Other merchants', service:'External browsers and messaging services', status:'compromised', statusText:'Targeted', phase:'Phase 5', summary:'Restaurants and food trucks receive a fake partnership link sent under a known merchant identity.', runtime:'Recipients’ browsers and email or messaging clients.', permission:'No Roaming Bites privilege is required to view the public tunnel. Submitted credentials belong to each recipient.', evidence:'Little Comet Kitchen reports submitting an email address and password. HTTP telemetry records POST /collect with submission_id sub_4c81, Drive audit records the corresponding file upload, and an anonymous link user downloads it. This confirms collection and retrieval, but not later use of the credential.', boundary:'The attack leaves Roaming Bites infrastructure and reaches people outside its control.', question:'How will you identify, warn and support every possible recipient?' },
  webapp: { title:'Campaign Assistant', service:'Roaming Bites custom application in AWS; Amazon Bedrock for model inference', status:'observed', statusText:'Not proven compromised', phase:'Phases 1–6', summary:'The merchant-facing AI experience accepts creative requests and sends them to the orchestration layer.', runtime:'Web frontend, campaign API and model-facing application services.', permission:'Acts on behalf of an authenticated merchant and can request brand, campaign and connector operations.', evidence:'Chat and tool traces show the supplied URL becoming retrieval and execution requests. This explains how normal product functions were abused; it does not show that the Campaign Assistant service itself was modified.', boundary:'User language becomes tool and data operations inside the trusted application.', question:'Where should the product distinguish creative intent from executable instructions?' },
  orchestrator: { title:'Agent orchestrator', service:'Roaming Bites custom service using AWS IAM and Amazon ECS APIs', status:'abused', statusText:'Capability abused', phase:'Phases 1–6', summary:'Creates short-lived ECS tasks and passes campaign context into them.', runtime:'Roaming Bites service using rb-campaign-orchestrator-prod.', permission:'ecs:RunTask, ecs:StopTask, iam:PassRole for approved task roles, and access to connector secrets under /rb/connectors/*.', evidence:'CloudTrail records the orchestrator role calling ECS RunTask with merchant_1047, job and workspace tags. Those identifiers link each AWS task to the application request. CloudTrail proves task creation by the service role, but it does not record commands run later inside the container.', boundary:'Moves merchant-controlled requests into a tool-capable AWS compute environment.', question:'Can the orchestrator reduce permissions per job instead of starting the same general-purpose workspace?' },
  connector: { title:'Connector broker', service:'Roaming Bites custom service bridging AWS and Google Drive', status:'observed', statusText:'Not proven compromised', phase:'Phases 2, 4–6', summary:'Uses stored merchant grants to access external services without exposing provider tokens directly to the workspace.', runtime:'Application service that brokers Google Drive file and sharing operations.', permission:'Uses the merchant’s previously approved OAuth grant. Reauthentication was not required to upload files or create link-readable sharing.', evidence:'Google Drive audit records the broker uploading the Nikto result and site archive, changing the folder to anyone-with-link viewer, and later uploading captured-submissions.ndjson. The token stayed in the broker; the attacker retrieved the submission through the public link, not by stealing the OAuth token.', boundary:'Bridges Roaming Bites authority into the merchant’s external SaaS tenant and can create public access.', question:'Which connector operations should require renewed consent or prohibit public sharing?' },
  workspace: { title:'Amazon ECS task workspace', service:'Amazon ECS on Amazon EC2; Amazon S3, Bedrock and CloudWatch through the task role', status:'compromised', statusText:'Actively abused', phase:'Phases 1–6', summary:'A five-minute ECS task used by the Campaign Assistant to create and process campaign assets.', runtime:'Python tooling in an ECS container on EC2. Package installation is enabled and the process runs as uid 0.', permission:'rb-campaign-task-prod: Bedrock invocation, scoped campaign S3 access and CloudWatch log writes. Network egress was broadly available.', evidence:'Runtime logs place the GitHub-delivered script, Nikto installation and scan, /etc/shadow read, metadata requests, form handler and LocalTunnel process inside short-lived ECS tasks. Drive audit shows the scan, site kit and captured submission surviving task deletion in a public folder. Missing metadata response bodies mean AWS credential theft is still not proven.', boundary:'This is where untrusted instructions gain operating-system, network, cloud and connector capabilities.', question:'Why does campaign creation require root, package installation, form collection and unrestricted outbound access?' },
  imds: { title:'Amazon EC2 instance metadata', service:'Amazon EC2 Instance Metadata Service (IMDS)', status:'compromised', statusText:'Exposed', phase:'Phase 4', summary:'The workspace reached the EC2 metadata service used by its underlying ECS node.', runtime:'IMDS at 169.254.169.254 on the EC2 host.', permission:'Potential path to rb-ecs-node-prod credentials. The evidence does not establish that credentials were returned or used.', evidence:'Instrumented HTTP logs record status 200 for /latest/meta-data/ and /latest/meta-data/iam/ from the workspace. That proves the metadata endpoint and IAM listing path were reachable from the container. Response bodies were not logged, so the evidence does not prove that the node-role name or credentials were returned.', boundary:'Crosses the intended container-to-host isolation boundary.', question:'Did IMDSv2, hop limits and host-network controls actually protect the node role?' },
  ecsnode: { title:'Amazon EC2 ECS node', service:'Amazon EC2 container instance registered with Amazon ECS', status:'observed', statusText:'Compromise unproven', phase:'Phases 1, 3–6', summary:'Hosts multiple short-lived campaign tasks and is the resource named in the GuardDuty DNS finding.', runtime:'EC2 instance i-0c84f271a4b91e620 registered to cluster rb-campaign-prod.', permission:'rb-ecs-node-prod: ECR read, SSM managed-instance functions, ECS registration and task-state reporting.', evidence:'GuardDuty names EC2 instance i-0c84f271a4b91e620, not a merchant or container. ECS task metadata maps workspace ws_8bd20 to task ENI 10.42.18.7 on that node, and the DNS record contains the same source address. That correlation attributes the traffic to the workspace; it does not prove the whole EC2 node was compromised.', boundary:'Shared host underneath isolated merchant tasks.', question:'Can you identify the responsible task quickly without treating every task on the node as compromised?' },
  github: { title:'GitHub Raw', service:'External GitHub content-delivery service', status:'abused', statusText:'Legitimate service abused', phase:'Phases 3–4', summary:'Hosts the attacker-supplied campaign helper. GitHub itself is not treated as malicious.', runtime:'Static raw-content delivery over HTTPS.', permission:'Public read; no Roaming Bites or GitHub credentials were needed.', evidence:'Runtime logs show an HTTPS GET for render-campaign.py returning 200, followed two seconds later by python /work/render-campaign.py in the same workspace. This proves public content was downloaded and executed; it does not imply that GitHub was compromised or that every later network request came from that script.', boundary:'Untrusted public content crosses into a privileged workspace.', question:'Should external code ever move directly from a user-provided URL into execution?' },
  callbacks: { title:'Callback domains', service:'External attacker-controlled infrastructure; detected through GuardDuty, DNS and flow telemetry', status:'compromised', statusText:'Malicious', phase:'Phase 4', summary:'Two external destinations are contacted immediately after the GitHub-delivered file runs.', runtime:'HTTPS endpoints behind promo-assets-cdn.example and campaign-metrics-sync.example.', permission:'No AWS permissions; their leverage comes from the workspace being allowed to contact arbitrary internet destinations.', evidence:'Resolver and flow logs show task address 10.42.18.7 resolving and connecting to both domains. GuardDuty flags one for phishing reputation, while cached VirusTotal and urlscan results add separate corroboration. The records prove outbound contact; response content and exact process attribution were not captured.', boundary:'Outbound traffic crosses from the AWS workload into attacker-controlled infrastructure.', question:'Would allowlisted egress or a validating retrieval proxy have stopped this step?' },
  drive: { title:'Google Drive', service:'External Google Workspace service reached through the connector broker', status:'abused', statusText:'Persistence + exfiltration', phase:'Phases 2, 4–6', summary:'The save-to-Drive feature becomes durable storage and a public retrieval channel.', runtime:'Google Drive reached through the Roaming Bites connector broker and through an anyone-with-link URL.', permission:'The connector uses the merchant OAuth grant to upload and change sharing; an anonymous reader needs only the public folder link.', evidence:'Drive audit records show nikto-results.json and promotion-assets.zip uploaded before the first workspace expires. The folder is changed to anyone-with-link viewer. A later workspace uploads captured-submissions.ndjson, followed by an anonymous download from 198.51.100.86. This proves external retrieval without proving theft of the OAuth token.', boundary:'Data leaves Roaming Bites, persists in another SaaS tenant and becomes readable without authentication.', question:'Should an automated campaign connector ever create public sharing or store submitted credentials?' },
  tunnel: { title:'LocalTunnel', service:'External tunnelling service reached through AWS workload egress', status:'abused', statusText:'Capability abused', phase:'Phase 5', summary:'A public relay exposes the local web server running inside the temporary workspace.', runtime:'LocalTunnel client in the container, outbound connection to the relay, public HTTPS URL.', permission:'Needs only outbound network access and the ability to start a process listening on port 3000.', evidence:'Runtime logs show a local server on port 3000 and the command lt --port 3000; DNS logs then show loca.lt. The public URL in the merchant report displays the same fake login design. Together these link the workspace to the public page without requiring an inbound security-group rule.', boundary:'Turns an internal ephemeral process into an internet-facing service.', question:'Why can a campaign preview choose its own hosting and tunnelling mechanism?' },
  job: { title:'Queued campaign job', service:'Roaming Bites campaign scheduler', status:'abused', statusText:'Stale authority reused', phase:'Phase 6', summary:'A campaign job accepted before containment starts a new workspace after the merchant session is terminated.', runtime:'Asynchronous job job_91c2, scheduled for 10:08 UTC.', permission:'Authorization was evaluated when queued and stored without an effective expiry. Merchant state was not checked again at execution.', evidence:'The application job record says job_91c2 was authorised at 09:49 by session ses_8f21c and scheduled for 10:08. The merchant was suspended at 10:05, yet CloudTrail records the orchestrator role starting its task at 10:08. This proves execution reused an earlier authorization decision; it does not show a new login or stolen AWS key.', boundary:'A past user decision becomes new workload authority across time.', question:'Which facts must be rechecked whenever delayed work actually executes?' }
};

const diagram = document.getElementById('attackDiagram');
const status = document.getElementById('detailStatus');
const playablePhases = [1, 3, 4, 5, 6];
const displayPhase = { 1:1, 3:2, 4:3, 5:4, 6:5 };
const pathMeta = {
  '1': { title:'Valid account access', summary:'The attacker signs in with the merchant’s password. Because MFA and new-device verification are optional, Cognito issues a normal session and the application starts a normal campaign workspace. The later merchant confirmation establishes that the valid-looking activity was unauthorised.', paths:[{ label:'Observed path', nodes:['attacker','merchant','webapp','orchestrator','workspace'] }] },
  '2': { title:'A preview job inherits delivery data', summary:'The audience service calculates 184 merchant-scoped matches. The model context contains a general audience description and approximate count. The asset-preview manifest also lists a member CSV staged through campaign_bundle_v2, and the Drive connector record shows its current state.', paths:[{ label:'Campaign input path', nodes:['merchant','webapp','orchestrator','workspace'] }, { label:'Drive connector state', nodes:['merchant','webapp','connector','drive'] }] },
  '3': { title:'A URL becomes executable code', summary:'The merchant supplies a GitHub Raw URL. The application downloads the file and then runs it with Python because policy approves those tools separately. GitHub is only the delivery host; the dangerous step is the unverified hand-off from URL to process.', paths:[{ label:'Retrieve and execute', nodes:['merchant','webapp','orchestrator','workspace','github','workspace'] }] },
  '4': { title:'The short-lived workspace creates durable risk', summary:'Before its five-minute disk disappears, the root-running task contacts suspicious domains, reaches EC2 metadata and saves the Nikto result and site archive to a link-readable Drive folder.', paths:[{ label:'Outbound callback', nodes:['workspace','callbacks'] }, { label:'Container-to-host path', nodes:['workspace','imds','ecsnode'] }, { label:'Persistence path', nodes:['workspace','connector','drive'] }] },
  '5': { title:'A public page collects and exports credentials', summary:'A later workspace restores the site from Drive and exposes it through LocalTunnel. A recipient submission is stored in the public Drive folder and then downloaded anonymously.', paths:[{ label:'Publication and collection', nodes:['drive','connector','workspace','tunnel','targets'] }, { label:'Submission exfiltration', nodes:['targets','tunnel','workspace','connector','drive','attacker'] }] },
  '6': { title:'Authority survives the session', summary:'Suspending the merchant stops its current login but does not cancel a previously authorised job or revoke the independent Google OAuth grant. The queued job therefore creates a new workspace and can restore the saved files after identity containment.', paths:[{ label:'Post-containment execution', nodes:['job','orchestrator','workspace','connector','drive'] }] }
};
const shortNode = {
  attacker:['?','Attacker','Untrusted device'], merchant:['ID','Merchant account','Valid session'], webapp:['AI','Campaign Assistant','Application'],
  orchestrator:['↻','Orchestrator','Service role'], workspace:['$','ECS workspace','Tool runtime'], connector:['◆','Connector broker','OAuth bridge'],
  github:['GH','GitHub Raw','Public content'], callbacks:['!','Callback domains','Malicious egress'], imds:['IAM','EC2 IMDS','Host metadata'],
  ecsnode:['EC2','ECS node','Shared host'], drive:['D','Google Drive','Persistent files'], tunnel:['↗','LocalTunnel','Public relay'],
  targets:['2+','Other merchants','Phishing targets'], job:['Q','Queued job','Stored decision']
};
const boundary = {
  attacker:'Untrusted device', merchant:'Merchant identity', webapp:'Application', orchestrator:'Application', connector:'Application',
  workspace:'AWS workload VPC', imds:'AWS workload VPC', ecsnode:'AWS workload VPC', job:'Application',
  github:'External service', callbacks:'External service', drive:'External service', tunnel:'External service', targets:'External recipients'
};

function visiblePhaseLabel(label) {
  const replacements = {
    'Phases 1–6':'Phases 1–5', 'Phases 2, 4–6':'Phases 3–5', 'Phases 1, 3–6':'Phases 1–5',
    'Phases 3–4':'Phases 2–3', 'Phase 4':'Phase 3', 'Phase 5':'Phase 4', 'Phase 6':'Phase 5'
  };
  return replacements[label] || label;
}

let discoveredPhases = [];
function updateIncidentNavigation() {
  try {
    const incidentState = JSON.parse(localStorage.getItem('rb-incident-state-v6') || '{}');
    discoveredPhases = Array.isArray(incidentState.openedPhases)
      ? incidentState.openedPhases.map(id => Number(String(id).replace('phase', ''))).filter(phase => playablePhases.includes(phase))
      : [];
  } catch (_) {
    discoveredPhases = [];
  }
  discoveredPhases = [...new Set(discoveredPhases)].sort((a, b) => a - b);
  const started = discoveredPhases.length > 0;
  document.getElementById('architectureSituationNav').classList.toggle('hidden', !started);
  document.getElementById('architectureAttackPathNav').classList.toggle('hidden', !started);
  document.getElementById('architectureSummaryNav').classList.toggle('hidden', !started);
  document.querySelectorAll('[data-architecture-phase]').forEach(item => {
    item.classList.toggle('hidden', !discoveredPhases.includes(Number(item.dataset.architecturePhase)));
  });
  document.querySelectorAll('[data-phase-filter]').forEach(button => {
    const phase = button.dataset.phaseFilter;
    const available = phase === 'all' ? discoveredPhases.length === 5 : discoveredPhases.includes(Number(phase));
    button.classList.toggle('hidden', !available);
  });
  return discoveredPhases;
}

function selectNode(id) {
  const data = nodeData[id]; if (!data) return;
  diagram.querySelectorAll('[data-node]').forEach(n => n.classList.toggle('selected', n.dataset.node === id));
  document.getElementById('detailTitle').textContent = data.title;
  document.getElementById('detailSummary').textContent = data.summary;
  document.getElementById('detailService').textContent = data.service;
  document.getElementById('detailRuntime').textContent = data.runtime;
  document.getElementById('detailPermission').textContent = data.permission;
  document.getElementById('detailEvidence').textContent = data.evidence;
  document.getElementById('detailBoundary').textContent = data.boundary;
  document.getElementById('detailQuestion').textContent = data.question;
  document.getElementById('detailPhase').textContent = visiblePhaseLabel(data.phase);
  status.textContent = data.statusText;
  status.className = `status-chip ${data.status}`;
}

function nodeButton(id) {
  const data = nodeData[id]; const [icon, title, summary] = shortNode[id];
  return `<button type="button" class="path-node-button ${data.status}" data-node="${id}"><span class="path-boundary">${boundary[id]}</span><span class="path-node-main"><span class="path-node-icon" aria-hidden="true">${icon}</span><b>${title}</b></span><small>${summary}</small></button>`;
}
function renderTrack(path) {
  const rows = [];
  for (let start = 0; start < path.nodes.length; start += 3) {
    const nodes = path.nodes.slice(start, start + 3);
    rows.push(`<div class="path-row">${nodes.map((id, index) => `${index ? '<span class="path-arrow" aria-hidden="true">→<small>crosses</small></span>' : ''}${nodeButton(id)}`).join('')}</div>`);
  }
  return `<div class="branch-label">${path.label}</div><div class="path-track">${rows.map((row, index) => `${index ? '<div class="path-turn" aria-hidden="true"><span>↙</span><small>continue from left below</small></div>' : ''}${row}`).join('')}</div>`;
}
function renderPhase(phase) {
  const all = phase === 'all';
  diagram.dataset.phase = phase;
  diagram.classList.toggle('all-paths', all);
  diagram.setAttribute('aria-label', all ? 'All incident attack paths' : `Phase ${displayPhase[phase]} attack path`);
  const phases = all ? playablePhases.map(String) : [phase];
  diagram.innerHTML = phases.map(number => {
    const meta = pathMeta[number];
    return `<section class="path-group"><div class="path-group-title"><b>Phase ${displayPhase[number]} · ${meta.title}</b><span>${all ? meta.summary : ''}</span></div>${meta.paths.map(renderTrack).join('')}</section>`;
  }).join('');
  diagram.querySelectorAll('[data-node]').forEach(node => node.addEventListener('click', () => selectNode(node.dataset.node)));
  const meta = all ? { title:'Complete incident path', summary:'All five phase paths are shown below. Select any node for its evidence and permissions.' } : pathMeta[phase];
  document.getElementById('phaseContextNumber').textContent = all ? 'All phases' : `Phase ${displayPhase[phase]}`;
  document.getElementById('phaseContextTitle').textContent = meta.title;
  document.getElementById('phaseContextSummary').textContent = meta.summary;
  document.querySelectorAll('.service-map [data-phases]').forEach(item => {
    const active = all || item.dataset.phases.split(' ').includes(phase);
    item.classList.toggle('architecture-dimmed', !active);
    item.classList.toggle('architecture-active', active && !all);
  });
  selectNode(all ? 'attacker' : pathMeta[phase].paths[0].nodes[0]);
}

document.querySelector('.phase-filter').addEventListener('click', event => {
  const button = event.target.closest('[data-phase-filter]'); if (!button) return;
  if (button.dataset.phaseFilter !== 'all' && !discoveredPhases.includes(Number(button.dataset.phaseFilter))) return;
  if (button.dataset.phaseFilter === 'all' && discoveredPhases.length !== 5) return;
  document.querySelectorAll('[data-phase-filter]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', item === button ? 'true' : 'false'); });
  renderPhase(button.dataset.phaseFilter);
});

function renderDiscoveredState() {
  const phases = updateIncidentNavigation();
  if (phases.length) {
    document.getElementById('nodeDetail').classList.remove('hidden');
    const active = document.querySelector('[data-phase-filter].active:not(.hidden)');
    renderPhase(active ? active.dataset.phaseFilter : String(phases[0]));
    return;
  }
  document.getElementById('phaseContextNumber').textContent = 'Not started';
  document.getElementById('phaseContextTitle').textContent = 'No incident path revealed';
  document.getElementById('phaseContextSummary').textContent = 'Open Phase 1 from the incident console before using this view.';
  diagram.innerHTML = '<p class="empty-map">The attack path will build as each phase is opened.</p>';
  document.getElementById('nodeDetail').classList.add('hidden');
  document.querySelectorAll('.service-map [data-phases]').forEach(item => item.classList.add('architecture-dimmed'));
}

renderDiscoveredState();
window.addEventListener('storage', renderDiscoveredState);
