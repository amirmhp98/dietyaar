# Product specification — Diet adherence companion

Version: 1.7 — owner decisions of September 16, 2026: no password recovery; one plan per user edited in place, no versions; cross-midnight meals follow the chosen date; corrected rubric examples  
Date: September 16, 2026  
Product language: English UI and English system copy; plan and meal input accepted in any language  
Platform: mobile-first responsive web application

## 1. Document status and authority

This document describes the proposed first release, including behavior, user experience, data rules, and acceptance criteria. It is a product specification, not an implementation or a claim that the product has been built or validated.

**Confirmed requirements** come from the product owner's brief: users bring their existing diet; onboarding collects initial profile information; users record food they actually ate, optionally with a photo; AI proposes nutrition information that the user reviews before saving; a focused daily dashboard explains progress; a supportive morning paragraph reflects on yesterday and prepares the user for today; English copy; DeepSeek API; minimal UI, progressive disclosure, reusable components, light/dark modes, mobile-first design, and smooth transitions. Visual styling belongs in a separate `design.md`.

**Additional confirmed decisions:** adherence covers calories/nutrients and the prescribed foods, quantities, timing, and variety in the diet. Nutritionally similar substitutions do not count as following the diet. V1 plan input is text or manual entry only; plan photos/PDFs are deferred. Meal photos remain in scope. The daily paragraph appears inside the app on the first visit of the day; there are no external notifications.

**Further owner-confirmed decisions:** AI estimates the nutritional content of the prescribed diet when numeric values are absent; comparisons must not be strict or punitive; age, sex, height, and current weight are required and may be included as context in AI requests; progress includes both an overall score and dimension-level detail. The daily log-completeness checkbox is checked by default; users uncheck it for days when they have not recorded everything.

**Owner decisions of September 14, 2026 (v1.4):** the audience is adults aged 18 to 45 in the Middle East who follow a diet written by an AI tool, a nutrition specialist, or a doctor. Plan and meal input may arrive in any language, including Persian and Arabic; the application UX, system copy, and daily paragraph stay in English. Dates use the Gregorian calendar. Authentication is a simple username and password with no one-time codes. The product does not consider training, exercise, or day types in this release; exercise-conditional plan instructions are kept as untracked notes. Two real plan samples supplied by the owner (a menu-style plan with several options per meal, and a weekday plan with a fixed meal per day) are the reference formats in section 6.

**Owner decisions of September 16, 2026 (v1.7):** there is no password recovery in this release: no recovery email, no forgot-password form, no reset link, and no email of any kind; a forgotten password loses the account. There is one plan per user, edited in place: no plan versions, effective dates, end dates, previous versions, or per-day plan assignment; editing or replacing the plan changes how every day, past and future, is compared, and the confirm step says so. A meal belongs wholly to the date the user chose for it; a cross-midnight window is not split across dates. Features stay minimal; where this document offered a second mechanism, the simpler one applies.

**Product defaults (v1.4).** The owner delegated the remaining product decisions to the product author. Those decisions are marked “Product default (v1.4)” below. They are binding for implementation until the owner revises them, but do not represent them as owner-approved.

| Decision                               | Default                                                                                                                                                                                                                                                                                                                                               | Status                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Meaning of adherence                   | Compare nutrition plus prescribed foods, portions, order/timing, and explicit variety rules; no substitution recommendations or nutritional-equivalence credit                                                                                                                                                                                        | Owner confirmed                                                         |
| Plan-authorized options                | When a plan offers several options for a meal, any one listed option is the prescribed food for that meal. Mixing items across options, or eating an option from another slot's list, is “Partly matched” with the reason shown                                                                                                                       | Product default (v1.4)                                                  |
| Added items                            | An added amount of a prescribed food is a portion difference. An added item from the calorie-significant categories in section 6 makes the meal “Partly matched” with the reason “Added: …”. Any other addition keeps the status. All added food counts in nutrition totals                                                                           | Product default (v1.6)                                                  |
| Meal slot and plan link                | Saving a meal under a plan slot links it to that slot and evaluates it against the slot's options; “Other” is for food eaten in addition to the plan and is compared on nutrition only                                                                                                                                                                | Product default (v1.6)                                                  |
| Option choice at logging               | For a slot with several options, the last-used option is shown as a suggestion and nothing is preselected; the user chooses the option before saving                                                                                                                                                                                                  | Product default (v1.6)                                                  |
| Difference thresholds                  | Portion within 15% of the prescribed amount, energy within 10% beyond a range boundary, and order/time within 60 minutes are “small”: shown in detail, never changing the status label. Larger differences are described neutrally                                                                                                                    | Product default (v1.4)                                                  |
| Off-plan extra meals                   | Listed under recorded meals, counted in nutrition totals, affect only the nutrition dimension of the score                                                                                                                                                                                                                                            | Product default (v1.4)                                                  |
| Adherence score rubric                 | Per prescribed meal: food match 50, portion 30, order/timing 20. Day score is the mean over recorded prescribed meals, adjusted by at most ±10 for daily nutrition, and always labeled with coverage. Skipped meals count in coverage, not in the score. The number appears once two prescribed meals are recorded; before that only the wording band | Product default (v1.4); owner to confirm before the numeric score ships |
| Variety                                | No separate dimension unless the plan states an explicit rule; weekday assignments are checked by the food dimension                                                                                                                                                                                                                                  | Product default (v1.4)                                                  |
| Training/rest days and exercise        | Not considered; day-conditional and exercise instructions are untracked notes                                                                                                                                                                                                                                                                         | Owner confirmed                                                         |
| Meal slots and order                   | Meal slot names come from the plan as written; when the plan has no clock times, meal order replaces timing                                                                                                                                                                                                                                           | Product default (v1.4)                                                  |
| Per-meal energy ranges                 | Supported and compared per meal; the daily range is the sum of meal ranges when the plan gives none                                                                                                                                                                                                                                                   | Product default (v1.4)                                                  |
| Unquantified items and household units | Labeled regional default portions from a maintained unit table; the review asks a question only for calorie-significant items                                                                                                                                                                                                                         | Product default (v1.4)                                                  |
| In-item alternatives                   | “Boiled or oven potato” style alternatives: either choice is on plan; preparation affects only the nutrition estimate                                                                                                                                                                                                                                 | Product default (v1.4)                                                  |
| Plan lifecycle                         | One plan per user, edited in place; edits and replacements apply to every day, past and future, and the confirm step says so; no versions, effective dates, end dates, or history; no phases; rotations longer than seven days stay unresolved                                                                                                        | Owner confirmed (v1.7)                                                  |
| Plan input                             | Pasted text or manual setup, in any language; plan photos/PDFs deferred                                                                                                                                                                                                                                                                               | Owner confirmed                                                         |
| Morning delivery                       | In-app on the first visit of each day; no push notification and no email of any kind                                                                                                                                                                                                                                                                  | Owner confirmed                                                         |
| Daily log completeness                 | A two-state checkbox, checked by default per day; the user unchecks it if food or drinks are missing. Checked is an assumption, never a confirmation. A past day that is checked but has unrecorded prescribed slots shows its coverage as “log complete by default” and stays out of trends until every slot is recorded or marked skipped           | Owner confirmed; coverage handling is Product default (v1.6)            |
| Dashboard nutrition display            | Daily nutrition totals are collapsed under “Today's nutrition details” within the plan block; no separate always-visible summary card                                                                                                                                                                                                                 | Revised proposal; not an owner-confirmed layout                         |
| Overall progress presentation          | Show an overall adherence score together with food, portion, order/timing, variety, and nutrition detail                                                                                                                                                                                                                                              | Owner confirmed                                                         |
| Missing numeric plan values            | AI estimates prescribed-plan nutrition as a labeled comparison baseline                                                                                                                                                                                                                                                                               | Owner confirmed                                                         |
| Comparison tone and sensitivity        | Gentle descriptive feedback; no strict pass/fail treatment of small differences                                                                                                                                                                                                                                                                       | Owner confirmed                                                         |
| Initial audience                       | Adults 18–45 in the Middle East following a diet written by an AI tool, a nutrition specialist, or a doctor                                                                                                                                                                                                                                           | Owner confirmed                                                         |
| Profile collection                     | Require age, sex, height, and current weight; used only as context in AI requests, never to compute values                                                                                                                                                                                                                                            | Owner confirmed; permitted use defined in section 5                     |
| Nutrition estimates                    | Labeled AI estimates using a maintained regional household-unit table; USDA is a secondary lookup for packaged and generic items only; a curated regional food table is a later accuracy investment                                                                                                                                                   | Product default (v1.4)                                                  |
| Meal photos                            | In scope but not a launch blocker; built behind a server-side flag so V1 can ship with text, manual, recent, and planned-meal logging if photo quality is unproven                                                                                                                                                                                    | Product default (v1.4); flag mechanism v1.6                             |
| Loggable entries                       | Anything with calories, including sweetened tea and coffee with milk; plain water is not logged; supplements are out of scope                                                                                                                                                                                                                         | Product default (v1.4)                                                  |
| Language display                       | Food and meal names appear as the user wrote them with an English label beneath; right-to-left text renders inside the left-to-right layout; all system copy and the daily paragraph are English                                                                                                                                                      | Owner confirmed (English UX); display detail Product default (v1.4)     |
| Calendar and week                      | Gregorian dates; weekly rule periods start on the first weekday the plan lists, otherwise Saturday, editable in Settings; fasting periods are out of scope                                                                                                                                                                                            | Owner confirmed (Gregorian); rest Product default (v1.4)                |
| Authentication                         | Username and password only; no recovery email, no password reset, no OTP, email code, or social sign-in. A forgotten password cannot be recovered in this release, and sign-up and Settings say so in one line                                                                                                                                        | Owner confirmed (v1.7)                                                  |
| First-release business model           | No payment or subscription flow                                                                                                                                                                                                                                                                                                                       | Proposed scope                                                          |
| Product identity and visual system     | Product name, brand, component library, tokens, and detailed layouts are defined in `design.md`                                                                                                                                                                                                                                                       | Not supplied yet                                                        |

The detailed requirements use the confirmed choices and product defaults consistently. Later owner decisions supersede this document. `product-spec.md` owns product behavior; `design-scope.md` is the screen inventory derived from it and fixes what each screen shows and does; `design.md` owns visual treatment and component selection. A screen or action in `design-scope.md` that this document does not define is a gap to resolve here first, not a new source of behavior. None of the three files should silently override another.

## 2. Product purpose

Help a person following an existing diet understand how their actual eating compares with that plan and make one useful next decision, with very little daily effort.

The core question is: **“Based on what I have recorded, how does today compare with my plan, and what should I pay attention to next?”**

The product follows a user's plan. It does not create a replacement diet, infer a calorie deficit from profile information, or treat lower intake as automatically better. Diet adherence and changes in body weight are distinct concepts.

### Core jobs

- Bring an existing plan, written in any language and often as a menu of options per meal, into a readable, editable form without rebuilding it manually.
- Record an actual meal quickly and correct uncertain food or portion estimates.
- See meaningful differences between recorded intake and the confirmed plan.
- Return the next morning to a factual, kind reflection and a manageable focus for today.
- Correct an old entry or change the plan without corrupting previous records.

### Product principles

1. Logging is the primary action. Reports must never obstruct it.
2. Show the minimum information needed for the next decision; keep useful detail one intentional action away.
3. AI proposes interpretations. Users confirm records. Application logic calculates totals and comparisons.
4. Make missing information visible. An empty log is not evidence of zero food intake.
5. Explain estimates without pretending to know exact ingredients or portion sizes from a photograph.
6. Support consistency without shame, punishment, or pressure to compensate for yesterday.
7. Reuse the design system before introducing a new UI pattern.

## 3. Release scope

### Included in the first release

Username/password account access; resumable onboarding; basic profile; importing and confirming an existing diet from text/manual entry in any language, including menu-style plans with options per meal and weekday plans; a readable plan; text/photo/manual meal logging; editable nutrition review; recent-meal reuse; logging a planned meal as eaten; meal edits and deletion; backdated records; Today dashboard with an overall adherence score; day completeness setting; date-based history and a compact seven-day view; daily in-app message; system/light/dark appearance; privacy settings, data export, and account deletion.

### Deferred

Plan-photo/PDF imports, push notifications and email of any kind, AI-generated diets, food-substitution suggestions, open-ended coaching chat, recipe discovery, shopping lists, food delivery, barcode scanning, voice input, wearables, training/rest day types, exercise-conditional meals, exercise-calorie adjustments, fasting-period handling, supplement tracking, phone OTP and social sign-in, a curated regional food database, multi-week plan phases and rotations, social feeds, leaderboards, streak rewards, clinician accounts, medical treatment workflows, subscriptions, native mobile apps, and fully offline AI processing. Do not add water, exercise, or weight widgets to the default dashboard merely because they are common in nutrition apps.

Weight can be updated in the profile, with a measurement date. A weight-loss forecast or weight-trend dashboard is outside this release.

## 4. Navigation and screen structure

Use three primary destinations: **Today**, **History**, and **My plan**. A profile button opens account and preferences. **Log meal** remains easy to reach from all three destinations, using the same label and interaction pattern.

On mobile, use a compact bottom navigation and a thumb-accessible logging action. On larger screens, preserve the same information hierarchy rather than filling available space with additional reports.

| Surface      | Main purpose                                   | Essential content                                                                  |
| ------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| Onboarding   | Reach a confirmed plan and first useful action | Profile, plan import/review, completion                                            |
| Today        | Understand today and record food               | Morning paragraph, plan comparison, next planned meal, recorded meals              |
| Log meal     | Record actual intake                           | Description/photo/recent/plan entry; review; save                                  |
| Meal details | Understand or correct a saved entry            | Foods, portions, nutrition, estimate sources, time, edit/delete                    |
| My plan      | Read and maintain the plan                     | Schedule, goals, rules, source, edit/replace                                       |
| History      | Review a previous day or a short pattern       | Date selector, daily detail, seven-day summary                                     |
| Settings     | Manage personal preferences and data           | Profile, display name, units, time zone, week start, appearance, password, privacy |

No separate report center or chat home screen is required.

## 5. Onboarding

### Flow

1. **Welcome and account access.** One brief value statement and a clear start action. Create an account with a username and password, or sign in. Username: 3–30 characters, letters, digits, underscore, case-insensitive, unique. Password: at least 8 characters, a show/hide toggle, no forced complexity rules, checked against a common-password list. There is no password recovery in this release: no recovery email, no forgot-password form, no reset link. A forgotten password loses the account and its records, and the sign-up form and Settings each say so in one line. No one-time codes, email verification, or social sign-in. Sessions persist on the device until logout.
2. **About you.** Require age in years, sex, height, and current weight before completing onboarding. Sex offers two options, female and male. Let users choose measurement units; metric is the default for this audience. Confirm the time zone detected from the device. An optional display name is used in greetings; otherwise the username is used. Explain that this profile provides context for AI estimates and personalized reflections. The four required fields cannot be skipped. Do not ask for exact birth date, address, or a comprehensive medical history. Preserve partially completed steps and allow users to edit these values later. Onboarding asks one thing per screen and nothing optional beyond the display name: an optional plain-language goal and optional dietary restrictions live in Settings, not in onboarding. The goal is shown back on My plan only and is not sent to AI. Restrictions are used only for a neutral reminder in meal review when a recorded ingredient matches.
3. **Add your plan.** Paste text in any language or enter the plan manually. Briefly explain that AI will prepare pasted text for review and that the app works in English while keeping food names as written. Show a short example in the user's likely language, including one meal with several options. Do not show inactive photo/PDF controls in V1. Before the first import, show the AI-processing notice from section 15 once: one calm sentence that the pasted plan is sent to an AI provider to be read, with **Continue** and **Set up manually**. Text over the 20,000-character limit is kept on screen with a count and a suggestion to paste the plan in parts.
4. **Review your plan.** Confirm the extracted meals, their options, schedule, portions, per-meal and daily targets, and rules, one section at a time. Show uncertainties and the original source alongside the relevant section. Resolve consequential ambiguities before activating those rules. Instructions that depend on training or rest days, exercise, or other conditions the app does not track appear under “Not automatically tracked” with a one-line explanation. Each review section shows the excerpt of the source text it was extracted from, so the user can compare without leaving the screen. Each rule offers three choices: **Track it**, **Keep as a note**, or **Don't compare**; a conflicting or mutually exclusive instruction is shown at the rule with the same choices, and an unsupported schedule such as a rotation longer than seven days is kept as a note until the user converts it. Review must not become a wall of corrections: every unknown gets a labeled default, only calorie-significant unknowns produce a question, a weekday plan is reviewed for one day and then confirmed for the remaining days from a summary, and the user can confirm now and fix anything later from My plan. If the import is still running after 15 seconds, the user can continue to Today. Today then shows one of three import states: “We're still preparing your plan,” “Your plan is ready to review” with **Review now**, or “We couldn't prepare your plan” with **Try again** and **Set up manually**. A failed or timed-out import keeps the pasted text, and the user can log meals meanwhile.
5. **Ready for today.** Show a short confirmation, today's plan, and “Log your first meal.” Explain briefly that a new reflection will be waiting on each day's first visit; no notification setup or permission request.

Use compact groups of related fields, a truthful step indicator, back navigation, and autosaved progress. Preserve input after a failed request, refresh, or interrupted session. Numeric fields use suitable mobile keyboards and accept Persian and Arabic digits; unit changes convert existing values without reinterpreting them.

Age, sex, height, and current weight may be included as context in two AI requests only: plan interpretation and daily reflection. Their permitted use is narrow: the model may use them to phrase the reflection appropriately and to flag an implausible plan interpretation for review, such as a per-meal figure that is off by an order of magnitude. Explain this during onboarding. These fields do not change the nutritional composition of an identical food/portion, must not be used to fabricate personalized food nutrient values, and are not sent with meal-photo or food-identification requests. Profile information does not automatically change the imported plan. Do not infer a medical condition or use sex, age, or body size to generate nutritional targets. Allergies or dietary restrictions are an optional Settings field whose only purpose is a neutral reminder in meal review when a recorded ingredient matches; the reminder never blocks saving, and the product does not promise that photo analysis can verify their absence.

If the user has no plan ready, let them save onboarding and enter a limited logging experience. Label comparisons “Add a plan to see how your meals compare.” Do not invent targets. Manual plan setup starts by choosing the plan's structure, **Same plan every day**, **Different plan by weekday**, or **Nutrition targets only**, and then asks only for what that structure needs. A confirmed daily target alone, or one daily meal schedule, is a valid minimal plan.

Eligibility: the user must be at least 18. Age is the first onboarding question. An age below 18 stops onboarding with a plain message, creates no health profile, and offers one-tap account deletion without a further confirmation loop. Ages above 45 are outside the target audience but are not blocked.

### Acceptance criteria

- A returning user resumes the last incomplete step with previous values intact.
- Changing display units preserves equivalent measurements.
- Onboarding cannot complete without age, sex, height, and current weight; partial input is preserved. The optional display name does not block completion; goal and restrictions are set later in Settings.
- The AI-processing notice appears once before the first plan import and can be declined in favor of manual setup.
- A failed or timed-out import is reported on Today with retry and manual options and keeps the pasted text.
- A greeting uses the display name, or the username when none is set.
- An age below 18 cannot complete onboarding and stores no health data.
- No target becomes active until the user confirms it.
- An unavailable AI service does not prevent manual plan entry.
- Sign-up requires only a username and password; there is no forgot-password form, and sign-up states that a forgotten password cannot be recovered.
- Onboarding includes no notification permission request or external delivery setup.

## 6. Diet input and normalized plan

### Supported inputs

Pasted text in any language, with a proposed application limit of 20,000 characters per import, or manual entry. Persian, Arabic, and Western digits are all accepted and normalized. Provide a useful text example, preserve the original content, and make long plans readable in sections. Reject over-limit text with an actionable message without discarding it.

Manual setup begins with the plan's structure, **Same plan every day**, **Different plan by weekday**, or **Nutrition targets only**, and then collects only what that structure needs: slots in order, items per slot, optional options and in-item alternatives, optional meal times or windows, optional per-meal energy ranges, daily targets, rules, and a source note. It is not limited to a calorie-goal form. A target-only plan skips slots entirely, is valid, and supports nutrition comparison only. Plan photo/PDF upload and OCR are deferred; do not build them into onboarding or its backend requirements.

### Reference plan formats

Two owner-supplied Persian plans define the formats V1 must handle well. Both use grams for most items, household units for some (“a glass of low-fat milk”, “a teaspoon of olive oil”), unquantified vegetables (“cucumber and tomato”, “large salad”), regional foods (sangak bread, joojeh kabab, adasi, kabab tabei), and approximate energy figures.

1. **Menu plan.** Five meal slots per day: breakfast, first snack, lunch, second snack, dinner. Each slot has an approximate energy range and two to five numbered options; the plan says to choose one option per slot. One instruction depends on training versus rest days.
2. **Weekday plan.** Saturday through Friday, each day labeled with a day type and an approximate daily energy figure. Each day has five named slots; slot names vary by day (“pre-workout” on some days, “afternoon snack” on others). Some items contain alternatives such as “boiled or oven potato” or “kabab tabei or homemade burger”.

Neither plan gives clock times. Most plans for this audience will not.

### Plan contents

- Name, source (AI tool, nutrition specialist, doctor, or other, as a free-text note), and source language.
- Daily schedule or repeating seven-day schedule. Weekday order follows the plan as written; the first listed weekday sets the week start for weekly rules, otherwise Saturday. Optional meal times/windows.
- Meal slots named as the plan names them, with an English label alongside, in plan order. Slot names are not a fixed list; “pre-workout” and “afternoon snack” are both valid slot names.
- Planned meals with prescribed foods, quantities, units, and preparation notes. Each food keeps its original name and an English label.
- **Meal options.** A slot may list several options. Every listed option is a prescribed food for that slot; the user is not asked to pick one at import. Options are shown as a compact list under the slot, and the user picks which option they ate at logging time.
- **In-item alternatives.** An item such as “boiled or oven potato” or “kabab tabei or homemade burger” stores both alternatives; either is on plan. The chosen alternative only changes the nutrition estimate.
- Per-meal energy ranges or figures, when the plan gives them, and explicit daily nutritional targets: energy in kcal; protein, carbohydrate, fat, and optional fiber in grams; optional sodium in mg. When the plan gives per-meal ranges but no daily figure, the daily range is the sum of the meal ranges and is labeled “Sum of your meal ranges”.
- A target's meaning: desired amount, range, minimum, approximate figure, or maximum. Preserve this distinction. “About 2,200 kcal” is an approximate figure, treated as a desired amount with the 10% small-difference threshold.
- Food/behavior rules such as a specified serving, an explicitly stated exclusion, or a meal instruction.
- Explicit timing windows and variety/frequency requirements, including their applicable period (day or anchored calendar week), food/group definition, and exact counting rule.
- **Untracked notes.** Instructions conditioned on training or rest days, exercise, sleep, fasting, or anything else the app does not record. They are kept verbatim under “Not automatically tracked” and never evaluated. A weekday plan whose days carry a day-type label keeps the label as a note only.
- The original source and provenance for extracted fields.

V1 supports daily and weekly repetition. More complex cycles or ambiguous schedules are shown as unresolved source notes until the user converts them to a supported schedule. Do not silently flatten a rotation into one repeated day.

### Household units and unquantified items

Maintain a regional unit table used by both plan and meal estimation: glass 240 ml, cup 200 ml, teaspoon 5 ml, tablespoon 15 ml, one medium apple 180 g, one small banana 100 g, one date 8 g, one slice of sangak 80 g, and similar entries with a source note. Items with no quantity get a labeled default: “cucumber and tomato” as 150 g, “large salad” as 200 g of mixed raw vegetables, and so on. Defaults are shown as “Assumed” in review and editable. During plan review, ask a question only when an unquantified item is calorie-significant, meaning oil, bread, rice, potato, nuts, dairy, or meat; do not ask about raw vegetables or herbs.

### Review rules

- Distinguish information explicitly stated in the source from an inferred interpretation.
- If the plan says “one bowl,” preserve that unit and request a usable portion interpretation when needed; do not invent a precise weight without disclosure.
- If the plan contains food instructions but no numeric nutrition values, AI estimates each prescribed meal and its daily nutrient totals from the prescribed foods and portions. Show these as “Estimated from your plan” during plan review and use the confirmed estimates as the comparison baseline. This describes the supplied diet; it does not create a new diet or derive a calorie deficit from the health profile. Explicit source targets take precedence for each nutrient where supplied. Keep estimated meal totals and explicit targets distinguishable if they disagree.
- Reuse the meal-estimation rules for planned food: sources, portion assumptions, unknowns, editable values, and no false precision. Ask about material missing portions; do not manufacture a baseline for an unquantifiable meal. Plan confirmation includes review of its estimated baseline. Store that baseline with the plan and recalculate it when its prescribed foods/portions change, rather than silently changing historical comparisons on every AI call.
- Compare amounts gently and descriptively. Do not make users configure tolerance bands during onboarding; the product-wide thresholds in section 8 apply. A small portion, nutrient, or timing difference must not trigger a failure label, alarm, or corrective instruction. Do not treat an AI-estimated baseline as an exact clinical target. Score weights come from the section 8 rubric; do not invent penalties.
- Show conflicting targets or mutually exclusive instructions at the relevant location. The user can correct them, retain them as notes, or exclude them from automated comparison.
- Only supported, resolved, confirmed rules participate in automated comparisons. Other notes remain visible under “Not automatically tracked.”
- Preserve stated times/windows, but use them as context for gentle observations rather than strict deadlines. Small timing differences stay in expanded detail and do not trigger warnings. Do not require timing tolerance setup or invent timing requirements where the plan has none.
- A vague rule such as “eat a varied diet” is not a measurable target. Ask for clarification or retain it as a note. Support explicit rules such as a specified food on named weekdays, a serving count over a stated period, or a confirmed count of distinct food groups.

“Confirm plan” applies the reviewed draft to the plan. A pending import or an edit in progress is a draft and does not change the plan until confirmed; the user can log meals against the current plan meanwhile.

### Editing and replacing

There is one plan per user, in effect until it is edited, replaced, or deleted; it has no start date, end date, or version. Editing (a correction to a portion or a name) and replacing (importing or entering a new plan) both go through review and confirm, and both apply to every day, past and future: earlier days are compared against the updated plan. Before confirming, show in one line how many past recorded meals are linked to changed slots: “Past days will be compared against the updated plan · 3 meals affected.” Meal records remain intact; a meal whose slot no longer exists becomes “Other”, and a meal whose chosen option no longer exists shows “Needs review · Choose option”. There is no version history and no re-activation of an earlier plan.

If the user deletes the plan, continue logging without comparisons and show “Add your plan.”

### Acceptance criteria

- Source text and extracted values can be compared before confirmation.
- A Persian menu plan imports with every option preserved under its slot, per-meal ranges, original food names with English labels, and the training-day instruction under “Not automatically tracked”.
- A Persian weekday plan imports with Saturday as the first day, day-specific slot names, and day-type labels kept as notes only.
- Importing a new draft leaves existing totals and the active plan unchanged.
- A food-based plan receives an editable, labeled AI-estimated nutrition baseline where portions are usable; explicit source targets retain priority and unknowns remain visible.
- Unsupported or unresolved instructions are not reported as achieved or violated.
- Confirming an edited plan re-compares earlier days, and the confirm step states how many meals are affected.

## 7. Recording actual meals

### Main flow

**Open Log meal → provide food input → review foods and portions → Save meal.**

The composer presents a description field and a photo action, with compact access to recent meals and today's planned meals. Do not make users choose among several large competing workflows before entering food. Before the first text analysis, and again before the first photo analysis, show the section 15 AI-processing notice once as a small sheet with **Continue** and **Enter manually**; it never appears again for that kind of input.

Support:

- Text only, in any language: “Two eggs, one slice of toast, and coffee with milk” or “۲ تخم‌مرغ، ۸۰ گرم نان سنگک و یک لیوان شیر”.
- Photo only: attach or capture food, then clarify important missing information.
- Photo plus text: useful for hidden ingredients or quantity corrections.
- Recent meal: reuse a previous confirmed entry, with editable portions.
- Planned meal: “I ate this.” When the slot has several options, the user picks the option first, then confirms what was actually eaten. The last-used option for that slot is marked “Last time” as a suggestion, but nothing is preselected; the review cannot be saved until an option is chosen. The prescribed portions prefill the review.
- Manual entry: food name and portion, with optional known nutrition values.

What counts as an entry: anything with calories, including sweetened tea, coffee with milk, juice, and dates eaten alone. Plain water is not logged and has no widget. Supplements are out of scope. Food names are stored as the user wrote them; the review shows the original name with an English label beneath, and right-to-left text renders correctly inside the English layout.

Meal-photo input accepts one to three JPEG, PNG, WebP, or HEIC images per meal, with a proposed 10 MB limit per image. Convert HEIC to a provider-supported image format, validate real file contents, strip unnecessary metadata, and provide preview/remove controls. Multiple photos show the same meal from different angles unless the user explicitly identifies additional food; never automatically count each photo as another serving. These application limits are separate from provider limits. Photo logging is in scope but is not a launch blocker: if the photo model fails the section 13 evaluation, V1 ships with the photo action hidden and the other five paths intact, and the photo action is added when the evaluation passes.

The default consumed time is now, initialized when the composer opens. Between local midnight and 04:00, the composer first asks “Was this for yesterday?” with yesterday and today as equal choices, so a late dinner does not land on the next day unnoticed. Always show a compact date/time summary near the save action. Put editing date/time, meal slot, and notes under **More details**. The meal slot list comes from the active plan's slots for that day, plus “Other”; a target-only plan offers breakfast, snack, lunch, and dinner. Choosing a plan slot links the meal to that slot, so it is compared with the slot's options and shown on that row of Today; “Other” is described in the picker as “in addition to your plan” and is compared on nutrition only. A future consumed time cannot be saved; the composer says so and keeps the draft. On a past-day page, initialize the composer to that date and show a prominent “Logging for [date]” context; do not hide that fact inside an accordion.

For a backdated record, ask the user to confirm the consumed time or choose “I don't remember the time”; never silently reuse the current clock time for that earlier day. Save a known date with an unknown time if needed, retaining food/nutrition comparison but leaving timing unevaluated. Do not invent a timestamp such as noon or midnight to represent an unknown time.

Required corrections, uncertain portions, unsaved status, and important errors must remain visible. Progressive disclosure is for optional detail, not information needed to save accurately.

### AI review

Display the identified food items, editable portions, and estimated meal totals. The first view shows energy, protein, carbohydrate, and fat; other available nutrients and sources expand on demand.

The user can add/remove foods; change preparation, quantity, and unit; choose an alternative identification; or enter known label values. Editing a quantity recalculates the affected totals. Editing identity or preparation requires refreshed estimates, but must preserve user-entered overrides and explain what changed.

A photo of a shared dish does not establish how much the user ate. When necessary, ask a focused question such as “How much of this dish did you eat?” Hidden oil, sauces, ingredients, and portion weights remain assumptions until clarified. Group essential questions on the review screen instead of starting an endless chat.

Use plain uncertainty messages, such as “Portion size needs a quick check.” Do not display an uncalibrated confidence percentage. Mark nutrient values “Estimated” where applicable. Unknown values stay unknown; they are never converted to zero.

If a recorded item matches a restriction the user entered in Settings, the review shows one neutral line naming the item, for example “Contains walnuts, which is on your restrictions list.” It does not block saving, does not judge, and does not claim that other items are free of it.

Nutrition preference order: an explicit user-entered label value; a suitable traceable food-data match scaled to the confirmed portion; an identified recipe calculation where ingredients are known; or a clearly labeled AI estimate. Save provenance with each item. A database match still does not prove that a pictured dish has the matched recipe or quantity.

Allow a user to save a food record with incomplete nutrition after a visible notice. This records that the food was eaten; incomplete nutrients do not become valid daily totals. Unresolved critical quantity information must either be corrected or explicitly saved as unknown.

### Confirmation and persistence

AI analysis creates a draft only. **Save meal** is the explicit confirmation boundary. Drafts do not affect intake totals, adherence, or morning feedback.

Record states: draft → analyzing → review → saving → saved. Analysis failure returns to an editable draft; save failure preserves the reviewed content. Show success only after durable server confirmation. A retry or double tap must not create a duplicate record.

Saved meals are editable. Updates and deletions recalculate the affected day immediately. Deletion uses a concise confirmation naming the meal. Reusing a meal copies its values to a new draft; it does not modify the original. Changing an old meal does not silently overwrite other entries copied from it. If another device saved a newer revision of the same meal, the save is refused with “This meal was updated on another device” and a **Reload** action; the user's edits stay on screen.

Future intake cannot be saved as eaten. Keep it as a draft or use the existing plan. For first release, schedule planning occurs through My plan, not through an additional future-meal system.

### Speed and recovery

For a routine recent/planned meal, aim for review and save without a new AI call. Offer manual logging if AI is slow or unavailable. Never require the user to wait for the morning-message system before recording food.

Preserve an in-progress form through temporary connectivity loss. Clearly label unsynced content and require server acknowledgement before calling it saved. Do not silently send health records in the background after logout or from another account's session.

### Acceptance criteria

- A text-only meal and a photo meal can both reach an editable review.
- The AI-processing notice appears once before the first text analysis and once before the first photo analysis, each with a manual alternative.
- A planned meal with several options cannot be saved without a chosen option; no option is preselected.
- No AI output changes totals before confirmation.
- A recorded item that matches a Settings restriction shows a neutral reminder that does not block saving.
- Correcting a portion updates the meal and day consistently.
- Saving twice or retrying after a timeout creates at most one meal.
- An old date is visible before confirmation, and its meal appears on that day.
- Camera denial still permits upload, text, recent-meal, and manual paths.
- AI failure preserves input and exposes retry/manual actions.
- Editing or deleting yesterday's entry updates yesterday's comparison.

## 8. How comparison works

### Separate three concepts

1. **Recorded intake:** confirmed food and available nutrition values.
2. **Comparison with the plan:** deterministic comparisons against the day's confirmed targets and rules.
3. **Log completeness:** a per-day setting, checked by default, that users can turn off when food or drinks are missing. The default is an assumption, not an explicit user confirmation.

Show both an **overall plan-adherence score** and the underlying dimension-level observations. The score summarizes alignment with the user's confirmed diet; it is not a health score, nutritional adequacy rating, or measure of personal success. It must never replace the explanation of food, portion, order/timing, variety, and nutrition.

### Difference thresholds (product-wide, rubric v1)

These thresholds are fixed in V1, not user-configurable, and versioned with the rubric. A “small” difference appears only in expanded detail and never changes a status label.

| Dimension                            | Small                                                               | Noticeable                                                            | Large                                                   |
| ------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| Portion of a matched item            | Within 15% of the prescribed amount                                 | 15–30% more or less: “A bit more than planned (92 g instead of 80 g)” | Beyond 30%: “More than planned (160 g instead of 80 g)” |
| Energy against a range               | Inside the range, or an approximate figure within 10%               | Beyond the nearer boundary by up to 10%: “Slightly above your range”  | Beyond that: “Above your range by 310 kcal”             |
| Time against a stated time or window | Within 60 minutes                                                   | 60–120 minutes: “Later than planned”                                  | Beyond: same wording with the amount                    |
| Order when the plan has no times     | Eaten in plan order relative to the other recorded prescribed meals | Out of order: “Eaten before lunch”                                    | No large band                                           |

Unknown quantities or times are “Not evaluated”, never zero and never a difference.

### Matching a recorded meal to a plan with options

AI suggests the slot and, within the slot, the option with the highest item overlap; the user confirms. Raw vegetables and herbs listed without a quantity do not count toward matching and never break a match. Given the slot's chosen option:

- **Matched:** every counted item of the option is present and no calorie-significant item was added. In-item alternatives count as present for either choice. Extra raw vegetables are ignored.
- **Partly matched:** at least half of the counted items are present, the items are combined from two options of the same slot, the meal is a full option from another slot of the same plan, or a calorie-significant item was added. The detail names the reason: what is missing, that items were mixed, “This is a lunch option”, or “Added: …”. A cross-slot option receives no credit for the other slot.
- **Different food:** fewer than half of the counted items are present, or the food is not in the plan at all.
- **Added item:** an added amount of a prescribed food is a portion difference, not an added item. An added item from the calorie-significant categories in section 6 (oil, bread, rice, potato, nuts, dairy, meat) turns Matched into Partly matched with the reason “Added: …”. Any other addition, such as raw vegetables, herbs, or condiments, keeps the status. All added food counts in nutrition totals.

A meal saved under a plan slot is always evaluated against that slot: if nothing in it matches any option, the slot shows “Different food”. A meal saved under “Other” is food eaten in addition to the plan; it is never matched to a slot and cannot stand in for one. This keeps the two honest paths distinct: “I ate something else for lunch” is the lunch slot with a different food, and “I also had a snack” is Other.

### Adherence score rubric v1

The score is computed by application logic from confirmed records, the current plan, and this rubric. It is versioned as “rubric v1”, and every displayed score carries the rubric version and the record revisions it used. A target-only plan has no score; it shows nutrition comparison only.

**Per prescribed meal** with a confirmed recorded meal, out of 100:

| Component       | Weight | Full                                              | Half                  | None             |
| --------------- | ------ | ------------------------------------------------- | --------------------- | ---------------- |
| Food match      | 50     | Matched                                           | Partly matched        | Different food   |
| Portion         | 30     | Mean over counted matched items: small difference | Noticeable difference | Large difference |
| Order or timing | 20     | Small                                             | Noticeable            | Large            |

A component that cannot be evaluated (unknown quantity, unknown time, or a single recorded meal with no order reference) is left out, and the meal score is the sum of the scored components divided by the sum of their weights. A prescribed meal the user explicitly **marked skipped** is not scored; it counts in coverage as “1 skipped” so honesty never lowers the number. A prescribed meal with no recorded meal is not scored; it shows “No matching meal recorded”.

**Day score:** the mean of scored prescribed meals, weighted 90, plus a nutrition component weighted 10: full when daily energy is within the daily range or approximate figure, half when slightly beyond it, none otherwise. The nutrition component is evaluated only on a past day treated as complete with complete energy data; otherwise it is left out and the day score is normalized over the meal component alone. Off-plan extra meals enter nutrition totals and therefore only this component. Macro targets, when explicit, appear in nutrition details but do not enter the score in V1.

**Display:** an integer 0–100 with a coverage label such as “Based on 3 of 5 prescribed meals · 1 skipped”, and a “Why this score” expansion listing each meal's components. Neutral wording bands: 85 and above “Closely followed”, 60–84 “Mostly followed”, below 60 “Different from your plan”. The number is shown only once at least two prescribed meals are scored; with one scored meal, show the wording band and coverage without the number. No letter grades, no colors keyed to the number, no comparison with other users. Show “Not enough information yet” when no prescribed meal is scored. On today the card carries an “In progress” label until local midnight. When every slot is recorded or marked skipped, the plan block offers **Log another meal** instead of a next slot.

Owner-aligned constraints that the rubric and its future revisions must keep:

- Gentle treatment of differences: no binary all-or-nothing meal failure, no score drop for small variation, and no alarming red grade or shame-based copy.
- Matching calories cannot erase a different prescribed food; substitutions remain visible and receive no prescribed-food equivalence credit.
- Missing logs or unknown values must not become failures, successes, or hidden zeroes. Label any usable partial assessment “Based on recorded meals”; show “Not enough information yet” where coverage is inadequate.
- Order and timing remain visible as descriptive context; there are no minute-by-minute penalties. Variety follows only explicit plan requirements.
- Show which dimensions and records contributed, what was excluded, and whether each baseline is explicit or estimated. A portion difference appears once, in the portion component; the day's energy total, which that portion also affects, enters only the separate nutrition component and is never shown as a second portion difference.
- AI can interpret foods and explain the result, but cannot choose a fresh opaque score on every request.

The owner has not yet reviewed these weights. Ship the score behind the rubric version so a revised rubric can recompute history without changing records.

### Day completeness

Display a small per-day checkbox labeled **I've logged everything for this day**, checked by default. Add concise helper text: **Uncheck this if you haven't recorded everything.** The checkbox has exactly two states, checked and unchecked; the app does not record whether a checked state was the default or a user action, because a control that starts checked cannot express a deliberate confirmation. No daily confirmation, mandatory prompt, or explanatory note is required. Users can change this setting from Today or the relevant day in History. On a past day that is checked but has unrecorded prescribed slots, the helper line reads **2 of 5 meals recorded. Mark the rest skipped if you didn't eat them.** so the user has one clear way to finish the day without a second confirmation.

Persist an explicit choice for that date across visits and devices. Unchecking one date does not change the checked default for other dates. Adding, editing, or deleting a meal does not reset the setting, and does not request reconfirmation. After adding missing meals, the user can check it again deliberately; saving a meal must not silently override an unchecked choice.

Keep the setting separate from whether the calendar day has ended:

- **Today:** remains **In progress** even when checked. Show progress based on recorded meals; do not judge the entire day before local midnight.
- **Past day, checked, at least one saved meal:** assume the log is complete for daily comparison and next-day reflection, subject to usable nutrient/rule data. No additional click is required. This assumption can be wrong if the user forgot to uncheck the box; the app does not claim to detect missing meals automatically. To soften that case: when the checkbox is checked and fewer prescribed meals were recorded or marked skipped than the plan lists, the day is still treated as complete, but its score label reads “Based on 2 of 5 prescribed meals · log complete by default”, unrecorded slots stay “No matching meal recorded”, and the day is excluded from seven-day trend denominators. Recording or marking skipped every remaining slot removes the “by default” wording and includes the day in trends; there is no separate confirmation step.
- **Any day, unchecked:** mark **Incomplete log** and limit feedback to recorded meals. Exclude it from complete-day scores and trend denominators; do not treat missing entries as failures.
- **No saved meals:** show **No meals recorded**, even when checked. The default cannot turn an empty log into evidence of zero intake or a positive/negative full-day adherence score.

Because checked is the default, AI facts and explanations must never say the user confirmed completeness; “checked” is an assumption in every case. Day completeness never turns unknown nutrient values or consumed times into known ones.

Changing completeness recalculates eligible comparisons and history summaries, and marks any reflection based on the old setting stale only if a comparison fact it used changed. Offer the existing **Update reflection** action. Do not reset the checkbox after recalculation.

### Nutritional comparisons

Compare confirmed intake to an explicit source target where supplied, otherwise to the confirmed AI-estimated prescribed-plan baseline for that nutrient. Label the baseline source wherever it is displayed and do not pretend an estimate is a prescribed exact number. Estimated baselines use signed descriptive differences, not inferred minimum/maximum rules. Only confirmed records count. For each nutrient, calculate a known subtotal and track whether every included food has a usable value. If any value is missing, label the subtotal incomplete and suppress definitive daily target status for that nutrient.

| Target type      | Past day treated as complete, with complete nutrient data                 | Ongoing day or explicitly incomplete log                                   |
| ---------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Range [L, U]     | Below range if x < L; within range if L ≤ x ≤ U; above range if x > U     | Show recorded amount and range; never call an unfinished day deficient     |
| Minimum L        | Below target if x < L; target met if x ≥ L                                | Show progress so far; a met amount is not proof of full-day adherence      |
| Maximum U        | Within limit if x ≤ U; above limit if x > U                               | Show recorded amount; an exceeded recorded limit may be stated as such     |
| Desired amount T | Show signed difference x − T; no pass/fail treatment of small differences | Show recorded amount versus target, without projecting the rest of the day |

Use neutral terms, not rewards for eating less. Never subtract exercise, carry an excess into tomorrow, or create a compensatory restriction. Comparisons describe the confirmed plan; they do not certify its suitability.

### Meal and rule comparison

A saved meal can be linked to a planned meal. AI may suggest which scheduled slot and which option it belongs to; the user confirms the link and actual food/portion details. Similar calories or macros never make a different food count as the prescribed food. Do not suggest substitutes to close a nutritional gap. Users must still be able to honestly record an off-plan meal without friction or moral judgment. A meal saved under “Other” appears in the recorded-meals list, counts in nutrition totals, and affects no food, portion, or order result. A meal saved under a plan slot is linked to that slot and evaluated; when nothing in it matches, the slot shows “Different food” with neutral wording and no penalty beyond the food component.

Support checklist-style meal states: **Not recorded**, **Recorded**, **Marked skipped**, and **Needs review**. A **Needs review** row always carries its one resolving action, such as **Choose option** or **Confirm portion**, so the user never has to guess what is missing. For a recorded meal, show food identity, quantity, and timing in its details. Keep the main status neutral; do not turn a meal into a failure because of a small quantity or timing difference. Important food differences remain visible, using descriptive copy such as “A different food was recorded.” Unknown information produces a specific review note, not assumed success or failure.

Distinguish an absent requirement from unresolved evidence: no plan timing instruction means the order rule applies instead and the detail reads “No time specified in your plan; checked by order”; an instruction with an unknown consumed time means “Time not evaluated.” Neither should create a timing penalty. A time difference by itself does not justify labeling the entire meal noncompliant.

Order rule: when the plan lists slots without times, which is the common case for this audience, compare the consumed order of the day's recorded prescribed meals with the plan's slot order. A meal eaten in sequence relative to the other recorded prescribed meals is “As planned”; one eaten out of sequence shows “Eaten before lunch” style detail. A day with only one recorded prescribed meal has no order reference, so the order component is left out of that meal's score. Snacks listed between main meals participate in the order like any other slot.

Food names may be normalized for spelling and synonyms, but a related food is not an equivalent. Compare portion values only after a valid unit conversion. Preserve a known quantity difference in details without demanding gram-perfect adherence. User confirmation establishes the recorded portion for comparison, not measurement accuracy.

A recorded meal links to at most one plan slot. A plan slot may have several recorded meals linked to it, for example a lunch eaten in two sittings; the slot's food and portion comparison then uses the combined items of its linked meals, and the earliest consumed time is used for order and timing. Item-level allocation of one recorded meal across several plan slots is not in V1; a user who ate two slots' food in one sitting records them as two meals. Count nutrients once regardless of links. Default to one suggested link, with reassignment of slot and option from meal details.

For an explicit time window, calculate consumed local time relative to its boundaries for descriptive detail only; this is not an automatic pass/fail rule. Use consumed time rather than upload/save time. A single stated time without a confirmed window gets a signed difference without a binary judgment. A meal belongs wholly to the date the user chose for it (see the late-night prompt in section 7), for both its slot comparison and its nutrition totals; a cross-midnight window is not split across dates.

Variety means following the variety specified by the diet, not maximizing novelty. Variety is not a separate score dimension in V1. For weekday prescriptions, the food-match component already compares the actual food to that day's assigned food, so eating Saturday's dinner on Sunday is simply “Different food” on Sunday. Only an explicit rule such as “fish twice a week” or “a different fruit each day” creates a variety observation, shown in plan details and History, outside the score. For confirmed serving/frequency rules, total relevant confirmed servings over the stated period. For a confirmed distinct-group rule, count the user-confirmed group memberships without counting the same group twice. An unrelated food cannot fulfill a prescribed-food requirement by supplying the same nutrient.

Show progress within an ongoing rule period, and final status only when that period ends and all applicable days have complete relevant records. Missing data yields an incomplete status. If the plan changes mid-period, show the period's progress against the updated plan, label the change, and withhold a full-period pass/fail for that period. Time-based and variety differences are observable facts, not claims of health harm.

“Not recorded” is not “Skipped.” Even on a complete day, a plan slot with no linked meal means “No matching meal recorded,” rather than proof the user ate nothing. For unsupported rules, retain the note rather than inventing a result. An exclusion can be flagged when an ingredient is explicitly recorded; absence from a photo or log cannot verify that an allergen or ingredient was absent.

### Worked product examples

- **Illustrative range, not a recommended diet:** a user-confirmed plan specifies 1,900–2,100 kcal. A complete, fully quantified day records 2,050 kcal. Show “Within your planned range.” At 11 a.m., 600 recorded kcal should not trigger “You are under-eating.”
- A past day has one saved lunch and its checkbox is unchecked. Show “Based on 1 recorded meal,” not “You missed breakfast and dinner.” If the box remains checked, assume that record is the complete log for comparison, but describe missing prescribed meals as “No matching meal recorded,” not proof that the user ate nothing.
- A dinner photo lacks usable oil quantity. Show an estimate/unknown as appropriate; do not silently turn missing fat into zero.
- A plan names rice with chicken, and the user records a different dinner. Show the specific “Different food” detail; do not assume calorie similarity means the plan was followed.
- A meal belongs in a confirmed 12:00–13:00 window and was eaten at 13:25 but logged at 18:00. Compare 13:25 to the window and show “25 min after your window.” The late logging time does not affect timing adherence.
- A plan prescribes fish on Tuesday and chicken on Wednesday. Eating chicken on both days does not satisfy Tuesday's food or the prescribed weekly variety, even if nutrition totals match.
- **Menu plan, option chosen:** breakfast offers three options; the user logs option 2 (oats, Greek yogurt, small banana, walnuts) with the prescribed amounts. Show “Matched”; food 50, portion 30, order as available.
- **Menu plan, mixed options:** the user logs the eggs from option 1 with the Greek yogurt from option 2. Show “Partly matched · items from two options”; food 25.
- **Menu plan, added item:** the user logs breakfast option 1 as prescribed plus a homemade burger. Show “Partly matched · Added: burger”; food 25, portion on the prescribed items as usual. A handful of extra cucumber with the same breakfast keeps “Matched”.
- **Replacement versus extra:** the user eats a sandwich instead of lunch and saves it under the lunch slot: lunch shows “Different food”. The user eats the prescribed lunch and later a sandwich saved under Other: lunch shows “Matched” and the sandwich counts in nutrition only.
- **Menu plan, cross-slot:** the user logs lunch option 4 (joojeh kabab, sangak, grilled tomato, yogurt) at dinner. Dinner shows “Partly matched · this is a lunch option”; lunch shows “No matching meal recorded”. No credit moves between slots.
- **Marked skipped:** the user marks the second snack skipped. Coverage reads “Based on 4 of 5 prescribed meals · 1 skipped”; the score is unchanged by the skip.
- **First meal of the day:** only breakfast is recorded and it is partly matched. The card shows “Mostly followed · based on 1 of 5 prescribed meals” without a number; the number appears after the second scored meal.
- **Menu plan, portion:** breakfast option 1 with 120 g of sangak instead of 80 g. Show “Matched” with the portion detail “More than planned (120 g instead of 80 g)”; portion component none for that item, averaged with the others.
- **Menu plan, untracked instruction:** the plan adds a banana or three dates near training on training days. The instruction sits under “Not automatically tracked”. If the user logs a banana at 17:00, it is an off-plan entry counted in nutrition only, with no judgment.
- **Weekday plan, no times:** Saturday has five slots without times. The user records breakfast at 10:40, then lunch at 14:10, then dinner at 21:30. Each meal's order component is full. If the snack was recorded at 15:00 after lunch while the plan lists it before lunch, the snack shows “Eaten after lunch”; order component half.
- **Per-meal range:** the menu plan says lunch is about 650–720 kcal. A recorded lunch estimated at 690 kcal shows “Within this meal's range” in meal details; a recorded lunch at 790 kcal shows “Slightly above this meal's range”. The meal range appears in details only and does not enter the score.

### Acceptance criteria

- Fixtures built from both reference plans produce Matched, Partly matched, and Different food exactly as the option rules define, including the cross-slot case as Partly matched with its reason.
- Marking a meal skipped changes coverage and never changes the score; a day with one scored meal shows no number.
- An added calorie-significant item produces Partly matched with an “Added” reason; added raw vegetables, herbs, or condiments do not change the status.
- A meal saved under a plan slot always produces a match result for that slot; a meal saved under Other never does.
- A past day with every slot recorded or marked skipped enters trend denominators; a checked day with unrecorded slots shows “log complete by default” and stays out.
- The thresholds table is implemented as fixtures at each boundary; a portion at exactly 15% and a time at exactly 60 minutes are small.
- Rubric v1 is reproducible: identical inputs produce an identical score, and every stored score carries the rubric version, coverage, and contributing record revisions.
- Day-conditional and exercise instructions are never evaluated, scored, or mentioned as met or missed.
- Boundary values of a confirmed range are handled inclusively.
- Unknown nutrient values cannot produce a falsely complete total or status.
- No absence of a record is converted into evidence of skipped eating.
- An unfinished day does not receive a below-target reprimand.
- Displayed totals and comparisons are calculated by application logic, not generated by an LLM.
- Every result can be traced to the current plan and confirmed records.
- A substitute with matching calories/macros never receives prescribed-food credit.
- Backdating the consumed time changes timing comparison; changing only the save time does not.
- Variety/frequency calculations respect the confirmed period, missing data, plan changes, and never count the same serving or group twice.

## 9. Today dashboard

### Information hierarchy

This layout is a product-design proposal, not an owner-approved screen. The revised default applies the requested progressive disclosure: daily nutrition is available on expansion, rather than as a separate always-visible card. This changes presentation only; meal-level nutrition review, daily calculations, and plan comparisons remain in scope.

The dashboard should answer: **What is recorded? How does that compare? What is useful next?**

1. **Date and morning paragraph.** Compact greeting, today's date, the daily paragraph, and its link to yesterday. The paragraph can be collapsed after reading.
2. **Your plan today.** The primary progress card: a compact overall adherence score with its coverage label and a “Why this score” expansion, followed by a checklist of today's slots in plan order, with neutral recorded/not-recorded status and specific differences. A slot with several options shows the slot name, its energy range when given, and “3 options”; the options expand on tap and the picked option is named once recorded. Highlight the next unrecorded slot in plan order and **Log this meal** inside this block. Completed rows stay compact; food, quantity, order/timing, and applicable variety details expand. When every slot is recorded, offer **Log another meal** rather than guessing. Do not prescribe a different meal based on remaining calories. A target-only plan shows an explanation that no meal schedule is defined and no score. Untracked notes are reachable from **View today's plan**, not repeated here.
3. **Recorded meals.** A chronological list with time, name, and edit access. Nutrition is available in meal details rather than repeated across every collapsed list row. Put day-completeness control at the end.

Inside **Your plan today**, include a collapsed **Today's nutrition details** control. Its expanded content shows totals for energy, protein, carbohydrate, and fat from confirmed recorded meals, alongside explicit plan targets or the confirmed AI-estimated plan baseline, with their source clearly labeled. State the number of recorded meals, log completeness, estimates, and missing values. This is the meaning of “daily nutrition summary”; it is not a general nutrition report, additional input requirement, or new dietary advice. Other nutrients expand further only when available and relevant to the plan. A food-based plan uses its confirmed AI-estimated baseline where available; no new personalized nutrient goals are invented. Weekly variety progress belongs in the prescribed-plan details or History, not another dashboard widget.

The logging action stays accessible as the user scrolls. The morning paragraph is the primary interpretation; avoid adding multiple advice cards repeating it. An essential uncertainty notice may appear inline with the affected data.

### Illustrative content layout

```text
Today · Monday, September 14
[Morning paragraph: yesterday + one focus for today]

Your plan today
[78 · Mostly followed · based on 2 of 5 prescribed meals]
[Why this score ▸]
[صبحانه Breakfast · matched · option 2]
[میان‌وعده اول First snack · recorded · a bit less than planned]
ناهار Lunch · 650–720 kcal · 4 options    [Log this meal]
[میان‌وعده دوم Second snack · not recorded]
[شام Dinner · not recorded]
[Today's nutrition details ▸]            (collapsed)

Meals
08:30  Breakfast                         [Open]
11:00  Snack                             [Open]

[✓] I've logged everything for this day
Uncheck this if you haven't recorded everything.

Persistent primary action: Log meal
Navigation: Today | History | My plan
```

This defines hierarchy, not colors, card styling, or a final visual composition.

### Essential states

- **First use/no records:** show the plan and “Log your first meal”; no empty charts.
- **No active plan:** keep logging available and show “Add your plan.”
- **Plan import pending or failed:** a single banner above the plan block, “We're still preparing your plan,” “Your plan is ready to review” with **Review now**, or “We couldn't prepare your plan” with **Try again** and **Set up manually**.
- **Device time zone changed:** one dismissible line offering to update the preference; history is never rewritten.
- **Ongoing day:** display recorded progress; the checked completeness default does not imply that today has ended.
- **Incomplete log:** display recorded amounts and partial-data context when unchecked.
- **Past day treated as complete:** display eligible comparisons and keep the checkbox editable.
- **Unknown nutrition:** attach a concise data-quality note to the affected value.
- **Loading:** stable placeholders that preserve layout; do not display temporary zero totals.
- **Error:** show cached data with a timestamp when available and a focused retry action.

### Acceptance criteria

- On a 390 × 844 CSS-pixel viewport, users can find Log meal without scrolling.
- Within a brief view, users can distinguish prescribed meals from recorded meals and locate the next action. Expanded nutrition details clearly distinguish recorded values from targets.
- The default screen has no more than the three content blocks above; daily nutrition details are collapsed within the plan block, not displayed as a fourth card.
- The overall score and dimension details coexist within the plan block. Nutrition detail identifies explicit targets versus an AI-estimated plan baseline; unquantifiable plans do not receive fabricated values.
- Optional details use the same expand/collapse pattern throughout the product.

## 10. History and useful progress

History defaults to the past seven days and provides a date selector for older days. Opening a day shows its records compared against the current plan, completeness status, eligible comparisons, and any morning message referencing it.

The seven-day view contains one compact pattern summary and day-level access. Prioritize prescribed-food, timing, and explicit variety patterns; nutrition alone must not stand in for overall adherence. Show denominators: for example, “Within your planned calorie range on 3 of 4 complete days; 3 days have incomplete logs.” Keep food/portion/timing statuses separate, with applicable weekly variety rules in expandable detail. Never count incomplete days as failed days or conceal them from the description.

For a trend statement, require at least three complete, comparable days with the relevant data. A day counts as complete for trends only when its checkbox is checked and every prescribed slot has a recorded or marked-skipped meal. Checked days with unrecorded slots are listed as “complete by default, 2 of 5 meals” and stay out of the denominator. Otherwise show “A few more complete days will make patterns clearer.” This threshold is a proposed product rule, not a scientific validity claim.

The seven-day pattern summary is one sentence built from the most frequent noticeable or large difference across complete days, in this priority: a slot that was “Different food” or marked skipped on three or more days, then a repeated portion difference on the same item, then a repeated order difference, then energy against the daily range. Example: “Dinner was a different food on 3 of 4 complete days.” When no repeated difference exists, say what matched most often instead.

If the plan changed during the seven days, label the change; do not average unlike goals into a misleading trend. No causal claims about weight, metabolism, or health outcomes. No default collection of unrelated charts.

## 11. Morning message

### Content contract

Produce one English paragraph of approximately 60–90 words for each local date. It should contain a specific reflection on yesterday where evidence permits, one small focus grounded in today's confirmed plan, and a calm encouraging close. Favor shorter output when data is sparse rather than filling the paragraph with generic motivation.

Choose the focus from reliable, relevant facts: first a noticeable or large prescribed-food or portion difference, then an order/timing difference or an explicit variety rule, then a nutritional comparison, unless the confirmed plan explicitly sets another priority. If records are incomplete, acknowledge that before any comparison. Mention at most one improvement focus. When the available facts support it, acknowledge one specific thing that matched the plan. Do not hide a food/timing mismatch behind a positive calorie total.

The paragraph is always English. Food and slot names may be quoted as the user wrote them, followed by the English label, for example “your ناهار (lunch)”. For a slot with options, refer to the slot and, if useful, the number of options; never tell the user which option to choose. Never mention training, rest days, exercise, or fasting, even when the plan text does.

Inputs: yesterday's confirmed records, the completeness setting (checked is always an assumption, never a confirmation), deterministic comparison facts including the rubric result, material estimate gaps, the plan as it is now, today's schedule with slot order, the display name or username, and recent messages to reduce repetition. The required age, sex, height, and current-weight profile may be supplied as personalization context for tone only. Do not infer health conditions or change the prescribed diet from it; account identifiers and irrelevant profile history are excluded.

Every factual statement must map to a provided fact. The model does not calculate adherence or invent an unrecorded meal, ingredient, mood, intention, reason, or outcome. If a plan lacks meal times, refer to the next slot by plan order, not by a clock time.

### Distinct content states

| Situation                                   | Required behavior                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Yesterday checked, nonempty, and comparable | Treat the log as complete; give a grounded observation and one plan-based focus without ever claiming the user confirmed completeness |
| Yesterday unchecked                         | Say that the reflection covers recorded meals; avoid whole-day judgments                                                              |
| No records yesterday                        | Acknowledge the absence of records neutrally; suggest an easy first logging action                                                    |
| First day                                   | Welcome the user and orient them to today's plan without mentioning invented yesterday performance                                    |
| No active plan today                        | Reflect only where possible and invite plan setup; do not invent today's targets                                                      |
| AI unavailable or rejected output           | Show a deterministic fallback for the appropriate state                                                                               |

Illustrative copy for partial data:

> You recorded lunch and dinner yesterday, so this reflection covers those meals rather than your full day. Today's plan starts with the breakfast you added. When you're ready, you can log it from your plan and adjust the portions to match what you actually eat. If there is anything else you want to add to yesterday, you can do that at any time. One meal is a comfortable place to start today.

Use this example only for a morning visit when its referenced facts are present. Production messages must be generated from actual structured facts.

Never praise unusually low intake, use “good/bad food,” call eating “cheating,” recommend skipping meals to compensate, or suggest earning food through exercise. Avoid exaggerated congratulations, guilt, urgency, and repetitive slogans.

### First-visit generation and display

On the first authenticated visit of each local calendar day, request that day's paragraph from the server and display it on Today. If a user opens a deep link to another task, preserve that destination and make the paragraph available on Today without an interrupting modal. The dashboard and meal logging remain usable while generation runs.

There is no scheduled morning worker, push permission, reflection or reminder email, delivery-time setting, or external notification in V1; the only email the product sends is the transactional password-reset message. “Morning message” names the daily reflection; if the first visit happens in the afternoon or evening, use a time-appropriate greeting and refer to the remaining day. Do not instruct the user to begin with breakfast after it has passed. If no visit occurs, no paragraph needs to be generated for that day; do not create a backlog on return.

Use a user-confirmed IANA time zone and the local date, not the device's UTC date. Keep one canonical message per user/local date, with an input revision and generation timestamp. Reopening Today, refreshing, multiple tabs/devices, or retrying must return the same message rather than create duplicates. At local midnight, the next visit or foreground refresh requests the new date's message; it never interrupts a meal form.

Inputs are captured at request time. A late first visit can include today's confirmed recorded meals solely to avoid an inappropriate next-step suggestion. Yesterday remains the basis of the retrospective paragraph. No catch-up judgments about the user's absence.

If AI is slow or unavailable, show a deterministic fallback for the relevant data state and retain it for that day until the user deliberately requests an update. Do not repeatedly replace prose while the user is reading. The user can collapse the paragraph; remember that choice for the current date and show the next day's new paragraph normally.

If yesterday's records change after generation, compare the new deterministic facts with the input snapshot. Mark the in-app reflection as based on an earlier log and offer **Update reflection** only when a fact the paragraph used changed: a match status, a portion band, an order or timing band, the energy result, coverage, or completeness. A note edit, a photo removal, or a portion change that stays within the same band does not mark it stale. Replace it with a new revision after regeneration. Apply the same rule if the referenced plan or today's referenced records change. Keep the creation context and revision metadata; do not present outdated feedback as current.

### Acceptance criteria

- Complete, partial, empty, first-day, and missing-plan cases have distinct tested outputs.
- Messages contain no fact unsupported by their input snapshot.
- First visit creates one canonical paragraph for that user's local date; concurrent requests and refreshes reuse it.
- First visits in the afternoon/evening use appropriate language and today's remaining plan.
- No browser-notification prompt, reflection email, scheduled job, or morning-time preference exists in V1.
- Correcting referenced records or plans makes an outdated reflection visibly stale.
- A provider failure produces a useful factual fallback without blocking logging.
- A user returning after several days sees today's reflection without a generated backlog.

## 12. UX copy and interaction design

### Voice

Supportive, calm, kind, and professional. Speak directly to the user in plain English. Be brief for routine success and more explicit for uncertainty, recovery, or destructive actions. Explain what happened and what the user can do next.

| Context                                 | Example                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Primary logging action                  | Log meal                                                                                                        |
| Review title                            | Check your meal                                                                                                 |
| Estimate helper                         | These values are estimates. Adjust anything that looks different.                                               |
| Quantity clarification                  | How much of this dish did you eat?                                                                              |
| Confirmation                            | Save meal                                                                                                       |
| Successful save                         | Meal saved                                                                                                      |
| AI failure                              | We couldn't estimate this meal. Try again or enter the details yourself.                                        |
| Save failure                            | Your meal hasn't saved yet. Your edits are still here. Try again.                                               |
| Missing plan                            | Add your plan to see how your meals compare.                                                                    |
| Incomplete day                          | Based on the meals you've recorded.                                                                             |
| Empty history day                       | No meals recorded for this day.                                                                                 |
| Advanced section                        | More details                                                                                                    |
| Daily reflection title                  | Today's reflection                                                                                              |
| Matched meal                            | Matches your plan                                                                                               |
| Partly matched meal                     | Some of this meal matches your plan                                                                             |
| Cross-slot option                       | This is a lunch option                                                                                          |
| Needs review row                        | Choose the option you ate                                                                                       |
| Late-night composer                     | Was this for yesterday?                                                                                         |
| Different food                          | A different food was recorded                                                                                   |
| Score coverage                          | Based on 2 of 5 prescribed meals                                                                                |
| Untracked instruction                   | Not automatically tracked                                                                                       |
| Option slot                             | 4 options · choose what you ate                                                                                 |
| Last-used option                        | Last time                                                                                                       |
| Added item                              | Added: burger                                                                                                   |
| Other slot in picker                    | Other · in addition to your plan                                                                                |
| Restriction reminder                    | Contains walnuts, which is on your restrictions list.                                                           |
| AI notice, plan                         | We'll send your plan text to an AI service to read it. Food names stay as you wrote them.                       |
| AI notice, meal                         | We'll send this description (or photo) to an AI service to estimate it. You can enter details yourself instead. |
| Import running                          | We're still preparing your plan. You can log meals in the meantime.                                             |
| Import ready                            | Your plan is ready to review.                                                                                   |
| Import failed                           | We couldn't prepare your plan. Try again or set it up manually.                                                 |
| Completeness helper, past day with gaps | 2 of 5 meals recorded. Mark the rest skipped if you didn't eat them.                                            |
| No recovery                             | A forgotten password can't be recovered in this release.                                                        |
| Plan edit confirm                       | Past days will be compared against the updated plan · 3 meals affected.                                         |
| Newer edit exists                       | This meal was updated on another device. Reload to see the latest version.                                      |
| Delete action                           | Delete this meal? Your daily totals will update.                                                                |

Use sentence case, explicit field labels, specific button verbs, and consistent food/portion/unit terminology. Do not use placeholder text as the only label. Do not expose model names, JSON, tokens, or internal job states in ordinary product screens.

All system copy is English. User-written food, meal, and plan text is shown as written, with the English label the AI produced beneath or beside it, and is never machine-translated in place. Right-to-left runs use proper bidirectional isolation so Persian and Arabic names render correctly next to English labels and numbers. Numbers in system copy use Western digits; user text keeps its digits.

### Progressive disclosure and components

Use existing accessible library primitives for forms, buttons, navigation, dialogs, sheets, accordions, lists, notifications, and date/time inputs. Compose them into the reusable product components named in `design-scope.md`: Meal composer, Meal review, Plan slot row, Score card with Why this score, Nutrition details, Completeness checkbox, Reflection card, Difference chip, Original + English name label, Import status banner, AI notice sheet, and one Expand/collapse pattern. Use these names in both documents and in code. A composed product component is expected; rebuilding standard control behavior from scratch is not.

Choose one primary component library through `design.md`. Use shared tokens and variants; avoid page-specific colors, spacing values, and duplicate controls. Introduce a custom primitive only when the existing system cannot support a documented user need.

### Appearance, accessibility, and motion

Support System, Light, and Dark appearance; default to System. Persist the user's explicit choice across authenticated devices and prevent a theme flash on initial load.

Target WCAG 2.2 AA: keyboard navigation, visible focus, labeled controls, meaningful error associations, text alternatives, appropriate contrast, and no color-only status. Support text enlargement and narrow viewports without hiding actions. Use at least 44 × 44 CSS-pixel touch areas for primary controls as a product usability target, above the standard's minimum target-size baseline. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

Use subtle 150–250 ms transitions for steps, sheets, expansions, and state changes. Respect reduced-motion preferences. No forced delays, celebratory confetti, or animations required to understand progress. Preserve focus and scroll position after edits; announce asynchronous save/analysis results accessibly.

## 13. AI and nutrition integration

### DeepSeek requirement

Use DeepSeek for plan interpretation, meal interpretation, and morning prose. Provider keys remain on the server. Separate AI adapters from food-data lookup, calculation logic, and persistence so model changes do not redefine the product's behavior.

Plan and meal text arrives in any language, mostly Persian and Arabic. The interpretation prompts must return structured output with each food's original name, an English label, quantity, and unit, and must normalize Persian and Arabic digits and regional household units through the section 6 unit table rather than guessing. All prose the model returns to the user is English. Evaluate interpretation quality on the two reference plans and on a Persian meal-description set before release.

Checked September 14, 2026: DeepSeek documents `deepseek-v4-flash-vision-exp` as an experimental image-input model. Its vision guide lists JPEG, PNG, GIF, and WebP support. Ordinary text-model selection must not be assumed to accept photos. Revalidate account access and model availability during implementation; documentation is not proof of food-recognition accuracy. [DeepSeek vision guide](https://api-docs.deepseek.com/guides/vision/), [DeepSeek API introduction](https://api-docs.deepseek.com/)

Before relying on it for release, test the actual deployment account with representative meal photos and pasted diet text. If the experimental endpoint is unavailable or fails the agreed quality evaluation, photo-based AI is an unresolved release dependency. Text/manual fallback preserves usability but does not fulfill the promised photo feature. Any additional vision provider is a separate product decision, not a silent substitution.

### Nutrition data

The audience eats regional foods that Western databases cover poorly: sangak bread, joojeh kabab, adasi, kabab tabei, and similar dishes. V1 therefore uses labeled AI estimates as the primary nutrition path, anchored by the section 6 household-unit table so “a glass of milk” and “a teaspoon of oil” resolve consistently. USDA FoodData Central is a secondary lookup for packaged items and generic ingredients such as eggs, oats, chicken breast, and rice, where it improves traceability; store source identifiers, units, portion basis, and retrieval/version information for those matches. A curated regional food table with reviewed values is a later accuracy investment, not a V1 requirement; design the food-item record so it can be added without migrating meal history. [USDA API guide](https://fdc.nal.usda.gov/api-guide/)

Nutrition calculations scale values to confirmed portions using explicit units and preparation state. Never assume all milliliters equal grams or cooked and raw weights are interchangeable. Keep calculation precision internally and use consistent, modest display rounding. Do not silently replace label energy with a macro-derived value.

### Reliability requirements

- Validate structured AI output against schemas; reject negative quantities, unsupported units, missing required fields, and invalid numeric values.
- Treat pasted plans, meal photos, and food descriptions as user data, never as instructions that can change application rules or trigger tools.
- Give every draft and analysis request a revision ID. Ignore late responses for superseded input.
- Use bounded retries and timeouts. For meal analysis, after 15 seconds show a calm status and manual option; at a proposed 45-second interactive timeout, end the wait and retain the draft. Plan imports may run as resumable background jobs with a proposed two-minute timeout. Daily-message generation uses its separate 15-second fallback deadline; a late provider response must not overwrite the canonical fallback without a deliberate update request.
- Cache confirmed recent-meal data and canonical daily messages. Do not regenerate estimates on every dashboard render.
- Record provider/model version, input revision, duration, error category, and evaluation outcome without placing raw health records in routine logs.
- Keep a deterministic fallback library for morning-message states.

### Quality evaluation

Before release, use a reviewed evaluation set containing simple foods, mixed dishes, shared plates, hidden ingredients, low-quality images, packaged-label values, varied cuisines, ambiguous plans, and all morning-message states. Assess food identification, portion assumptions, correction burden, nutrition provenance, unsupported-claim rate, latency, and cost.

User confirmation is a control against obvious errors, not evidence that nutrition is accurate. Define an acceptable numeric estimation-error threshold with an appropriate nutrition reviewer and audience-specific reference set before making accuracy claims. This threshold remains an open release-validation decision; do not invent an accuracy percentage in marketing or the UI.

## 14. Data and time rules

### Core records

| Record                  | Essential information                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Account and preferences | Owner ID, username, password hash, display name, units, time zone, week start, appearance, which AI notices have been shown (plan, meal text, meal photo)                                                    |
| Profile                 | Required age, sex, height, current weight; units, measurement dates; optional goal and explicitly supplied restrictions                                                                                      |
| Plan                    | Source, source language, original text, normalized slots in order with original and English names, options per slot, in-item alternatives, per-meal and daily targets, rules, untracked notes, pending draft |
| Day                     | Local date, time zone context, completeness boolean (default true; no record of whether it was touched), skipped slots                                                                                       |
| Meal                    | Owner, consumed timestamp when known, recorded local date and zone, time-known flag, slot, confirmed foods, notes, photo references, revision                                                                |
| Food item               | Original name, English label, quantity/unit, nutrients including unknowns, data source, estimate and assumed-portion flags, user overrides                                                                   |
| Plan link               | One per recorded meal: confirmed slot or Other, chosen option, match status with reason, and rule relationship                                                                                               |
| Day comparison          | Computed on read from confirmed records and the current plan: rubric version, per-slot component values, day score, coverage, contributing record revisions, nutrition results                               |
| Morning message         | User/local date, input snapshot revision, paragraph, generation time/model, stale/fallback state                                                                                                             |
| Upload/draft            | Owner, lifecycle, original input, analysis revision, expiry and cleanup state                                                                                                                                |

All records and uploads are private to their owner. Server authorization applies to reads, writes, exports, and file access.

Store consumed time separately from created/updated time. A day follows the user's selected local midnight boundary. Preserve an entry's recorded local date/zone so travel does not silently move old meals across days. Detect a changed device time zone and offer a preference update; never rewrite history automatically. Users can explicitly correct the recorded date/time.

Use one consistent calculation service for dashboard, history, and morning-message facts. Recalculate affected days after meal/plan changes and invalidate stale cached summaries. Use revision checks to prevent one device from silently overwriting newer edits from another.

## 15. Privacy, trust, and operational behavior

Health profile, diet, meal descriptions, and photos are private user data. Before the first AI request of each kind, plan import, meal text analysis, and meal photo analysis, show a short notice that the content is sent to an AI provider, with a manual alternative. Each notice appears once per account and is recorded so it is not repeated; the same wording is available from Settings under Privacy & data. Do not imply that processing is local or that third-party retention is zero without verified terms.

Minimize payloads, strip unnecessary photo metadata, use private object storage and expiring access, encrypt transport, and keep secrets server-side. Do not send the username or complete profile history with a food-identification request.

Passwords are stored only as salted hashes with a modern algorithm, sign-in attempts are rate limited, and a password change invalidates other sessions. The product is for adults; onboarding stops below 18 and stores no health data for that account. The recovery email, when supplied, is used only for password reset.

Proposed retention: discard abandoned uploads after 24 hours; retain confirmed sources/photos until the user deletes them or the account. Permit photo removal without deleting the confirmed food record. Clean up temporary image conversions and provider-uploaded files where the integration supports it. Document any provider retention outside the application's control in the privacy notice before launch.

Provide a machine-readable export of profile, plans, meals, and messages, including access to retained uploaded media. Account deletion requires explicit confirmation, immediately disables access and pending AI jobs, and initiates deletion of primary records/media within seven days; encrypted backups expire within a proposed 30 days. These periods are proposed service commitments and must match the chosen infrastructure before release.

Clear sensitive local drafts/caches at logout and isolate any retained recovery data by account. Do not put health content, uploaded sources, or raw AI payloads in analytics, error trackers, or public URLs.

Position the product as tracking and reflection against a supplied plan. It does not diagnose conditions, prescribe treatment, certify allergy safety, or claim weight outcomes. These boundaries should appear where relevant, without repeated alarming banners in everyday logging.

## 16. Performance and product validation

The following are proposed launch targets, not measured results:

| Area                        | Target                                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Routine repeat-meal logging | Median ≤15 seconds from opening composer to confirmed save in usability sessions                                              |
| New meal logging            | Median ≤45 seconds excluding user camera time and a clearly reported provider wait                                            |
| Initial usable Today view   | ≤2.5 seconds at the 75th percentile on the agreed representative mobile/network profile                                       |
| Local interaction feedback  | Visible response within 100 ms for taps, expansions, and quantity changes                                                     |
| Confirmed-meal save         | ≤2 seconds at p95 under agreed normal load, excluding AI analysis                                                             |
| Meal AI review readiness    | Target ≤15 seconds at p75 after completed upload; measure separately from save time                                           |
| Daily reflection readiness  | Target ≤10 seconds at p75 after first-visit request, with logging available immediately and a fallback after a 15-second wait |
| Layout stability            | No unexpected shifts that move the main action or active field during the core flows                                          |

Agree on a representative device, mobile network profile, normal-load volume, and evaluation set before treating targets as passed. Test iOS Safari, Android Chrome, and current desktop Safari/Chrome/Firefox at launch. Include camera/HEIC handling, first-visit/local-date behavior, keyboard navigation, zoom, and both themes.

### Product success measures

Track activation (confirmed plan plus first saved meal), onboarding abandonment by step, meal time-to-save, save failure/duplicate rate, AI correction rate, weekly return use, complete versus partial logging days, and optional morning-message helpfulness feedback. Do not equate logging frequency or streak length with health improvement.

In usability evaluation, ask people to record and correct a meal, backdate an entry, identify whether a day is complete, explain the comparison in their own words, and find the next planned action. A visually polished screen is insufficient if these tasks are unclear.

Use content-free analytics events such as `plan_confirmed`, `meal_save_succeeded`, `analysis_failed`, and `reflection_opened`; include operational metadata only. Do not put meal names, nutrient values, body measurements, or uploaded text in event properties.

## 17. First-release acceptance checklist

- [ ] Username/password sign-up and sign-in, the under-18 stop, interrupted onboarding, unit conversion, and required age/sex/height/weight validation work without losing data; no recovery path exists and sign-up says so.
- [ ] Manual setup offers same-every-day, by-weekday, and targets-only structures, and a targets-only plan can be confirmed without any slot.
- [ ] Both reference Persian plans import correctly: options preserved per slot, per-meal ranges, plan-derived slot names, Saturday week start, original names with English labels, and day-type instructions under “Not automatically tracked”.
- [ ] Supported plan inputs reach source-linked review and explicit activation; unresolved rules stay visibly untracked.
- [ ] Training, exercise, and day-type instructions are never evaluated anywhere in the product.
- [ ] Plans without numeric nutrition targets receive reviewed AI-estimated baselines where portions permit; source targets override estimates for the applicable nutrient.
- [ ] DeepSeek image access, meal-photo interpretation, and text-plan parsing quality have been tested on the deployment account.
- [ ] Text, photo, manual, recent-meal, and planned-meal logging all reach editable review and explicit save.
- [ ] AI failures, upload errors, stale responses, save retries, and duplicate requests preserve correct records.
- [ ] Past-date logging preserves the intended daily history; editing the plan re-compares past days and the confirm step states the number of affected meals.
- [ ] The completeness checkbox is two-state and defaults to checked for each date; changes persist across visits/devices and meal edits without daily reconfirmation, and a checked day with unrecorded slots is labeled “complete by default” and excluded from trends.
- [ ] Unchecking a day updates comparisons, trend eligibility, and reflection freshness; today remains in progress and empty logs remain unassessable regardless of the checkbox.
- [ ] Unknown nutrition and explicitly incomplete logs never become false zeros or full-day judgments.
- [ ] Target comparison boundaries and plan links are deterministic and tested with known fixtures.
- [ ] Prescribed-food, quantity, consumed-time, and explicit variety comparisons work independently; substitutions do not receive equivalence credit.
- [ ] Today shows an overall adherence score alongside dimension details under rubric v1, with coverage labels, honest incomplete-data states, the fixed thresholds, and no punitive treatment of small differences.
- [ ] Option matching (Matched, Partly matched, Different food, cross-slot, added calorie-significant item) behaves as section 8 defines, with fixtures from both reference plans; a meal under a plan slot is always evaluated and a meal under Other never is.
- [ ] A planned meal with options cannot be saved without a chosen option, and the last-used option is only marked as a suggestion.
- [ ] The AI-processing notice appears once before each first request kind (plan, meal text, meal photo), each with a manual alternative.
- [ ] Today shows the import-pending, import-ready, import-failed, plan-ended, and time-zone-changed states as specified, and a restriction reminder appears in meal review when an item matches.
- [ ] Persian and Arabic input renders correctly beside English labels across plan, review, Today, History, and the morning paragraph.
- [ ] Today stays focused, with a persistent logging action and optional detail disclosure.
- [ ] History explains incomplete-day denominators and plan changes.
- [ ] Morning messages pass complete/partial/empty/first-day/no-plan tests and contain only supported facts.
- [ ] First-visit generation, local dates, concurrent requests, fallback timing, and stale reflections work.
- [ ] The first release contains no push notifications and no email other than the transactional password-reset message.
- [ ] Shared components, dark/light/system appearance, keyboard support, touch targets, and reduced motion are verified.
- [ ] Server authorization prevents cross-account access to records and uploaded files.
- [ ] AI processing disclosure, export, deletion, upload cleanup, and retention behavior match the implemented services.
- [ ] Performance and task-completion targets have been measured on the agreed test profile.
- [ ] `design.md` supplies the final visual language and selected design system before visual acceptance.

## 18. Remaining owner and launch decisions

Core logging and comparison flows are specified, and the owner delegated the remaining product defaults in v1.4. The items below are the ones the owner should still look at, not permission for an implementation agent to invent behavior. Until revised, use the stated default without representing it as owner-approved.

### Product defaults awaiting owner review

| Decision                             | Why it matters                                                                                                  | Current default                                                                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rubric v1 weights and thresholds     | The owner confirmed a score and gentle treatment; the numbers in section 8 are the product author's             | Food 50, portion 30, order/timing 20 per meal; nutrition 10 per day; 15% portion, 10% energy, 60-minute time bands. Versioned so history can be recomputed. |
| Checked-by-default coverage handling | Softens low scores for forgetful users while keeping the owner's checked default and a plain two-state checkbox | Score over recorded meals with a “complete by default” label; such days stay out of trends until every slot is recorded or marked skipped.                  |
| Added-item and slot rules            | Keeps “Matched” honest without punishing small extras, and keeps “Other” from hiding a replaced meal            | Calorie-significant additions make a meal Partly matched; saving under a slot always evaluates it; Other is additional food only.                           |
| Final dashboard composition          | The owner requested ideation and minimalism rather than a fixed layout                                          | Three main blocks with collapsed nutrition details as specified in section 9; review through design before final visual acceptance.                         |

### Setup and launch decisions

1. Supply the product name and `design.md`; select one component system without expanding the dashboard's functional scope.
2. Confirm the unpaid first-release scope, or replace that default explicitly.
3. Confirm the AI quality thresholds on the Persian evaluation set, the service budget, expected load, and actual retention commitments before launch.
4. The photo action is built behind a server-side flag; decide at launch whether to enable it, based on the vision evaluation. No other code path changes with that decision.

No subscription, social layer, diet generation, or extra tracking module should be inferred from this document's open decisions.
