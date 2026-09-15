'use client';

import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/UiComponents';
import { useTheme } from '@/lib/theme';
import { t } from '@/lib/t';

export function ThemeToggle() {
  const { isDark, toggle } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
