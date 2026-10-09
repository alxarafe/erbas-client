import { TestBed } from '@angular/core/testing';
import { BackendSelection, SELECTION_KEY } from './backend-selection';
import { BACKENDS } from './backends';

describe('Backend selection', () => {
  beforeEach(() => localStorage.clear());
  it('centrally registers both implementations', () => {
    expect(BACKENDS.map((backend) => backend.id)).toEqual(['java', 'dotnet']);
    expect(new Set(BACKENDS.map((backend) => backend.proxyBaseUrl)).size).toBe(2);
  });
  it('defaults to Java and persists a valid selection', () => {
    const selection = TestBed.inject(BackendSelection);
    expect(selection.selected().id).toBe('java');
    selection.select('dotnet');
    expect(selection.selected().id).toBe('dotnet');
    expect(localStorage.getItem(SELECTION_KEY)).toBe('dotnet');
  });
  it('restores the previous selection', () => {
    localStorage.setItem(SELECTION_KEY, 'dotnet');
    expect(TestBed.inject(BackendSelection).selected().id).toBe('dotnet');
  });
  it('falls back for a removed backend and ignores invalid selections', () => {
    localStorage.setItem(SELECTION_KEY, 'removed');
    const selection = TestBed.inject(BackendSelection);
    selection.select('unknown');
    expect(selection.selected().id).toBe('java');
  });
  it('works when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const selection = TestBed.inject(BackendSelection);
    selection.select('dotnet');
    expect(selection.selected().id).toBe('dotnet');
    vi.restoreAllMocks();
  });
});
