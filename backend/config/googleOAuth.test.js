import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getConfiguredFrontendOrigin,
  getGoogleOAuthConfiguration,
  getGoogleOAuthIntegrationConfiguration,
  GOOGLE_GMAIL_SCOPES,
} from './googleOAuth.js';

const environmentKeys = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
];

async function withGoogleOAuthEnvironment(values, run) {
  const previousValues = new Map(
    environmentKeys.map((key) => [key, process.env[key]]),
  );

  try {
    environmentKeys.forEach((key) => {
      process.env[key] = values[key] ?? '';
    });
    return await run();
  } finally {
    for (const [key, value] of previousValues) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function importGoogleOAuthModule(testId) {
  const moduleUrl = new URL('./googleOAuth.js', import.meta.url);
  moduleUrl.searchParams.set('test', testId);
  return import(moduleUrl.href);
}

test('Google OAuth is unconfigured when all credentials are missing', () => {
  const { config, isConfigured } = getGoogleOAuthConfiguration({});

  assert.deepEqual(config, {
    clientId: '',
    clientSecret: '',
    redirectUri: '',
  });
  assert.equal(isConfigured, false);
});

test('Google OAuth remains unconfigured when only some credentials are present', () => {
  const { config, isConfigured } = getGoogleOAuthConfiguration({
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_REDIRECT_URI: 'http://localhost:5000/api/gmail/oauth/callback',
  });

  assert.equal(config.clientId, 'client-id');
  assert.equal(config.clientSecret, '');
  assert.equal(isConfigured, false);
});

test('Google OAuth is configured when all credentials are present', () => {
  const { config, isConfigured } = getGoogleOAuthConfiguration({
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:5000/api/gmail/oauth/callback',
  });

  assert.equal(config.clientId, 'client-id');
  assert.equal(
    config.redirectUri,
    'http://localhost:5000/api/gmail/oauth/callback',
  );
  assert.equal(isConfigured, true);
});

test('Google OAuth configuration initializes without credentials', async () => {
  await withGoogleOAuthEnvironment({}, async () => {
    const module = await importGoogleOAuthModule('missing-configuration');
    assert.equal(module.isGoogleOAuthConfigured, false);
  });
});

test('Google OAuth is not configured when any required value is whitespace-only', async () => {
  const completeConfiguration = {
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:5000/api/gmail/oauth/callback',
  };

  for (const [index, key] of environmentKeys.entries()) {
    await withGoogleOAuthEnvironment(
      { ...completeConfiguration, [key]: ' \t\n ' },
      async () => {
        const module = await importGoogleOAuthModule(`whitespace-${index}`);
        assert.equal(module.isGoogleOAuthConfigured, false, key);
      },
    );
  }
});

test('integration configuration derives its popup origin from the existing auth redirect', () => {
  const integration = getGoogleOAuthIntegrationConfiguration({
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:5000/api/gmail/oauth/callback',
    GOOGLE_ALLOWED_MAILBOX: ' TestMailbox@example.com ',
    SUPABASE_AUTH_REDIRECT_URL:
      'http://localhost:5173/admin/invite?flow=setup',
  });

  assert.equal(integration.isConfigured, true);
  assert.equal(integration.allowedMailbox, 'testmailbox@example.com');
  assert.equal(integration.frontendOrigin, 'http://localhost:5173');
  assert.deepEqual(integration.scopes, GOOGLE_GMAIL_SCOPES);
});

test('frontend origin rejects invalid and non-web redirect URLs', () => {
  assert.equal(getConfiguredFrontendOrigin('not a URL'), '');
  assert.equal(getConfiguredFrontendOrigin('javascript:alert(1)'), '');
});
