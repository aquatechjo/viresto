import { isBearerSecretAuthorized } from "@/lib/bearer-secret";

type Environment = Record<string, string | undefined>;

const REQUIRED_SERVICE_KEYS = {
  redis: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  cloudinary: [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ],
  email: ["RESEND_API_KEY", "EMAIL_FROM"],
} as const;

function hasValues(env: Environment, keys: readonly string[]) {
  return keys.every((key) => Boolean(env[key]?.trim()));
}

export function isHealthCheckAuthorized(
  authorizationHeader: string | null,
  configuredSecret: string | undefined,
) {
  return isBearerSecretAuthorized(authorizationHeader, configuredSecret);
}

export function getHealthServiceConfiguration(env: Environment) {
  return {
    redis: hasValues(env, REQUIRED_SERVICE_KEYS.redis),
    cloudinary: hasValues(env, REQUIRED_SERVICE_KEYS.cloudinary),
    email: hasValues(env, REQUIRED_SERVICE_KEYS.email),
    ai: Boolean(env.OPENAI_API_KEY?.trim()),
  };
}
