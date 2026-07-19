"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import type { PropsWithChildren } from "react";
import { motionDuration, motionEase } from "@/lib/motion";

type SlideUpProps = PropsWithChildren<HTMLMotionProps<"div"> & {
  delay?: number;
  distance?: number;
}>;

export function SlideUp({ children, delay = 0, distance = 18, ...props }: SlideUpProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : motionDuration.normal,
        delay: reduceMotion ? 0 : delay,
        ease: motionEase.entrance,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
