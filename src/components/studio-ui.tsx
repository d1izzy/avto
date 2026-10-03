import { type ComponentProps, type ReactNode } from "react";
import { useKeyboardViewport } from "@/lib/use-keyboard-viewport";
import { Button, Dialog, DialogHeader, HStack, Text, VStack } from "@astryxdesign/core";
import { LoaderCircle } from "lucide-react";

export function Field({ label, error, ...props }: ComponentProps<"input"> & { label: string; error?: string }) {
  const id = props.id ?? props.name ?? label;
  return <VStack gap={2} as="label" className="text-sm text-primary">
    <Text weight="medium">{label}</Text>
    <input {...props} id={id} aria-label={props["aria-label"] ?? label} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : props["aria-describedby"]} className="min-h-12 w-full min-w-0 rounded-lg border border-border bg-muted px-3 text-base text-primary outline-none focus:border-accent-bg focus:ring-2 focus:ring-accent-bg/25 disabled:opacity-50" />
    {error && <Text id={`${id}-error`} className="text-error" size="sm">{error}</Text>}
  </VStack>;
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <VStack role={error ? "alert" : "status"} padding={4} className={`rounded-lg ${error ? "bg-error-muted text-error" : "bg-muted text-secondary"}`}><Text color="inherit">{children}</Text></VStack>;
}
export function Loading({ label = "Загружаем…" }: { label?: string }) {
  return <HStack gap={2} padding={6} justify="center" role="status"><LoaderCircle aria-hidden className="size-5 animate-spin text-accent" /><Text color="secondary">{label}</Text></HStack>;
}
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return <HStack gap={4} justify="between" align="start" paddingBlock={3} className="border-b border-border last:border-0"><Text color="secondary" size="sm">{label}</Text><Text weight="medium" className="text-right" size="sm">{children}</Text></HStack>;
}
export function Retry({ onClick }: { onClick: () => void }) { return <Button label="Попробовать снова" variant="secondary" onClick={onClick} />; }

export function FormDialog({ title, open, close, busy = false, children }: { title: string; open: boolean; close: () => void; busy?: boolean; children: ReactNode }) {
  const keyboardHeight = useKeyboardViewport();
  return <Dialog isOpen={open} onOpenChange={() => !busy && close()} width={600} maxHeight={keyboardHeight?.height ?? "var(--studio-dialog-height)"} position={keyboardHeight ? { top: keyboardHeight.top, start: "var(--spacing-4)", end: "var(--spacing-4)" } : undefined} purpose={busy ? "required" : "form"} padding={5}>
    <VStack gap={4} height={keyboardHeight?.height ?? "var(--studio-form-height)"} className="min-h-0">
      <DialogHeader title={title} onOpenChange={busy ? undefined : close} />
      <VStack gap={4} isScrollable className="min-h-0 flex-1 overscroll-contain pr-1 [&>*]:shrink-0">{children}</VStack>
    </VStack>
  </Dialog>;
}
