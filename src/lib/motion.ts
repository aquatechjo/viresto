import type { Transition, Variants } from "framer-motion";

export const motionDuration = {
  instant: 0.12,
  fast: 0.18,
  normal: 0.26,
  slow: 0.42,
  success: 0.6,
} as const;

export const motionEase = {
  standard: [0.22, 1, 0.36, 1],
  entrance: [0.16, 1, 0.3, 1],
  exit: [0.4, 0, 1, 1],
} as const;

export const motionSpring = {
  default: { type: "spring", stiffness: 320, damping: 30, mass: 0.8 },
  gentle: { type: "spring", stiffness: 220, damping: 28, mass: 0.9 },
  bouncy: { type: "spring", stiffness: 420, damping: 22, mass: 0.72 },
} satisfies Record<string, Transition>;

export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: motionDuration.normal, ease: motionEase.standard } },
};

export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: motionDuration.normal, ease: motionEase.entrance } },
};

export const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: motionSpring.gentle },
};

export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
};
