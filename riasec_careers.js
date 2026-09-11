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
// Loaded as a plain <script> before script.js (attaches to the global),
// and require()-able from tests/ under Node.
// ══════════════════════════════════════════════════════════════
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RIASEC_CAREERS = [

    // ── SOFTWARE & COMPUTING ────────────────────────────────────────────────
    {
      title: 'Software Engineer', emoji: '💻', field: 'Technology', family: 'computing',
      stream: 'PCM+CS', salary: '₹5–9 LPA starting',
      riasec: { R: 35, I: 90, A: 40, S: 30, E: 35, C: 75 },
      why: 'Breaking a problem into logical steps and building something that works.'
    },
    {
      title: 'Data Scientist', emoji: '📊', field: 'Analytics', family: 'computing',
      stream: 'PCM+CS', salary: '₹6–13 LPA starting',
      riasec: { R: 25, I: 95, A: 35, S: 30, E: 40, C: 85 },
      why: 'Finding patterns hidden in large amounts of information.'
    },
    {
      title: 'AI / ML Engineer', emoji: '🤖', field: 'Technology', family: 'computing',
      stream: 'PCM+CS', salary: '₹8–18 LPA starting',
      riasec: { R: 35, I: 95, A: 45, S: 25, E: 40, C: 75 },
      why: 'Teaching computers to learn from data and make decisions.'
    },
    {
      title: 'Cybersecurity Analyst', emoji: '🔐', field: 'Technology', family: 'computing',
      stream: 'PCM+CS', salary: '₹5–11 LPA starting',
      riasec: { R: 40, I: 90, A: 25, S: 30, E: 35, C: 85 },
      why: 'Asking how a system could be broken into, then closing the gap.'
    },
    {
      title: 'Game Developer', emoji: '🎮', field: 'Tech + Design', family: 'computing',
      stream: 'PCM+CS', salary: '₹5–14 LPA starting',
      riasec: { R: 35, I: 80, A: 85, S: 30, E: 40, C: 55 },
      why: 'Building worlds and rules that other people play inside.'
    },
    {
      title: 'UI / Frontend Developer', emoji: '🖥️', field: 'Tech + Design', family: 'computing',
      stream: 'PCM+CS', salary: '₹5–12 LPA starting',
      riasec: { R: 30, I: 70, A: 80, S: 40, E: 35, C: 60 },
      why: 'Turning a design into a screen people can actually use.'
    },
    {
      title: 'Database / Systems Administrator', emoji: '🗄️', field: 'Technology', family: 'computing',
      stream: 'PCM+CS', salary: '₹4–9 LPA starting',
      riasec: { R: 45, I: 70, A: 15, S: 30, E: 25, C: 95 },
      why: 'Keeping large systems organised, accurate, and always running.'
    },
    {
      title: 'Quality Assurance Engineer', emoji: '🔎', field: 'Engineering + Analytics', family: 'computing',
      stream: 'PCM / PCM+CS', salary: '₹4–9 LPA starting',
      riasec: { R: 45, I: 75, A: 20, S: 35, E: 25, C: 95 },
      why: 'Testing carefully until you find the mistake everyone else missed.'
    },
    {
      title: 'Data Analyst / BI Analyst', emoji: '📈', field: 'Analytics + Business', family: 'computing',
      stream: 'PCM+CS / Commerce', salary: '₹5–12 LPA starting',
      riasec: { R: 20, I: 85, A: 25, S: 40, E: 55, C: 95 },
      why: 'Turning raw numbers into a clear answer a business can act on.'
    },
    {
      title: 'Data Visualisation Designer', emoji: '📉', field: 'Analytics + Design', family: 'computing',
      stream: 'PCM+CS / Arts', salary: '₹5–11 LPA starting',
      riasec: { R: 20, I: 75, A: 90, S: 35, E: 40, C: 70 },
      why: 'Making complicated data instantly understandable through design.'
    },

    // ── ENGINEERING ─────────────────────────────────────────────────────────
    {
      title: 'Mechanical Engineer', emoji: '⚙️', field: 'Engineering', family: 'engineering',
      stream: 'PCM', salary: '₹4–8 LPA starting',
      riasec: { R: 90, I: 80, A: 25, S: 25, E: 30, C: 55 },
      why: 'Designing machines, then testing whether they really work.'
    },
    {
      title: 'Robotics Engineer', emoji: '🤖', field: 'Engineering + CS', family: 'engineering',
      stream: 'PCM+CS', salary: '₹6–15 LPA starting',
      riasec: { R: 90, I: 90, A: 35, S: 25, E: 30, C: 60 },
      why: 'Building machines that sense the world and act on their own.'
    },
    {
      title: 'Mechatronics Engineer', emoji: '🦾', field: 'Engineering', family: 'engineering',
      stream: 'PCM+CS', salary: '₹5–10 LPA starting',
      riasec: { R: 90, I: 85, A: 30, S: 25, E: 30, C: 65 },
      why: 'Combining machines, electronics, and code into one working system.'
    },
    {
      title: 'Civil Engineer', emoji: '🌉', field: 'Engineering', family: 'engineering',
      stream: 'PCM', salary: '₹4–8 LPA starting',
      riasec: { R: 90, I: 70, A: 30, S: 35, E: 40, C: 70 },
      why: 'Building roads, bridges, and buildings that have to stay standing.'
    },
    {
      title: 'Structural Engineer', emoji: '🏗️', field: 'Engineering', family: 'engineering',
      stream: 'PCM', salary: '₹4–10 LPA starting',
      riasec: { R: 85, I: 85, A: 30, S: 25, E: 30, C: 80 },
      why: 'Calculating exactly how much a structure can safely carry.'
    },
    {
      title: 'Electrical Engineer', emoji: '⚡', field: 'Engineering', family: 'engineering',
      stream: 'PCM', salary: '₹4–8 LPA starting',
      riasec: { R: 85, I: 85, A: 20, S: 25, E: 30, C: 65 },
      why: 'Understanding how power and circuits behave, then making them work.'
    },
    {
      title: 'Electronics / Embedded Engineer', emoji: '🔌', field: 'Engineering', family: 'engineering',
      stream: 'PCM+CS', salary: '₹5–12 LPA starting',
      riasec: { R: 85, I: 90, A: 25, S: 20, E: 25, C: 70 },
      why: 'Writing the code that lives inside a physical device.'
    },
    {
      title: 'Process / Chemical Engineer', emoji: '🧪', field: 'Engineering + Science', family: 'engineering',
      stream: 'PCM', salary: '₹4–9 LPA starting',
      riasec: { R: 80, I: 90, A: 20, S: 25, E: 30, C: 75 },
      why: 'Scaling a chemical reaction up from a beaker to a whole plant.'
    },
    {
      title: 'Aerospace Engineer', emoji: '✈️', field: 'Engineering', family: 'engineering',
      stream: 'PCM', salary: '₹5–12 LPA starting',
      riasec: { R: 85, I: 95, A: 30, S: 20, E: 25, C: 70 },
      why: 'Designing things that fly, where every calculation has to be right.'
    },
    {
      title: 'Aircraft Maintenance Engineer', emoji: '🛠️', field: 'Aviation Engineering', family: 'engineering',
      stream: 'PCM', salary: '₹5–12 LPA starting',
      riasec: { R: 95, I: 65, A: 15, S: 30, E: 20, C: 90 },
      why: 'Hands-on work where a careful checklist keeps people alive.'
    },
    {
      title: 'Industrial / Production Engineer', emoji: '🏭', field: 'Engineering + Operations', family: 'engineering',
      stream: 'PCM', salary: '₹4–9 LPA starting',
      riasec: { R: 80, I: 70, A: 20, S: 40, E: 50, C: 90 },
      why: 'Making a factory produce more, with less waste, more reliably.'
    },
    {
      title: 'Instrumentation / Calibration Engineer', emoji: '📐', field: 'Engineering', family: 'engineering',
      stream: 'PCM', salary: '₹4–9 LPA starting',
      riasec: { R: 85, I: 75, A: 15, S: 25, E: 20, C: 95 },
      why: 'Measuring and adjusting instruments until they are exactly right.'
    },
    {
      title: 'Systems Engineer', emoji: '🔗', field: 'Engineering + Design', family: 'engineering',
      stream: 'PCM+CS', salary: '₹5–12 LPA starting',
      riasec: { R: 70, I: 90, A: 35, S: 40, E: 45, C: 85 },
      why: 'Making many separate parts work together as one whole.'
    },
    {
      title: 'Naval Architect', emoji: '⚓', field: 'Engineering', family: 'engineering',
      stream: 'PCM', salary: '₹5–12 LPA starting',
      riasec: { R: 85, I: 85, A: 40, S: 20, E: 30, C: 70 },
      why: 'Designing ships that stay stable in water they have never met.'
    },

    // ── SCIENCE & RESEARCH ──────────────────────────────────────────────────
    {
      title: 'Research Scientist', emoji: '🔬', field: 'Science', family: 'science',
      stream: 'PCM', salary: '₹4–8 LPA starting',
      riasec: { R: 50, I: 100, A: 30, S: 25, E: 20, C: 60 },
      why: 'Asking a question nobody has answered yet, then designing the test.'
    },
    {
      title: 'Applied Physics / Materials Scientist', emoji: '⚛️', field: 'Science + Engineering', family: 'science',
      stream: 'PCM', salary: '₹5–14 LPA starting',
      riasec: { R: 70, I: 100, A: 25, S: 20, E: 25, C: 70 },
      why: 'Discovering why materials behave the way they do, then improving them.'
    },
    {
      title: 'Biomedical Researcher', emoji: '🧬', field: 'Science + Healthcare', family: 'science',
      stream: 'PCB / PCM', salary: '₹5–12 LPA starting',
      riasec: { R: 55, I: 95, A: 25, S: 60, E: 25, C: 70 },
      why: 'Studying how the body works so that treatments can get better.'
    },
    {
      title: 'Environmental Scientist', emoji: '🌿', field: 'Science + Environment', family: 'science',
      stream: 'PCB / PCM', salary: '₹4–9 LPA starting',
      riasec: { R: 70, I: 90, A: 25, S: 60, E: 30, C: 65 },
      why: 'Measuring what is happening to land, air, and water — and why.'
    },
    {
      title: 'Forensic Scientist', emoji: '🔍', field: 'Science + Law', family: 'science',
      stream: 'PCB / PCM', salary: '₹4–10 LPA starting',
      riasec: { R: 65, I: 90, A: 20, S: 35, E: 20, C: 90 },
      why: 'Reading physical evidence carefully enough to stand up in court.'
    },
    {
      title: 'Statistician / Actuarial Scientist', emoji: '🧮', field: 'Maths + Finance', family: 'finance',
      stream: 'PCM+CS / Commerce', salary: '₹6–15 LPA starting',
      riasec: { R: 15, I: 95, A: 15, S: 25, E: 45, C: 100 },
      why: 'Using maths to put a number on risk nobody can see yet.'
    },
    {
      title: 'Science Communicator', emoji: '📺', field: 'Science + Media', family: 'science',
      stream: 'PCM / Arts', salary: '₹5–12 LPA starting',
      riasec: { R: 30, I: 85, A: 75, S: 75, E: 50, C: 40 },
      why: 'Explaining hard science so that anyone can follow it.'
    },
    {
      title: 'Scientific Illustrator', emoji: '🖌️', field: 'Art + Science', family: 'science',
      stream: 'PCM+CS / Arts', salary: '₹4–10 LPA starting',
      riasec: { R: 35, I: 75, A: 95, S: 35, E: 25, C: 60 },
      why: 'Drawing something accurately enough to teach from the picture.'
    },

    // ── HEALTHCARE ──────────────────────────────────────────────────────────
    {
      title: 'Medical Doctor', emoji: '🩺', field: 'Healthcare + Science', family: 'healthcare',
      stream: 'PCB', salary: '₹8–30 LPA starting',
      riasec: { R: 45, I: 90, A: 20, S: 95, E: 40, C: 55 },
      why: 'Diagnosing what is wrong, then treating the person in front of you.'
    },
    {
      title: 'Surgeon', emoji: '🔪', field: 'Healthcare + Hands-On', family: 'healthcare',
      stream: 'PCB', salary: '₹10–35 LPA starting',
      riasec: { R: 85, I: 90, A: 30, S: 80, E: 40, C: 65 },
      why: 'Extremely precise hands-on work where science meets steady nerves.'
    },
    {
      title: 'Dental Surgeon', emoji: '🦷', field: 'Healthcare + Craft', family: 'healthcare',
      stream: 'PCB', salary: '₹5–12 LPA starting',
      riasec: { R: 85, I: 75, A: 45, S: 80, E: 45, C: 65 },
      why: 'Careful hands, small tools, and a patient who needs reassuring.'
    },
    {
      title: 'Physiotherapist', emoji: '🏥', field: 'Healthcare + Hands-On', family: 'healthcare',
      stream: 'PCB', salary: '₹4–9 LPA starting',
      riasec: { R: 80, I: 70, A: 25, S: 95, E: 35, C: 50 },
      why: 'Using physical movement to get someone back to normal life.'
    },
    {
      title: 'Occupational Therapist', emoji: '♿', field: 'Healthcare + People', family: 'healthcare',
      stream: 'PCB / Arts', salary: '₹4–9 LPA starting',
      riasec: { R: 65, I: 65, A: 55, S: 95, E: 35, C: 55 },
      why: 'Redesigning everyday tasks so a person can do them independently.'
    },
    {
      title: 'Nurse Practitioner', emoji: '💉', field: 'Healthcare', family: 'healthcare',
      stream: 'PCB', salary: '₹4–10 LPA starting',
      riasec: { R: 70, I: 70, A: 20, S: 100, E: 35, C: 80 },
      why: 'Practical care, constant people contact, and records that must be right.'
    },
    {
      title: 'Paramedic / Emergency Technician', emoji: '🚑', field: 'Emergency Healthcare', family: 'healthcare',
      stream: 'PCB', salary: '₹3–8 LPA starting',
      riasec: { R: 90, I: 65, A: 15, S: 90, E: 40, C: 60 },
      why: 'Fast, practical decisions when someone needs help right now.'
    },
    {
      title: 'Pharmacist', emoji: '💊', field: 'Healthcare + Science', family: 'healthcare',
      stream: 'PCB', salary: '₹3–8 LPA starting',
      riasec: { R: 45, I: 80, A: 15, S: 65, E: 35, C: 95 },
      why: 'Getting medicine and dosage exactly right, every single time.'
    },
    {
      title: 'Biomedical Engineer', emoji: '🏥', field: 'Engineering + Healthcare', family: 'healthcare',
      stream: 'PCB / PCM', salary: '₹4–10 LPA starting',
      riasec: { R: 85, I: 95, A: 40, S: 70, E: 30, C: 65 },
      why: 'Building the machines and devices that hospitals rely on.'
    },
    {
      title: 'Prosthetics & Orthotics Technician', emoji: '🦿', field: 'Healthcare + Fabrication', family: 'healthcare',
      stream: 'PCB / PCM', salary: '₹4–9 LPA starting',
      riasec: { R: 95, I: 65, A: 60, S: 80, E: 25, C: 60 },
      why: 'Making a limb or brace by hand, fitted to one particular person.'
    },
    {
      title: 'Speech / Behavioural Therapist', emoji: '🗣️', field: 'Therapy + Science', family: 'healthcare',
      stream: 'PCB / Arts', salary: '₹4–10 LPA starting',
      riasec: { R: 30, I: 75, A: 45, S: 100, E: 35, C: 60 },
      why: 'Patient one-to-one work that slowly changes how someone communicates.'
    },
    {
      title: 'Public Health Officer', emoji: '🌍', field: 'Health + Social', family: 'healthcare',
      stream: 'PCB / Arts', salary: '₹5–11 LPA starting',
      riasec: { R: 30, I: 85, A: 25, S: 90, E: 60, C: 80 },
      why: 'Improving the health of a whole community, not one patient at a time.'
    },
    {
      title: 'Veterinarian', emoji: '🐾', field: 'Healthcare + Animals', family: 'healthcare',
      stream: 'PCB', salary: '₹4–10 LPA starting',
      riasec: { R: 85, I: 85, A: 20, S: 75, E: 40, C: 55 },
      why: 'Hands-on medical work with animals that cannot tell you what hurts.'
    },

    // ── DESIGN ──────────────────────────────────────────────────────────────
    {
      title: 'UX / Product Designer', emoji: '🎨', field: 'Design + Technology', family: 'design',
      stream: 'PCM+CS / Arts', salary: '₹5–13 LPA starting',
      riasec: { R: 30, I: 70, A: 95, S: 60, E: 50, C: 50 },
      why: 'Designing something that feels obvious the first time you use it.'
    },
    {
      title: 'Graphic Designer', emoji: '🖼️', field: 'Design', family: 'design',
      stream: 'Arts / PCM+CS', salary: '₹4–10 LPA starting',
      riasec: { R: 30, I: 35, A: 100, S: 30, E: 45, C: 40 },
      why: 'Making a message land through type, colour, and layout.'
    },
    {
      title: 'Animator / 3D Artist', emoji: '🎞️', field: 'Design + Tech', family: 'design',
      stream: 'Arts / PCM+CS', salary: '₹4–12 LPA starting',
      riasec: { R: 35, I: 55, A: 100, S: 25, E: 35, C: 50 },
      why: 'Giving movement and life to something that does not exist.'
    },
    {
      title: 'VFX / Technical Artist', emoji: '💥', field: 'Film + Tech', family: 'design',
      stream: 'PCM+CS / Arts', salary: '₹5–14 LPA starting',
      riasec: { R: 45, I: 75, A: 95, S: 25, E: 30, C: 55 },
      why: 'Solving technical puzzles so an impossible shot looks real.'
    },
    {
      title: 'Industrial / Product Designer', emoji: '🔧', field: 'Design + Engineering', family: 'design',
      stream: 'PCM / Arts', salary: '₹5–13 LPA starting',
      riasec: { R: 80, I: 70, A: 95, S: 35, E: 45, C: 50 },
      why: 'Designing a real object that has to look good and survive use.'
    },
    {
      title: 'Architect', emoji: '🏛️', field: 'Design + Engineering', family: 'design',
      stream: 'PCM', salary: '₹4–10 LPA starting',
      riasec: { R: 75, I: 75, A: 95, S: 45, E: 50, C: 65 },
      why: 'Designing buildings that must stand up, work, and feel right.'
    },
    {
      title: 'Interior / Exhibition Designer', emoji: '🛋️', field: 'Design + Build', family: 'design',
      stream: 'Arts / PCM', salary: '₹4–12 LPA starting',
      riasec: { R: 70, I: 45, A: 95, S: 55, E: 55, C: 50 },
      why: 'Shaping a physical space so people move through it the right way.'
    },
    {
      title: 'Fashion Designer', emoji: '👗', field: 'Design + Fashion', family: 'design',
      stream: 'Arts', salary: '₹3–12 LPA starting',
      riasec: { R: 60, I: 30, A: 100, S: 40, E: 60, C: 45 },
      why: 'Designing and constructing something a person will wear.'
    },
    {
      title: 'Jewellery / Metal Craft Designer', emoji: '💎', field: 'Craft + Design', family: 'design',
      stream: 'Arts', salary: '₹3–12 LPA',
      riasec: { R: 90, I: 35, A: 95, S: 25, E: 45, C: 55 },
      why: 'Precise handwork at a small scale, where every detail shows.'
    },
    {
      title: 'Ceramics / Textile Artist', emoji: '🏺', field: 'Craft + Design', family: 'design',
      stream: 'Arts', salary: '₹3–10 LPA',
      riasec: { R: 90, I: 30, A: 100, S: 30, E: 40, C: 35 },
      why: 'Making things by hand from raw material, start to finish.'
    },

    // ── MEDIA, WRITING & PERFORMANCE ────────────────────────────────────────
    {
      title: 'Film / Video Director', emoji: '🎬', field: 'Media', family: 'media-arts',
      stream: 'Arts', salary: '₹4–12 LPA starting',
      riasec: { R: 45, I: 45, A: 100, S: 65, E: 75, C: 40 },
      why: 'Holding one creative vision while leading a large crew.'
    },
    {
      title: 'Documentary Filmmaker', emoji: '📽️', field: 'Film + Social Impact', family: 'media-arts',
      stream: 'Arts', salary: '₹4–14 LPA starting',
      riasec: { R: 45, I: 70, A: 95, S: 85, E: 55, C: 40 },
      why: 'Finding a real story and telling it so people cannot look away.'
    },
    {
      title: 'Journalist / Reporter', emoji: '📰', field: 'Media', family: 'media-arts',
      stream: 'Arts', salary: '₹3–8 LPA starting',
      riasec: { R: 20, I: 80, A: 75, S: 80, E: 60, C: 50 },
      why: 'Digging until you find out what actually happened, then writing it.'
    },
    {
      title: 'Data Journalist', emoji: '🗞️', field: 'Media + Analytics', family: 'media-arts',
      stream: 'PCM+CS / Arts', salary: '₹4–10 LPA starting',
      riasec: { R: 20, I: 90, A: 70, S: 60, E: 45, C: 85 },
      why: 'Finding the story that only shows up once you analyse the numbers.'
    },
    {
      title: 'Author / Screenwriter', emoji: '✍️', field: 'Writing', family: 'media-arts',
      stream: 'Arts', salary: '₹3–15 LPA (varies)',
      riasec: { R: 15, I: 60, A: 100, S: 50, E: 40, C: 40 },
      why: 'Building a whole world out of nothing but words.'
    },
    {
      title: 'Content Creator / YouTuber', emoji: '📲', field: 'Media + Business', family: 'media-arts',
      stream: 'Arts / Commerce', salary: '₹3–20 LPA (varies)',
      riasec: { R: 35, I: 40, A: 95, S: 70, E: 90, C: 40 },
      why: 'Creating, performing, and building your own audience and business.'
    },
    {
      title: 'Radio / Podcast Host', emoji: '🎙️', field: 'Media + People', family: 'media-arts',
      stream: 'Arts', salary: '₹4–12 LPA starting',
      riasec: { R: 25, I: 50, A: 85, S: 90, E: 70, C: 40 },
      why: 'Holding a conversation that thousands of strangers want to listen to.'
    },
    {
      title: 'Musician / Music Producer', emoji: '🎵', field: 'Arts', family: 'media-arts',
      stream: 'Arts', salary: '₹3–15 LPA',
      riasec: { R: 50, I: 45, A: 100, S: 45, E: 55, C: 40 },
      why: 'Creating sound, and getting the technical craft of it exactly right.'
    },
    {
      title: 'Actor / Theatre Artist', emoji: '🎭', field: 'Performing Arts', family: 'media-arts',
      stream: 'Arts', salary: '₹3–15 LPA (varies)',
      riasec: { R: 35, I: 30, A: 100, S: 80, E: 70, C: 20 },
      why: 'Performing live, reading an audience, and becoming someone else.'
    },
    {
      title: 'Set & Production Designer', emoji: '🪚', field: 'Film / Theatre + Build', family: 'media-arts',
      stream: 'Arts / PCM', salary: '₹4–12 LPA starting',
      riasec: { R: 90, I: 45, A: 95, S: 45, E: 45, C: 55 },
      why: 'Actually building the world the story takes place in.'
    },

    // ── EDUCATION & PSYCHOLOGY ──────────────────────────────────────────────
    {
      title: 'Teacher', emoji: '📚', field: 'Education', family: 'education',
      stream: 'Arts / Any', salary: '₹3–8 LPA starting',
      riasec: { R: 25, I: 55, A: 45, S: 100, E: 55, C: 60 },
      why: 'Explaining something until the person in front of you really gets it.'
    },
    {
      title: 'Special Education Teacher', emoji: '🧩', field: 'Education + Support', family: 'education',
      stream: 'Arts / PCB', salary: '₹3–8 LPA starting',
      riasec: { R: 40, I: 60, A: 55, S: 100, E: 40, C: 65 },
      why: 'Adapting how you teach for each child who learns differently.'
    },
    {
      title: 'Academic Researcher + Lecturer', emoji: '🎓', field: 'Academia', family: 'education',
      stream: 'PCM / PCB / Arts', salary: '₹5–14 LPA starting',
      riasec: { R: 30, I: 95, A: 45, S: 80, E: 40, C: 70 },
      why: 'Doing original research and teaching what you find.'
    },
    {
      title: 'School Principal / Education Leader', emoji: '🏫', field: 'Education + Management', family: 'education',
      stream: 'Arts / Any', salary: '₹6–15 LPA starting',
      riasec: { R: 25, I: 55, A: 40, S: 95, E: 85, C: 85 },
      why: 'Leading a whole school: people, plans, and standards together.'
    },
    {
      title: 'Educational Technology Designer', emoji: '💡', field: 'Education + Tech', family: 'education',
      stream: 'PCM+CS / Arts', salary: '₹5–12 LPA starting',
      riasec: { R: 35, I: 75, A: 85, S: 80, E: 55, C: 60 },
      why: 'Designing tools that make a difficult subject click.'
    },
    {
      title: 'Clinical Psychologist', emoji: '🧠', field: 'Psychology', family: 'psychology',
      stream: 'PCB / Arts', salary: '₹4–12 LPA starting',
      riasec: { R: 20, I: 90, A: 45, S: 100, E: 35, C: 65 },
      why: 'Understanding why a person feels as they do, then helping them change it.'
    },
    {
      title: 'Counsellor / Career Counsellor', emoji: '🫂', field: 'Counselling', family: 'psychology',
      stream: 'Arts / PCB', salary: '₹4–10 LPA starting',
      riasec: { R: 15, I: 65, A: 45, S: 100, E: 55, C: 60 },
      why: 'Listening carefully and helping someone find their own next step.'
    },
    {
      title: 'UX Researcher', emoji: '🔬', field: 'Tech + Psychology', family: 'psychology',
      stream: 'PCM+CS / Arts', salary: '₹5–12 LPA starting',
      riasec: { R: 25, I: 90, A: 60, S: 85, E: 45, C: 75 },
      why: 'Watching real people use something to find out what confuses them.'
    },
    {
      title: 'Art / Music Therapist', emoji: '🎨', field: 'Arts + Psychology', family: 'psychology',
      stream: 'Arts / PCB', salary: '₹4–9 LPA starting',
      riasec: { R: 35, I: 60, A: 90, S: 100, E: 30, C: 45 },
      why: 'Using creative work as the way someone starts to heal.'
    },

    // ── SOCIAL IMPACT, LAW & POLICY ─────────────────────────────────────────
    {
      title: 'Social Worker', emoji: '🌿', field: 'Social Work', family: 'social-policy',
      stream: 'Arts', salary: '₹3–7 LPA starting',
      riasec: { R: 40, I: 55, A: 30, S: 100, E: 55, C: 65 },
      why: 'Being on the ground with families who need practical help.'
    },
    {
      title: 'NGO Programme Manager', emoji: '🤝', field: 'Social Impact', family: 'social-policy',
      stream: 'Arts / Commerce', salary: '₹5–12 LPA starting',
      riasec: { R: 30, I: 60, A: 40, S: 95, E: 80, C: 85 },
      why: 'Running a programme that has to help people and balance a budget.'
    },
    {
      title: 'Social Entrepreneur', emoji: '🌱', field: 'Social Impact + Business', family: 'social-policy',
      stream: 'Commerce / Arts', salary: 'Varies widely',
      riasec: { R: 40, I: 60, A: 60, S: 95, E: 100, C: 65 },
      why: 'Building a business whose whole point is to fix something.'
    },
    {
      title: 'Lawyer / Advocate', emoji: '⚖️', field: 'Law', family: 'social-policy',
      stream: 'Arts', salary: '₹4–15 LPA starting',
      riasec: { R: 15, I: 85, A: 45, S: 80, E: 85, C: 85 },
      why: 'Arguing a case, where the detail of the wording decides it.'
    },
    {
      title: 'Company / Corporate Lawyer', emoji: '📜', field: 'Law + Business', family: 'social-policy',
      stream: 'Arts / Commerce', salary: '₹8–25 LPA starting',
      riasec: { R: 10, I: 80, A: 30, S: 55, E: 85, C: 100 },
      why: 'Getting contracts and rules exactly right, because money depends on it.'
    },
    {
      title: 'Civil Services / Public Administration', emoji: '🏛️', field: 'Government', family: 'social-policy',
      stream: 'Arts / Any', salary: '₹7–18 LPA (govt scale)',
      riasec: { R: 35, I: 75, A: 30, S: 90, E: 90, C: 95 },
      why: 'Running public systems where both people and procedure matter.'
    },
    {
      title: 'Policy / Economic Analyst', emoji: '📋', field: 'Economics + Research', family: 'social-policy',
      stream: 'Commerce / Arts', salary: '₹5–12 LPA starting',
      riasec: { R: 15, I: 95, A: 30, S: 65, E: 60, C: 90 },
      why: 'Researching what a rule would actually do before it is made.'
    },
    {
      title: 'Urban Planner', emoji: '🏙️', field: 'Planning + Design', family: 'social-policy',
      stream: 'PCM / Arts', salary: '₹5–12 LPA starting',
      riasec: { R: 60, I: 80, A: 70, S: 75, E: 55, C: 90 },
      why: 'Planning how a whole city should grow, street by street.'
    },

    // ── FINANCE, BUSINESS & OPERATIONS ──────────────────────────────────────
    {
      title: 'Chartered Accountant (CA)', emoji: '📑', field: 'Finance', family: 'finance',
      stream: 'Commerce', salary: '₹6–14 LPA starting',
      riasec: { R: 20, I: 60, A: 15, S: 35, E: 60, C: 100 },
      why: 'Accuracy with numbers, where being nearly right is not enough.'
    },
    {
      title: 'Financial Controller', emoji: '🧾', field: 'Finance', family: 'finance',
      stream: 'Commerce', salary: '₹8–18 LPA starting',
      riasec: { R: 15, I: 65, A: 15, S: 45, E: 70, C: 100 },
      why: 'Owning every number a company reports, and the systems behind them.'
    },
    {
      title: 'Investment Banker', emoji: '💰', field: 'Finance', family: 'finance',
      stream: 'Commerce', salary: '₹8–20 LPA starting',
      riasec: { R: 10, I: 70, A: 25, S: 50, E: 100, C: 90 },
      why: 'High-pressure deals where you have to persuade and get the maths right.'
    },
    {
      title: 'Investment / Equity Analyst', emoji: '📈', field: 'Finance + Analytics', family: 'finance',
      stream: 'Commerce', salary: '₹6–14 LPA starting',
      riasec: { R: 10, I: 90, A: 20, S: 35, E: 75, C: 95 },
      why: 'Researching a company deeply enough to bet money on your view.'
    },
    {
      title: 'Quantitative Analyst (Quant)', emoji: '📐', field: 'Finance + Tech', family: 'finance',
      stream: 'PCM+CS', salary: '₹10–25 LPA starting',
      riasec: { R: 15, I: 100, A: 25, S: 20, E: 60, C: 95 },
      why: 'Writing mathematical models that make financial decisions.'
    },
    {
      title: 'Management Consultant', emoji: '🗂️', field: 'Consulting', family: 'business',
      stream: 'Commerce / PCM+CS', salary: '₹8–18 LPA starting',
      riasec: { R: 20, I: 85, A: 45, S: 70, E: 95, C: 80 },
      why: 'Diagnosing a company problem, then convincing people of the fix.'
    },
    {
      title: 'Business Analyst', emoji: '📊', field: 'Business', family: 'business',
      stream: 'Commerce / PCM+CS', salary: '₹5–10 LPA starting',
      riasec: { R: 20, I: 80, A: 30, S: 60, E: 70, C: 95 },
      why: 'Sitting between the business and the technical team, translating both ways.'
    },
    {
      title: 'Product Manager (Tech)', emoji: '📱', field: 'Technology + Business', family: 'business',
      stream: 'PCM+CS', salary: '₹8–18 LPA starting',
      riasec: { R: 30, I: 85, A: 65, S: 75, E: 95, C: 75 },
      why: 'Deciding what gets built, and getting everyone to agree on why.'
    },
    {
      title: 'Marketing Manager', emoji: '📣', field: 'Marketing + Business', family: 'business',
      stream: 'Commerce', salary: '₹5–14 LPA starting',
      riasec: { R: 15, I: 55, A: 75, S: 75, E: 100, C: 65 },
      why: 'Understanding what makes people choose, then building the campaign.'
    },
    {
      title: 'Brand Manager', emoji: '🏷️', field: 'Business + Design', family: 'business',
      stream: 'Commerce', salary: '₹5–14 LPA starting',
      riasec: { R: 15, I: 60, A: 85, S: 70, E: 95, C: 65 },
      why: 'Owning what a brand means, and defending it commercially.'
    },
    {
      title: 'Entrepreneur / Founder', emoji: '🚀', field: 'Entrepreneurship', family: 'business',
      stream: 'Any', salary: 'Varies widely',
      riasec: { R: 45, I: 60, A: 65, S: 70, E: 100, C: 55 },
      why: 'Starting something from zero and taking responsibility for all of it.'
    },
    {
      title: 'Technical Sales Engineer', emoji: '🤝', field: 'Sales + Engineering', family: 'business',
      stream: 'PCM / Commerce', salary: '₹6–15 LPA starting',
      riasec: { R: 70, I: 70, A: 25, S: 80, E: 95, C: 60 },
      why: 'Knowing a machine well enough to convince an expert to buy it.'
    },
    {
      title: 'Supply Chain / Operations Manager', emoji: '🚚', field: 'Operations + Business', family: 'operations',
      stream: 'Commerce / PCM', salary: '₹5–12 LPA starting',
      riasec: { R: 60, I: 65, A: 20, S: 55, E: 80, C: 100 },
      why: 'Keeping goods, costs, and timelines all under control at once.'
    },
    {
      title: 'HR / People Operations Manager', emoji: '👥', field: 'Business + People', family: 'business',
      stream: 'Commerce / Arts', salary: '₹6–16 LPA starting',
      riasec: { R: 15, I: 55, A: 35, S: 95, E: 85, C: 85 },
      why: 'Looking after people while running fair, careful processes.'
    },
    {
      title: 'Event Manager', emoji: '🎪', field: 'Business + Events', family: 'operations',
      stream: 'Commerce / Arts', salary: '₹3–9 LPA starting',
      riasec: { R: 55, I: 35, A: 75, S: 85, E: 95, C: 85 },
      why: 'A hundred details, a live audience, and no second chance.'
    },
    {
      title: 'Hotel / Hospitality Manager', emoji: '🏨', field: 'Hospitality', family: 'operations',
      stream: 'Commerce', salary: '₹4–10 LPA starting',
      riasec: { R: 50, I: 40, A: 50, S: 95, E: 85, C: 85 },
      why: 'Running a place where the guest experience is the product.'
    },
    {
      title: 'Chef / Culinary Professional', emoji: '👨‍🍳', field: 'Culinary + Craft', family: 'operations',
      stream: 'Any', salary: '₹3–12 LPA starting',
      riasec: { R: 95, I: 45, A: 85, S: 60, E: 60, C: 70 },
      why: 'Fast, skilled handwork where taste and consistency both matter.'
    },

    // ── PRACTICAL, TECHNICAL & OUTDOOR ──────────────────────────────────────
    {
      title: 'Pilot', emoji: '🛫', field: 'Aviation', family: 'outdoor-services',
      stream: 'PCM', salary: '₹8–25 LPA starting',
      riasec: { R: 95, I: 70, A: 20, S: 45, E: 45, C: 90 },
      why: 'Hands-on control of a machine, run entirely by checklist and rule.'
    },
    {
      title: 'Armed Forces Officer', emoji: '🎖️', field: 'Defence', family: 'outdoor-services',
      stream: 'Any', salary: '₹7–15 LPA (service scale)',
      riasec: { R: 95, I: 60, A: 20, S: 75, E: 90, C: 85 },
      why: 'Physical, practical leadership under real discipline and pressure.'
    },
    {
      title: 'Merchant Navy Officer', emoji: '🚢', field: 'Marine', family: 'outdoor-services',
      stream: 'PCM', salary: '₹8–25 LPA starting',
      riasec: { R: 100, I: 65, A: 15, S: 45, E: 55, C: 85 },
      why: 'Running machinery at sea, far from anyone who could help.'
    },
    {
      title: 'Automobile / Diesel Technician', emoji: '🔩', field: 'Skilled Technical', family: 'trades',
      stream: 'PCM / ITI', salary: '₹3–8 LPA starting',
      riasec: { R: 100, I: 65, A: 20, S: 35, E: 35, C: 60 },
      why: 'Diagnosing a fault by hand and actually fixing the machine.'
    },
    {
      title: 'Electrician / Electrical Technician', emoji: '💡', field: 'Skilled Technical', family: 'trades',
      stream: 'PCM / ITI', salary: '₹3–8 LPA starting',
      riasec: { R: 100, I: 55, A: 15, S: 40, E: 40, C: 70 },
      why: 'Practical work where following the standard exactly keeps you safe.'
    },
    {
      title: 'CNC / Precision Machinist', emoji: '⚙️', field: 'Manufacturing', family: 'trades',
      stream: 'PCM / ITI', salary: '₹3–9 LPA starting',
      riasec: { R: 100, I: 60, A: 25, S: 20, E: 25, C: 90 },
      why: 'Making a part to a tolerance thinner than a hair.'
    },
    {
      title: 'Carpenter / Furniture Maker', emoji: '🪑', field: 'Craft + Build', family: 'trades',
      stream: 'Any / ITI', salary: '₹3–10 LPA',
      riasec: { R: 100, I: 35, A: 75, S: 30, E: 50, C: 50 },
      why: 'Designing and building something solid out of raw material.'
    },
    {
      title: 'Construction Project Manager', emoji: '🏗️', field: 'Engineering + Management', family: 'engineering',
      stream: 'PCM / Commerce', salary: '₹5–14 LPA starting',
      riasec: { R: 85, I: 60, A: 30, S: 60, E: 85, C: 90 },
      why: 'On site, running people, materials, money, and a deadline.'
    },
    {
      title: 'Agricultural Scientist / Agronomist', emoji: '🌾', field: 'Agriculture + Science', family: 'outdoor-services',
      stream: 'PCB / PCM', salary: '₹4–9 LPA starting',
      riasec: { R: 90, I: 85, A: 20, S: 60, E: 45, C: 70 },
      why: 'Outdoor, practical science that decides whether a crop succeeds.'
    },
    {
      title: 'Wildlife Biologist / Conservationist', emoji: '🦜', field: 'Science + Environment', family: 'science',
      stream: 'PCB', salary: '₹3–8 LPA starting',
      riasec: { R: 90, I: 90, A: 30, S: 60, E: 40, C: 60 },
      why: 'Fieldwork in difficult places to understand and protect species.'
    },
    {
      title: 'Sports Coach / Physical Trainer', emoji: '⚽', field: 'Sports', family: 'outdoor-services',
      stream: 'Any', salary: '₹3–10 LPA',
      riasec: { R: 95, I: 50, A: 35, S: 90, E: 70, C: 50 },
      why: 'Physical work, and getting the best out of the person in front of you.'
    },
    {
      title: 'Sports Scientist / Physiologist', emoji: '🏃', field: 'Sports + Science', family: 'outdoor-services',
      stream: 'PCB', salary: '₹4–10 LPA starting',
      riasec: { R: 75, I: 90, A: 25, S: 75, E: 40, C: 80 },
      why: 'Measuring the body precisely to make an athlete perform better.'
    },
    {
      title: 'Logistics / Fleet Coordinator', emoji: '📦', field: 'Operations', family: 'operations',
      stream: 'Commerce / Any', salary: '₹3–8 LPA starting',
      riasec: { R: 70, I: 45, A: 15, S: 50, E: 60, C: 100 },
      why: 'Tracking everything, so nothing gets lost or arrives late.'
    },
    {
      title: 'Librarian / Information Manager', emoji: '📖', field: 'Information Science', family: 'operations',
      stream: 'Arts / Any', salary: '₹3–8 LPA starting',
      riasec: { R: 25, I: 75, A: 35, S: 70, E: 30, C: 100 },
      why: 'Organising knowledge so other people can actually find it.'
    },
    {
      title: 'Insurance Underwriter', emoji: '🛡️', field: 'Finance + Risk', family: 'finance',
      stream: 'Commerce', salary: '₹4–10 LPA starting',
      riasec: { R: 15, I: 80, A: 10, S: 40, E: 65, C: 100 },
      why: 'Reading detail and data carefully to decide what a risk is worth.'
    },
    {
      title: 'Bank Officer / Relationship Manager', emoji: '🏦', field: 'Banking', family: 'finance',
      stream: 'Commerce', salary: '₹4–10 LPA starting',
      riasec: { R: 15, I: 50, A: 15, S: 80, E: 85, C: 95 },
      why: 'Working with both people and paperwork, where both must be right.'
    },
  ];

  return { RIASEC_CAREERS };
});
