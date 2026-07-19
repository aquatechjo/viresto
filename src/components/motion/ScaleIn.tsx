"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import type { PropsWithChildren } from "react";
import { motionSpring } from "@/lib/motion";

type ScaleInProps = PropsWithChildren<HTMLMotionProps<"div"> & { delay?: number }>;

export function ScaleIn({ children, delay = 0, ...props }: ScaleInProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduceMotion ? { duration: 0 } : { ...motionSpring.gentle, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
