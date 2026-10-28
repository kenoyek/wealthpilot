"use client";
import { useActionState } from "react";
import { deleteAccount } from "@/app/account/actions";
import { SubmitButton } from "./submit-button";
export function DeleteAccountForm() {
  const [result, action, pending] = useActionState<
    { error?: string },
    FormData
  >(async (_, data) => deleteAccount(data), {});
  return (
    <form
      className="account-deletion-form"
      action={action}
      onReset={(e) => e.preventDefault()}
    >
      {result.error && (
        <p className="error" role="alert">
          {result.error}
        </p>
      )}
      <fieldset className="transaction-fields" disabled={pending}>
        <label>
          Current password
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        <label>
          Type DELETE MY ACCOUNT
          <input
            name="confirmation"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </label>
        <SubmitButton pendingLabel="Deleting account…">
          Permanently delete my account
        </SubmitButton>
      </fieldset>
    </form>
  );
}
