import { TestBed } from '@angular/core/testing';
import { computed } from '@angular/core';
import { AuthSession } from './auth-session';

describe('Auth session', () => {
  let session: AuthSession;

  beforeEach(() => {
    session = TestBed.inject(AuthSession);
  });

  it('starts without a session', () => {
    expect(session.tokenFor('java')).toBeNull();
    expect(session.tokenFor('dotnet')).toBeNull();
    expect(session.authenticated()).toBe(false);
    expect(session.backendId()).toBeNull();
  });

  it('establishes a session exclusively for Java', () => {
    session.establish('java', 'java-token');
    expect(session.tokenFor('java')).toBe('java-token');
    expect(session.tokenFor('dotnet')).toBeNull();
    expect(session.authenticated()).toBe(true);
    expect(session.backendId()).toBe('java');
  });

  it('replaces the Java session with the .NET session', () => {
    session.establish('java', 'java-token');
    session.establish('dotnet', 'dotnet-token');
    expect(session.tokenFor('java')).toBeNull();
    expect(session.tokenFor('dotnet')).toBe('dotnet-token');
    expect(session.authenticated()).toBe(true);
    expect(session.backendId()).toBe('dotnet');
  });

  it('replaces the token for the same backend without interpreting it', () => {
    session.establish('java', 'old-token');
    session.establish('java', 'opaque.backend/token==');
    expect(session.tokenFor('java')).toBe('opaque.backend/token==');
  });

  it('clears the token and observable state and permits repeated clearing', () => {
    session.establish('java', 'java-token');
    session.clear();
    expect(session.tokenFor('java')).toBeNull();
    expect(session.tokenFor('dotnet')).toBeNull();
    expect(session.authenticated()).toBe(false);
    expect(session.backendId()).toBeNull();
    session.clear();
    expect(session.authenticated()).toBe(false);
  });

  it('never falls back for a different backend', () => {
    session.establish('java', 'java-token');
    expect(session.tokenFor('unknown')).toBeNull();
    expect(session.tokenFor('JAVA')).toBeNull();
    expect(session.tokenFor('')).toBeNull();
  });

  it('rejects an empty token without establishing a session', () => {
    expect(() => session.establish('java', '')).toThrow('empty token');
    expect(session.tokenFor('java')).toBeNull();
    expect(session.authenticated()).toBe(false);
    expect(session.backendId()).toBeNull();
  });

  it('preserves the current session when an empty replacement token is rejected', () => {
    session.establish('java', 'java-token');
    expect(() => session.establish('dotnet', '')).toThrow('empty token');
    expect(session.tokenFor('java')).toBe('java-token');
    expect(session.tokenFor('dotnet')).toBeNull();
    expect(session.backendId()).toBe('java');
  });

  it('lets consumers react to the session for their selected backend', () => {
    const javaAuthenticated = computed(() => session.tokenFor('java') !== null);
    expect(javaAuthenticated()).toBe(false);
    session.establish('java', 'java-token');
    expect(javaAuthenticated()).toBe(true);
    session.establish('dotnet', 'dotnet-token');
    expect(javaAuthenticated()).toBe(false);
    session.clear();
    expect(javaAuthenticated()).toBe(false);
  });
});
