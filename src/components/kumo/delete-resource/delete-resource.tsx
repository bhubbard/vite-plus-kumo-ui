import { useState, useCallback, useEffect } from "react";
import { Banner } from "@cloudflare/kumo/components/banner";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog, DialogRoot, DialogTitle, DialogClose } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";

function classNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}
import {
  CheckIcon,
  CopyIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";

export const KUMO_DELETE_RESOURCE_VARIANTS = {
  size: {
    sm: {
      classes: "",
      description: "Small dialog for simple delete confirmations",
    },
    base: {
      classes: "",
      description: "Default delete confirmation dialog size",
    },
    lg: {
      classes: "",
      description: "Large delete confirmation dialog size",
    },
    xl: {
      classes: "",
      description: "Extra large delete confirmation dialog size",
    },
  },
} as const;

export const KUMO_DELETE_RESOURCE_DEFAULT_VARIANTS = {
  size: "base",
} as const;

export type KumoDeleteResourceSize =
  keyof typeof KUMO_DELETE_RESOURCE_VARIANTS.size;

export interface KumoDeleteResourceVariantsProps {
  size?: KumoDeleteResourceSize;
}

export interface DeleteResourceProps extends KumoDeleteResourceVariantsProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** The type of resource being deleted (e.g., "Zone", "Worker", "KV Namespace") */
  resourceType: string;
  /** The name of the specific resource being deleted */
  resourceName: string;
  /** Callback when delete is confirmed */
  onDelete: () => void | Promise<void>;
  /** Whether the delete action is in progress */
  isDeleting?: boolean;
  /** Whether the confirmation input should be case-sensitive (default: true) */
  caseSensitive?: boolean;
  /** Custom delete button text (defaults to "Delete {resourceType}") */
  deleteButtonText?: string;
  /** Additional className for the dialog */
  className?: string;
  /** Error message to display if the delete action fails */
  errorMessage?: string;
}

export function DeleteResource({
  open,
  onOpenChange,
  resourceType,
  resourceName,
  onDelete,
  isDeleting = false,
  caseSensitive = true,
  deleteButtonText,
  size = KUMO_DELETE_RESOURCE_DEFAULT_VARIANTS.size,
  errorMessage,
  className,
}: DeleteResourceProps) {
  const [confirmationInput, setConfirmationInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [operationMessage, setOperationMessage] = useState("");

  useEffect(() => {
    if (!open) {
      setConfirmationInput("");
      setCopied(false);
      setOperationMessage("");
    }
  }, [open]);

  const normalizeForComparison = useCallback(
    (str: string) => (caseSensitive ? str : str.toLowerCase()),
    [caseSensitive],
  );

  const isConfirmed =
    normalizeForComparison(confirmationInput) ===
    normalizeForComparison(resourceName);

  const handleDelete = useCallback(async () => {
    if (!isConfirmed || isDeleting) return;
    try {
      await onDelete();
      setOperationMessage(`${resourceType} ${resourceName} was deleted successfully.`);
    } catch (err) {
      console.error("Failed to delete resource:", err);
      setOperationMessage(`${resourceType} ${resourceName} could not be deleted. Please try again.`);
    }
  }, [isConfirmed, isDeleting, onDelete, resourceName, resourceType]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(resourceName);
      setCopied(true);
      setOperationMessage(`${resourceName} copied to clipboard.`);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy resource name to clipboard:", err);
      setOperationMessage(`${resourceName} could not be copied to the clipboard.`);
    }
  }, [resourceName]);

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <Dialog size={size} className={classNames("p-0", className)}>
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {operationMessage}
        </div>
        <div className="flex items-center justify-between border-b border-kumo-line px-6 py-4">
          <DialogTitle className="text-lg font-semibold">
            Delete {resourceName}
          </DialogTitle>
          <DialogClose
            render={(props) => (
              <Button
                {...props}
                variant="ghost"
                shape="square"
                size="sm"
                aria-label="Close"
                disabled={isDeleting}
              >
                <XIcon size={18} />
              </Button>
            )}
          />
        </div>

        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-2">
            {errorMessage && (
              <div role="alert">
                <Banner icon={<WarningCircleIcon />} variant="error">
                  {errorMessage}
                </Banner>
              </div>
            )}
            <p className="max-w-prose text-base text-pretty text-kumo-subtle">
              This action cannot be undone. This will permanently delete the{" "}
              <span className="font-medium text-kumo-default">
                {resourceName}
              </span>{" "}
              {resourceType.toLowerCase()}.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-base">
              <span>
                Type{" "}
                <Button
                  variant="ghost"
                  size="sm"
                  className="group inline font-mono font-semibold"
                  onClick={handleCopy}
                  aria-label={`Copy ${resourceName} to clipboard`}
                >
                  {resourceName}

                  {copied ? (
                    <CheckIcon
                      size={12}
                      weight="bold"
                      className="ml-1.5 inline"
                    />
                  ) : (
                    <CopyIcon
                      size={12}
                      weight="bold"
                      className="ml-1.5 inline text-kumo-subtle group-hover:text-kumo-default"
                    />
                  )}
                </Button>{" "}
                to confirm:
              </span>
            </div>
            <Input
              placeholder={resourceName}
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              disabled={isDeleting}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label={`Type ${resourceName} to confirm deletion`}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-kumo-line px-6 py-4">
          <DialogClose
            render={(props) => (
              <Button {...props} variant="secondary" disabled={isDeleting}>
                Cancel
              </Button>
            )}
          />
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            loading={isDeleting}
          >
            {deleteButtonText || `Delete ${resourceType}`}
          </Button>
        </div>
      </Dialog>
    </DialogRoot>
  );
}

DeleteResource.displayName = "DeleteResource";
