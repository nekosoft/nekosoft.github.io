const routes = [...document.querySelectorAll('.route')];
const navItems = [...document.querySelectorAll('[data-route]')];
const toast = document.getElementById('toast');
const storageKey = 'rb-pages-state-v1';
const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
let state = {
  seats: [], seatsLocked: false, openedPhases: [], decisions: {}, notes: {}, effects: {},
  rooms: {}, lensesUsed: {},
  board: { people: [], data: [], evidence: [], authority: [], service: 'Live' },
  ...stored
};
state.board = { people: [], data: [], evidence: [], authority: [], service: 'Live', ...(stored.board || {}) };
state.seats = Array.isArray(state.seats) ? state.seats : [];
state.openedPhases = Array.isArray(state.openedPhases) ? state.openedPhases : [];
state.effects = state.effects || {};
state.rooms = state.rooms || {};
state.lensesUsed = state.lensesUsed || {};

const phases = [1, 2, 3, 4, 5, 6];
const phaseTitle = { 1:'The call', 2:'The page', 3:'The change', 4:'The alerts', 5:'The scope', 6:'The split' };

/* ---------------------------------------------------------------- seats */

const seatInfo = {
  support: { name:'Merchant Support', person:'Femke Aalders', icon:'☎', art:'support-art', phase:1,  room:'b',
    lens:'What merchants are actually experiencing, and what they have already been told.' },
  tns:     { name:'Trust & Safety',   person:'Mira Oduya',    icon:'⚖', art:'tns-art',     phase:2,  room:'b',
    lens:'What the abuse policy was protecting against, and what it costs to weaken it.' },
  eng:     { name:'Software Engineering', person:'Tomas Reiner', icon:'⌗', art:'eng-art',  phase:3,  room:'b',
    lens:'What is actually buildable today, and how long a real fix takes.' },
  po:      { name:'Product Owner',    person:'Dana Vos',      icon:'◆', art:'po-art',      phase:3,  room:'a',
    lens:'What each option costs merchants and the season they are preparing for.' },
  sec:     { name:'Security Engineering', person:'Sam Achterberg', icon:'⌕', art:'sec-art', phase:4, room:'b',
    lens:'What the attacker does next, and which evidence disappears if you wait.' },
  data:    { name:'Data & Analytics', person:'Ravi Menon',    icon:'▦', art:'data-art',    phase:5,  room:'b',
    lens:'Which numbers are provable, which are estimates, and which are guesses.' },
  legal:   { name:'Legal, Risk & Privacy', person:'Claudia Stern', icon:'§', art:'legal-art', phase:5, room:'a',
    lens:'Which clock started, when, and what the company is now obliged to do.' },
  exec:    { name:'CTO / Exec',       person:'Joost Brand',   icon:'★', art:'exec-art',    phase:6,  room:'a',
    lens:'What the company can survive, and which call only this seat can make.' }
};
const seatOrder = ['support','tns','eng','po','sec','data','legal','exec'];
const SEATS_FILLED = 6;   // eight seats exist; a room fills six
const has = seat => state.seats.includes(seat);

/* ------------------------------------------------------------ narrative */

const storyReveals = {
  1: { time:'09:12', sev:'medium', sevLabel:'MEDIUM', title:'A merchant is on<br>the phone.', body:['Ilse Brandt runs Saffron & Smoke, a two-van operation that has used Roaming Bites for three years. She says someone from the payments team called her yesterday and told her to verify her payout details before the festival season rush.','She did what he asked, on a page she reached from a link he read out. This morning money is missing. She wants to know how there was a page like that on your own website.'], footer:'Start with what she saw. Then test it against what the systems recorded.' },
  2: { time:'10:05', sev:'high', sevLabel:'HIGH', title:'Where did the<br>page come from?', body:['The page sits on a Roaming Bites subdomain, on infrastructure the company controls. Nobody outside the company can put a file there.','Engineering has provided the records covering how a merchant request becomes a published page: the conversation, the safety checks that ran, the agent trace and the AWS calls.'], footer:'Follow the request from prompt to published page.' },
  3: { time:'11:20', sev:'high', sevLabel:'HIGH', title:'Where did that<br>configuration come from?', body:['The moderation record shows the page was measured against a configured threshold and cleared it.','Source control, the delivery board, the chat history and the CI pipeline hold the record of how that configuration reached its current value.'], footer:'Read the change, then read what surrounded it: the ticket, the thread, the pipeline.' },
  4: { time:'13:40', sev:'high', sevLabel:'HIGH', title:'Did anything<br>detect this?', body:['Two days passed between the page being published and Ilse Brandt telephoning support.','Detection, alerting and review records covering that period are available, along with the organisational records for the teams that own them.'], footer:'Compare what was raised with what was acted on.' },
  5: { time:'15:55', sev:'high', sevLabel:'SEV-2', title:'How many,<br>and can you prove it?', body:['The board wants a number this evening. The available records support several different numbers.','Your team must decide which figure the company is prepared to stand behind, knowing a clock started before anyone in this room was involved.'], footer:'Separate what was requested, what was submitted, and what is confirmed.' },
  6: { time:'17:30', sev:'high', sevLabel:'SEV-2', title:'The room<br>splits.', body:['A Reddit thread is climbing with a journalist in the comments. The board expects a statement before 20:00. Merchants are calling support now.','Two decisions have to be made at the same time, by different people, who will not be able to talk to each other while they make them.'], footer:'Each room decides on what it holds. You reconcile afterwards.' }
};

const phaseReveal = {
  phase1: [['people','Merchant reports financial loss'],['evidence','Three merchant reports within 48 hours']],
  phase2: [['authority','Public page published under a merchant account'],['evidence','Safety checks ran at publish time']],
  phase3: [['evidence','Safety ruleset changed 31 March'],['authority','Change reviewed and merged the same day']],
  phase4: [['evidence','Abuse alerts raised 5 May'],['people','Abuse review reassigned in February']],
  phase5: [['data','Collection endpoint recovered from the hosting provider'],['evidence','Impact populations under assessment']],
  phase6: [['people','Public thread and press queries in progress']]
};

/* ------------------------------------------------------- evidence help */

const evidenceSystemAbout = {
  'p1-call':'A support call transcript is a business record of what a person says happened. It is evidence of their actions and perceptions, not an automated measurement.',
  'p1-tickets':'A ticket queue is the company’s own record of what merchants reported and how each report was closed.',
  'p1-page':'A preserved artifact is a frozen copy of what a visitor could see at a point in time.',
  'p1-auth':'An identity service verifies users, applies login controls and issues the sessions the application trusts.',
  'p1-siem':'A SIEM collects and correlates security events from many systems into one searchable timeline.',
  'p2-prompt':'An application conversation record preserves the prompts and assistant responses tied to one session.',
  'p2-moderation':'A moderation decision log records which safety checks ran, what they scored and what verdict was returned.',
  'p2-policy':'A policy document states intent and ownership, and is versioned separately from the systems that implement it.',
  'p2-trace':'An agent trace is a structured log of the model’s plan, the tools it requested and the policy decisions around them.',
  'p2-cloudtrail':'AWS CloudTrail is the audit record of AWS API activity: who called which operation, with what parameters and result.',
  'p3-pr':'A pull request records a proposed code change, who reviewed it and what was said before it merged.',
  'p3-jira':'A delivery ticket records why work was requested and what business pressure surrounded it.',
  'p3-slack':'A chat thread is informal, human evidence of what people believed at the time.',
  'p3-ci':'A CI pipeline log records which automated checks ran on a change and what they reported.',
  'p3-metrics':'An operational metric shows system behaviour over time. It proves what changed, not why.',
  'p4-queue':'A review queue holds items awaiting human judgement.',
  'p4-routing':'A notification topic configuration shows where alerts are sent, and reports delivery to each configured endpoint.',
  'p4-guardduty':'A web application firewall inspects traffic to a distribution and raises findings on suspicious patterns.',
  'p4-siem':'An alert lifecycle report compares how many alerts were raised with how many a human acknowledged.',
  'p4-reorg':'An internal announcement is the organisation’s own record of a decision about who does what.',
  'p5-access':'CloudFront access logs record HTTP requests reaching a distribution — method, path and size, not content.',
  'p5-submissions':'A recovered collection store is data obtained from a third party — here, the host of the destination named in the form action.',
  'p5-network':'DNS and flow records show name resolution and connections. They establish intent and route, never successful transfer of content.',
  'p5-merchants':'A working sheet is responder-created analysis, not a system log.',
  'p5-dpa':'A data processing agreement is a contract defining what the company must do, and by when, when data is exposed.',
  'p6-reddit':'A public forum post is external, human-authored evidence that establishes awareness and reputational impact.',
  'p6-brief-a':'A room brief is the information one half of a split response actually holds while deciding.',
  'p6-brief-b':'A room brief is the information one half of a split response actually holds while deciding.',
  'p6-press':'A press query establishes what the outside world is already asking and what it will print if unanswered.'
};

const evidenceHelp = {
  'p1-call':{ system:'Merchant Support \u00b7 call transcript', action:'A recorded support call, transcribed.', look:'Note the address the caller reads out, and what she was asked to enter on it.' },
  'p1-tickets':{ system:'Merchant Support \u00b7 queue', action:'Recent tickets matching the keyword filter.', look:'Compare the merchants, the dates and how each ticket was closed.' },
  'p1-page':{ system:'Preserved artifact \u00b7 the page', action:'A preserved copy of the page the caller visited.', look:'Read the address in full, then list every field the form requests.' },
  'p1-auth':{ system:'Identity service \u00b7 merchant account', action:'Sign-in and account records for the account named in the page address.', look:'Compare the sign-in context against the account history, then check the MFA and session fields.' },
  'p1-siem':{ system:'RB Detect \u00b7 correlation view', action:'Events from identity, publishing, CDN and support on one timeline.', look:'Put the events in order and note which system each one came from.' },
  'p2-prompt':{ system:'Campaign Assistant \u00b7 conversation', action:'The conversation in which the page was requested.', look:'Follow what was asked for, what the assistant replied, and what passed between those two messages.' },
  'p2-moderation':{ system:'Campaign Safety \u00b7 moderation decisions', action:'The safety checks that ran against the page at publish time.', look:'Compare the score column against the threshold column on each row, then note where each verdict sent the item.' },
  'p2-policy':{ system:'Trust & Safety \u00b7 abuse policy', action:'The written rule for what Campaign Pages may host.', look:'Read the Category A list, then compare it against the verdicts in the moderation log.' },
  'p2-trace':{ system:'Campaign Assistant \u00b7 agent trace', action:'The model plan, tool calls and policy results for this run.', look:'Follow the steps in order. Note the parameters on each call and the two approval fields.' },
  'p2-cloudtrail':{ system:'AWS CloudTrail \u00b7 publish path', action:'The AWS API calls made while the page was published.', look:'Identify the principal, the resources touched, and the order of the three calls.' },
  'p3-pr':{ system:'Source control \u00b7 pull request', action:'A change to the safety ruleset, with its review.', look:'Read both files in the diff, then the description and the review comment.' },
  'p3-jira':{ system:'Delivery board \u00b7 ticket', action:'The ticket this change was made against.', look:'Note who raised it, what was asked for, and who is named in the comments.' },
  'p3-slack':{ system:'Chat \u00b7 #campaign-pages-launch', action:'Channel history from the day of the change.', look:'Follow the exchange in order, and note what is settled in it and by whom.' },
  'p3-ci':{ system:'CI \u00b7 pipeline run', action:'Automated checks on the change.', look:'Read the result line, the two warnings, and the CODEOWNERS entry beneath them.' },
  'p3-metrics':{ system:'CloudWatch \u00b7 block-rate metric', action:'Daily block-rate counts emitted by the safety filter.', look:'Compare the two windows in the table, and read them against the publishing volume.' },
  'p4-queue':{ system:'Abuse review queue', action:'Items awaiting human review.', look:'Find the entry for the page, then read the summary row at the foot of the table.' },
  'p4-routing':{ system:'AWS SNS \u00b7 topic subscriptions', action:'Topic configuration and delivery metrics for abuse alerts.', look:'Read each subscription endpoint, then the three delivery counters.' },
  'p4-guardduty':{ system:'AWS WAF + threat intelligence', action:'A finding raised against the distribution serving the page.', look:'Note the signal, the external destination and its registration date, then the action taken.' },
  'p4-siem':{ system:'RB Detect \u00b7 alert lifecycle', action:'Alerts raised against alerts acknowledged, by class.', look:'Compare the four rows across all five columns.' },
  'p4-reorg':{ system:'Internal announcement + charters', action:'A February announcement and the team charters either side of it.', look:'Compare the three charters against each other, then read what the announcement says about resourcing.' },
  'p5-access':{ system:'CloudFront \u00b7 access logs', action:'Requests to the page across the window that was retrieved.', look:'Check the window stated in the banner before you read the totals.' },
  'p5-submissions':{ system:'Recovered collection store', action:'What arrived at the collection endpoint.', look:'Read the fields-present and complete columns on every row before counting anything.' },
  'p5-network':{ system:'Route 53 Resolver + VPC Flow', action:'DNS and registration records for the destination named in the form action.', look:'Compare the registration date against the first resolution.' },
  'p5-merchants':{ system:'Data & Analytics \u00b7 working sheet', action:'Five candidate populations compiled by the response team.', look:'Read the Basis and Confidence columns alongside each count.' },
  'p5-dpa':{ system:'Legal & Privacy \u00b7 obligations', action:'The notification clause and the deadlines calculated from it.', look:'Note the trigger stated in each row, and what counsel records as unresolved.' },
  'p6-reddit':{ system:'Public forum \u00b7 r/smallbusinessuk', action:'A merchant describes the incident publicly.', look:'Check each claim in the post against the evidence you already hold.' },
  'p6-brief-a':{ system:'Room A \u00b7 exec and comms', action:'What the leaving room holds while it drafts the statement.', look:'Note which figure this brief carries, and where that figure came from.' },
  'p6-brief-b':{ system:'Room B \u00b7 technical and support', action:'What the staying room holds, including an update Room A does not have.', look:'Read the update, then decide what you do about the other room.' },
  'p6-press':{ system:'Inbound press queries', action:'Three external queries, each with a deadline.', look:'Note what each outlet is specifically asking for.' }
};

/* ------------------------------------------------------------- lenses */

const lenses = {
  1: { support: { title:'What merchants are already living through',
        text:'Two of these three reports were closed with generic scam advice, which is correct guidance and the wrong answer. Every hour the page stays up, someone else gets the call — and they will call us afterwards, not before. Whatever you choose, the merchants already affected need a human today, not a broadcast.' } },
  2: { tns: { title:'What that threshold was holding back',
        text:'Category A exists because a page on our subdomain is indistinguishable from a page by us — that is the whole reason the list is written the way it is. Tightening detection today will block legitimate merchants mid-season and support volume will spike. That is the actual price, and it may well be worth paying, but do not pretend it is free.' } },
  3: { eng: { title:'What is buildable before tomorrow',
        text:'A threshold revert is a config change — minutes. Making Category A structural, so a password field cannot exist on a Campaign Page at all, is about two days. Rescanning 1,100 pages is a batch job I can start this afternoon and it finishes overnight. What I cannot do quickly is tell you which of those pages is malicious rather than just noisy.' },
       po:  { title:'What this costs the people who pay us',
        text:'Festival season opens in seventeen days. These merchants have been preparing their biggest campaigns of the year and this feature is how they do it. Blanket-unpublishing will take down honest pages in the week that matters most, and those merchants will not distinguish between us being careless and us being cautious. I am not arguing against it. I am telling you the bill.' } },
  4: { sec: { title:'What happens next if you wait',
        text:'The domain was registered seven days before use, which means this was prepared, which means there is very likely more than one page. CloudFront access logs age out — if we do not pull the full retention window today, the early days of this are gone and we will never be able to size it. That evidence has a deadline and the deadline is not negotiable.' } },
  5: { data: { title:'Which of these numbers will survive a week',
        text:'Four of the five populations on that sheet are estimates dressed as counts. Unique clients is not merchants. POSTs include partials and the attacker’s own tests. The only row I would put in a filing is confirmed complete records in the recovered store. If we publish anything else, we will be correcting it publicly within days.' },
       legal: { title:'Which clock is already running',
        text:'Awareness almost certainly dates from 5 May, when our own systems recorded it — not from this morning when a human finally read it. That puts the 72-hour deadline at 09:48 on 8 May. Saying we became aware today is contradicted by our own logs, and the second press query is already asking exactly that question.' } },
  6: { exec: { title:'The call only this seat can make',
        text:'Taking the flagship feature offline seventeen days before the season is a decision with a revenue number attached and it is mine, not the incident team’s. So is deciding whether we say plainly that this was on our own domain. My read: we survive the outage. We do not survive being caught minimising it.' } }
};

/* --------------------------------------------------- gap consequences */

const gapEffects = {
  support: { lane:'people',   marker:'Gap · No Merchant Support owner',
    text:'Without Merchant Support in the room, nobody connects three separate tickets into one pattern, and nobody owns contacting the merchants already affected. The ticket queue stays a queue instead of becoming evidence.', hours:4,
    cause:'No Merchant Support seat — report pattern spotted late, affected merchants not contacted' },
  tns:     { lane:'authority',marker:'Gap · No Trust & Safety owner',
    text:'Without Trust & Safety, nobody can say what the credential-form threshold was protecting against. The team can restore the number without understanding why it existed — which is exactly how it got changed in the first place.', hours:2,
    cause:'No Trust & Safety seat — policy rationale unavailable, Category A restored without review' },
  eng:     { lane:'evidence', marker:'Gap · No Engineering owner',
    text:'Without Software Engineering, nobody can say what is actually shippable today. Remediation options get chosen on hope, and the rescan of 1,100 pages does not start this afternoon because nobody can start it.', hours:3,
    cause:'No Engineering seat — rescan delayed, remediation timelines unestimated' },
  po:      { lane:'people',   marker:'Gap · No Product Owner',
    text:'Without a Product Owner, the merchant cost of every containment option is invisible. The team optimises for safety with no one to state what seventeen days before festival season means to 5,100 businesses — and the trade-off gets made anyway, silently.', hours:1,
    cause:'No Product Owner seat — merchant cost of containment never weighed' },
  sec:     { lane:'evidence', marker:'Gap · No Security Engineering owner',
    text:'Without Security Engineering, the WAF finding is not triaged on day one and nobody pulls the full CloudFront retention window. The team sizes this incident on two days of logs when the page was live for nine — and does not know that yet.', hours:6,
    cause:'No Security Engineering seat — only a 2-day log window retrieved; true exposure understated' },
  data:    { lane:'data',     marker:'Gap · No Data & Analytics owner',
    text:'Without Data & Analytics, request counts and confirmed records blur together. The number the company reports is whichever one was nearest to hand, with no confidence rating attached to it.', hours:2,
    cause:'No Data & Analytics seat — reported figure not separated from request counts' },
  legal:   { lane:'authority',marker:'Gap · No Legal, Risk & Privacy owner',
    text:'Without Legal, Risk & Privacy, nobody starts the notification clock or resolves when awareness began. The 72-hour obligation runs from 5 May whether or not anyone in this room noticed it.', hours:2,
    cause:'No Legal seat — notification clock never started; DPA 9.3 deadline passed unrecorded' },
  exec:    { lane:'authority',marker:'Gap · No CTO / Exec owner',
    text:'Without an executive in the room, taking Campaign Pages offline is not a decision this team can make. It becomes an escalation, and the escalation costs hours the notification clock is already eating.', hours:5,
    cause:'No CTO seat — offline decision required escalation; option unavailable to the room' }
};

const seatWin = {
  support:{ lane:'people',   marker:'Report pattern joined into one incident' },
  tns:    { lane:'authority',marker:'Category A rationale restored to the decision' },
  eng:    { lane:'evidence', marker:'Rescan of 1,100 pages started same day' },
  po:     { lane:'people',   marker:'Merchant cost of containment stated explicitly' },
  sec:    { lane:'evidence', marker:'Full 9-day log window preserved before expiry' },
  data:   { lane:'data',     marker:'Confirmed records separated from request counts' },
  legal:  { lane:'authority',marker:'Notification clock started and dated' },
  exec:   { lane:'authority',marker:'Offline decision available to the room' }
};

/* Tier 2 — the branching evidence. Security Engineering's presence at Phase 4
   determines how much of the CloudFront retention window still exists at Phase 5. */
const scopeNarrow = { window:2, loaded:102, posts:27, confirmed:3, called:'unknown' };
const scopeWide   = { window:9, loaded:419, posts:104, confirmed:11, called:'unknown' };
const scope = () => (has('sec') ? scopeWide : scopeNarrow);

/* ------------------------------------------------------------ helpers */

function saveState() { localStorage.setItem(storageKey, JSON.stringify(state)); }
function escapeHtml(v) { return String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function openedPhaseNumbers() { return state.openedPhases.map(id => Number(String(id).replace('phase',''))).filter(n => phases.includes(n)).sort((a,b)=>a-b); }
function incidentStarted() { return openedPhaseNumbers().length > 0; }
function showToast(message) { toast.textContent = message; toast.classList.add('show'); window.clearTimeout(showToast.t); showToast.t = window.setTimeout(() => toast.classList.remove('show'), 2600); }
function canOpenPhase(p) {
  if (!state.seatsLocked) return false;
  if (p === 1) return true;
  return Boolean(state.decisions[`p${p - 1}`]);
}
function addMarker(lane, label, win = false, gap = false) {
  if (state.board[lane].some(i => i.label === label)) return;
  state.board[lane].push({ label, bonus: win, gap });
}

/* ------------------------------------------------------------- render */

function renderBoard() {
  document.getElementById('incidentBoard').classList.toggle('hidden', !state.seatsLocked);
  document.getElementById('teamChips').innerHTML = state.seats.length
    ? state.seats.map(id => `<span class="team-chip seat-${id}">${seatInfo[id].name}</span>`).join('')
      + seatOrder.filter(id => !has(id)).map(id => `<span class="team-chip empty-seat">${seatInfo[id].name} · empty</span>`).join('')
    : '';
  const empty = { people:'No affected people revealed', data:'No data exposure revealed', evidence:'No evidence recorded', authority:'No authority path revealed' };
  ['people','data','evidence','authority'].forEach(lane => {
    const target = document.getElementById(`board${lane[0].toUpperCase()}${lane.slice(1)}`);
    const items = state.board[lane];
    target.innerHTML = items.length
      ? items.map(i => `<span class="board-marker${i.bonus ? ' bonus' : ''}${i.gap ? ' gap' : ''}">${escapeHtml(i.label)}</span>`).join('')
      : `<em>${empty[lane]}</em>`;
  });
  const counts = ['people','data','evidence','authority'].map(l => state.board[l].length);
  const total = counts.reduce((a,b) => a + b, 0);
  document.getElementById('boardSummary').textContent = total
    ? `${total} marker${total === 1 ? '' : 's'} — People ${counts[0]} · Data ${counts[1]} · Evidence ${counts[2]} · Authority ${counts[3]}`
    : 'Nothing recorded yet.';
  const svc = document.getElementById('serviceStatus');
  svc.textContent = state.board.service;
  svc.parentElement.className = `service-state ${state.board.service.toLowerCase().replace(/\s+/g,'-')}`;
}

function renderSeats() {
  const picker = document.getElementById('seatPicker');
  if (!picker.children.length) {
    picker.innerHTML = seatOrder.map(id => {
      const s = seatInfo[id];
      return `<button class="role-card seat-card seat-${id}" data-seat="${id}" type="button">
        <div class="card-top"><span class="card-type">Phase ${s.phase} · Room ${s.room.toUpperCase()}</span><i>Empty</i></div>
        <div class="role-art ${s.art}"><span aria-hidden="true">${s.icon}</span><small>SEAT</small></div>
        <div class="card-name">${s.name}</div>
        <div class="card-person">${s.person}</div>
        <div class="card-stats"><span><em>Decisive lens</em>${s.lens}</span></div>
      </button>`;
    }).join('');
    picker.querySelectorAll('.seat-card').forEach(card => card.addEventListener('click', () => {
      if (state.seatsLocked) return;
      const id = card.dataset.seat;
      if (!has(id) && state.seats.length >= SEATS_FILLED) return;
      state.seats = has(id) ? state.seats.filter(s => s !== id) : [...state.seats, id];
      saveState(); renderSeats();
    }));
  }
  const count = state.seats.length;
  document.getElementById('seatCount').textContent = count;
  picker.querySelectorAll('.seat-card').forEach(card => {
    const filled = has(card.dataset.seat);
    card.classList.toggle('selected', filled);
    card.classList.toggle('locked', state.seatsLocked);
    // the room seats six of the eight; the two left over are the exercise
    card.disabled = state.seatsLocked || (!filled && count >= SEATS_FILLED);
    card.querySelector('i').textContent = filled ? 'Filled' : count >= SEATS_FILLED ? '—' : 'Empty';
  });
  const lock = document.getElementById('lockSeats');
  lock.disabled = count !== SEATS_FILLED || state.seatsLocked;
  lock.textContent = state.seatsLocked ? 'Room locked' : 'Lock the room';
  const begin = document.getElementById('openPhase1');
  begin.disabled = !state.seatsLocked;
  begin.textContent = state.seatsLocked ? 'Open Phase 1 →' : `Choose ${SEATS_FILLED} seats to begin`;
  const short = SEATS_FILLED - count;
  document.getElementById('seatStatus').textContent = state.seatsLocked
    ? `Room locked. ${seatOrder.length - count} seats stay empty — you will find out where that matters.`
    : short > 0 ? `Choose ${short} more. Two of the eight will stay empty whatever you pick.`
    : 'Six seats chosen. Check who is missing before you lock — that is the part that bites.';
  renderBoard(); renderPhaseAccess();
}

function renderPhaseAccess() {
  phases.forEach(p => {
    const nav = document.querySelector(`.nav-item[data-route="phase${p}"]`);
    if (nav) nav.disabled = !canOpenPhase(p);
  });
  document.getElementById('ledgerNav').classList.toggle('hidden', !incidentStarted());
  document.getElementById('summaryNav').classList.toggle('hidden', !incidentStarted());
}

function renderEvidenceHelp(targetId, tabs) {
  const help = evidenceHelp[targetId]; if (!help) return;
  const aside = tabs.nextElementSibling;
  aside.innerHTML = `<span class="orientation-icon" aria-hidden="true">?</span><div>
    <p><b>${help.system}</b><span>${evidenceSystemAbout[targetId] || ''}</span></p>
    <p><strong>Showing</strong><span>${help.action} <b class="look-label">Look for:</b> ${help.look}</span></p></div>`;
}

/* --------------------------------------------- tier 2: branching scope */

function applyScopeVariant() {
  const s = scope();
  document.querySelectorAll('#phase5 [data-variant]').forEach(el => {
    el.hidden = el.dataset.variant !== (has('sec') ? 'wide' : 'narrow');
  });
  const set = (sel, value) => document.querySelectorAll(sel).forEach(el => { el.textContent = value; });
  set('.v-loaded', String(s.loaded));
  set('.v-posts', String(s.posts));
  set('.v-confirmed', String(s.confirmed));
  set('.v-called', 'unknown');
  const count = document.querySelector('.variant-count');
  if (count) count.innerHTML = `<b>${s.confirmed} complete records</b> recovered across the ${s.window}-day window that was retrieved, after excluding partials and the attacker’s own test submissions.`;
  const clock = document.querySelector('.v-clock');
  if (clock) clock.innerHTML = has('legal')
    ? '<span class="pill amber">CLOCK STARTED · deadline 08 May 09:48</span>'
    : '<span class="pill red">NOT STARTED</span>';
  const inject = document.querySelector('.inject-body');
  if (inject) inject.innerHTML = has('sec')
    ? `<p>The full nine-day window was already preserved this morning, so the reconstruction only refines it: three further complete records have been matched to named merchants, bringing the confirmed total to <b>${s.confirmed}</b>.</p>
       <p>Room A is drafting with the same nine-day figure you have. The numbers agree.</p>`
    : `<p>The page was <b>not</b> live for two days. It was live for <b>nine</b> — published on 28 April under a different merchant account and moved on 5 May. The earlier window has now been reconstructed from CDN archives.</p>
       <p>Revised figures: <b>419</b> unique clients, <b>104</b> distinct submitting sources, <b>11</b> confirmed complete records.</p>
       <p class="inject-warn">Room A left the room believing this was a two-day incident affecting 3 confirmed merchants. They are drafting a public statement on that number right now.</p>`;
}

/* ------------------------------------------------------------ ledger */

function decidedPhases() { return phases.filter(n => state.decisions[`p${n}`]); }
function ledger() {
  const done = decidedPhases();
  const sc = scope();
  // a missing seat costs hours at the phase where that seat was decisive, once that phase is settled
  const missing = seatOrder.filter(id => !has(id));
  const charged = missing.filter(id => done.includes(seatInfo[id].phase));
  const hours = done.length ? 8 + charged.reduce((sum, id) => sum + gapEffects[id].hours, 0) : 0;
  const scoped = done.includes(5);
  return {
    started: done.length > 0, scoped,
    window: scoped ? sc.window : null, loaded: scoped ? sc.loaded : null,
    posts: scoped ? sc.posts : null, confirmed: scoped ? sc.confirmed : null,
    hours,
    clock: !scoped ? null : has('legal') ? 'Started · 05 May 09:48' : 'Never started',
    breach: !scoped ? '' : has('legal') ? (hours > 72 ? 'Deadline passed' : 'Within deadline') : 'Deadline passed unrecorded',
    missing, charged
  };
}
function renderLedger() {
  const l = ledger();
  const pending = '<em>Not yet established</em>';
  document.getElementById('ledgerGrid').innerHTML = [
    ['Collection window established', l.scoped ? `${l.window} days` : pending, l.scoped ? 'Days of access log retrieved' : 'Opens with Phase 5'],
    ['Unique clients that loaded the page', l.scoped ? String(l.loaded) : pending, l.scoped ? 'Upper bound — clients, not merchants' : 'Opens with Phase 5'],
    ['Distinct submitting sources', l.scoped ? String(l.posts) : pending, l.scoped ? 'Includes partials and test submissions' : 'Opens with Phase 5'],
    ['Confirmed complete records', l.scoped ? String(l.confirmed) : pending, l.scoped ? 'Recovered collection store' : 'Opens with Phase 5'],
    ['Hours to containment', l.started ? `${l.hours}h` : pending, l.started ? `8h baseline + ${l.hours - 8}h charged so far` : 'Accrues as decisions are recorded'],
    ['DPA 9.3 notification', l.clock || pending, l.breach || 'Opens with Phase 5']
  ].map(([label, value, detail]) => `<article class="ledger-cell"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join('');
  document.getElementById('ledgerCauses').innerHTML = l.charged.length
    ? `<p class="eyebrow">What the empty seats have cost so far</p>` + l.charged.map(id =>
        `<div class="cause-row"><b>+${gapEffects[id].hours}h</b><span>${gapEffects[id].cause}</span></div>`).join('')
    : l.started
      ? '<p class="note">Nothing charged yet. Costs appear as each phase is settled.</p>'
      : '<p class="note">The ledger fills in as the incident is worked.</p>';
}

/* ------------------------------------------------------------ routing */

function revealPhase(id) {
  if (!phaseReveal[id] || state.openedPhases.includes(id)) return;
  phaseReveal[id].forEach(([lane, label]) => addMarker(lane, label));
  state.openedPhases.push(id); saveState(); renderBoard(); renderPhaseAccess(); showToast('Incident board updated');
}

function openStoryReveal(phase) {
  const story = storyReveals[phase];
  if (!story || !document.body.classList.contains('facilitator')) return;
  document.getElementById('revealPhase').textContent = `Phase ${phase} of 6 · ${phaseTitle[phase]}`;
  document.getElementById('revealTime').textContent = story.time;
  document.getElementById('revealTitle').innerHTML = story.title;
  document.getElementById('revealBody').innerHTML = story.body.map(l => `<p>${l}</p>`).join('') + `<small>${story.footer}</small>`;
  document.getElementById('revealProgressBar').style.width = `${(phase / 6) * 100}%`;
  const d = document.getElementById('phaseRevealDialog');
  if (!d.open) d.showModal();
}

function navigate(id) {
  const m = id.match(/^phase([1-6])$/);
  if (m && !canOpenPhase(Number(m[1]))) {
    const open = phases.filter(canOpenPhase).pop();
    showToast(state.seatsLocked ? `Record the Phase ${Number(m[1]) - 1} decision first` : 'Lock the room to begin');
    id = open ? `phase${open}` : state.seatsLocked ? 'phase1' : 'seats';
  }
  if ((id === 'summary' || id === 'ledger') && !incidentStarted()) { id = 'briefing'; showToast('Available once Phase 1 opens'); }
  const first = /^phase[1-6]$/.test(id) && !state.openedPhases.includes(id);
  routes.forEach(r => r.classList.toggle('active-route', r.id === id));
  document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.route === id));
  const replay = document.getElementById('replayStory');
  const pm = id.match(/^phase([1-6])$/);
  replay.classList.toggle('hidden', !pm);
  replay.dataset.phase = pm ? pm[1] : '';
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
  revealPhase(id);
  if (id === 'phase5') applyScopeVariant();
  if (id === 'phase6') { applyScopeVariant(); renderReconciliation(); }
  if (id === 'ledger') renderLedger();
  if (id === 'summary') renderSummary();
  if (id === 'debrief') renderDebriefGaps();
  if (first && document.body.classList.contains('facilitator')) window.setTimeout(() => openStoryReveal(Number(id.replace('phase',''))), 120);
}
navItems.forEach(i => i.addEventListener('click', e => { e.preventDefault(); if (!i.disabled) navigate(i.dataset.route); }));

/* ------------------------------------------- per-phase DOM decoration */

phases.forEach(phase => {
  const section = document.getElementById(`phase${phase}`);
  const story = storyReveals[phase];
  const banner = document.createElement('article');
  banner.className = 'phase-story';
  banner.innerHTML = `<div class="phase-story-meta"><span>Phase ${phase} of 6</span><span class="story-sev ${story.sev}">${story.sevLabel}</span><time>${story.time} UTC</time></div>
    <h2>${story.title}</h2>
    <div class="phase-story-copy">${story.body.map(l => `<p>${l}</p>`).join('')}</div>
    <footer><small>${story.footer}</small><button class="story-reveal-button facilitator-only" type="button"><span>↺</span> Replay fullscreen</button></footer>`;
  banner.querySelector('.story-reveal-button').addEventListener('click', () => openStoryReveal(phase));
  section.prepend(banner);

  const tabs = section.querySelector('.evidence-tabs');
  const aside = document.createElement('aside');
  aside.className = 'evidence-orientation';
  aside.setAttribute('aria-live', 'polite');
  tabs.after(aside);
  renderEvidenceHelp(tabs.querySelector('.evidence-tab.active').dataset.target, tabs);
});

document.querySelectorAll('.evidence-tabs').forEach(group => {
  group.addEventListener('click', e => {
    const btn = e.target.closest('.evidence-tab'); if (!btn) return;
    const section = group.closest('.route');
    section.querySelectorAll('.evidence-tab').forEach(t => t.classList.remove('active'));
    section.querySelectorAll('.evidence-view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.target).classList.add('active');
    renderEvidenceHelp(btn.dataset.target, group);
  });
});

/* ------------------------------------------------------ lens machinery */

document.querySelectorAll('.decision-card[data-phase]').forEach(card => {
  const phase = card.dataset.phase;
  const base = Number(String(phase).replace(/[ab]/, ''));
  const set = lenses[base];
  if (set) {
    const holder = document.createElement('div');
    holder.className = 'lens-bar';
    const relevant = Object.keys(set).filter(seat => {
      if (phase === '6a') return seatInfo[seat].room === 'a';
      if (phase === '6b') return seatInfo[seat].room === 'b';
      return true;
    });
    holder.innerHTML = `<p class="lens-intro">Before you choose — the seats whose lens is decisive here:</p><div class="lens-buttons">${
      relevant.map(seat => has(seat)
        ? `<button class="lens-button" data-lens="${seat}" data-phase="${phase}" type="button"><span>${seatInfo[seat].icon}</span>${seatInfo[seat].name}</button>`
        : `<span class="lens-button empty"><span>◇</span>${seatInfo[seat].name} · seat empty</span>`).join('')
    }</div><div class="lens-output" aria-live="polite"></div>`;
    card.querySelector('.choices').before(holder);
    holder.querySelectorAll('.lens-button[data-lens]').forEach(b => b.addEventListener('click', () => {
      const seat = b.dataset.lens;
      const l = set[seat];
      state.lensesUsed[`${phase}:${seat}`] = true; saveState();
      b.classList.add('used');
      const out = holder.querySelector('.lens-output');
      if (out.querySelector(`[data-shown="${seat}"]`)) return;
      const box = document.createElement('div');
      box.className = 'lens-card';
      box.dataset.shown = seat;
      box.innerHTML = `<b><span class="lens-icon">${seatInfo[seat].icon}</span>${seatInfo[seat].name} — ${l.title}</b><p>${l.text}</p>`;
      out.appendChild(box);
    }));
  }
  if (!card.classList.contains('room-a-card') && !card.classList.contains('room-b-card')) {
    const outcome = document.createElement('div');
    outcome.className = 'role-outcome';
    outcome.setAttribute('aria-live', 'polite');
    card.appendChild(outcome);
  }
});

/* Tier 3 — options that require an authority the room does not have. */
function applyTier3() {
  if (has('exec')) return;
  const input = document.querySelector('input[name="p6a"][value="Pull Campaign Pages offline tonight and say so plainly"]');
  if (!input) return;
  const label = input.closest('label');
  if (label.classList.contains('locked-choice')) return;
  input.disabled = true;
  label.classList.add('locked-choice');
  label.insertAdjacentHTML('beforeend', '<span class="locked-note"><b>Unavailable · no CTO in the room</b>Taking the flagship feature offline is not this team’s decision to make. It becomes an escalation, and the escalation takes hours you do not have.</span>');
}

/* --------------------------------------------------------- decisions */

function applySeatEffect(phase) {
  const owners = seatOrder.filter(id => seatInfo[id].phase === Number(phase));
  owners.forEach(id => {
    if (has(id)) addMarker(seatWin[id].lane, seatWin[id].marker, true);
    else addMarker(gapEffects[id].lane, gapEffects[id].marker, false, true);
  });
  if (Number(phase) >= 2) state.board.service = 'Under review';
  saveState(); renderBoard(); renderPhaseAccess();
  renderOutcome(phase, owners);
}

/* What the evidence supports — shown only after the room commits that phase's
   decision. Scoped strictly to the phase: no forward references. */
const phaseFindings = {
  1: () => ({
    established: [
      'A page at bara-bara-bakehouse.roamingbites.example/payouts-verify requested an account holder name, sort code, account number and a Roaming Bites password. One merchant submitted to it and money left her account.',
      'The Bara Bara Bakehouse account was signed into on 5 May from an address, device and country never previously seen on it. The account has no MFA. The password was changed three minutes later from inside that same session, which is still active.',
      'The page was published under that account eleven minutes after the sign-in.',
      'Three merchants raised reports inside 48 hours. Two were closed with generic scam advice.'
    ],
    notEstablished: [
      'How the Bara Bara Bakehouse password was obtained.',
      'How many merchants were telephoned, or how many acted on the call. Those calls happened on the telephone network and Roaming Bites has no record of them — it never will.',
      'Whether any other page of this kind exists.',
      'Whether the account holder had any involvement. The evidence so far is consistent with that merchant being a victim whose account became the instrument.'
    ]
  }),
  2: () => ({
    established: [
      'The page was generated by the Campaign Assistant on request, inside the compromised session, and published through the ordinary path in about four minutes.',
      'The credential-form check ran and matched — a password field beside financial fields — scoring 0.81 against a configured threshold of 0.90, and returned ALLOW.',
      'The item was queued for asynchronous abuse review at the moment it was allowed.',
      'The written abuse policy lists collection of a Roaming Bites password and of bank details as Category A: blocked, with no merchant override.',
      'No AWS control was bypassed or exceeded. The publisher role did exactly what it is configured to do.',
      'The only human check in the flow asked the account holder to confirm intent, and accepted a free-text assurance.'
    ],
    notEstablished: [
      'Why the threshold holds the value it holds, or when it acquired it.',
      'What happened to the queued review item.',
      'Whether other pages have cleared the same check.'
    ]
  }),
  3: () => ({
    established: [
      'The threshold was raised from 0.55 to 0.90 on 31 March by PR #4127, opened and merged four minutes apart with one approval.',
      'The same commit deleted the test asserting a block on password-plus-bank-fields, replacing it with a test for merchant sign-in copy. The suite passed because that assertion no longer existed.',
      'The pipeline printed warnings for both the removed test and the modified safety rule. Neither is a failure condition, so the build was green.',
      'CODEOWNERS names Trust & Safety for the rules path, but path-based review enforcement was not active on the repository.',
      'The change answered three merchant escalations about legitimate pages being blocked. Those false positives were real.',
      'Block rate fell from 27% to 0.3% while publishing volume rose. Roughly 1,100 pages were published under the changed rule.',
      'Trust & Safety raised a concern in chat three hours after the merge. It was not recorded anywhere with a tracking number.'
    ],
    notEstablished: [
      'How many of those ~1,100 pages are malicious rather than merely previously blocked.',
      'Whether anyone was monitoring the block-rate metric, or what alarm existed on it.',
      'Whether the reviewer understood what the deleted test asserted.'
    ]
  }),
  4: () => ({
    established: [
      'Three separate detections existed on 5 May: the moderation flag at publish, the WAF finding an hour later, and the SIEM record.',
      'All routed to rb-abuse-escalation-prod. SNS reports 2,847 messages published, 2,847 delivered and 0 failed across 90 days.',
      'The queue holds 2,847 unreviewed items, the oldest 61 days. The last item marked reviewed by a human is dated 19 February.',
      'Every alert class with a named owner is acknowledged within half an hour. Content abuse has no owner and zero acknowledgements.',
      'Abuse review moved from Trust & Safety to Merchant Support on 1 March with no headcount added, no handover and no change to alert routing. The subscription still addresses the former team.',
      'The destination domain was registered on 28 April, seven days before it was used.'
    ],
    notEstablished: [
      'Whether any person received mail at the subscribed address. SNS reports delivery to an endpoint, not receipt by a reader.',
      'How many of the 2,847 queued items describe live attacks.',
      'How many people reached the page, or what they submitted.'
    ]
  }),
  5: () => {
    const s = scope();
    const est = [
      `The retrieved log window covers ${s.window} days. Within it: ${s.loaded} unique clients and ${s.posts} distinct submitting sources.`,
      `The recovered collection store holds ${s.confirmed} complete records — a Roaming Bites password alongside bank details — after excluding partials and submissions from the attacker's own address.`,
      'Two merchants have confirmed financial loss through support.',
      'The form posted to collect.payout-verify-cdn.example. The submitted data never touched Roaming Bites infrastructure; the store was recovered only because the hosting provider cooperated.',
      'DPA 9.3 obliges notification within 72 hours of awareness. The company\u2019s own systems recorded this incident on 5 May.'
    ];
    const not = [
      'How many merchants were telephoned. No telephony evidence exists and none can be obtained.',
      'Whether any captured credential has been used elsewhere.',
      'Whether unique clients or submitting sources correspond one-to-one with merchants. They do not.'
    ];
    if (s.window === 2) not.push('Whether the retrieved window covers the page\u2019s full lifetime. Only the days someone thought to pull have been examined.');
    return { established: est, notEstablished: not };
  }
};

function renderOutcome(phase, owners) {
  const card = document.querySelector(`.decision-card[data-phase="${phase}"]`);
  const box = card && card.querySelector('.role-outcome');
  if (!box) return;
  const next = card.querySelector('.commit[data-next]')?.dataset.next;
  const blocks = owners.map(id => has(id)
    ? `<div class="outcome-row"><span class="outcome-icon">${seatInfo[id].icon}</span><div><b>${seatInfo[id].name} — lens applied</b><span>${seatWin[id].marker}. ${seatInfo[id].person} carried this decision.</span></div></div>`
    : `<div class="outcome-row gap"><span class="outcome-icon">◇</span><div><b>${seatInfo[id].name} — seat empty</b><span>${gapEffects[id].text}</span></div></div>`).join('');
  const f = phaseFindings[Number(phase)] && phaseFindings[Number(phase)]();
  const findingsBlock = f ? `<div class="findings">
    <div class="findings-col established"><b>What the evidence establishes</b><ul>${f.established.map(i => `<li>${i}</li>`).join('')}</ul></div>
    <div class="findings-col open"><b>What it does not establish</b><ul>${f.notEstablished.map(i => `<li>${i}</li>`).join('')}</ul></div>
  </div>` : '';
  box.className = `role-outcome show${owners.every(has) ? '' : ' gap'}`;
  box.innerHTML = findingsBlock + blocks + `<div class="outcome-actions">
    <button class="view-board" type="button">↑ View operating picture</button>
    <button class="view-ledger" type="button">◫ Consequence ledger</button>
    ${next ? `<button class="continue-phase" type="button">Continue to Phase ${Number(next.replace('phase',''))} →</button>` : ''}</div>`;
  box.querySelector('.view-board').addEventListener('click', () => document.getElementById('incidentBoard').scrollIntoView({ behavior:'smooth', block:'start' }));
  box.querySelector('.view-ledger').addEventListener('click', () => navigate('ledger'));
  if (next) box.querySelector('.continue-phase').addEventListener('click', () => navigate(next));
}

document.querySelectorAll('.commit').forEach(btn => btn.addEventListener('click', () => {
  const card = btn.closest('.decision-card');
  const phase = card.dataset.phase;
  const sel = card.querySelector('input[type="radio"]:checked');
  if (!sel) { card.querySelector('.commit-status').textContent = 'Choose a position first.'; return; }
  state.decisions[`p${phase}`] = sel.value;
  state.notes[`p${phase}`] = card.querySelector('textarea').value;
  saveState();
  applySeatEffect(phase);
  card.querySelector('.commit-status').textContent = 'Decision recorded locally.';
  showToast('Decision recorded · outcome below');
  card.querySelector('.role-outcome').scrollIntoView({ behavior:'smooth', block:'nearest' });
}));

document.querySelectorAll('.commit-room').forEach(btn => btn.addEventListener('click', () => {
  const card = btn.closest('.decision-card');
  const room = btn.dataset.room;
  const sel = card.querySelector('input[type="radio"]:checked');
  if (!sel) { card.querySelector('.commit-status').textContent = 'Record the room’s position first.'; return; }
  state.rooms[room] = sel.value;
  state.notes[`p6${room}`] = card.querySelector('textarea').value;
  if (state.rooms.a && state.rooms.b) {
    state.decisions.p6 = `Room A: ${state.rooms.a} · Room B: ${state.rooms.b}`;
    applySeatEffect('6');
  }
  saveState();
  card.querySelector('.commit-status').textContent = `Room ${room.toUpperCase()} recorded.`;
  renderReconciliation();
  showToast(state.rooms.a && state.rooms.b ? 'Both rooms in · reconciliation unlocked' : `Room ${room.toUpperCase()} recorded · waiting for the other room`);
}));

document.querySelectorAll('textarea[data-notes]').forEach(area => {
  area.value = state.notes[area.dataset.notes] || '';
  area.addEventListener('change', () => { state.notes[area.dataset.notes] = area.value; saveState(); });
});
Object.entries(state.decisions).forEach(([name, value]) => {
  const input = document.querySelector(`input[name="${name}"][value="${CSS.escape(value)}"]`);
  if (input) input.checked = true;
});
Object.entries(state.rooms).forEach(([room, value]) => {
  const input = document.querySelector(`input[name="p6${room}"][value="${CSS.escape(value)}"]`);
  if (input) input.checked = true;
});

/* --------------------------------------------------- reconciliation */

function renderReconciliation() {
  const panel = document.getElementById('reconciliation');
  const ready = Boolean(state.rooms.a && state.rooms.b);
  panel.classList.toggle('hidden', !ready);
  if (!ready) return;
  const s = scope();
  const escalated = /Escalate the new finding/.test(state.rooms.b || '');
  const wentPublic = /Reply publicly/.test(state.rooms.b || '');
  const silent = /Say nothing publicly/.test(state.rooms.a || '');
  const contradiction = !has('sec');

  const rows = [];
  rows.push(`<div class="recon-pair">
    <div class="recon-room a"><b>Room A decided</b><p>${escapeHtml(state.rooms.a)}</p>${state.notes.p6a ? `<small>Statement: “${escapeHtml(state.notes.p6a)}”</small>` : ''}</div>
    <div class="recon-room b"><b>Room B decided</b><p>${escapeHtml(state.rooms.b)}</p>${state.notes.p6b ? `<small>To Room A: “${escapeHtml(state.notes.p6b)}”</small>` : ''}</div>
  </div>`);

  if (contradiction) {
    rows.push(`<div class="recon-finding critical">
      <b>The two rooms were working from different incidents.</b>
      <p>Room A drafted a statement believing this was a <b>2-day</b> incident with <b>3</b> confirmed records. While they were out of the room, Room B learned it was <b>9 days</b> and <b>11</b> confirmed records, across <b>104</b> distinct submitting sources.</p>
      <p>Nobody withheld anything. The information simply arrived in the room that had already left.</p>
      ${escalated
        ? '<p class="recon-mitigated"><b>Room B chose to stop Room A before they published.</b> The correction reached them in time — at the cost of the entire evening on the public thread, which stayed unanswered with a journalist in it. That was the right call and it was not free.</p>'
        : '<p class="recon-unmitigated"><b>Room B did not interrupt Room A.</b> The statement goes out with a number the company’s own logs contradict. The second press query already asks when you first became aware — and the answer in your systems is 5 May, three separate times.</p>'}
    </div>`);
  } else {
    rows.push(`<div class="recon-finding">
      <b>Both rooms held the same figures.</b>
      <p>Because Security Engineering preserved the full nine-day window on day one, Room A drafted on the same <b>${s.confirmed}</b> confirmed records that Room B was refining. The reconciliation is a refinement, not a contradiction.</p>
      <p>Worth naming anyway: that alignment was luck of seating, not process. Nothing in the split guaranteed it.</p>
    </div>`);
  }

  if (wentPublic && silent) {
    rows.push(`<div class="recon-finding critical"><b>The company spoke and stayed silent at the same time.</b>
      <p>Room B posted publicly in the thread while Room A decided to issue no statement tonight. Externally that reads as an unauthorised employee comment, and it is now the company’s on-record position whether or not anyone intended it.</p></div>`);
  }

  const missing = seatOrder.filter(id => !has(id));
  if (missing.length) {
    rows.push(`<div class="recon-finding"><b>Seats that were not in either room</b>
      <ul>${missing.map(id => `<li><b>${seatInfo[id].name}</b> — ${gapEffects[id].cause}</li>`).join('')}</ul></div>`);
  }

  rows.push(`<div class="recon-finding"><b>The question to sit with</b>
    <p>Neither room did anything unreasonable. Both were working the problem in front of them with the information they had. Ask the room: what would have had to be true, earlier today, for these two decisions to have been made on the same facts?</p></div>`);

  document.getElementById('reconBody').innerHTML = rows.join('');
}

/* -------------------------------------------------------- the record */

function renderSummary() {
  const l = ledger();
  const done = decidedPhases();
  const body = document.getElementById('summaryBody');
  if (!done.length) {
    body.innerHTML = `<article class="panel"><p class="eyebrow">Nothing recorded yet</p>
      <h2>The record is written as you work</h2>
      <p class="note">This page assembles itself from the phases you have settled. It stays empty until the first decision is recorded, so it cannot be read ahead as a walkthrough.</p></article>`;
    return;
  }
  const narrative = done.map(p => {
    const f = phaseFindings[p] && phaseFindings[p]();
    if (!f) return '';
    return `<div class="record-phase"><b>Phase ${p} · ${phaseTitle[p]}</b>
      <ul>${f.established.map(i => `<li>${i}</li>`).join('')}</ul>
      <p class="record-open"><b>Not established at this point:</b> ${f.notEstablished.join(' ')}</p></div>`;
  }).join('');

  body.innerHTML = `
    <div class="summary-meta">
      <div><span>Status</span><strong>${state.decisions.p6 ? 'Ready for review' : `In progress · Phase ${done[done.length - 1]}`}</strong></div>
      <div><span>Severity</span><strong>${done.length >= 4 ? 'SEV-2' : done.length >= 2 ? 'SEV-2 proposed' : 'Not declared'}</strong></div>
      <div><span>Campaign Pages</span><strong>${state.board.service}</strong></div>
      <div><span>Seats filled</span><strong>${state.seats.length} of 8</strong></div>
    </div>

    <article class="panel">
      <p class="eyebrow">Established so far</p>
      <h2>What this team has evidence for</h2>
      <p class="note">Built only from phases this team has settled. Phases not yet reached do not appear.</p>
      ${narrative}
    </article>

    <article class="panel">
      <p class="eyebrow">Consequence ledger</p>
      <h2>What it has cost</h2>
      <div class="ledger-grid small">
        <article class="ledger-cell"><span>Hours to containment</span><strong>${l.hours}h</strong><small>8h baseline + ${l.hours - 8}h charged so far</small></article>
        <article class="ledger-cell"><span>DPA 9.3 notification</span><strong>${l.clock || '—'}</strong><small>${l.breach || 'Opens with Phase 5'}</small></article>
        <article class="ledger-cell"><span>Confirmed records</span><strong>${l.scoped ? l.confirmed : '—'}</strong><small>${l.scoped ? 'Recovered collection store' : 'Opens with Phase 5'}</small></article>
        <article class="ledger-cell"><span>Seats unfilled</span><strong>${l.missing.length}</strong><small>${l.missing.length ? l.missing.map(id => seatInfo[id].name).join(', ') : 'None'}</small></article>
      </div>
    </article>

    <article class="panel">
      <p class="eyebrow">Decisions recorded</p>
      <h2>What this team chose</h2>
      <table class="log-table">
        <thead><tr><th>Phase</th><th>Decision</th><th>Seat outcome</th><th>Team note</th></tr></thead>
        <tbody>${done.map(p => {
          const owners = seatOrder.filter(id => seatInfo[id].phase === p);
          return `<tr><td><b>${p}</b><small>${phaseTitle[p]}</small></td>
            <td>${escapeHtml(state.decisions[`p${p}`])}</td>
            <td>${owners.map(id => has(id) ? `${seatInfo[id].name} present` : `<b>${seatInfo[id].name} absent</b>`).join('<br>')}</td>
            <td>${escapeHtml(state.notes[`p${p}`] || '—')}</td></tr>`;
        }).join('')}</tbody>
      </table>
    </article>

    ${state.rooms.a && state.rooms.b ? `<article class="panel">
      <p class="eyebrow">Phase 6 · the split</p>
      <h2>Two rooms, two decisions</h2>
      <p><b>Room A (exec and comms):</b> ${escapeHtml(state.rooms.a)}</p>
      <p><b>Room B (technical and support):</b> ${escapeHtml(state.rooms.b)}</p>
      ${!has('sec') ? '<p class="summary-warn"><b>The rooms did not agree on the facts.</b> Room A drafted on a two-day, 3-record incident. Room B held a nine-day, 11-record reconstruction. Both were acting in good faith on what they had.</p>' : ''}
    </article>` : ''}

    ${state.decisions.p6 ? `<article class="panel">
      <p class="eyebrow">Contributing conditions</p>
      <h2>What would have to change</h2>
      <ul class="condition-list">
        <li>Campaign Pages publishes merchant content on first-party subdomains and certificates, giving merchant-authored pages the platform&rsquo;s own trust signals.</li>
        <li>A Category A safety control was enforced by a tunable threshold rather than structurally, so one configuration change removed it.</li>
        <li>The test asserting the blocked case was deleted in the same commit as the threshold change, and a green build was the reviewer&rsquo;s signal.</li>
        <li>CODEOWNERS would have summoned Trust &amp; Safety to the rule change, but path-based review enforcement was never enabled.</li>
        <li>Abuse review was reassigned without headcount, handover or an alerting change, and no metric exists for alerts delivered to an unowned destination.</li>
        <li>Merchant accounts do not require MFA, and the Assistant&rsquo;s only human check asks the account holder.</li>
      </ul>
    </article>` : ''}`;
}

function renderDebriefGaps() {
  const missing = seatOrder.filter(id => !has(id));
  document.getElementById('debriefGaps').innerHTML = missing.length
    ? `<div class="debrief-gaps">${missing.map(id => `<div><b>${seatInfo[id].name}</b><p>${gapEffects[id].text}</p></div>`).join('')}</div>`
    : '<p class="note">This room filled all eight seats. Ask them which lens they would have lost first, and what they think would have happened.</p>';
}

/* ------------------------------------------------------------ chrome */

const boardEl = document.getElementById('incidentBoard');
const boardToggle = document.getElementById('boardToggle');
function drawBoardCollapse() {
  const open = Boolean(state.boardOpen);
  boardEl.classList.toggle('collapsed', !open);
  boardToggle.textContent = open ? 'Hide board' : 'Show board';
  boardToggle.setAttribute('aria-expanded', String(open));
}
boardToggle.addEventListener('click', () => {
  state.boardOpen = !state.boardOpen; saveState(); drawBoardCollapse();
});

document.getElementById('lockSeats').addEventListener('click', () => {
  if (state.seats.length !== SEATS_FILLED) return;
  state.seatsLocked = true; saveState(); renderSeats(); applyTier3();
  showToast(`Room locked · ${seatOrder.length - state.seats.length} seats empty`);
});

document.getElementById('printBriefA').addEventListener('click', () => printBrief('a'));
document.getElementById('printBriefB').addEventListener('click', () => printBrief('b'));
function printBrief(room) {
  applyScopeVariant();
  document.body.classList.add(`brief-print-${room}`);
  window.print();
  window.setTimeout(() => document.body.classList.remove(`brief-print-${room}`), 600);
}

document.getElementById('printSummary').addEventListener('click', () => {
  document.body.classList.add('summary-print');
  window.print();
  window.setTimeout(() => document.body.classList.remove('summary-print'), 600);
});

document.getElementById('revealToEvidence').addEventListener('click', () => document.getElementById('phaseRevealDialog').close());
document.getElementById('replayStory').addEventListener('click', e => {
  const p = Number(e.currentTarget.dataset.phase);
  if (p) openStoryReveal(p);
});
document.getElementById('openRecord').addEventListener('click', () => navigate('summary'));

document.getElementById('facilitatorToggle').addEventListener('click', () => {
  document.body.classList.toggle('facilitator');
  const on = document.body.classList.contains('facilitator');
  if (!on && document.getElementById('phaseRevealDialog').open) document.getElementById('phaseRevealDialog').close();
  showToast(on ? 'Facilitator controls visible' : 'Participant mode');
});
if (new URLSearchParams(location.search).get('facilitator') === '1') document.body.classList.add('facilitator');

document.getElementById('resetScenario').addEventListener('click', () => {
  if (!window.confirm('Clear the assigned seats, incident board, decisions and both room positions?')) return;
  localStorage.removeItem(storageKey);
  location.href = location.pathname;
});

let remaining = 600, timerId = null;
const timerDisplay = document.getElementById('timerDisplay');
const timerToggle = document.getElementById('timerToggle');
function drawTimer() {
  const m = Math.floor(remaining / 60).toString().padStart(2, '0');
  const s = (remaining % 60).toString().padStart(2, '0');
  timerDisplay.textContent = `${m}:${s}`;
  timerDisplay.style.color = remaining <= 60 ? '#ffb1a8' : '';
}
timerToggle.addEventListener('click', () => {
  if (timerId) { clearInterval(timerId); timerId = null; timerToggle.textContent = 'Start'; return; }
  timerToggle.textContent = 'Pause';
  timerId = setInterval(() => {
    remaining = Math.max(0, remaining - 1); drawTimer();
    if (remaining === 0) { clearInterval(timerId); timerId = null; timerToggle.textContent = 'Start'; showToast('Review time is up'); }
  }, 1000);
});
document.getElementById('timerReset').addEventListener('click', () => { remaining = 600; drawTimer(); });

/* --------------------------------------------------------- start-up */

renderSeats();
drawBoardCollapse();
if (state.seatsLocked) applyTier3();
applyScopeVariant();
phases.forEach(p => { if (state.decisions[`p${p}`]) applySeatEffect(String(p)); });
renderReconciliation();
const requested = location.hash.slice(1);
navigate(requested && document.getElementById(requested) ? requested : 'briefing');
