// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isLocalDevHost } from '../ChatViewer';

describe('isLocalDevHost', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return true when hostname is localhost', () => {
    vi.stubGlobal('location', { hostname: 'localhost' });
    expect(isLocalDevHost()).toBe(true);
  });

  it('should return true when hostname is 127.0.0.1', () => {
    vi.stubGlobal('location', { hostname: '127.0.0.1' });
    expect(isLocalDevHost()).toBe(true);
  });

  it('should return false for other hostnames', () => {
    vi.stubGlobal('location', { hostname: 'shareclaude.pages.dev' });
    expect(isLocalDevHost()).toBe(false);

    vi.stubGlobal('location', { hostname: 'example.com' });
    expect(isLocalDevHost()).toBe(false);

    vi.stubGlobal('location', { hostname: '192.168.1.1' });
    expect(isLocalDevHost()).toBe(false);
  });
});
