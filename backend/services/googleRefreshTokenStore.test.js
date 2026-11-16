import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  createGoogleRefreshTokenStore,
  createLocalEncryptedGoogleTokenProvider,
} from './googleRefreshTokenStore.js';

const refreshToken = 'mock-refresh-token-value';
const encryptionKey = Buffer.alloc(32, 41).toString('base64');

async function withTemporaryStorage(run) {
  const storageDirectory = await mkdtemp(
    join(tmpdir(), 'braunwork-google-oauth-'),
  );
  try {
    return await run(storageDirectory);
  } finally {
    await rm(storageDirectory, { recursive: true, force: true });
  }
}

test('stores refresh tokens only as authenticated ciphertext', async () => {
  await withTemporaryStorage(async (storageDirectory) => {
    const store = createGoogleRefreshTokenStore(
      createLocalEncryptedGoogleTokenProvider({
        encryptionKey,
        storageDirectory,
      }),
    );
    const secret = await store.save(refreshToken);
    const files = await readdir(storageDirectory);
    assert.equal(files.length, 1);
    const encryptedContent = await readFile(
      join(storageDirectory, files[0]),
      'utf8',
    );

    assert.doesNotMatch(encryptedContent, new RegExp(refreshToken));
    assert.equal(
      await store.get(secret.reference, secret.version),
      refreshToken,
    );
  });
});

test('rejects tampered encrypted refresh tokens', async () => {
  await withTemporaryStorage(async (storageDirectory) => {
    const store = createGoogleRefreshTokenStore(
      createLocalEncryptedGoogleTokenProvider({
        encryptionKey,
        storageDirectory,
      }),
    );
    const secret = await store.save(refreshToken);
    const wrongKeyStore = createGoogleRefreshTokenStore(
      createLocalEncryptedGoogleTokenProvider({
        encryptionKey: Buffer.alloc(32, 42).toString('base64'),
        storageDirectory,
      }),
    );

    await assert.rejects(
      wrongKeyStore.get(secret.reference, secret.version),
      /could not be verified/,
    );
  });
});

test('removes a stored encrypted refresh token', async () => {
  await withTemporaryStorage(async (storageDirectory) => {
    const store = createGoogleRefreshTokenStore(
      createLocalEncryptedGoogleTokenProvider({
        encryptionKey,
        storageDirectory,
      }),
    );
    const secret = await store.save(refreshToken);

    await store.delete(secret.reference, secret.version);
    assert.deepEqual(await readdir(storageDirectory), []);
  });
});

test('requires a valid base64-encoded 32-byte encryption key', () => {
  assert.throws(
    () => createLocalEncryptedGoogleTokenProvider({ encryptionKey: 'short' }),
    /configuration is invalid/,
  );
});
