// Site names checked against the Stack Exchange sites API on 2026-11-20 (site_state: normal).
export const NON_DEV_STACK_SITES = {
  money: 'personal finance, budgeting, taxes',
  cooking: 'recipes, techniques, ingredient substitutions',
  parenting: 'child behavior, schedules, family routines',
  travel: 'trip planning, visas, transport',
  workplace: 'coworkers, management, job problems',
  academia: 'grad school, research, teaching',
  pm: 'project planning, stakeholders, delivery',
  ux: 'user research, usability, interface design',
  webapps: 'web tools, online services, accounts',
  diy: 'home repair, renovation, tools',
  fitness: 'exercise, training, recovery',
  gardening: 'plants, soil, pests, landscaping',
  pets: 'dog and cat care, behavior, health',
  photo: 'cameras, lighting, editing',
  music: 'practice, instruments, theory',
  law: 'contracts, rights, legal procedures',
  freelancing: 'clients, invoicing, pricing work',
  softwarerecs: 'requests for software tools and apps',
  writing: 'drafting, editing, publishing',
  expatriates: 'moving abroad, residency, daily life',
  outdoors: 'hiking, camping, gear, safety',
  bicycles: 'bike repair, maintenance, riding',
  crafts: 'sewing, knitting, woodworking, materials',
  homebrew: 'brewing beer, fermentation, equipment',
  lifehacks: 'everyday routines, shortcuts, habits',
  sustainability: 'recycling, energy, low-waste living',
  languagelearning: 'learning a language, practice, study methods',
} as const;

export type NonDevStackSite = keyof typeof NON_DEV_STACK_SITES;

/** Keeps the allowed site names from a model's answer, in order, without duplicates. */
export function pickStackSites(value: unknown, max = 2): NonDevStackSite[] {
  if (!Array.isArray(value)) return [];
  const picked: NonDevStackSite[] = [];
  for (const item of value) {
    if (picked.length >= max) break;
    if (typeof item !== 'string') continue;
    const name = item.trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(NON_DEV_STACK_SITES, name)) continue;
    if (picked.includes(name as NonDevStackSite)) continue;
    picked.push(name as NonDevStackSite);
  }
  return picked;
}

export function stackSitesPrompt(): string {
  return Object.entries(NON_DEV_STACK_SITES).map(([name, description]) => `${name} (${description})`).join('; ');
}
