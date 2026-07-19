"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import type { PropsWithChildren } from "react";
import { motionDuration, motionEase } from "@/lib/motion";

type FadeInProps = PropsWithChildren<HTMLMotionProps<"div"> & {
  delay?: number;
  duration?: number;
}>;

export function FadeIn({ children, delay = 0, duration = motionDuration.normal, ...props }: FadeInProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: reduceMotion ? 0 : duration,
        delay: reduceMotion ? 0 : delay,
        ease: motionEase.standard,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
