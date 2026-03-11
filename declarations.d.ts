declare module 'react-native-view-recorder' {
  export type RecorderOnFrameEvent = { frameIndex: number };

  export type RecordOptions = {
    output: string;
    fps: number;
    totalFrames: number;
    onFrame?: (event: RecorderOnFrameEvent) => void | Promise<void>;
  };

  export type ViewRecorder = {
    sessionId: string;
    record: (options: RecordOptions) => Promise<void>;
  };

  export function useViewRecorder(): ViewRecorder;

  export const RecordingView: React.ComponentType<{
    sessionId: string;
    style?: any;
    pointerEvents?: any;
    children?: React.ReactNode;
  }>;
}

declare module 'expo-file-system' {
  export const cacheDirectory: string | null;
  export const documentDirectory: string | null;

  export type MakeDirectoryOptions = { intermediates?: boolean };
  export function makeDirectoryAsync(dirUri: string, options?: MakeDirectoryOptions): Promise<void>;
}

