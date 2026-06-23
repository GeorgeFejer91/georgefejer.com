const EXPORT_FORMATS = new Set(["gif", "mp4"]);

export async function exportCanvasAnimation(options = {}) {
  const settings = normalizeSettings(options);
  const frames = [];
  const frameCount = settings.frameCount || Math.max(1, settings.seconds * settings.fps);
  const frameDt = 1 / settings.fps;

  for (let index = 0; index < settings.warmupSteps; index += 1) {
    options.stepFrame?.({ dt: frameDt, frameIndex: -1, settings });
    if (index % 12 === 0) {
      await nextFrame();
    }
  }

  await options.beforeCapture?.({ settings });

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    if (frameIndex > 0 || settings.captureAfterFirstStep) {
      for (let step = 0; step < settings.stepsPerFrame; step += 1) {
        options.stepFrame?.({ dt: frameDt / settings.stepsPerFrame, frameIndex, settings });
      }
    }
    frames.push(options.captureFrame({
      frameIndex,
      height: settings.height,
      settings,
      width: settings.width,
    }));
    options.onStatus?.(`${settings.format} capture ${frameIndex + 1}/${frameCount}`);
    if (frameIndex % 3 === 0 || frameIndex === frameCount - 1) {
      await nextFrame();
    }
  }

  const result = await encodeFrames(frames, settings, options.onStatus);
  return {
    ...result,
    frameCount: frames.length,
    settings,
  };
}

function normalizeSettings(options) {
  const format = EXPORT_FORMATS.has(options.format) ? options.format : "gif";
  return {
    captureAfterFirstStep: Boolean(options.captureAfterFirstStep),
    format,
    fps: clampInt(options.fps, 4, 30, 12),
    frameCount: readOptionalFrameCount(options.frameCount),
    height: clampInt(options.height, 240, 1440, 720),
    seconds: clampInt(options.seconds, 1, 30, 6),
    stepsPerFrame: clampInt(options.stepsPerFrame, 1, 12, 1),
    warmupSteps: clampInt(options.warmupSteps, 0, 720, 0),
    width: clampInt(options.width, 320, 1920, 960),
  };
}

async function encodeFrames(frames, settings, onStatus) {
  if (settings.format === "gif") {
    onStatus?.("gif palette");
    const { buildAdaptivePalette, encodeGifAsync } = await import("./gif-encoder.js");
    const palette = buildAdaptivePalette(frames, { background: [17, 17, 15] });
    onStatus?.(`gif encoding 0/${frames.length}`);
    return {
      blob: await encodeGifAsync(frames, {
        width: settings.width,
        height: settings.height,
        delayCs: Math.round(100 / settings.fps),
        palette,
        dither: true,
        onProgress: (encoded, total) => onStatus?.(`gif encoding ${encoded}/${total}`),
      }),
      extension: "gif",
    };
  }

  onStatus?.(`mp4 recording 0/${frames.length}`);
  const { encodeVideoAsync } = await import("./video-encoder.js");
  const result = await encodeVideoAsync(frames, {
    width: settings.width,
    height: settings.height,
    fps: settings.fps,
    format: "mp4",
    onProgress: (encoded, total) => onStatus?.(`mp4 recording ${encoded}/${total}`),
  });
  return {
    blob: result.blob,
    extension: result.extension,
  };
}

function clampInt(value, min, max, fallback) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function readOptionalFrameCount(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return clampInt(value, 1, 20000, 1);
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}
