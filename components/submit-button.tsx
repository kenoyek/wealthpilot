"use client";
import { useFormStatus } from "react-dom";
export function SubmitButton({
  children,
  secondary = false,
  name,
  value,
  pendingLabel = "Saving…",
}: {
  children: React.ReactNode;
  secondary?: boolean;
  name?: string;
  value?: string;
  pendingLabel?: string;
}) {
  const { pending, data } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={secondary ? "secondary" : undefined}
    >
      {pending && (!name || data?.get(name) === value)
        ? pendingLabel
        : children}
    </button>
  );
}
