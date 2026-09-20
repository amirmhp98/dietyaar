'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getComposerContextAction, getLastUsedOptionAction } from '@/actions/composer.actions';
import { getDayAction } from '@/actions/day.actions';
import {
  analyzeMealDraftAction,
  createMealDraftAction,
  discardMealDraftAction,
  getMealDraftAction,
  getRecentMealsAction,
  reuseMealAction,
  saveMealAction,
  updateMealDraftAction,
} from '@/actions/meal.actions';
import { acknowledgeAiNoticeAction } from '@/actions/profile.actions';
import { Button, toast } from '@/components/UiComponents';
import { useAuth } from '@/components/layout/AuthProvider';
import { AiNoticeSheet } from '@/components/product/AiNoticeSheet';
import { MealComposer, type AnalysisStatus } from '@/components/product/MealComposer';
import { MealReview, type ReviewSyncStatus } from '@/components/product/MealReview';
import { type ComposerRequest, useComposerRequests } from '@/components/product/composer-bus';
import { ComposerModal } from '@/components/product/meal/ComposerModal';
import type { StagedPhoto } from '@/components/product/meal/PhotoPicker';
import { StartOverButton } from '@/components/product/meal/ResumedBanner';
import {
  OTHER_SLOT,
  defaultLinkAfterAnalysis,
  seedManualItem,
} from '@/components/product/meal/composition';
import {
  PhotoUploadError,
  type PhotoErrorCode,
  deleteStagedImage,
  prepareImage,
  uploadImage,
} from '@/components/product/photo-input';
import type { ActionResult } from '@/lib/action-result';
import { formatDate, formatTime } from '@/lib/format';
import type { MatchResult, RubricSlot } from '@/lib/rubric/types';
import { t, tp } from '@/lib/t';
import { addDays, instantFor, isLateNightWindow, localDateFor, localTimeFor } from '@/lib/time';
import type { DraftFoodItem, MealDraftState } from '@/lib/validations/meal';
import type { AiNoticeKind } from '@/lib/validations/profile';

/**
 * Log meal island (implementation plan 6.3/6.4/6.6, 9.3): owns the whole
 * composition, calls the actions, mirrors the draft to sessionStorage per
 * user (`composer:<userId>:<clientRequestId>`) and autosaves review edits
 * with a 500 ms debounce. Answering a question refines the estimate in
 * place (REFINE, 800 ms debounce); Re-estimate takes the same path.
 * Product components underneath are stateless.
 */

type Step = 'late-night' | 'compose' | 'review';

interface Composition {
  clientRequestId: string;
  step: Step;
  localDate: string;
  /** null = not entered; `timeUnknown` says whether that is deliberate. */
  time: string | null;
  timeUnknown: boolean;
  text: string;
  notes: string;
  /** null = not chosen, OTHER_SLOT = explicitly "Other", else a plan slot id. */
  slotChoice: string | null;
  optionId: string | null;
  /** The suggested slot that already held a meal, when that made this an extra meal (B4). */
  extraSlotId: string | null;
  photos: StagedPhoto[];
  draftId: string | null;
  revision: number;
  state: MealDraftState | null;
  match: MatchResult | null;
  /** Text + photos the current items were analysed from; Analyze with the same input skips the call. */
  analyzedInput: string | null;
  /** Set when the composer opened for a slot; the row shows its options expanded. */
  expandSlotId: string | null;
  /** The sheet opened on a draft from before (mirror or resume link). */
  resumed: boolean;
}

interface Mirror extends Omit<Composition, 'photos'> {
  photos: Array<Omit<StagedPhoto, 'previewUrl'>>;
  savedAt: number;
}

type DraftView =
  Awaited<ReturnType<typeof getMealDraftAction>> extends infer R
    ? R extends { ok: true; data: infer D }
      ? D
      : never
    : never;

const AUTOSAVE_MS = 500;
const REFINE_MS = 800;
const SLOW_MS = 15_000;
const PHOTO_ERRORS: Record<PhotoErrorCode, string> = {
  PHOTO_DISABLED: t('photo.errors.disabled'),
  UPLOAD_TYPE: t('photo.errors.type'),
  UPLOAD_SIZE: t('photo.errors.size'),
  STORAGE_FULL: t('photo.errors.storageFull'),
  STORAGE_UNAVAILABLE: t('photo.errors.storageUnavailable'),
  RATE_LIMITED: t('photo.errors.rateLimited'),
  FORBIDDEN: t('photo.errors.notFound'),
  NOT_FOUND: t('photo.errors.notFound'),
  UNAUTHENTICATED: t('meal.errors.sessionEnded'),
  UNSUPPORTED: t('photo.errors.unsupported'),
  NETWORK: t('photo.errors.network'),
  UNEXPECTED: t('errors.unexpected'),
};

function newComposition(localDate: string, time: string | null): Composition {
  return {
    clientRequestId: crypto.randomUUID(),
    step: 'compose',
    localDate,
    time,
    timeUnknown: time === null,
    text: '',
    notes: '',
    slotChoice: null,
    optionId: null,
    extraSlotId: null,
    photos: [],
    draftId: null,
    revision: 0,
    state: null,
    match: null,
    analyzedInput: null,
    expandSlotId: null,
    resumed: false,
  };
}

function storageKey(userId: string, clientRequestId: string): string {
  return `composer:${userId}:${clientRequestId}`;
}

function readMirror(userId: string): Mirror | null {
  try {
    const prefix = `composer:${userId}:`;
    let newest: Mirror | null = null;
    for (const key of Object.keys(sessionStorage)) {
      if (!key.startsWith(prefix)) continue;
      const parsed = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Mirror | null;
      if (parsed && (!newest || parsed.savedAt > newest.savedAt)) newest = parsed;
    }
    return newest;
  } catch {
    return null;
  }
}

function writeMirror(userId: string, comp: Composition): void {
  try {
    const mirror: Mirror = {
      ...comp,
      photos: comp.photos.map(({ uploadId, width, height }) => ({ uploadId, width, height })),
      savedAt: Date.now(),
    };
    sessionStorage.setItem(storageKey(userId, comp.clientRequestId), JSON.stringify(mirror));
  } catch {
    // storage unavailable: the server draft is the fallback
  }
}

function clearMirror(userId: string, clientRequestId: string): void {
  try {
    sessionStorage.removeItem(storageKey(userId, clientRequestId));
  } catch {
    // ignore
  }
}

/** Items the server would refuse: a name is required (the English label falls back to it). */
function hasBlankItem(items: DraftFoodItem[]): boolean {
  return items.some((item) => item.originalName.trim() === '');
}

function sanitizeItems(items: DraftFoodItem[]): DraftFoodItem[] {
  return items
    .filter((item) => item.originalName.trim() !== '')
    .map((item, position) => ({
      ...item,
      position,
      englishLabel: item.englishLabel.trim() || item.originalName.trim(),
    }));
}

/** A server action call that cannot reach the server (offline) becomes a failed result. */
async function safely<T>(call: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await call();
  } catch {
    return { ok: false, error: t('photo.errors.network'), code: 'NETWORK' };
  }
}

function linkOf(comp: Composition): { planSlotId: string | null; planOptionId: string | null } {
  const planSlotId = comp.slotChoice && comp.slotChoice !== OTHER_SLOT ? comp.slotChoice : null;
  return { planSlotId, planOptionId: planSlotId ? comp.optionId : null };
}

function inputSignature(comp: Composition): string {
  return JSON.stringify([comp.text.trim(), comp.photos.map((p) => p.uploadId)]);
}

/** Drops a staged upload the composition let go of; already gone (with its draft) or offline is fine. */
async function dropStagedUpload(uploadId: string): Promise<void> {
  try {
    await deleteStagedImage(uploadId);
  } catch {
    // The cleanup task removes stale uploads.
  }
}

export function MealComposerIsland({
  timeZone,
  photoEnabled,
}: {
  timeZone: string;
  photoEnabled: boolean;
}) {
  const user = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [comp, setCompState] = useState<Composition | null>(null);
  const compRef = useRef<Composition | null>(null);
  const setComp = useCallback((update: (prev: Composition) => Composition) => {
    const prev = compRef.current;
    if (!prev) return;
    const next = update(prev);
    compRef.current = next;
    setCompState(next);
  }, []);
  const replaceComp = useCallback((next: Composition | null) => {
    compRef.current = next;
    setCompState(next);
  }, []);

  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisStatus>('idle');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [notice, setNotice] = useState<AiNoticeKind | null>(null);
  const [context, setContext] = useState<{
    aiNoticeMealTextShown: boolean;
    aiNoticePhotoShown: boolean;
  } | null>(null);
  const [recent, setRecent] = useState<Array<{
    id: string;
    items: Array<{ originalName: string; englishLabel: string }>;
    energyKcal: number | null;
    planSlotId: string | null;
    planOptionId: string | null;
  }> | null>(null);
  type DayInfo = { date: string; slots: RubricSlot[]; recordedSlotIds: string[]; hasPlan: boolean };
  const [dayInfo, setDayInfoState] = useState<DayInfo | null>(null);
  // Read through the ref from async paths (analysis returns after loadDay may have resolved).
  const dayInfoRef = useRef<DayInfo | null>(null);
  const setDayInfo = useCallback(
    (next: DayInfo | null | ((prev: DayInfo | null) => DayInfo | null)) => {
      const value = typeof next === 'function' ? next(dayInfoRef.current) : next;
      dayInfoRef.current = value;
      setDayInfoState(value);
    },
    [],
  );
  const [lastUsed, setLastUsed] = useState<Record<string, string | null>>({});
  const [moreOpen, setMoreOpen] = useState(false);
  const [sync, setSync] = useState<ReviewSyncStatus>('saved');
  const [online, setOnline] = useState(true);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);

  const dirtyRef = useRef(false);
  const editSeqRef = useRef(0);
  const flightRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  const analysisRunRef = useRef(0);
  const refineRunRef = useRef(0);
  const refineFlightRef = useRef<Promise<void> | null>(null);
  const refineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = localDateFor(new Date(), timeZone);

  // ── Mirror every change to sessionStorage (per user) ───────────────────
  useEffect(() => {
    if (!comp || comp.step === 'late-night') return;
    const hasContent =
      comp.text.trim() !== '' ||
      comp.photos.length > 0 ||
      comp.notes !== '' ||
      comp.slotChoice !== null ||
      comp.draftId !== null;
    if (hasContent) writeMirror(user.id, comp);
  }, [comp, user.id]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // ── Data the compose step needs ─────────────────────────────────────────
  const loadContext = useCallback(async () => {
    if (context) return context;
    const result = await getComposerContextAction();
    if (result.ok) {
      setContext(result.data);
      return result.data;
    }
    return null;
  }, [context]);

  const loadDay = useCallback(
    async (localDate: string) => {
      setDayInfo((prev) => (prev?.date === localDate ? prev : null));
      const result = await getDayAction(localDate);
      if (!result.ok) {
        setDayInfo({ date: localDate, slots: [], recordedSlotIds: [], hasPlan: false });
        return [] as RubricSlot[];
      }
      const views = result.data.view.slots;
      const slots = views.map((s) => s.slot);
      const plan = result.data.plan;
      setDayInfo({
        date: localDate,
        slots,
        recordedSlotIds: views
          .filter((s) => s.state === 'RECORDED' || s.state === 'NEEDS_REVIEW')
          .map((s) => s.slot.id),
        hasPlan: plan !== null && plan.confirmedAt !== null,
      });
      return slots;
    },
    [setDayInfo],
  );

  const loadRecent = useCallback(async () => {
    const result = await getRecentMealsAction();
    setRecent(result.ok ? result.data : []);
  }, []);

  const loadLastUsed = useCallback(
    async (slotId: string) => {
      if (slotId in lastUsed) return;
      const result = await getLastUsedOptionAction(slotId);
      setLastUsed((prev) => ({ ...prev, [slotId]: result.ok ? result.data : null }));
    },
    [lastUsed],
  );

  // ── Adopting a server draft ─────────────────────────────────────────────
  const adoptDraft = useCallback(
    (draft: DraftView, match: MatchResult | null | undefined, step?: Step) => {
      setComp((prev) => ({
        ...prev,
        draftId: draft.id,
        revision: draft.revision,
        state: draft.state,
        match: match === undefined ? prev.match : match,
        text: draft.state.text ?? prev.text,
        localDate: draft.state.localDate,
        time: draft.state.time,
        timeUnknown: draft.state.time !== null ? false : prev.timeUnknown,
        notes: draft.state.notes ?? '',
        slotChoice: draft.state.planSlotId ?? (prev.slotChoice === OTHER_SLOT ? OTHER_SLOT : null),
        optionId: draft.state.planOptionId,
        step: step ?? prev.step,
      }));
      dirtyRef.current = false;
      setSync('saved');
      setConflict(false);
    },
    [setComp],
  );

  // ── Autosave (review edits) ─────────────────────────────────────────────
  const flushAutosave = useCallback(async (): Promise<boolean> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (flightRef.current) await flightRef.current;
    const current = compRef.current;
    if (!current || !dirtyRef.current || !current.draftId || !current.state) return true;
    // An item without a name stays local until it is named or removed.
    if (hasBlankItem(current.state.items)) return true;
    const seq = editSeqRef.current;
    const link = linkOf(current);
    setSync('pending');
    let okResult = false;
    const flight = (async () => {
      const result = await safely(() =>
        updateMealDraftAction({
          draftId: current.draftId,
          expectedRevision: current.revision,
          edits: {
            text: current.state?.text ?? null,
            localDate: current.state?.localDate,
            time: current.state?.time ?? null,
            planSlotId: link.planSlotId,
            planOptionId: link.planOptionId,
            notes: current.state?.notes ?? null,
            items: current.state ? sanitizeItems(current.state.items) : undefined,
            questions: current.state?.questions,
            uploadIds: current.state?.uploadIds,
          },
        }),
      );
      if (result.ok) {
        okResult = true;
        if (editSeqRef.current === seq) {
          // The user may have stepped back meanwhile; never pull them into the review.
          adoptDraft(result.data.draft, result.data.preview.match);
        } else {
          // Newer local edits exist: keep them, take the revision, the next flush sends them.
          setComp((prev) => ({ ...prev, revision: result.data.draft.revision }));
          timerRef.current = setTimeout(() => void flushRef.current(), AUTOSAVE_MS);
        }
      } else if (result.code === 'CONFLICT') {
        setConflict(true);
        setSync('failed');
      } else {
        setSync('failed');
      }
    })();
    flightRef.current = flight;
    await flight;
    flightRef.current = null;
    return okResult;
  }, [adoptDraft, setComp]);
  useEffect(() => {
    flushRef.current = flushAutosave;
  }, [flushAutosave]);

  const scheduleAutosave = useCallback(() => {
    dirtyRef.current = true;
    editSeqRef.current += 1;
    setSync('pending');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flushAutosave(), AUTOSAVE_MS);
  }, [flushAutosave]);

  useEffect(() => {
    if (online && dirtyRef.current) void flushAutosave();
  }, [online, flushAutosave]);

  const patchReview = useCallback(
    (patch: Partial<MealDraftState>) => {
      setComp((prev) => {
        if (!prev.state) return prev;
        const state = { ...prev.state, ...patch };
        const slotChoice =
          patch.planSlotId !== undefined ? (patch.planSlotId ?? OTHER_SLOT) : prev.slotChoice;
        return {
          ...prev,
          state,
          slotChoice,
          optionId: patch.planOptionId !== undefined ? patch.planOptionId : prev.optionId,
          // A slot picked by hand ends the "already recorded" explanation.
          extraSlotId: patch.planSlotId !== undefined ? null : prev.extraSlotId,
          localDate: state.localDate,
          time: state.time,
          notes: state.notes ?? '',
        };
      });
      setSaveError(null);
      scheduleAutosave();
    },
    [scheduleAutosave, setComp],
  );

  // ── Refine (answers and Re-estimate) ────────────────────────────────────
  /**
   * REFINE keeps the reviewed items and fills what the answers made known.
   * Runs after the autosave has flushed so the server sees the answers; a
   * previous refine still in flight is awaited so revisions never cross.
   */
  const runRefine = useCallback(async () => {
    if (refineFlightRef.current) await refineFlightRef.current;
    const flushed = await flushAutosave();
    const current = compRef.current;
    if (!flushed || !current?.draftId || !current.state || current.state.items.length === 0) return;
    const run = ++refineRunRef.current;
    setRefineError(null);
    setSync('refining');
    const flight = (async () => {
      const result = await safely(() =>
        analyzeMealDraftAction({
          draftId: current.draftId,
          expectedRevision: current.revision,
          mode: 'REFINE',
        }),
      );
      const latest = compRef.current;
      if (refineRunRef.current !== run || !latest || latest.draftId !== current.draftId) return;
      if (result.ok) {
        if (result.data.analysisStatus !== 'DONE' || dirtyRef.current) {
          // Superseded by an edit, or edited meanwhile: the user's values win; take the revision.
          setComp((prev) => ({ ...prev, revision: result.data.revision }));
          if (dirtyRef.current) {
            setSync('pending');
            timerRef.current = setTimeout(() => void flushRef.current(), AUTOSAVE_MS);
          } else {
            setSync('saved');
          }
          return;
        }
        adoptDraft(result.data, undefined);
        return;
      }
      // The answer is saved already; only the estimate failed.
      setSync('saved');
      if (result.code === 'CONFLICT') setConflict(true);
      else setRefineError(t('meal.review.refineFailed'));
    })();
    refineFlightRef.current = flight;
    await flight;
    refineFlightRef.current = null;
  }, [adoptDraft, flushAutosave, setComp]);

  const scheduleRefine = useCallback(() => {
    if (refineTimerRef.current) clearTimeout(refineTimerRef.current);
    refineTimerRef.current = setTimeout(() => void runRefine(), REFINE_MS);
  }, [runRefine]);

  // ── Draft creation ──────────────────────────────────────────────────────
  type Kind = 'TEXT' | 'PHOTO' | 'PHOTO_TEXT' | 'RECENT' | 'PLANNED' | 'MANUAL';

  const finishAlreadySaved = useCallback(
    (mealId: string) => {
      const current = compRef.current;
      if (current) clearMirror(user.id, current.clientRequestId);
      toast.success(t('meal.saved'));
      setLastSavedId(mealId);
      replaceComp(null);
      setOpen(false);
      router.refresh();
    },
    [replaceComp, router, user.id],
  );

  /** Creates the server draft, or pushes the compose fields onto the existing one. */
  const ensureDraft = useCallback(
    async (kind: Kind, extra: { copiedFromMealId?: string } = {}): Promise<DraftView | null> => {
      const current = compRef.current;
      if (!current) return null;
      const link = linkOf(current);
      const uploadIds = current.photos.map((p) => p.uploadId);
      if (current.draftId) {
        const result = await safely(() =>
          updateMealDraftAction({
            draftId: current.draftId,
            expectedRevision: current.revision,
            edits: {
              text: current.text.trim() ? current.text : null,
              uploadIds,
              localDate: current.localDate,
              time: current.time,
              planSlotId: link.planSlotId,
              planOptionId: link.planOptionId,
              notes: current.notes.trim() ? current.notes : null,
            },
          }),
        );
        if (!result.ok) {
          if (result.code === 'CONFLICT') setConflict(true);
          toast.error(result.error);
          return null;
        }
        return result.data.draft;
      }
      const created = await safely(() =>
        createMealDraftAction({
          clientRequestId: current.clientRequestId,
          kind,
          text: current.text.trim() ? current.text : undefined,
          uploadIds,
          localDate: current.localDate,
          time: current.time,
          planSlotId: link.planSlotId,
          planOptionId: link.planOptionId,
          copiedFromMealId: extra.copiedFromMealId ?? null,
        }),
      );
      if (!created.ok) {
        toast.error(created.error);
        return null;
      }
      if (created.data.meal) {
        finishAlreadySaved(created.data.meal.id);
        return null;
      }
      let draft = created.data.draft;
      if (current.notes.trim()) {
        const noted = await safely(() =>
          updateMealDraftAction({
            draftId: draft.id,
            expectedRevision: draft.revision,
            edits: { notes: current.notes },
          }),
        );
        if (noted.ok) draft = noted.data.draft;
      }
      return draft;
    },
    [finishAlreadySaved],
  );

  // ── Analysis ────────────────────────────────────────────────────────────
  const runAnalysis = useCallback(async () => {
    const current = compRef.current;
    if (!current) return;
    // Back, then Analyze with nothing changed: the analysed items are still good.
    if (
      current.state &&
      current.state.items.length > 0 &&
      current.analyzedInput === inputSignature(current)
    ) {
      setComp((prev) => ({ ...prev, step: 'review' }));
      return;
    }
    setBusy(true);
    setAnalysisError(null);
    const kind: Kind =
      current.photos.length > 0 ? (current.text.trim() ? 'PHOTO_TEXT' : 'PHOTO') : 'TEXT';
    const draft = await ensureDraft(kind);
    if (!draft) {
      setBusy(false);
      return;
    }
    adoptDraft(draft, undefined, 'compose');
    const run = ++analysisRunRef.current;
    setAnalysis('running');
    const slowTimer = setTimeout(() => {
      if (analysisRunRef.current === run) setAnalysis('slow');
    }, SLOW_MS);
    const result = await safely(() =>
      analyzeMealDraftAction({
        draftId: draft.id,
        expectedRevision: draft.revision,
        mode: 'ANALYZE',
      }),
    );
    clearTimeout(slowTimer);
    setBusy(false);
    const latest = compRef.current;
    if (!latest || latest.draftId !== draft.id) return;
    const abandoned = analysisRunRef.current !== run;
    if (result.ok) {
      if (abandoned) {
        // The user went manual meanwhile: keep their edits, but take the server's revision.
        if (dirtyRef.current) setComp((prev) => ({ ...prev, revision: result.data.revision }));
        else adoptDraft(result.data, undefined, 'review');
        return;
      }
      if (result.data.analysisStatus !== 'DONE') {
        setAnalysis('failed');
        setAnalysisError(t('meal.errors.analysisFailed'));
        setComp((prev) => ({ ...prev, revision: result.data.revision, step: 'compose' }));
        return;
      }
      setAnalysis('idle');
      adoptDraft(result.data, undefined, 'review');
      // Where the meal lands: the user's choice, the suggestion, or Extra (B4).
      const decision = defaultLinkAfterAnalysis({
        userChoice: latest.slotChoice,
        suggestedSlotId: result.data.state.planSlotId,
        recordedSlotIds:
          dayInfoRef.current?.date === latest.localDate ? dayInfoRef.current.recordedSlotIds : [],
      });
      if (decision.slotChoice === OTHER_SLOT && result.data.state.planSlotId) {
        patchReview({ planSlotId: null, planOptionId: null });
      }
      setComp((prev) => ({
        ...prev,
        slotChoice: decision.slotChoice,
        extraSlotId: decision.extraSlotId,
        analyzedInput: inputSignature(latest),
      }));
      return;
    }
    if (abandoned) return;
    setAnalysis('failed');
    setComp((prev) => ({ ...prev, step: 'compose' }));
    if (result.code === 'CONFLICT') {
      setConflict(true);
      setAnalysisError(result.error);
    } else if (
      result.code === 'AI_UNAVAILABLE' ||
      result.code === 'DAILY_AI_CAP' ||
      result.code === 'AI_TIMEOUT'
    ) {
      setAnalysisError(result.error);
    } else {
      setAnalysisError(t('meal.errors.analysisFailed'));
    }
  }, [adoptDraft, ensureDraft, patchReview, setComp]);

  const requestAnalysis = useCallback(async () => {
    const current = compRef.current;
    if (!current) return;
    const ctx = await loadContext();
    const kind: AiNoticeKind = current.photos.length > 0 ? 'MEAL_PHOTO' : 'MEAL_TEXT';
    const shown = kind === 'MEAL_PHOTO' ? ctx?.aiNoticePhotoShown : ctx?.aiNoticeMealTextShown;
    if (!shown) {
      setNotice(kind);
      return;
    }
    await runAnalysis();
  }, [loadContext, runAnalysis]);

  const goManual = useCallback(async () => {
    analysisRunRef.current += 1;
    setAnalysis('idle');
    setAnalysisError(null);
    setBusy(true);
    const draft = await ensureDraft('MANUAL');
    setBusy(false);
    if (!draft) return;
    adoptDraft(draft, undefined, 'review');
    // What was typed becomes the first item, so nothing is lost on the way to manual (B7).
    const seed =
      draft.state.items.length === 0 ? seedManualItem(compRef.current?.text ?? '') : null;
    if (seed) patchReview({ items: [seed] });
  }, [adoptDraft, ensureDraft, patchReview]);

  // ── Recent and planned picks ────────────────────────────────────────────
  const rotateIfDrafted = useCallback(() => {
    const current = compRef.current;
    if (current?.draftId) {
      clearMirror(user.id, current.clientRequestId);
      setComp((prev) => ({
        ...prev,
        clientRequestId: crypto.randomUUID(),
        draftId: null,
        revision: 0,
        state: null,
        match: null,
        analyzedInput: null,
        extraSlotId: null,
      }));
    }
  }, [setComp, user.id]);

  const pickRecent = useCallback(
    async (mealId: string) => {
      rotateIfDrafted();
      const source = recent?.find((m) => m.id === mealId);
      const current = compRef.current;
      if (source && current && current.slotChoice === null && source.planSlotId) {
        const applies = dayInfo?.slots.some((s) => s.id === source.planSlotId);
        if (applies) {
          setComp((prev) => ({
            ...prev,
            slotChoice: source.planSlotId,
            optionId: source.planOptionId,
          }));
        }
      }
      setBusy(true);
      const draft = await ensureDraft('RECENT', { copiedFromMealId: mealId });
      setBusy(false);
      if (draft) adoptDraft(draft, undefined, 'review');
    },
    [adoptDraft, dayInfo, ensureDraft, recent, rotateIfDrafted, setComp],
  );

  const pickPlanned = useCallback(
    async (slotId: string, optionId: string) => {
      rotateIfDrafted();
      setComp((prev) => ({ ...prev, slotChoice: slotId, optionId }));
      setBusy(true);
      const draft = await ensureDraft('PLANNED');
      setBusy(false);
      if (draft) adoptDraft(draft, undefined, 'review');
    },
    [adoptDraft, ensureDraft, rotateIfDrafted, setComp],
  );

  // ── Photos ──────────────────────────────────────────────────────────────
  const addPhotos = useCallback(
    async (files: File[]) => {
      setPhotoBusy(true);
      for (const file of files) {
        try {
          const blob = await prepareImage(file);
          const uploaded = await uploadImage(blob);
          const previewUrl = URL.createObjectURL(blob);
          setComp((prev) => ({
            ...prev,
            photos: [...prev.photos, { ...uploaded, previewUrl }].slice(0, 3),
          }));
        } catch (error) {
          const code = error instanceof PhotoUploadError ? error.code : 'UNEXPECTED';
          toast.error(PHOTO_ERRORS[code]);
        }
      }
      setPhotoBusy(false);
    },
    [setComp],
  );

  const removePhoto = useCallback(
    async (uploadId: string) => {
      const photo = compRef.current?.photos.find((p) => p.uploadId === uploadId);
      if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl);
      setComp((prev) => ({ ...prev, photos: prev.photos.filter((p) => p.uploadId !== uploadId) }));
      await dropStagedUpload(uploadId);
    },
    [setComp],
  );

  // ── Save ────────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    const current = compRef.current;
    if (!current?.draftId || saving) return;
    setSaving(true);
    setSaveError(null);
    // A refine still in flight would bump the revision under the save; a pending one is moot.
    if (refineTimerRef.current) clearTimeout(refineTimerRef.current);
    if (refineFlightRef.current) await refineFlightRef.current;
    if (current.state && hasBlankItem(current.state.items)) {
      setComp((prev) =>
        prev.state
          ? { ...prev, state: { ...prev.state, items: sanitizeItems(prev.state.items) } }
          : prev,
      );
      dirtyRef.current = true;
    }
    const flushed = await flushAutosave();
    const latest = compRef.current;
    if (!flushed || !latest?.draftId) {
      setSaving(false);
      if (!conflict) setSaveError(t('meal.errors.saveFailed'));
      return;
    }
    const result = await safely(() =>
      saveMealAction({
        draftId: latest.draftId,
        expectedRevision: latest.revision,
        clientRequestId: latest.clientRequestId,
      }),
    );
    setSaving(false);
    if (result.ok) {
      if (result.data.droppedPhotos > 0) {
        toast.warning(tp('meal.photosExpired', result.data.droppedPhotos));
      }
      finishAlreadySaved(result.data.id);
      return;
    }
    if (result.code === 'CONFLICT') {
      setConflict(true);
    } else if (result.code === 'OPTION_REQUIRED' || result.code === 'FUTURE_TIME') {
      setSaveError(result.error);
    } else if (result.code === 'NOT_FOUND') {
      setSaveError(result.error);
    } else {
      setSaveError(t('meal.errors.saveFailed'));
    }
  }, [conflict, finishAlreadySaved, flushAutosave, saving, setComp]);

  const reload = useCallback(async () => {
    const current = compRef.current;
    if (!current?.draftId) return;
    const result = await safely(() => getMealDraftAction(current.draftId));
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    adoptDraft(result.data, null);
    setSaveError(null);
  }, [adoptDraft]);

  // ── Back and Start over ─────────────────────────────────────────────────
  const goBack = useCallback(async () => {
    // Pending review edits go first, so the compose fields never race them.
    await flushAutosave();
    setComp((prev) => ({ ...prev, step: 'compose' }));
  }, [flushAutosave, setComp]);

  const startNew = useCallback(
    (request: ComposerRequest): Composition => {
      const now = new Date();
      const todayLocal = localDateFor(now, timeZone);
      const localDate = request.localDate ?? todayLocal;
      const backdated = localDate !== todayLocal;
      const comp = newComposition(localDate, backdated ? null : localTimeFor(now, timeZone));
      if (request.planSlotId) {
        comp.slotChoice = request.planSlotId;
        comp.optionId = request.planOptionId ?? null;
        comp.expandSlotId = request.planSlotId;
      }
      if (!request.localDate && !request.planSlotId && isLateNightWindow(now, timeZone)) {
        comp.step = 'late-night';
      }
      return comp;
    },
    [timeZone],
  );

  /** Discards the server draft, its staged photos and the mirror; a fresh compose step for the same date and slot. */
  const startOver = useCallback(async () => {
    const current = compRef.current;
    if (!current) return;
    analysisRunRef.current += 1;
    refineRunRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (refineTimerRef.current) clearTimeout(refineTimerRef.current);
    dirtyRef.current = false;
    clearMirror(user.id, current.clientRequestId);
    for (const photo of current.photos) if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl);
    const fresh = startNew({ localDate: current.localDate, planSlotId: current.expandSlotId });
    replaceComp(fresh);
    setAnalysis('idle');
    setAnalysisError(null);
    setRefineError(null);
    setSaveError(null);
    setSync('saved');
    setConflict(false);
    setMoreOpen(false);
    void loadDay(fresh.localDate);
    if (current.draftId) await safely(() => discardMealDraftAction({ draftId: current.draftId }));
    // The discard took the photos the draft knew; any added since are still the client's.
    for (const photo of current.photos) await dropStagedUpload(photo.uploadId);
  }, [loadDay, replaceComp, startNew, user.id]);

  // ── Opening ─────────────────────────────────────────────────────────────
  const handleRequest = useCallback(
    (request: ComposerRequest) => {
      void (async () => {
        setOpen(true);
        setAnalysis('idle');
        setAnalysisError(null);
        setRefineError(null);
        setSaveError(null);
        setMoreOpen(false);
        setLastUsed({});
        void loadContext();
        void loadRecent();

        if (request.draftId) {
          const result = await safely(() => getMealDraftAction(request.draftId));
          if (result.ok) {
            replaceComp({
              ...newComposition(result.data.state.localDate, result.data.state.time),
              resumed: true,
            });
            adoptDraft(
              result.data,
              null,
              result.data.state.items.length > 0 ? 'review' : 'compose',
            );
            void loadDay(result.data.state.localDate);
            return;
          }
          toast.error(result.error);
        }

        if (request.reuseMealId) {
          const fresh = startNew({ localDate: request.localDate });
          fresh.step = 'compose';
          replaceComp(fresh);
          void loadDay(fresh.localDate);
          setBusy(true);
          const result = await safely(() =>
            reuseMealAction({
              mealId: request.reuseMealId,
              clientRequestId: fresh.clientRequestId,
              localDate: fresh.localDate,
            }),
          );
          setBusy(false);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          if (result.data.meal) {
            finishAlreadySaved(result.data.meal.id);
            return;
          }
          adoptDraft(result.data.draft, undefined, 'review');
          return;
        }

        const explicit = !!(request.planSlotId || request.localDate);
        const existing = compRef.current;
        if (!explicit && existing) {
          if (existing.draftId) setComp((prev) => ({ ...prev, resumed: true }));
          void loadDay(existing.localDate);
          return;
        }
        if (!explicit) {
          const mirror = readMirror(user.id);
          if (mirror) {
            const restored: Composition = {
              ...mirror,
              photos: mirror.photos.map((p) => ({ ...p, previewUrl: '' })),
              step: mirror.step === 'late-night' ? 'compose' : mirror.step,
              // Fields a mirror written before they existed would lack.
              timeUnknown: mirror.timeUnknown ?? mirror.time === null,
              extraSlotId: mirror.extraSlotId ?? null,
              analyzedInput: mirror.analyzedInput ?? null,
              resumed: true,
            };
            replaceComp(restored);
            void loadDay(restored.localDate);
            if (restored.draftId) {
              const result = await safely(() => getMealDraftAction(restored.draftId));
              if (result.ok && result.data.revision > restored.revision) {
                // Another device (or a finished analysis) moved on: take the server's version.
                adoptDraft(
                  result.data,
                  null,
                  result.data.state.items.length > 0 ? 'review' : restored.step,
                );
              } else if (result.ok && restored.state && restored.step === 'review') {
                dirtyRef.current = true;
                scheduleAutosave();
              } else if (!result.ok) {
                clearMirror(user.id, restored.clientRequestId);
                replaceComp({
                  ...restored,
                  draftId: null,
                  revision: 0,
                  state: null,
                  step: 'compose',
                });
              }
            }
            return;
          }
        }

        const fresh = startNew(request);
        replaceComp(fresh);
        const slots = await loadDay(fresh.localDate);
        if (request.planSlotId) {
          void loadLastUsed(request.planSlotId);
          const slot = slots.find((s) => s.id === request.planSlotId);
          if (slot) {
            const only = slot.options.length === 1 ? slot.options[0].id : null;
            const optionId = request.planOptionId ?? only;
            if (optionId) {
              setComp((prev) => ({ ...prev, optionId }));
              setBusy(true);
              const draft = await ensureDraft('PLANNED');
              setBusy(false);
              if (draft) adoptDraft(draft, undefined, 'review');
            }
          }
        }
      })();
    },
    [
      adoptDraft,
      ensureDraft,
      finishAlreadySaved,
      loadContext,
      loadDay,
      loadLastUsed,
      loadRecent,
      replaceComp,
      scheduleAutosave,
      setComp,
      startNew,
      user.id,
    ],
  );

  useComposerRequests(handleRequest);

  // `?compose=1[&slot=&option=&date=]` opens the composer once, then the params go away.
  const urlHandled = useRef(false);
  useEffect(() => {
    if (urlHandled.current || searchParams.get('compose') !== '1') return;
    urlHandled.current = true;
    const request: ComposerRequest = {
      planSlotId: searchParams.get('slot'),
      planOptionId: searchParams.get('option'),
      localDate: searchParams.get('date'),
    };
    const rest = new URLSearchParams(searchParams.toString());
    for (const key of ['compose', 'slot', 'option', 'date']) rest.delete(key);
    router.replace(rest.size > 0 ? `${pathname}?${rest}` : pathname);
    handleRequest(request);
  }, [handleRequest, pathname, router, searchParams]);

  const answerLateNight = useCallback(
    (yesterday: boolean) => {
      setComp((prev) => {
        const localDate = yesterday ? addDays(today, -1) : prev.localDate;
        return {
          ...prev,
          localDate,
          time: yesterday ? null : prev.time,
          timeUnknown: yesterday ? true : prev.timeUnknown,
          step: 'compose',
        };
      });
      const current = compRef.current;
      if (current) void loadDay(current.localDate);
    },
    [loadDay, setComp, today],
  );

  // ── Derived labels ──────────────────────────────────────────────────────
  const dateSummary = useMemo(() => {
    if (!comp) return '';
    const dayLabel =
      comp.localDate === today
        ? t('meal.compose.summaryToday')
        : comp.localDate === addDays(today, -1)
          ? t('meal.compose.summaryYesterday')
          : formatDate(instantFor(comp.localDate, '12:00', timeZone), { timeZone });
    const timeLabel = comp.time
      ? formatTime(instantFor(comp.localDate, comp.time, timeZone), { timeZone })
      : t('meal.compose.timeUnknownShort');
    return `${dayLabel} · ${timeLabel}`;
  }, [comp, timeZone, today]);

  const backdatedLabel =
    comp && comp.localDate !== today
      ? t('meal.compose.loggingFor', {
          date: formatDate(instantFor(comp.localDate, '12:00', timeZone), { timeZone }),
        })
      : null;

  const dayForDate = dayInfo && comp && dayInfo.date === comp.localDate ? dayInfo : null;
  const slotsForDate = dayForDate?.slots ?? null;
  const recordedSlotIds = dayForDate?.recordedSlotIds ?? [];
  const canReestimate = !!comp?.state && comp.state.items.length > 0;

  const title =
    comp?.step === 'review'
      ? t('meal.review.title')
      : comp?.step === 'late-night'
        ? t('meal.compose.lateNight.title')
        : t('meal.compose.title');

  return (
    <>
      {lastSavedId ? <span data-testid="meal-saved" data-meal-id={lastSavedId} hidden /> : null}
      <ComposerModal
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={comp?.step === 'late-night' ? t('meal.compose.lateNight.body') : undefined}
        leading={
          comp?.step === 'review' ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-ms-2 size-9 shrink-0"
              aria-label={t('meal.review.back')}
              onClick={() => void goBack()}
              disabled={saving}
              data-testid="review-back"
            >
              <ArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden="true" />
            </Button>
          ) : undefined
        }
        actions={
          comp?.step === 'review' && !comp.resumed ? (
            <StartOverButton onClick={() => void startOver()} disabled={saving} />
          ) : undefined
        }
        testId="meal-composer"
      >
        {!comp ? null : comp.step === 'late-night' ? (
          <div className="grid grid-cols-2 gap-3 py-2" data-testid="late-night">
            <Button
              type="button"
              variant="outline"
              className="h-12"
              onClick={() => answerLateNight(true)}
            >
              {t('meal.compose.lateNight.yesterday')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12"
              onClick={() => answerLateNight(false)}
            >
              {t('meal.compose.lateNight.today')}
            </Button>
          </div>
        ) : comp.step === 'review' && comp.state ? (
          <MealReview
            mode="draft"
            state={comp.state}
            onChange={patchReview}
            onAnswered={scheduleRefine}
            match={comp.match}
            slots={slotsForDate ?? []}
            lastUsed={lastUsed}
            otherChosen={comp.slotChoice === OTHER_SLOT}
            extraBecauseRecordedSlotId={comp.extraSlotId}
            photos={comp.photos}
            sync={sync}
            online={online}
            conflict={conflict}
            saving={saving}
            error={saveError}
            refineError={refineError}
            canReestimate={canReestimate}
            onReestimate={() => void runRefine()}
            onSave={save}
            onReload={reload}
            dateSummary={dateSummary}
            today={today}
            timeUnknown={comp.timeUnknown}
            onTimeUnknownChange={(timeUnknown) => setComp((prev) => ({ ...prev, timeUnknown }))}
            resumed={comp.resumed}
            onStartOver={() => void startOver()}
          />
        ) : (
          <MealComposer
            text={comp.text}
            onTextChange={(text) => setComp((prev) => ({ ...prev, text }))}
            photosEnabled={photoEnabled}
            photos={comp.photos}
            photoBusy={photoBusy}
            onAddPhotos={addPhotos}
            onRemovePhoto={removePhoto}
            recent={recent}
            onPickRecent={pickRecent}
            slots={slotsForDate}
            hasPlan={dayInfo?.hasPlan ?? false}
            lastUsed={lastUsed}
            recordedSlotIds={recordedSlotIds}
            onExpandSlot={loadLastUsed}
            onPickPlanned={pickPlanned}
            initialExpandedSlotId={comp.expandSlotId}
            slotChoice={comp.slotChoice}
            optionId={comp.optionId}
            onSlotChange={(slotChoice, optionId) =>
              setComp((prev) => ({ ...prev, slotChoice, optionId }))
            }
            localDate={comp.localDate}
            today={today}
            time={comp.time}
            timeUnknown={comp.timeUnknown}
            onDateChange={(localDate) => {
              setComp((prev) => {
                const isToday = localDate === today;
                return {
                  ...prev,
                  localDate,
                  time: isToday ? (prev.time ?? localTimeFor(new Date(), timeZone)) : null,
                  timeUnknown: !isToday,
                  slotChoice: null,
                  optionId: null,
                };
              });
              void loadDay(localDate);
            }}
            onTimeChange={(time) => setComp((prev) => ({ ...prev, time }))}
            onTimeUnknownChange={(timeUnknown) =>
              setComp((prev) => ({ ...prev, timeUnknown, time: null }))
            }
            resumed={comp.resumed}
            onStartOver={() => void startOver()}
            notes={comp.notes}
            onNotesChange={(notes) => setComp((prev) => ({ ...prev, notes }))}
            dateSummary={dateSummary}
            backdatedLabel={backdatedLabel}
            moreOpen={moreOpen}
            onMoreOpenChange={setMoreOpen}
            analysis={analysis}
            analysisError={analysisError}
            onAnalyze={requestAnalysis}
            onManual={goManual}
            onRetry={requestAnalysis}
            busy={busy}
          />
        )}
      </ComposerModal>
      <AiNoticeSheet
        kind={notice ?? 'MEAL_TEXT'}
        open={notice !== null}
        onOpenChange={(next) => {
          if (!next) setNotice(null);
        }}
        onContinue={() => {
          const kind = notice;
          setNotice(null);
          if (!kind) return;
          setContext((prev) =>
            prev
              ? {
                  ...prev,
                  aiNoticeMealTextShown: prev.aiNoticeMealTextShown || kind === 'MEAL_TEXT',
                  aiNoticePhotoShown: prev.aiNoticePhotoShown || kind === 'MEAL_PHOTO',
                }
              : prev,
          );
          void acknowledgeAiNoticeAction(kind);
          void runAnalysis();
        }}
        onManual={() => {
          setNotice(null);
          void goManual();
        }}
      />
    </>
  );
}
