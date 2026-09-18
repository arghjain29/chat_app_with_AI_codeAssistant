import { Check, ChevronDown } from 'lucide-react';
import { Select as S } from 'radix-ui';
import { cn } from '@/lib/utils';

export interface SelectOption<V extends string> {
  value: V;
  label: string;
  /** Optional second line explaining the choice (e.g. what a role can do). */
  description?: string;
}

interface SelectProps<V extends string> {
  options: readonly SelectOption<V>[];
  value?: V;
  defaultValue?: V;
  onValueChange?: (value: V) => void;
  /** Submitted with the surrounding <form> under this name. */
  name?: string;
  /** Lets a <label htmlFor> point at the trigger. */
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Accessible custom select (Radix): keyboard navigation, type-ahead, screen-reader
 * support and native form submission, styled to match the inputs.
 */
export function Select<V extends string>({
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  id,
  placeholder = 'Select…',
  disabled,
  size = 'md',
  className,
  ...aria
}: SelectProps<V>) {
  return (
    <S.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={(v) => onValueChange?.(v as V)}
      name={name}
      disabled={disabled}
    >
      <S.Trigger
        id={id}
        {...aria}
        className={cn(
          'group inline-flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 text-left text-sm text-ink transition-colors',
          'hover:border-ink-muted/50 focus-visible:border-cobalt focus-visible:ring-2 focus-visible:ring-cobalt/25 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-60 data-[placeholder]:text-ink-muted/70',
          size === 'sm' ? 'h-9' : 'h-10',
          className,
        )}
      >
        <span className="truncate">
          <S.Value placeholder={placeholder} />
        </span>
        <S.Icon asChild>
          <ChevronDown
            className="size-4 shrink-0 text-ink-muted transition-transform duration-150 group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </S.Icon>
      </S.Trigger>

      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            'z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded-xl border border-line bg-surface shadow-lg',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
          )}
        >
          <S.Viewport className="p-1">
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                className={cn(
                  'relative flex cursor-default items-start gap-2 rounded-lg py-2 pr-3 pl-8 text-sm outline-none select-none',
                  'data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2',
                  o.description ? 'max-w-80' : '',
                )}
              >
                <S.ItemIndicator className="absolute top-2.5 left-2.5">
                  <Check className="size-3.5 text-cobalt" aria-hidden />
                </S.ItemIndicator>
                <span className="grid gap-0.5">
                  {/* Only the label is shown in the trigger once chosen. */}
                  <S.ItemText>{o.label}</S.ItemText>
                  {o.description && <span className="text-xs text-ink-muted">{o.description}</span>}
                </span>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
