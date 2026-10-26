"use client";
import { useFormStatus } from "react-dom";
export function SubmitButton({
  children,
  secondary = false,
}: {
  children: React.ReactNode;
  secondary?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={secondary ? "secondary" : undefined}
    >
      {pending ? "Saving…" : children}
    </button>
  );
}
