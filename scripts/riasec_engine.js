// ══════════════════════════════════════════════════════════════
// RIASEC QUIZ ENGINE
//
// Implements riasec/riasec_career_quiz_documentation.md:
//   20 questions → hidden 6-D weight vectors → R/I/A/S/E/C percentages
//   → top-3 code → cosine match against the career database
//   → minimum-fit filter → diversity filter → careers to explore.
//
// Replaces the five-trait (A/B/C/D/E) model in quiz_engine.js. The six
// dimensions are R, I, A, S, E, C — note that "A", "C" and "E" mean
// something completely different here than they did in the old model, so
// none of the old trait code is reused.
//
// RIASEC labels are never shown to students (product rule 1). They exist
// only as internal scoring fields.
//
// Loaded as a plain <script> before script.js (attaches to the global),
// and require()-able from tests/ under Node.
// ══════════════════════════════════════════════════════════════
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RS_DIMS = ['R', 'I', 'A', 'S', 'E', 'C'];

  const RS_DIM_NAMES = {
    R: 'Realistic', I: 'Investigative', A: 'Artistic',
    S: 'Social', E: 'Enterprising', C: 'Conventional'
  };

  // Shown on the result screen instead of the RIASEC label, so the student
  // reads a plain-language description of the area rather than a code.
  const RS_DIM_PLAIN = {
    R: 'Building & practical work',
    I: 'Investigating & problem solving',
    A: 'Creating & designing',
    S: 'Helping & working with people',
    E: 'Leading & enterprise',
    C: 'Organising & accuracy'
  };

  const RS_DIM_EMOJI = { R: '🔧', I: '🔬', A: '🎨', S: '🤝', E: '🚀', C: '📋' };

  // What a student high in each area tends to enjoy — the "You may enjoy"
  // list on the result screen (doc section 15).
  const RS_DIM_ENJOY = {
    R: ['building and testing things', 'working with tools and machines', 'seeing a practical result'],
    I: ['solving difficult problems', 'understanding how things work', 'learning through experiments'],
    A: ['creating original things', 'designing how something looks and feels', 'expressing ideas your own way'],
    S: ['helping people', 'explaining things to others', 'working closely with a team'],
    E: ['leading a project', 'persuading people and pitching ideas', 'turning an idea into something real'],
    C: ['organising information clearly', 'working accurately with numbers and detail', 'planning before starting']
  };

  // ══════════════════════════════════════════════════════════════
  // THE 20 QUESTIONS  (doc section 3)
  //
  // Every option carries a hidden weight vector summing to 1.0, so one
  // selection is always worth exactly one option no matter how many
  // dimensions it touches. Blended weights are deliberate (doc section 4:
  // "Do not make every answer equal to exactly one letter").
  //
  // maxSelect — how many options the student may tick. Q20 is choose-1
  // (doc section 3); the rest allow up to 2.
  // ══════════════════════════════════════════════════════════════
  const RS_QUESTIONS = [
    {
      id: 'Q1', area: 'Project Choice', maxSelect: 2,
      q: 'Which project would you choose?',
      opts: [
        { text: 'Build a working model', w: { R: 0.80, I: 0.20 } },
        { text: 'Investigate how something works', w: { I: 0.85, R: 0.15 } },
        { text: 'Create a poster or video', w: { A: 0.85, E: 0.15 } },
        { text: 'Help solve a community problem', w: { S: 0.80, E: 0.20 } },
        { text: 'Start a small business', w: { E: 0.85, C: 0.15 } },
        { text: 'Make a clear plan and checklist for it', w: { C: 0.85, I: 0.15 } },
      ]
    },
    {
      id: 'Q2', area: 'Broken Machine', maxSelect: 2,
      q: 'A machine stops working. What interests you most?',
      opts: [
        { text: 'Find the cause', w: { I: 0.75, R: 0.25 } },
        { text: 'Repair it', w: { R: 0.90, I: 0.10 } },
        // The doc's own worked example for a three-way blend.
        { text: 'Design a better version', w: { A: 0.40, R: 0.40, I: 0.20 } },
        { text: 'Ask users what happened', w: { S: 0.80, I: 0.20 } },
        { text: 'Work out the cost of fixing it', w: { C: 0.75, E: 0.25 } },
      ]
    },
    {
      id: 'Q3', area: 'School Activity', maxSelect: 2,
      q: 'Which school activity sounds best?',
      opts: [
        { text: 'Science experiment', w: { I: 0.85, R: 0.15 } },
        { text: 'Drama or music', w: { A: 0.90, S: 0.10 } },
        { text: 'Student leadership', w: { E: 0.75, S: 0.25 } },
        { text: 'Robotics', w: { R: 0.70, I: 0.30 } },
        { text: 'Organising a competition', w: { C: 0.65, E: 0.35 } },
      ]
    },
    {
      id: 'Q4', area: 'Team Problem', maxSelect: 2,
      q: 'Your team has a difficult problem. What would you do first?',
      opts: [
        { text: 'Research the problem', w: { I: 0.80, C: 0.20 } },
        { text: 'Make something to test', w: { R: 0.75, I: 0.25 } },
        { text: 'Think of a new idea', w: { A: 0.80, I: 0.20 } },
        { text: 'Ask everyone what they think', w: { S: 0.85, E: 0.15 } },
        { text: 'Take charge and make a plan', w: { E: 0.75, C: 0.25 } },
        { text: 'Break it into clear steps and track each one', w: { C: 0.85, I: 0.15 } },
      ]
    },
    {
      id: 'Q5', area: 'Proud Result', maxSelect: 2,
      q: 'Which result would make you proudest?',
      opts: [
        { text: 'Discovering something new', w: { I: 0.85, A: 0.15 } },
        { text: 'Building something useful', w: { R: 0.85, I: 0.15 } },
        { text: 'Creating something beautiful', w: { A: 0.90, E: 0.10 } },
        { text: 'Helping someone succeed', w: { S: 0.90, E: 0.10 } },
        { text: 'Making an idea successful', w: { E: 0.85, C: 0.15 } },
      ]
    },
    {
      id: 'Q6', area: 'Task Choice', maxSelect: 2,
      q: 'Which task would you enjoy most?',
      opts: [
        { text: 'Analyse information', w: { I: 0.70, C: 0.30 } },
        { text: 'Work with tools', w: { R: 0.90, A: 0.10 } },
        { text: 'Design something', w: { A: 0.80, R: 0.20 } },
        { text: 'Teach someone', w: { S: 0.85, A: 0.15 } },
        { text: 'Organise people and resources', w: { C: 0.65, E: 0.35 } },
        { text: 'Check the work for mistakes and keep records', w: { C: 0.90, I: 0.10 } },
      ]
    },
    {
      id: 'Q7', area: 'Project Budget', maxSelect: 2,
      q: 'You get ₹1,000 for a school project. What would you enjoy most?',
      opts: [
        { text: 'Study the problem before spending', w: { I: 0.70, C: 0.30 } },
        { text: 'Buy materials and build something', w: { R: 0.85, E: 0.15 } },
        { text: 'Create an attractive final product', w: { A: 0.85, E: 0.15 } },
        { text: 'Ask students what they need', w: { S: 0.85, I: 0.15 } },
        { text: 'Find a way to make the money grow', w: { E: 0.80, C: 0.20 } },
      ]
    },
    {
      id: 'Q8', area: 'Challenge', maxSelect: 2,
      q: 'Which challenge sounds most exciting?',
      opts: [
        { text: 'Solve a mystery', w: { I: 0.85, A: 0.15 } },
        { text: 'Fix a machine', w: { R: 0.90, I: 0.10 } },
        { text: 'Create a game or story', w: { A: 0.85, I: 0.15 } },
        { text: 'Help someone overcome a problem', w: { S: 0.90, I: 0.10 } },
        { text: 'Lead a team to win', w: { E: 0.80, S: 0.20 } },
        { text: 'Find the one error hidden in a long list', w: { C: 0.80, I: 0.20 } },
      ]
    },
    {
      id: 'Q9', area: 'Build an App', maxSelect: 2,
      q: 'You are making a new app. Which role would you choose?',
      opts: [
        { text: 'Research what users need', w: { I: 0.60, S: 0.40 } },
        { text: 'Write the technical logic', w: { I: 0.55, C: 0.25, R: 0.20 } },
        { text: 'Design how it looks', w: { A: 0.85, I: 0.15 } },
        { text: 'Talk to users and collect feedback', w: { S: 0.80, E: 0.20 } },
        { text: 'Plan how to grow it', w: { E: 0.80, C: 0.20 } },
      ]
    },
    {
      id: 'Q10', area: 'Workplace', maxSelect: 2,
      q: 'Which place would you most like to explore?',
      opts: [
        { text: 'Research laboratory', w: { I: 0.85, R: 0.15 } },
        { text: 'Workshop or factory', w: { R: 0.85, I: 0.15 } },
        { text: 'Design studio', w: { A: 0.90, E: 0.10 } },
        { text: 'Hospital or community centre', w: { S: 0.85, I: 0.15 } },
        { text: 'Startup or company office', w: { E: 0.75, C: 0.25 } },
        { text: 'Accounts or records office', w: { C: 0.90, I: 0.10 } },
      ]
    },
    {
      id: 'Q11', area: 'Free Afternoon', maxSelect: 2,
      q: 'How would you prefer to spend a free afternoon?',
      opts: [
        { text: 'Learn how something works', w: { I: 0.80, R: 0.20 } },
        { text: 'Make or repair something', w: { R: 0.90, A: 0.10 } },
        { text: 'Create a story, video, or design', w: { A: 0.90, I: 0.10 } },
        { text: 'Meet people and help someone', w: { S: 0.90, E: 0.10 } },
        { text: 'Plan an event or new idea', w: { E: 0.75, C: 0.25 } },
        { text: 'Organise your notes, files, or collection', w: { C: 0.90, R: 0.10 } },
      ]
    },
    {
      id: 'Q12', area: 'Lead a Project', maxSelect: 2,
      q: 'Your teacher asks you to lead a project. What would you enjoy most?',
      opts: [
        { text: 'Research the topic', w: { I: 0.80, C: 0.20 } },
        { text: 'Make the project work', w: { R: 0.70, C: 0.30 } },
        { text: 'Make the presentation creative', w: { A: 0.85, E: 0.15 } },
        { text: 'Keep everyone involved', w: { S: 0.85, E: 0.15 } },
        { text: 'Plan the team and deadline', w: { C: 0.70, E: 0.30 } },
      ]
    },
    {
      id: 'Q13', area: 'Problem Type', maxSelect: 2,
      q: 'Which problem would you rather solve?',
      opts: [
        { text: 'Why is this happening?', w: { I: 0.90, A: 0.10 } },
        { text: 'How can we physically fix it?', w: { R: 0.90, I: 0.10 } },
        { text: 'How can we make it better-looking?', w: { A: 0.90, E: 0.10 } },
        { text: 'How is this affecting people?', w: { S: 0.90, I: 0.10 } },
        { text: 'How can we make this more successful?', w: { E: 0.80, C: 0.20 } },
        { text: 'Is this information correct and in order?', w: { C: 0.90, I: 0.10 } },
      ]
    },
    {
      id: 'Q14', area: 'Try Something New', maxSelect: 2,
      q: 'Which activity would you try first?',
      opts: [
        { text: 'Conduct an experiment', w: { I: 0.80, R: 0.20 } },
        { text: 'Build a model', w: { R: 0.85, A: 0.15 } },
        { text: 'Create a short film', w: { A: 0.85, E: 0.15 } },
        { text: 'Volunteer to help others', w: { S: 0.90, E: 0.10 } },
        { text: 'Sell something you made', w: { E: 0.75, R: 0.25 } },
        { text: 'Keep accurate records for a school activity', w: { C: 0.85, S: 0.15 } },
      ]
    },
    {
      id: 'Q15', area: 'Type of Success', maxSelect: 2,
      q: 'What kind of success feels best?',
      opts: [
        { text: 'Finding the correct answer', w: { I: 0.70, C: 0.30 } },
        { text: 'Making something work', w: { R: 0.80, I: 0.20 } },
        { text: 'Making something original', w: { A: 0.90, E: 0.10 } },
        { text: 'Making a difference to people', w: { S: 0.90, E: 0.10 } },
        { text: 'Reaching a big goal', w: { E: 0.80, C: 0.20 } },
      ]
    },
    {
      id: 'Q16', area: 'New Skill', maxSelect: 2,
      q: 'You can learn one new skill. Which would you choose?',
      opts: [
        { text: 'Coding or data analysis', w: { I: 0.75, C: 0.25 } },
        { text: 'Electronics or mechanics', w: { R: 0.85, I: 0.15 } },
        { text: 'Design or animation', w: { A: 0.85, R: 0.15 } },
        { text: 'Communication or teaching', w: { S: 0.80, E: 0.20 } },
        { text: 'Business or leadership', w: { E: 0.85, C: 0.15 } },
        { text: 'Accounting or careful record-keeping', w: { C: 0.90, I: 0.10 } },
      ]
    },
    {
      id: 'Q17', area: 'Help a Small Business', maxSelect: 2,
      q: 'Your friend starts a small business. How would you help?',
      opts: [
        { text: 'Analyse what customers want', w: { I: 0.55, C: 0.25, E: 0.20 } },
        { text: 'Help make the product', w: { R: 0.80, A: 0.20 } },
        { text: 'Design the brand', w: { A: 0.85, E: 0.15 } },
        { text: 'Talk to customers', w: { S: 0.75, E: 0.25 } },
        { text: 'Help with pricing and growth', w: { C: 0.50, E: 0.50 } },
      ]
    },
    {
      id: 'Q18', area: 'Future Project', maxSelect: 2,
      q: 'Which future project sounds most exciting?',
      opts: [
        { text: 'Discover a new solution', w: { I: 0.85, A: 0.15 } },
        { text: 'Build a useful machine', w: { R: 0.85, I: 0.15 } },
        { text: 'Create something people remember', w: { A: 0.90, E: 0.10 } },
        { text: "Improve people's lives", w: { S: 0.90, I: 0.10 } },
        { text: 'Build a successful company', w: { E: 0.85, C: 0.15 } },
      ]
    },
    {
      id: 'Q19', area: 'Learning Style', maxSelect: 2,
      q: 'When learning something difficult, which sounds most like you?',
      opts: [
        { text: 'Ask "why?" and research', w: { I: 0.85, A: 0.15 } },
        { text: 'Try it yourself', w: { R: 0.85, I: 0.15 } },
        { text: 'Find a creative way to understand it', w: { A: 0.85, I: 0.15 } },
        { text: 'Discuss it with someone', w: { S: 0.90, E: 0.10 } },
        { text: 'Make a plan and work towards the goal', w: { C: 0.70, E: 0.30 } },
      ]
    },
    {
      // Choose 1 — doc section 3.
      id: 'Q20', area: 'Career Day', maxSelect: 1,
      q: 'Which career-day session would you attend first?',
      opts: [
        { text: 'Science and research', w: { I: 0.80, R: 0.20 } },
        { text: 'Engineering and technology', w: { R: 0.70, I: 0.30 } },
        { text: 'Design and media', w: { A: 0.85, E: 0.15 } },
        { text: 'Healthcare and education', w: { S: 0.80, I: 0.20 } },
        { text: 'Business and entrepreneurship', w: { E: 0.80, C: 0.20 } },
      ]
    },
  ];

  // ══════════════════════════════════════════════════════════════
  // PER-DIMENSION MAXIMA  (doc section 6)
  //
  // "Because different questions have different answer structures, use a
  // pre-calculated maximum possible score for each dimension."
  //
  // Each question contributes a total of exactly 1.0 split across the
  // ticked options, so the most a question can give one dimension is the
  // largest weight any single option assigns it — ticking a second option
  // halves the first and can only dilute it. The ceiling is therefore the
  // sum over questions of the best single option for that dimension.
  //
  // Computed rather than hardcoded so editing a weight can never leave a
  // stale maximum behind (which would let a score exceed 100%).
  // ══════════════════════════════════════════════════════════════
  function rsComputeMaxima(questions) {
    const Q = questions || RS_QUESTIONS;
    const max = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
    Q.forEach(q => {
      RS_DIMS.forEach(d => {
        let best = 0;
        q.opts.forEach(o => { if ((o.w[d] || 0) > best) best = o.w[d] || 0; });
        max[d] += best;
      });
    });
    return max;
  }

  // ══════════════════════════════════════════════════════════════
  // SCORING  (doc sections 5 & 6)
  //
  // Selection factor: 1 pick → 1.0, 2 picks → 0.5 each. A question's total
  // contribution is always 1.0, so ticking more answers never earns extra
  // points (product rule 6).
  //
  // `answers` is an array parallel to the question list; each entry is
  // { indices: [...] } holding the ORIGINAL option indices — the renderer
  // maps shuffled display positions back before saving.
  // ══════════════════════════════════════════════════════════════
  function rsScore(answers, questions) {
    const Q = questions || RS_QUESTIONS;
    const maxima = rsComputeMaxima(Q);
    const raw = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
    let answered = 0;

    Q.forEach((q, i) => {
      const a = answers && answers[i];
      if (!a) return;
      const picks = (Array.isArray(a.indices) ? a.indices : [])
        .filter(idx => q.opts[idx])
        .slice(0, q.maxSelect);
      if (!picks.length) return;

      const factor = 1 / picks.length;   // doc section 5
      picks.forEach(idx => {
        const w = q.opts[idx].w;
        for (const d in w) if (raw[d] !== undefined) raw[d] += w[d] * factor;
      });
      answered++;
    });

    // Percentage of the ceiling for that dimension (doc section 6).
    const pct = {};
    RS_DIMS.forEach(d => {
      pct[d] = maxima[d] > 0 ? (raw[d] / maxima[d]) * 100 : 0;
    });

    // Sort is stable and RS_DIMS is in R-I-A-S-E-C order, so ties always
    // resolve the same way and identical answers give an identical code.
    const ranked = RS_DIMS
      .map(d => ({
        dim: d, name: RS_DIM_NAMES[d], plain: RS_DIM_PLAIN[d],
        emoji: RS_DIM_EMOJI[d], raw: raw[d], pct: pct[d]
      }))
      .sort((x, y) => y.pct - x.pct);

    const code = ranked.slice(0, 3).map(r => r.dim).join('');   // doc section 7
    const d1 = ranked[0].pct - ranked[1].pct;
    const spread = ranked[0].pct - ranked[5].pct;

    return {
      raw, pct, ranked, maxima, code, answered,
      d1, spread,
      close: rsCloseGroups(ranked),
      confidence: d1 >= 12 || spread >= 40 ? 'high' : d1 >= 5 ? 'medium' : 'low'
    };
  }

  // ── Close scores (doc section 8) ─────────────────────────────────────────
  // "Difference <= 5 points → treat as close". Groups adjacent ranked
  // dimensions that sit within the threshold of each other, so the result
  // screen can say "similarly strong" instead of inventing a ranking out of
  // a 1-point gap.
  const RS_CLOSE_THRESHOLD = 5;

  function rsCloseGroups(ranked, threshold) {
    const t = threshold === undefined ? RS_CLOSE_THRESHOLD : threshold;
    const groups = [];
    let current = [ranked[0]];
    for (let i = 1; i < ranked.length; i++) {
      if (current[current.length - 1].pct - ranked[i].pct <= t) current.push(ranked[i]);
      else { groups.push(current); current = [ranked[i]]; }
    }
    groups.push(current);
    return groups.map(g => g.map(r => r.dim));
  }

  // "You may enjoy" bullets for the result screen (doc section 15) — drawn
  // from the top three areas, deduplicated, in rank order.
  function rsEnjoyList(scoring, count) {
    const n = count === undefined ? 5 : count;
    const top = scoring.ranked.slice(0, 3);
    const out = [];
    // Take the first bullet of each top area, then the second, then the
    // third, so the strongest area leads but all three are represented.
    for (let round = 0; round < 3 && out.length < n; round++) {
      top.forEach(r => {
        const list = RS_DIM_ENJOY[r.dim] || [];
        if (list[round] && out.indexOf(list[round]) === -1 && out.length < n) out.push(list[round]);
      });
    }
    return out;
  }

  // ══════════════════════════════════════════════════════════════
  // CAREER MATCHING  (doc sections 10 & 11)
  //
  // Compares the full six-dimensional profile — not the single highest
  // score (doc section 10: "Do not match careers using only the student's
  // highest RIASEC score").
  // ══════════════════════════════════════════════════════════════

  // ── Why plain cosine is not used for the match percentage ───────────────
  // RIASEC vectors are all-positive, so every pair of them points into the
  // same corner of the space and raw cosine lands between about 0.75 and
  // 1.00 for every career. Two things break as a result: the percentages
  // stop distinguishing anything (the whole shortlist reads 99%), and the
  // minimum-fit rule in doc section 13 can never fire because every career
  // clears 70.
  //
  // Centring each vector on its own mean first fixes both. What is left is
  // the SHAPE of the profile — which areas stand out relative to the rest —
  // which is what doc section 10 is really asking for when it says to
  // "compare the complete interest pattern" rather than the top letter.
  // Mathematically this is the Pearson correlation of the six values.
  //
  // r = +1 → identical pattern, 0 → unrelated, -1 → opposite.
  function rsPatternSimilarity(a, b) {
    const xs = RS_DIMS.map(d => a[d] || 0);
    const ys = RS_DIMS.map(d => b[d] || 0);
    const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
    const my = ys.reduce((s, v) => s + v, 0) / ys.length;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < xs.length; i++) {
      const dx = xs[i] - mx, dy = ys[i] - my;
      dot += dx * dy; na += dx * dx; nb += dy * dy;
    }
    // A perfectly flat profile has no shape to compare; treat it as neutral
    // so an all-equal student gets a mid-range score rather than a crash.
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  // Map r ∈ [-1, 1] onto the 0-100 "match percentage" the student sees.
  // r = 0 (no relationship) lands at 50, so the 70 threshold in doc
  // section 13 means "clearly better than an unrelated career".
  function rsSimilarityToPct(r) {
    return ((r + 1) / 2) * 100;
  }

  // ── The extra-signal hook (doc section 11) ───────────────────────────────
  // Career Score = 50% interest + 20% strengths + 15% work style + 15% values.
  // Only the interest layer exists today, so interest carries the full
  // weight. Adding a layer means giving it a weight here and a matching
  // scorer in `extras` — the ranking code below does not change.
  const RS_FIT_WEIGHTS = { interest: 1.00, strengths: 0, workStyle: 0, values: 0 };

  // extras: { strengths?: (career)=>0..1, workStyle?: (career)=>0..1, values?: ... }
  function rsCareerFit(studentPct, career, extras, weights) {
    const W = weights || RS_FIT_WEIGHTS;
    // Interest match is expressed on the same 0-1 scale as the other three
    // layers so the weighted blend stays meaningful when they are added.
    const parts = { interest: rsSimilarityToPct(rsPatternSimilarity(studentPct, career.riasec)) / 100 };
    ['strengths', 'workStyle', 'values'].forEach(k => {
      parts[k] = extras && typeof extras[k] === 'function' ? extras[k](career) : 0;
    });
    let total = 0, used = 0;
    for (const k in parts) {
      const w = W[k] || 0;
      if (w > 0) { total += w * parts[k]; used += w; }
    }
    // Renormalise so a partially-configured weighting still yields 0..1.
    return { fit: used > 0 ? total / used : 0, parts };
  }

  // ── Minimum-fit rule (doc section 13) ───────────────────────────────────
  const RS_MIN_FIT = 70;

  // ── Diversity rule (doc section 14) ─────────────────────────────────────
  // "Do not return five almost-identical careers when several strong
  // alternatives exist." Each career declares a `family`; at most
  // RS_MAX_PER_FAMILY of the shortlist may come from one family. Careers
  // skipped by the cap stay available as backfill, so a genuinely narrow
  // profile still gets a full list rather than a short one.
  const RS_MAX_PER_FAMILY = 2;

  function rsMatchCareers(scoring, database, options) {
    const o = options || {};
    const db = database || (typeof RIASEC_CAREERS !== 'undefined' ? RIASEC_CAREERS : []);
    const minFit = o.minFit === undefined ? RS_MIN_FIT : o.minFit;
    const maxPerFamily = o.maxPerFamily === undefined ? RS_MAX_PER_FAMILY : o.maxPerFamily;
    const limit = o.limit === undefined ? 5 : o.limit;

    const scored = db.map(c => {
      const { fit, parts } = rsCareerFit(scoring.pct, c, o.extras, o.weights);
      return { career: c, match_pct: Math.round(fit * 100), fit, parts };
    }).sort((x, y) => y.fit - x.fit ||
      // Deterministic tiebreak so equal matches never reorder run to run.
      x.career.title.localeCompare(y.career.title));

    // Minimum-fit filter — show fewer than five rather than pad the list
    // with weak matches (doc section 13).
    const qualified = scored.filter(s => s.match_pct >= minFit);

    // Diversity filter. The cap is deliberately a SOFT limit: applied
    // strictly it would hand a student with narrow interests a three-item
    // list even though the careers it dropped were strong matches. So the
    // cap is relaxed one slot at a time until the list is full, which
    // yields the most diverse shortlist the qualified pool can support and
    // never silently allows a single family to take more room than it had
    // to. A hard cap is still available via maxPerFamily on its own.
    const take = cap => {
      const perFamily = {};
      const picked = [];
      for (let i = 0; i < qualified.length && picked.length < limit; i++) {
        const s = qualified[i];
        const fam = s.career.family || s.career.title;
        const n = perFamily[fam] || 0;
        if (n < cap) { perFamily[fam] = n + 1; picked.push(s); }
      }
      return picked;
    };

    let shortlist = take(maxPerFamily);
    for (let cap = maxPerFamily + 1; shortlist.length < limit && cap <= limit; cap++) {
      shortlist = take(cap);
    }

    return {
      shortlist: shortlist,
      qualifiedCount: qualified.length,
      belowThreshold: scored.length - qualified.length,
      all: scored
    };
  }

  // ══════════════════════════════════════════════════════════════
  // QUESTION / ANSWER SHUFFLING  (product rules 2 & 3)
  //
  // "Shuffle question order" and "shuffle answer order so the same letter
  // is not always associated with the same area."
  //
  // Seeded so a run is reproducible: the order is generated once when the
  // quiz starts and saved with the session, so pressing Back re-renders the
  // same layout the student answered on.
  // ══════════════════════════════════════════════════════════════
  function rsMulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rsShuffled(n, rand) {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // Returns { seed, questionOrder, optionOrder }. questionOrder[step] is the
  // ORIGINAL question index to show at that step; optionOrder[qi][pos] is
  // the ORIGINAL option index to show at display position pos.
  function rsBuildOrder(seed, questions) {
    const Q = questions || RS_QUESTIONS;
    const s = seed === undefined || seed === null
      ? (Math.random() * 0xFFFFFFFF) >>> 0
      : seed >>> 0;
    const rand = rsMulberry32(s);
    return {
      seed: s,
      questionOrder: rsShuffled(Q.length, rand),
      optionOrder: Q.map(q => rsShuffled(q.opts.length, rand))
    };
  }

  // ══════════════════════════════════════════════════════════════
  // VALIDATION — used by the tests
  // ══════════════════════════════════════════════════════════════
  function rsValidateQuestions(questions) {
    const Q = questions || RS_QUESTIONS;
    const problems = [];
    const primaryCount = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

    Q.forEach(q => {
      const label = q.id || q.q.slice(0, 20);
      if (!q.maxSelect || q.maxSelect < 1) problems.push(label + ': maxSelect must be >= 1');
      q.opts.forEach((o, j) => {
        const keys = Object.keys(o.w || {});
        if (!keys.length) { problems.push(label + ' opt ' + j + ': no weights'); return; }
        const sum = keys.reduce((s, k) => s + o.w[k], 0);
        if (Math.abs(sum - 1) > 1e-9) {
          problems.push(label + ' opt ' + j + ': weights sum to ' + sum.toFixed(3) + ', expected 1');
        }
        keys.forEach(k => {
          if (RS_DIMS.indexOf(k) === -1) {
            problems.push(label + ' opt ' + j + ': unknown dimension "' + k + '"');
          }
        });
        // Which dimension this option most represents.
        const top = keys.reduce((a, b) => (o.w[b] > o.w[a] ? b : a), keys[0]);
        if (primaryCount[top] !== undefined) primaryCount[top]++;
      });
    });

    // Every dimension needs somewhere to score as a primary signal,
    // otherwise a student strong in that area can never top out on it.
    RS_DIMS.forEach(d => {
      if (!primaryCount[d]) {
        problems.push('no option anywhere is primarily ' + d + ' (' + RS_DIM_NAMES[d] + ')');
      }
    });

    return { problems, primaryCount, maxima: rsComputeMaxima(Q) };
  }

  function rsValidateCareers(database) {
    const db = database || (typeof RIASEC_CAREERS !== 'undefined' ? RIASEC_CAREERS : []);
    const problems = [];
    const seen = {};
    db.forEach((c, i) => {
      const label = c.title || ('career ' + i);
      if (!c.title) problems.push('career ' + i + ': no title');
      if (seen[c.title]) problems.push(label + ': duplicate title');
      seen[c.title] = true;
      ['emoji', 'field', 'stream', 'salary', 'family', 'why'].forEach(k => {
        if (!c[k]) problems.push(label + ': missing ' + k);
      });
      if (!c.riasec) { problems.push(label + ': no riasec vector'); return; }
      RS_DIMS.forEach(d => {
        const v = c.riasec[d];
        if (typeof v !== 'number') problems.push(label + ': riasec.' + d + ' is not a number');
        else if (v < 0 || v > 100) problems.push(label + ': riasec.' + d + ' = ' + v + ', expected 0-100');
      });
    });
    return problems;
  }

  // ══════════════════════════════════════════════════════════════
  // PERSONALITY LAYER
  //
  // Keyed by the ORDERED top-two letters, so 30 combinations cover every
  // student — far fewer than hand-authoring all 120 three-letter codes,
  // and the third letter is already visible on the result screen as the
  // third strongest area.
  //
  // Deliberately avoids the RIASEC words themselves (product rule 1).
  // ══════════════════════════════════════════════════════════════
  const RS_PROFILES = {
    RI: { type: 'The Practical Problem-Solver', desc: 'You want to understand how something works and then work on it yourself. Theory only really lands for you once you have taken the thing apart.' },
    RA: { type: 'The Maker-Designer', desc: 'You like making real objects, and you care how they look as much as whether they work. A finished thing that is both useful and good-looking is your idea of done.' },
    RS: { type: 'The Hands-On Helper', desc: 'You would rather help someone by doing something practical than by talking about it. People trust you because you turn up and fix the problem.' },
    RE: { type: 'The Builder-Entrepreneur', desc: 'You like making things, and you can see how what you make could be worth something. You are drawn to building a product rather than just a project.' },
    RC: { type: 'The Precision Technician', desc: 'You enjoy practical work done to a proper standard. You would rather do it exactly right than quickly.' },

    IR: { type: 'The Applied Investigator', desc: 'You enjoy working out why something happens, then testing your answer for real. Pure theory interests you less than a result you can check.' },
    IA: { type: 'The Creative Thinker', desc: 'You solve problems by coming at them from an unusual angle. You are as interested in an elegant idea as in a correct one.' },
    IS: { type: 'The Caring Scientist', desc: 'You are drawn to problems that affect real people, especially health and wellbeing. Understanding something matters most to you when it helps someone.' },
    IE: { type: 'The Analytical Strategist', desc: 'You like understanding a situation deeply and then deciding what should be done about it. You enjoy being the person whose reasoning convinces everyone else.' },
    IC: { type: 'The Methodical Analyst', desc: 'You enjoy working through information carefully until it makes sense. You are the person who notices the number that does not add up.' },

    AR: { type: 'The Hands-On Creator', desc: 'You create by making things physically, with materials and tools. The craft of it matters to you as much as the idea.' },
    AI: { type: 'The Experimental Artist', desc: 'You like creative work that has a puzzle inside it. You enjoy learning a difficult technique in order to make something new.' },
    AS: { type: 'The Expressive Communicator', desc: 'You create in order to reach people. You are at your best when your work makes someone feel or understand something.' },
    AE: { type: 'The Creative Entrepreneur', desc: 'You have your own ideas and you want them out in the world, not sitting in a drawer. You are comfortable promoting what you make.' },
    AC: { type: 'The Disciplined Designer', desc: 'You are creative, but you like a clear brief and a high standard of finish. Your work is original and also carefully made.' },

    SR: { type: 'The Practical Carer', desc: 'You help people through direct, physical, hands-on work. You would rather be with the person than behind a desk.' },
    SI: { type: 'The Thoughtful Helper', desc: 'You want to understand a person properly before you try to help them. You are patient with problems that take time to work out.' },
    SA: { type: 'The Creative Mentor', desc: 'You are good with people and you explain things in imaginative ways. You make difficult things feel approachable.' },
    SE: { type: 'The People Leader', desc: 'You bring people together and get them moving in the same direction. You care about the group and you are willing to lead it.' },
    SC: { type: 'The Dependable Supporter', desc: 'You help people by being organised and reliable. You are the one who remembers the detail everyone else forgot.' },

    ER: { type: 'The Practical Leader', desc: 'You like being in charge of something real getting built. You are happiest where planning meets a site, a workshop, or a factory floor.' },
    EI: { type: 'The Strategic Analyst', desc: 'You enjoy working out what will succeed and why, then acting on it. You back your decisions with evidence.' },
    EA: { type: 'The Creative Leader', desc: 'You have a strong sense of how things should look and feel, and you can get other people behind it. You enjoy directing creative work.' },
    ES: { type: 'The Persuasive Connector', desc: 'You are energised by people and good at winning them over. You build the relationships that make things happen.' },
    EC: { type: 'The Organised Achiever', desc: 'You set a target and put a proper system behind reaching it. You are ambitious and you are also well organised.' },

    CR: { type: 'The Systematic Technician', desc: 'You like practical work with clear procedures and exact standards. You take pride in work that is correct as well as complete.' },
    CI: { type: 'The Detail Analyst', desc: 'You enjoy accuracy and you enjoy working out what the data means. You spot the error that everybody else read straight past.' },
    CA: { type: 'The Structured Creative', desc: 'You like creative work with real constraints and a tidy finish. Rules do not limit you; they give you something to work against.' },
    CS: { type: 'The Reliable Organiser', desc: 'You keep things in order so that other people can get on with their work. You are the person a team depends on without always noticing.' },
    CE: { type: 'The Process Manager', desc: 'You like running things properly: clear plans, clear numbers, clear results. You are drawn to work where good organisation decides the outcome.' },
  };

  function rsProfileFor(scoring) {
    const key = scoring.ranked[0].dim + scoring.ranked[1].dim;
    const p = RS_PROFILES[key];
    // Every ordered pair of six distinct letters is present, so this only
    // falls back if RS_PROFILES is edited badly.
    return p ? Object.assign({ key: key }, p)
      : { key: key, type: 'The Multi-Interest Explorer', desc: 'Your interests spread across several areas rather than concentrating in one.' };
  }

  // ── Stream recommendation ────────────────────────────────────────────────
  // Derived from the shortlist instead of being hand-mapped per profile:
  // whichever Class 11 stream the best-fitting careers actually require,
  // weighted so the top match counts most. A career listing "PCM / Arts"
  // votes for both.
  function rsStreamFor(shortlist) {
    if (!shortlist || !shortlist.length) return { stream: 'Any', tally: {} };
    const tally = {};
    shortlist.forEach((s, i) => {
      const weight = shortlist.length - i;   // rank 1 counts most
      String(s.career.stream).split('/').forEach(tok => {
        const k = tok.trim();
        if (!k || k === 'Any' || k === 'ITI') return;
        tally[k] = (tally[k] || 0) + weight;
      });
    });
    const ranked = Object.keys(tally).sort((a, b) => tally[b] - tally[a] || a.localeCompare(b));
    if (!ranked.length) return { stream: 'Any', tally: tally };
    // Name a second stream only when it is genuinely close behind.
    const top = ranked[0];
    const second = ranked[1];
    const stream = second && tally[second] >= tally[top] * 0.75 ? top + ' / ' + second : top;
    return { stream: stream, tally: tally };
  }

  // ══════════════════════════════════════════════════════════════
  // RESULT OBJECT
  //
  // Shape note: personality_type / personality_desc / stream_recommendation
  // / stream_reason / top_careers[] are what the dashboard, results, stream
  // and progress screens in app.html already read, so they are kept exactly
  // as they were. The `riasec` block is the new material for the result
  // screen (doc section 15).
  // ══════════════════════════════════════════════════════════════
  function rsBuildResults(scoring, database, options) {
    const match = rsMatchCareers(scoring, database, options);
    const profile = rsProfileFor(scoring);
    const streamInfo = rsStreamFor(match.shortlist);
    const top3 = scoring.ranked.slice(0, 3);

    const strongest = top3.map(r => r.plain.toLowerCase()).slice(0, 2).join(' and ');
    const streamReason = 'Your strongest areas are ' + strongest +
      '. Most of the careers that fit that pattern start from ' + streamInfo.stream + ' in Class 11.';

    return {
      // ── existing shape, consumed across app.html ──
      personality_type: profile.type,
      personality_desc: profile.desc,
      stream_recommendation: streamInfo.stream,
      stream_reason: streamReason,
      top_careers: match.shortlist.map((s, i) => ({
        rank: i + 1,
        title: s.career.title,
        emoji: s.career.emoji,
        field: s.career.field,
        match_pct: s.match_pct,
        why: s.career.why,
        stream: s.career.stream,
        salary: s.career.salary
      })),

      // ── new RIASEC material (doc section 15) ──
      riasec: {
        code: scoring.code,
        pct: scoring.pct,
        ranked: scoring.ranked.map(r => ({
          dim: r.dim, name: r.name, plain: r.plain,
          emoji: r.emoji, pct: Math.round(r.pct)
        })),
        close: scoring.close,
        confidence: scoring.confidence,
        enjoy: rsEnjoyList(scoring),
        profileKey: profile.key,
        qualifiedCount: match.qualifiedCount,
        consideredCount: match.all.length
      }
    };
  }

  return {
    RS_DIMS, RS_DIM_NAMES, RS_DIM_PLAIN, RS_DIM_EMOJI, RS_DIM_ENJOY,
    RS_PROFILES, rsProfileFor, rsStreamFor, rsBuildResults,
    rsPatternSimilarity, rsSimilarityToPct,
    RS_QUESTIONS,
    RS_CLOSE_THRESHOLD, RS_MIN_FIT, RS_MAX_PER_FAMILY,
    RS_FIT_WEIGHTS,
    rsComputeMaxima, rsScore, rsCloseGroups, rsEnjoyList,
    rsCareerFit, rsMatchCareers,
    rsMulberry32, rsShuffled, rsBuildOrder,
    rsValidateQuestions, rsValidateCareers,
  };
});
