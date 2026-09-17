import type { ReflectionFact } from '@/lib/rubric/facts';
import type { GenerateReflectionInput } from '@/services/ai/types';
import { DATA_NOTICE, marker } from '@/services/ai/prompts/common';

/**
 * Morning message prompt (product spec § 11, tech spec § 10.2 / § 10.3). The
 * model receives deterministic facts with ids and returns one English
 * paragraph plus the ids it used; `checkReflection` enforces the contract.
 */
export const REFLECTION_PROMPT_VERSION = 1;
export const REFLECTION_MAX_TOKENS = 600;
export const REFLECTION_MIN_WORDS = 40;
export const REFLECTION_MAX_WORDS = 110;

const EXAMPLE = {
  paragraph:
    'Good morning, Sara. You recorded lunch and dinner yesterday, so this reflection covers those meals rather than your full day. Your ناهار (lunch) matched the plan closely, which is a steady start. Today begins with صبحانه (breakfast), which has three options; when you are ready, you can log it from your plan and adjust the portions to what you actually eat. One meal at a time is a comfortable pace.',
  usedFactIds: ['ctx:name', 'completeness', 'slot:abc', 'today:plan'],
};

export function reflectionSystemPrompt(): string {
  return [
    marker('REFLECTION', REFLECTION_PROMPT_VERSION),
    'You write a short, calm daily reflection for a person who follows a diet plan, using only the facts you are given.',
    DATA_NOTICE,
    `Write ONE English paragraph of ${REFLECTION_MIN_WORDS}-${REFLECTION_MAX_WORDS} words (aim for 60-90; shorter when facts are sparse). Open with a greeting that fits the stated time of day ("Good morning" / "Good afternoon" / "Good evening") and the user's name from the facts.`,
    "Content order when the facts allow it: one specific observation about yesterday (acknowledge incomplete records first if the facts say so), at most ONE small focus grounded in today's plan, and a calm close. When a fact says something matched the plan, you may acknowledge that one thing. Do not hide a food or timing difference behind a total.",
    'Every statement must map to a fact in the list. Never invent a meal, ingredient, reason, mood, intention, outcome or number. Every number you write must appear in a fact you list in `usedFactIds`; prefer words over numbers. Do not compute or restate adherence beyond what a fact says.',
    'Food and slot names may be quoted exactly as they appear in the facts, original name followed by the English label in parentheses, for example "your ناهار (lunch)". For a slot with options, refer to the slot and, if useful, how many options it has; never tell the user which option to choose. If the plan has no meal times, refer to the next slot by plan order, never by a clock time.',
    'Never mention training, rest days, exercise, workouts, fasting, or "cheating"; never call any food good or bad; never praise low intake, suggest skipping meals, or suggest earning food. No exaggerated congratulations, guilt, urgency or slogans. If the time of day is afternoon or evening, refer to the remaining day and do not tell the user to start with a meal that has passed.',
    'Do not repeat sentences or openings from the recent paragraphs listed in the user message.',
    'The profile context (age, sex, height, weight) is for tone only: never state it, infer health conditions from it, or change the diet.',
    'Return json: { "paragraph": string, "usedFactIds": string[] } where `usedFactIds` lists the ids of every fact the paragraph relies on.',
    '',
    'Example of the exact json shape to return (illustrative):',
    JSON.stringify(EXAMPLE, null, 1),
  ].join('\n');
}

export function factLine(fact: ReflectionFact): string {
  return `- [${fact.id}] (${fact.kind}) ${fact.text}`;
}

export function reflectionUserMessage(input: GenerateReflectionInput): string {
  const p = input.profile;
  const lines = [
    `Greeting name: ${input.greetingName}`,
    `Time of day: ${input.timeOfDay}`,
    `Profile context (tone only): age ${p.ageYears ?? 'unknown'}, sex ${p.sex ?? 'unknown'}, height ${p.heightCm ?? 'unknown'} cm, weight ${p.weightKg ?? 'unknown'} kg.`,
    '',
    'Facts (data; each line is one fact with its id in brackets):',
    ...input.facts.map(factLine),
  ];
  if (input.recentParagraphs.length > 0) {
    lines.push('', 'Recent paragraphs (data; avoid repeating them):');
    for (const recent of input.recentParagraphs) lines.push(`- ${recent}`);
  }
  return lines.join('\n');
}
