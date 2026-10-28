"use client";
import { useState } from "react";
import type { Position } from "@/lib/planning-data";
import { cashForecast, scenarioAmount } from "@/lib/insights";
import { formatMoney } from "@/lib/money";

export function CashForecast({
  positions,
  currency,
  through,
}: {
  positions: Position[];
  currency: string;
  through: string;
}) {
  const [income, setIncome] = useState("0");
  const [spending, setSpending] = useState("0");
  let error = "";
  let expected = "0",
    extra = "0";
  try {
    expected = scenarioAmount(income, currency);
    extra = scenarioAmount(spending, currency);
  } catch {
    error = `Enter zero or a positive ${currency} amount${currency === "JPY" ? " with no decimal places" : " with at most two decimal places"}.`;
  }
  const forecast = cashForecast(positions, expected, extra);
  return (
    <section className="panel" aria-labelledby="forecast-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">LOOK AHEAD</p>
          <h2 id="forecast-heading">30-day cash-flow forecast</h2>
          <p>Through {through} · includes unpaid overdue obligations</p>
        </div>
        <span className="pill">What-if scenario</span>
      </div>
      <p>
        Start with recorded cash, then subtract recorded bills and estimated
        debt minimums. Add only income you expect to receive and spending beyond
        those obligations. These assumptions stay on this page and do not change
        your records.
      </p>
      <div className="form-row">
        <label>
          Expected additional income ({currency})
          <input
            inputMode="decimal"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? "forecast-error" : undefined}
          />
        </label>
        <label>
          Other expected spending ({currency})
          <input
            inputMode="decimal"
            value={spending}
            onChange={(e) => setSpending(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? "forecast-error" : undefined}
          />
        </label>
      </div>
      {error ? (
        <p id="forecast-error" className="error" role="alert">
          {error}
        </p>
      ) : (
        <div aria-live="polite" aria-atomic="true">
          <dl className="forecast-breakdown">
            <div>
              <dt>Recorded cash</dt>
              <dd>{formatMoney(forecast.cash, currency)}</dd>
            </div>
            <div>
              <dt>Recorded obligations</dt>
              <dd>− {formatMoney(forecast.due, currency)}</dd>
            </div>
            <div>
              <dt>Additional income</dt>
              <dd>+ {formatMoney(expected, currency)}</dd>
            </div>
            <div>
              <dt>Other spending</dt>
              <dd>− {formatMoney(extra, currency)}</dd>
            </div>
            <div className="forecast-result">
              <dt>Estimated closing cash</dt>
              <dd>{formatMoney(forecast.closing, currency)}</dd>
            </div>
            <div>
              <dt>Estimated room after reserves</dt>
              <dd>{formatMoney(forecast.unallocated, currency)}</dd>
            </div>
          </dl>
          {forecast.unallocated.startsWith("-") && (
            <p className="error">
              This scenario leaves a shortfall after reserves and recorded
              obligations. Review your cash plan before committing more
              spending.
            </p>
          )}
        </div>
      )}
      <p className="fine muted">
        Goal reserves are not cash payments: linked reserves cover bills once.
        Room after reserves uses your cash plan’s uncovered obligations. This is
        an end-of-period estimate; payment timing can cause an earlier
        shortfall. Recorded balances include all posted entries, including
        future effective dates. Excludes unrecorded bills, new interest charges,
        exchange-rate changes, and automatic assumptions about future income.
      </p>
      {forecast.shortfalls > 0 && (
        <p className="notice">
          {forecast.shortfalls} account(s) already have a shortfall after
          reserves and obligations. Combined balances do not move money between
          accounts.
        </p>
      )}
    </section>
  );
}
