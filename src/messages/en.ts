/**
 * English (en-US) UI strings.
 *
 * Flat, dot-namespaced keys grouped by screen. Plural strings come in
 * `<base>.one` / `<base>.other` pairs and are read through `tp()`.
 * Placeholders use `{name}` and are filled by `t()` / `tp()`; their names are
 * inferred from the text, so a missing param is a type error at the call site.
 */
export const en = {
  // ── App shell ──────────────────────────────────────────────
  'shell.skipToContent': 'Skip to main content',
  'shell.logoAlt': 'Logo',
  'shell.openMenu': 'Open navigation menu',
  'shell.expandSidebar': 'Expand sidebar',
  'shell.collapseSidebar': 'Collapse sidebar',
  'shell.adminBadge': 'Admin',
  'shell.adminRole': 'System administrator',

  // ── Navigation (sidebar) ───────────────────────────────────
  'nav.menuTitle': 'Navigation menu',
  'nav.group.dashboard': 'Dashboard',
  'nav.group.tools': 'Tools',
  'nav.group.admin': 'Administration',
  'nav.home': 'Home',
  'nav.components': 'Components',
  'nav.users': 'Users',
  'nav.comingSoon': 'Coming soon',

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

  // ── Generic action errors ──────────────────────────────────
  'errors.unexpected': 'Something unexpected happened. Please try again.',
  'errors.notFound': 'Not found.',
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
