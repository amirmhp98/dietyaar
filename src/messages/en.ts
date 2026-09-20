/**
 * English (en-US) UI strings.
 *
 * Flat, dot-namespaced keys grouped by screen. Plural strings come in
 * `<base>.one` / `<base>.other` pairs and are read through `tp()`.
 * Placeholders use `{name}` and are filled by `t()` / `tp()`; their names are
 * inferred from the text, so a missing param is a type error at the call site.
 */
import { ai } from './sections/ai';
import { day } from './sections/day';
import { history } from './sections/history';
import { meal } from './sections/meal';
import { photo } from './sections/photo';
import { plan } from './sections/plan';
import { reflection } from './sections/reflection';
import { settings } from './sections/settings';
import { units } from './sections/units';

/**
 * Core strings live here; each product module owns one file under
 * `sections/` (plan, meal, day, reflection, settings, ai) so modules can be
 * built in parallel without editing the same file. Keys stay globally
 * unique and flat.
 */
export const en = {
  ...plan,
  ...meal,
  ...day,
  ...history,
  ...reflection,
  ...settings,
  ...ai,
  ...photo,
  ...units,

  // ── App shell ──────────────────────────────────────────────
  'shell.skipToContent': 'Skip to main content',
  'shell.logoAlt': 'Logo',
  'shell.openMenu': 'Open navigation menu',
  'shell.expandSidebar': 'Expand sidebar',
  'shell.collapseSidebar': 'Collapse sidebar',
  'shell.adminBadge': 'Admin',
  'shell.adminRole': 'System administrator',
  'shell.logMeal': 'Log meal',
  'shell.profile': 'Settings and profile',
  'meal.compose.title': 'Log meal',
  'settings.account.title': 'Account',
  'settings.account.username': 'Username',
  'settings.tools.title': 'Tools',

  // ── Shared product components ───────────────────────────────
  'aiNotice.title': 'Before we continue',
  'aiNotice.plan':
    "We'll send your plan text to an AI service to read it. Food names stay as you wrote them.",
  'aiNotice.meal':
    "We'll send this description (or photo) to an AI service to estimate it. You can enter details yourself instead.",
  'aiNotice.continue': 'Continue',
  'aiNotice.setUpManually': 'Set up manually',
  'aiNotice.enterManually': 'Enter manually',
  'import.pending': "We're still preparing your plan. You can log meals in the meantime.",
  'import.ready': 'Your plan is ready to review.',
  'import.failed': "We couldn't prepare your plan. Try again or set it up manually.",
  'import.reviewNow': 'Review now',
  'import.tryAgain': 'Try again',
  'import.setUpManually': 'Set up manually',
  'day.completeness.label': "I've logged everything for this day",
  'day.completeness.helper': "Uncheck this if you haven't recorded everything.",
  'score.title': 'Your plan today',
  'score.inProgress': 'In progress',
  'score.notEnough': 'Not enough information yet',
  'score.band.closely': 'Closely followed',
  'score.band.mostly': 'Mostly followed',
  'score.band.different': 'Different from your plan',
  'score.coverage.one': 'Based on {count} of {total} prescribed meals',
  'score.coverage.other': 'Based on {count} of {total} prescribed meals',
  'score.skipped.one': '{count} skipped',
  'score.skipped.other': '{count} skipped',
  'score.completeByDefault': 'log complete by default',
  'day.completeness.gaps':
    "{recorded} of {total} meals recorded. Mark the rest skipped if you didn't eat them.",

  // ── Navigation (sidebar) ───────────────────────────────────
  'nav.menuTitle': 'Navigation menu',
  'nav.group.dashboard': 'Dashboard',
  'nav.group.tools': 'Tools',
  'nav.group.admin': 'Administration',
  'nav.home': 'Home',
  'nav.components': 'Components',
  'nav.users': 'Users',
  'nav.comingSoon': 'Coming soon',
  'nav.today': 'Today',
  'nav.history': 'History',
  'nav.plan': 'My plan',
  'nav.settings': 'Settings',
  'nav.primary': 'Primary',

  // ── Theme toggle ───────────────────────────────────────────
  'theme.switchToLight': 'Switch to light mode',
  'theme.switchToDark': 'Switch to dark mode',

  // ── Auth ───────────────────────────────────────────────────
  'auth.logout': 'Log out',
  'auth.login.title': 'Sign in',
  'auth.login.username': 'Username',
  'auth.login.usernamePlaceholder': 'Enter your username',
  'auth.login.password': 'Password',
  'auth.login.passwordPlaceholder': 'Enter your password',
  'auth.login.showPassword': 'Show password',
  'auth.login.hidePassword': 'Hide password',
  'auth.login.submit': 'Sign in',
  'auth.login.submitting': 'Signing in…',
  'auth.errors.missingCredentials': 'Username and password are required.',
  'auth.errors.invalidCredentials': 'Incorrect username or password.',
  'auth.login.noAccount': 'New here?',
  'auth.login.signupLink': 'Create an account',
  'auth.noRecovery': "A forgotten password can't be recovered in this release.",
  'auth.tagline': 'See how what you eat compares with the diet you already follow.',

  // ── Sign up ────────────────────────────────────────────────
  'signup.title': 'Create your account',
  'signup.username': 'Username',
  'signup.usernamePlaceholder': 'Letters, digits and underscore',
  'signup.password': 'Password',
  'signup.passwordPlaceholder': 'At least 8 characters',
  'signup.submit': 'Sign up',
  'signup.submitting': 'Creating your account…',
  'signup.haveAccount': 'Already have an account?',
  'signup.loginLink': 'Sign in',
  'signup.errors.usernameTaken': 'That username is taken. Try another one.',
  'signup.errors.rateLimited': 'Too many sign-ups from this network. Try again in an hour.',

  // ── Onboarding ─────────────────────────────────────────────
  'onboarding.progress': 'Step {current} of {total}',
  'onboarding.progressLabel': 'Onboarding progress',
  'onboarding.back': 'Back',
  'onboarding.continue': 'Continue',
  'onboarding.skip': 'Skip',
  'onboarding.saving': 'Saving…',
  'onboarding.age.title': 'How old are you?',
  'onboarding.age.label': 'Age in years',
  'onboarding.age.why':
    'Your age, sex, height and weight give the AI context when it reads your plan and writes your daily reflection. They never change the nutrition of a food, and they are not sent with meal analyses.',
  'onboarding.age.stopTitle': 'Dietyaar is for adults',
  'onboarding.age.stopBody':
    'This app is for people aged 18 and over. Nothing about you has been saved. You can delete the account now.',
  'onboarding.age.deleteAccount': 'Delete account',
  'onboarding.sex.title': 'Sex',
  'onboarding.sex.FEMALE': 'Female',
  'onboarding.sex.MALE': 'Male',
  'onboarding.height.title': 'How tall are you?',
  'onboarding.height.cm': 'Height (cm)',
  'onboarding.height.ft': 'Feet',
  'onboarding.height.in': 'Inches',
  'onboarding.weight.title': 'What is your current weight?',
  'onboarding.weight.kg': 'Weight (kg)',
  'onboarding.weight.lb': 'Weight (lb)',
  'onboarding.units.metric': 'cm / kg',
  'onboarding.units.imperial': 'ft / lb',
  'onboarding.units.label': 'Units',
  'onboarding.name.title': 'What should we call you?',
  'onboarding.name.label': 'Display name',
  'onboarding.name.hint': 'Optional. Otherwise we use your username.',
  'onboarding.plan.placeholderTitle': 'Add your plan',
  'onboarding.plan.placeholderBody': 'Plan import arrives in the next step of the build.',
  'onboarding.plan.continueToToday': 'Continue to Today',
  'onboarding.plan.noPlanYet': "I don't have a plan yet",
  'onboarding.errors.incomplete':
    'Age, sex, height, weight and time zone are needed before continuing.',

  // ── Home ───────────────────────────────────────────────────
  'home.title': 'Dashboard',
  'home.welcome': 'Welcome, {name}',
  'home.gettingStarted.title': 'Get started',
  'home.gettingStarted.description':
    'This dashboard is ready to customize. Add your modules and update the content of this page.',

  // ── Component library ──────────────────────────────────────
  'components.title': 'Component Library',

  // ── Admin › Users ──────────────────────────────────────────
  'users.title': 'User Management',
  'users.subtitle': 'Create, edit and deactivate accounts',
  'users.empty': 'No users yet.',
  'users.you': '(you)',
  'users.role.ADMIN': 'Admin',
  'users.role.USER': 'User',
  'users.status.active': 'Active',
  'users.status.inactive': 'Inactive',
  'users.column.fullName': 'Full name',
  'users.column.username': 'Username',
  'users.column.role': 'Role',
  'users.column.status': 'Status',
  'users.column.lastLogin': 'Last login',
  'users.column.actions': 'Actions',
  'users.rowActions': 'Actions for {name}',
  'users.action.new': 'New user',
  'users.action.edit': 'Edit',
  'users.action.resetPassword': 'Reset password',
  'users.action.deactivate': 'Deactivate',
  'users.action.activate': 'Activate',
  'users.action.cancel': 'Cancel',
  'users.action.save': 'Save',
  'users.action.create': 'Create user',
  'users.action.reset': 'Reset',
  'users.field.fullName': 'Full name',
  'users.field.username': 'Username',
  'users.field.usernameHint': 'Latin letters, digits, dot, dash and underscore',
  'users.field.password': 'Password',
  'users.field.newPassword': 'New password',
  'users.field.role': 'Role',
  'users.field.ownRoleHint': 'You cannot change your own role',
  'users.create.title': 'New user',
  'users.create.description': 'Create an account that can sign in to the application.',
  'users.edit.title': 'Edit user',
  'users.reset.title': 'Reset password',
  'users.reset.description':
    'Set a new password for “{name}”. All of their active sessions will be closed.',
  'users.toast.created': 'User created',
  'users.toast.saved': 'Changes saved',
  'users.toast.passwordReset': 'Password reset; the user must sign in again',
  'users.toast.deactivated': 'User deactivated',
  'users.toast.activated': 'User activated',
  'users.errors.usernameTaken': 'This username is already taken.',
  'users.errors.notFound': 'User not found.',
  'users.errors.cannotChangeOwnRole': "You can't change your own role.",
  'users.errors.cannotDeactivateSelf': "You can't deactivate your own account.",

  // ── Validation (zod messages, shared by server and client) ─
  'validation.required': 'This field is required',
  'validation.invalid': 'Invalid input',
  'validation.usernameRequired': 'Username is required',
  'validation.passwordRequired': 'Password is required',
  'validation.usernameMin': 'Username must be at least {min} characters',
  'validation.usernameMax': 'Username must be at most {max} characters',
  'validation.usernameChars': 'Only Latin letters, digits, dot, dash and underscore',
  'validation.passwordMin': 'Password must be at least {min} characters',
  'validation.passwordMax': 'Password must be at most {max} characters',
  'validation.fullNameMin': 'Full name is required',
  'validation.fullNameMax': 'Full name must be at most {max} characters',
  'validation.roleInvalid': 'Invalid role',
  'validation.userIdInvalid': 'Invalid user id',
  'validation.signupUsernameChars': 'Only letters, digits and underscore',
  'validation.passwordTooLong': 'Password is too long (72 bytes at most)',
  'validation.passwordCommon': 'That password is too common. Choose something less guessable.',
  'validation.numberRequired': 'Enter a number',
  'validation.ageWhole': 'Enter your age in whole years',
  'validation.ageRange': 'Enter an age between 1 and 120',
  'validation.heightRange': 'Enter a height between 100 and 250 cm',
  'validation.weightRange': 'Enter a weight between 30 and 300 kg',
  'validation.displayNameMax': 'Display name must be at most {max} characters',
  'validation.dateInvalid': 'Enter a valid date',
  'validation.goalMax': 'Goal must be at most {max} characters',

  // ── Generic action errors ──────────────────────────────────
  'errors.unexpected': 'Something unexpected happened. Please try again.',
  'errors.notFound': 'Not found.',
  'errors.conflict': 'This was updated somewhere else. Reload to see the latest version.',
  'settings.account.wrongPassword': 'The current password is not correct.',
  'settings.privacy.deleteMismatch': 'Type your username exactly to confirm.',
  'auth.errors.tooManyAttempts': 'Too many failed attempts. Try again in {minutes} minutes.',

  // ── Error boundary ─────────────────────────────────────────
  'error.title': 'Something went wrong',
  'error.description': 'We couldn’t load this page. Please try again.',
  'error.code': 'Error code: {digest}',
  'error.retry': 'Try again',

  // ── Not found ──────────────────────────────────────────────
  'notFound.code': '404',
  'notFound.title': 'Page not found',
  'notFound.description': 'The page you’re looking for doesn’t exist or has been moved.',
  'notFound.backHome': 'Back to home',

  // ── UI primitives ──────────────────────────────────────────
  'ui.close': 'Close',
  'ui.loading': 'Loading',
  'ui.pagination.label': 'Pagination',
  'ui.pagination.previous': 'Previous',
  'ui.pagination.next': 'Next',
  'ui.pagination.morePages': 'More pages',
  'ui.itemCount.one': '{count} item',
  'ui.itemCount.other': '{count} items',
  'ui.datePicker.placeholder': 'Pick a date',
  'ui.datePicker.rangePlaceholder': 'Pick a date range',
  'ui.datePicker.rangeLabel': '{from} – {to}',
} as const;
