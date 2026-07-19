"use client";

import { animate, useMotionValue, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

type AnimatedCounterProps = {
  value: number;
  duration?: number;
  formatter?: (value: number) => string;
  className?: string;
};

export function AnimatedCounter({
  value,
  duration = 0.7,
  formatter,
  className,
}: AnimatedCounterProps) {
  const reduceMotion = useReducedMotion();
  const defaultFormatter = useMemo(
    () => (current: number) =>
      new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(current),
    [],
  );
  const format = formatter ?? defaultFormatter;
  const motionValue = useMotionValue(reduceMotion ? value : 0);
  const [displayValue, setDisplayValue] = useState(format(reduceMotion ? value : 0));

  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value);
      setDisplayValue(format(value));
      return;
    }

    const controls = animate(motionValue, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplayValue(format(latest)),
    });

    return () => controls.stop();
  }, [duration, format, motionValue, reduceMotion, value]);

  return <span className={className}>{displayValue}</span>;
}
