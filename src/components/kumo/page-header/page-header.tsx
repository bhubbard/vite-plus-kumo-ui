import type { ReactNode } from "react";
import { Tabs, type TabsItem } from "@cloudflare/kumo/components/tabs";

function classNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

export const KUMO_PAGE_HEADER_VARIANTS = {
  spacing: {
    compact: {
      classes: "gap-1",
      description: "Compact spacing between header elements",
    },
    base: {
      classes: "gap-2",
      description: "Default spacing between header elements",
    },
    relaxed: {
      classes: "gap-4",
      description: "Relaxed spacing for more prominent headers",
    },
  },
} as const;

export const KUMO_PAGE_HEADER_DEFAULT_VARIANTS = {
  spacing: "base",
} as const;

export type KumoPageHeaderSpacing =
  keyof typeof KUMO_PAGE_HEADER_VARIANTS.spacing;

export interface KumoPageHeaderVariantsProps {
  spacing?: KumoPageHeaderSpacing;
}

export function pageHeaderVariants({
  spacing = KUMO_PAGE_HEADER_DEFAULT_VARIANTS.spacing,
}: KumoPageHeaderVariantsProps = {}) {
  return classNames(
    "flex flex-col",
    KUMO_PAGE_HEADER_VARIANTS.spacing[spacing].classes,
  );
}

export interface PageHeaderProps extends KumoPageHeaderVariantsProps {
  breadcrumbs?: ReactNode;
  title?: string;
  description?: string;
  tabs?: TabsItem[];
  defaultTab?: string;
  value?: string;
  selectedValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children?: ReactNode;
}

export function PageHeader({
  breadcrumbs,
  title,
  description,
  tabs,
  defaultTab,
  value,
  selectedValue,
  onValueChange,
  spacing = "base",
  className,
  children,
}: PageHeaderProps) {
  const activeTabValue = value ?? selectedValue ?? defaultTab;

  return (
    <div className={classNames(pageHeaderVariants({ spacing }), className)}>
      {breadcrumbs && <div className="border-b border-kumo-line">{breadcrumbs}</div>}

      {(title || description) && (
        <div className="flex flex-col gap-2 py-3 pl-3">
          {title && (
            <h1 className="font-sans text-3xl font-semibold text-kumo-default">
              {title}
            </h1>
          )}
          {description && (
            <p className="max-w-prose text-base text-kumo-subtle">
              {description}
            </p>
          )}
        </div>
      )}

      {(tabs || children) && (
        <div className="flex w-full items-center justify-between border-b border-kumo-line pt-1 pb-3 pl-3">
          {tabs ? (
            <Tabs
              tabs={tabs}
              selectedValue={activeTabValue}
              onValueChange={(nextValue) => {
                const stringValue = String(nextValue);
                onValueChange?.(stringValue);
              }}
            />
          ) : (
            <div />
          )}

          {children && <div className="flex items-center gap-2">{children}</div>}
        </div>
      )}
    </div>
  );
}
