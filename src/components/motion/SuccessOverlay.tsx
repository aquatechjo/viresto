"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect } from "react";
import { motionEase, motionSpring } from "@/lib/motion";

type SuccessOverlayProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose?: () => void;
  autoCloseMs?: number;
};

export function SuccessOverlay({
  open,
  title,
  description,
  onClose,
  autoCloseMs = 1400,
}: SuccessOverlayProps) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open || !onClose || autoCloseMs <= 0) return;
    const timeoutId = window.setTimeout(onClose, autoCloseMs);
    return () => window.clearTimeout(timeoutId);
  }, [autoCloseMs, onClose, open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-5 backdrop-blur-sm"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
          role="status"
          aria-live="polite"
        >
          <motion.div
            className="card w-full max-w-sm p-7 text-center shadow-2xl"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={reduceMotion ? { duration: 0 } : motionSpring.gentle}
          >
            <motion.div
              className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-600"
              initial={reduceMotion ? false : { scale: 0.5, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={reduceMotion ? { duration: 0 } : { ...motionSpring.bouncy, delay: 0.05 }}
            >
              <Check className="h-8 w-8" strokeWidth={2.6} />
            </motion.div>

            <motion.h2
              className="mt-5 text-xl font-black"
              style={{ color: "var(--text)" }}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduceMotion ? 0 : 0.25,
                delay: reduceMotion ? 0 : 0.12,
                ease: motionEase.entrance,
              }}
            >
              {title}
            </motion.h2>

            {description ? (
              <motion.p
                className="mt-2 text-sm leading-6"
                style={{ color: "var(--text-3)" }}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.25,
                  delay: reduceMotion ? 0 : 0.18,
                }}
              >
                {description}
              </motion.p>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
