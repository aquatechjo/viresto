export async function getLocationFromIp(ip?: string | null) {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1') {
    return {
      country: null,
      city: null,
    }
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}`)

    const data = await res.json()

    return {
      country: data.country || null,
      city: data.city || null,
    }
  } catch {
    return {
      country: null,
      city: null,
    }
  }
}