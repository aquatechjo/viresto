"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { HTMLMotionProps, Variants } from "framer-motion";
import type { PropsWithChildren } from "react";

type StaggerProps = PropsWithChildren<
  HTMLMotionProps<"div"> & {
    stagger?: number;
    delayChildren?: number;
  }
>;

export function Stagger({
  children,
  stagger = 0.06,
  delayChildren = 0.02,
  ...props
}: StaggerProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: reduceMotion ? 0 : stagger,
            delayChildren: reduceMotion ? 0 : delayChildren,
          },
        },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export const staggerItem: Variants = {
  hidden: {
    opacity: 0,
    y: 14,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.26,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};