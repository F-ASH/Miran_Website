/* =========================================================
   Miran — fixed content and rules
   Mirrors Table 1 (nine measures), Table 3 (five EI components)
   and the thresholds agreed in the 11 Nov supervisor meeting.
   ========================================================= */
window.MIRAN = window.MIRAN || {};

/* ---------- The five EI components (Goleman, 2004) ---------- */
MIRAN.COMPONENTS = [
  { id: "self_awareness",  name: "Self-awareness",  short: "SA", color: "#3B84FE",
    meaning: "Knowing your strengths and weaknesses and how you come across.",
    evidence: "Gap between your self-rating and Miran's result; reflection answers." },
  { id: "self_regulation", name: "Self-regulation", short: "SR", color: "#FA4B47",
    meaning: "Staying composed under pressure, for example with an upset customer.",
    evidence: "Speaking pace, filler words and long pauses; answers about pressure." },
  { id: "motivation",      name: "Motivation",      short: "MO", color: "#1B3E9E",
    meaning: "Drive to reach goals and persistence after a setback.",
    evidence: "Answers to 'why this role' and target or setback questions." },
  { id: "empathy",         name: "Empathy",         short: "EM", color: "#12A07A",
    meaning: "Understanding what the other person needs and feels.",
    evidence: "Whether answers acknowledge the other person's side." },
  { id: "social_skill",    name: "Social skill",    short: "SS", color: "#E39A1B",
    meaning: "Building rapport and explaining clearly.",
    evidence: "Eye contact, smiling and clear answer structure (STAR)." }
];
MIRAN.compById = id => MIRAN.COMPONENTS.find(c => c.id === id);

/* Score scale shown on every dashboard element and graph (#116) */
MIRAN.SCALE = { min: 0, max: 10, label: "Score (0–10)" };
/* Level bands derived from the 0–10 score */
MIRAN.levelOf = s => s == null ? null : s >= 8.5 ? 5 : s >= 7 ? 4 : s >= 5.5 ? 3 : s >= 4 ? 2 : 1;
MIRAN.statusOf = s => s >= 7.5 ? { t: "Strong", cls: "tag-green" } : s >= 5 ? { t: "Developing", cls: "tag" } : { t: "Needs work", cls: "tag-red" };

/* ---------- The nine measures (Table 1) with thresholds (#120, #121) ---------- */
MIRAN.MEASURES = {
  relevance: { n: 1, name: "Relevance to the question and role", comp: "all", unit: "/ 5",
    target: "4 or 5", how: "Rubric score 1 to 5 with a one-line reason", tool: "Generative AI API" },
  ei_shown:  { n: 2, name: "EI shown in the answer", comp: "empathy, motivation, self_awareness", unit: "",
    target: "Shown", how: "Shown, partly shown or not shown, with the supporting quote", tool: "Generative AI API" },
  star:      { n: 3, name: "Answer structure (STAR)", comp: "social_skill", unit: "of 4 parts",
    target: "4 of 4", how: "Which of situation, task, action and result are present", tool: "Generative AI API" },
  pace:      { n: 4, name: "Speaking pace", comp: "self_regulation", unit: "words / min",
    target: "120 to 160", how: "Words per minute", tool: "Speech-to-text with word timestamps" },
  fillers:   { n: 5, name: "Filler words", comp: "self_regulation", unit: "per minute",
    target: "under 3", how: "Count per minute of um, uh, like, you know", tool: "Speech-to-text transcript" },
  pauses:    { n: 6, name: "Long pauses (over 2 s)", comp: "self_regulation", unit: "per answer",
    target: "0 to 2", how: "Gaps over 2 seconds between words", tool: "Speech-to-text with word timestamps" },
  eye:       { n: 7, name: "Eye contact", comp: "social_skill", unit: "% of frames",
    target: "60% or more", how: "Share of frames with gaze and head towards the camera", tool: "MediaPipe Face Landmarker" },
  smile:     { n: 8, name: "Smiling", comp: "social_skill", unit: "% of frames",
    target: "15% or more", how: "Share of frames with smile score above threshold", tool: "MediaPipe Face Landmarker" },
  gap:       { n: 9, name: "Self-rating gap", comp: "self_awareness", unit: "points",
    target: "1 or less", how: "Difference between self-rating and system result per criterion", tool: "Miran rule" }
};
/* Rule #121: camera measures are not reported when quality is too low */
MIRAN.LOW_LIGHT_LUMA = 55; // average frame brightness (0–255) below which eye contact / smiling are "not measured"

/* Which measures feed which component's score */
MIRAN.COMP_MEASURES = {
  self_regulation: ["pace", "fillers", "pauses"],
  social_skill: ["star", "eye", "smile"],
  empathy: ["ei_shown", "relevance"],
  motivation: ["ei_shown", "relevance"],
  self_awareness: ["gap", "ei_shown"]
};

/* ---------- Self-rating criteria (rule #119) ----------
   Rated once at the end of the interview, per question and per criterion,
   on a 1–5 scale, without replaying the recording. Stored and compared
   with the system result for each question in the report. */
MIRAN.CRITERIA = {
  relevance:       { label: "Answered the question for this role", comp: "all" },
  self_awareness:  { label: "Reflected honestly on my strengths and weaknesses", comp: "self_awareness" },
  self_regulation: { label: "Calm pace, few fillers and pauses", comp: "self_regulation" },
  motivation:      { label: "Showed my drive and reasons", comp: "motivation" },
  empathy:         { label: "Showed I understood the other person's side", comp: "empathy" },
  social_skill:    { label: "Clear structure (situation, task, action, result) and eye contact", comp: "social_skill" }
};

/* ---------- Fields and roles (scope: multiple professional fields) ---------- */
MIRAN.FIELDS = [
  { id: "customer_service", name: "Customer service", person: "customer",
    roles: ["Customer service representative", "Call centre agent", "Client support associate"],
    keywords: ["customer", "complaint", "call", "chat", "support", "service"] },
  { id: "sales", name: "Sales", person: "customer",
    roles: ["Sales representative", "Retail sales associate", "Account executive"],
    keywords: ["sales", "target", "quota", "revenue", "deal", "sell", "pipeline"] },
  { id: "it", name: "Information technology", person: "user",
    roles: ["IT support specialist", "Junior software developer", "Data analyst"],
    keywords: ["software", "it ", "technical", "developer", "data", "network", "system", "code"] },
  { id: "healthcare", name: "Healthcare (communication)", person: "patient",
    roles: ["Patient services coordinator", "Medical receptionist"],
    keywords: ["patient", "clinic", "hospital", "health", "medical"] },
  { id: "business", name: "Business", person: "client",
    roles: ["Business analyst", "Marketing coordinator", "HR assistant"],
    keywords: ["business", "stakeholder", "marketing", "analyst", "report", "hr"] },
  { id: "engineering", name: "Engineering", person: "client",
    roles: ["Junior project engineer", "Site engineer"],
    keywords: ["engineer", "site", "project", "design", "construction"] }
];

/* ---------- Question bank ----------
   type: general | behavioural | situational | reflection
   {person} is replaced by the field's person (customer, patient, user, client). */
MIRAN.QUESTIONS = [
  // Self-awareness
  { id: "q01", comp: "self_awareness", type: "reflection", diff: "basic",
    text: "What is one strength and one weakness you would bring to this role?",
    guide: ["Name a real weakness", "Say what you are doing about it", "Link the strength to the role"] },
  { id: "q02", comp: "self_awareness", type: "behavioural", diff: "basic",
    text: "Tell us about feedback you received that surprised you. What did you do with it?",
    guide: ["Describe the feedback honestly", "Explain why it surprised you", "Show what changed"] },
  { id: "q03", comp: "self_awareness", type: "reflection", diff: "basic",
    text: "How would a previous teammate describe the way you work?",
    guide: ["Be specific", "Include something you are still improving"] },
  { id: "q04", comp: "self_awareness", type: "behavioural", diff: "advanced",
    text: "Describe a time you misjudged how well you were doing. How did you realise it?",
    guide: ["Show the moment of realisation", "Explain what you now check"] },
  { id: "q05", comp: "self_awareness", type: "situational", diff: "advanced",
    text: "Your manager says a {person} found you abrupt, but you thought the call went well. What would you do?",
    guide: ["Don't be defensive", "Ask for specifics", "Plan a change"] },
  { id: "q06", comp: "self_awareness", type: "reflection", diff: "advanced",
    text: "Which part of this job do you expect to find hardest, and why?",
    guide: ["Be realistic", "Show a plan"] },
  // Self-regulation
  { id: "q07", comp: "self_regulation", type: "situational", diff: "basic",
    text: "A {person} contacts you for the third time about the same problem and starts shouting. How would you handle it?",
    guide: ["Describe the situation, what you did and the result", "Take a breath before you start", "A short pause is fine"] },
  { id: "q08", comp: "self_regulation", type: "behavioural", diff: "basic",
    text: "Tell us about a time you had too many tasks at once. How did you stay calm?",
    guide: ["Name the tasks", "Explain how you prioritised"] },
  { id: "q09", comp: "self_regulation", type: "behavioural", diff: "basic",
    text: "Describe a time something went wrong at the last minute. What did you do first?",
    guide: ["Stay with one example", "Show the first calm step"] },
  { id: "q10", comp: "self_regulation", type: "situational", diff: "advanced",
    text: "During a meeting, a senior colleague criticises your work in front of everyone. How do you respond?",
    guide: ["Show composure", "Separate the feedback from the tone"] },
  { id: "q11", comp: "self_regulation", type: "behavioural", diff: "advanced",
    text: "Tell us about a time you were rejected or turned down. How did you handle the next hour?",
    guide: ["Be honest about the feeling", "Show how you recovered"] },
  { id: "q12", comp: "self_regulation", type: "situational", diff: "advanced",
    text: "A {person} asks a question you cannot answer, and they are already frustrated. What do you say?",
    guide: ["Admit what you don't know", "Offer a clear next step"] },
  // Motivation
  { id: "q13", comp: "motivation", type: "general", diff: "basic",
    text: "Why do you want to work in this role?",
    guide: ["Give a real reason", "Connect it to the role's daily work"] },
  { id: "q14", comp: "motivation", type: "behavioural", diff: "basic",
    text: "Tell us about a goal you set yourself and reached. What kept you going?",
    guide: ["Name the goal", "Explain the obstacles"] },
  { id: "q15", comp: "motivation", type: "behavioural", diff: "basic",
    text: "Describe something you learned on your own because you wanted to.",
    guide: ["Show curiosity", "Say how you used it"] },
  { id: "q16", comp: "motivation", type: "behavioural", diff: "advanced",
    text: "Tell us about a time you missed a target. What did you do the following week?",
    guide: ["Own the miss", "Show persistence with specifics"] },
  { id: "q17", comp: "motivation", type: "situational", diff: "advanced",
    text: "It's the end of a slow month and the team is behind. What would you do to keep going?",
    guide: ["Show drive", "Name concrete actions"] },
  { id: "q18", comp: "motivation", type: "general", diff: "advanced",
    text: "Where do you want to be in three years, and how does this role help you get there?",
    guide: ["Be specific", "Link to this role"] },
  // Empathy
  { id: "q19", comp: "empathy", type: "behavioural", diff: "basic",
    text: "Tell us about a time you helped someone who was upset. How did you know what they needed?",
    guide: ["Describe what you noticed", "Show you listened first"] },
  { id: "q20", comp: "empathy", type: "situational", diff: "basic",
    text: "A {person} is confused and embarrassed to ask for help again. What would you do?",
    guide: ["Acknowledge the feeling", "Make it easy to ask"] },
  { id: "q21", comp: "empathy", type: "behavioural", diff: "basic",
    text: "Describe a time you changed how you explained something so another person could understand.",
    guide: ["Explain what you noticed", "Say what you changed"] },
  { id: "q22", comp: "empathy", type: "situational", diff: "advanced",
    text: "A {person} wants something that policy does not allow. How would you say no while keeping their trust?",
    guide: ["Acknowledge their side first", "Offer an alternative"] },
  { id: "q23", comp: "empathy", type: "behavioural", diff: "advanced",
    text: "Tell us about a disagreement with a teammate. How did you understand their point of view?",
    guide: ["Describe their view fairly", "Show what you learned"] },
  { id: "q24", comp: "empathy", type: "situational", diff: "advanced",
    text: "A long-time {person} says they feel ignored since a policy change. What do you do?",
    guide: ["Name their feeling", "Show follow-up"] },
  // Social skill
  { id: "q25", comp: "social_skill", type: "general", diff: "basic",
    text: "Tell us about yourself and what brings you to this role.",
    guide: ["Keep it under two minutes", "Look at the camera", "Use a clear order"] },
  { id: "q26", comp: "social_skill", type: "behavioural", diff: "basic",
    text: "Describe a time you worked in a team to finish something difficult.",
    guide: ["Use situation, task, action, result", "Name your part"] },
  { id: "q27", comp: "social_skill", type: "behavioural", diff: "basic",
    text: "Tell us about a time you built a good relationship with someone new quickly.",
    guide: ["Show what you did", "Say the result"] },
  { id: "q28", comp: "social_skill", type: "situational", diff: "advanced",
    text: "You have two minutes to explain a new process to a {person} who is in a hurry. Walk us through it.",
    guide: ["Lead with the main point", "Check understanding"] },
  { id: "q29", comp: "social_skill", type: "behavioural", diff: "advanced",
    text: "Tell us about a time you persuaded someone to change their mind.",
    guide: ["Use situation, task, action, result", "Show how you read the person"] },
  { id: "q30", comp: "social_skill", type: "behavioural", diff: "advanced",
    text: "Describe a time a conversation went badly. How did you repair the relationship?",
    guide: ["Be specific", "Show the result"] }
];

/* Sample answer used when the browser cannot transcribe speech (prototype only) */
MIRAN.SAMPLE_ANSWERS = {
  self_awareness: "In my last internship I realised I was saying yes to every request. My strength is that I stay organised, I keep a simple list and I follow up. My weakness was that I avoided asking for help, so the work piled up. Now I check in with my supervisor every morning and I ask early when I'm stuck. My last review said my deadlines improved.",
  self_regulation: "So the situation was a customer who had called three times about a delayed refund and started shouting. My task was to calm the call and solve it. I let him finish, I said I understand this is the third time and that is frustrating, then I checked the refund status while he was on the line. I gave him a reference number and a time I would call back. I called back the next day and the refund was done, and he thanked me.",
  motivation: "I want this role because I enjoy helping people solve real problems and I like having clear targets. During university I set myself a goal to finish a data course in one month while studying full time. Some weeks I was behind, so I studied early in the morning. I finished it in five weeks and used it in my graduation project.",
  empathy: "A classmate was upset because her part of our project was rejected. Before giving advice I asked what she thought went wrong and I listened. I realised she was worried about her grade more than the work. I said I would feel the same way, and then we split the fixes together. We submitted on time and she told me later it helped that I listened first.",
  social_skill: "In our team project we had to finish a dashboard in one week. My task was to coordinate four people. I set up a short daily call and a shared checklist, and I explained each person's part clearly. When two people disagreed I asked each to show their idea in five minutes. We delivered on time and the supervisor said it was the clearest presentation."
};

/* ---------- Lessons: tips → quiz → status (#122) ---------- */
MIRAN.LESSONS = [
  { id: "L1", comp: "self_regulation", title: "Pace and pauses", minutes: 4, measures: ["pace", "pauses"],
    body: "Interviewers read a steady pace as composure. Most listeners follow comfortably at 120 to 160 words per minute. When you are nervous, your pace rises and fillers like \"um\" fill the gaps. A planned pause of one second sounds confident; a filler sounds unsure.",
    tips: ["Pause for one breath after the question before you start.", "Open with the situation in one short sentence.", "Pause again before the result. It makes the result land."],
    quiz: [
      { q: "Which is the better choice when you need a moment to think?", o: ["Pause silently for a second", "Say \"um\" until the idea comes", "Start talking about something else"], a: 0, why: "A short silent pause reads as composure; fillers read as uncertainty." },
      { q: "What speaking pace does Miran treat as the target range?", o: ["80 to 100 words per minute", "120 to 160 words per minute", "180 to 220 words per minute"], a: 1, why: "120–160 wpm is comfortable for most listeners." },
      { q: "How many long pauses (over 2 seconds) per answer are within the target?", o: ["0 to 2", "5 to 8", "There is no limit"], a: 0, why: "One or two planned pauses are natural; more suggests losing the thread." }
    ] },
  { id: "L2", comp: "self_regulation", title: "Cutting filler words", minutes: 3, measures: ["fillers"],
    body: "Filler words (um, uh, like, you know) are normal in conversation, but more than three a minute starts to distract from what you say. You don't need zero; you need fewer than the listener notices.",
    tips: ["Record one answer and count your fillers. Awareness alone cuts them.", "Replace a filler with a closed-mouth pause.", "Know your first sentence before you start."],
    quiz: [
      { q: "What is Miran's target for filler words?", o: ["Zero", "Under 3 per minute", "Under 10 per minute"], a: 1, why: "Under three a minute is not noticeable to most listeners." },
      { q: "Which habit cuts fillers the fastest?", o: ["Speaking faster", "Knowing your first sentence before you start", "Memorising the whole answer word by word"], a: 1, why: "Most fillers come at the start, while you look for the first words." },
      { q: "Which of these is a filler word?", o: ["\"Therefore\"", "\"You know\"", "\"For example\""], a: 1, why: "\"You know\" adds no meaning; the others link ideas." }
    ] },
  { id: "L3", comp: "self_regulation", title: "Staying calm with a difficult question", minutes: 5, measures: ["pace", "fillers"],
    body: "Pressure questions test how you behave when you don't have a perfect answer. A calm structure matters more than a clever answer.",
    tips: ["Repeat the key part of the question to buy a second.", "Say what you would do first, not everything at once.", "It's fine to say what you don't know and how you'd find out."],
    quiz: [
      { q: "A question catches you off guard. What is the best first move?", o: ["Answer immediately with anything", "Restate the key part of the question, then answer", "Ask to skip it"], a: 1, why: "Restating gives you a second and shows you listened." },
      { q: "If you don't know the answer, you should…", o: ["Make something up confidently", "Say what you'd do to find out", "Stay silent"], a: 1, why: "Honesty plus a next step shows composure." },
      { q: "Which sign suggests you are losing composure?", o: ["Pace rising above 160 wpm", "One planned pause", "Smiling at the start"], a: 0, why: "A rising pace is one of the clearest signs of stress." }
    ] },
  { id: "L4", comp: "social_skill", title: "Structuring answers with STAR", minutes: 4, measures: ["star"],
    body: "STAR stands for Situation, Task, Action, Result. It keeps a story short and makes sure the listener hears what you did and what happened.",
    tips: ["Situation and task: two sentences at most.", "Spend most of the time on your action.", "Always end with a result, ideally a number or a reaction."],
    quiz: [
      { q: "Which part of STAR should take the most time?", o: ["Situation", "Action", "Result"], a: 1, why: "The action is where the interviewer sees your skill." },
      { q: "An answer ends with \"…and that was the situation.\" What's missing?", o: ["The result", "The situation", "Nothing"], a: 0, why: "Without a result the story has no ending." },
      { q: "What does the T in STAR stand for?", o: ["Timing", "Task", "Teamwork"], a: 1, why: "The task is what you needed to achieve." }
    ] },
  { id: "L5", comp: "social_skill", title: "Eye contact on camera", minutes: 3, measures: ["eye", "smile"],
    body: "On a video interview, eye contact means looking at the camera lens, not at the face on the screen. Aim for most of the answer, with natural breaks when you think.",
    tips: ["Place the interviewer's video window right under your camera.", "Look at the lens at the start and end of each point.", "A brief, natural smile at the start sets a friendly tone."],
    quiz: [
      { q: "On a video call, where should you look for eye contact?", o: ["At the interviewer's face on screen", "At the camera lens", "At your notes"], a: 1, why: "Only the lens reads as eye contact to the other person." },
      { q: "What eye-contact share does Miran treat as the target?", o: ["60% of frames or more", "100% of frames", "10% of frames"], a: 0, why: "Natural breaks are fine; most of the answer should be towards the camera." },
      { q: "Why might Miran show eye contact as \"not measured\"?", o: ["The lighting was too low to measure reliably", "You smiled too much", "Your answer was too short"], a: 0, why: "In low light the measure is not reliable, so it is not reported." }
    ] },
  { id: "L6", comp: "empathy", title: "Acknowledging the other side", minutes: 4, measures: ["ei_shown"],
    body: "Empathy in an interview answer is visible when you describe what the other person needed or felt before you describe your solution.",
    tips: ["Name the feeling: \"they were worried about…\"", "Say how you found out (you asked, you listened).", "Then describe what you did about it."],
    quiz: [
      { q: "Which answer shows empathy most clearly?", o: ["\"I told him the policy.\"", "\"I could hear he was worried about the cost, so I first explained what was covered.\"", "\"I transferred the call.\""], a: 1, why: "It names the feeling and acts on it." },
      { q: "When should you mention the other person's view?", o: ["Before your solution", "Never", "Only if asked"], a: 0, why: "Acknowledging first shows you listened." },
      { q: "Saying no to a request while keeping trust works best when you…", o: ["Say no quickly and move on", "Acknowledge the need and offer an alternative", "Blame the policy"], a: 1, why: "An alternative shows you care about their goal." }
    ] },
  { id: "L7", comp: "motivation", title: "Showing why you want the role", minutes: 3, measures: ["ei_shown", "relevance"],
    body: "\"Why this role?\" is a motivation question. Generic answers (\"I like people\") don't show drive. Specific reasons tied to the daily work do.",
    tips: ["Name one part of the daily work you enjoy and why.", "Give one example where you already did something similar.", "End with what you want to learn."],
    quiz: [
      { q: "Which is the strongest motivation answer?", o: ["\"I need a job.\"", "\"I enjoy solving problems on the spot. In my internship I handled walk-in questions and liked closing them the same day.\"", "\"It's a good company.\""], a: 1, why: "It's specific and backed by an example." },
      { q: "A good motivation answer connects to…", o: ["The salary", "The daily work of the role", "Your hobbies only"], a: 1, why: "Interviewers want to know you'll enjoy the actual work." },
      { q: "What should you end a motivation answer with?", o: ["What you want to learn or achieve", "A question about holidays", "Nothing"], a: 0, why: "It shows forward drive." }
    ] },
  { id: "L8", comp: "motivation", title: "Talking about targets and setbacks", minutes: 4, measures: ["ei_shown"],
    body: "Persistence is shown by what you did after a miss, not by claiming you never miss.",
    tips: ["Own the miss in one sentence.", "Describe the specific change you made.", "Give the result of that change."],
    quiz: [
      { q: "Asked about a missed target, you should…", o: ["Say you never miss targets", "Own it and describe what you changed", "Blame the team"], a: 1, why: "Ownership plus change shows persistence." },
      { q: "Which detail strengthens a setback story most?", o: ["A specific change and its result", "How bad you felt", "Who was at fault"], a: 0, why: "Evidence of action matters most." },
      { q: "Persistence is best shown by…", o: ["What you did next", "Your job title", "Saying you are motivated"], a: 0, why: "Actions after the setback are the evidence." }
    ] },
  { id: "L9", comp: "self_awareness", title: "Rating yourself accurately", minutes: 3, measures: ["gap"],
    body: "Miran compares your self-rating with its result for each answer. A small gap means you see your performance realistically, which Goleman lists as a hallmark of self-awareness.",
    tips: ["Rate right after the interview, before replaying, like a real interview.", "Rate each criterion separately, not your overall feeling.", "Notice whether you tend to rate high or low, and adjust."],
    quiz: [
      { q: "What does a small self-rating gap show?", o: ["Realistic self-assessment", "A high score", "A fast pace"], a: 0, why: "The gap measures how well you judge your own performance." },
      { q: "When do you rate your answers in Miran?", o: ["Once at the end of the interview, without replaying", "After watching each answer twice", "Before the interview"], a: 0, why: "Like a real interview, you judge from memory." },
      { q: "What gap does Miran treat as close?", o: ["1 point or less", "3 points", "Any gap"], a: 0, why: "A gap of 1 or less on the 1–5 scale counts as close." }
    ] },
  { id: "L10", comp: "self_awareness", title: "Talking about a weakness", minutes: 4, measures: ["ei_shown"],
    body: "\"What's your weakness?\" checks honesty and reflection. A real weakness with a concrete plan beats a disguised strength.",
    tips: ["Choose a real weakness that won't block the job.", "Show how you noticed it.", "Describe what you do now and how it's going."],
    quiz: [
      { q: "Which is the best weakness answer?", o: ["\"I'm a perfectionist.\"", "\"I used to avoid asking for help; now I check in every morning, and my deadlines improved.\"", "\"I have no weaknesses.\""], a: 1, why: "Real, reflected on, with a plan and a result." },
      { q: "A good weakness answer includes…", o: ["What you're doing about it", "Three weaknesses", "A joke"], a: 0, why: "It shows you act on self-knowledge." },
      { q: "Which weakness should you avoid choosing?", o: ["One central to the job", "One you are actively improving", "One you noticed through feedback"], a: 0, why: "Pick one that doesn't block the core of the role." }
    ] }
];
MIRAN.lessonById = id => MIRAN.LESSONS.find(l => l.id === id);
/* Lesson linked to the weakest measure of a component */
MIRAN.LESSON_FOR_MEASURE = { pace: "L1", pauses: "L1", fillers: "L2", star: "L4", eye: "L5", smile: "L5", gap: "L9", relevance: "L7" };
MIRAN.LESSON_FOR_COMP = { self_regulation: "L1", social_skill: "L4", empathy: "L6", motivation: "L7", self_awareness: "L9" };

/* ---------- Badges ---------- */
MIRAN.BADGES = [
  { id: "first",    icon: "★",  name: "First session",        desc: "Complete your first practice session" },
  { id: "full",     icon: "◎",  name: "Full picture",         desc: "Complete a full session covering all five skills" },
  { id: "focus",    icon: "◉",  name: "Focused",              desc: "Complete a focus session" },
  { id: "calm",     icon: "↗",  name: "Calmer pace",          desc: "Keep your pace within 120–160 wpm in a whole session" },
  { id: "accurate", icon: "◇",  name: "Accurate self-rating", desc: "Every self-rating within 1 point of Miran's result" },
  { id: "learner",  icon: "✎",  name: "Lesson learner",       desc: "Pass three lesson quizzes" },
  { id: "streak3",  icon: "🔥", name: "3-week streak",        desc: "Practise at least once a week for three weeks" }
];
MIRAN.badgeById = id => MIRAN.BADGES.find(b => b.id === id);

/* ---------- Accounts ---------- */
MIRAN.DEMO = { email: "sara@example.com", password: "Miran2026", admin: "admin@miran.app", adminPassword: "Admin2026" };
