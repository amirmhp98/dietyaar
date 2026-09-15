import * as React from 'react';
import { cva } from 'class-variance-authority';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const stepperVariants = cva('flex items-center justify-between gap-2', {
  variants: {
    variant: {
      default: 'flex-row',
      vertical: 'flex-col items-start',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  activeStep: number;
  steps: {
    id: string | number;
    title: string;
    description?: string;
    icon?: React.ReactNode;
  }[];
  orientation?: 'horizontal' | 'vertical';
  onStepClick?: (stepIndex: number) => void;
}

const Stepper = React.forwardRef<HTMLDivElement, StepperProps>(
  ({ className, activeStep, steps, orientation = 'horizontal', onStepClick, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          stepperVariants({ variant: orientation === 'vertical' ? 'vertical' : 'default' }),
          className,
        )}
        {...props}
      >
        {steps.map((step, index) => {
          const isCompleted = index < activeStep;
          const isActive = index === activeStep;
          const isLast = index === steps.length - 1;
          const isClickable = onStepClick && index <= activeStep;

          return (
            <div
              key={step.id}
              className={cn(
                'flex items-center group',
                orientation === 'vertical'
                  ? 'w-full flex-row'
                  : cn('flex-col md:flex-row', isLast ? 'flex-none' : 'flex-1'),
                isClickable ? 'cursor-pointer' : 'cursor-default',
              )}
              onClick={() => isClickable && onStepClick(index)}
            >
              <div className="flex flex-col items-center md:flex-row md:items-center relative z-10">
                <div
                  className={cn(
                    'flex size-10 items-center justify-center rounded-full border-2 transition-all duration-300',
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-110'
                      : isCompleted
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/30 bg-muted text-muted-foreground',
                  )}
                >
                  {isCompleted ? (
                    <Check className="size-5" />
                  ) : step.icon ? (
                    <div className={cn('size-5', isActive ? 'animate-pulse' : '')}>{step.icon}</div>
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>

                <div
                  className={cn(
                    'mt-2 md:mt-0 md:ms-3 flex flex-col text-center md:text-start transition-opacity duration-300',
                    isActive ? 'opacity-100' : 'opacity-70',
                  )}
                >
                  <span
                    className={cn(
                      'text-sm font-medium transition-colors duration-300',
                      isActive ? 'font-bold text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {step.title}
                  </span>
                  {step.description && (
                    <span className="hidden md:block text-xs text-muted-foreground/80 mt-0.5">
                      {step.description}
                    </span>
                  )}
                </div>
              </div>

              {!isLast && (
                <div
                  className={cn(
                    'flex-1 transition-all duration-500',
                    orientation === 'vertical'
                      ? 'absolute start-5 top-10 h-full w-0.5 -translate-x-1/2 bg-border'
                      : 'hidden md:block h-0.5 w-full mx-4 bg-border',
                  )}
                >
                  <div
                    className={cn(
                      'h-full w-full bg-primary transition-all duration-500 origin-right',
                      isCompleted ? 'scale-x-100' : 'scale-x-0',
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  },
);
Stepper.displayName = 'Stepper';

// Simple Dot Stepper
const DotStepper = React.forwardRef<HTMLDivElement, StepperProps>(
  ({ className, activeStep, steps, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('flex items-center justify-center gap-2', className)} {...props}>
        {steps.map((step, index) => {
          const isActive = index === activeStep;
          return (
            <div
              key={step.id}
              className={cn(
                'h-2.5 rounded-full transition-all duration-300',
                isActive ? 'w-8 bg-primary' : 'w-2.5 bg-primary/20 hover:bg-primary/40',
              )}
              title={step.title}
            />
          );
        })}
      </div>
    );
  },
);
DotStepper.displayName = 'DotStepper';

// Progress Bar Stepper
const ProgressStepper = React.forwardRef<HTMLDivElement, StepperProps>(
  ({ className, activeStep, steps, ...props }, ref) => {
    const progress = Math.min(100, Math.max(0, (activeStep / (steps.length - 1)) * 100));

    return (
      <div ref={ref} className={cn('w-full space-y-2', className)} {...props}>
        <div className="flex justify-between text-xs font-medium text-muted-foreground mb-2">
          <span>{steps[activeStep].title}</span>
          <span>
            {activeStep + 1} / {steps.length}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-500 ease-in-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  },
);
ProgressStepper.displayName = 'ProgressStepper';

export { Stepper, DotStepper, ProgressStepper };
