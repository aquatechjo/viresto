import { Polar } from "@polar-sh/sdk";

let client: Polar | null = null;

export function getPolarClient() {
  if (client) return client;

  const accessToken = process.env.POLAR_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("POLAR_ACCESS_TOKEN is required");
  }

  const server =
    process.env.POLAR_ENVIRONMENT === "production" ? "production" : "sandbox";

  client = new Polar({
    accessToken,
    server,
  });

  return client;
}

export function getAppUrl() {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://www.virestojo.com"
  ).replace(/\/$/, "");
}
