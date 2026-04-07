import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  readConfig,
  writeConfig,
  deleteConfig,
  readApiKeyFromConfig,
  getConfigPath,
} from '../src/utils/config.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exacli-test-'));
  process.env.EXACLI_CONFIG_DIR = tmpDir;
});

afterEach(() => {
  delete process.env.EXACLI_CONFIG_DIR;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('getConfigPath', () => {
  test('uses EXACLI_CONFIG_DIR when set', () => {
    expect(getConfigPath()).toBe(path.join(tmpDir, 'config.json'));
  });
});

describe('writeConfig and readConfig', () => {
  test('roundtrips config correctly', () => {
    writeConfig({ api_key: 'test-key-123' });
    const config = readConfig();
    expect(config).toEqual({ api_key: 'test-key-123' });
  });

  test('sets file permissions to 0600', () => {
    writeConfig({ api_key: 'test-key' });
    const stat = fs.statSync(getConfigPath());
    expect(stat.mode & 0o777).toBe(0o600);
  });

  test('sets directory permissions to 0700', () => {
    writeConfig({ api_key: 'test-key' });
    const stat = fs.statSync(tmpDir);
    expect(stat.mode & 0o777).toBe(0o700);
  });

  test('overwrites existing config', () => {
    writeConfig({ api_key: 'first-key' });
    writeConfig({ api_key: 'second-key' });
    const config = readConfig();
    expect(config).toEqual({ api_key: 'second-key' });
  });
});

describe('readConfig', () => {
  test('returns null when file does not exist', () => {
    expect(readConfig()).toBeNull();
  });

  test('returns null for invalid JSON', () => {
    fs.writeFileSync(path.join(tmpDir, 'config.json'), 'not json');
    expect(readConfig()).toBeNull();
  });

  test('returns null for missing api_key', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'config.json'),
      JSON.stringify({ other: 'value' })
    );
    expect(readConfig()).toBeNull();
  });

  test('returns null for empty api_key', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'config.json'),
      JSON.stringify({ api_key: '' })
    );
    expect(readConfig()).toBeNull();
  });
});

describe('deleteConfig', () => {
  test('removes config file and returns true', () => {
    writeConfig({ api_key: 'test-key' });
    expect(deleteConfig()).toBe(true);
    expect(fs.existsSync(getConfigPath())).toBe(false);
  });

  test('returns false when no file exists', () => {
    expect(deleteConfig()).toBe(false);
  });
});

describe('readApiKeyFromConfig', () => {
  test('returns api key when config exists', () => {
    writeConfig({ api_key: 'my-api-key' });
    expect(readApiKeyFromConfig()).toBe('my-api-key');
  });

  test('returns null when no config exists', () => {
    expect(readApiKeyFromConfig()).toBeNull();
  });
});
