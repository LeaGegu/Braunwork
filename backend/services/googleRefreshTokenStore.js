import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCAL_REFERENCE = 'local-encrypted-file';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const VERSION_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_STORAGE_DIRECTORY = fileURLToPath(
  new URL('../.google-oauth-secrets/', import.meta.url),
);

function decodeEncryptionKey(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Google token encryption is not configured.');
  }

  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) {
    throw new Error('Google token encryption configuration is invalid.');
  }
  return key;
}

function getTokenFilePath(storageDirectory, version) {
  if (typeof version !== 'string' || !VERSION_PATTERN.test(version)) {
    throw new Error('The Google refresh-token version is invalid.');
  }
  return join(storageDirectory, `google-refresh-token.${version}.enc`);
}

function encryptToken(token, key, version) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(`${LOCAL_REFERENCE}:${version}`, 'utf8'));
  const ciphertext = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);

  return JSON.stringify({
    version: 1,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  });
}

function decryptToken(serialized, key, version) {
  let record;
  try {
    record = JSON.parse(serialized);
  } catch {
    throw new Error('The encrypted Google refresh token is invalid.');
  }

  if (
    record?.version !== 1 ||
    typeof record.iv !== 'string' ||
    typeof record.authTag !== 'string' ||
    typeof record.ciphertext !== 'string'
  ) {
    throw new Error('The encrypted Google refresh token is invalid.');
  }

  try {
    const decipher = createDecipheriv(
      ENCRYPTION_ALGORITHM,
      key,
      Buffer.from(record.iv, 'base64'),
    );
    decipher.setAAD(Buffer.from(`${LOCAL_REFERENCE}:${version}`, 'utf8'));
    decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(record.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new Error('The encrypted Google refresh token could not be verified.');
  }
}

export function createLocalEncryptedGoogleTokenProvider({
  encryptionKey,
  storageDirectory = DEFAULT_STORAGE_DIRECTORY,
}) {
  const key = decodeEncryptionKey(encryptionKey);

  return {
    async save(refreshToken) {
      if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
        throw new TypeError('A refresh token is required.');
      }

      const version = randomUUID();
      await mkdir(storageDirectory, { recursive: true, mode: 0o700 });
      await writeFile(
        getTokenFilePath(storageDirectory, version),
        encryptToken(refreshToken, key, version),
        { encoding: 'utf8', flag: 'wx', mode: 0o600 },
      );
      return { reference: LOCAL_REFERENCE, version };
    },

    async get(reference, version) {
      if (reference !== LOCAL_REFERENCE) {
        throw new Error('The Google refresh-token reference is unsupported.');
      }

      const serialized = await readFile(
        getTokenFilePath(storageDirectory, version),
        'utf8',
      );
      return decryptToken(serialized, key, version);
    },

    async delete(reference, version) {
      if (reference !== LOCAL_REFERENCE) {
        throw new Error('The Google refresh-token reference is unsupported.');
      }

      try {
        await unlink(getTokenFilePath(storageDirectory, version));
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    },
  };
}

export function createGoogleRefreshTokenStore(provider) {
  if (
    !provider ||
    typeof provider.save !== 'function' ||
    typeof provider.get !== 'function' ||
    typeof provider.delete !== 'function'
  ) {
    throw new TypeError('A Google refresh-token storage provider is required.');
  }

  return Object.freeze({
    save: (...args) => provider.save(...args),
    get: (...args) => provider.get(...args),
    delete: (...args) => provider.delete(...args),
  });
}
