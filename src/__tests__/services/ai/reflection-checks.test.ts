import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReflectionFact } from '@/lib/rubric/facts';

vi.mock('@/services/ai/deepseek', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/ai/deepseek')>();
  return { ...actual, complete: vi.fn() };
});

import { complete } from '@/services/ai/deepseek';
import { checkReflection, generateReflection } from '@/services/ai/generate-reflection';
import { reflectionSystemPrompt } from '@/services/ai/prompts/reflection';
import type { GenerateReflectionInput } from '@/services/ai/types';

const completeMock = vi.mocked(complete);

const facts: ReflectionFact[] = [
  { id: 'ctx:name', kind: 'CONTEXT', text: "The user's name is sara84.", signature: 'sara84' },
  { id: 'ctx:time', kind: 'CONTEXT', text: 'It is morning for the user.', signature: 'MORNING' },
  {
    id: 'coverage',
    kind: 'COVERAGE',
    text: '2 of 5 prescribed meals were recorded yesterday.',
    signature: '2/5',
  },
  {
    id: 'today:next',
    kind: 'TODAY_NEXT',
    text: 'The next unrecorded slot today is قبل تمرین.',
    signature: 'slot-1',
  },
  {
    id: 'energy',
    kind: 'ENERGY',
    text: "Yesterday's energy total was below the planned range by 320 kcal.",
    signature: 'BELOW:LARGE',
  },
];

const words = (n: number) => Array.from({ length: n }, () => 'calm').join(' ');

const good = {
  paragraph: `Good morning, sara84. You recorded 2 of 5 prescribed meals yesterday, so this reflection covers those meals rather than your whole day. ${words(30)} Your next slot today is قبل تمرین; when you are ready, log it from your plan and adjust the portions to what you actually eat. One meal at a time is a comfortable pace.`,
  usedFactIds: ['ctx:name', 'coverage', 'today:next'],
};

describe('checkReflection', () => {
  it('accepts a grounded paragraph', () => {
    expect(checkReflection(good, facts)).toBeNull();
  });

  it('rejects unknown fact ids', () => {
    expect(checkReflection({ ...good, usedFactIds: ['coverage', 'ghost'] }, facts)).toBe(
      'UNKNOWN_FACT',
    );
  });

  it('rejects paragraphs outside 40–110 words', () => {
    expect(checkReflection({ paragraph: words(39), usedFactIds: [] }, facts)).toBe('WORD_COUNT');
    expect(checkReflection({ paragraph: words(111), usedFactIds: [] }, facts)).toBe('WORD_COUNT');
    expect(checkReflection({ paragraph: words(40), usedFactIds: [] }, facts)).toBeNull();
  });

  it('rejects numbers that no used fact supports, ignoring the greeting name', () => {
    expect(
      checkReflection(
        {
          paragraph: `Good morning, sara84. ${words(45)} about 3 meals.`,
          usedFactIds: ['coverage'],
        },
        facts,
      ),
    ).toBe('UNSUPPORTED_NUMBER');
    // 320 is in the energy fact, but only used facts count.
    expect(
      checkReflection(
        {
          paragraph: `Good morning, sara84. ${words(45)} below by 320 kcal.`,
          usedFactIds: ['coverage'],
        },
        facts,
      ),
    ).toBe('UNSUPPORTED_NUMBER');
    expect(
      checkReflection(
        {
          paragraph: `Good morning, sara84. ${words(45)} below by 320 kcal.`,
          usedFactIds: ['energy'],
        },
        facts,
      ),
    ).toBeNull();
    expect(
      checkReflection(
        {
          paragraph: `Hi sara84, ${words(45)} 2 of 5 meals and 2,200 kcal.`,
          usedFactIds: ['coverage'],
        },
        facts,
      ),
    ).toBe('UNSUPPORTED_NUMBER');
  });

  it('rejects banned words in prose, parenthesised or not', () => {
    for (const phrase of [
      'no cheating today',
      'some exercise helps',
      'after training',
      'a quick workout',
      'while fasting',
      'that is good food',
      'avoid bad foods',
      'rest first (after training)',
    ]) {
      expect(
        checkReflection({ paragraph: `${words(45)} ${phrase}.`, usedFactIds: [] }, facts),
        phrase,
      ).toBe('BANNED_WORD');
    }
    expect(
      checkReflection({ paragraph: `${words(45)} breakfast fast.`, usedFactIds: [] }, facts),
    ).toBeNull();
  });

  it('allows a banned word that is part of a name the facts quote', () => {
    const shake: ReflectionFact = {
      id: 'today:next',
      kind: 'TODAY_NEXT',
      text: 'The next unrecorded slot today is Post-workout shake.',
      signature: 'slot-2',
    };
    const named = facts.map((f) => (f.id === 'today:next' ? shake : f));
    expect(
      checkReflection(
        {
          paragraph: `${words(45)} your Post-workout shake comes next.`,
          usedFactIds: ['today:next'],
        },
        named,
      ),
    ).toBeNull();
    // Only the quoted word is the plan's own; the rest of the list stays banned.
    expect(
      checkReflection(
        {
          paragraph: `${words(45)} your Post-workout shake comes next, after training.`,
          usedFactIds: ['today:next'],
        },
        named,
      ),
    ).toBe('BANNED_WORD');
    // The same name in the base facts is Persian, so the English word has no cover.
    expect(
      checkReflection(
        { paragraph: `${words(45)} your Post-workout shake comes next.`, usedFactIds: [] },
        facts,
      ),
    ).toBe('BANNED_WORD');
  });
});

describe('generateReflection', () => {
  const input: GenerateReflectionInput = {
    facts,
    profile: { ageYears: 30, sex: 'FEMALE', heightCm: 168, weightKg: 64 },
    greetingName: 'sara84',
    timeOfDay: 'MORNING',
    recentParagraphs: ['Yesterday you did well.'],
    deadlineAt: Date.now() + 15_000,
    userTag: 'tag',
  };

  beforeEach(() => completeMock.mockReset());

  it('sends the facts with ids and returns the checked paragraph', async () => {
    completeMock.mockResolvedValueOnce({
      ok: true,
      data: good,
      attempts: [{ model: 'm', durationMs: 2, outcome: 'OK' }],
      usage: { promptTokens: 1, completionTokens: 1 },
      model: 'm',
      durationMs: 2,
    });
    const result = await generateReflection(input);
    expect(result.ok).toBe(true);
    const call = completeMock.mock.calls[0]![0];
    expect(call.kind).toBe('REFLECTION');
    expect(call.system).toBe(reflectionSystemPrompt());
    expect(call.user).toContain(
      '- [coverage] (COVERAGE) 2 of 5 prescribed meals were recorded yesterday.',
    );
    expect(call.user).toContain('Time of day: MORNING');
    expect(call.user).toContain('- Yesterday you did well.');
  });

  it('maps a failed check to SCHEMA_REJECTED on the last attempt', async () => {
    completeMock.mockResolvedValueOnce({
      ok: true,
      data: { paragraph: `${words(50)} after training.`, usedFactIds: [] },
      attempts: [{ model: 'm', durationMs: 2, outcome: 'OK' }],
      usage: { promptTokens: 1, completionTokens: 1 },
      model: 'm',
      durationMs: 2,
    });
    const result = await generateReflection(input);
    expect(result).toMatchObject({ ok: false, reason: 'SCHEMA_REJECTED' });
    expect(result.attempts[0]?.outcome).toBe('SCHEMA_REJECTED');
  });
});

describe('prompts', () => {
  it('carry the stub marker, the word json and exactly one example', () => {
    const prompt = reflectionSystemPrompt();
    expect(prompt.startsWith('# dietyaar:REFLECTION v2')).toBe(true);
    // Names are quoted as written; the prompt no longer asks for a translated label.
    expect(prompt).toContain('no translation and no English label');
    expect(prompt).not.toContain('(lunch)');
    expect(prompt.toLowerCase()).toContain('json');
    expect(prompt.match(/Example of the exact json shape/g)).toHaveLength(1);
  });
});
