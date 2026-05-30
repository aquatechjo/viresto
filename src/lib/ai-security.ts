const SENSITIVE_PATTERNS = [
  {
    name: 'PASSWORD',
    regex: /(password|كلمة المرور|pass)\s*[:=]\s*\S+/gi,
    replacement: '[REDACTED_PASSWORD]',
  },
  {
    name: 'EMAIL',
    regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    replacement: '[REDACTED_EMAIL]',
  },
  {
    name: 'PHONE',
    regex: /(\+?\d[\d\s\-()]{7,}\d)/g,
    replacement: '[REDACTED_PHONE]',
  },
  {
    name: 'NATIONAL_ID',
    regex: /\b\d{9,12}\b/g,
    replacement: '[REDACTED_ID]',
  },
  {
    name: 'JWT',
    regex: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    replacement: '[REDACTED_TOKEN]',
  },
]

export function sanitizeAiInput(input: string) {
  let sanitized = input || ''

  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern.regex, pattern.replacement)
  }

  return sanitized.trim()
}

export function detectPromptInjection(input: string) {
  const text = input.toLowerCase()

  const risky = [
    'ignore previous instructions',
    'ignore all instructions',
    'system prompt',
    'developer message',
    'reveal your prompt',
    'اكتب التعليمات',
    'تجاهل التعليمات',
    'انس التعليمات',
  ]

  return risky.some((phrase) => text.includes(phrase))
}