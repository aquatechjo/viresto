type TurnstileVerifyResponse = {
  success: boolean
  challenge_ts?: string
  hostname?: string
  action?: string
  cdata?: string
  "error-codes"?: string[]
}

export function getClientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    undefined
  )
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string
) {
  if (process.env.TURNSTILE_ENABLED !== "true") {
    return { success: true }
  }

  if (!process.env.TURNSTILE_SECRET_KEY) {
    console.error("[TURNSTILE_ERROR] Missing TURNSTILE_SECRET_KEY")
    return {
      success: false,
      error: "turnstile_not_configured",
    }
  }

  if (!token || typeof token !== "string") {
    return {
      success: false,
      error: "missing_turnstile_token",
    }
  }

  const formData = new FormData()
  formData.append("secret", process.env.TURNSTILE_SECRET_KEY)
  formData.append("response", token)

  if (remoteIp) {
    formData.append("remoteip", remoteIp)
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: formData,
      cache: "no-store",
    }
  )

  if (!response.ok) {
    console.error("[TURNSTILE_ERROR]", response.status)
    return {
      success: false,
      error: "turnstile_verify_failed",
    }
  }

  const data = (await response.json()) as TurnstileVerifyResponse

  if (!data.success) {
    console.warn("[TURNSTILE_REJECTED]", data["error-codes"])
    return {
      success: false,
      error: data["error-codes"]?.join(",") || "turnstile_rejected",
    }
  }

  return { success: true }
}