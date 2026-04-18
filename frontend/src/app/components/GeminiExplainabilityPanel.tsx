/**
 * GeminiExplainabilityPanel.tsx
 *
 * Drop-in replacement for the SHAP block in AdminLoanApplications.
 * Renders Gemini-generated bullet explanations + three data charts.
 *
 * Props:
 *   loan         - the raw loan object from the admin list
 *   explainability - the /explainability API response
 *   geminiExplanation - string[] | null from creditController response
 */

import { useEffect, useRef } from "react";

interface GeminiExplainabilityPanelProps {
  loan: any;
  explainability: any;
  geminiExplanation?: string[] | null;
}

// ─── Tiny chart primitives (no Chart.js needed — pure SVG) ──────────────────

function MiniGauge({ value, max = 100, label, color }: { value: number; max?: number; label: string; color: string }) {
  const pct   = Math.min(1, Math.max(0, value / max));
  const r     = 28;
  const circ  = 2 * Math.PI * r;
  const dash  = pct * circ;
  const gap   = circ - dash;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="600" fill="white">
          {Math.round(value)}
        </text>
      </svg>
      <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
  );
}

function HBar({ label, value, max, positive }: { label: string; value: number; max: number; positive: boolean }) {
  const pct = Math.min(100, Math.max(0, (Math.abs(value) / Math.max(max, 0.001)) * 100));
  const barColor = positive ? "#4ade80" : "#f87171";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
      <div style={{ minWidth: "110px", maxWidth: "110px", fontSize: "10px", color: "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={label}>
        {label}
      </div>
      <div style={{ flex: 1, height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: "3px", transition: "width 0.5s ease" }} />
      </div>
      <div style={{ minWidth: "36px", textAlign: "right", fontSize: "10px", fontWeight: 700, color: barColor }}>
        {positive ? "+" : ""}{value.toFixed(2)}
      </div>
    </div>
  );
}

function RiskRadar({ probability, socialScore, riskLevel }: { probability: number; socialScore: number; riskLevel: string }) {
  const defaultPct = Math.round((1 - probability) * 100);
  const repayPct   = Math.round(probability * 100);

  const segments = [
    { label: "Repayment",    value: repayPct,    color: "#4ade80" },
    { label: "Social trust", value: socialScore,  color: "#60a5fa" },
    { label: "Safety",       value: 100 - defaultPct, color: riskLevel === "low" ? "#4ade80" : riskLevel === "medium" ? "#fbbf24" : "#f87171" },
  ];

  return (
    <div style={{ display: "flex", gap: "16px", alignItems: "center", justifyContent: "center", padding: "8px 0" }}>
      {segments.map((s) => (
        <MiniGauge key={s.label} value={s.value} max={100} label={s.label} color={s.color} />
      ))}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function GeminiExplainabilityPanel({ loan, explainability, geminiExplanation }: GeminiExplainabilityPanelProps) {
  const probability   = typeof explainability?.probabilityOfDefault === "number"
    ? 1 - explainability.probabilityOfDefault  // convert PD to repayment prob
    : 0.5;
  const socialScore   = loan?.rawLoan?.aiAnalysis?.creditScore
    ? Math.round(((loan.rawLoan.aiAnalysis.creditScore - 300) / 550) * 100)
    : 55;
  const riskLevel     = (explainability?.riskLevel || loan?.riskLevel || "medium").toLowerCase();
  const creditScore   = loan?.riskScore ?? 600;
  const loanAmount    = loan?.loanAmount ?? 0;
  const decidedAmount = loan?.decidedAmount ?? 0;

  // Pull SHAP features if present (used for bar chart fallback)
  const shapFeatures: Array<{ name: string; shapValue: number }> =
    explainability?.alternate?.mlShap?.topFeatures?.slice(0, 5) ?? [];

  const SHAP_LABELS: Record<string, string> = {
    income_monthly: "Monthly income", income_log: "Income level", emi_to_income_cs: "EMI burden",
    debt_to_income_cs: "Debt-to-income", avg_delay_days: "Payment delays", hc_ext_source_mean: "External credit",
    hc_install_late_ratio: "Late instalments", payment_stress_index: "Repayment stress",
    job_tenure_ratio: "Job tenure", transaction_consistency: "Tx consistency",
    platform_trust_score: "Platform trust", has_bank_account: "Bank account",
    utility_payment_score: "Utility payments", cashflow_stability: "Cashflow stability",
    payment_discipline: "Payment discipline", capacity_score: "Capacity score",
    completeness_score: "Data completeness", trust_score: "Trust score",
    fraud_risk: "Fraud risk",
  };

  function shapLabel(name: string) {
    return SHAP_LABELS[name] ?? name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const maxShap = shapFeatures.length > 0
    ? Math.max(...shapFeatures.map((f) => Math.abs(f.shapValue)), 0.001)
    : 0.001;

  // Fallback bullets if Gemini didn't respond
  const fallbackBullets = [
    `ML model assigned a ${Math.round(probability * 100)}% repayment probability for this applicant.`,
    `Social trust score of ${socialScore}/100 ${socialScore >= 60 ? "positively supports" : "has limited impact on"} the blended assessment.`,
    `Credit score of ${creditScore} places this applicant in the ${riskLevel} risk band.`,
    `Approved eligible amount of ₹${decidedAmount.toLocaleString("en-IN")} against ₹${loanAmount.toLocaleString("en-IN")} requested.`,
  ];

  const bullets: string[] = Array.isArray(geminiExplanation) && geminiExplanation.length >= 2
    ? geminiExplanation
    : fallbackBullets;

  const isGeminiFallback = !Array.isArray(geminiExplanation) || geminiExplanation.length < 2;

  const riskColor = riskLevel === "low" ? "#4ade80" : riskLevel === "medium" ? "#fbbf24" : "#f87171";

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>

      {/* ── Gauge row ─────────────────────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "16px", marginBottom: "16px" }}>
        <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.2em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "12px" }}>
          Risk signal overview
        </p>
        <RiskRadar probability={probability} socialScore={socialScore} riskLevel={riskLevel} />
      </div>

      {/* ── SHAP bar chart (if data present) ─────────────────────────── */}
      {shapFeatures.length > 0 && (
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "16px", marginBottom: "16px" }}>
          <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.2em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "10px" }}>
            Top feature contributions (SHAP)
          </p>
          {shapFeatures.map((f) => (
            <HBar
              key={f.name}
              label={shapLabel(f.name)}
              value={f.shapValue}
              max={maxShap}
              positive={f.shapValue > 0}
            />
          ))}
          <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "9px", color: "rgba(255,255,255,0.35)" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#f87171" }} /> Increases default risk
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "9px", color: "rgba(255,255,255,0.35)" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#4ade80" }} /> Reduces default risk
            </span>
          </div>
        </div>
      )}

      {/* ── Loan vs eligible amount bar ───────────────────────────────── */}
      {loanAmount > 0 && (
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "16px", marginBottom: "16px" }}>
          <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.2em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "10px" }}>
            Amount coverage
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>Requested</span>
            <span style={{ fontSize: "10px", color: "white", fontWeight: 600 }}>₹{loanAmount.toLocaleString("en-IN")}</span>
          </div>
          <div style={{ height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", marginBottom: "8px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: "100%", background: "rgba(255,255,255,0.15)", borderRadius: "4px" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>Eligible</span>
            <span style={{ fontSize: "10px", color: riskColor, fontWeight: 600 }}>₹{decidedAmount.toLocaleString("en-IN")}</span>
          </div>
          <div style={{ height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${Math.min(100, (decidedAmount / Math.max(loanAmount, 1)) * 100)}%`,
              background: riskColor,
              borderRadius: "4px",
              transition: "width 0.6s ease",
            }} />
          </div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginTop: "6px", textAlign: "right" }}>
            {Math.round((decidedAmount / Math.max(loanAmount, 1)) * 100)}% coverage ratio
          </p>
        </div>
      )}

      {/* ── Gemini bullets ────────────────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.2em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", margin: 0 }}>
            AI decision reasoning
          </p>
          {isGeminiFallback ? (
            <span style={{ fontSize: "8px", background: "rgba(251,191,36,0.15)", color: "#fbbf24", padding: "1px 6px", borderRadius: "3px", letterSpacing: "0.1em" }}>
              RULE-BASED
            </span>
          ) : (
            <span style={{ fontSize: "8px", background: "rgba(96,165,250,0.15)", color: "#60a5fa", padding: "1px 6px", borderRadius: "3px", letterSpacing: "0.1em" }}>
              GEMINI
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {bullets.map((bullet, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                gap: "10px",
                padding: "9px 10px",
                background: "rgba(255,255,255,0.04)",
                borderLeft: `2px solid ${idx === 0 ? riskColor : "rgba(255,255,255,0.1)"}`,
                borderRadius: "0 4px 4px 0",
              }}
            >
              <span style={{ fontSize: "10px", fontWeight: 700, color: riskColor, minWidth: "16px", marginTop: "1px" }}>
                {idx + 1}.
              </span>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.8)", lineHeight: "1.5", fontWeight: 400 }}>
                {bullet}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}