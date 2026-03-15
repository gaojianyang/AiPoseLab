import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { Skia, ImageFormat } from '@shopify/react-native-skia';
import { FFmpegKit, FFprobeKit, ReturnCode } from 'ffmpeg-kit-react-native';
import { NativeModules, Platform, NativeEventEmitter } from 'react-native';
import type { PoseLogFile, PoseFrameLog } from './types/poseLog';
import { getCurrentSkin } from './skinStore';

export interface WorkoutVideoGeneratorOptions {
  inputVideoUri: string;
  poseJsonPath: string;
  outputVideoPath?: string;
  /** 未指定时从原视频 probe 得到；失败则回退 30 */
  targetFps?: number;
  /** 是否在画面角落绘制帧序号水印（便于排查卡顿是数据对齐还是编码问题） */
  debugFrameWatermark?: boolean;
  /** 高光模式下，原生侧只会保留这些时间段内的帧（单位 ms，相对录制开始）。*/
  highlightSegments?: { startMs: number; endMs: number }[];
  /** 皮肤样式 JSON 字符串，若不传则使用 defaultSkin.style。 */
  skinStyleJson?: string;
  /** （实验）使用 Android 原生合成器；当前实现仅验证桥接，尚未真正叠加骨架 */
  useNativeRenderer?: boolean;
  /** Android 原生合成时使用硬件编码（h264_mediacodec），否则用 libx264 */
  useHardwareEncoder?: boolean;
  onProgress?: (p: number) => void;
}

/** 解析 ffprobe 返回的帧率字符串，如 "30/1"、"30000/1001" */
function parseFpsFromProbe(fpsStr: string | undefined): number {
  if (!fpsStr || typeof fpsStr !== 'string') return 30;
  const parts = fpsStr.trim().split('/').map(Number);
  if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) return parts[0] / parts[1];
  const n = parseFloat(fpsStr);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export interface WorkoutVideoResult {
  outputVideoPath: string;
}

function normalizePath(uri: string): string {
  return uri.startsWith('file://') ? uri.replace(/^file:\/\//, '') : uri;
}

function getPoseFrameAtTime(log: PoseLogFile, tMs: number): PoseFrameLog | null {
  const frames = log.frames;
  if (!frames.length) return null;
  if (tMs <= frames[0].t) return frames[0];
  if (tMs >= frames[frames.length - 1].t) return frames[frames.length - 1];
  let i = 0;
  while (i < frames.length - 1 && frames[i + 1].t <= tMs) i += 1;
  const a = frames[i];
  const b = frames[i + 1];
  const dt = b.t - a.t;
  if (dt <= 0) return a;
  const r = (tMs - a.t) / dt;
  return {
    t: tMs,
    landmarks: a.landmarks.map((p, idx) => {
      const q = b.landmarks[idx] ?? p;
      return {
        x: p.x + (q.x - p.x) * r,
        y: p.y + (q.y - p.y) * r,
        z: p.z + (q.z - p.z) * r,
      };
    }),
    repCount: r < 0.5 ? a.repCount : b.repCount,
  };
}

let cachedRobotoTypeface: any | null = null;

async function getRobotoTypeface(): Promise<any> {
  if (cachedRobotoTypeface) return cachedRobotoTypeface;
  const asset = Asset.fromModule(require('./assets/fonts/Roboto-Bold.ttf'));
  if (!asset.localUri) {
    await asset.downloadAsync();
  }
  const uri = asset.localUri;
  if (!uri) {
    throw new Error('[WVG] Roboto-Bold.ttf localUri 为空');
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const data = Skia.Data.fromBase64(base64);
  const tf = Skia.Typeface.MakeFreeTypeFaceFromData(data);
  if (!tf) {
    throw new Error('[WVG] 无法从 Roboto-Bold.ttf 创建 typeface');
  }
  cachedRobotoTypeface = tf;
  return tf;
}

export class WorkoutVideoGenerator {
  /**
   * 根据 poseLog 生成「高光」时间段：
   * - 总共 reps=R 时，优先挑第 1 下、每 10 下、第 R 下；
   * - 每个 rep 左右 windowMs（默认 3000ms）；
   * - 自动合并重叠区间，并限制总时长不超过 maxTotalMs（默认 60000ms）。
   */
  static computeHighlightSegments(
    poseLog: PoseLogFile,
    windowMs = 3000,
    everyN = 10,
    maxTotalMs = 60_000,
  ): { startMs: number; endMs: number }[] {
    const frames = poseLog.frames;
    if (!frames.length) return [];
    const totalReps = frames[frames.length - 1]?.repCount ?? 0;
    if (!totalReps) return [];

    const targets: number[] = [];
    targets.push(1);
    for (let r = everyN; r <= totalReps; r += everyN) {
      if (!targets.includes(r)) targets.push(r);
    }
    if (!targets.includes(totalReps)) targets.push(totalReps);

    const rawSegments: { startMs: number; endMs: number }[] = [];
    for (const tRep of targets) {
      const frame = frames.find((f) => f.repCount >= tRep);
      if (!frame) continue;
      const center = frame.t;
      rawSegments.push({
        startMs: Math.max(0, center - windowMs),
        endMs: center + windowMs,
      });
    }

    if (!rawSegments.length) return [];

    // 合并重叠区间
    rawSegments.sort((a, b) => a.startMs - b.startMs);
    const merged: { startMs: number; endMs: number }[] = [];
    let cur = { ...rawSegments[0] };
    for (let i = 1; i < rawSegments.length; i += 1) {
      const seg = rawSegments[i];
      if (seg.startMs <= cur.endMs) {
        cur.endMs = Math.max(cur.endMs, seg.endMs);
      } else {
        merged.push(cur);
        cur = { ...seg };
      }
    }
    merged.push(cur);

    // 限制总时长
    const limited: { startMs: number; endMs: number }[] = [];
    let acc = 0;
    for (const seg of merged) {
      const len = seg.endMs - seg.startMs;
      if (acc + len <= maxTotalMs) {
        limited.push(seg);
        acc += len;
      } else {
        const remain = maxTotalMs - acc;
        if (remain > 500) {
          limited.push({ startMs: seg.startMs, endMs: seg.startMs + remain });
        }
        break;
      }
    }

    return limited;
  }

  /**
   * 高光视频生成：内部会自动根据 pose JSON 计算高光区间，并调用原生合成器。
   */
  static async generateHighlights(
    opts: Omit<WorkoutVideoGeneratorOptions, 'useNativeRenderer' | 'highlightSegments'> & {
      windowMs?: number;
      everyN?: number;
      maxTotalMs?: number;
    },
  ): Promise<WorkoutVideoResult> {
    const { poseJsonPath, windowMs, everyN, maxTotalMs, ...rest } = opts;
    const poseJson = await FileSystem.readAsStringAsync(poseJsonPath);
    const poseLog = JSON.parse(poseJson) as PoseLogFile;
    const segments = WorkoutVideoGenerator.computeHighlightSegments(
      poseLog,
      windowMs,
      everyN,
      maxTotalMs,
    );
    if (!segments.length) {
      throw new Error('没有找到可用的高光区间（rep 计数可能为 0）');
    }

    return WorkoutVideoGenerator.generate({
      ...rest,
      poseJsonPath,
      useNativeRenderer: true,
      highlightSegments: segments,
    });
  }

  static async generate(
    opts: WorkoutVideoGeneratorOptions,
  ): Promise<WorkoutVideoResult> {
    const {
      inputVideoUri,
      poseJsonPath,
      outputVideoPath,
      targetFps: optsFps,
      debugFrameWatermark = true,
      highlightSegments,
      skinStyleJson,
      useNativeRenderer = false,
      useHardwareEncoder = false,
      onProgress,
    } = opts;

    console.log('[WorkoutVideoGenerator] opts', {
      inputVideoUri,
      poseJsonPath,
      outputVideoPath,
      targetFps: optsFps,
      debugFrameWatermark,
      useNativeRenderer,
      useHardwareEncoder,
    });

    // Step 1：在 Android 上优先走原生合成入口
    if (Platform.OS === 'android' && useNativeRenderer && NativeModules.WorkoutVideoNativeRenderer) {
      const useHardware = !!useHardwareEncoder;
      console.log(
        '[WorkoutVideoGenerator] 使用 Android 原生合成器',
        useHardware ? '(硬件编码 h264_mediacodec)' : '(软件编码 libx264)',
      );
      const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
      if (!baseDir) throw new Error('FileSystem cacheDirectory/documentDirectory 不可用');
      const ts = Date.now();
      const normalizedIn = normalizePath(inputVideoUri);
      const outPath =
        outputVideoPath ??
        `${baseDir}workout_native_${ts}.mp4`;

      const skinJson = skinStyleJson ?? JSON.stringify(getCurrentSkin().style);

      // 原生模块通过 DeviceEventEmitter 主动推送进度，这里订阅事件并转给 onProgress
      let progressSub: { remove: () => void } | undefined;
      if (onProgress) {
        const emitter = new NativeEventEmitter(NativeModules.WorkoutVideoNativeRenderer);
        progressSub = emitter.addListener('WorkoutVideoNativeProgress', (p: unknown) => {
          if (typeof p === 'number' && Number.isFinite(p)) {
            onProgress(Math.max(0, Math.min(1, p)));
          }
        });
      }

      onProgress?.(0.02);
      const targetFps = optsFps ?? 30;

      try {
        const renderMethod = useHardware
          ? NativeModules.WorkoutVideoNativeRenderer.renderHardware
          : NativeModules.WorkoutVideoNativeRenderer.render;
        const resultPath: string = await renderMethod(
          normalizedIn,
          poseJsonPath,
          normalizePath(outPath),
          Math.round(targetFps),
          highlightSegments ? JSON.stringify(highlightSegments) : null,
          skinJson,
        );
        onProgress?.(1);
        return { outputVideoPath: resultPath };
      } finally {
        progressSub?.remove();
      }
    }

    const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
    if (!baseDir) throw new Error('FileSystem cacheDirectory/documentDirectory 不可用');

    const ts = Date.now();
    const workDir = `${baseDir}workout_gen_${ts}/`;
    const rawDir = `${workDir}raw_frames/`;
    const skiaDir = `${workDir}skia_frames/`;

    await FileSystem.makeDirectoryAsync(workDir, { intermediates: true });
    await FileSystem.makeDirectoryAsync(rawDir, { intermediates: true });
    await FileSystem.makeDirectoryAsync(skiaDir, { intermediates: true });

    const videoPath = normalizePath(inputVideoUri);
    const poseJson = await FileSystem.readAsStringAsync(poseJsonPath);
    const poseLog = JSON.parse(poseJson) as PoseLogFile;

    let targetFps = optsFps ?? 30;
    try {
      const session = await FFprobeKit.getMediaInformation(videoPath);
      const info = session.getMediaInformation();
      if (info) {
        const streams = info.getStreams();
        const videoStream = streams?.find((s: { getType: () => string }) => s.getType() === 'video');
        if (videoStream) {
          const fps =
            parseFpsFromProbe(videoStream.getAverageFrameRate?.() ?? videoStream.getRealFrameRate?.());
          if (fps > 0) targetFps = Math.round(fps * 100) / 100;
        }
      }
    } catch (_) {
      // 回退 30
    }

    onProgress?.(0.02);
    const rawPattern = `${rawDir}frame_%d.jpg`;
    const extractCmd = `-y -i "${videoPath}" -vf "fps=${targetFps}" -qscale:v 2 "${rawPattern}"`;
    const extractSession = await FFmpegKit.execute(extractCmd);
    const extractRc = await extractSession.getReturnCode();
    if (!ReturnCode.isSuccess(extractRc)) {
      const failStack = await extractSession.getFailStackTrace();
      throw new Error(`[WVG] ffmpeg.extract failed rc=${extractRc?.getValue?.() ?? 'unknown'} ${failStack ?? ''}`);
    }
    onProgress?.(0.15);

    const rawFiles = await FileSystem.readDirectoryAsync(rawDir);
    const frameFiles = rawFiles
      .filter((f) => f.startsWith('frame_') && f.endsWith('.jpg'))
      .sort((a, b) => {
        const na = parseInt(a.match(/frame_(\d+)\.jpg/)?.[1] ?? '0', 10);
        const nb = parseInt(b.match(/frame_(\d+)\.jpg/)?.[1] ?? '0', 10);
        return na - nb;
      });

    const totalFrames = frameFiles.length || poseLog.frames.length;
    if (!totalFrames) throw new Error('没有可用帧进行合成');

    const skiaInit = <T>(step: string, fn: () => T): T => {
      try {
        return fn();
      } catch (e) {
        throw new Error(`[WVG] step=skia.init.${step} ${String(e)}`);
      }
    };

    const { line, joint } = getCurrentSkin().style;

    // 逐个拆分，定位到底是哪一个 JSI API 返回 undefined
    const linePaint: any = skiaInit('paint.line.create', () => Skia.Paint());
    skiaInit('paint.line.color', () => linePaint.setColor(Skia.Color(line.color)));
    skiaInit('paint.line.strokeWidth', () => linePaint.setStrokeWidth(line.width));
    skiaInit('paint.line.style', () => linePaint.setStyle(1));

    const leftPaint: any = skiaInit('paint.left.create', () => Skia.Paint());
    skiaInit('paint.left.color', () => leftPaint.setColor(Skia.Color(joint.leftColor)));
    const rightPaint: any = skiaInit('paint.right.create', () => Skia.Paint());
    skiaInit('paint.right.color', () => rightPaint.setColor(Skia.Color(joint.rightColor)));
    const neutralPaint: any = skiaInit('paint.neutral.create', () => Skia.Paint());
    skiaInit('paint.neutral.color', () => neutralPaint.setColor(Skia.Color(joint.neutralColor)));

    // 计数与水印画笔
    // 优先尝试使用自定义 Roboto 字体；失败则退回无字体模式
    let textFont: any | null = null;
    try {
      const robotoTf = await getRobotoTypeface();
      textFont = skiaInit('font.text.create', () => Skia.Font(robotoTf, 32));
    } catch (e) {
      console.warn('[WVG] 加载 Roboto-Bold.ttf 失败，将退回到无字体数码管样式', e);
    }

    const watermarkPaint: any = skiaInit('paint.watermark.create', () => Skia.Paint());
    skiaInit('paint.watermark.color', () => watermarkPaint.setColor(Skia.Color('#FFFFFF')));
    const watermarkTestPaint: any = skiaInit('paint.watermarkTest.create', () => Skia.Paint());
    skiaInit('paint.watermarkTest.color', () => watermarkTestPaint.setColor(Skia.Color('#FF0033')));

    const LEFT = new Set([1, 2, 3, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31]);
    const RIGHT = new Set([4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32]);

    const connections: [number, number][] = [
      [0, 1], [1, 2], [2, 3], [3, 7],
      [0, 4], [4, 5], [5, 6], [6, 8],
      [9, 10], [11, 12],
      [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
      [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
      [11, 23], [12, 24], [23, 24], [23, 25], [24, 26],
      [25, 27], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32],
      [27, 31], [28, 32],
    ];

    let lastValidPoseFrame: PoseFrameLog | null = null;
    let lastW = 0;
    let lastH = 0;

    const drawSkeleton = (
      canvas: any,
      poseFrame: PoseFrameLog,
      w: number,
      h: number,
    ) => {
      const { landmarks, repCount } = poseFrame;
      const toView = (nx: number, ny: number) => ({
        x: nx * w,
        y: (1 - ny) * h,
      });
      for (const [aIdx, bIdx] of connections) {
        const pa = landmarks[aIdx];
        const pb = landmarks[bIdx];
        if (!pa || !pb) continue;
        const p1 = toView(pa.x, pa.y);
        const p2 = toView(pb.x, pb.y);
        canvas.drawLine(p1.x, p1.y, p2.x, p2.y, linePaint);
      }
      landmarks.forEach((pt, idx) => {
        const p = toView(pt.x, pt.y);
        const paint = LEFT.has(idx) ? leftPaint : RIGHT.has(idx) ? rightPaint : neutralPaint;
        canvas.drawCircle(p.x, p.y, joint.radius, paint);
      });
      void repCount;
    };

    // 无字体计数叠加：七段数码管风格（用于字体加载失败时的降级）
    const DIGIT_MASKS: Record<number, number> = {
      0: 0b1111110,
      1: 0b0110000,
      2: 0b1101101,
      3: 0b1111001,
      4: 0b0110011,
      5: 0b1011011,
      6: 0b1011111,
      7: 0b1110000,
      8: 0b1111111,
      9: 0b1111011,
    };

    const draw7SegDigit = (canvas: any, digit: number, x: number, y: number, size: number) => {
      const mask = DIGIT_MASKS[digit] ?? 0;
      const w = size;
      const h = Math.round(size * 1.6);
      const t = Math.max(2, Math.round(size * 0.18)); // segment thickness
      const x0 = x;
      const x1 = x0 + w;
      const y0 = y;
      const y1 = y0 + h;
      const ym = y0 + Math.round(h / 2);

      const on = (bit: number) => ((mask >> bit) & 1) === 1;
      // bits: a b c d e f g  (0..6) but we used 7 bits; map:
      // a=6, b=5, c=4, d=3, e=2, f=1, g=0
      // We'll draw with paint: on -> watermarkPaint, off -> transparent(skip)
      const p = watermarkPaint;

      // a (top)
      if (on(6)) canvas.drawLine(x0 + t, y0, x1 - t, y0, p);
      // b (upper right)
      if (on(5)) canvas.drawLine(x1, y0 + t, x1, ym - t, p);
      // c (lower right)
      if (on(4)) canvas.drawLine(x1, ym + t, x1, y1 - t, p);
      // d (bottom)
      if (on(3)) canvas.drawLine(x0 + t, y1, x1 - t, y1, p);
      // e (lower left)
      if (on(2)) canvas.drawLine(x0, ym + t, x0, y1 - t, p);
      // f (upper left)
      if (on(1)) canvas.drawLine(x0, y0 + t, x0, ym - t, p);
      // g (middle)
      if (on(0)) canvas.drawLine(x0 + t, ym, x1 - t, ym, p);
    };

    const drawRepCountOverlay = (canvas: any, repCount: number) => {
      const safe = Math.max(0, Math.min(9999, Math.floor(repCount)));
      const label = safe.toString();

      // 如果字体可用，优先用 Roboto 文本绘制 Reps
      if (textFont) {
        const text = `Reps: ${label}`;
        const x = 18;
        const y = 92; // 稍微靠下，避免遮挡帧号条码
        canvas.drawText(text, x, y, watermarkPaint, textFont);
        return;
      }

      // 否则退回数码管样式（两位数）
      const digits = label.padStart(2, '0').split('').map((c) => parseInt(c, 10));
      const startX = 16;
      const startY = 70;
      const size = 22;
      const gap = 10;
      canvas.drawLine(startX - 6, startY - 10, startX + 120, startY - 10, watermarkTestPaint);
      canvas.drawLine(startX - 6, startY - 10, startX - 6, startY + 50, watermarkTestPaint);
      for (let i = 0; i < digits.length; i += 1) {
        draw7SegDigit(canvas, digits[i], startX + i * (size + gap), startY, size);
      }
    };

    // 无字体水印：用 16bit “条形码”表示帧号低 16 位（每条竖线代表一位）
    const drawFrameWatermark = (canvas: any, frameIndex1Based: number) => {
      const bits = frameIndex1Based & 0xffff;
      const x0 = 10;
      const yTop = 10;
      const yBottom = 46;
      const gap = 4;
      // 红色背景角标，肉眼确认绘制生效
      canvas.drawLine(x0, yTop, x0 + 80, yTop, watermarkTestPaint);
      canvas.drawLine(x0, yTop, x0, yBottom, watermarkTestPaint);
      for (let b = 0; b < 16; b += 1) {
        const on = ((bits >> b) & 1) === 1;
        const x = x0 + 6 + b * gap;
        const paint = on ? watermarkPaint : watermarkTestPaint;
        // 竖线长度用来区分 0/1
        const y1 = on ? yBottom : yTop + 18;
        canvas.drawLine(x, yTop + 4, x, y1, paint);
      }
    };

    for (let i = 0; i < totalFrames; i += 1) {
      try {
        const rawName = frameFiles[i] ?? `frame_${i + 1}.jpg`;
        const rawPath = `${rawDir}${rawName}`;

        let bg: ReturnType<typeof Skia.Image.MakeImageFromEncoded> | null = null;
        try {
          const base64 = await FileSystem.readAsStringAsync(rawPath, {
            encoding: FileSystem.EncodingType.Base64,
          });
          let data;
          try {
            data = Skia.Data.fromBase64(base64);
          } catch (e) {
            throw new Error(`[WVG] step=data.fromBase64 frame=${i + 1} ${String(e)}`);
          }
          try {
            bg = Skia.Image.MakeImageFromEncoded(data);
          } catch (e) {
            throw new Error(`[WVG] step=image.decode frame=${i + 1} ${String(e)}`);
          }
        } catch (_) {}

        let w = lastW;
        let h = lastH;
        if (bg) {
          w = bg.width();
          h = bg.height();
          lastW = w;
          lastH = h;
        }
        if (w <= 0 || h <= 0) continue;

        let surface;
        try {
          surface = Skia.Surface.MakeOffscreen(w, h);
        } catch (e) {
          throw new Error(`[WVG] step=surface.offscreen frame=${i + 1} ${String(e)}`);
        }
        if (!surface) continue;
        let canvas;
        try {
          canvas = surface.getCanvas();
        } catch (e) {
          throw new Error(`[WVG] step=surface.getCanvas frame=${i + 1} ${String(e)}`);
        }

        try {
          canvas.clear(Skia.Color('black'));
        } catch (e) {
          throw new Error(`[WVG] step=canvas.clear frame=${i + 1} ${String(e)}`);
        }
        if (bg) {
          try {
            canvas.drawImage(bg, 0, 0);
          } catch (e) {
            throw new Error(`[WVG] step=canvas.drawImage frame=${i + 1} ${String(e)}`);
          }
        }

        const tMs = (i / targetFps) * 1000;
        const poseFrame = getPoseFrameAtTime(poseLog, tMs);
        if (poseFrame && poseFrame.landmarks.length >= 17) {
          lastValidPoseFrame = poseFrame;
        }
        if (lastValidPoseFrame) {
          try {
            drawSkeleton(canvas, lastValidPoseFrame, w, h);
          } catch (e) {
            throw new Error(`[WVG] step=drawSkeleton frame=${i + 1} ${String(e)}`);
          }
        }

        // 叠加 rep 计数（来自 pose log，每帧都有 repCount）
        try {
          const rc = lastValidPoseFrame?.repCount ?? 0;
          drawRepCountOverlay(canvas, rc);
        } catch (e) {
          throw new Error(`[WVG] step=drawRepCount frame=${i + 1} ${String(e)}`);
        }

        if (debugFrameWatermark) {
          try {
            drawFrameWatermark(canvas, i + 1);
          } catch (e) {
            throw new Error(`[WVG] step=drawWatermark frame=${i + 1} ${String(e)}`);
          }
        }

        let img;
        try {
          img = surface.makeImageSnapshot();
        } catch (e) {
          throw new Error(`[WVG] step=snapshot frame=${i + 1} ${String(e)}`);
        }
        let outBase64;
        try {
          // 改回 JPEG 以提升编码速度（质量系数 0.9）
          outBase64 = img.encodeToBase64(ImageFormat.JPEG, 0.9);
        } catch (e) {
          throw new Error(`[WVG] step=encodeToBase64 frame=${i + 1} ${String(e)}`);
        }
        const outPath = `${skiaDir}frame_${i + 1}.jpg`;
        try {
          await FileSystem.writeAsStringAsync(outPath, outBase64, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch (e) {
          throw new Error(`[WVG] step=writeFrame frame=${i + 1} ${String(e)}`);
        }

        const pBase = 0.15;
        const pRange = 0.7;
        onProgress?.(pBase + (i / totalFrames) * pRange);
      } catch (e) {
        console.warn('[WorkoutVideoGenerator] render failed at frame', i + 1, e);
        throw e instanceof Error ? e : new Error(String(e));
      }
    }

    const outPathNorm =
      outputVideoPath ?? `${baseDir}aiposelab_with_pose_${ts}.mp4`.replace(/^file:\/\//, '');
    const skiaPattern = `${skiaDir}frame_%d.jpg`;
    const synthCmd = [
      '-y',
      '-framerate',
      String(targetFps),
      '-i',
      `"${normalizePath(skiaPattern)}"`,
      '-i',
      `"${videoPath}"`,
      // 将 full-range 的 RGB/PNG 转换到 H.264 常用的 limited-range yuv420p
      '-vf',
      '"scale=in_range=pc:out_range=tv,format=yuv420p"',
      '-c:v',
      'libx264',
      '-preset',
      'superfast',
      // 固定输出帧率，避免抖动/卡顿感
      '-fps_mode',
      'cfr',
      '-r',
      String(targetFps),
      '-pix_fmt',
      'yuv420p',
      '-map',
      '1:a?',
      '-map',
      '0:v',
      '-shortest',
      `"${outPathNorm}"`,
    ].join(' ');

    onProgress?.(0.9);
    const synthSession = await FFmpegKit.execute(synthCmd);
    const synthRc = await synthSession.getReturnCode();
    if (!ReturnCode.isSuccess(synthRc)) {
      const failStack = await synthSession.getFailStackTrace();
      throw new Error(`[WVG] ffmpeg.synth failed rc=${synthRc?.getValue?.() ?? 'unknown'} ${failStack ?? ''}`);
    }
    onProgress?.(1);

    const uri = outPathNorm.startsWith('/') ? `file://${outPathNorm}` : outPathNorm;
    return { outputVideoPath: uri };
  }
}

