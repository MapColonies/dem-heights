import crypto from 'crypto';

const FIRST_SYNC_RETRY_DELAY_MS = 5000;
const SYNC_RETRY_BACKOFF_FACTOR = 2;

export const generateChecksum = (str: string, algorithm?: string, encoding?: crypto.BinaryToTextEncoding): string => {
  return crypto
    .createHash(algorithm ?? 'md5')
    .update(str, 'utf8')
    .digest(encoding ?? 'hex');
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isSame = (src1: any, src2: any): boolean => {
  return generateChecksum(JSON.stringify(src1)) === generateChecksum(JSON.stringify(src2));
};

export const syncRetryDelay = (consecutiveFailures: number, maxDelay: number): number => {
  return Math.min(FIRST_SYNC_RETRY_DELAY_MS * SYNC_RETRY_BACKOFF_FACTOR ** (consecutiveFailures - 1), maxDelay);
};
