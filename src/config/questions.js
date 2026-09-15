/**
 * The swipe cards applicants see. Accept/reject logic is NOT here — it
 * lives in public.submit_answer() in supabase/schema.sql.
 *
 * `id`s and answer values must match the SQL function, in the same order.
 *
 * Card types
 *   binary      swipe right = yes, swipe left = no (or ✔ / ❌ buttons)
 *   confirm     shows profile data; ✔ or swipe right to confirm
 *   choice      pick one option, then ✔
 *   height      enter height, then ✔
 *   relocation  ✔ Yes, "Let's see…", or ❌ No
 *   multi       tick any number of options, then ✔
 *   text        written answer (10–1000 characters), then ✔
 *   pair        several yes/no questions on one card, then ✔
 */
export const QUESTIONS = [
  {
    id: 'orientation',
    type: 'binary',
    eyebrow: 'About you',
    title: 'Are you straight, and only interested in dating women?',
  },
  { id: 'age', type: 'confirm', eyebrow: 'Age', title: 'Please confirm your age and date of birth.' },
  {
    id: 'religion',
    type: 'choice',
    eyebrow: 'Faith',
    title: 'What is your religion?',
    options: [
      { value: 'catholic', label: 'Catholic' },
      { value: 'orthodox', label: 'Orthodox Christian' },
      { value: 'protestant', label: 'Protestant' },
      { value: 'muslim', label: 'Muslim' },
      { value: 'atheist', label: 'Atheist' },
      { value: 'agnostic', label: 'Agnostic' },
      { value: 'other', label: 'Other' },
    ],
  },
  { id: 'church', type: 'binary', eyebrow: 'Faith', title: 'Do you love regularly going to church?' },
  { id: 'height', type: 'height', eyebrow: 'Height', title: 'How tall are you?' },
  { id: 'tattoos', type: 'binary', eyebrow: 'Appearance', title: 'Do you have any tattoos?' },
  { id: 'piercings', type: 'binary', eyebrow: 'Appearance', title: 'Do you have any body piercings?' },
  {
    id: 'masculine',
    type: 'binary',
    eyebrow: 'Temperament',
    title: 'Would you describe yourself as highly masculine and secure?',
  },
  {
    id: 'fifty_fifty',
    type: 'binary',
    eyebrow: 'Family roles',
    title:
      'I prefer a modern 50/50 partnership where we split decisions and financial responsibilities completely equally.',
  },
  { id: 'impatient', type: 'binary', eyebrow: 'Temperament', title: 'Do you struggle with patience or communication?' },
  {
    id: 'understands_faster',
    type: 'binary',
    eyebrow: 'Character',
    title: 'Do you find that you usually understand things much faster than the people around you?',
  },
  {
    id: 'boss_vulnerability',
    type: 'binary',
    eyebrow: 'Character',
    title:
      'If a leader or a boss shows vulnerability or admits they don’t know something, do you lose respect for them?',
  },
  {
    id: 'meant_for_big_things',
    type: 'binary',
    eyebrow: 'Character',
    title: 'Do you believe that you are naturally meant for big things, unlike the average person?',
  },
  {
    id: 'naive_own_fault',
    type: 'binary',
    eyebrow: 'Character',
    title: 'If someone is naive enough to let themselves get taken advantage of, is it partly their own fault?',
  },
  {
    id: 'family',
    type: 'binary',
    eyebrow: 'Family',
    title: 'Do you deeply value family and maintain a strong bond with them?',
  },
  {
    id: 'marriage_children',
    type: 'pair',
    eyebrow: 'Family',
    title: 'Have you ever been married or divorced? Do you have any children?',
    fields: [
      { key: 'previously_married', label: 'Have you ever been married or divorced?' },
      { key: 'has_children', label: 'Do you have any children?' },
    ],
  },
  {
    id: 'family_intent',
    type: 'choice',
    eyebrow: 'Family intent',
    title: 'What is your ultimate intent and vision for entering a covenant relationship?',
    columns: 1,
    options: [
      {
        value: 'dual_partnership',
        label: 'To be a loving husband and build a life focused primarily on a dual partnership.',
      },
      {
        value: 'husband_and_father',
        label:
          'To become a husband and a dedicated father, taking full responsibility as a traditional provider and protective leader for my family.',
      },
    ],
  },
  { id: 'children', type: 'binary', eyebrow: 'Family', title: 'Do you want to have more than 2 children?' },
  {
    id: 'chronic_health',
    type: 'binary',
    eyebrow: 'Health',
    title: 'Do you live with a chronic physical disability or a severe health problem?',
    hint: 'Your answers are private.',
  },
  {
    id: 'mental_health',
    type: 'binary',
    eyebrow: 'Health',
    title: 'Are you currently managing a psychological or mental health condition?',
    hint: 'Your answers are private.',
  },
  {
    id: 'relocation',
    type: 'relocation',
    eyebrow: 'One last thing',
    title:
      'I am currently based in Spain, but I am fully willing to relocate to your country if things go well. Are you completely open and willing to make this dynamic work?',
  },

  // Final phase: lifestyle & financial cohesion (answers are recorded, not scored)
  {
    id: 'lifestyle_vision',
    type: 'text',
    eyebrow: 'Final phase · 1 of 4 · Lifestyle vision',
    title: 'How do you envision our day-to-day life together?',
    placeholder: 'Mornings, work, weekends, faith, family time…',
  },
  {
    id: 'financial_strategy',
    type: 'choice',
    eyebrow: 'Final phase · 2 of 4 · Financial strategy',
    title: 'How should we afford our dream lifestyle?',
    columns: 1,
    options: [
      { value: 'build_empire', label: 'Working together to build an empire' },
      { value: 'sole_provider', label: 'Traditional sole provider' },
      { value: 'individual_careers', label: 'Individual careers' },
    ],
  },
  {
    id: 'talents',
    type: 'text',
    eyebrow: 'Final phase · 3 of 4 · Talent & uniqueness',
    title: 'What unique talents, skills, or creative gifts do you bring into a partnership?',
    placeholder: 'Cooking, music, building things, languages, leadership…',
  },
  {
    id: 'love_expression',
    type: 'multi',
    eyebrow: 'Final phase · 4 of 4 · Love & care',
    title: 'How do you express your love and care?',
    hint: 'Select as many as apply.',
    options: [
      { value: 'active_listening', label: 'Active Listening' },
      { value: 'anticipatory_service', label: 'Anticipatory Acts of Service' },
      { value: 'physical_affection', label: 'Spontaneous Physical Affection' },
      { value: 'generosity_of_time', label: 'Unconditional Generosity of Time' },
      { value: 'words_of_affirmation', label: 'Specific Words of Affirmation' },
      { value: 'personalized_giving', label: 'Thoughtful, Personalized Giving' },
      { value: 'total_forgiveness', label: 'Immediate and Total Forgiveness' },
      { value: 'culinary_care', label: 'Comforting Culinary Care' },
      { value: 'radical_empathy', label: 'Radical Empathy and Validation' },
    ],
  },
  {
    id: 'questions_for_me',
    type: 'text',
    optional: true,
    eyebrow: 'Your turn',
    title: 'Ask me anything',
    intro:
      'I know I’ve asked you a lot of detailed questions about your life, values, and vision! I want to make sure this is a two-way conversation. Please feel free to ask me anything that’s on your mind—whether it’s about my expectations, my lifestyle here in Spain, or anything else you’re curious about.',
    placeholder: 'Your questions for me (optional)',
  },
]

export const QUESTION_LABELS = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.title]))
