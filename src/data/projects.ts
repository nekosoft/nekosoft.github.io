export interface WorkItem {
  name: string;
  detail: string;
  href?: string;
  tag?: string;
}

/**
 * Interactive sessions hosted on this site as static pages under
 * public/projects/<slug>/. These run entirely in the browser — no accounts,
 * no backend, nothing leaves the room.
 */
export interface HostedProject extends WorkItem {
  href: string;
  /** Short label for what kind of thing this is. */
  kicker: string;
  /** Format at a glance: length, shape, who it is for. */
  facts: string[];
  /** Call to action on the tile. */
  cta: string;
}

export const hostedProjects: HostedProject[] = [
  {
    name: 'Roaming Bites — The Promotion That Wasn’t',
    kicker: 'Incident tabletop',
    detail:
      'An AI agent with cloud credentials starts doing things nobody asked for. Pick a response team, work the evidence as it lands, and commit to decisions you cannot take back. Built for security and engineering teams.',
    facts: ['5 phases', '~60 minutes', 'security & engineering'],
    href: '/projects/incident_roaming_bites/',
    cta: 'Open the console',
    tag: 'Training',
  },
  {
    name: 'Roaming Bites — The Page That Was Ours',
    kicker: 'Incident tabletop',
    detail:
      'A phishing page hosted by the platform itself. Eight seats exist and you fill six — the gaps you leave shape what the room can see. Written for mixed rooms: product, support, legal and data alongside engineering.',
    facts: ['6 phases', '~90 minutes', 'mixed cross-team rooms'],
    href: '/projects/incident_roaming_bites_pages/',
    cta: 'Open the console',
    tag: 'Training',
  },
  {
    name: 'What does the internet know about you?',
    kicker: 'Online footprint workshop',
    detail:
      'Three guided rounds through the places your details actually live, a directory of where to look, and a self-audit that ends in one change you will really make. Everything stays in the browser.',
    facts: ['~60 minutes', '3 audit rounds', '1 practical change'],
    href: '/projects/online_footprint_workshop/',
    cta: 'Open the workshop',
    tag: 'Training',
  },
  {
    name: 'What would make you believe it?',
    kicker: 'Social engineering workshop',
    detail:
      'Who targets us and why, what makes a story persuasive, and how public clues make it feel personal. Then teams of two or three build a pretext and the room pulls it apart.',
    facts: ['~60 minutes', 'teams of 2–3', 'self-audit + exercise'],
    href: '/projects/social_engineering_workshop/',
    cta: 'Open the workshop',
    tag: 'Training',
  },
];

export const otherProjects: WorkItem[] = [
  {
    name: 'smbscan',
    detail:
      'Contributor to this open-source tool for enumerating SMB file shares on an internal network.',
    href: 'https://github.com/jeffhacks/smbscan',
    tag: 'Open source',
  },
  {
    name: 'OWASP Low-Code/No-Code Top 10',
    detail:
      'Contributor — added business-user descriptions and plain-language examples so citizen developers can act on the risks.',
    href: 'https://owasp.org/www-project-top-10-low-code-no-code-security-risks',
    tag: 'Open source',
  },
  {
    name: 'Lely — secure robotics engineering',
    detail:
      'Secure development and engineering for agricultural robotics at Lely.',
    tag: 'Consulting',
  },
  {
    name: 'Agentic AI lifestyle assistants',
    detail:
      'Threat hunting, cloud security controls and penetration testing of LLM- and agent-powered consumer lifestyle assistants for an undisclosed client.',
    tag: 'Consulting',
  },
];

/** Hosted sessions first, then everything else — used by /experience. */
export const projects: WorkItem[] = [...hostedProjects, ...otherProjects];
