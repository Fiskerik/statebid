declare namespace Cloudflare {
  interface Env {
    FILES: R2Bucket;
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    STRIPE_TAX_ENABLED?: string;
    SITE_URL?: string;
    ADMIN_EMAIL?: string;
    ADMIN_USER_IDS?: string;
    TURNSTILE_SECRET_KEY?: string;
    TURNSTILE_SITE_KEY?: string;
    RATE_LIMIT_SALT?: string;
    OPERATOR_NAME?: string;
    OPERATOR_ADDRESS?: string;
    SUPPORT_EMAIL?: string;
    OPERATOR_COUNTRY?: string;
    PRIVACY_RETENTION_DAYS?: string;
  }
}
