// ══════════════════════════════════════════════════════════════
// RIASEC QUIZ ENGINE
//
// Implements riasec/riasec_career_quiz_documentation.md (riasec-2):
//   20 scenario questions → hidden 6-D weights → R/I/A/S/E/C percentages → top-3 code
//   5 "which world" questions → domain preferences (digital, machines...)
//   → interest pattern + domain matched against the career database
//   → minimum-fit filter → diversity filter → careers to explore.
//
// Replaces the five-trait (A/B/C/D/E) model in quiz_engine.js. The six
// dimensions are R, I, A, S, E, C — note that "A", "C" and "E" mean
// something completely different here than they did in the old model, so
// none of the old trait code is reused.
//
// RIASEC labels are never shown to students (product rule 1). They exist
// only as internal scoring fields.
// The bars and career copy are always in plain language (product rule 1) —
// the formal RIASEC labels surface in one place only, the "what your code
// means" key, so the three letters of the code are not an unexplained
// acronym.
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

  // Saved with every quiz run (POST /me/career-quiz), so a run can be
  // re-scored later. Bump it whenever scoring or the career data changes.
  const RS_ENGINE_VERSION = 'riasec-2';

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

  // Straight from the RIASEC table in the spec. Shown against the letters
  // of the student's own code so the code is not an unexplained acronym.
  const RS_DIM_MEANING = {
    R: 'building, fixing, machines, tools, nature, and practical work',
    I: 'science, maths, research, questions, and solving problems',
    A: 'art, design, music, writing, stories, and creating new things',
    S: 'helping, teaching, listening, guiding, and working with people',
    E: 'leading, convincing, organising, selling, and starting things',
    C: 'numbers, organising information, planning, accuracy, and clear systems'
  };

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
  // THE QUESTIONS  (riasec-2)
  //
  // Three parts, always shown in this order (25 questions, ~6 minutes):
  //
  // Part 1 — 18 scenario questions. Each is a different everyday situation
  //   with six options, one for each RIASEC area; the student picks up to
  //   two (one for the two "choose 1" questions). Rules that keep it
  //   accurate, all checked by rsValidateQuestions():
  //   - One option per area, each giving its own area RS_PRIMARY_WEIGHT, so
  //     every area has the same ceiling.
  //   - The remaining weight goes to ONE NEIGHBOUR on Holland's hexagon
  //     (R-I-A-S-E-C-R), because neighbouring areas really are related.
  //     Each area hands its secondary weight to each of its two neighbours
  //     equally often, so no area collects "free" points from the others:
  //     a student answering at random gets a flat profile, not a biased one.
  //   - Unambiguous wording: hands-on (R) options say they are physical
  //     ("with tools", "unscrew it"), and coding options are investigative.
  //   - No repeats: every question is a different situation, and no option
  //     restates another question's option.
  //
  // Part 2 — 5 "which world" questions that measure the DOMAIN a student
  //   wants to work in (RS_DOMAINS). RIASEC says what kind of work someone
  //   enjoys; it cannot tell software from mechanical engineering, or a
  //   biotech lab from a physics lab. The domain layer does that.
  //   D1-D4 each show four domains, every domain appears exactly twice, and
  //   D5 asks directly.
  //
  // Part 3 — 2 subject questions. S1 asks which subjects the student is
  //   good at, as a scenario (which could you help a friend with?), so it
  //   reads differently from S2, which asks what they would happily study
  //   for two more years. S1 is self-rated strength, the light version of
  //   the aptitude section Indian tests use; S2 is enjoyment. They feed the
  //   stream ranking and nudge careers whose key subjects the student is
  //   strong in.
  // ══════════════════════════════════════════════════════════════

  // The weight an option gives its own area; the rest goes to one neighbour.
  const RS_PRIMARY_WEIGHT = 0.8;

  // Holland's hexagon: each area's two neighbours.
  const RS_HEXAGON = 'RIASEC';
  function rsNeighbours(d) {
    const i = RS_HEXAGON.indexOf(d);
    return [RS_HEXAGON[(i + 5) % 6], RS_HEXAGON[(i + 1) % 6]];
  }
  // Steps apart on the hexagon: 1 adjacent, 2 alternate, 3 opposite.
  function rsHexDistance(a, b) {
    const d = Math.abs(RS_HEXAGON.indexOf(a) - RS_HEXAGON.indexOf(b));
    return Math.min(d, 6 - d);
  }

  // Domains, written for a Class 9-10 reader. The emoji and label are what
  // the student sees on the result screen.
  const RS_DOMAINS = {
    digital:  { label: 'Code, AI & the digital world', emoji: '💻' },
    machines: { label: 'Machines, vehicles & space', emoji: '⚙️' },
    life:     { label: 'Health, the body & biology', emoji: '🧬' },
    planet:   { label: 'Nature, climate & energy', emoji: '🌍' },
    built:    { label: 'Buildings, cities & spaces', emoji: '🏙️' },
    money:    { label: 'Business & money', emoji: '💼' },
    people:   { label: 'People, the mind & society', emoji: '🤝' },
    media:    { label: 'Stories, art, media & games', emoji: '🎬' },
  };
  const RS_DOMAIN_KEYS = Object.keys(RS_DOMAINS);

  // School subjects for Part 3, as a Class 9-10 student knows them.
  const RS_SUBJECTS = {
    maths:     { label: 'Maths', emoji: '➗' },
    physics:   { label: 'Physics', emoji: '🧲' },
    chemistry: { label: 'Chemistry', emoji: '⚗️' },
    biology:   { label: 'Biology', emoji: '🌱' },
    computers: { label: 'Computers / IT', emoji: '💻' },
    languages: { label: 'English & other languages', emoji: '📖' },
    social:    { label: 'History, Geography & Civics', emoji: '🗺️' },
    economics: { label: 'Economics & business', emoji: '📊' },
    arts:      { label: 'Art, music & design', emoji: '🎨' },
  };
  const RS_SUBJECT_KEYS = Object.keys(RS_SUBJECTS);

  // Part 1 question. opts: [text, area, neighbour] — the option gives its
  // area RS_PRIMARY_WEIGHT and the neighbour the rest.
  function rsChoice(id, area, q, maxSelect, opts) {
    return {
      id: id, part: 1, type: 'choice', area: area, maxSelect: maxSelect, q: q,
      opts: opts.map(o => {
        const w = {};
        w[o[1]] = RS_PRIMARY_WEIGHT;
        w[o[2]] = Math.round((1 - RS_PRIMARY_WEIGHT) * 100) / 100;
        return { text: o[0], w: w };
      })
    };
  }

  const RS_QUESTIONS = [
    rsChoice('Q1', '🔬 Science Fair', 'Your class is making a project for the science fair. Which job do you want?', 2, [
      ['Build the working model with tools', 'R', 'I'],
      ['Plan the experiment and study the results', 'I', 'A'],
      ['Make the poster and display look amazing', 'A', 'S'],
      ['Explain the project to visitors in a simple way', 'S', 'A'],
      ['Present the project to the judges and try to win', 'E', 'S'],
      ['Write down every reading and measurement', 'C', 'R'],
    ]),
    rsChoice('Q2', '📱 Build an App', 'You and your friends are making a new app. Which job would you take?', 2, [
      ['Build the gadget the app controls', 'R', 'I'],
      ['Write the code that makes it work', 'I', 'R'],
      ['Design the screens and how it looks', 'A', 'I'],
      ['Help people who get stuck using it', 'S', 'E'],
      ['Plan how to get the first 10,000 people to use it', 'E', 'C'],
      ['Test every part and note down each problem', 'C', 'R'],
    ]),
    rsChoice('Q3', '🔧 Broken Machine', 'The washing machine at home stops working. What would you want to do?', 2, [
      ['Open it up and repair it', 'R', 'I'],
      ['Find out exactly why it stopped working', 'I', 'R'],
      ['Draw a better design for it', 'A', 'I'],
      ['Help the family manage until it is fixed', 'S', 'E'],
      ['Find the best price for a repair or a new one', 'E', 'C'],
      ['Find the warranty card and the old repair bills', 'C', 'R'],
    ]),
    rsChoice('Q4', '🌅 Free Saturday', 'You have a full free Saturday. What sounds most fun?', 2, [
      ['Build something at home or in the garden', 'R', 'C'],
      ['Watch a show about how space and the universe work', 'I', 'A'],
      ['Draw, write, make music or edit a video', 'A', 'I'],
      ['Help a friend with something they are stuck on', 'S', 'A'],
      ['Plan a small event or sell something online', 'E', 'C'],
      ['Tidy up your room, books or collection', 'C', 'R'],
    ]),
    rsChoice('Q5', '💍 Family Wedding', 'Your cousin’s wedding is coming up and everyone gets a job. Which one do you take?', 2, [
      ['Set up the lights, stage and sound system', 'R', 'C'],
      ['Plan the seating so relatives who don’t get along sit apart', 'I', 'A'],
      ['Design the decorations and invitation cards', 'A', 'S'],
      ['Look after the grandparents and the little kids', 'S', 'E'],
      ['Talk to the cook and decorator to get the best price', 'E', 'C'],
      ['Keep track of the guest list, gifts and money', 'C', 'E'],
    ]),
    rsChoice('Q6', '👥 Group Trouble', 'Your group project is going badly. What would you do first?', 2, [
      ['Grab the tools and fix the broken part', 'R', 'I'],
      ['Find out what is really going wrong', 'I', 'R'],
      ['Suggest a completely new idea', 'A', 'I'],
      ['Make sure everyone is okay and talking again', 'S', 'E'],
      ['Take charge and decide who does what', 'E', 'S'],
      ['Make a list of tasks with dates and tick them off', 'C', 'E'],
    ]),
    rsChoice('Q7', '▶️ Video Pick', 'Which video would you click on first?', 2, [
      ['How to build an engine from old scrap parts', 'R', 'I'],
      ['How a computer learned to beat chess champions', 'I', 'A'],
      ['How cartoon characters are brought to life', 'A', 'I'],
      ['How one teacher changed a village school', 'S', 'E'],
      ['How a teenager built a ₹1 crore business', 'E', 'C'],
      ['How to plan and keep track of your money', 'C', 'E'],
    ]),
    rsChoice('Q8', '🏆 Prize Money', 'You win ₹10,000 in a competition. What would you do with it?', 2, [
      ['Buy tools or parts to build something', 'R', 'C'],
      ['Buy a telescope, a microscope or a coding course', 'I', 'R'],
      ['Buy a camera, a musical instrument or art supplies', 'A', 'I'],
      ['Use it to help someone who needs it', 'S', 'A'],
      ['Use it to start a small business', 'E', 'C'],
      ['Save it and keep track of every rupee', 'C', 'E'],
    ]),
    rsChoice('Q9', '🏫 School Club', 'Which school club would you join?', 2, [
      ['Robotics or model-making club', 'R', 'I'],
      ['Science or coding club', 'I', 'R'],
      ['Drama, art or music club', 'A', 'S'],
      ['Community service club, helping people in need', 'S', 'E'],
      ['Debate or business club', 'E', 'S'],
      ['The school magazine team that checks every fact', 'C', 'E'],
    ]),
    rsChoice('Q10', '🙋 Friends Ask You', 'Friends usually come to you when they need…', 2, [
      ['Something fixed or put together', 'R', 'C'],
      ['A hard question explained', 'I', 'A'],
      ['New ideas for a creative project', 'A', 'S'],
      ['Someone to talk to', 'S', 'A'],
      ['Someone to take charge and decide', 'E', 'S'],
      ['Someone who remembers dates, details and plans', 'C', 'E'],
    ]),
    rsChoice('Q11', '📚 Dream Subject', 'If you could add one new subject at school, which would it be?', 2, [
      ['Making things with wood, metal and electronics', 'R', 'I'],
      ['Solving real mysteries with science', 'I', 'A'],
      ['Making games, films and music', 'A', 'I'],
      ['Understanding people and how to help them', 'S', 'A'],
      ['Running your own business', 'E', 'C'],
      ['Keeping plans, money and data perfectly organised', 'C', 'R'],
    ]),
    rsChoice('Q12', '💬 Best Compliment', 'Which compliment would make you feel proudest?', 1, [
      ['“You can fix anything!”', 'R', 'I'],
      ['“How did you work that out so fast?”', 'I', 'A'],
      ['“That is so creative!”', 'A', 'S'],
      ['“You really helped me.”', 'S', 'E'],
      ['“You are a born leader.”', 'E', 'S'],
      ['“You never miss a detail.”', 'C', 'R'],
    ]),
    rsChoice('Q13', '🎲 Team Game', 'In a team adventure game, which role do you play?', 2, [
      ['The builder who makes the base and the tools', 'R', 'C'],
      ['The thinker who solves the puzzles', 'I', 'A'],
      ['The storyteller who creates the game world', 'A', 'S'],
      ['The healer who keeps the team going', 'S', 'A'],
      ['The captain who makes the big decisions', 'E', 'S'],
      ['The one who keeps count of points and supplies', 'C', 'R'],
    ]),
    rsChoice('Q14', '☀️ Summer Job', 'You can spend two weeks of your summer holidays learning at a real workplace. Where?', 2, [
      ['At a workshop or garage', 'R', 'C'],
      ['At a science lab', 'I', 'R'],
      ['At a design studio', 'A', 'I'],
      ['At an NGO that helps children', 'S', 'A'],
      ['In the sales team of a new company', 'E', 'S'],
      ['In a company’s accounts office', 'C', 'E'],
    ]),
    rsChoice('Q15', '📦 New Gadget', 'A new gadget arrives at home. What do you do first?', 2, [
      ['Unscrew it to see the parts inside', 'R', 'I'],
      ['Read up on how it actually works', 'I', 'R'],
      ['Decorate it or change how it looks', 'A', 'I'],
      ['Show your grandparents how to use it', 'S', 'A'],
      ['Check if you could sell it for more money', 'E', 'C'],
      ['Read the instructions and set it up properly', 'C', 'R'],
    ]),
    rsChoice('Q16', '🏕️ Class Trip', 'On a class camping trip, which job is yours?', 2, [
      ['Put up the tents and carry the gear', 'R', 'C'],
      ['Learn about the rocks, plants and animals around the camp', 'I', 'R'],
      ['Take the photos and make the trip video', 'A', 'S'],
      ['Do first aid and keep everyone happy', 'S', 'A'],
      ['Lead the group and make the decisions', 'E', 'S'],
      ['Plan the route, timings and money', 'C', 'R'],
    ]),
    rsChoice('Q17', '🌳 Messy Park', 'The park near your home is a mess. How would you help?', 2, [
      ['Fix the benches and plant new trees', 'R', 'C'],
      ['Find out what is wrong and why it keeps happening', 'I', 'R'],
      ['Paint a big wall painting and give the park a new look', 'A', 'S'],
      ['Get the neighbours together to clean it up', 'S', 'E'],
      ['Convince local officials to pay for the repairs', 'E', 'S'],
      ['Make a timetable for who cleans when', 'C', 'E'],
    ]),
    rsChoice('Q18', '📰 Future Headline', 'Ten years from now, which news headline about you would you love to read?', 1, [
      ['“Young mechanic’s workshop repairs 10,000 electric scooters”', 'R', 'C'],
      ['“Scientist finds a faster way to test for disease”', 'I', 'A'],
      ['“Young director’s first film wins a national award”', 'A', 'S'],
      ['“Student volunteer helps 1,000 kids pass their exams”', 'S', 'E'],
      ['“Young founder’s company gets ₹50 crore from investors”', 'E', 'C'],
      ['“New system saves city hospitals ₹10 crore”', 'C', 'E'],
    ]),

    // ── Part 2: domain. Each pick scores its domain; D5 is the direct
    // question and counts double (`points`).
    {
      id: 'D1', part: 2, type: 'domain', area: '🌍 Your World', maxSelect: 2, points: 1,
      q: 'A news app lets you follow only two topics. Which would you pick?',
      opts: [
        { text: 'New AI tools, apps and gadgets', domain: 'digital' },
        { text: 'Electric cars, rockets and robots', domain: 'machines' },
        { text: 'New medical discoveries and the human body', domain: 'life' },
        { text: 'Climate change, wildlife and clean energy', domain: 'planet' },
      ]
    },
    {
      id: 'D2', part: 2, type: 'domain', area: '🌍 Your World', maxSelect: 2, points: 1,
      q: 'You can spend a week watching one team at work. Which would you join?',
      opts: [
        { text: 'Architects planning a new metro station', domain: 'built' },
        { text: 'A new company working out how to grow and make money', domain: 'money' },
        { text: 'Counsellors helping students at a big school', domain: 'people' },
        { text: 'A studio making a cartoon series', domain: 'media' },
      ]
    },
    {
      id: 'D3', part: 2, type: 'domain', area: '🌍 Your World', maxSelect: 2, points: 1,
      q: 'Which problem would you most like to help solve one day?',
      opts: [
        { text: 'Stopping hackers from stealing people’s data', domain: 'digital' },
        { text: 'Finding a cure for a serious disease', domain: 'life' },
        { text: 'Making crowded cities safer and easier to live in', domain: 'built' },
        { text: 'Helping small shops and farmers earn more', domain: 'money' },
      ]
    },
    {
      id: 'D4', part: 2, type: 'domain', area: '🌍 Your World', maxSelect: 2, points: 1,
      q: 'Which of these would you most like to work on?',
      opts: [
        { text: 'A delivery robot that drives itself', domain: 'machines' },
        { text: 'Bringing a dying forest or river back to life', domain: 'planet' },
        { text: 'A plan that helps every child learn to read', domain: 'people' },
        { text: 'A music video or short film', domain: 'media' },
      ]
    },
    {
      id: 'D5', part: 2, type: 'domain', area: '🌍 Your World', maxSelect: 2, points: 2,
      q: 'In which world would you most like to work one day?',
      opts: RS_DOMAIN_KEYS.map(k => ({ text: RS_DOMAINS[k].emoji + '  ' + RS_DOMAINS[k].label, domain: k }))
    },

    // ── Part 3: subjects. `points` is how much a pick counts toward the
    // subject's strength: being good at it matters more than enjoying it,
    // because Class 11 marks depend on it.
    {
      id: 'S1', part: 3, type: 'subject', area: '📘 Your Subjects', maxSelect: 3, points: 0.6,
      q: 'A friend is stuck the night before an exam. Which subjects could you easily help them with?',
      opts: RS_SUBJECT_KEYS.map(k => ({ text: RS_SUBJECTS[k].emoji + '  ' + RS_SUBJECTS[k].label, subject: k }))
    },
    {
      id: 'S2', part: 3, type: 'subject', area: '📘 Your Subjects', maxSelect: 3, points: 0.4,
      q: 'Which subjects would you be happy to study for two more years?',
      opts: RS_SUBJECT_KEYS.map(k => ({ text: RS_SUBJECTS[k].emoji + '  ' + RS_SUBJECTS[k].label, subject: k }))
    },
  ];

  // ══════════════════════════════════════════════════════════════
  // PER-DIMENSION MAXIMA  (doc section 6)
  //
  // Each question contributes a total of exactly 1.0 split across the
  // ticked options, so the most a question can give one area is the largest
  // weight any single option gives it — ticking a second option halves the
  // first and can only dilute it. The ceiling is the sum of those over the
  // Part 1 questions; with every option's own area at RS_PRIMARY_WEIGHT it
  // is the same for all six areas.
  //
  // Computed rather than hardcoded so editing a weight can never leave a
  // stale maximum behind (which would let a score exceed 100%).
  // ══════════════════════════════════════════════════════════════
  function rsComputeMaxima(questions) {
    const Q = questions || RS_QUESTIONS;
    const max = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
    Q.forEach(q => {
      if (q.type !== 'choice') return;
      RS_DIMS.forEach(d => {
        let best = 0;
        q.opts.forEach(o => { if ((o.w[d] || 0) > best) best = o.w[d] || 0; });
        max[d] += best;
      });
    });
    return max;
  }

  // The most a domain can score: every question it appears in, picked.
  function rsComputeDomainMaxima(questions) {
    const Q = questions || RS_QUESTIONS;
    const max = {};
    RS_DOMAIN_KEYS.forEach(k => { max[k] = 0; });
    Q.forEach(q => {
      if (q.type !== 'domain') return;
      q.opts.forEach(o => { if (max[o.domain] !== undefined) max[o.domain] += q.points || 1; });
    });
    return max;
  }

  // ══════════════════════════════════════════════════════════════
  // SCORING
  //
  // Part 1: selection factor 1 pick → 1.0, 2 picks → 0.5 each. A question's
  // total contribution is always 1.0, so ticking more answers never earns
  // extra points (product rule 6).
  //
  // Part 2: each pick adds the question's `points` to the picked domain;
  // picking two counts both, because domain scores are only ever used
  // relative to the student's own strongest domain.
  //
  // Part 3: each pick adds the question's `points` to the subject, so a
  // subject that is both easy and enjoyed scores 1.0.
  //
  // `answers` is an array parallel to the question list; each entry is
  // { indices: [...] } holding the ORIGINAL option indices — the renderer
  // maps shuffled display positions back before saving.
  // ══════════════════════════════════════════════════════════════
  function rsScore(answers, questions) {
    const Q = questions || RS_QUESTIONS;
    const maxima = rsComputeMaxima(Q);
    const domainMaxima = rsComputeDomainMaxima(Q);
    const raw = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
    const domainRaw = {};
    RS_DOMAIN_KEYS.forEach(k => { domainRaw[k] = 0; });
    const subjects = {};
    RS_SUBJECT_KEYS.forEach(k => { subjects[k] = 0; });
    let answered = 0;

    Q.forEach((q, i) => {
      const a = answers && answers[i];
      if (!a) return;
      const picks = (Array.isArray(a.indices) ? a.indices : [])
        .filter(idx => q.opts[idx])
        .slice(0, q.maxSelect);
      if (!picks.length) return;

      if (q.type === 'choice') {
        const factor = 1 / picks.length;   // doc section 5
        picks.forEach(idx => {
          const w = q.opts[idx].w;
          for (const d in w) if (raw[d] !== undefined) raw[d] += w[d] * factor;
        });
      } else if (q.type === 'domain') {
        picks.forEach(idx => {
          const k = q.opts[idx].domain;
          if (domainRaw[k] !== undefined) domainRaw[k] += q.points || 1;
        });
      } else if (q.type === 'subject') {
        picks.forEach(idx => {
          const k = q.opts[idx].subject;
          if (subjects[k] !== undefined) subjects[k] += q.points || 1;
        });
      }
      answered++;
    });

    // Domain preference relative to the student's own favourite (1.0), so
    // a student who ticks two options everywhere is not "more interested"
    // than one who ticks one.
    const domainTop = Math.max.apply(null, RS_DOMAIN_KEYS.map(k => domainRaw[k]));
    const domains = {};
    RS_DOMAIN_KEYS.forEach(k => { domains[k] = domainTop > 0 ? domainRaw[k] / domainTop : 0; });
    const domainRanked = RS_DOMAIN_KEYS
      .map(k => ({ key: k, label: RS_DOMAINS[k].label, emoji: RS_DOMAINS[k].emoji, score: domains[k] }))
      .sort((x, y) => y.score - x.score);

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
        meaning: RS_DIM_MEANING[d],
        emoji: RS_DIM_EMOJI[d], raw: raw[d], pct: pct[d]
      }))
      .sort((x, y) => y.pct - x.pct);

    const code = ranked.slice(0, 3).map(r => r.dim).join('');   // doc section 7
    const d1 = ranked[0].pct - ranked[1].pct;
    const spread = ranked[0].pct - ranked[5].pct;

    // Differentiation (Healy & Mourton): the spread of the six scores. A
    // student whose answers are scattered evenly has no real interest
    // shape, and the code would be invented by tie-breaking.
    const mean = RS_DIMS.reduce((t, d) => t + pct[d], 0) / RS_DIMS.length;
    const sd = Math.sqrt(RS_DIMS.reduce((t, d) => t + (pct[d] - mean) * (pct[d] - mean), 0) / RS_DIMS.length);
    const flat = sd < RS_FLAT_SD;

    // Consistency (Holland): top two areas side by side on the hexagon is
    // the usual pattern; opposite areas (e.g. R and S) are a rarer mix
    // worth talking through.
    const hex = rsHexDistance(ranked[0].dim, ranked[1].dim);
    const consistency = hex === 1 ? 'high' : hex === 2 ? 'medium' : 'low';

    return {
      raw, pct, ranked, maxima, code, answered,
      domainRaw, domainMaxima, domains, domainRanked,
      subjects,
      d1, spread, sd, flat, consistency,
      close: rsCloseGroups(ranked),
      confidence: flat ? 'low' : d1 >= 12 || spread >= 40 ? 'high' : d1 >= 5 ? 'medium' : 'low'
    };
  }

  // Below this standard deviation of the six area scores the profile is
  // treated as flat. Set by simulating the quiz: about 85% of students who
  // pick options at random fall below 9, while over 90% of students who
  // pick their two favourite areas even 40% of the time land above it.
  const RS_FLAT_SD = 9;

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

  // ── Domain match ─────────────────────────────────────────────────────────
  // How much the student wants to work in this career's world, 0-1. A
  // career lists its main domain first; a second domain counts slightly
  // less, so "Drone Engineer" (machines, digital) suits a digital student
  // without beating "Computer Science Engineer" for them.
  const RS_SECOND_DOMAIN = 0.8;

  // null when the student has no world scores (a result saved before Part 2
  // existed), so the layer is left out rather than counted as zero.
  function rsDomainFit(domains, career) {
    const list = career.domains || [];
    if (!domains) return null;
    if (!list.length) return 0;
    let best = 0;
    list.forEach((k, i) => {
      const v = (domains[k] || 0) * (i === 0 ? 1 : RS_SECOND_DOMAIN);
      if (v > best) best = v;
    });
    return best;
  }

  // ── Subject match ────────────────────────────────────────────────────────
  // How strong the student is in the subjects a career leans on, 0-1, with
  // their own strongest subject = 1. A career's first subject counts most.
  // null when there are no subject answers; a career that any subject can
  // lead to (no `subjects`) is neutral.
  function rsSubjectFit(subjects, career) {
    if (!subjects) return null;
    const top = Math.max.apply(null, RS_SUBJECT_KEYS.map(k => subjects[k] || 0));
    const list = career.subjects || [];
    if (top <= 0 || !list.length) return 0.5;
    let total = 0, used = 0;
    list.forEach((k, i) => {
      const w = i === 0 ? 2 : 1;
      total += w * (subjects[k] || 0) / top;
      used += w;
    });
    return total / used;
  }

  // ── Fit weights (doc section 11) ─────────────────────────────────────────
  // Interest pattern says what kind of work the student enjoys, the world
  // says where they want to do it, and subjects say whether the road there
  // suits them. Interest leads: it is the best-validated predictor of career
  // satisfaction (O*NET, Strong, SDS all match on it). Adding a layer later
  // (work style, values) means giving it a weight here and a scorer in
  // `extras` — the ranking code below does not change.
  const RS_FIT_WEIGHTS = { interest: 0.55, domain: 0.30, subjects: 0.15, workStyle: 0, values: 0 };

  // scoring: the rsScore() result.
  // extras: { workStyle?: (career)=>0..1, values?: (career)=>0..1 }
  function rsCareerFit(scoring, career, extras, weights) {
    const W = weights || RS_FIT_WEIGHTS;
    // Every layer is on a 0-1 scale so the weighted blend stays meaningful.
    // A layer the student has no answers for is null and drops out.
    const parts = {
      interest: rsSimilarityToPct(rsPatternSimilarity(scoring.pct, career.riasec)) / 100,
      domain: rsDomainFit(scoring.domains, career),
      subjects: rsSubjectFit(scoring.subjects, career)
    };
    ['workStyle', 'values'].forEach(k => {
      parts[k] = extras && typeof extras[k] === 'function' ? extras[k](career) : null;
    });
    let total = 0, used = 0;
    for (const k in parts) {
      const w = W[k] || 0;
      if (w > 0 && parts[k] !== null) { total += w * parts[k]; used += w; }
    }
    // Renormalise so a partially-configured weighting still yields 0..1.
    return { fit: used > 0 ? total / used : 0, parts };
  }

  // ── Minimum-fit rule (doc section 13) ───────────────────────────────────
  // On the blended scale an unrelated interest pattern (0.5) in the
  // student's favourite world scores about 68, and a near-perfect interest
  // match in a world they did not pick scores about 62. 65 keeps the first
  // (an undecided student still gets careers in the world they chose) and
  // drops the second.
  const RS_MIN_FIT = 65;

  // ── Diversity rule (doc section 14) ─────────────────────────────────────
  // "Do not return five almost-identical careers when several strong
  // alternatives exist." Each career declares a `family`; at most
  // RS_MAX_PER_FAMILY of the shortlist may come from one family. Careers
  // skipped by the cap stay available as backfill, so a genuinely narrow
  // profile still gets a full list rather than a short one.
  const RS_MAX_PER_FAMILY = 2;
  // Variety must not cost accuracy: a family may take ONE extra slot when
  // every career from another family is more than this many points behind.
  // Otherwise a student who clearly wants software would lose "Computer
  // Science Engineer" to a much weaker match just for variety.
  const RS_VARIETY_MARGIN = 5;

  function rsMatchCareers(scoring, database, options) {
    const o = options || {};
    const db = database || (typeof RIASEC_CAREERS !== 'undefined' ? RIASEC_CAREERS : []);
    const minFit = o.minFit === undefined ? RS_MIN_FIT : o.minFit;
    const maxPerFamily = o.maxPerFamily === undefined ? RS_MAX_PER_FAMILY : o.maxPerFamily;
    const limit = o.limit === undefined ? 5 : o.limit;

    const scored = db.map(c => {
      const { fit, parts } = rsCareerFit(scoring, c, o.extras, o.weights);
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
    const famOf = s => s.career.family || s.career.title;
    const take = cap => {
      const perFamily = {};
      const picked = [];
      for (let i = 0; i < qualified.length && picked.length < limit; i++) {
        const s = qualified[i];
        const fam = famOf(s);
        const n = perFamily[fam] || 0;
        if (n >= cap) {
          if (n > cap) continue;
          // The best later career from a family that still has room.
          const alt = qualified.slice(i + 1).find(x => (perFamily[famOf(x)] || 0) < cap && famOf(x) !== fam);
          if (alt && alt.match_pct >= s.match_pct - RS_VARIETY_MARGIN) continue;
        }
        perFamily[fam] = n + 1;
        picked.push(s);
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
    // Shuffled within each part; Part 1 always comes before Part 2.
    const parts = [...new Set(Q.map(q => q.part || 1))].sort((a, b) => a - b);
    const questionOrder = [];
    parts.forEach(p => {
      const idx = Q.map((q, i) => i).filter(i => (Q[i].part || 1) === p);
      rsShuffled(idx.length, rand).forEach(j => questionOrder.push(idx[j]));
    });
    return {
      seed: s,
      questionOrder: questionOrder,
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
    const domainCount = {};
    RS_DOMAIN_KEYS.forEach(k => { domainCount[k] = 0; });
    // secondary[area][neighbour]: how often an option of `area` hands its
    // remaining weight to that neighbour.
    const secondary = {};
    RS_DIMS.forEach(d => { secondary[d] = {}; rsNeighbours(d).forEach(n => { secondary[d][n] = 0; }); });
    const seenIds = {}, seenText = {};

    Q.forEach(q => {
      const label = q.id || q.q.slice(0, 20);
      if (seenIds[q.id]) problems.push(label + ': duplicate id');
      seenIds[q.id] = true;
      if (seenText[q.q]) problems.push(label + ': same wording as ' + seenText[q.q]);
      seenText[q.q] = label;
      if (!q.maxSelect || q.maxSelect < 1) problems.push(label + ': maxSelect must be >= 1');

      if (q.type === 'choice') {
        // One option per area, each giving its own area RS_PRIMARY_WEIGHT:
        // that is what keeps every area on the same ceiling.
        const inQuestion = {};
        q.opts.forEach((o, j) => {
          const keys = Object.keys(o.w || {});
          if (!keys.length) { problems.push(label + ' opt ' + j + ': no weights'); return; }
          const sum = keys.reduce((t, k) => t + o.w[k], 0);
          if (Math.abs(sum - 1) > 1e-9) {
            problems.push(label + ' opt ' + j + ': weights sum to ' + sum.toFixed(3) + ', expected 1');
          }
          keys.forEach(k => {
            if (RS_DIMS.indexOf(k) === -1) problems.push(label + ' opt ' + j + ': unknown dimension "' + k + '"');
          });
          const top = keys.reduce((a, b) => (o.w[b] > o.w[a] ? b : a), keys[0]);
          if (Math.abs(o.w[top] - RS_PRIMARY_WEIGHT) > 1e-9) {
            problems.push(label + ' opt ' + j + ': own area weighs ' + o.w[top] + ', expected ' + RS_PRIMARY_WEIGHT);
          }
          if (inQuestion[top]) problems.push(label + ': two options are mainly ' + top);
          inQuestion[top] = true;
          if (primaryCount[top] !== undefined) primaryCount[top]++;
          keys.filter(k => k !== top).forEach(k => {
            if (!secondary[top] || secondary[top][k] === undefined) {
              problems.push(label + ' opt ' + j + ': ' + k + ' is not next to ' + top + ' on the hexagon');
            } else {
              secondary[top][k]++;
            }
          });
        });
        RS_DIMS.forEach(d => { if (!inQuestion[d]) problems.push(label + ': no option for ' + d); });
      } else if (q.type === 'domain') {
        const inQuestion = {};
        q.opts.forEach((o, j) => {
          if (domainCount[o.domain] === undefined) {
            problems.push(label + ' opt ' + j + ': unknown domain "' + o.domain + '"');
            return;
          }
          if (inQuestion[o.domain]) problems.push(label + ': domain "' + o.domain + '" offered twice');
          inQuestion[o.domain] = true;
          domainCount[o.domain]++;
        });
      } else if (q.type === 'subject') {
        q.opts.forEach((o, j) => {
          if (!RS_SUBJECTS[o.subject]) problems.push(label + ' opt ' + j + ': unknown subject "' + o.subject + '"');
        });
      } else {
        problems.push(label + ': unknown question type "' + q.type + '"');
      }
    });

    // Every area must split its secondary weight evenly between its two
    // neighbours, or some areas would collect more "free" points than
    // others and a random answerer would no longer come out flat.
    RS_DIMS.forEach(d => {
      const [a, b] = rsNeighbours(d);
      if (secondary[d][a] !== secondary[d][b]) {
        problems.push(d + ' gives its neighbours unequal secondary weight: ' + JSON.stringify(secondary[d]));
      }
    });

    // Equal appearances per domain keeps no world favoured by the questions.
    const dc = RS_DOMAIN_KEYS.map(k => domainCount[k]);
    if (Math.min.apply(null, dc) !== Math.max.apply(null, dc)) {
      problems.push('domains appear an unequal number of times: ' + JSON.stringify(domainCount));
    }

    return { problems, primaryCount, domainCount, secondary, maxima: rsComputeMaxima(Q) };
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
      if (!Array.isArray(c.domains) || !c.domains.length || c.domains.length > 2) {
        problems.push(label + ': needs one or two domains');
      } else {
        c.domains.forEach(k => {
          if (!RS_DOMAINS[k]) problems.push(label + ': unknown domain "' + k + '"');
        });
      }
      if (!Array.isArray(c.subjects)) problems.push(label + ': needs a subjects list (may be empty)');
      else c.subjects.forEach(k => { if (!RS_SUBJECTS[k]) problems.push(label + ': unknown subject "' + k + '"'); });
      if (!Object.keys(rsCareerStreams(c)).length) problems.push(label + ': stream "' + c.stream + '" names no Class 11 stream');
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

  // Shown instead of a two-letter type when the profile is flat: a type
  // picked by tie-breaking would tell the student something untrue.
  const RS_FLAT_PROFILE = {
    type: 'The All-Round Explorer',
    desc: 'Your answers spread across many kinds of work, with no clear favourite yet. That is common at your age. ' +
      'Your careers below lean on the worlds and subjects you chose. Try the quiz again in a few months, or talk it through with a counsellor.'
  };

  function rsProfileFor(scoring) {
    if (scoring.flat) return Object.assign({ key: 'flat' }, RS_FLAT_PROFILE);
    const key = scoring.ranked[0].dim + scoring.ranked[1].dim;
    const p = RS_PROFILES[key];
    // Every ordered pair of six distinct letters is present, so this only
    // falls back if RS_PROFILES is edited badly.
    return p ? Object.assign({ key: key }, p)
      : { key: key, type: 'The Multi-Interest Explorer', desc: 'Your interests spread across several areas rather than concentrating in one.' };
  }

  // ── Stream ranking ───────────────────────────────────────────────────────
  // All four Class 11 streams are ranked, the way Indian career reports do,
  // from two signals shown side by side:
  //   - careers: how well the student's best-fitting careers are reached
  //     from that stream (a career listing "PCM / PCB" counts for both;
  //     "Any" counts half for every stream);
  //   - subjects: how strong the student says they are in that stream's
  //     core subjects (Part 3).
  // `token` is the value the career catalogue and the explorer use.
  const RS_STREAMS = [
    { key: 'PCM', token: 'PCM', label: 'Science with Maths (PCM)',
      subjects: { maths: 0.4, physics: 0.35, chemistry: 0.15, computers: 0.1 } },
    { key: 'PCB', token: 'PCB', label: 'Science with Biology (PCB)',
      subjects: { biology: 0.45, chemistry: 0.35, physics: 0.2 } },
    { key: 'Commerce', token: 'Commerce', label: 'Commerce',
      subjects: { economics: 0.45, maths: 0.35, languages: 0.2 } },
    { key: 'Humanities', token: 'Arts', label: 'Humanities / Arts',
      subjects: { social: 0.35, languages: 0.35, economics: 0.15, arts: 0.15 } },
  ];
  const RS_STREAM_WEIGHTS = { careers: 0.6, subjects: 0.4 };
  // How many of the best-fitting careers vote on the stream.
  const RS_STREAM_POOL = 12;

  // Which of RS_STREAMS a career's stream text names.
  function rsCareerStreams(career) {
    const toks = String(career.stream || '').split('/').map(t => t.trim());
    const out = {};
    toks.forEach(t => {
      if (t === 'PCM' || t === 'PCM+CS') out.PCM = 1;
      else if (t === 'PCB') out.PCB = 1;
      else if (t === 'Commerce') out.Commerce = 1;
      else if (t === 'Arts') out.Humanities = 1;
      else if (t === 'Any') RS_STREAMS.forEach(s => { if (!out[s.key]) out[s.key] = 0.5; });
    });
    return out;
  }

  function rsRankStreams(scoring, matchAll) {
    const pool = (matchAll || []).slice(0, RS_STREAM_POOL);
    const support = {}, count = {};
    RS_STREAMS.forEach(s => { support[s.key] = 0; count[s.key] = 0; });
    pool.forEach(m => {
      const st = rsCareerStreams(m.career);
      for (const k in st) {
        support[k] += st[k] * m.fit;
        if (st[k] === 1) count[k]++;
      }
    });
    const topSupport = Math.max.apply(null, RS_STREAMS.map(s => support[s.key])) || 1;

    const subj = scoring.subjects || null;
    const topSubj = subj ? Math.max.apply(null, RS_SUBJECT_KEYS.map(k => subj[k] || 0)) : 0;

    const streams = RS_STREAMS.map(s => {
      const careers = support[s.key] / topSupport;
      let subjects = null;
      if (subj && topSubj > 0) {
        subjects = 0;
        for (const k in s.subjects) subjects += s.subjects[k] * (subj[k] || 0) / topSubj;
      }
      const score = subjects === null
        ? careers
        : RS_STREAM_WEIGHTS.careers * careers + RS_STREAM_WEIGHTS.subjects * subjects;
      // The stream's core subjects the student is strong in, strongest first.
      const strong = subj && topSubj > 0
        ? Object.keys(s.subjects).filter(k => (subj[k] || 0) / topSubj >= 0.6)
          .sort((a, b) => subj[b] - subj[a]).map(k => RS_SUBJECTS[k].label)
        : [];
      return {
        key: s.key, token: s.token, label: s.label,
        score: Math.round(score * 100),
        careersScore: Math.round(careers * 100),
        subjectsScore: subjects === null ? null : Math.round(subjects * 100),
        careerCount: count[s.key],
        strongSubjects: strong
      };
    }).sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));

    streams.forEach(s => { s.reason = rsStreamReason(s, pool.length); });
    return streams;
  }

  // "Maths", "Maths and Physics", "Maths, Physics and Chemistry".
  function rsListText(items) {
    return items.length < 2 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  function rsStreamReason(s, poolSize) {
    const parts = [];
    parts.push(s.careerCount === 0
      ? 'none of your ' + poolSize + ' best-fit careers start here'
      : s.careerCount === poolSize
        ? 'all ' + poolSize + ' of your best-fit careers start here'
        : s.careerCount + ' of your ' + poolSize + ' best-fit careers start here');
    if (s.subjectsScore !== null) {
      parts.push(s.strongSubjects.length
        ? 'you are strong in ' + rsListText(s.strongSubjects)
        : 'its core subjects are not among your strongest');
    }
    const t = parts.join(', and ');
    return t.charAt(0).toUpperCase() + t.slice(1) + '.';
  }

  // The recommendation in the catalogue's stream format ("PCM", "PCB",
  // "Commerce", "Arts"), naming a second stream only when it is close.
  function rsStreamRecommendation(streams) {
    if (!streams.length || streams[0].score === 0) return 'Any';
    const a = streams[0], b = streams[1];
    return b && a.score - b.score <= 8 ? a.token + ' / ' + b.token : a.token;
  }

  // ── Fit labels ───────────────────────────────────────────────────────────
  // Words next to the percentage, so a student knows whether 78% is good.
  // The bands match the explorer's fit filter.
  function rsFitLabel(pct) {
    return pct >= 85 ? 'Excellent fit' : pct >= 75 ? 'Strong fit' : pct >= RS_MIN_FIT ? 'Good fit' : 'Weaker fit';
  }

  // ══════════════════════════════════════════════════════════════
  // RESULT OBJECT
  //
  // Shape note: personality_type / personality_desc / stream_recommendation
  // / stream_reason / top_careers[] are what the dashboard, results, explorer
  // and progress screens in app.html already read, so they are kept exactly
  // as they were. The `riasec` block is the new material for the result
  // screen (doc section 15).
  // ══════════════════════════════════════════════════════════════
  function rsBuildResults(scoring, database, options) {
    const match = rsMatchCareers(scoring, database, options);
    const profile = rsProfileFor(scoring);
    const streams = rsRankStreams(scoring, match.all);
    const top3 = scoring.ranked.slice(0, 3);

    const strongest = top3.map(r => r.plain.toLowerCase()).slice(0, 2).join(' and ');
    const streamReason = (scoring.flat
      ? 'Your interests are spread out, so this comes mostly from the worlds and subjects you chose. '
      : 'Your strongest areas are ' + strongest + '. ') + streams[0].reason;

    return {
      // Lets a saved run be recognised as coming from an older question set.
      engine_version: RS_ENGINE_VERSION,
      // ── existing shape, consumed across app.html ──
      personality_type: profile.type,
      personality_desc: profile.desc,
      stream_recommendation: rsStreamRecommendation(streams),
      stream_reason: streamReason,
      // All four streams, best first (see rsRankStreams).
      streams: streams,
      top_careers: match.shortlist.map((s, i) => ({
        rank: i + 1,
        title: s.career.title,
        emoji: s.career.emoji,
        field: s.career.field,
        match_pct: s.match_pct,
        fit_label: rsFitLabel(s.match_pct),
        why: s.career.why,
        stream: s.career.stream,
        salary: s.career.salary
      })),

      // ── new RIASEC material (doc section 15) ──
      riasec: {
        code: scoring.code,
        pct: scoring.pct,
        ranked: scoring.ranked.map(r => ({
          //dim: r.dim, name: r.name, plain: r.plain,
          dim: r.dim, name: r.name, plain: r.plain, meaning: r.meaning,
          emoji: r.emoji, pct: Math.round(r.pct)
        })),
        close: scoring.close,
        confidence: scoring.confidence,
        flat: scoring.flat,
        consistency: scoring.consistency,
        enjoy: rsEnjoyList(scoring),
        profileKey: profile.key,
        qualifiedCount: match.qualifiedCount,
        consideredCount: match.all.length,
        // Every world's 0-1 score, so a saved result can be re-matched
        // against any career (the explorer does this).
        domainScores: scoring.domains,
        // The worlds the student picked most, strongest first. Only domains
        // within reach of the favourite are listed.
        domains: scoring.domainRanked
          .filter(d => d.score >= 0.5)
          .slice(0, 3)
          .map(d => ({ key: d.key, label: d.label, emoji: d.emoji, score: Math.round(d.score * 100) })),
        // Raw subject strengths, for re-matching like domainScores.
        subjectScores: scoring.subjects
      }
    };
  }

  // True when a saved results object came from the current question set.
  function rsIsCurrentResult(results) {
    return !!results && results.engine_version === RS_ENGINE_VERSION;
  }

  return {
    RS_ENGINE_VERSION,
    RS_DIMS, RS_DIM_NAMES, RS_DIM_PLAIN, RS_DIM_EMOJI, RS_DIM_ENJOY,
    RS_DIM_MEANING,
    RS_PROFILES, rsProfileFor, rsBuildResults,
    rsPatternSimilarity, rsSimilarityToPct,
    RS_QUESTIONS, RS_PRIMARY_WEIGHT, RS_DOMAINS, RS_DOMAIN_KEYS,
    RS_SUBJECTS, RS_SUBJECT_KEYS, RS_HEXAGON, rsNeighbours, rsHexDistance, RS_FLAT_SD,
    RS_STREAMS, rsCareerStreams, rsRankStreams, rsStreamRecommendation, rsFitLabel, rsSubjectFit,
    RS_CLOSE_THRESHOLD, RS_MIN_FIT, RS_MAX_PER_FAMILY, RS_VARIETY_MARGIN,
    RS_FIT_WEIGHTS, RS_SECOND_DOMAIN,
    rsComputeMaxima, rsComputeDomainMaxima, rsScore, rsCloseGroups, rsEnjoyList,
    rsDomainFit, rsCareerFit, rsMatchCareers, rsIsCurrentResult,
    rsMulberry32, rsShuffled, rsBuildOrder,
    rsValidateQuestions, rsValidateCareers,
  };
});
