import * as ImageModule from '../index';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('@/common/utils', () => {
  return {
    GMFetch: vi.fn(),
    $t: vi.fn((key) => key),
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ImageModule', () => {
  it('should export all functions from image.transfer', () => {
    expect(ImageModule.transferImgToCheveretoSite).toBeDefined();
  });

  it('should export all functions from image.upload', () => {
    expect(ImageModule.uploadToHDB).toBeDefined();
    expect(ImageModule.uploadToImgbox).toBeDefined();
    expect(ImageModule.uploadToPixhost).toBeDefined();
  });

  it('should export all functions from image.url', () => {
    expect(ImageModule.getOriginalImgUrl).toBeDefined();
  });

  it('should export all functions from image.info', () => {
    expect(ImageModule.getImgInfoFromBBCode).toBeDefined();
    expect(ImageModule.extractImgsFromBBCode).toBeDefined();
  });
});
