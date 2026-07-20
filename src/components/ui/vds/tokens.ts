export const vds = {
  radius: {
    card: "24px",
    surface: "20px",
    control: "16px",
    icon: "18px",
    pill: "999px",
  },
  shadow: {
    card: "0 10px 30px rgba(15, 61, 62, 0.07)",
    control: "0 8px 20px rgba(15, 61, 62, 0.10)",
    hover: "0 18px 42px rgba(15, 61, 62, 0.12)",
    elevated: "0 24px 70px rgba(15, 61, 62, 0.16)",
  },
  motion: {
    fast: 160,
    standard: 200,
    slow: 300,
  },
  spacing: {
    section: "24px",
    card: "20px",
    compact: "12px",
  },
  tone: {
    teal: { fg: "#0f766e", soft: "rgba(20,184,166,.12)", border: "rgba(20,184,166,.24)" },
    blue: { fg: "#2563eb", soft: "rgba(59,130,246,.12)", border: "rgba(59,130,246,.24)" },
    cyan: { fg: "#0284c7", soft: "rgba(14,165,233,.12)", border: "rgba(14,165,233,.24)" },
    gold: { fg: "#b45309", soft: "rgba(245,158,11,.13)", border: "rgba(245,158,11,.26)" },
    purple: { fg: "#7c3aed", soft: "rgba(139,92,246,.12)", border: "rgba(139,92,246,.24)" },
    emerald: { fg: "#047857", soft: "rgba(16,185,129,.12)", border: "rgba(16,185,129,.24)" },
    red: { fg: "#dc2626", soft: "rgba(239,68,68,.11)", border: "rgba(239,68,68,.24)" },
    slate: { fg: "#475569", soft: "rgba(100,116,139,.10)", border: "rgba(100,116,139,.20)" },
  },
} as const;

export type VDSTone = keyof typeof vds.tone;
