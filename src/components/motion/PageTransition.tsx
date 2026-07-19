"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import type { PropsWithChildren } from "react";
import { motionDuration, motionEase } from "@/lib/motion";

type PageTransitionProps = PropsWithChildren<HTMLMotionProps<"main">>;

export function PageTransition({ children, ...props }: PageTransitionProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.main
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
      transition={{ duration: reduceMotion ? 0 : motionDuration.fast, ease: motionEase.standard }}
      {...props}
    >
      {children}
    </motion.main>
  );
}
