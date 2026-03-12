declare module 'expo-file-system' {
  export const cacheDirectory: string | null;
  export const documentDirectory: string | null;

  export enum EncodingType {
    UTF8 = 'utf8',
    Base64 = 'base64',
  }

  export type ReadingOptions = { encoding?: EncodingType | 'utf8' | 'base64'; position?: number; length?: number };
  export type WritingOptions = { encoding?: EncodingType | 'utf8' | 'base64' };

  export type MakeDirectoryOptions = { intermediates?: boolean };
  export function makeDirectoryAsync(dirUri: string, options?: MakeDirectoryOptions): Promise<void>;
  export function readDirectoryAsync(fileUri: string): Promise<string[]>;
  export function readAsStringAsync(fileUri: string, options?: ReadingOptions): Promise<string>;
  export function writeAsStringAsync(fileUri: string, contents: string, options?: WritingOptions): Promise<void>;
}

