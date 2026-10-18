// Career quiz engine tests. Run with:  node --test tests/riasec.test.js
//
// Scores hand-built student personas with exactly the code the browser
// runs, and checks the careers they are shown make sense.
const test = require('node:test');
const assert = require('node:assert');
const E = require('../scripts/riasec_engine.js');
const { RIASEC_CAREERS } = require('../scripts/riasec_careers.js');

const Q = E.RS_QUESTIONS;
const PART1 = Q.filter(q => q.type === 'choice');

// The area an option mainly scores.
const areaOf = o => Object.keys(o.w).reduce((a, b) => (o.w[b] > o.w[a] ? b : a));

// likes: { all: ['R', 'I'], Q2: ['I'] } — in every Part 1 question the
//   persona ticks the options for these areas (up to the question's limit);
//   a question id overrides. `all` may be a function of the question's
//   position, for students whose answers vary.
// worlds: { D1: ['digital'], ..., D5: ['digital', 'machines'] }
// subjects: { S1: ['maths', 'physics'], S2: ['computers'] } — Part 3. If
//   left out the persona ticks Maths in both, a neutral-ish default.
function persona(likes, worlds, subjects) {
  const subj = subjects || { S1: ['maths'], S2: ['maths'] };
  const answers = Q.map(q => {
    if (q.type === 'choice') {
      const pos = PART1.indexOf(q);
      const want = likes[q.id] || (typeof likes.all === 'function' ? likes.all(pos) : likes.all);
      const picks = want.map(d => q.opts.findIndex(o => areaOf(o) === d)).slice(0, q.maxSelect);
      return { indices: picks };
    }
    if (q.type === 'subject') {
      return { indices: (subj[q.id] || ['maths']).map(k => q.opts.findIndex(o => o.subject === k)).slice(0, q.maxSelect) };
    }
    const picks = (worlds[q.id] || []).map(k => q.opts.findIndex(o => o.domain === k)).filter(i => i >= 0);
    // A domain question must have an answer; fall back to the first option.
    return { indices: picks.length ? picks : [0] };
  });
  const scoring = E.rsScore(answers, Q);
  return { scoring, results: E.rsBuildResults(scoring, RIASEC_CAREERS) };
}

const titles = p => p.results.top_careers.map(c => c.title);
const families = p => p.results.top_careers.map(c =>
  RIASEC_CAREERS.find(x => x.title === c.title).family);
const matchOf = (p, title) =>
  E.rsMatchCareers(p.scoring, RIASEC_CAREERS).all.find(s => s.career.title === title).match_pct;

test('question set and career data are valid', () => {
  const v = E.rsValidateQuestions();
  assert.deepStrictEqual(v.problems, []);
  assert.deepStrictEqual(E.rsValidateCareers(RIASEC_CAREERS), []);
  // Every area has the same ceiling.
  const maxima = Object.values(v.maxima).map(x => x.toFixed(6));
  assert.strictEqual(new Set(maxima).size, 1, JSON.stringify(v.maxima));
});

test('no option is repeated anywhere in the quiz', () => {
  // The two subject questions share one subject list by design.
  const texts = Q.filter(q => q.type !== 'subject').flatMap(q => q.opts.map(o => o.text));
  assert.strictEqual(new Set(texts).size, texts.length);
  assert.strictEqual(new Set(Q.map(q => q.q)).size, Q.length);
});

test('order is reproducible and keeps Part 1 before Part 2', () => {
  const o = E.rsBuildOrder(12345);
  const parts = o.questionOrder.map(i => Q[i].part);
  assert.deepStrictEqual(parts, parts.slice().sort());
  assert.deepStrictEqual(o.questionOrder.slice().sort((a, b) => a - b), Q.map((_, i) => i));
  assert.deepStrictEqual(E.rsBuildOrder(12345), o);
});

test('ticking two options never earns more than ticking one', () => {
  const one = persona({ all: ['R'] }, { D5: ['machines'] });
  const two = persona({ all: ['R', 'I'] }, { D5: ['machines'] });
  assert.ok(two.scoring.pct.R < one.scoring.pct.R);
  assert.ok(Math.abs(one.scoring.pct.R - 100) < 1e-9);
});

// The student in docs/test01.mp4: loves building and fixing things, is
// curious, and picks the coding options when they appear. With the digital
// world as their pick, software careers must make the list. Hands-on
// digital work (drones, robotics) leading it is fine; leaving software out
// is not.
test('hands-on student who wants the digital world sees computing careers', () => {
  const p = persona(
    { all: ['R', 'I'], Q2: ['I', 'C'], Q9: ['I', 'R'], Q11: ['I'] },
    { D1: ['digital', 'machines'], D2: ['money'], D3: ['digital'], D4: ['machines'], D5: ['digital'] });
  assert.ok(families(p).includes('computing'), titles(p).join(', '));
  const se = 'Computer Science Engineer (Software & Systems)';
  assert.ok(matchOf(p, se) >= E.RS_MIN_FIT, se + ' ' + matchOf(p, se));
});

test('the same hands-on student who wants machines sees engineering first', () => {
  const p = persona(
    { all: ['R', 'I'] },
    { D1: ['machines'], D2: ['built'], D3: ['built'], D4: ['machines'], D5: ['machines'] });
  assert.strictEqual(families(p)[0], 'engineering', titles(p).join(', '));
});

test('analytical coder sees software careers first', () => {
  const p = persona(
    { all: ['I', 'C'] },
    { D1: ['digital'], D2: ['money'], D3: ['digital'], D4: ['machines'], D5: ['digital'] });
  assert.strictEqual(families(p)[0], 'computing', titles(p).join(', '));
  assert.ok(titles(p).some(x => /Computer Science|Data Scientist|Machine Learning|Cybersecurity|Cloud/.test(x)), titles(p).join(', '));
});

test('caring scientist who wants health sees medicine', () => {
  const p = persona(
    { all: ['I', 'S'] },
    { D1: ['life'], D2: ['people'], D3: ['life'], D4: ['people'], D5: ['life'] });
  assert.ok(['medicine', 'ayush', 'allied-health'].includes(families(p)[0]), titles(p).join(', '));
});

test('creative student who wants media sees creative careers', () => {
  const p = persona(
    { all: ['A', 'E'] },
    { D1: ['digital'], D2: ['media'], D3: ['built'], D4: ['media'], D5: ['media'] });
  assert.ok(['media-arts', 'design'].includes(families(p)[0]), titles(p).join(', '));
});

test('hands-on student who wants the planet sees environmental careers', () => {
  const p = persona(
    { all: ['R', 'I'] },
    { D1: ['planet'], D2: ['built'], D3: ['money'], D4: ['planet'], D5: ['planet'] });
  assert.ok(titles(p).includes('Environmental & Sustainability Engineer'), titles(p).join(', '));
});

test('organised leader who wants business sees business or finance', () => {
  const p = persona(
    { all: ['E', 'C'] },
    { D1: ['digital'], D2: ['money'], D3: ['money'], D4: ['people'], D5: ['money'] });
  assert.ok(['accounting', 'finance', 'business', 'operations'].includes(families(p)[0]), titles(p).join(', '));
});

test('helper who wants people sees psychology, social science, teaching or public service', () => {
  const p = persona(
    { all: ['S', 'A'] },
    { D1: ['life'], D2: ['people'], D3: ['money'], D4: ['people'], D5: ['people'] });
  assert.ok(['education', 'psychology', 'social-science', 'public-service'].includes(families(p)[0]), titles(p).join(', '));
});

test('creative maker who wants buildings sees architecture or design', () => {
  const p = persona(
    { all: ['A', 'R'] },
    { D1: ['machines'], D2: ['built'], D3: ['built'], D4: ['media'], D5: ['built'] });
  assert.ok(titles(p).some(x => /Architect|Interior|Urban|Civil/.test(x)), titles(p).join(', '));
});

test('a student whose answers are spread evenly still gets a shortlist', () => {
  const p = persona({ all: pos => [E.RS_DIMS[pos % 6]] }, { D5: ['digital'] });
  assert.ok(p.results.top_careers.length > 0);
});

test('the shortlist is diverse', () => {
  const p = persona(
    { all: ['I', 'C'] },
    { D1: ['digital'], D2: ['money'], D3: ['digital'], D4: ['machines'], D5: ['digital'] });
  const counts = {};
  families(p).forEach(f => { counts[f] = (counts[f] || 0) + 1; });
  assert.ok(Math.max(...Object.values(counts)) <= 3, JSON.stringify(counts));
});

test('results carry the engine version and the student’s worlds', () => {
  const p = persona({ all: ['R', 'I'] }, { D5: ['machines'] });
  assert.strictEqual(p.results.engine_version, E.RS_ENGINE_VERSION);
  assert.ok(E.rsIsCurrentResult(p.results));
  assert.ok(!E.rsIsCurrentResult({ personality_type: 'old run' }));
  assert.strictEqual(p.results.riasec.domains[0].key, 'machines');
});

// ── Accuracy safeguards ───────────────────────────────────────────────────

// A tiny seeded random generator, so these tests give the same result
// every run.
function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function randomAnswers(rand) {
  return Q.map(q => {
    const n = q.type === 'subject' ? 1 + Math.floor(rand() * 3) : q.maxSelect === 1 ? 1 : 1 + Math.floor(rand() * 2);
    const picks = new Set();
    while (picks.size < n) picks.add(Math.floor(rand() * q.opts.length));
    return { indices: [...picks] };
  });
}

test('random answering favours no area', () => {
  const rand = seeded(42), sums = {};
  E.RS_DIMS.forEach(d => { sums[d] = 0; });
  const runs = 3000;
  for (let i = 0; i < runs; i++) {
    const s = E.rsScore(randomAnswers(rand), Q);
    E.RS_DIMS.forEach(d => { sums[d] += s.pct[d] / runs; });
  }
  const means = Object.values(sums);
  assert.ok(Math.max(...means) - Math.min(...means) < 1.5, JSON.stringify(sums));
});

test('random answering is mostly flagged as a flat profile', () => {
  const rand = seeded(7);
  let flat = 0;
  for (let i = 0; i < 1000; i++) if (E.rsScore(randomAnswers(rand), Q).flat) flat++;
  assert.ok(flat > 750, flat + ' of 1000 flagged');
});

test('a flat profile gets no invented personality type', () => {
  const p = persona({ all: pos => [E.RS_DIMS[pos % 6]] }, { D5: ['digital'] });
  assert.ok(p.scoring.flat);
  assert.strictEqual(p.results.personality_type, 'The All-Round Explorer');
  assert.strictEqual(p.results.riasec.confidence, 'low');
});

test('a clear profile is not flagged flat, and its top two areas are hexagon neighbours', () => {
  const p = persona({ all: ['R', 'I'] }, { D5: ['machines'] });
  assert.ok(!p.scoring.flat);
  assert.strictEqual(p.scoring.consistency, 'high');
  const mixed = persona({ all: ['R', 'S'] }, { D5: ['machines'] });
  assert.strictEqual(mixed.scoring.consistency, 'low');
});

test('all four streams are ranked with a reason each', () => {
  const p = persona({ all: ['I', 'C'] }, { D5: ['digital'] }, { S1: ['maths', 'computers', 'physics'], S2: ['computers'] });
  const s = p.results.streams;
  assert.deepStrictEqual(s.map(x => x.key).sort(), ['Commerce', 'Humanities', 'PCB', 'PCM']);
  assert.strictEqual(s[0].key, 'PCM');
  s.forEach(x => assert.ok(x.reason.length > 10));
  for (let i = 1; i < s.length; i++) assert.ok(s[i - 1].score >= s[i].score);
});

test('subjects decide between PCM and PCB for the same interests', () => {
  const likes = { all: ['I', 'R'] };
  const worlds = { D1: ['life', 'machines'], D3: ['life'], D4: ['machines'], D5: ['life', 'machines'] };
  const bio = persona(likes, worlds, { S1: ['biology', 'chemistry'], S2: ['biology'] });
  const maths = persona(likes, worlds, { S1: ['maths', 'physics'], S2: ['physics'] });
  assert.strictEqual(bio.results.streams[0].key, 'PCB', JSON.stringify(bio.results.streams));
  assert.strictEqual(maths.results.streams[0].key, 'PCM', JSON.stringify(maths.results.streams));
});

test('a student who wants medicine and is strong in biology sees MBBS near the top', () => {
  const p = persona(
    { all: ['I', 'S'] },
    { D1: ['life'], D2: ['people'], D3: ['life'], D4: ['people'], D5: ['life'] },
    { S1: ['biology', 'chemistry'], S2: ['biology'] });
  assert.ok(titles(p).slice(0, 3).some(t => /MBBS/.test(t)), titles(p).join(', '));
});

test('every shortlisted career has a fit label', () => {
  const p = persona({ all: ['A', 'E'] }, { D5: ['media'] });
  p.results.top_careers.forEach(c => assert.ok(/fit$/.test(c.fit_label), c.fit_label));
});

test('a result saved before the world and subject questions still matches', () => {
  const old = { pct: { R: 60, I: 50, A: 10, S: 5, E: 10, C: 20 } };
  const c = RIASEC_CAREERS[0];
  const f = E.rsCareerFit(old, c);
  assert.ok(f.fit > 0 && f.fit <= 1);
  assert.strictEqual(f.parts.domain, null);
  assert.strictEqual(f.parts.subjects, null);
});
