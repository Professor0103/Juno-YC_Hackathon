/**
 * What the analytics page reads. Everything here is derived from the entries
 * the user actually has — no figures are invented, and a corpus with nothing
 * in it produces an empty page rather than a plausible one.
 *
 * The one judgement call is MOOD_VALENCE below. Moods are free text on an
 * entry, and a bar that runs low-to-high needs them on a scale; that mapping
 * is a reading of the words, not a measurement, and it is written out in full
 * here rather than hidden in a formula so it can be argued with.
 */

/**
 * Mood words the corpus uses, placed on 0 (heaviest) to 1 (lightest). Anything
 * not listed is treated as unscored and left out of the average rather than
 * guessed at — a mood nobody has classified should not move the needle.
 */
const MOOD_VALENCE = {
  numb: 0.05,
  depleted: 0.1,
  rattled: 0.15,
  wired: 0.2,
  dread: 0.2,
  blunted: 0.25,
  flat: 0.3,
  detached: 0.3,
  unsettled: 0.35,
  guarded: 0.4,
  frayed: 0.25,
  raw: 0.3,
  tender: 0.55,
  moved: 0.6,
  determined: 0.6,
  steady: 0.7,
  clearer: 0.75,
  lighter: 0.8,
  hopeful: 0.85,
  calm: 0.85,
  settled: 0.9,
  quiet: 0.8,
  grateful: 0.9,
};

export function valenceOf(mood) {
  if (!mood) return null;
  const key = mood.trim().toLowerCase();
  return key in MOOD_VALENCE ? MOOD_VALENCE[key] : null;
}

/** Days back from now, for "no longer in use". */
const daysSince = (date, now) => (now - date) / 86_400_000;
const FADED_AFTER_DAYS = 7;

/**
 * Every theme in the corpus, with how often it appears and when it was last
 * written. `faded` is the design's "no longer in use": nothing in the last
 * week, which on a fortnight of entries is the difference between what someone
 * is still living in and what they have come out of.
 */
export function themeStats(entries, now = new Date()) {
  const byName = new Map();

  for (const entry of entries) {
    for (const theme of entry.themes ?? []) {
      const found = byName.get(theme) ?? { name: theme, count: 0, last: entry.at, valences: [] };
      found.count += 1;
      if (entry.at > found.last) found.last = entry.at;
      const valence = valenceOf(entry.mood);
      if (valence !== null) found.valences.push(valence);
      byName.set(theme, found);
    }
  }

  return [...byName.values()]
    .map((theme) => ({
      ...theme,
      faded: daysSince(theme.last, now) > FADED_AFTER_DAYS,
      /* The average weather a theme is written in — what sorts it into the
         lists on the right. Null when none of its entries carried a mood the
         table knows. */
      valence: theme.valences.length
        ? theme.valences.reduce((a, b) => a + b, 0) / theme.valences.length
        : null,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Where the themes sit. A ring layout rather than a force simulation: it is
 * deterministic, so the same corpus always draws the same map and nothing
 * drifts between renders, and it puts the heaviest theme in the middle where
 * the design has it.
 *
 * Coordinates are fractions of the plotting box, so the graph scales with
 * whatever it is drawn into.
 */
/**
 * How far out the rings sit, as a fraction of the plot. Kept well inside 0.5
 * so an outer circle's edge still lands inside the box — the map has no panel
 * under it, and a word that spills past the plot lands on the tree.
 */
const RING_RADII = [0.16, 0.3];
/** The plot is wider than tall, so the rings are too. */
const RING_STRETCH = 1.35;

export function layoutGraph(themes, { rings = [5, 8] } = {}) {
  const nodes = [];
  const [centre, ...rest] = themes;
  if (!centre) return { nodes: [], links: [] };

  nodes.push({ ...centre, x: 0.5, y: 0.5, ring: 0 });

  let index = 0;
  rings.forEach((size, ringIndex) => {
    const members = rest.slice(index, index + size);
    index += size;
    const radius = RING_RADII[ringIndex] ?? RING_RADII[RING_RADII.length - 1];
    // Offset every other ring by half a step so nodes don't line up spoke to
    // spoke, which is what makes a ring layout look like a dartboard.
    const turn = ringIndex % 2 ? Math.PI / members.length : 0;
    members.forEach((theme, i) => {
      const angle = (i / members.length) * Math.PI * 2 + turn - Math.PI / 2;
      nodes.push({
        ...theme,
        x: 0.5 + Math.cos(angle) * radius * RING_STRETCH,
        y: 0.5 + Math.sin(angle) * radius,
        ring: ringIndex + 1,
      });
    });
  });

  // Each node joins the nearest node one ring in, so the map reads as growing
  // out of the middle rather than as a wheel with spokes.
  const links = [];
  for (const node of nodes) {
    if (node.ring === 0) continue;
    const inner = nodes.filter((other) => other.ring === node.ring - 1);
    let nearest = inner[0];
    let best = Infinity;
    for (const candidate of inner) {
      const distance = (candidate.x - node.x) ** 2 + (candidate.y - node.y) ** 2;
      if (distance < best) {
        best = distance;
        nearest = candidate;
      }
    }
    if (nearest) links.push({ from: nearest, to: node });
  }

  return { nodes, links };
}

/**
 * The average weather across everything that carried a mood, 0 to 1. Null when
 * nothing does — the bar then says so rather than sitting at the midpoint,
 * which would read as "neutral" when it means "unknown".
 */
export function emotionalBalance(entries) {
  const scored = entries.map((entry) => valenceOf(entry.mood)).filter((v) => v !== null);
  if (scored.length === 0) return null;
  return scored.reduce((a, b) => a + b, 0) / scored.length;
}

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * The last `weeks` weeks as a grid: one column per weekday, one dot per entry,
 * coloured by that entry's mood. Monday first, as the design draws it.
 */
export function moodTrend(entries, { weeks = 3, now = new Date() } = {}) {
  const since = new Date(now);
  since.setDate(since.getDate() - weeks * 7);

  const columns = Array.from({ length: 7 }, (_, i) => ({
    // getDay() is Sunday-first; the design is Monday-first.
    day: (i + 1) % 7,
    label: WEEKDAY_INITIALS[(i + 1) % 7],
    dots: [],
  }));

  for (const entry of entries) {
    if (entry.at < since) continue;
    const column = columns.find((c) => c.day === entry.at.getDay());
    if (column) column.dots.push({ id: entry.id, valence: valenceOf(entry.mood) });
  }

  const deepest = Math.max(1, ...columns.map((c) => c.dots.length));
  return { columns, rows: deepest };
}

/**
 * The three lists beside the graph. Each is a slice of the same theme table,
 * so every line on them is something that was actually written.
 *
 *   recurring    what comes up most, whatever the weather
 *   concerns     what is written in the heaviest weather
 *   expectations what is written in the lightest — where things are going
 */
export function themeLists(themes, { size = 4 } = {}) {
  const scored = themes.filter((theme) => theme.valence !== null);
  const byValence = [...scored].sort((a, b) => a.valence - b.valence);

  return {
    recurring: themes.slice(0, size),
    concerns: byValence.slice(0, size),
    expectations: byValence.slice(-size).reverse(),
  };
}
