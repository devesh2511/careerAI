// ══════════════════════════════════════════════════════════════
// RIASEC CAREER DATABASE
//
// Doc section 9 / 15: every career carries its own six-dimensional RIASEC
// profile, and matching compares the student's full profile against it by
// pattern similarity (doc section 10) — never by the single top letter.
// See the note above rsPatternSimilarity in riasec_engine.js for why the
// comparison is mean-centred rather than a plain cosine.
//
// Fields
//   riasec  — 0-100 per dimension. NOT normalised to sum to anything: the
//             match only cares about the SHAPE of the profile, so a career
//             can legitimately be high on several dimensions at once.
//   family  — used by the diversity rule (doc section 14) to stop the
//             shortlist filling up with five near-identical jobs. Careers
//             that would compete for the same shortlist slot share a family.
//   domains — the world the work happens in (RS_DOMAINS in the engine),
//             main one first, at most two. This is what separates careers
//             with the same interest shape, e.g. Software Engineer
//             ('digital') from Mechanical Engineer ('machines').
//   why     — career-intrinsic, one line, Class 9-10 reading level. Shown
//             under "Careers to explore".
//   stream / salary — Indian Class 11 stream and realistic starting range,
//             carried over from the previous catalogue where the career
//             already existed there.
//
// Values are illustrative application figures, not official O*NET
// occupation scores (see the source note in the class-9 doc). They are
// authored to be internally consistent so ranking behaves sensibly.
//
// SNAPSHOT FOR THE NODE TESTS. The live catalogue is the careers table in
// careerAPI (migration 010_careers.sql was generated from this file), served
// by GET /careers; the browser no longer loads this file. Edit careers there
// with a migration, then mirror the change here so the tests match.
// ══════════════════════════════════════════════════════════════
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RIASEC_CAREERS = [
    // ── ENGINEERING & TECHNOLOGY (PCM / Technical) ────────────────────────────
    {
      title: 'Computer Science Engineer (Software & Systems)', emoji: '💻', field: 'Technology', family: 'computing',
      stream: 'PCM+CS', salary: '₹5–9 LPA starting',
      riasec: { R: 35, I: 90, A: 40, S: 30, E: 35, C: 75 },
      domains: ['digital'],
      subjects: ['maths', 'computers', 'physics'],
      why: 'Breaking a problem into logical steps and building something that works.'
    },
    {
      title: 'AI & Machine Learning Engineer', emoji: '🤖', field: 'Technology', family: 'computing',
      stream: 'PCM+CS', salary: '₹8–18 LPA starting',
      riasec: { R: 35, I: 95, A: 45, S: 25, E: 40, C: 75 },
      domains: ['digital'],
      subjects: ['maths', 'computers'],
      why: 'Teaching computers to learn from data and make decisions.'
    },
    {
      title: 'Data Scientist / Data Analyst', emoji: '📊', field: 'Analytics', family: 'computing',
      stream: 'PCM+CS / Commerce', salary: '₹6–13 LPA starting',
      riasec: { R: 25, I: 95, A: 35, S: 30, E: 40, C: 85 },
      domains: ['digital', 'money'],
      subjects: ['maths', 'computers', 'economics'],
      why: 'Finding patterns hidden in large amounts of information.'
    },
    {
      title: 'Cybersecurity Specialist / Ethical Hacker', emoji: '🔐', field: 'Technology', family: 'computing',
      stream: 'PCM+CS', salary: '₹5–11 LPA starting',
      riasec: { R: 40, I: 90, A: 25, S: 30, E: 35, C: 85 },
      domains: ['digital'],
      subjects: ['computers', 'maths'],
      why: 'Thinking like a hacker to find the weak spots before the real ones do.'
    },
    {
      title: 'Cloud Computing & DevOps Engineer', emoji: '☁️', field: 'Technology', family: 'computing',
      stream: 'PCM+CS', salary: '₹5–10 LPA starting',
      riasec: { R: 40, I: 75, A: 20, S: 25, E: 30, C: 85 },
      domains: ['digital'],
      subjects: ['computers', 'maths'],
      why: 'Keeping the apps millions of people use fast, safe and always running.'
    },
    {
      title: 'Blockchain Developer', emoji: '🔗', field: 'Technology + Finance', family: 'computing',
      stream: 'PCM+CS', salary: '₹6–12 LPA starting',
      riasec: { R: 25, I: 85, A: 30, S: 20, E: 50, C: 80 },
      domains: ['digital', 'money'],
      subjects: ['computers', 'maths', 'economics'],
      why: 'Writing secure code for digital payments and records nobody can tamper with.'
    },
    {
      title: 'Full-Stack Web Developer', emoji: '🌐', field: 'Technology', family: 'computing',
      stream: 'PCM+CS', salary: '₹4–9 LPA starting',
      riasec: { R: 30, I: 80, A: 55, S: 30, E: 35, C: 70 },
      domains: ['digital', 'media'],
      subjects: ['computers', 'maths'],
      why: 'Building whole websites and apps, from the screens people see to the code behind them.'
    },
    {
      title: 'Big Data Engineer', emoji: '🗄️', field: 'Data Engineering', family: 'computing',
      stream: 'PCM+CS', salary: '₹6–12 LPA starting',
      riasec: { R: 30, I: 90, A: 20, S: 20, E: 30, C: 85 },
      domains: ['digital'],
      subjects: ['computers', 'maths'],
      why: 'Building the pipelines that move and store huge amounts of data every second.'
    },
    {
      title: 'UI/UX Designer', emoji: '🎨', field: 'Design + Technology', family: 'computing',
      stream: 'PCM+CS / Arts', salary: '₹5–13 LPA starting',
      riasec: { R: 30, I: 70, A: 95, S: 60, E: 50, C: 50 },
      domains: ['digital', 'media'],
      subjects: ['arts', 'computers'],
      why: 'Designing something that feels obvious the first time you use it.'
    },
    {
      title: 'Robotics & Mechatronics Engineer', emoji: '🤖', field: 'Engineering', family: 'engineering',
      stream: 'PCM', salary: '₹6–15 LPA starting',
      riasec: { R: 90, I: 90, A: 35, S: 25, E: 30, C: 60 },
      domains: ['machines', 'digital'],
      subjects: ['maths', 'physics', 'computers'],
      why: 'Building machines that sense the world and act on their own.'
    },
    {
      title: 'Mechanical Engineer', emoji: '⚙️', field: 'Engineering', family: 'engineering',
      stream: 'PCM', salary: '₹4–8 LPA starting',
      riasec: { R: 90, I: 80, A: 25, S: 25, E: 30, C: 55 },
      domains: ['machines'],
      subjects: ['maths', 'physics'],
      why: 'Designing machines, then testing whether they really work.'
    },
    {
      title: 'Civil Engineer', emoji: '🌉', field: 'Engineering', family: 'engineering',
      stream: 'PCM', salary: '₹4–8 LPA starting',
      riasec: { R: 90, I: 70, A: 30, S: 35, E: 40, C: 70 },
      domains: ['built'],
      subjects: ['maths', 'physics'],
      why: 'Building roads, bridges, and buildings that have to stay standing.'
    },
    {
      title: 'Electrical & Electronics Engineer', emoji: '⚡', field: 'Engineering', family: 'engineering',
      stream: 'PCM', salary: '₹4–8 LPA starting',
      riasec: { R: 85, I: 85, A: 20, S: 25, E: 30, C: 65 },
      domains: ['machines', 'digital'],
      subjects: ['physics', 'maths'],
      why: 'Designing the circuits, chips and power systems everything electronic runs on.'
    },
    {
      title: 'Aerospace Engineer', emoji: '✈️', field: 'Engineering', family: 'engineering',
      stream: 'PCM', salary: '₹5–12 LPA starting',
      riasec: { R: 85, I: 95, A: 30, S: 20, E: 25, C: 70 },
      domains: ['machines'],
      subjects: ['physics', 'maths'],
      why: 'Designing things that fly, where every calculation has to be right.'
    },
    {
      title: 'Chemical Engineer', emoji: '🧪', field: 'Engineering', family: 'engineering',
      stream: 'PCM', salary: '₹4–9 LPA starting',
      riasec: { R: 80, I: 90, A: 20, S: 25, E: 30, C: 75 },
      domains: ['machines', 'planet'],
      subjects: ['chemistry', 'maths', 'physics'],
      why: 'Scaling a chemical reaction up from a beaker to a whole plant.'
    },
    {
      title: 'Biomedical Engineer', emoji: '🏥', field: 'Engineering + Healthcare', family: 'engineering',
      stream: 'PCM / PCB', salary: '₹4–10 LPA starting',
      riasec: { R: 85, I: 95, A: 40, S: 70, E: 30, C: 65 },
      domains: ['life', 'machines'],
      subjects: ['biology', 'physics', 'maths'],
      why: 'Building the machines and devices that hospitals rely on.'
    },
    {
      title: 'Petroleum Engineer', emoji: '🛢️', field: 'Energy', family: 'engineering',
      stream: 'PCM', salary: '₹6–12 LPA starting',
      riasec: { R: 85, I: 80, A: 15, S: 25, E: 40, C: 70 },
      domains: ['machines', 'planet'],
      subjects: ['chemistry', 'physics', 'maths'],
      why: 'Finding and safely bringing up the oil and gas deep underground.'
    },
    {
      title: 'Environmental & Sustainability Engineer', emoji: '🌱', field: 'Environment', family: 'engineering',
      stream: 'PCM', salary: '₹4–8 LPA starting',
      riasec: { R: 75, I: 85, A: 30, S: 45, E: 45, C: 65 },
      domains: ['planet', 'built'],
      subjects: ['chemistry', 'maths', 'social'],
      why: 'Designing clean water, clean energy and less waste for cities and factories.'
    },
    {
      title: 'Marine Engineer', emoji: '🚢', field: 'Shipping', family: 'transport',
      stream: 'PCM', salary: '₹6–12 LPA starting',
      riasec: { R: 95, I: 75, A: 20, S: 25, E: 30, C: 70 },
      domains: ['machines', 'planet'],
      subjects: ['physics', 'maths'],
      why: 'Running and repairing the engines and systems that keep a ship moving at sea.'
    },
    {
      title: 'Genetic / Biotechnology Engineer', emoji: '🧬', field: 'Biotechnology', family: 'life-science',
      stream: 'PCB / PCM', salary: '₹4–8 LPA starting',
      riasec: { R: 60, I: 95, A: 30, S: 35, E: 30, C: 65 },
      domains: ['life', 'planet'],
      subjects: ['biology', 'chemistry'],
      why: 'Working with genes and living cells to create new medicines and crops.'
    },
    {
      title: 'Drone Technology Specialist', emoji: '🛸', field: 'Aerospace + Robotics', family: 'engineering',
      stream: 'PCM', salary: '₹4–8 LPA starting',
      riasec: { R: 90, I: 80, A: 35, S: 20, E: 35, C: 60 },
      domains: ['machines', 'digital'],
      subjects: ['physics', 'maths', 'computers'],
      why: 'Designing flying machines that map farms, deliver goods and help in disasters.'
    },
    {
      title: 'Architect', emoji: '🏛️', field: 'Design + Engineering', family: 'architecture',
      stream: 'PCM', salary: '₹4–10 LPA starting',
      riasec: { R: 75, I: 75, A: 95, S: 45, E: 50, C: 65 },
      domains: ['built', 'media'],
      subjects: ['maths', 'arts', 'physics'],
      why: 'Designing buildings that must stand up, work, and feel right.'
    },
    {
      title: 'Merchant Navy Officer / Engineer', emoji: '🚢', field: 'Marine', family: 'transport',
      stream: 'PCM', salary: '₹8–25 LPA starting',
      riasec: { R: 100, I: 65, A: 15, S: 45, E: 55, C: 85 },
      domains: ['machines', 'planet'],
      subjects: ['physics', 'maths'],
      why: 'Running machinery at sea, far from anyone who could help.'
    },
    {
      title: 'Commercial Pilot', emoji: '🛫', field: 'Aviation', family: 'transport',
      stream: 'PCM', salary: '₹8–25 LPA starting',
      riasec: { R: 95, I: 70, A: 20, S: 45, E: 45, C: 90 },
      domains: ['machines'],
      subjects: ['physics', 'maths'],
      why: 'Hands-on control of a machine, run entirely by checklist and rule.'
    },

    // ── MEDICINE, HEALTHCARE & LIFE SCIENCES (PCB / Medical) ──────────────────
    {
      title: 'MBBS Doctor / Surgeon', emoji: '🩺', field: 'Healthcare + Science', family: 'medicine',
      stream: 'PCB', salary: '₹8–30 LPA starting',
      riasec: { R: 45, I: 90, A: 20, S: 95, E: 40, C: 55 },
      domains: ['life', 'people'],
      subjects: ['biology', 'chemistry'],
      why: 'Diagnosing what is wrong, then treating the person in front of you.'
    },
    {
      title: 'Dentist', emoji: '🦷', field: 'Healthcare + Craft', family: 'medicine',
      stream: 'PCB', salary: '₹5–12 LPA starting',
      riasec: { R: 85, I: 75, A: 45, S: 80, E: 45, C: 65 },
      domains: ['life'],
      subjects: ['biology', 'chemistry'],
      why: 'Careful hands, small tools, and a patient who needs reassuring.'
    },
    {
      title: 'Ayurvedic Physician', emoji: '🌿', field: 'Medicine (AYUSH)', family: 'ayush',
      stream: 'PCB', salary: '₹3–7 LPA starting',
      riasec: { R: 50, I: 70, A: 40, S: 85, E: 40, C: 60 },
      domains: ['life', 'people'],
      subjects: ['biology', 'chemistry'],
      why: 'Treating patients with traditional Indian medicine, diet and lifestyle care.'
    },
    {
      title: 'Homeopathic Doctor', emoji: '💧', field: 'Medicine (AYUSH)', family: 'ayush',
      stream: 'PCB', salary: '₹3–6 LPA starting',
      riasec: { R: 30, I: 70, A: 40, S: 85, E: 40, C: 60 },
      domains: ['life', 'people'],
      subjects: ['biology', 'chemistry'],
      why: 'Listening closely to each patient and treating the whole person, not just the symptom.'
    },
    {
      title: 'Anesthesiologist', emoji: '💉', field: 'Medicine', family: 'medicine',
      stream: 'PCB', salary: '₹10–20 LPA after MD',
      riasec: { R: 70, I: 90, A: 15, S: 60, E: 30, C: 80 },
      domains: ['life'],
      subjects: ['biology', 'chemistry', 'physics'],
      why: 'Keeping patients safe and pain-free through surgery, second by second.'
    },
    {
      title: 'Veterinary Doctor', emoji: '🐾', field: 'Healthcare + Animals', family: 'medicine',
      stream: 'PCB', salary: '₹4–10 LPA starting',
      riasec: { R: 85, I: 85, A: 20, S: 75, E: 40, C: 55 },
      domains: ['life', 'planet'],
      subjects: ['biology', 'chemistry'],
      why: 'Hands-on medical work with animals that cannot tell you what hurts.'
    },
    {
      title: 'Pharmacist / Clinical Pharmacologist', emoji: '💊', field: 'Healthcare + Science', family: 'allied-health',
      stream: 'PCB', salary: '₹3–8 LPA starting',
      riasec: { R: 45, I: 80, A: 15, S: 65, E: 35, C: 95 },
      domains: ['life'],
      subjects: ['chemistry', 'biology'],
      why: 'Getting medicine and dosage exactly right, every single time.'
    },
    {
      title: 'Physiotherapist', emoji: '🏥', field: 'Healthcare + Hands-On', family: 'allied-health',
      stream: 'PCB', salary: '₹4–9 LPA starting',
      riasec: { R: 80, I: 70, A: 25, S: 95, E: 35, C: 50 },
      domains: ['life', 'people'],
      subjects: ['biology', 'physics'],
      why: 'Using physical movement to get someone back to normal life.'
    },
    {
      title: 'Occupational Therapist', emoji: '♿', field: 'Healthcare + People', family: 'allied-health',
      stream: 'PCB / Arts', salary: '₹4–9 LPA starting',
      riasec: { R: 65, I: 65, A: 55, S: 95, E: 35, C: 55 },
      domains: ['life', 'people'],
      subjects: ['biology', 'social'],
      why: 'Redesigning everyday tasks so a person can do them independently.'
    },
    {
      title: 'Registered Nurse', emoji: '💉', field: 'Healthcare', family: 'allied-health',
      stream: 'PCB', salary: '₹4–10 LPA starting',
      riasec: { R: 70, I: 70, A: 20, S: 100, E: 35, C: 80 },
      domains: ['life', 'people'],
      subjects: ['biology', 'chemistry'],
      why: 'Practical care, constant people contact, and records that must be right.'
    },
    {
      title: 'Medical Laboratory Technologist', emoji: '🧪', field: 'Diagnostics', family: 'allied-health',
      stream: 'PCB', salary: '₹2.5–5 LPA starting',
      riasec: { R: 70, I: 85, A: 15, S: 35, E: 20, C: 85 },
      domains: ['life'],
      subjects: ['biology', 'chemistry'],
      why: 'Running the tests on blood and samples that tell doctors what is wrong.'
    },
    {
      title: 'Nutritionist / Dietitian', emoji: '🥗', field: 'Health + Food', family: 'allied-health',
      stream: 'PCB', salary: '₹3–6 LPA starting',
      riasec: { R: 40, I: 80, A: 35, S: 85, E: 40, C: 55 },
      domains: ['life', 'people'],
      subjects: ['biology', 'chemistry'],
      why: 'Working out what someone should eat to get healthy and stay that way.'
    },
    {
      title: 'Healthcare Administrator / Hospital Manager', emoji: '🏥', field: 'Healthcare Management', family: 'allied-health',
      stream: 'PCB / Commerce', salary: '₹4–8 LPA starting',
      riasec: { R: 20, I: 60, A: 20, S: 70, E: 80, C: 85 },
      domains: ['life', 'money'],
      subjects: ['biology', 'economics'],
      why: 'Running a hospital so doctors and nurses have everything they need.'
    },
    {
      title: 'Clinical Psychologist', emoji: '🧠', field: 'Psychology', family: 'psychology',
      stream: 'PCB / Arts', salary: '₹4–12 LPA starting',
      riasec: { R: 20, I: 90, A: 45, S: 100, E: 35, C: 65 },
      domains: ['people', 'life'],
      subjects: ['social', 'biology', 'languages'],
      why: 'Understanding why a person feels as they do, then helping them change it.'
    },
    {
      title: 'Forensic Science Investigator', emoji: '🔍', field: 'Science + Law', family: 'life-science',
      stream: 'PCB / PCM', salary: '₹4–10 LPA starting',
      riasec: { R: 65, I: 90, A: 20, S: 35, E: 20, C: 90 },
      domains: ['life', 'people'],
      subjects: ['chemistry', 'biology'],
      why: 'Reading physical evidence carefully enough to stand up in court.'
    },
    {
      title: 'Biotechnologist / Research Scientist', emoji: '🔬', field: 'Life Sciences Research', family: 'life-science',
      stream: 'PCB', salary: '₹4–8 LPA starting',
      riasec: { R: 50, I: 100, A: 30, S: 25, E: 20, C: 60 },
      domains: ['life'],
      subjects: ['biology', 'chemistry'],
      why: 'Running experiments on cells and living things to discover something new.'
    },

    // ── COMMERCE, FINANCE & MANAGEMENT ────────────────────────────────────────
    {
      title: 'Chartered Accountant (CA)', emoji: '📑', field: 'Finance', family: 'accounting',
      stream: 'Commerce', salary: '₹6–14 LPA starting',
      riasec: { R: 20, I: 60, A: 15, S: 35, E: 60, C: 100 },
      domains: ['money'],
      subjects: ['maths', 'economics'],
      why: 'Accuracy with numbers, where being nearly right is not enough.'
    },
    {
      title: 'Company Secretary (CS)', emoji: '📑', field: 'Corporate Law + Compliance', family: 'accounting',
      stream: 'Commerce / Arts', salary: '₹4–8 LPA starting',
      riasec: { R: 10, I: 60, A: 15, S: 45, E: 60, C: 100 },
      domains: ['money', 'people'],
      subjects: ['economics', 'languages'],
      why: 'Making sure a company follows every law and its board decisions are on record.'
    },
    {
      title: 'Cost & Management Accountant (CMA)', emoji: '🧮', field: 'Accounting', family: 'accounting',
      stream: 'Commerce', salary: '₹4–8 LPA starting',
      riasec: { R: 10, I: 70, A: 10, S: 30, E: 55, C: 100 },
      domains: ['money'],
      subjects: ['maths', 'economics'],
      why: 'Working out what everything really costs so a business can price and plan well.'
    },
    {
      title: 'Investment Banker', emoji: '💰', field: 'Finance', family: 'finance',
      stream: 'Commerce', salary: '₹8–20 LPA starting',
      riasec: { R: 10, I: 70, A: 25, S: 50, E: 100, C: 90 },
      domains: ['money'],
      subjects: ['maths', 'economics'],
      why: 'High-pressure deals where you have to persuade and get the maths right.'
    },
    {
      title: 'Financial Analyst / Wealth Manager', emoji: '💹', field: 'Finance', family: 'finance',
      stream: 'Commerce / PCM', salary: '₹5–10 LPA starting',
      riasec: { R: 10, I: 85, A: 15, S: 55, E: 75, C: 85 },
      domains: ['money', 'people'],
      subjects: ['maths', 'economics'],
      why: 'Studying the numbers and helping people grow and protect their money.'
    },
    {
      title: 'Actuarial Scientist', emoji: '🧮', field: 'Finance + Risk', family: 'finance',
      stream: 'PCM+CS / Commerce', salary: '₹6–15 LPA starting',
      riasec: { R: 15, I: 95, A: 15, S: 25, E: 45, C: 100 },
      domains: ['money'],
      subjects: ['maths', 'economics'],
      why: 'Using maths to put a number on risk nobody can see yet.'
    },
    {
      title: 'Stock Broker / Equity Research Analyst', emoji: '📈', field: 'Stock Markets', family: 'finance',
      stream: 'Commerce', salary: '₹6–14 LPA starting',
      riasec: { R: 10, I: 90, A: 20, S: 35, E: 75, C: 95 },
      domains: ['money'],
      subjects: ['economics', 'maths'],
      why: 'Researching a company deeply enough to bet money on your view.'
    },
    {
      title: 'Product Manager', emoji: '📱', field: 'Technology + Business', family: 'business',
      stream: 'PCM+CS', salary: '₹8–18 LPA starting',
      riasec: { R: 30, I: 85, A: 65, S: 75, E: 95, C: 75 },
      domains: ['digital', 'money'],
      subjects: ['computers', 'economics'],
      why: 'Deciding what gets built, and getting everyone to agree on why.'
    },
    {
      title: 'Digital Marketing Specialist', emoji: '📈', field: 'Marketing', family: 'business',
      stream: 'Commerce / Any', salary: '₹3–7 LPA starting',
      riasec: { R: 10, I: 60, A: 70, S: 55, E: 90, C: 55 },
      domains: ['money', 'media'],
      subjects: ['economics', 'languages', 'arts'],
      why: 'Using ads, data and social media to get the right people to notice a product.'
    },
    {
      title: 'Retail & E-Commerce Manager', emoji: '🛒', field: 'Retail', family: 'business',
      stream: 'Commerce / Any', salary: '₹4–8 LPA starting',
      riasec: { R: 20, I: 55, A: 45, S: 60, E: 90, C: 70 },
      domains: ['money', 'digital'],
      subjects: ['economics', 'maths'],
      why: 'Deciding what a shop or online store sells, at what price, and how to sell more.'
    },
    {
      title: 'Business Analytics Consultant', emoji: '📊', field: 'Business + Data', family: 'business',
      stream: 'Commerce / PCM+CS', salary: '₹5–10 LPA starting',
      riasec: { R: 20, I: 80, A: 30, S: 60, E: 70, C: 95 },
      domains: ['money', 'digital'],
      subjects: ['maths', 'economics', 'computers'],
      why: 'Sitting between the business and the technical team, translating both ways.'
    },
    {
      title: 'Entrepreneur / Startup Founder', emoji: '🚀', field: 'Entrepreneurship', family: 'business',
      stream: 'Any', salary: 'Varies widely',
      riasec: { R: 45, I: 60, A: 65, S: 70, E: 100, C: 55 },
      domains: ['money'],
      subjects: ['economics', 'languages'],
      why: 'Starting something from zero and taking responsibility for all of it.'
    },
    {
      title: 'Human Resources (HR) Manager', emoji: '👥', field: 'Business + People', family: 'operations',
      stream: 'Commerce / Arts', salary: '₹6–16 LPA starting',
      riasec: { R: 15, I: 55, A: 35, S: 95, E: 85, C: 85 },
      domains: ['people', 'money'],
      subjects: ['languages', 'economics', 'social'],
      why: 'Looking after people while running fair, careful processes.'
    },
    {
      title: 'Supply Chain & Logistics Manager', emoji: '🚚', field: 'Operations + Business', family: 'operations',
      stream: 'Commerce / PCM', salary: '₹5–12 LPA starting',
      riasec: { R: 60, I: 65, A: 20, S: 55, E: 80, C: 100 },
      domains: ['money', 'machines'],
      subjects: ['economics', 'maths'],
      why: 'Keeping goods, costs, and timelines all under control at once.'
    },
    {
      title: 'Hotel / Hospitality Manager', emoji: '🏨', field: 'Hospitality', family: 'operations',
      stream: 'Commerce', salary: '₹4–10 LPA starting',
      riasec: { R: 50, I: 40, A: 50, S: 95, E: 85, C: 85 },
      domains: ['people', 'money'],
      subjects: ['languages', 'economics'],
      why: 'Running a place where the guest experience is the product.'
    },
    {
      title: 'Event Manager', emoji: '🎪', field: 'Business + Events', family: 'operations',
      stream: 'Commerce / Arts', salary: '₹3–9 LPA starting',
      riasec: { R: 55, I: 35, A: 75, S: 85, E: 95, C: 85 },
      domains: ['people', 'media'],
      subjects: ['languages', 'arts', 'economics'],
      why: 'A hundred details, a live audience, and no second chance.'
    },

    // ── ARTS, HUMANITIES, LAW & SOCIAL SCIENCES ───────────────────────────────
    {
      title: 'Advocate / Corporate Lawyer / Judge', emoji: '⚖️', field: 'Law', family: 'law',
      stream: 'Arts / Commerce / Any', salary: '₹4–15 LPA starting',
      riasec: { R: 15, I: 85, A: 45, S: 80, E: 85, C: 85 },
      domains: ['people', 'money'],
      subjects: ['languages', 'social'],
      why: 'Arguing a case, where the detail of the wording decides it.'
    },
    {
      title: 'Journalist / News Anchor', emoji: '📰', field: 'News Media', family: 'media-arts',
      stream: 'Arts', salary: '₹3–8 LPA starting',
      riasec: { R: 20, I: 80, A: 75, S: 80, E: 60, C: 50 },
      domains: ['media', 'people'],
      subjects: ['languages', 'social'],
      why: 'Digging until you find out what actually happened, then writing it.'
    },
    {
      title: 'Mass Communication & PR Specialist', emoji: '📣', field: 'Media + PR', family: 'media-arts',
      stream: 'Arts / Any', salary: '₹3–6 LPA starting',
      riasec: { R: 10, I: 45, A: 75, S: 80, E: 90, C: 45 },
      domains: ['media', 'people'],
      subjects: ['languages', 'arts'],
      why: 'Shaping how the public sees a person, a brand or a cause.'
    },
    {
      title: 'Content Creator / Copywriter', emoji: '📲', field: 'Digital Media', family: 'media-arts',
      stream: 'Arts / Commerce', salary: '₹3–20 LPA (varies)',
      riasec: { R: 35, I: 40, A: 95, S: 70, E: 90, C: 40 },
      domains: ['media', 'digital'],
      subjects: ['languages', 'arts', 'computers'],
      why: 'Writing and making the videos, posts and words that make people stop and pay attention.'
    },
    {
      title: 'Photographer / Videographer', emoji: '📷', field: 'Visual Media', family: 'media-arts',
      stream: 'Arts / Any', salary: '₹2.5–6 LPA starting',
      riasec: { R: 60, I: 40, A: 95, S: 40, E: 50, C: 35 },
      domains: ['media'],
      subjects: ['arts'],
      why: 'Capturing the moment, the light and the story in a single frame.'
    },
    {
      title: 'Graphic Designer', emoji: '🖼️', field: 'Design', family: 'design',
      stream: 'Arts / PCM+CS', salary: '₹4–10 LPA starting',
      riasec: { R: 30, I: 35, A: 100, S: 30, E: 45, C: 40 },
      domains: ['media'],
      subjects: ['arts', 'computers'],
      why: 'Making a message land through type, colour, and layout.'
    },
    {
      title: 'Fashion Designer', emoji: '👗', field: 'Design + Fashion', family: 'design',
      stream: 'Arts', salary: '₹3–12 LPA starting',
      riasec: { R: 60, I: 30, A: 100, S: 40, E: 60, C: 45 },
      domains: ['media'],
      subjects: ['arts'],
      why: 'Designing and constructing something a person will wear.'
    },
    {
      title: 'Interior Designer', emoji: '🛋️', field: 'Interior Design', family: 'design',
      stream: 'Arts / PCM', salary: '₹4–12 LPA starting',
      riasec: { R: 70, I: 45, A: 95, S: 55, E: 55, C: 50 },
      domains: ['built', 'media'],
      subjects: ['arts', 'maths'],
      why: 'Shaping a physical space so people move through it the right way.'
    },
    {
      title: 'Animator / VFX Artist', emoji: '🎞️', field: 'Animation + VFX', family: 'design',
      stream: 'Arts / PCM+CS', salary: '₹4–12 LPA starting',
      riasec: { R: 35, I: 55, A: 100, S: 25, E: 35, C: 50 },
      domains: ['media', 'digital'],
      subjects: ['arts', 'computers'],
      why: 'Giving movement and life to something that does not exist.'
    },
    {
      title: 'Product Designer', emoji: '📐', field: 'Design + Product', family: 'design',
      stream: 'Arts / PCM / Any', salary: '₹5–12 LPA starting',
      riasec: { R: 65, I: 65, A: 95, S: 50, E: 55, C: 45 },
      domains: ['media', 'digital'],
      subjects: ['arts', 'maths', 'computers'],
      why: 'Deciding how an everyday product looks, feels and works, from a bottle to a phone app.'
    },
    {
      title: 'Economist', emoji: '📉', field: 'Economics', family: 'social-science',
      stream: 'Commerce / Arts / PCM', salary: '₹5–10 LPA starting',
      riasec: { R: 10, I: 95, A: 30, S: 45, E: 55, C: 80 },
      domains: ['money', 'people'],
      subjects: ['economics', 'maths'],
      why: 'Using data to explain why prices, jobs and whole economies rise and fall.'
    },
    {
      title: 'Sociologist / Social Worker', emoji: '🌿', field: 'Society', family: 'social-science',
      stream: 'Arts', salary: '₹3–7 LPA starting',
      riasec: { R: 40, I: 55, A: 30, S: 100, E: 55, C: 65 },
      domains: ['people'],
      subjects: ['social', 'languages'],
      why: 'Being on the ground with families who need practical help.'
    },
    {
      title: 'Historian / Archaeologist', emoji: '🏺', field: 'History', family: 'social-science',
      stream: 'Arts', salary: '₹3–6 LPA starting',
      riasec: { R: 55, I: 95, A: 55, S: 40, E: 25, C: 70 },
      domains: ['people', 'media'],
      subjects: ['social', 'languages'],
      why: 'Digging up the past, in archives and in the ground, to find out what really happened.'
    },
    {
      title: 'Political Scientist / Policy Analyst', emoji: '📋', field: 'Politics + Policy', family: 'social-science',
      stream: 'Commerce / Arts', salary: '₹5–12 LPA starting',
      riasec: { R: 15, I: 95, A: 30, S: 65, E: 60, C: 90 },
      domains: ['people', 'money'],
      subjects: ['social', 'economics', 'languages'],
      why: 'Researching what a rule would actually do before it is made.'
    },
    {
      title: 'Foreign Language Translator / Interpreter', emoji: '🗣️', field: 'Languages', family: 'social-science',
      stream: 'Arts / Any', salary: '₹3–7 LPA starting',
      riasec: { R: 10, I: 60, A: 75, S: 80, E: 40, C: 70 },
      domains: ['people', 'media'],
      subjects: ['languages'],
      why: 'Helping people who speak different languages understand each other exactly.'
    },

    // ── GOVERNMENT, DEFENCE & PUBLIC SERVICE ──────────────────────────────────
    {
      title: 'Civil Services Officer (IAS / IPS / IFS)', emoji: '🏛️', field: 'Government', family: 'public-service',
      stream: 'Arts / Any', salary: '₹7–18 LPA (govt scale)',
      riasec: { R: 35, I: 75, A: 30, S: 90, E: 90, C: 95 },
      domains: ['people'],
      subjects: ['social', 'languages', 'economics'],
      why: 'Running public systems where both people and procedure matter.'
    },
    {
      title: 'Defence Services Officer (Army / Navy / Air Force)', emoji: '🎖️', field: 'Defence', family: 'public-service',
      stream: 'Any', salary: '₹7–15 LPA (service scale)',
      riasec: { R: 95, I: 60, A: 20, S: 75, E: 90, C: 85 },
      domains: ['people', 'machines'],
      subjects: ['maths', 'physics'],
      why: 'Physical, practical leadership under real discipline and pressure.'
    },
    {
      title: 'Public Sector Undertaking (PSU) Executive', emoji: '🏭', field: 'Public Sector', family: 'public-service',
      stream: 'PCM / Commerce', salary: '₹6–12 LPA starting',
      riasec: { R: 55, I: 70, A: 20, S: 50, E: 70, C: 80 },
      domains: ['machines', 'money'],
      subjects: ['maths', 'physics', 'economics'],
      why: 'Running the power plants, railways and oil companies the country depends on.'
    },
    {
      title: 'Bank PO / RBI Grade B Officer', emoji: '🏦', field: 'Banking', family: 'public-service',
      stream: 'Commerce', salary: '₹4–10 LPA starting',
      riasec: { R: 15, I: 50, A: 15, S: 80, E: 85, C: 95 },
      domains: ['money', 'people'],
      subjects: ['maths', 'economics', 'languages'],
      why: 'Working with both people and paperwork, where both must be right.'
    },
    {
      title: 'Professor / Academic Researcher', emoji: '🎓', field: 'Higher Education', family: 'education',
      stream: 'PCM / PCB / Arts', salary: '₹5–14 LPA starting',
      riasec: { R: 30, I: 95, A: 45, S: 80, E: 40, C: 70 },
      domains: ['people'],
      subjects: [],
      why: 'Doing original research and teaching what you find.'
    },
  ];

  return { RIASEC_CAREERS };
});
