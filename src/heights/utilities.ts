import crypto from 'crypto';

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
