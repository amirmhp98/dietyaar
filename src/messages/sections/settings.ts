/** Strings owned by the settings module. Keys are flat and globally unique; add them here, not in en.ts. */
export const settings = {
  'settings.title': 'Settings',
  'settings.save': 'Save',
  'settings.saving': 'Saving…',
  'settings.saved': 'Saved',
  'settings.cancel': 'Cancel',
  'settings.edit': 'Edit',

  'settings.profile.title': 'Profile',
  'settings.profile.age': 'Age',
  'settings.profile.sex': 'Sex',
  'settings.profile.height': 'Height',
  'settings.profile.weight': 'Current weight',
  'settings.profile.weightMeasuredAt': 'Measured on',
  'settings.profile.displayName': 'Display name',
  'settings.profile.displayNameHint': 'Used in greetings. Otherwise we use your username.',
  'settings.profile.goal': 'Goal',
  'settings.profile.goalHint': 'Shown on My plan only. Not sent to the AI.',
  'settings.profile.restrictions': 'Restrictions',
  'settings.profile.restrictionsHint':
    'One per line, e.g. walnuts. Used only for a neutral reminder in Check your meal when a recorded item matches.',
  'settings.profile.years.one': '{count} year',
  'settings.profile.years.other': '{count} years',
  'settings.profile.notSet': 'Not set',

  'settings.preferences.title': 'Preferences',
  'settings.preferences.units': 'Units',
  'settings.preferences.units.METRIC': 'Metric (cm, kg)',
  'settings.preferences.units.IMPERIAL': 'Imperial (ft, lb)',
  'settings.preferences.weekStart': 'Week starts on',
  'settings.preferences.weekStartHint': 'Used for weekly plan rules.',
  'settings.preferences.appearance': 'Appearance',
  'settings.preferences.appearance.SYSTEM': 'System',
  'settings.preferences.appearance.LIGHT': 'Light',
  'settings.preferences.appearance.DARK': 'Dark',

  'settings.account.changePassword': 'Change password',
  'settings.account.changePassword.description': 'Other devices will be signed out.',
  'settings.account.currentPassword': 'Current password',
  'settings.account.newPassword': 'New password',
  'settings.account.passwordChanged': 'Password changed. Other devices were signed out.',

  'settings.privacy.title': 'Privacy & data',
  'settings.privacy.aiIntro': 'What is sent to the AI service, and when:',
  'settings.privacy.aiPlan':
    'Plan import: your pasted plan text, with your age, sex, height and weight as context.',
  'settings.privacy.aiMeal':
    'Meal analysis: the description or photo of the meal. No profile fields.',
  'settings.privacy.aiReflection':
    'Daily reflection: the comparison facts of the previous day, with your age, sex, height and weight for tone only.',
  'settings.privacy.export': 'Export my data',
  'settings.privacy.exportHint': 'A zip with your profile, plan, meals, reflections and photos.',
  'settings.privacy.delete': 'Delete account',
  'settings.privacy.deleteTitle': 'Delete your account?',
  'settings.privacy.deleteDescription':
    'Access ends immediately. Your records and photos are deleted within 7 days and backups expire within 30 days. This cannot be undone. Type your username to confirm.',
  'settings.privacy.deleteConfirmLabel': 'Username',
  'settings.privacy.deleteAction': 'Delete my account',
  'settings.privacy.deleted': 'Your account is scheduled for deletion.',
} as const;
