"use client";

import { useEffect } from "react";
import type { FormEvent, ReactNode } from "react";
import { toLatinDigits } from "@/lib/locale";

type EditableElement = HTMLInputElement | HTMLTextAreaElement;

const LATIN_NUMERIC_INPUT_SELECTOR = [
  'input[type="number"]',
  'input[type="tel"]',
  'input[type="date"]',
  'input[type="time"]',
  'input[type="datetime-local"]',
  'input[type="month"]',
  'input[type="week"]',
  'input[inputmode="numeric"]',
  'input[inputmode="decimal"]',
  'input[inputmode="tel"]',
].join(",");

function markNumericInputs(root: ParentNode) {
  const inputs: HTMLInputElement[] = [];

  if (
    root instanceof HTMLInputElement &&
    root.matches(LATIN_NUMERIC_INPUT_SELECTOR)
  ) {
    inputs.push(root);
  }

  root
    .querySelectorAll<HTMLInputElement>(LATIN_NUMERIC_INPUT_SELECTOR)
    .forEach((input) => inputs.push(input));

  inputs.forEach((input) => {
    input.lang = "en";
    input.dir = "ltr";
  });
}

function normalizeEditableValue(element: EditableElement) {
  if (element instanceof HTMLInputElement && element.type === "password") {
    return;
  }

  const normalizedValue = toLatinDigits(element.value);
  if (normalizedValue === element.value) return;

  const selectionStart = element.selectionStart;
  const selectionEnd = element.selectionEnd;
  const selectionDirection = element.selectionDirection;

  element.value = normalizedValue;

  if (selectionStart === null || selectionEnd === null) return;

  try {
    element.setSelectionRange(
      selectionStart,
      selectionEnd,
      selectionDirection ?? "none",
    );
  } catch {
    // Native number and date inputs do not expose a selectable text range.
  }
}

export default function LatinDigitsInputBoundary({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    markNumericInputs(document);

    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) markNumericInputs(node);
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  function handleInputCapture(event: FormEvent<HTMLDivElement>) {
    const target = event.target;

    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement
    ) {
      normalizeEditableValue(target);
    }
  }

  return (
    <div className="contents" onInputCapture={handleInputCapture}>
      {children}
    </div>
  );
}
