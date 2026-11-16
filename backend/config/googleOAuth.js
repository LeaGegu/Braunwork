import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

export const GOOGLE_GMAIL_SCOPES = Object.freeze([
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
]);

dotenv.config({
  path: fileURLToPath(new URL('../.env', import.meta.url)),
  quiet: true,
});

export function getConfiguredFrontendOrigin(
  redirectUrl = process.env.SUPABASE_AUTH_REDIRECT_URL,
) {
  if (typeof redirectUrl !== 'string' || redirectUrl.trim() === '') {
    return '';
  }

  try {
    const url = new URL(redirectUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      return '';
    }

    return url.origin;
  } catch {
    return '';
  }
}

export function getGoogleOAuthConfiguration(environment = process.env) {
  const config = {
    clientId: environment.GOOGLE_CLIENT_ID?.trim() ?? '',
    clientSecret: environment.GOOGLE_CLIENT_SECRET?.trim() ?? '',
    redirectUri: environment.GOOGLE_REDIRECT_URI?.trim() ?? '',
  };

  return {
    config,
    isConfigured: Object.values(config).every((value) => value.length > 0),
  };
}

export function getGoogleOAuthIntegrationConfiguration(
  environment = process.env,
) {
  const { config, isConfigured } = getGoogleOAuthConfiguration(environment);
  return {
    ...config,
    isConfigured,
    allowedMailbox: environment.GOOGLE_ALLOWED_MAILBOX?.trim().toLowerCase() ?? '',
    frontendOrigin: getConfiguredFrontendOrigin(
      environment.SUPABASE_AUTH_REDIRECT_URL,
    ),
    scopes: GOOGLE_GMAIL_SCOPES,
  };
}

const {
  config: googleOAuthConfig,
  isConfigured: isGoogleOAuthConfigured,
} = getGoogleOAuthConfiguration();

export { googleOAuthConfig, isGoogleOAuthConfigured };
