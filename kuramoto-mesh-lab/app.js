const TAU = Math.PI * 2;
const AXES = 3;
const SCRIPT_ASSET_BASE = (() => {
  try {
    return new URL(".", document.currentScript?.src || document.baseURI).href;
  } catch {
    return "./";
  }
})();
const MOVEMENT_COUPLING_RATE = 16;
const JERK_COUPLING_RATE = 18;
const CROSS_AXIS_RATE = 8;
const DEFAULT_SAMPLE_COUNT = 1024;
const DEFAULT_HAND = "left";
const DEFAULT_PRESET = "lowLow";
const DEFAULT_DYNAMICS_MODE = "movementOnly";
const DEFAULT_NEIGHBORHOOD_MODE = "distanceTiered";
const DEFAULT_JERK_SCOPE = "global";
const DEFAULT_COLOR_MODE = "cartesian";
const DEFAULT_CAMERA_MODE = "palm";
const DEFAULT_MOVEMENT_NOISE_SPACE = "local";
const DEFAULT_DISTANCE_NEIGHBOR_MAX_M = 0.025;
const DISTANCE_NEIGHBOR_EXPORT_MAX_M = 0.055;
const NOISE_TEMPORAL_DOMAIN_SCALE = 4;
const NATURAL_FREQUENCY_NOISE_FREQUENCY = 18;
const MOVEMENT_FREQUENCY_NOISE_SEEDS = Object.freeze([0x4f3a9b21, 0xb7c15d83, 0x29e46f5d]);
const JERK_FREQUENCY_NOISE_SEEDS = Object.freeze([0x8d4c2f17, 0x31b6a9e5, 0xc5e72b49]);
const BINARY_MANIFEST_URLS = Object.freeze({
  left: new URL("data/recorded-meta-quest-hand-browser-preview-manifest.json", SCRIPT_ASSET_BASE).href,
  right: new URL("data/recorded-meta-quest-right-hand-browser-preview-manifest.json", SCRIPT_ASSET_BASE).href,
});
const SUPPORTED_SAMPLE_COUNTS = Object.freeze([64, 128, 192, 256, 384, 512, 768, 1024]);
const JERK_SCOPE_LABELS = Object.freeze({
  global: "global jerk",
  local: "local jerk",
});
const NEIGHBORHOOD_MODE_LABELS = Object.freeze({
  tiered: "tiered neighbors",
  distance: "surface-distance neighbors",
  distanceTiered: "tiered surface-distance neighbors",
});
const MESH_COMPONENT_COLORS = Object.freeze([
  [143, 199, 176],
  [215, 180, 106],
  [209, 122, 108],
  [177, 149, 202],
  [229, 154, 95],
  [156, 179, 219],
]);
const PRESET_LABELS = Object.freeze({
  lowLow: "Low coherence / low energy",
  lowHigh: "Low coherence / high energy",
  highLow: "High coherence / low energy",
  highHigh: "High coherence / high energy",
});
const MOVEMENT_ONLY_PRESET_LABELS = Object.freeze({
  lowLow: "Low coherence / low energy",
  lowHigh: "Low coherence / high energy",
  highLow: "High coherence / low energy",
  highHigh: "High coherence / high energy",
});
const canvas = document.getElementById("preview");
const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });

const controls = {
  handSelect: document.getElementById("handSelect"),
  dynamicsMode: document.getElementById("dynamicsMode"),
  neighborhoodMode: document.getElementById("neighborhoodMode"),
  presetSelect: document.getElementById("presetSelect"),
  jerkScope: document.getElementById("jerkScope"),
  colorMode: document.getElementById("colorMode"),
  particleCount: document.getElementById("particleCount"),
  randomPhase: document.getElementById("randomPhase"),
  unifyPhase: document.getElementById("unifyPhase"),
  saveProfile: document.getElementById("saveProfile"),
  loadProfileButton: document.getElementById("loadProfileButton"),
  loadProfile: document.getElementById("loadProfile"),
  showLinks: document.getElementById("showLinks"),
  showMeshComponents: document.getElementById("showMeshComponents"),
  showVectors: document.getElementById("showVectors"),
  showJerkDebug: document.getElementById("showJerkDebug"),
  resetButton: document.getElementById("resetButton"),
  pauseButton: document.getElementById("pauseButton"),
  dynamicsPauseButton: document.getElementById("dynamicsPauseButton"),
  cameraMode: document.getElementById("cameraMode"),
  flyCameraButton: document.getElementById("flyCameraButton"),
  resetCameraButton: document.getElementById("resetCameraButton"),
  resetParticleDepthSize: document.getElementById("resetParticleDepthSize"),
  setAccurateParticleDepthSize: document.getElementById("setAccurateParticleDepthSize"),
  clearSelectionButton: document.getElementById("clearSelectionButton"),
  exportAnimationButton: document.getElementById("exportAnimationButton"),
  exportDynamics: document.getElementById("exportDynamics"),
  exportFormat: document.getElementById("exportFormat"),
  exportFps: document.getElementById("exportFps"),
  exportFrameStart: document.getElementById("exportFrameStart"),
  exportFrameStop: document.getElementById("exportFrameStop"),
  exportFrames: document.getElementById("exportFrames"),
  exportGifMode: document.getElementById("exportGifMode"),
  exportHeight: document.getElementById("exportHeight"),
  exportPhaseStart: document.getElementById("exportPhaseStart"),
  exportSeconds: document.getElementById("exportSeconds"),
  exportStart: document.getElementById("exportStart"),
  exportStatus: document.getElementById("exportStatus"),
  exportSteps: document.getElementById("exportSteps"),
  exportWarmup: document.getElementById("exportWarmup"),
  exportWidth: document.getElementById("exportWidth"),
  frameIndex: document.getElementById("frameIndex"),
  frameIndexValue: document.getElementById("frameIndexValue"),
  movementNoiseSpace: document.getElementById("movementNoiseSpace"),
  presetLabel: document.getElementById("presetLabel"),
  dataSource: document.getElementById("dataSource"),
  movementMetric: document.getElementById("movementMetric"),
  jerkMetric: document.getElementById("jerkMetric"),
  boostMetric: document.getElementById("boostMetric"),
  activeMetric: document.getElementById("activeMetric"),
  clampMetric: document.getElementById("clampMetric"),
  distanceClampMetric: document.getElementById("distanceClampMetric"),
  travelMetric: document.getElementById("travelMetric"),
  sampleMetric: document.getElementById("sampleMetric"),
  selectedMetric: document.getElementById("selectedMetric"),
};

const dynamicsControlSpecs = [
  ["naturalFrequencyMultiplier", "naturalFrequencyMultiplier", 2],
  ["distanceNeighborMaxM", "distanceNeighborMaxM", 3],
  ["movementGain", "movement.gain", 2],
  ["movementBaseFrequencyHz", "movement.baseFrequencyHz", 2],
  ["movementFrequencySpreadHz", "movement.frequencySpreadHz", 2],
  ["movementNoiseFrequency", "movement.noiseFrequency", 2],
  ["movementNoiseAmplitude", "movement.noiseAmplitude", 4],
  ["movementNoiseSpeedHz", "movement.noiseSpeedHz", 2],
  ["movementNoisePhase", "movement.noisePhase", 2],
  ["movementCoupling", "movement.coupling", 2],
  ["movementCrossAxisCoupling", "movement.crossAxisCoupling", 2],
  ["movementTier1", "movement.weights.tier1", 2],
  ["movementTier2", "movement.weights.tier2", 2],
  ["movementTier3", "movement.weights.tier3", 2],
  ["movementSmallWorld", "movement.weights.smallWorld", 2],
  ["jerkGain", "jerk.gain", 2],
  ["jerkFrequencyHz", "jerk.frequencyHz", 2],
  ["jerkFrequencySpreadHz", "jerk.frequencySpreadHz", 2],
  ["jerkCoupling", "jerk.coupling", 2],
  ["jerkCrossAxisCoupling", "jerk.crossAxisCoupling", 2],
  ["jerkPulseThreshold", "jerk.pulseThreshold", 2],
  ["jerkPulseSharpness", "jerk.pulseSharpness", 1],
  ["jerkTier1", "jerk.weights.tier1", 2],
  ["jerkTier2", "jerk.weights.tier2", 2],
  ["jerkTier3", "jerk.weights.tier3", 2],
  ["jerkSmallWorld", "jerk.weights.smallWorld", 2],
];

const viewControlSpecs = [
  ["playbackSpeed", "playbackSpeed", 2],
  ["unitDistanceM", "unitDistanceM", 3],
  ["particleSize", "particleSize", 1],
  ["particleDepthMinScale", "particleDepthMinScale", 2],
  ["particleDepthMaxScale", "particleDepthMaxScale", 2],
];

const controlSpecs = [...dynamicsControlSpecs, ...viewControlSpecs];
const CONTROL_TOOLTIPS = Object.freeze({
  handSelect: "Select the recorded hand mesh replay used for particles, anchors, and graph data.",
  dynamicsMode: "Select whether the runtime steps movement only or both movement and jerk oscillator fields.",
  neighborhoodMode: "Select tiered graph neighbors, a surface-distance kernel, or surface-distance neighbors grouped into tiers.",
  presetSelect: "Choose a starting oscillator tuning preset. Custom appears after manually editing dynamics values.",
  jerkScope: "Select whether jerk timing is locally varied or globally synchronized when jerk dynamics are enabled.",
  randomPhase: "Randomize oscillator phases with deterministic replay-safe seeds.",
  unifyPhase: "Set all oscillator phases to the same starting phase.",
  saveProfile: "Save the current movement and jerk dynamics values as a JSON profile.",
  loadProfileButton: "Load a saved dynamics profile JSON file.",
  naturalFrequencyMultiplier: "Global multiplier for natural oscillator frequencies; scales movement and jerk base/spread frequencies without changing coupling pulls.",
  distanceNeighborMaxM: "Maximum approximate fused-surface travel distance in meters for surface-distance neighborhood modes.",
  movementGain: "Movement oscillator output gain before unit-travel scaling.",
  movementBaseFrequencyHz: "Base movement oscillator frequency in cycles per second.",
  movementFrequencySpreadHz: "Per-coordinate movement frequency variation around the base frequency.",
  movementNoiseFrequency: "Spatial resolution of the Perlin noise field sampled after oscillator movement.",
  movementNoiseSpace: "Select whether movement noise samples world space or each particle's local normalized coordinate space.",
  movementNoiseAmplitude: "Maximum extra Perlin offset in meters from the oscillator-derived position.",
  movementNoiseSpeedHz: "Temporal animation speed of the Perlin noise field in cycles per second while dynamics are running.",
  movementNoisePhase: "Temporal phase offset of the Perlin noise field in cycles.",
  movementCoupling: "Global signed movement coupling multiplier for neighbor phase pulls.",
  movementCrossAxisCoupling: "Signed coupling between local X/Y/Z movement axes at each coordinate.",
  movementTier1: "Signed movement coupling weight for closest same-surface neighbors or nearest surface-distance bucket.",
  movementTier2: "Signed movement coupling weight for next same-surface neighbors or middle surface-distance bucket.",
  movementTier3: "Signed movement coupling weight for browser-derived third-tier neighbors or farthest surface-distance bucket.",
  movementSmallWorld: "Signed movement coupling weight for seeded-random long-range edges in any neighborhood mode.",
  jerkGain: "Jerk boost gain applied to movement direction during jerk pulses.",
  jerkFrequencyHz: "Base jerk oscillator frequency in cycles per second.",
  jerkFrequencySpreadHz: "Per-coordinate jerk frequency variation around the base frequency.",
  jerkCoupling: "Global signed jerk coupling multiplier for neighbor phase pulls.",
  jerkCrossAxisCoupling: "Signed coupling between local X/Y/Z jerk axes at each coordinate.",
  jerkPulseThreshold: "Sine threshold above which jerk oscillator phase produces a pulse.",
  jerkPulseSharpness: "Exponent shaping how narrow or broad each jerk pulse is.",
  jerkTier1: "Signed jerk coupling weight for closest same-surface neighbors or nearest surface-distance bucket.",
  jerkTier2: "Signed jerk coupling weight for next same-surface neighbors or middle surface-distance bucket.",
  jerkTier3: "Signed jerk coupling weight for browser-derived third-tier neighbors or farthest surface-distance bucket.",
  jerkSmallWorld: "Signed jerk coupling weight for seeded-random long-range edges in any neighborhood mode.",
  particleCount: "Number of precomputed mesh-surface coordinate samples loaded for the preview.",
  colorMode: "Particle color mapping for local displacement direction and magnitude: OKLCH sphere, CIELAB sphere, or raw Cartesian RGB.",
  cameraMode: "Camera behavior: free fly, scene orbit, or palm-anchored view.",
  playbackSpeed: "Recorded hand-frame playback speed multiplier.",
  frameIndex: "Recorded hand-mesh frame index shown when frame playback is paused.",
  unitDistanceM: "Meters represented by normalized oscillator displacement length 1.0.",
  particleSize: "Base rendered particle radius in screen pixels.",
  particleDepthMinScale: "Particle-size multiplier for the farthest visible particle depth. Set to 1 with Depth max 1 for fixed size.",
  particleDepthMaxScale: "Particle-size multiplier for the nearest visible particle depth. Values above 1 make near particles larger.",
  resetParticleDepthSize: "Reset depth min and depth max to 1, matching the base Particle size slider everywhere.",
  setAccurateParticleDepthSize: "Set depth min to 1 and depth max to the physically accurate camera-perspective ratio for the current view.",
  showLinks: "Draw coordinate-neighbor links. With one particle selected, tier 1/2/3 links are green/yellow/red.",
  showMeshComponents: "Draw the full recorded mesh, colored by connected topology component.",
  showVectors: "Draw anchor-to-particle displacement vectors.",
  showJerkDebug: "Tint and scale particles by jerk boost for debugging.",
  flyCameraButton: "Toggle between palm-anchored viewing and free-fly camera control.",
  resetCameraButton: "Reset the camera pose while keeping the selected camera mode.",
  exportFormat: "Animation export container format.",
  exportGifMode: "GIF export timing mode: recorded frame range or fixed frame time.",
  exportSeconds: "Duration in seconds for time-based animation exports.",
  exportFrameStart: "First recorded frame included in a frame-range GIF export.",
  exportFrameStop: "Last recorded frame included in a frame-range GIF export.",
  exportPhaseStart: "Oscillator phase reset mode applied before GIF export.",
  exportFps: "Frames per second for exported animations.",
  exportWidth: "Exported animation width in pixels.",
  exportHeight: "Exported animation height in pixels.",
  exportSteps: "Oscillator simulation steps run per exported frame.",
  exportWarmup: "Oscillator simulation steps run before capture starts.",
  exportStart: "MP4 export start state: current simulation or reset simulation.",
  exportFrames: "Include recorded hand-frame playback during export.",
  exportDynamics: "Include oscillator dynamics during export.",
  exportAnimationButton: "Render and download the configured animation export.",
  exportStatus: "Current animation export status.",
  resetButton: "Reset playback and oscillator state to the default start.",
  pauseButton: "Pause or resume recorded hand-frame playback.",
  dynamicsPauseButton: "Pause or resume oscillator dynamics stepping.",
  clearSelectionButton: "Clear the selected particle.",
  sampleMetric: "Current number of mesh-surface coordinates.",
  selectedMetric: "Current selected particle index, or none when no particle is selected.",
  movementMetric: "Average Kuramoto order parameter for movement phases.",
  jerkMetric: "Average Kuramoto order parameter for jerk phases.",
  boostMetric: "Root mean square of jerk boost values.",
  activeMetric: "Mean jerk pulse activity.",
  clampMetric: "Fraction of movement-driver components clamped to [-1, 1].",
  distanceClampMetric: "Fraction of browser displacement vectors length-clamped to unit travel.",
  travelMetric: "Maximum anchor-to-particle travel distance in meters.",
});
const jerkControlIds = dynamicsControlSpecs
  .map(([id]) => id)
  .filter((id) => id.startsWith("jerk"));
const tierNeighborhoodControlIds = dynamicsControlSpecs
  .map(([id]) => id)
  .filter((id) => id.includes("Tier"));
const jerkUiElements = Array.from(document.querySelectorAll("[data-jerk-ui]"));
const tierNeighborhoodUiElements = Array.from(document.querySelectorAll("[data-tier-neighborhood-ui]"));
const distanceNeighborhoodUiElements = Array.from(document.querySelectorAll("[data-distance-neighborhood-ui]"));
const urlState = readUrlState();

for (const [id] of controlSpecs) {
  controls[id] = document.getElementById(id);
  controls[`${id}Value`] = document.getElementById(`${id}Value`);
}

let dataset = null;
let graph = null;
let loadError = "";
let framePaused = urlState.framePaused;
let dynamicsPaused = urlState.dynamicsPaused;
let lastTime = performance.now();
let playbackSeconds = 0;
let currentFrameIndex = 0;
let currentOutput = null;
let dynamics = urlState.dynamics;
let selectedHand = urlState.hand;
let dynamicsMode = urlState.dynamicsMode;
let jerkScope = urlState.jerkScope;
let viewState = urlState.viewState;
let camera = urlState.camera;
let oscillator = null;
let selectedSampleCount = urlState.sampleCount;
let pendingInitialFrameIndex = urlState.frameIndex;
let loadSerial = 0;
let activePointer = null;
let lastProjectedParticles = [];
let exportInProgress = false;
let autoExportPending = urlState.autoExport;
const selectedParticleIndices = new Set();
const pressedKeys = new Set();
const binaryManifestPromises = new Map();
const binaryMeshPromises = new Map();
const binarySampleSetPromises = new Map();

applyTooltips();
bindControls();
controls.presetSelect.value = urlState.hasTuningOverrides ? "custom" : urlState.preset;
writeControlsFromState();
writeUrlUiState(urlState);
loadRecordedPreview(selectedSampleCount, urlState.phaseMode);
requestAnimationFrame(loop);

async function loadRecordedPreview(sampleCount, phaseMode = "random") {
  const serial = (loadSerial += 1);
  selectedSampleCount = sampleCount;
  loadError = "";
  dataset = null;
  graph = null;
  oscillator = null;
  currentOutput = null;
  selectedParticleIndices.clear();
  controls.handSelect.value = selectedHand;
  controls.particleCount.value = String(sampleCount);
  controls.dataSource.textContent = `Loading ${handLabel(selectedHand)} hand · ${sampleCount} recorded coordinates`;
  controls.sampleMetric.textContent = String(sampleCount);
  updateFrameControl();
  updateSelectionOutput();

  try {
    const loaded = await loadRecordedPreviewDataset(sampleCount);
    validateDataset(loaded, sampleCount);
    if (serial !== loadSerial) {
      return;
    }
    dataset = loaded;
    graph = buildGraph(loaded);
    if (pendingInitialFrameIndex !== null) {
      setFrameIndex(pendingInitialFrameIndex);
      playbackSeconds = currentFrameIndex * frameDuration();
      pendingInitialFrameIndex = null;
    } else {
      setFrameIndex(Math.floor(playbackSeconds / frameDuration()) % datasetFrameCount());
    }
    resetOscillator(phaseMode);
    controls.dataSource.textContent = `${handLabel(loaded.hand)} hand · ${loaded.source.kind}: ${loaded.source.sequence_id} · ${sampleCount} coords`;
    queueAutoExport();
  } catch (error) {
    if (serial !== loadSerial) {
      return;
    }
    loadError = `Recorded mesh preview data is unavailable: ${error.message}`;
    controls.dataSource.textContent = loadError;
    updateFrameControl();
  }
}

function validateDataset(loaded, expectedSampleCount) {
  if (
    loaded?.schema_id !== "rusty.kuramoto.mesh.browser_recording_manifest.v2" &&
    loaded?.schema_id !== "rusty.kuramoto.mesh.browser_recording.v1"
  ) {
    throw new Error("unexpected schema");
  }
  if (datasetFrameCountFor(loaded) <= 0) {
    throw new Error("no frames");
  }
  const sampleCount = loaded.profile?.sample_count;
  if (!sampleCount || sampleCount !== expectedSampleCount) {
    throw new Error("sample count mismatch");
  }
  if (loaded.schema_id === "rusty.kuramoto.mesh.browser_recording_manifest.v2") {
    if (
      loaded.mesh?.vertices?.length !== loaded.profile.exported_frame_count * loaded.mesh.vertexCount * 3 ||
      loaded.mesh?.triangles?.length !== loaded.mesh.triangleCount * 3 ||
      loaded.sampleSet?.coordinateTriangles?.length !== sampleCount ||
      loaded.sampleSet?.coordinateBarycentric?.length !== sampleCount * 3
    ) {
      throw new Error("binary artifact shape mismatch");
    }
    if (
      loaded.graph?.surface_distance_edges?.length !== loaded.graph?.surface_distance_meters?.length
    ) {
      throw new Error("surface distance graph shape mismatch");
    }
    return;
  }
  for (const [index, frame] of loaded.frames.entries()) {
    if (
      frame.anchors?.length !== sampleCount ||
      frame.axes?.length !== sampleCount ||
      frame.positions?.length !== sampleCount
    ) {
      throw new Error(`frame ${index} sample count mismatch`);
    }
    if (frame.palm_anchor && !palmAnchorPoint(frame)) {
      throw new Error(`frame ${index} palm anchor is invalid`);
    }
  }
}

async function loadRecordedPreviewDataset(sampleCount) {
  return loadBinaryPreviewDataset(sampleCount);
}

async function loadBinaryPreviewDataset(sampleCount) {
  const hand = selectedHand;
  const manifest = await loadBinaryManifest(hand);
  const sampleMeta = manifest.sample_sets?.[String(sampleCount)];
  if (!sampleMeta) {
    throw new Error(`compact manifest has no ${sampleCount} particle coordinate set`);
  }
  const [mesh, sampleSet] = await Promise.all([
    loadBinaryMesh(hand, manifest),
    loadBinarySampleSet(hand, manifest, sampleCount, sampleMeta),
  ]);
  return {
    schema_id: manifest.schema_id,
    hand,
    source: manifest.source,
    profile: {
      ...manifest.profile,
      sample_count: sampleCount,
    },
    bounds: manifest.bounds,
    frameCache: new Map(),
    frameCount: manifest.profile.exported_frame_count,
    graph: sampleSet.graph,
    mesh,
    palmAnchors: mesh.palmAnchors,
    sampleSet,
  };
}

async function loadBinaryManifest(hand) {
  const manifestUrl = manifestUrlForHand(hand);
  if (!binaryManifestPromises.has(hand)) {
    binaryManifestPromises.set(hand, fetchJson(manifestUrl).then((manifest) => {
      if (manifest?.schema_id !== "rusty.kuramoto.mesh.browser_recording_manifest.v2") {
        throw new Error("compact manifest has unexpected schema");
      }
      if (!manifest.mesh || !manifest.sample_sets || !manifest.profile) {
        throw new Error("compact manifest is missing mesh, sample_sets, or profile");
      }
      return manifest;
    }));
  }
  return binaryManifestPromises.get(hand);
}

async function loadBinaryMesh(hand, manifest) {
  const manifestUrl = manifestUrlForHand(hand);
  if (!binaryMeshPromises.has(hand)) {
    binaryMeshPromises.set(hand, Promise.all([
      fetchTypedArtifact(manifestUrl, manifest.mesh.vertices, Float32Array),
      fetchTypedArtifact(manifestUrl, manifest.mesh.triangles, Uint32Array),
      fetchTypedArtifact(manifestUrl, manifest.mesh.source_frame_indices, Uint32Array),
      manifest.palm_anchor?.positions
        ? fetchTypedArtifact(manifestUrl, manifest.palm_anchor.positions, Float32Array)
        : Promise.resolve(null),
    ]).then(([vertices, triangles, sourceFrameIndices, palmAnchors]) => {
      const vertexCount = manifest.mesh.vertex_count;
      const triangleCount = manifest.mesh.triangle_count;
      const components = buildMeshComponentData(vertexCount, triangleCount, triangles);
      return {
        components,
        frameCount: manifest.mesh.frame_count,
        palmAnchors,
        sourceFrameIndices,
        triangleCount,
        triangles,
        vertexCount,
        vertices,
      };
    }));
  }
  return binaryMeshPromises.get(hand);
}

async function loadBinarySampleSet(hand, manifest, sampleCount, sampleMeta) {
  const key = `${hand}:${sampleCount}`;
  const manifestUrl = manifestUrlForHand(hand);
  if (!binarySampleSetPromises.has(key)) {
    const promise = Promise.all([
      fetchTypedArtifact(manifestUrl, sampleMeta.coordinates.triangle_indices, Uint32Array),
      fetchTypedArtifact(manifestUrl, sampleMeta.coordinates.barycentric, Float32Array),
      fetchTypedArtifact(manifestUrl, sampleMeta.graph.tier1_edges, Uint32Array),
      fetchTypedArtifact(manifestUrl, sampleMeta.graph.tier2_edges, Uint32Array),
      fetchTypedArtifact(manifestUrl, sampleMeta.graph.small_world_edges, Uint32Array),
      sampleMeta.graph.surface_distance_edges
        ? fetchTypedArtifact(manifestUrl, sampleMeta.graph.surface_distance_edges, Uint32Array)
        : Promise.resolve(new Uint32Array()),
      sampleMeta.graph.surface_distance_meters
        ? fetchTypedArtifact(manifestUrl, sampleMeta.graph.surface_distance_meters, Float32Array)
        : Promise.resolve(new Float32Array()),
    ]).then(([
      coordinateTriangles,
      coordinateBarycentric,
      tier1Edges,
      tier2Edges,
      smallWorldEdges,
      surfaceDistanceEdges,
      surfaceDistanceMeters,
    ]) => ({
      coordinateBarycentric,
      coordinateTriangles,
      graph: {
        tier1_edges: edgePairsFromU32(tier1Edges),
        tier2_edges: edgePairsFromU32(tier2Edges),
        small_world_edges: edgePairsFromU32(smallWorldEdges),
        surface_distance_edges: edgePairsFromU32(surfaceDistanceEdges),
        surface_distance_meters: Array.from(surfaceDistanceMeters),
        surface_distance_kernel_export_max_m: sampleMeta.graph.surface_distance_kernel_export_max_m ?? null,
      },
      sampleCount,
    }));
    binarySampleSetPromises.set(key, promise);
  }
  return binarySampleSetPromises.get(key);
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

async function fetchTypedArtifact(manifestUrl, artifact, Type) {
  if (!artifact?.path) {
    throw new Error("binary artifact is missing path");
  }
  const url = new URL(artifact.path, new URL(manifestUrl, window.location.href));
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url.pathname}`);
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength % Type.BYTES_PER_ELEMENT !== 0) {
    throw new Error(`${artifact.path} byte length is not aligned to ${Type.name}`);
  }
  if (Number.isFinite(artifact.byte_length) && buffer.byteLength !== artifact.byte_length) {
    throw new Error(`${artifact.path} byte length mismatch`);
  }
  const expectedLength = artifact.shape?.reduce((total, value) => total * value, 1);
  const view = new Type(buffer);
  if (Number.isFinite(expectedLength) && view.length !== expectedLength) {
    throw new Error(`${artifact.path} length mismatch`);
  }
  return view;
}

function edgePairsFromU32(values) {
  const edges = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    edges.push([values[index], values[index + 1]]);
  }
  return edges;
}

function buildMeshComponentData(vertexCount, triangleCount, triangles) {
  const parent = Array.from({ length: vertexCount }, (_, index) => index);
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const base = triangle * 3;
    const a = triangles[base];
    const b = triangles[base + 1];
    const c = triangles[base + 2];
    if (a >= vertexCount || b >= vertexCount || c >= vertexCount) {
      continue;
    }
    unionRoots(parent, a, b);
    unionRoots(parent, b, c);
    unionRoots(parent, c, a);
  }

  const rootVertexCounts = new Map();
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const root = findRoot(parent, vertex);
    rootVertexCounts.set(root, (rootVertexCounts.get(root) ?? 0) + 1);
  }

  const rankedRoots = [...rootVertexCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([root]) => root);
  const rootRanks = new Map(rankedRoots.map((root, rank) => [root, rank]));
  const vertexCounts = rankedRoots.map((root) => rootVertexCounts.get(root) ?? 0);
  const triangleComponents = new Uint32Array(triangleCount);
  const triangleCounts = new Array(rankedRoots.length).fill(0);
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const root = findRoot(parent, triangles[triangle * 3]);
    const component = rootRanks.get(root) ?? 0;
    triangleComponents[triangle] = component;
    triangleCounts[component] += 1;
  }

  return {
    componentCount: rankedRoots.length,
    triangleComponents,
    triangleCounts,
    vertexCounts,
  };
}

function findRoot(parent, value) {
  let current = value;
  while (parent[current] !== current) {
    parent[current] = parent[parent[current]];
    current = parent[current];
  }
  return current;
}

function unionRoots(parent, left, right) {
  const leftRoot = findRoot(parent, left);
  const rightRoot = findRoot(parent, right);
  if (leftRoot !== rightRoot) {
    parent[rightRoot] = leftRoot;
  }
}

function bindControls() {
  controls.handSelect.addEventListener("input", () => {
    selectedHand = handParam(controls.handSelect.value);
    controls.handSelect.value = selectedHand;
    loadRecordedPreview(selectedSampleCount, "random");
  });

  controls.particleCount.addEventListener("change", () => {
    loadRecordedPreview(Number(controls.particleCount.value));
  });

  for (const [id, path, digits] of dynamicsControlSpecs) {
    controls[id].addEventListener("input", () => {
      if (!jerkDynamicsEnabled() && id.startsWith("jerk")) {
        return;
      }
      setPath(dynamics, path, Number(controls[id].value));
      writeControlValue(id, getPath(dynamics, path), digits);
      controls.presetSelect.value = "custom";
      writePresetLabel();
      rebuildFrequencies();
      refreshCurrentOutput();
    });
  }

  controls.movementNoiseSpace.addEventListener("input", () => {
    dynamics.movement.noiseSpace = movementNoiseSpaceParam(controls.movementNoiseSpace.value);
    controls.movementNoiseSpace.value = dynamics.movement.noiseSpace;
    controls.presetSelect.value = "custom";
    writePresetLabel();
    refreshCurrentOutput();
  });

  controls.neighborhoodMode.addEventListener("input", () => {
    dynamics.neighborhoodMode = neighborhoodModeParam(controls.neighborhoodMode.value);
    controls.neighborhoodMode.value = dynamics.neighborhoodMode;
    controls.presetSelect.value = "custom";
    writePresetLabel();
    updateNeighborhoodModeUi();
    refreshCurrentOutput();
  });

  for (const [id, path, digits] of viewControlSpecs) {
    controls[id].addEventListener("input", () => {
      setPath(viewState, path, Number(controls[id].value));
      writeControlValue(id, getPath(viewState, path), digits);
      refreshCurrentOutput();
    });
  }

  controls.resetParticleDepthSize.addEventListener("click", () => {
    viewState.particleDepthMinScale = 1;
    viewState.particleDepthMaxScale = 1;
    writeViewControls();
    refreshCurrentOutput();
  });

  controls.setAccurateParticleDepthSize.addEventListener("click", () => {
    viewState.particleDepthMinScale = 1;
    viewState.particleDepthMaxScale = accurateParticleDepthMaxScale();
    writeViewControls();
    refreshCurrentOutput();
  });

  controls.dynamicsMode.addEventListener("input", () => {
    dynamicsMode = dynamicsModeParam(controls.dynamicsMode.value);
    if (!jerkDynamicsEnabled() && controls.presetSelect.value !== "custom") {
      controls.presetSelect.value = movementOnlyPresetName(controls.presetSelect.value);
      dynamics = presetProfile(controls.presetSelect.value, jerkScope);
      viewState.unitDistanceM = unitDistanceForPreset(controls.presetSelect.value);
      writeDynamicsControls();
      writeViewControls();
    }
    updateDynamicsModeUi();
    resetOscillator("random");
  });

  controls.presetSelect.addEventListener("input", () => {
    if (controls.presetSelect.value === "custom") {
      return;
    }
    controls.presetSelect.value = normalizedPresetForDynamicsMode(controls.presetSelect.value);
    dynamics = presetProfile(controls.presetSelect.value, jerkScope);
    viewState.unitDistanceM = unitDistanceForPreset(controls.presetSelect.value);
    writeDynamicsControls();
    writeViewControls();
    resetOscillator("random");
  });

  controls.jerkScope.addEventListener("input", () => {
    if (!jerkDynamicsEnabled()) {
      return;
    }
    jerkScope = jerkScopeParam(controls.jerkScope.value);
    applyJerkScopeToDynamics(jerkScope);
    writeDynamicsControls();
    resetOscillator("random");
  });

  controls.colorMode.addEventListener("input", () => {
    viewState.colorMode = colorModeParam(controls.colorMode.value);
    controls.colorMode.value = viewState.colorMode;
    refreshCurrentOutput();
  });

  controls.randomPhase.addEventListener("click", () => resetOscillator("random"));
  controls.unifyPhase.addEventListener("click", () => resetOscillator("unified"));
  controls.resetButton.addEventListener("click", () => {
    playbackSeconds = 0;
    setFrameIndex(0);
    resetOscillator("random");
  });
  controls.pauseButton.addEventListener("click", () => {
    setFramePaused(!framePaused);
  });
  controls.dynamicsPauseButton.addEventListener("click", () => {
    setDynamicsPaused(!dynamicsPaused);
  });
  controls.cameraMode.addEventListener("input", () => {
    setCameraMode(controls.cameraMode.value);
  });
  controls.flyCameraButton.addEventListener("click", () => {
    setCameraMode(camera.mode === "palm" ? "fly" : "palm");
  });
  controls.resetCameraButton.addEventListener("click", () => {
    resetCameraView();
  });
  controls.clearSelectionButton.addEventListener("click", () => {
    selectedParticleIndices.clear();
    updateSelectionOutput();
  });
  controls.frameIndex.addEventListener("input", () => {
    if (!framePaused) {
      return;
    }
    setFrameIndex(Number(controls.frameIndex.value));
    playbackSeconds = currentFrameIndex * frameDuration();
    refreshCurrentOutput();
  });
  controls.exportFrameStop.addEventListener("input", () => {
    controls.exportFrameStop.dataset.defaultLast = "0";
  });
  controls.exportFormat.addEventListener("input", updateExportModeControls);
  controls.exportGifMode.addEventListener("input", updateExportModeControls);
  bindCanvasCameraAndSelection();
  controls.exportAnimationButton.addEventListener("click", () => {
    exportAnimation().catch((error) => {
      controls.exportStatus.textContent = "error";
      console.warn(`Kuramoto animation export failed: ${error?.message || error}`);
    });
  });
  controls.saveProfile.addEventListener("click", saveProfile);
  controls.loadProfileButton.addEventListener("click", () => controls.loadProfile.click());
  controls.loadProfile.addEventListener("change", loadProfile);
}

function applyTooltips() {
  for (const [id, tooltip] of Object.entries(CONTROL_TOOLTIPS)) {
    const element = controls[id] ?? document.getElementById(id);
    if (!element) {
      continue;
    }
    applyTooltipToElement(element, tooltip);

    const valueElement = document.getElementById(`${id}Value`);
    if (valueElement) {
      applyTooltipToElement(valueElement, tooltip);
    }

    const explicitLabel = document.querySelector(`label[for="${id}"]`);
    if (explicitLabel) {
      applyTooltipToElement(explicitLabel, tooltip);
    }

    const wrappingLabel = element.closest("label");
    if (wrappingLabel) {
      applyTooltipToElement(wrappingLabel, tooltip);
      const textElement = wrappingLabel.querySelector("span");
      if (textElement) {
        applyTooltipToElement(textElement, tooltip);
      }
    }

    if (element.tagName === "DD") {
      const label = element.previousElementSibling;
      const row = element.parentElement;
      if (label) {
        applyTooltipToElement(label, tooltip);
      }
      if (row) {
        applyTooltipToElement(row, tooltip);
      }
    }
  }
}

function applyTooltipToElement(element, tooltip) {
  element.title = tooltip;
  if (!element.getAttribute("aria-label") && !element.textContent.trim()) {
    element.setAttribute("aria-label", tooltip);
  }
}

function writeControlsFromState() {
  writeDynamicsControls();
  writeViewControls();
  controls.particleCount.value = String(selectedSampleCount);
  updateFrameControl();
}

function writeDynamicsControls() {
  writePresetLabel();
  dynamics.neighborhoodMode = neighborhoodModeParam(dynamics.neighborhoodMode);
  dynamics.distanceNeighborMaxM = activeDistanceNeighborMaxM();
  controls.neighborhoodMode.value = dynamics.neighborhoodMode;
  controls.movementNoiseSpace.value = movementNoiseSpaceParam(dynamics.movement.noiseSpace);
  for (const [id, path, digits] of dynamicsControlSpecs) {
    const value = getPath(dynamics, path);
    controls[id].value = String(value);
    writeControlValue(id, value, digits);
  }
  updateNeighborhoodModeUi();
}

function writePresetLabel() {
  const label = controls.presetSelect.value === "custom"
    ? "Custom"
    : presetDisplayLabel(controls.presetSelect.value, dynamics.label);
  const dynamicsLabel = jerkDynamicsEnabled()
    ? `${label} / ${JERK_SCOPE_LABELS[jerkScope]}`
    : `${movementOnlyDisplayLabel(label)} / movement only`;
  controls.presetLabel.textContent = `${dynamicsLabel} / ${NEIGHBORHOOD_MODE_LABELS[activeNeighborhoodMode()]}`;
}

function writeViewControls() {
  for (const [id, path, digits] of viewControlSpecs) {
    const value = getPath(viewState, path);
    controls[id].value = String(value);
    writeControlValue(id, value, digits);
  }
}

function writeUrlUiState(state) {
  selectedHand = state.hand;
  controls.handSelect.value = selectedHand;
  dynamicsMode = state.dynamicsMode;
  controls.dynamicsMode.value = dynamicsMode;
  controls.jerkScope.value = state.jerkScope;
  controls.neighborhoodMode.value = neighborhoodModeParam(state.dynamics.neighborhoodMode);
  controls.colorMode.value = state.viewState.colorMode;
  controls.showLinks.checked = state.showLinks;
  controls.showMeshComponents.checked = state.showMeshComponents;
  controls.showVectors.checked = state.showVectors;
  controls.showJerkDebug.checked = state.showJerkDebug;
  writeExportControls(state.exportSettings);
  updateExportModeControls();
  setFramePaused(framePaused);
  setDynamicsPaused(dynamicsPaused);
  setCameraMode(camera.mode);
  updateDynamicsModeUi();
  updateNeighborhoodModeUi();
  updateSelectionOutput();
}

function updateDynamicsModeUi() {
  const enabled = jerkDynamicsEnabled();
  controls.dynamicsMode.value = dynamicsMode;
  for (const element of jerkUiElements) {
    element.hidden = !enabled;
  }
  for (const id of jerkControlIds) {
    controls[id].disabled = !enabled;
  }
  controls.jerkScope.disabled = !enabled;
  controls.showJerkDebug.disabled = !enabled;
  if (!enabled) {
    controls.showJerkDebug.checked = false;
    if (controls.presetSelect.value !== "custom") {
      controls.presetSelect.value = movementOnlyPresetName(controls.presetSelect.value);
    }
  }
  updatePresetOptionsForDynamicsMode();
  updateNeighborhoodModeUi();
  writePresetLabel();
  updateMetrics(oscillator?.diagnostics);
}

function updateNeighborhoodModeUi() {
  const mode = activeNeighborhoodMode();
  const pureDistanceMode = mode === "distance";
  const usesSurfaceDistance = mode === "distance" || mode === "distanceTiered";
  controls.neighborhoodMode.value = activeNeighborhoodMode();
  for (const element of tierNeighborhoodUiElements) {
    element.hidden = pureDistanceMode;
  }
  for (const element of distanceNeighborhoodUiElements) {
    element.hidden = !usesSurfaceDistance;
  }
  for (const id of tierNeighborhoodControlIds) {
    controls[id].disabled = pureDistanceMode || (!jerkDynamicsEnabled() && id.startsWith("jerk"));
  }
  controls.distanceNeighborMaxM.disabled = !usesSurfaceDistance;
}

function updatePresetOptionsForDynamicsMode() {
  const enabled = jerkDynamicsEnabled();
  for (const option of controls.presetSelect.options) {
    if (option.value === "custom") {
      option.hidden = false;
      option.disabled = false;
      continue;
    }

    if (enabled) {
      option.hidden = false;
      option.disabled = false;
      option.textContent = PRESET_LABELS[option.value] ?? option.textContent;
      continue;
    }

    option.hidden = false;
    option.disabled = false;
    option.textContent = MOVEMENT_ONLY_PRESET_LABELS[option.value] ?? option.textContent;
  }
}

function writeExportControls(settings) {
  controls.exportFormat.value = settings.format;
  controls.exportFps.value = String(settings.fps);
  controls.exportFrameStart.value = String(settings.frameStart);
  controls.exportFrameStop.value = settings.frameStop === null ? "" : String(settings.frameStop);
  controls.exportFrameStop.dataset.defaultLast = settings.frameStop === null ? "1" : "0";
  controls.exportFrames.checked = settings.includeFrames;
  controls.exportGifMode.value = settings.gifMode;
  controls.exportHeight.value = String(settings.height);
  controls.exportPhaseStart.value = settings.phaseStart;
  controls.exportSeconds.value = String(settings.seconds);
  controls.exportStart.value = settings.start;
  controls.exportSteps.value = String(settings.stepsPerFrame);
  controls.exportWarmup.value = String(settings.warmupSteps);
  controls.exportWidth.value = String(settings.width);
  controls.exportDynamics.checked = settings.includeDynamics;
}

function writeControlValue(id, value, digits) {
  controls[`${id}Value`].textContent = Number(value).toFixed(digits);
}

function loop(now) {
  const rawDt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const dt = rawDt || frameDuration();
  updateKeyboardCamera(dt);
  if (!exportInProgress && dataset && oscillator) {
    if (!framePaused) {
      playbackSeconds = (playbackSeconds + dt * viewState.playbackSpeed) % cycleDuration();
      setFrameIndex(Math.floor(playbackSeconds / frameDuration()) % datasetFrameCount());
    }
    if (!dynamicsPaused) {
      stepOscillators(dt);
    }
    currentOutput = outputForFrame(currentFrame());
  }
  draw();
  requestAnimationFrame(loop);
}

function resetOscillator(mode) {
  if (!dataset) {
    return;
  }
  const count = dataset.profile.sample_count;
  const rng = createRng(0xa11ce001);
  const jerkEnabled = jerkDynamicsEnabled();
  const movementPhases = Array.from({ length: count }, () =>
    mode === "unified" ? [0, 0, 0] : [rng() * TAU, rng() * TAU, rng() * TAU],
  );
  const nextJerkPhases = Array.from({ length: count }, () =>
    mode === "unified" ? [0, 0, 0] : [rng() * TAU, rng() * TAU, rng() * TAU],
  );
  oscillator = {
    movementPhases,
    jerkPhases: jerkEnabled ? nextJerkPhases : [],
    movementFrequencies: [],
    jerkFrequencies: [],
    noiseSeconds: 0,
    diagnostics: emptyDiagnostics(count),
  };
  rebuildFrequencies();
  currentOutput = outputForFrame(currentFrame());
}

function rebuildFrequencies() {
  if (!oscillator || !dataset) {
    return;
  }
  const frame = currentFrame();
  if (!frame) {
    return;
  }
  oscillator.movementFrequencies = naturalFrequencyRows(
    frame.anchors,
    dynamics.movement.baseFrequencyHz,
    dynamics.movement.frequencySpreadHz,
    MOVEMENT_FREQUENCY_NOISE_SEEDS,
  );
  if (!jerkDynamicsEnabled()) {
    oscillator.jerkFrequencies = [];
    return;
  }
  oscillator.jerkFrequencies = naturalFrequencyRows(
    frame.anchors,
    dynamics.jerk.frequencyHz,
    dynamics.jerk.frequencySpreadHz,
    JERK_FREQUENCY_NOISE_SEEDS,
  );
}

function stepOscillators(dt) {
  oscillator.noiseSeconds += dt;
  integrateField(
    oscillator.movementPhases,
    oscillator.movementFrequencies,
    dynamics.naturalFrequencyMultiplier ?? 1,
    dynamics.movement.weights,
    dynamics.movement.coupling,
    dynamics.movement.crossAxisCoupling,
    activeNeighborhoodMode(),
    activeDistanceNeighborMaxM(),
    MOVEMENT_COUPLING_RATE,
    dt,
  );
  if (!jerkDynamicsEnabled()) {
    return;
  }
  integrateField(
    oscillator.jerkPhases,
    oscillator.jerkFrequencies,
    dynamics.naturalFrequencyMultiplier ?? 1,
    dynamics.jerk.weights,
    dynamics.jerk.coupling,
    dynamics.jerk.crossAxisCoupling,
    activeNeighborhoodMode(),
    activeDistanceNeighborMaxM(),
    JERK_COUPLING_RATE,
    dt,
  );
}

function integrateField(
  phases,
  frequencies,
  naturalFrequencyMultiplier,
  weights,
  fieldCoupling,
  crossAxisCoupling,
  neighborhoodMode,
  distanceNeighborMaxM,
  couplingRate,
  dt,
) {
  const source = phases.map((phase) => phase.slice());
  for (let i = 0; i < phases.length; i += 1) {
    for (let axis = 0; axis < AXES; axis += 1) {
      const neighborhood = neighborhoodPull(
        source,
        i,
        axis,
        weights,
        neighborhoodMode,
        distanceNeighborMaxM,
      );
      const crossAxis = crossAxisPull(source[i], axis);
      const derivative =
        frequencies[i][axis] * naturalFrequencyMultiplier +
        fieldCoupling * couplingRate * neighborhood +
        crossAxisCoupling * CROSS_AXIS_RATE * crossAxis;
      phases[i][axis] = wrap(source[i][axis] + derivative * dt);
    }
  }
}

function neighborhoodPull(phases, coordinate, axis, weights, neighborhoodMode, distanceNeighborMaxM) {
  if (neighborhoodMode === "distance") {
    return distanceNeighborhoodPull(phases, coordinate, axis, weights, distanceNeighborMaxM);
  }
  if (neighborhoodMode === "distanceTiered") {
    return distanceTierNeighborhoodPull(phases, coordinate, axis, weights, distanceNeighborMaxM);
  }
  let sum = 0;
  let active = 0;
  const phase = phases[coordinate][axis];
  for (const edge of graph.adjacency[coordinate]) {
    const weight = weights[edge.tier] ?? 0;
    if (weight !== 0) {
      sum += weight * Math.sin(phases[edge.target][axis] - phase);
      active += 1;
    }
  }
  return active > 0 ? sum / active : 0;
}

function distanceNeighborhoodPull(phases, coordinate, axis, weights, maxDistanceM) {
  const maxDistance = Number(maxDistanceM);
  const useSurfaceDistance = Number.isFinite(maxDistance) && maxDistance > 0;

  let sum = 0;
  let totalWeight = 0;
  const phase = phases[coordinate][axis];
  if (useSurfaceDistance) {
    for (const edge of graph.distanceAdjacency?.[coordinate] ?? []) {
      if (edge.distanceMeters > maxDistance) {
        continue;
      }
      const kernel = Math.max(0, 1 - edge.distanceMeters / maxDistance);
      if (kernel <= 0) {
        continue;
      }
      sum += kernel * Math.sin(phases[edge.target][axis] - phase);
      totalWeight += kernel;
    }
  }

  const smallWorldWeight = weights?.smallWorld ?? 0;
  if (smallWorldWeight !== 0) {
    for (const edge of graph.smallWorldAdjacency?.[coordinate] ?? []) {
      sum += smallWorldWeight * Math.sin(phases[edge.target][axis] - phase);
      totalWeight += 1;
    }
  }
  return totalWeight > 0 ? sum / totalWeight : 0;
}

function distanceTierNeighborhoodPull(phases, coordinate, axis, weights, maxDistanceM) {
  const maxDistance = Number(maxDistanceM);
  const useSurfaceDistance = Number.isFinite(maxDistance) && maxDistance > 0;

  let sum = 0;
  let active = 0;
  const phase = phases[coordinate][axis];
  if (useSurfaceDistance) {
    for (const edge of graph.distanceAdjacency?.[coordinate] ?? []) {
      const tier = surfaceDistanceTier(edge.distanceMeters, maxDistance);
      if (!tier) {
        continue;
      }
      const weight = weights?.[tier] ?? 0;
      if (weight !== 0) {
        sum += weight * Math.sin(phases[edge.target][axis] - phase);
        active += 1;
      }
    }
  }

  const smallWorldWeight = weights?.smallWorld ?? 0;
  if (smallWorldWeight !== 0) {
    for (const edge of graph.smallWorldAdjacency?.[coordinate] ?? []) {
      sum += smallWorldWeight * Math.sin(phases[edge.target][axis] - phase);
      active += 1;
    }
  }
  return active > 0 ? sum / active : 0;
}

function surfaceDistanceTier(distanceMeters, maxDistanceM) {
  if (
    !Number.isFinite(distanceMeters) ||
    !Number.isFinite(maxDistanceM) ||
    maxDistanceM <= 0 ||
    distanceMeters > maxDistanceM
  ) {
    return null;
  }
  if (distanceMeters <= maxDistanceM / 3) {
    return "tier1";
  }
  if (distanceMeters <= (maxDistanceM * 2) / 3) {
    return "tier2";
  }
  return "tier3";
}

function crossAxisPull(phases, axis) {
  let sum = 0;
  let count = 0;
  for (let other = 0; other < AXES; other += 1) {
    if (other !== axis) {
      sum += Math.sin(phases[other] - phases[axis]);
      count += 1;
    }
  }
  return sum / count;
}

function datasetFrameCount() {
  return datasetFrameCountFor(dataset);
}

function datasetFrameCountFor(value) {
  return value?.frameCount ?? value?.frames?.length ?? 0;
}

function currentFrame() {
  return frameAt(currentFrameIndex);
}

function frameAt(index) {
  if (!dataset) {
    return null;
  }
  if (dataset.schema_id === "rusty.kuramoto.mesh.browser_recording_manifest.v2") {
    return binaryFrameAt(dataset, index);
  }
  return dataset.frames[index];
}

function binaryFrameAt(loaded, index) {
  const frameIndex = clampInt(index, 0, Math.max(0, loaded.frameCount - 1));
  if (loaded.frameCache.has(frameIndex)) {
    return loaded.frameCache.get(frameIndex);
  }

  const anchors = [];
  const axes = [];
  const { coordinateBarycentric, coordinateTriangles, sampleCount } = loaded.sampleSet;
  const { triangles, vertexCount, vertices } = loaded.mesh;
  const vertexFrameBase = frameIndex * vertexCount * 3;

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const triangleIndex = coordinateTriangles[sampleIndex];
    const triangleBase = triangleIndex * 3;
    const ia = triangles[triangleBase];
    const ib = triangles[triangleBase + 1];
    const ic = triangles[triangleBase + 2];
    const a = vertexAt(vertices, vertexFrameBase, ia);
    const b = vertexAt(vertices, vertexFrameBase, ib);
    const c = vertexAt(vertices, vertexFrameBase, ic);
    const baryBase = sampleIndex * 3;
    const bary = [
      coordinateBarycentric[baryBase],
      coordinateBarycentric[baryBase + 1],
      coordinateBarycentric[baryBase + 2],
    ];
    const anchor = [
      a[0] * bary[0] + b[0] * bary[1] + c[0] * bary[2],
      a[1] * bary[0] + b[1] * bary[1] + c[1] * bary[2],
      a[2] * bary[0] + b[2] * bary[1] + c[2] * bary[2],
    ];
    anchors.push(anchor);
    axes.push(coordinateAxesFromTriangle(a, b, c));
  }

  const palm = palmAnchorForBinaryFrame(loaded, frameIndex);
  const frame = {
    anchors,
    axes,
    frame_index: loaded.mesh.sourceFrameIndices?.[frameIndex] ?? frameIndex,
    palm_anchor: palm,
    time_seconds: frameIndex * frameDurationFor(loaded),
  };
  loaded.frameCache.set(frameIndex, frame);
  return frame;
}

function vertexAt(vertices, frameBase, vertexIndex) {
  const base = frameBase + vertexIndex * 3;
  return [vertices[base], vertices[base + 1], vertices[base + 2]];
}

function coordinateAxesFromTriangle(a, b, c) {
  const normal = normalizeOr(cross3(sub3(b, a), sub3(c, a)), [0, 1, 0]);
  const up = [0, 1, 0];
  const right = [1, 0, 0];
  const helper = Math.abs(dot3(normal, up)) < 0.92 ? up : right;
  const axisX = normalizeOr(cross3(helper, normal), right);
  const axisY = normalizeOr(cross3(normal, axisX), up);
  return [axisX, axisY, normal];
}

function palmAnchorForBinaryFrame(loaded, frameIndex) {
  const values = loaded.palmAnchors;
  if (!values) {
    return null;
  }
  const base = frameIndex * 3;
  const position = [values[base], values[base + 1], values[base + 2]];
  return {
    position,
    source_frame_index: loaded.mesh.sourceFrameIndices?.[frameIndex] ?? frameIndex,
    source_time_seconds: frameIndex * frameDurationFor(loaded),
  };
}

function outputForFrame(frame) {
  if (!oscillator) {
    return {
      frame,
      positions: frame?.positions ?? frame?.anchors ?? [],
      relativeDriver: frame?.relative_driver ?? zeroDrivers(frame?.anchors?.length ?? 0),
      jerkBoost: frame?.jerk_boost ?? new Array(frame?.anchors?.length ?? 0).fill(0),
    };
  }

  const positions = [];
  const relativeDriver = [];
  const jerkBoost = [];
  const jerkEnabled = jerkDynamicsEnabled();
  let jerkActivationSum = 0;
  let jerkBoostSquares = 0;
  let combinedSquares = 0;
  let clampCount = 0;
  let distanceClampCount = 0;
  let maxDriverLength = 0;
  let maxTravelMeters = 0;
  const componentCount = frame.anchors.length * AXES;

  for (let i = 0; i < frame.anchors.length; i += 1) {
    const raw = [0, 0, 0];
    const boost = [0, 0, 0];
    for (let axis = 0; axis < AXES; axis += 1) {
      const movementPhase = oscillator.movementPhases[i][axis];
      const movement = Math.sin(movementPhase) * dynamics.movement.gain;
      const pulse = jerkEnabled ? jerkPulse(oscillator.jerkPhases[i][axis]) : 0;
      if (jerkEnabled) {
        const direction = Math.cos(movementPhase) >= 0 ? 1 : -1;
        boost[axis] = dynamics.jerk.gain * pulse * direction;
      }
      raw[axis] = movement + boost[axis];
      jerkActivationSum += pulse;
      jerkBoostSquares += boost[axis] * boost[axis];
    }

    const componentClamped = raw.map((value) => {
      const clamped = clamp(value, -1, 1);
      if (clamped !== value) {
        clampCount += 1;
      }
      return clamped;
    });
    const normalized = clampVectorLength(componentClamped, 1);
    if (normalized.clamped) {
      distanceClampCount += 1;
    }
    const combined = normalized.vector;
    const driverLength = Math.hypot(combined[0], combined[1], combined[2]);
    maxDriverLength = Math.max(maxDriverLength, driverLength);
    for (let axis = 0; axis < AXES; axis += 1) {
      combinedSquares += combined[axis] * combined[axis];
    }

    const axes = frame.axes[i];
    const local = combined.map((value) => value * viewState.unitDistanceM);
    const oscillatorWorld = add3(frame.anchors[i], localVector(axes, local));
    const noiseOffset = movementNoiseOffset(
      axes,
      oscillatorWorld,
      combined,
      dynamics.movement,
      oscillator.noiseSeconds,
    );
    const world = add3(oscillatorWorld, noiseOffset);
    maxTravelMeters = Math.max(maxTravelMeters, Math.hypot(...sub3(world, frame.anchors[i])));
    positions.push(world);
    relativeDriver.push(combined);
    jerkBoost.push(Math.hypot(boost[0], boost[1], boost[2]));
  }

  oscillator.diagnostics = {
    coordinateCount: frame.anchors.length,
    movementCoherence: averageOrder(oscillator.movementPhases),
    jerkCoherence: jerkEnabled ? averageOrder(oscillator.jerkPhases) : 0,
    jerkActivationMean: safeMean(jerkActivationSum, componentCount),
    jerkBoostRms: safeRms(jerkBoostSquares, componentCount),
    combinedDriverRms: safeRms(combinedSquares, componentCount),
    clampRatio: safeMean(clampCount, componentCount),
    distanceClampRatio: safeMean(distanceClampCount, frame.anchors.length),
    maxDriverLength,
    maxTravelMeters,
  };

  return { frame, positions, relativeDriver, jerkBoost };
}

function draw(targetSize = null) {
  resizeCanvas(targetSize);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!dataset || !currentOutput) {
    drawStatus(loadError || "Loading recorded Meta Quest hand mesh");
    clearMeshComponentDiagnostics();
    updateMetrics(null);
    return;
  }

  const frame = currentOutput.frame;
  const bounds = viewBoundsForFrame(dataset, frame);
  const scale = Math.min(canvas.width, canvas.height) * 0.44;
  const ox = canvas.width * 0.5;
  const oy = canvas.height * 0.55;

  if (controls.showMeshComponents.checked) {
    drawMeshComponents(bounds, scale, ox, oy);
  } else {
    clearMeshComponentDiagnostics();
  }
  if (controls.showLinks.checked) {
    drawConnections(frame, bounds, scale, ox, oy);
  } else {
    clearLinkDiagnostics();
  }
  if (controls.showVectors.checked) {
    drawDisplacements(frame, currentOutput.positions, bounds, scale, ox, oy);
  }
  drawParticles(currentOutput, bounds, scale, ox, oy);
  updateMetrics(oscillator?.diagnostics);
}

function drawStatus(message) {
  ctx.fillStyle = "#efeee7";
  ctx.font = `${Math.max(14, Math.floor(canvas.width / 58))}px Aptos, Helvetica Neue, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(message, canvas.width * 0.5, canvas.height * 0.5);
}

function drawMeshComponents(bounds, scale, ox, oy) {
  const mesh = dataset?.mesh;
  const components = mesh?.components;
  if (!mesh || !components) {
    clearMeshComponentDiagnostics();
    return;
  }

  const frameIndex = clampInt(currentFrameIndex, 0, Math.max(0, mesh.frameCount - 1));
  const vertexFrameBase = frameIndex * mesh.vertexCount * 3;
  const projectedVertices = new Array(mesh.vertexCount);
  for (let vertex = 0; vertex < mesh.vertexCount; vertex += 1) {
    projectedVertices[vertex] = project(
      vertexAt(mesh.vertices, vertexFrameBase, vertex),
      bounds,
      scale,
      ox,
      oy,
    );
  }

  const triangles = [];
  for (let triangle = 0; triangle < mesh.triangleCount; triangle += 1) {
    const base = triangle * 3;
    const a = projectedVertices[mesh.triangles[base]];
    const b = projectedVertices[mesh.triangles[base + 1]];
    const c = projectedVertices[mesh.triangles[base + 2]];
    if (!a || !b || !c) {
      continue;
    }
    triangles.push({
      a,
      b,
      c,
      component: components.triangleComponents[triangle] ?? 0,
      depth: (a.depth + b.depth + c.depth) / 3,
    });
  }

  triangles.sort((left, right) => right.depth - left.depth);
  ctx.lineWidth = Math.max(0.65, canvas.width / 2600);
  for (const triangle of triangles) {
    ctx.fillStyle = meshComponentColor(triangle.component, 0.14);
    ctx.strokeStyle = meshComponentColor(triangle.component, 0.36);
    ctx.beginPath();
    ctx.moveTo(triangle.a.x, triangle.a.y);
    ctx.lineTo(triangle.b.x, triangle.b.y);
    ctx.lineTo(triangle.c.x, triangle.c.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  canvas.dataset.meshComponentCount = String(components.componentCount);
  canvas.dataset.meshComponentVertexCounts = components.vertexCounts.join(",");
  canvas.dataset.meshComponentTriangleCounts = components.triangleCounts.join(",");
  canvas.dataset.meshVisibleTriangleCount = String(triangles.length);
}

function clearMeshComponentDiagnostics() {
  canvas.dataset.meshComponentCount = "0";
  canvas.dataset.meshComponentVertexCounts = "";
  canvas.dataset.meshComponentTriangleCounts = "";
  canvas.dataset.meshVisibleTriangleCount = "0";
}

function meshComponentColor(component, alpha) {
  const color = MESH_COMPONENT_COLORS[component % MESH_COMPONENT_COLORS.length];
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

function drawConnections(frame, bounds, scale, ox, oy) {
  const mode = activeNeighborhoodMode();
  if (mode === "distance") {
    drawDistanceConnections(frame, bounds, scale, ox, oy);
    return;
  }
  if (mode === "distanceTiered") {
    drawDistanceTierConnections(frame, bounds, scale, ox, oy);
    return;
  }

  const selectedIndex = selectedParticleIndex();
  if (selectedIndex !== null) {
    drawSelectedConnections(frame, bounds, scale, ox, oy, selectedIndex);
    return;
  }

  clearLinkDiagnostics();
  ctx.lineWidth = Math.max(1, canvas.width / 1500);
  ctx.strokeStyle = "rgba(143, 199, 176, 0.12)";
  ctx.beginPath();
  for (const [source, target] of dataset.graph.tier1_edges) {
    moveToProjectedEdge(frame, bounds, scale, ox, oy, source, target);
  }
  ctx.stroke();
}

function drawDistanceConnections(frame, bounds, scale, ox, oy) {
  const maxDistance = activeDistanceNeighborMaxM();
  const selectedIndex = selectedParticleIndex();
  const distanceEdges = graph?.surfaceDistanceEdges ?? [];
  const showSmallWorld = activeSmallWorldLinksEnabled();
  let distanceCount = 0;
  let smallWorldCount = 0;
  clearLinkDiagnostics();
  ctx.lineWidth = selectedIndex === null
    ? Math.max(1, canvas.width / 1500)
    : Math.max(1.7, canvas.width / 960);
  ctx.strokeStyle = selectedIndex === null
    ? "rgba(143, 199, 176, 0.11)"
    : "rgba(143, 199, 176, 0.95)";
  ctx.beginPath();
  for (const edge of distanceEdges) {
    if (edge.distanceMeters > maxDistance) {
      continue;
    }
    if (selectedIndex !== null && edge.source !== selectedIndex && edge.target !== selectedIndex) {
      continue;
    }
    if (moveToProjectedEdge(frame, bounds, scale, ox, oy, edge.source, edge.target)) {
      distanceCount += 1;
    }
  }
  ctx.stroke();

  if (showSmallWorld) {
    ctx.lineWidth = selectedIndex === null
      ? Math.max(1, canvas.width / 1700)
      : Math.max(1.4, canvas.width / 1100);
    ctx.strokeStyle = selectedIndex === null
      ? "rgba(215, 180, 106, 0.16)"
      : "rgba(215, 180, 106, 0.9)";
    ctx.beginPath();
    for (const [source, target] of graph?.smallWorld ?? []) {
      if (selectedIndex !== null && source !== selectedIndex && target !== selectedIndex) {
        continue;
      }
      if (moveToProjectedEdge(frame, bounds, scale, ox, oy, source, target)) {
        smallWorldCount += 1;
      }
    }
    ctx.stroke();
  }

  canvas.dataset.visibleDistanceLinkCount = String(distanceCount);
  canvas.dataset.visibleSmallWorldLinkCount = String(smallWorldCount);
  if (selectedIndex !== null) {
    canvas.dataset.selectedDistanceLinkCount = String(distanceCount);
    canvas.dataset.selectedSmallWorldLinkCount = String(smallWorldCount);
  }
}

function drawDistanceTierConnections(frame, bounds, scale, ox, oy) {
  const maxDistance = activeDistanceNeighborMaxM();
  const selectedIndex = selectedParticleIndex();
  const counts = { tier1: 0, tier2: 0, tier3: 0 };
  clearLinkDiagnostics();

  const selectedTiers = [
    ["tier3", "rgba(209, 122, 108, 0.88)", Math.max(1.2, canvas.width / 1150)],
    ["tier2", "rgba(215, 180, 106, 0.9)", Math.max(1.4, canvas.width / 1050)],
    ["tier1", "rgba(143, 199, 176, 0.95)", Math.max(1.7, canvas.width / 960)],
  ];
  const unselectedTiers = [
    ["tier3", "rgba(209, 122, 108, 0.10)", Math.max(1, canvas.width / 1800)],
    ["tier2", "rgba(215, 180, 106, 0.11)", Math.max(1, canvas.width / 1650)],
    ["tier1", "rgba(143, 199, 176, 0.12)", Math.max(1, canvas.width / 1500)],
  ];
  const tiers = selectedIndex === null ? unselectedTiers : selectedTiers;
  for (const [tier, strokeStyle, lineWidth] of tiers) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = strokeStyle;
    ctx.beginPath();
    for (const edge of graph?.surfaceDistanceEdges ?? []) {
      if (surfaceDistanceTier(edge.distanceMeters, maxDistance) !== tier) {
        continue;
      }
      if (selectedIndex !== null && edge.source !== selectedIndex && edge.target !== selectedIndex) {
        continue;
      }
      if (moveToProjectedEdge(frame, bounds, scale, ox, oy, edge.source, edge.target)) {
        counts[tier] += 1;
      }
    }
    ctx.stroke();
  }

  let smallWorldCount = 0;
  if (activeSmallWorldLinksEnabled()) {
    ctx.lineWidth = selectedIndex === null
      ? Math.max(1, canvas.width / 1900)
      : Math.max(1.3, canvas.width / 1200);
    ctx.strokeStyle = selectedIndex === null
      ? "rgba(239, 238, 231, 0.12)"
      : "rgba(239, 238, 231, 0.72)";
    ctx.beginPath();
    for (const [source, target] of graph?.smallWorld ?? []) {
      if (selectedIndex !== null && source !== selectedIndex && target !== selectedIndex) {
        continue;
      }
      if (moveToProjectedEdge(frame, bounds, scale, ox, oy, source, target)) {
        smallWorldCount += 1;
      }
    }
    ctx.stroke();
  }

  canvas.dataset.visibleDistanceTier1LinkCount = String(counts.tier1);
  canvas.dataset.visibleDistanceTier2LinkCount = String(counts.tier2);
  canvas.dataset.visibleDistanceTier3LinkCount = String(counts.tier3);
  canvas.dataset.visibleSmallWorldLinkCount = String(smallWorldCount);
  if (selectedIndex !== null) {
    canvas.dataset.selectedTier1LinkCount = String(counts.tier1);
    canvas.dataset.selectedTier2LinkCount = String(counts.tier2);
    canvas.dataset.selectedTier3LinkCount = String(counts.tier3);
    canvas.dataset.selectedSmallWorldLinkCount = String(smallWorldCount);
  }
}

function drawSelectedConnections(frame, bounds, scale, ox, oy, selectedIndex) {
  const selectedTiers = [
    ["tier3", graph?.tier3 ?? [], "rgba(209, 122, 108, 0.88)", Math.max(1.2, canvas.width / 1150)],
    ["tier2", graph?.tier2 ?? [], "rgba(215, 180, 106, 0.9)", Math.max(1.4, canvas.width / 1050)],
    ["tier1", graph?.tier1 ?? [], "rgba(143, 199, 176, 0.95)", Math.max(1.7, canvas.width / 960)],
  ];

  const counts = { tier1: 0, tier2: 0, tier3: 0 };
  for (const [tier, edges, strokeStyle, lineWidth] of selectedTiers) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = strokeStyle;
    ctx.beginPath();
    let count = 0;
    for (const [source, target] of edges) {
      if (source !== selectedIndex && target !== selectedIndex) {
        continue;
      }
      if (moveToProjectedEdge(frame, bounds, scale, ox, oy, source, target)) {
        count += 1;
      }
    }
    ctx.stroke();
    counts[tier] = count;
  }
  canvas.dataset.selectedTier1LinkCount = String(counts.tier1);
  canvas.dataset.selectedTier2LinkCount = String(counts.tier2);
  canvas.dataset.selectedTier3LinkCount = String(counts.tier3);
}

function clearLinkDiagnostics() {
  canvas.dataset.selectedTier1LinkCount = "0";
  canvas.dataset.selectedTier2LinkCount = "0";
  canvas.dataset.selectedTier3LinkCount = "0";
  canvas.dataset.selectedDistanceLinkCount = "0";
  canvas.dataset.selectedSmallWorldLinkCount = "0";
  canvas.dataset.visibleDistanceLinkCount = "0";
  canvas.dataset.visibleDistanceTier1LinkCount = "0";
  canvas.dataset.visibleDistanceTier2LinkCount = "0";
  canvas.dataset.visibleDistanceTier3LinkCount = "0";
  canvas.dataset.visibleSmallWorldLinkCount = "0";
}

function moveToProjectedEdge(frame, bounds, scale, ox, oy, source, target) {
  const a = frame.anchors[source];
  const b = frame.anchors[target];
  if (!a || !b) return false;
  const start = project(a, bounds, scale, ox, oy);
  const end = project(b, bounds, scale, ox, oy);
  if (!start || !end) return false;
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  return true;
}

function drawDisplacements(frame, positions, bounds, scale, ox, oy) {
  ctx.lineWidth = Math.max(1, canvas.width / 1600);
  for (let i = 0; i < positions.length; i += 1) {
    const jerk = currentOutput.jerkBoost[i] ?? 0;
    const anchor = project(frame.anchors[i], bounds, scale, ox, oy);
    const point = project(positions[i], bounds, scale, ox, oy);
    if (!anchor || !point) continue;
    ctx.strokeStyle =
      showJerkDebug() && jerk > 0.12
        ? "rgba(209, 122, 108, 0.36)"
        : "rgba(143, 199, 176, 0.2)";
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }
}

function drawParticles(output, bounds, scale, ox, oy) {
  const baseRadius = viewState.particleSize;
  const minScale = particleDepthScaleValue(viewState.particleDepthMinScale);
  const maxScale = particleDepthScaleValue(viewState.particleDepthMaxScale);
  lastProjectedParticles = [];
  const projectedParticles = [];
  let minDepth = Infinity;
  let maxDepth = -Infinity;
  for (let i = 0; i < output.positions.length; i += 1) {
    const point = project(output.positions[i], bounds, scale, ox, oy);
    if (!point) continue;
    minDepth = Math.min(minDepth, point.depth);
    maxDepth = Math.max(maxDepth, point.depth);
    projectedParticles.push({
      color: particleColor(output.relativeDriver[i], output.jerkBoost[i] ?? 0),
      index: i,
      jerk: output.jerkBoost[i] ?? 0,
      point,
    });
  }

  let minRadius = Infinity;
  let maxRadius = -Infinity;
  for (const particle of projectedParticles) {
    const { color, index, jerk, point } = particle;
    const radiusBase = showJerkDebug()
      ? baseRadius + Math.min(1.0, jerk * 2.4) * 7.5
      : baseRadius;
    const radius = radiusBase * particleDepthScale(point.depth, minDepth, maxDepth, minScale, maxScale);
    minRadius = Math.min(minRadius, radius);
    maxRadius = Math.max(maxRadius, radius);
    lastProjectedParticles.push({ index, x: point.x, y: point.y, radius, depth: point.depth, color });
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, TAU);
    ctx.fill();
    if (selectedParticleIndices.has(index)) {
      ctx.lineWidth = Math.max(1.5, radius * 0.42);
      ctx.strokeStyle = "#efeee7";
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 4, 0, TAU);
      ctx.stroke();
    }
  }
  canvas.dataset.projectedParticleCount = String(lastProjectedParticles.length);
  if (lastProjectedParticles.length > 0) {
    canvas.dataset.minProjectedParticleRadius = String(minRadius);
    canvas.dataset.maxProjectedParticleRadius = String(maxRadius);
  } else {
    delete canvas.dataset.minProjectedParticleRadius;
    delete canvas.dataset.maxProjectedParticleRadius;
  }
  const firstParticle = lastProjectedParticles[0];
  if (firstParticle) {
    canvas.dataset.firstProjectedParticleX = String(firstParticle.x);
    canvas.dataset.firstProjectedParticleY = String(firstParticle.y);
    canvas.dataset.firstProjectedParticleRadius = String(firstParticle.radius);
    canvas.dataset.firstProjectedParticleColor = firstParticle.color;
  } else {
    delete canvas.dataset.firstProjectedParticleX;
    delete canvas.dataset.firstProjectedParticleY;
    delete canvas.dataset.firstProjectedParticleRadius;
    delete canvas.dataset.firstProjectedParticleColor;
  }
}

function updateMetrics(diagnostics) {
  controls.sampleMetric.textContent = String(diagnostics?.coordinateCount ?? dataset?.profile?.sample_count ?? 0);
  controls.movementMetric.textContent = metric(diagnostics?.movementCoherence);
  controls.jerkMetric.textContent = metric(diagnostics?.jerkCoherence);
  controls.boostMetric.textContent = metric(diagnostics?.jerkBoostRms);
  controls.activeMetric.textContent = metric(diagnostics?.jerkActivationMean);
  controls.clampMetric.textContent = metric(diagnostics?.clampRatio);
  controls.distanceClampMetric.textContent = metric(diagnostics?.distanceClampRatio);
  controls.travelMetric.textContent = metric(diagnostics?.maxTravelMeters, 4);
}

function buildGraph(loaded) {
  const count = loaded.profile.sample_count;
  const tier1 = loaded.graph.tier1_edges ?? [];
  const tier2 = loaded.graph.tier2_edges ?? [];
  const tier3 = deriveTier3Edges(count, tier1, tier2);
  const smallWorld = loaded.graph.small_world_edges ?? [];
  const surfaceDistanceEdges = surfaceDistanceEdgeRecords(
    count,
    loaded.graph.surface_distance_edges ?? [],
    loaded.graph.surface_distance_meters ?? [],
  );
  const adjacency = Array.from({ length: count }, () => []);
  const distanceAdjacency = Array.from({ length: count }, () => []);
  const smallWorldAdjacency = Array.from({ length: count }, () => []);
  addEdges(adjacency, tier1, "tier1", true);
  addEdges(adjacency, tier2, "tier2", true);
  addEdges(adjacency, tier3, "tier3", true);
  addEdges(adjacency, smallWorld, "smallWorld", false);
  addDistanceEdges(distanceAdjacency, surfaceDistanceEdges);
  addSmallWorldEdges(smallWorldAdjacency, smallWorld);
  return {
    adjacency,
    distanceAdjacency,
    smallWorldAdjacency,
    distanceExportMaxM: loaded.graph.surface_distance_kernel_export_max_m ?? null,
    surfaceDistanceEdges,
    tier1,
    tier2,
    tier3,
    smallWorld,
  };
}

function surfaceDistanceEdgeRecords(count, edges, distances) {
  const records = [];
  const edgeCount = Math.min(edges.length, distances.length);
  for (let index = 0; index < edgeCount; index += 1) {
    const [source, target] = edges[index];
    const distanceMeters = Number(distances[index]);
    if (
      source === target ||
      source < 0 ||
      target < 0 ||
      source >= count ||
      target >= count ||
      !Number.isFinite(distanceMeters) ||
      distanceMeters < 0
    ) {
      continue;
    }
    records.push({ source, target, distanceMeters });
  }
  return records;
}

function deriveTier3Edges(count, tier1, tier2) {
  const known = Array.from({ length: count }, () => new Set());
  for (const [source, target] of [...tier1, ...tier2]) {
    known[source].add(target);
    known[target].add(source);
  }
  const edges = [];
  const seen = new Set();
  for (let source = 0; source < count; source += 1) {
    const candidates = new Set();
    for (const neighbor of known[source]) {
      for (const target of known[neighbor]) {
        if (target !== source && !known[source].has(target)) {
          candidates.add(target);
        }
      }
    }
    for (const target of candidates) {
      const a = Math.min(source, target);
      const b = Math.max(source, target);
      const key = `${a}:${b}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([a, b]);
      }
    }
  }
  return edges;
}

function addEdges(adjacency, edges, tier, bidirectional) {
  for (const [source, target] of edges) {
    if (source === target || !adjacency[source] || !adjacency[target]) continue;
    pushEdge(adjacency[source], target, tier);
    if (bidirectional) {
      pushEdge(adjacency[target], source, tier);
    }
  }
}

function addDistanceEdges(adjacency, edges) {
  for (const edge of edges) {
    if (!adjacency[edge.source] || !adjacency[edge.target]) continue;
    pushDistanceEdge(adjacency[edge.source], edge.target, edge.distanceMeters);
    pushDistanceEdge(adjacency[edge.target], edge.source, edge.distanceMeters);
  }
}

function addSmallWorldEdges(adjacency, edges) {
  for (const [source, target] of edges) {
    if (source === target || !adjacency[source] || !adjacency[target]) continue;
    pushDistanceEdge(adjacency[source], target, 0);
  }
}

function pushDistanceEdge(edges, target, distanceMeters) {
  const existing = edges.find((edge) => edge.target === target);
  if (existing) {
    existing.distanceMeters = Math.min(existing.distanceMeters, distanceMeters);
  } else {
    edges.push({ target, distanceMeters });
  }
}

function pushEdge(edges, target, tier) {
  if (!edges.some((edge) => edge.target === target && edge.tier === tier)) {
    edges.push({ target, tier });
  }
}

function presetProfile(name, scope = DEFAULT_JERK_SCOPE) {
  const preset = presetName(name);
  const smoothJerk = {
    gain: 0,
    frequencyHz: 0,
    pulseThreshold: 0.85,
    pulseSharpness: 3,
    ...jerkScopeDefaults(scope),
  };
  const highJerk = {
    gain: 0.58,
    frequencyHz: 3.1,
    pulseThreshold: 0.68,
    pulseSharpness: 4,
    ...jerkScopeDefaults(scope),
  };
  const energy = energyDefaultsForPreset(preset);
  const coherence = coherenceDefaultsForPreset(preset);
  const movement = {
    gain: 1,
    baseFrequencyHz: energy.baseFrequencyHz,
    frequencySpreadHz: coherence.frequencySpreadHz,
    noiseFrequency: energy.noiseFrequency,
    noiseSpace: DEFAULT_MOVEMENT_NOISE_SPACE,
    noiseAmplitude: energy.noiseAmplitude,
    noiseSpeedHz: energy.noiseSpeedHz,
    noisePhase: 0,
    coupling: coherence.coupling,
    crossAxisCoupling: 0,
    weights: { tier1: 0.5, tier2: 0.3, tier3: 0.1, smallWorld: 0 },
  };
  const table = {
    lowLow: ["Low coherence / low energy", movement, smoothJerk],
    lowHigh: ["Low coherence / high energy", movement, highJerk],
    highLow: ["High coherence / low energy", movement, smoothJerk],
    highHigh: ["High coherence / high energy", movement, highJerk],
  };
  const [label, movementProfile, jerk] = table[preset] ?? table[DEFAULT_PRESET];
  return {
    label,
    naturalFrequencyMultiplier: 1,
    neighborhoodMode: DEFAULT_NEIGHBORHOOD_MODE,
    distanceNeighborMaxM: DEFAULT_DISTANCE_NEIGHBOR_MAX_M,
    movement: cloneProfileObject(movementProfile),
    jerk: cloneProfileObject(jerk),
  };
}

function energyDefaultsForPreset(name) {
  const highEnergy = name === "lowHigh" || name === "highHigh";
  return highEnergy
    ? {
        baseFrequencyHz: 0.88,
        noiseFrequency: 6.7,
        noiseAmplitude: 0.004,
        noiseSpeedHz: 0.5,
        unitDistanceM: 0.004,
      }
    : {
        baseFrequencyHz: 0.44,
        noiseFrequency: 0,
        noiseAmplitude: 0,
        noiseSpeedHz: 0,
        unitDistanceM: 0.002,
      };
}

function coherenceDefaultsForPreset(name) {
  const highCoherence = name === "highLow" || name === "highHigh";
  return highCoherence
    ? { coupling: 1, frequencySpreadHz: 0.03 }
    : { coupling: 0, frequencySpreadHz: 0.62 };
}

function unitDistanceForPreset(name) {
  return energyDefaultsForPreset(presetName(name)).unitDistanceM;
}

function jerkScopeDefaults(scope) {
  if (scope === "local") {
    return {
      frequencySpreadHz: 0.45,
      coupling: 0.08,
      crossAxisCoupling: 0.04,
      weights: { tier1: 0.22, tier2: 0, tier3: 0, smallWorld: 0 },
    };
  }
  return {
    frequencySpreadHz: 0.08,
    coupling: 0.9,
    crossAxisCoupling: 0.32,
    weights: { tier1: 1, tier2: 0.7, tier3: 0.35, smallWorld: 0.35 },
  };
}

function applyJerkScopeToDynamics(scope) {
  const next = jerkScopeDefaults(scope);
  dynamics.jerk.frequencySpreadHz = next.frequencySpreadHz;
  dynamics.jerk.coupling = next.coupling;
  dynamics.jerk.crossAxisCoupling = next.crossAxisCoupling;
  dynamics.jerk.weights = cloneProfileObject(next.weights);
}

function defaultViewState(preset = DEFAULT_PRESET) {
  return {
    colorMode: DEFAULT_COLOR_MODE,
    playbackSpeed: 1,
    unitDistanceM: unitDistanceForPreset(preset),
    particleSize: 1.5,
    particleDepthMinScale: 1,
    particleDepthMaxScale: 1,
  };
}

function defaultCameraState() {
  return {
    mode: DEFAULT_CAMERA_MODE,
    flyMode: DEFAULT_CAMERA_MODE === "fly",
    yaw: -0.24,
    pitch: -0.22,
    distance: 3.4,
    position: [0, 0, 0],
  };
}

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const profileState = readPresetState(params);
  const dynamicsMode = readDynamicsMode(params);
  const preset = presetName(profileState.preset);
  const { jerkScope } = profileState;
  const dynamicsFromUrl = presetProfile(preset, jerkScope);
  const viewStateFromUrl = defaultViewState(preset);
  const cameraFromUrl = readCameraState(params);
  const overrides = [];
  for (const [id, path] of dynamicsControlSpecs) {
    const value = readFiniteParam(params, id);
    if (value !== null) {
      const previous = getPath(dynamicsFromUrl, path);
      setPath(dynamicsFromUrl, path, value);
      if (!sameFiniteValue(previous, value)) {
        overrides.push(id);
      }
    }
  }
  if (params.has("movementNoiseSpace") || params.has("noiseSpace")) {
    const value = movementNoiseSpaceParam(
      params.get("movementNoiseSpace") ?? params.get("noiseSpace"),
    );
    if (value !== dynamicsFromUrl.movement.noiseSpace) {
      overrides.push("movementNoiseSpace");
    }
    dynamicsFromUrl.movement.noiseSpace = value;
  }
  if (params.has("neighborhoodMode") || params.has("neighborhood")) {
    const value = neighborhoodModeParam(
      params.get("neighborhoodMode") ?? params.get("neighborhood"),
    );
    if (value !== dynamicsFromUrl.neighborhoodMode) {
      overrides.push("neighborhoodMode");
    }
    dynamicsFromUrl.neighborhoodMode = value;
  }
  const distanceNeighborMaxAlias = readFiniteParam(params, "distance_neighbor_max_m")
    ?? readFiniteParam(params, "surfaceNeighborMaxM")
    ?? readFiniteParam(params, "surfaceRangeM");
  if (distanceNeighborMaxAlias !== null) {
    const previous = dynamicsFromUrl.distanceNeighborMaxM;
    dynamicsFromUrl.distanceNeighborMaxM = Math.max(0, distanceNeighborMaxAlias);
    if (!sameFiniteValue(previous, dynamicsFromUrl.distanceNeighborMaxM)) {
      overrides.push("distanceNeighborMaxM");
    }
  }
  if (overrides.length > 0) {
    dynamicsFromUrl.label = `${dynamicsFromUrl.label} custom`;
  }

  for (const [id, path] of viewControlSpecs) {
    const value = readFiniteParam(params, id);
    if (value !== null) {
      setPath(viewStateFromUrl, path, value);
    }
  }
  viewStateFromUrl.colorMode = colorModeParam(params.get("colorMode") ?? params.get("color"));

  return {
    hasTuningOverrides: overrides.length > 0,
    hand: handParam(params.get("hand") ?? params.get("handedness")),
    dynamicsMode,
    frameIndex: frameIndexParam(params.get("frameIndex") || params.get("frame")),
    jerkScope,
    phaseMode: phaseModeParam(params.get("phase")),
    preset,
    sampleCount: sampleCountParam(params.get("samples") || params.get("particleCount")),
    showJerkDebug: dynamicsMode === "movementJerk"
      && boolParam(params.get("showJerkDebug") || params.get("jerkDebug")),
    showLinks: boolParam(params.get("showLinks") || params.get("links")),
    showMeshComponents: boolParam(params.get("showMeshComponents") || params.get("meshComponents")),
    showVectors: boolParam(params.get("showVectors") || params.get("vectors")),
    framePaused: boolParam(params.get("framePaused") ?? params.get("paused"), true),
    dynamicsPaused: boolParam(params.get("dynamicsPaused") ?? params.get("pauseDynamics")),
    autoExport: boolParam(params.get("autoExport")),
    camera: cameraFromUrl,
    dynamics: dynamicsFromUrl,
    exportSettings: readExportSettingsFromParams(params),
    viewState: viewStateFromUrl,
  };
}

function sameFiniteValue(left, right) {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= 1e-9;
}

function defaultExportSettings() {
  return {
    format: "gif",
    frameStart: 0,
    frameStop: null,
    fps: 12,
    gifMode: "range",
    height: 720,
    includeDynamics: true,
    includeFrames: true,
    phaseStart: "none",
    seconds: 6,
    start: "current",
    stepsPerFrame: 1,
    warmupSteps: 0,
    width: 960,
  };
}

function readExportSettingsFromParams(params) {
  const next = defaultExportSettings();
  const format = params.get("exportFormat");
  const gifMode = params.get("exportGifMode") ?? params.get("gifMode");
  const phaseStart = params.get("exportPhaseStart") ?? params.get("phaseStart");
  const start = params.get("exportStart");
  if (format === "gif" || format === "mp4") {
    next.format = format;
  }
  next.gifMode = gifModeParam(gifMode, next.gifMode);
  next.phaseStart = exportPhaseStartParam(phaseStart, next.phaseStart);
  if (start === "current" || start === "reset") {
    next.start = start;
  }
  next.fps = readIntParam(params, "exportFps", 4, 30, next.fps);
  next.frameStart = readIntParam(params, "exportFrameStart", 0, 1000000, next.frameStart);
  next.frameStop = readOptionalIntParam(params, "exportFrameStop", 0, 1000000, next.frameStop);
  next.height = readIntParam(params, "exportHeight", 240, 1440, next.height);
  next.seconds = readIntParam(params, "exportSeconds", 1, 30, next.seconds);
  next.stepsPerFrame = readIntParam(params, "exportSteps", 1, 12, next.stepsPerFrame);
  next.warmupSteps = readIntParam(params, "exportWarmup", 0, 720, next.warmupSteps);
  next.width = readIntParam(params, "exportWidth", 320, 1920, next.width);
  if (params.has("exportFrames")) {
    next.includeFrames = boolParam(params.get("exportFrames"));
  }
  if (params.has("exportDynamics")) {
    next.includeDynamics = boolParam(params.get("exportDynamics"));
  }
  return next;
}

function readCameraState(params) {
  const next = defaultCameraState();
  if (params.has("cameraMode") || params.has("camera")) {
    next.mode = cameraModeParam(params.get("cameraMode") ?? params.get("camera"));
    next.flyMode = next.mode === "fly";
  }
  if (params.has("flyCamera") || params.has("fly")) {
    next.flyMode = boolParam(params.get("flyCamera") ?? params.get("fly"));
    if (!params.has("cameraMode") && !params.has("camera")) {
      next.mode = next.flyMode ? "fly" : "orbit";
    }
  }
  const yaw = readFiniteParam(params, "cameraYaw");
  const pitch = readFiniteParam(params, "cameraPitch");
  const distance = readFiniteParam(params, "cameraDistance");
  const x = readFiniteParam(params, "cameraX");
  const y = readFiniteParam(params, "cameraY");
  const z = readFiniteParam(params, "cameraZ");
  if (yaw !== null) {
    next.yaw = yaw;
  }
  if (pitch !== null) {
    next.pitch = clamp(pitch, -1.35, 1.0);
  }
  if (distance !== null) {
    next.distance = clamp(distance, 1.2, 8);
  }
  if (x !== null) {
    next.position[0] = x;
  }
  if (y !== null) {
    next.position[1] = y;
  }
  if (z !== null) {
    next.position[2] = z;
  }
  return next;
}

function readPresetState(params) {
  const rawPreset = params.get("preset") || params.get("profile");
  let preset = presetName(rawPreset);
  let inheritedScope = null;
  if (rawPreset === "lowLocal") {
    preset = "lowHigh";
    inheritedScope = "local";
  } else if (rawPreset === "highLocal") {
    preset = "highHigh";
    inheritedScope = "local";
  }
  return {
    jerkScope: jerkScopeParam(
      params.get("jerkScope") ?? params.get("jerkMode") ?? params.get("scope"),
      inheritedScope ?? DEFAULT_JERK_SCOPE,
    ),
    preset,
  };
}

function presetName(value) {
  return ["lowLow", "lowHigh", "highLow", "highHigh"].includes(value)
    ? value
    : DEFAULT_PRESET;
}

function readDynamicsMode(params) {
  const explicitMode = dynamicsModeParam(params.get("dynamicsMode") ?? params.get("mode"), null);
  if (explicitMode) {
    return explicitMode;
  }
  if (params.has("jerkDynamics")) {
    return boolParam(params.get("jerkDynamics"), true) ? "movementJerk" : "movementOnly";
  }
  return DEFAULT_DYNAMICS_MODE;
}

function dynamicsModeParam(value, fallback = DEFAULT_DYNAMICS_MODE) {
  if (value === null || value === undefined) {
    return fallback;
  }
  const normalized = String(value).toLowerCase();
  if (["movementonly", "movement-only", "movement", "nojerk", "jerkoff"].includes(normalized)) {
    return "movementOnly";
  }
  if (["movementjerk", "movement-jerk", "movement+jerk", "jerk", "jerkon"].includes(normalized)) {
    return "movementJerk";
  }
  return fallback;
}

function jerkDynamicsEnabled() {
  return dynamicsMode !== "movementOnly";
}

function manifestUrlForHand(hand) {
  return BINARY_MANIFEST_URLS[handParam(hand)] ?? BINARY_MANIFEST_URLS.left;
}

function handLabel(hand) {
  return handParam(hand) === "right" ? "right" : "left";
}

function activeNeighborhoodMode() {
  dynamics.neighborhoodMode = neighborhoodModeParam(dynamics.neighborhoodMode);
  return dynamics.neighborhoodMode;
}

function activeDistanceNeighborMaxM() {
  const value = Number(dynamics.distanceNeighborMaxM);
  if (!Number.isFinite(value)) {
    return DEFAULT_DISTANCE_NEIGHBOR_MAX_M;
  }
  return Math.min(DISTANCE_NEIGHBOR_EXPORT_MAX_M, Math.max(0, value));
}

function activeSmallWorldLinksEnabled() {
  const movementSmallWorld = Number(dynamics.movement.weights.smallWorld);
  const movementCoupling = Number(dynamics.movement.coupling);
  const movementActive = Number.isFinite(movementSmallWorld)
    && Number.isFinite(movementCoupling)
    && movementSmallWorld !== 0
    && movementCoupling !== 0;
  const jerkSmallWorld = Number(dynamics.jerk.weights.smallWorld);
  const jerkCoupling = Number(dynamics.jerk.coupling);
  const jerkActive = jerkDynamicsEnabled()
    && Number.isFinite(jerkSmallWorld)
    && Number.isFinite(jerkCoupling)
    && jerkSmallWorld !== 0
    && jerkCoupling !== 0;
  return movementActive || jerkActive;
}

function neighborhoodModeParam(value, fallback = DEFAULT_NEIGHBORHOOD_MODE) {
  if (value === null || value === undefined) {
    return fallback;
  }
  const normalized = String(value).toLowerCase();
  if (
    [
      "distancetiered",
      "distance-tiered",
      "tiereddistance",
      "tiered-distance",
      "tieredsurfacedistance",
      "tiered-surface-distance",
      "surface-distance-tiered",
      "surface-tiered",
    ].includes(normalized)
  ) {
    return "distanceTiered";
  }
  if (["distance", "surface", "surface-distance", "surfacedistance", "kernel", "qri"].includes(normalized)) {
    return "distance";
  }
  if (["tiered", "tiers", "tier", "smallworld", "small-world"].includes(normalized)) {
    return "tiered";
  }
  return fallback;
}

function normalizedPresetForDynamicsMode(name) {
  return presetName(name);
}

function movementOnlyPresetName(name) {
  return presetName(name);
}

function presetDisplayLabel(name, fallback) {
  return jerkDynamicsEnabled()
    ? PRESET_LABELS[name] ?? fallback
    : MOVEMENT_ONLY_PRESET_LABELS[movementOnlyPresetName(name)] ?? fallback;
}

function movementOnlyDisplayLabel(label) {
  return label;
}

function jerkScopeParam(value, fallback = DEFAULT_JERK_SCOPE) {
  return value === "local" || value === "global" ? value : fallback;
}

function handParam(value, fallback = DEFAULT_HAND) {
  if (value === null || value === undefined) {
    return fallback;
  }
  const normalized = String(value).toLowerCase();
  if (["right", "r", "right-hand", "righthand"].includes(normalized)) {
    return "right";
  }
  if (["left", "l", "left-hand", "lefthand"].includes(normalized)) {
    return "left";
  }
  return fallback;
}

function movementNoiseSpaceParam(value, fallback = DEFAULT_MOVEMENT_NOISE_SPACE) {
  if (value === null || value === undefined) {
    return fallback;
  }
  const normalized = String(value).toLowerCase();
  if (["local", "localnormalized", "local-normalized", "normalized", "coordinate"].includes(normalized)) {
    return "local";
  }
  if (["world", "worldfield", "world-field"].includes(normalized)) {
    return "world";
  }
  return fallback;
}

function colorModeParam(value, fallback = DEFAULT_COLOR_MODE) {
  if (value === null || value === undefined) {
    return fallback;
  }
  const normalized = String(value).toLowerCase();
  if (normalized === "cilab" || normalized === "lab") {
    return "cielab";
  }
  if (["rgb", "rgbdriver", "rgb-driver", "cartesianrgb", "cartesian-rgb"].includes(normalized)) {
    return "cartesian";
  }
  return normalized === "cartesian" || normalized === "spherical" || normalized === "cielab" ? normalized : fallback;
}

function cameraModeParam(value, fallback = DEFAULT_CAMERA_MODE) {
  return value === "fly" || value === "orbit" || value === "palm" ? value : fallback;
}

function gifModeParam(value, fallback = "range") {
  return value === "time" || value === "range" ? value : fallback;
}

function exportPhaseStartParam(value, fallback = "none") {
  return ["none", "unified", "random"].includes(value) ? value : fallback;
}

function sampleCountParam(value) {
  const count = Math.trunc(Number(value));
  return SUPPORTED_SAMPLE_COUNTS.includes(count) ? count : DEFAULT_SAMPLE_COUNT;
}

function phaseModeParam(value) {
  return value === "unified" ? "unified" : "random";
}

function frameIndexParam(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const frame = Math.trunc(Number(value));
  return Number.isFinite(frame) ? Math.max(0, frame) : null;
}

function readFiniteParam(params, name) {
  if (!params.has(name)) {
    return null;
  }
  const value = Number(params.get(name));
  return Number.isFinite(value) ? value : null;
}

function readIntParam(params, name, min, max, fallback) {
  const value = readFiniteParam(params, name);
  if (value === null) {
    return fallback;
  }
  return clampInt(value, min, max);
}

function readOptionalIntParam(params, name, min, max, fallback) {
  if (!params.has(name)) {
    return fallback;
  }
  return readIntParam(params, name, min, max, fallback ?? min);
}

function boolParam(value, fallback = false) {
  if (value === null || value === undefined) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function saveProfile() {
  const payload = {
    schema_id: "rusty.kuramoto.mesh.dynamics_profile.v1",
    dynamics_mode: dynamicsMode,
    jerk_dynamics_enabled: jerkDynamicsEnabled(),
    label: dynamics.label,
    naturalFrequencyMultiplier: dynamics.naturalFrequencyMultiplier,
    natural_frequency_multiplier: dynamics.naturalFrequencyMultiplier,
    neighborhoodMode: activeNeighborhoodMode(),
    neighborhood_mode: activeNeighborhoodMode(),
    distanceNeighborMaxM: activeDistanceNeighborMaxM(),
    distance_neighbor_max_m: activeDistanceNeighborMaxM(),
    movement: cloneProfileObject(dynamics.movement),
    jerk: cloneProfileObject(dynamics.jerk),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "kuramoto-mesh-profile.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

async function loadProfile(event) {
  const [file] = event.target.files;
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    dynamics = mergeDynamicsProfile(presetProfile(DEFAULT_PRESET, jerkScope), parsed);
    dynamicsMode = dynamicsModeFromProfile(parsed, dynamicsMode);
    dynamics.neighborhoodMode = neighborhoodModeFromProfile(parsed, dynamics.neighborhoodMode);
    writeDynamicsControls();
    controls.presetSelect.value = "custom";
    updateDynamicsModeUi();
    updateNeighborhoodModeUi();
    resetOscillator("random");
  } finally {
    event.target.value = "";
  }
}

function mergeDynamicsProfile(base, source) {
  let incoming = source?.dynamics ?? source;
  if (
    incoming?.natural_frequency_multiplier !== undefined &&
    incoming?.naturalFrequencyMultiplier === undefined
  ) {
    incoming = {
      ...incoming,
      naturalFrequencyMultiplier: incoming.natural_frequency_multiplier,
    };
  }
  if (incoming?.neighborhood_mode !== undefined && incoming?.neighborhoodMode === undefined) {
    incoming = {
      ...incoming,
      neighborhoodMode: incoming.neighborhood_mode,
    };
  }
  if (
    incoming?.distance_neighbor_max_m !== undefined &&
    incoming?.distanceNeighborMaxM === undefined
  ) {
    incoming = {
      ...incoming,
      distanceNeighborMaxM: incoming.distance_neighbor_max_m,
    };
  }
  for (const key of Object.keys(base)) {
    if (incoming?.[key] === undefined) continue;
    if (typeof base[key] === "object" && base[key] !== null && !Array.isArray(base[key])) {
      base[key] = mergeDynamicsProfile(base[key], incoming[key]);
    } else if (Number.isFinite(incoming[key]) || typeof incoming[key] === "string") {
      base[key] = incoming[key];
    }
  }
  return base;
}

function dynamicsModeFromProfile(profile, fallback) {
  if (profile?.jerk_dynamics_enabled === false || profile?.jerkDynamicsEnabled === false) {
    return "movementOnly";
  }
  return dynamicsModeParam(profile?.dynamics_mode ?? profile?.dynamicsMode, fallback);
}

function neighborhoodModeFromProfile(profile, fallback) {
  return neighborhoodModeParam(profile?.neighborhood_mode ?? profile?.neighborhoodMode, fallback);
}

function setFrameIndex(index) {
  currentFrameIndex = clampInt(index, 0, Math.max(0, datasetFrameCount() - 1));
  updateFrameControl();
}

function setFramePaused(value) {
  framePaused = Boolean(value);
  controls.pauseButton.textContent = framePaused ? "Resume frames" : "Pause frames";
  controls.pauseButton.setAttribute("aria-pressed", String(framePaused));
  updateFrameControl();
}

function setDynamicsPaused(value) {
  dynamicsPaused = Boolean(value);
  controls.dynamicsPauseButton.textContent = dynamicsPaused ? "Resume dynamics" : "Pause dynamics";
  controls.dynamicsPauseButton.setAttribute("aria-pressed", String(dynamicsPaused));
}

function setFlyCamera(value) {
  setCameraMode(value ? "fly" : "orbit");
}

function setCameraMode(value) {
  const mode = cameraModeParam(value);
  camera.mode = mode;
  camera.flyMode = mode === "fly";
  if (mode !== "fly") {
    camera.position = [0, 0, 0];
  }
  controls.cameraMode.value = mode;
  controls.flyCameraButton.textContent = mode === "palm" ? "Free fly" : "Palm anchor";
  controls.flyCameraButton.setAttribute("aria-pressed", String(mode === "palm"));
  canvas.classList.toggle("is-fly-camera", mode === "fly");
  canvas.classList.toggle("is-palm-camera", mode === "palm");
  canvas.dataset.cameraMode = mode;
  pressedKeys.clear();
}

function resetCameraView() {
  const mode = camera.mode;
  camera = defaultCameraState();
  setCameraMode(mode);
}

function updateFrameControl() {
  const frameCount = datasetFrameCount();
  const maxFrame = Math.max(0, frameCount - 1);
  currentFrameIndex = clampInt(currentFrameIndex, 0, maxFrame);
  controls.frameIndex.max = String(maxFrame);
  controls.frameIndex.value = String(currentFrameIndex);
  controls.frameIndex.disabled = !framePaused || frameCount <= 0;
  controls.frameIndexValue.textContent = frameCount > 0 ? `${currentFrameIndex} / ${maxFrame}` : "0 / 0";
  updateExportFrameBounds();
}

function refreshCurrentOutput() {
  if (dataset && oscillator) {
    currentOutput = outputForFrame(currentFrame());
  }
}

function updateSelectionOutput() {
  const selectedIndex = selectedParticleIndex();
  controls.selectedMetric.textContent = selectedIndex !== null
    ? String(selectedIndex)
    : "none";
  controls.clearSelectionButton.disabled = selectedParticleIndices.size === 0;
  canvas.dataset.selectedParticleCount = String(selectedParticleIndices.size);
  if (selectedIndex === null) {
    delete canvas.dataset.selectedParticleIndex;
  } else {
    canvas.dataset.selectedParticleIndex = String(selectedIndex);
  }
}

function selectedParticleIndex() {
  if (selectedParticleIndices.size !== 1) {
    return null;
  }
  return selectedParticleIndices.values().next().value;
}

function queueAutoExport() {
  if (!autoExportPending || !dataset || !oscillator || !currentOutput) {
    return;
  }
  autoExportPending = false;
  window.setTimeout(() => {
    exportAnimation().catch((error) => {
      controls.exportStatus.textContent = "error";
      console.warn(`Kuramoto animation export failed: ${error?.message || error}`);
    });
  }, 150);
}

async function exportAnimation() {
  if (exportInProgress) {
    return;
  }
  if (!dataset || !oscillator || !currentOutput) {
    setExportStatus("unavailable");
    return;
  }

  exportInProgress = true;
  setExportControlsEnabled(false);
  const original = snapshotRuntimeState();
  const settings = readExportSettings();
  setExportStatus(`${settings.format} capture`);

  try {
    if (settings.format !== "gif" && settings.start === "reset") {
      playbackSeconds = 0;
      resetOscillator("random");
    }
    if (settings.format === "gif" && settings.gifMode === "range") {
      setFrameIndex(settings.frameStart);
      playbackSeconds = currentFrameIndex * frameDuration();
    } else if (settings.format === "gif") {
      playbackSeconds = currentFrameIndex * frameDuration();
    } else if (settings.start === "reset") {
      setFrameIndex(0);
    }
    refreshCurrentOutput();
    const { exportCanvasAnimation } = await import(
      new URL("animation-export/browser-animation-export.js", SCRIPT_ASSET_BASE).href
    );
    const result = await exportCanvasAnimation({
      format: settings.format,
      frameCount: settings.frameCount,
      fps: settings.fps,
      height: settings.height,
      seconds: settings.seconds,
      stepsPerFrame: settings.stepsPerFrame,
      warmupSteps: settings.warmupSteps,
      width: settings.width,
      beforeCapture: () => applyExportPhaseStart(settings),
      captureFrame: ({ width, height }) => captureExportFrame(width, height),
      onStatus: setExportStatus,
      stepFrame: ({ dt, frameIndex }) => stepExportFrame(dt, settings, frameIndex),
    });
    const filename = [
      "kuramoto-mesh",
      settings.format,
      controls.presetSelect.value,
      jerkDynamicsEnabled() ? jerkScope : "movementOnly",
      activeNeighborhoodMode(),
      viewState.colorMode,
      `${selectedSampleCount}coords`,
      exportClipFilenamePart(settings),
      settings.phaseStart === "none" ? null : `phase-${settings.phaseStart}`,
      `${settings.width}x${settings.height}`,
      `${settings.fps}fps`,
    ].filter(Boolean).join("-").replace(/[^a-z0-9_.-]+/gi, "_");
    downloadBlob(result.blob, `${filename}.${result.extension}`);
    setExportStatus(`${result.extension} saved ${(result.blob.size / 1024 / 1024).toFixed(1)} MB`);
  } catch (error) {
    setExportStatus(`${settings.format} error`);
    console.warn(`Kuramoto animation export failed: ${error?.message || error}`);
  } finally {
    restoreRuntimeState(original);
    setExportControlsEnabled(true);
    updateExportModeControls();
    exportInProgress = false;
  }
}

function readExportSettings() {
  const format = controls.exportFormat.value === "mp4" ? "mp4" : "gif";
  const gifMode = gifModeParam(controls.exportGifMode.value);
  const seconds = readBoundedInt(controls.exportSeconds, 1, 30, 6);
  const fps = readBoundedInt(controls.exportFps, 4, 30, 12);
  const frameRange = gifMode === "range"
    ? readGifFrameRange()
    : { count: Math.max(1, seconds * fps), start: currentFrameIndex, stop: currentFrameIndex };
  return {
    frameCount: format === "gif" ? frameRange.count : null,
    frameStart: frameRange.start,
    frameStop: frameRange.stop,
    format,
    fps,
    gifMode,
    height: readBoundedInt(controls.exportHeight, 240, 1440, 720),
    includeDynamics: controls.exportDynamics.checked,
    includeFrames: format === "gif" && gifMode === "time" ? false : controls.exportFrames.checked,
    phaseStart: format === "gif" ? exportPhaseStartParam(controls.exportPhaseStart.value) : "none",
    seconds,
    start: controls.exportStart.value === "reset" ? "reset" : "current",
    stepsPerFrame: readBoundedInt(controls.exportSteps, 1, 12, 1),
    warmupSteps: readBoundedInt(controls.exportWarmup, 0, 720, 0),
    width: readBoundedInt(controls.exportWidth, 320, 1920, 960),
  };
}

function readGifFrameRange() {
  const maxFrame = Math.max(0, datasetFrameCount() - 1);
  const start = readBoundedInt(controls.exportFrameStart, 0, maxFrame, 0);
  let stop = controls.exportFrameStop.value === ""
    ? maxFrame
    : readBoundedInt(controls.exportFrameStop, 0, maxFrame, maxFrame);
  if (stop < start) {
    stop = start;
  }
  controls.exportFrameStart.value = String(start);
  controls.exportFrameStop.value = String(stop);
  return {
    count: stop - start + 1,
    start,
    stop,
  };
}

function stepExportFrame(dt, settings, frameIndex) {
  if (settings.includeFrames && settings.format === "gif" && settings.gifMode === "range" && frameIndex >= 0) {
    const nextFrame = clampInt(settings.frameStart + frameIndex, settings.frameStart, settings.frameStop);
    setFrameIndex(nextFrame);
    playbackSeconds = currentFrameIndex * frameDuration();
  } else if (settings.includeFrames && settings.format !== "gif") {
    playbackSeconds = (playbackSeconds + dt * viewState.playbackSpeed) % cycleDuration();
    setFrameIndex(Math.floor(playbackSeconds / frameDuration()) % datasetFrameCount());
  }
  if (settings.includeDynamics) {
    stepOscillators(dt);
  }
  refreshCurrentOutput();
}

function applyExportPhaseStart(settings) {
  if (settings.format !== "gif" || settings.phaseStart === "none") {
    return;
  }
  resetOscillator(settings.phaseStart === "unified" ? "unified" : "random");
  refreshCurrentOutput();
}

function exportClipFilenamePart(settings) {
  if (settings.format !== "gif") {
    return `${settings.seconds}s`;
  }
  return settings.gifMode === "time"
    ? `time${settings.seconds}s-fixed-frame${settings.frameStart}`
    : `frames${settings.frameStart}-${settings.frameStop}`;
}

function captureExportFrame(width, height) {
  const originalWidth = canvas.width;
  const originalHeight = canvas.height;
  try {
    draw({ width, height });
    return ctx.getImageData(0, 0, width, height);
  } finally {
    canvas.width = originalWidth;
    canvas.height = originalHeight;
  }
}

function snapshotRuntimeState() {
  return {
    currentFrameIndex,
    dynamicsPaused,
    framePaused,
    oscillator: oscillator ? cloneProfileObject(oscillator) : null,
    playbackSeconds,
  };
}

function restoreRuntimeState(snapshot) {
  playbackSeconds = snapshot.playbackSeconds;
  oscillator = snapshot.oscillator;
  setFrameIndex(snapshot.currentFrameIndex);
  setFramePaused(snapshot.framePaused);
  setDynamicsPaused(snapshot.dynamicsPaused);
  refreshCurrentOutput();
}

function setExportControlsEnabled(enabled) {
  controls.exportAnimationButton.disabled = !enabled;
  for (const control of [
    controls.exportDynamics,
    controls.exportFormat,
    controls.exportFps,
    controls.exportFrameStart,
    controls.exportFrameStop,
    controls.exportFrames,
    controls.exportGifMode,
    controls.exportHeight,
    controls.exportPhaseStart,
    controls.exportSeconds,
    controls.exportStart,
    controls.exportSteps,
    controls.exportWarmup,
    controls.exportWidth,
  ]) {
    control.disabled = !enabled;
  }
}

function setExportStatus(value) {
  controls.exportStatus.textContent = value;
}

function updateExportFrameBounds() {
  const frameCount = datasetFrameCount();
  const maxFrame = Math.max(0, frameCount - 1);
  controls.exportFrameStart.max = String(maxFrame);
  controls.exportFrameStop.max = String(maxFrame);
  if (frameCount <= 0) {
    return;
  }
  controls.exportFrameStart.value = String(clampInt(controls.exportFrameStart.value, 0, maxFrame));
  if (controls.exportFrameStop.value === "" || controls.exportFrameStop.dataset.defaultLast === "1") {
    controls.exportFrameStop.value = String(maxFrame);
    controls.exportFrameStop.dataset.defaultLast = "0";
  } else {
    controls.exportFrameStop.value = String(clampInt(controls.exportFrameStop.value, 0, maxFrame));
  }
}

function updateExportModeControls() {
  const gifMode = controls.exportFormat.value !== "mp4";
  const fixedTimeGif = gifMode && controls.exportGifMode.value === "time";
  const rangeGif = gifMode && !fixedTimeGif;
  for (const element of document.querySelectorAll(".export-gif-setting")) {
    element.hidden = !gifMode;
  }
  for (const element of document.querySelectorAll(".export-gif-range-setting")) {
    element.hidden = !rangeGif;
  }
  for (const element of document.querySelectorAll(".export-gif-time-setting")) {
    element.hidden = !fixedTimeGif;
  }
  for (const element of document.querySelectorAll(".export-time-setting")) {
    element.hidden = gifMode && !fixedTimeGif;
  }
  for (const element of document.querySelectorAll(".export-mp4-setting")) {
    element.hidden = gifMode;
  }
  controls.exportFrames.disabled = exportInProgress || fixedTimeGif;
  updateExportFrameBounds();
}

function readBoundedInt(control, min, max, fallback) {
  const value = Math.trunc(Number(control.value));
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function bindCanvasCameraAndSelection() {
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }
    activePointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
    };
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!activePointer || activePointer.id !== event.pointerId) {
      return;
    }
    const dx = event.clientX - activePointer.x;
    const dy = event.clientY - activePointer.y;
    activePointer.x = event.clientX;
    activePointer.y = event.clientY;
    camera.yaw += dx * 0.006;
    camera.pitch = clamp(camera.pitch + dy * 0.004, -1.35, 1.0);
  });

  canvas.addEventListener("pointerup", (event) => {
    if (activePointer && activePointer.id === event.pointerId) {
      const moved = Math.hypot(event.clientX - activePointer.startX, event.clientY - activePointer.startY);
      if (moved < 5) {
        toggleParticleSelection(event.clientX, event.clientY);
      }
    }
    activePointer = null;
  });

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    if (camera.mode === "fly") {
      const direction = event.deltaY > 0 ? -1 : 1;
      moveCamera([0, 0, direction], 0.14 * (event.shiftKey ? 3 : 1));
    } else {
      const factor = event.deltaY > 0 ? 1.08 : 0.92;
      camera.distance = clamp(camera.distance * factor, 1.2, 8);
    }
  }, { passive: false });

  window.addEventListener("keydown", (event) => {
    if (!cameraUsesKeyboard() || isEditableTarget(event.target)) {
      return;
    }
    if (isCameraKey(event.code)) {
      event.preventDefault();
      pressedKeys.add(event.code);
    }
  });

  window.addEventListener("keyup", (event) => {
    pressedKeys.delete(event.code);
  });
}

function updateKeyboardCamera(dt) {
  if (!cameraUsesKeyboard() || pressedKeys.size === 0) {
    return;
  }
  if (camera.mode === "palm" || camera.mode === "orbit") {
    rotateAnchorCamera(dt);
    return;
  }
  const move = [0, 0, 0];
  if (pressedKeys.has("KeyW") || pressedKeys.has("ArrowUp")) {
    move[2] += 1;
  }
  if (pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown")) {
    move[2] -= 1;
  }
  if (pressedKeys.has("KeyA") || pressedKeys.has("ArrowLeft")) {
    move[0] -= 1;
  }
  if (pressedKeys.has("KeyD") || pressedKeys.has("ArrowRight")) {
    move[0] += 1;
  }
  if (pressedKeys.has("KeyQ")) {
    move[1] -= 1;
  }
  if (pressedKeys.has("KeyE")) {
    move[1] += 1;
  }
  const speed = (pressedKeys.has("ShiftLeft") || pressedKeys.has("ShiftRight")) ? 1.6 : 0.55;
  moveCamera(move, speed * dt);
}

function rotateAnchorCamera(dt) {
  let yaw = 0;
  let pitch = 0;
  let zoom = 0;
  if (pressedKeys.has("KeyA") || pressedKeys.has("ArrowLeft")) {
    yaw -= 1;
  }
  if (pressedKeys.has("KeyD") || pressedKeys.has("ArrowRight")) {
    yaw += 1;
  }
  if (pressedKeys.has("KeyW") || pressedKeys.has("ArrowUp")) {
    pitch -= 1;
  }
  if (pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown")) {
    pitch += 1;
  }
  if (pressedKeys.has("KeyQ")) {
    zoom += 1;
  }
  if (pressedKeys.has("KeyE")) {
    zoom -= 1;
  }
  const speed = (pressedKeys.has("ShiftLeft") || pressedKeys.has("ShiftRight")) ? 2.4 : 1.1;
  camera.yaw += yaw * speed * dt;
  camera.pitch = clamp(camera.pitch + pitch * speed * 0.72 * dt, -1.35, 1.0);
  if (zoom !== 0) {
    camera.distance = clamp(camera.distance + zoom * speed * 0.8 * dt, 1.2, 8);
  }
}

function moveCamera(move, amount) {
  const length = Math.hypot(move[0], move[1], move[2]);
  if (length <= 0) {
    return;
  }
  const normalized = move.map((value) => value / length);
  let worldMove = rotateXVec(normalized, -camera.pitch);
  worldMove = rotateYVec(worldMove, -camera.yaw);
  camera.position[0] += worldMove[0] * amount;
  camera.position[1] += worldMove[1] * amount;
  camera.position[2] += worldMove[2] * amount;
}

function toggleParticleSelection(clientX, clientY) {
  const hit = pickParticle(clientX, clientY);
  if (hit === null) {
    return;
  }
  if (selectedParticleIndices.has(hit)) {
    selectedParticleIndices.clear();
  } else {
    selectedParticleIndices.clear();
    selectedParticleIndices.add(hit);
  }
  updateSelectionOutput();
}

function pickParticle(clientX, clientY) {
  if (lastProjectedParticles.length === 0) {
    return null;
  }
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / Math.max(1, rect.width);
  const scaleY = canvas.height / Math.max(1, rect.height);
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;
  let best = null;
  let bestDistanceSq = Infinity;
  for (const particle of lastProjectedParticles) {
    const dx = particle.x - x;
    const dy = particle.y - y;
    const distanceSq = dx * dx + dy * dy;
    const hitRadius = Math.max(10, particle.radius + 6);
    if (distanceSq <= hitRadius * hitRadius && distanceSq < bestDistanceSq) {
      best = particle.index;
      bestDistanceSq = distanceSq;
    }
  }
  return best;
}

function cameraUsesKeyboard() {
  return camera.mode === "fly" || camera.mode === "palm" || camera.mode === "orbit";
}

function isCameraKey(code) {
  return [
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "KeyQ",
    "KeyE",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ShiftLeft",
    "ShiftRight",
  ].includes(code);
}

function isEditableTarget(target) {
  return target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLButtonElement;
}

function resizeCanvas(targetSize = null) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = targetSize
    ? Math.max(1, Math.floor(targetSize.width))
    : Math.max(1, Math.floor(rect.width * dpr));
  const height = targetSize
    ? Math.max(1, Math.floor(targetSize.height))
    : Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function boundsFromDataset(loaded) {
  const min = loaded.bounds.min;
  const max = loaded.bounds.max;
  const minZ = min[2] ?? 0;
  const maxZ = max[2] ?? minZ;
  const padding = Math.max(0.02, (viewState.unitDistanceM ?? 0.035) * 1.35);
  const width = Math.max(0.08, max[0] - min[0] + padding * 2);
  const height = Math.max(0.08, max[1] - min[1] + padding * 2);
  const depth = Math.max(0.08, maxZ - minZ + padding * 2);
  return {
    cx: (min[0] + max[0]) * 0.5,
    cy: (min[1] + max[1]) * 0.5,
    cz: (minZ + maxZ) * 0.5,
    radius: Math.max(width, height, depth) * 0.5,
  };
}

function viewBoundsForFrame(loaded, frame) {
  const bounds = boundsFromDataset(loaded);
  const palm = camera.mode === "palm" ? palmAnchorPoint(frame) : null;
  if (!palm) {
    canvas.dataset.palmAnchorAvailable = palmAnchorPoint(frame) ? "1" : "0";
    return bounds;
  }
  canvas.dataset.palmAnchorAvailable = "1";
  return {
    ...bounds,
    cx: palm[0],
    cy: palm[1],
    cz: palm[2],
  };
}

function palmAnchorPoint(frame) {
  const raw = frame?.palm_anchor;
  if (Array.isArray(raw) && raw.length === 3 && raw.every(Number.isFinite)) {
    return raw;
  }
  const position = raw?.position;
  if (Array.isArray(position) && position.length === 3 && position.every(Number.isFinite)) {
    return position;
  }
  return null;
}

function project(point, bounds, scale, ox, oy) {
  let local = [
    ((point[0] - bounds.cx) / bounds.radius) - camera.position[0],
    ((point[1] - bounds.cy) / bounds.radius) - camera.position[1],
    ((point[2] - bounds.cz) / bounds.radius) - camera.position[2],
  ];
  local = rotateYVec(local, camera.yaw);
  local = rotateXVec(local, camera.pitch);
  const depth = local[2] + camera.distance;
  if (depth <= 0.12) {
    return null;
  }
  const perspective = camera.distance / depth;
  return {
    x: ox + local[0] * scale * perspective,
    y: oy - local[1] * scale * perspective,
    depth,
    perspective,
  };
}

function rotateYVec(point, angle) {
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  return [c * point[0] + s * point[2], point[1], -s * point[0] + c * point[2]];
}

function rotateXVec(point, angle) {
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  return [point[0], c * point[1] - s * point[2], s * point[1] + c * point[2]];
}

function particleColor(driver, jerk) {
  if (showJerkDebug() && jerk > 0.12) {
    return "#d17a6c";
  }
  if (viewState.colorMode === "cartesian") {
    return cartesianDriverColor(driver);
  }
  if (viewState.colorMode === "cielab") {
    return cielabSphereColor(driver);
  }
  return sphericalVolumeColor(driver);
}

function showJerkDebug() {
  return jerkDynamicsEnabled() && controls.showJerkDebug.checked;
}

function accurateParticleDepthMaxScale() {
  const range = currentParticleDepthRange();
  if (!range) {
    return 1;
  }
  const ratio = range.maxDepth / range.minDepth;
  const sliderMin = Number(controls.particleDepthMaxScale.min) || 0.1;
  const sliderMax = Number(controls.particleDepthMaxScale.max) || 4;
  return clamp(ratio, sliderMin, sliderMax);
}

function currentParticleDepthRange() {
  if (!dataset || !currentOutput) {
    return null;
  }
  const bounds = viewBoundsForFrame(dataset, currentOutput.frame);
  let minDepth = Infinity;
  let maxDepth = -Infinity;
  for (const position of currentOutput.positions) {
    const projected = project(position, bounds, 1, 0, 0);
    if (!projected) {
      continue;
    }
    minDepth = Math.min(minDepth, projected.depth);
    maxDepth = Math.max(maxDepth, projected.depth);
  }
  if (!Number.isFinite(minDepth) || !Number.isFinite(maxDepth) || minDepth <= 0) {
    return null;
  }
  return { minDepth, maxDepth };
}

function particleDepthScale(depth, minDepth, maxDepth, minScale, maxScale) {
  const range = maxDepth - minDepth;
  if (!Number.isFinite(depth) || !Number.isFinite(range) || range <= 1e-6) {
    return minScale;
  }
  const t = clamp((depth - minDepth) / range, 0, 1);
  return maxScale + (minScale - maxScale) * t;
}

function particleDepthScaleValue(value) {
  const scale = Number(value);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function cartesianDriverColor(driver) {
  const x = clamp(driver?.[0] ?? 0, -1, 1);
  const y = clamp(driver?.[1] ?? 0, -1, 1);
  const z = clamp(driver?.[2] ?? 0, -1, 1);
  return `rgb(${channel(x)}, ${channel(y)}, ${channel(z)})`;
}

function sphericalVolumeColor(driver) {
  const x = clamp(driver?.[0] ?? 0, -1, 1);
  const y = clamp(driver?.[1] ?? 0, -1, 1);
  const z = clamp(driver?.[2] ?? 0, -1, 1);
  const radius = clamp(Math.hypot(x, y, z), 0, 1);
  if (radius < 0.0001) {
    return "rgb(132, 132, 132)";
  }

  const hue = Math.atan2(y, x);
  const elevation = clamp(z / radius, -1, 1);
  const lightness = clamp(0.58 + elevation * 0.2, 0.34, 0.78);
  const chroma = 0.018 + 0.145 * Math.pow(radius, 0.85);
  const rgb = oklchToSrgb(lightness, chroma, hue);
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function cielabSphereColor(driver) {
  const x = clamp(driver?.[0] ?? 0, -1, 1);
  const y = clamp(driver?.[1] ?? 0, -1, 1);
  const z = clamp(driver?.[2] ?? 0, -1, 1);
  const radius = Math.hypot(x, y, z);
  if (radius < 0.0001) {
    return "rgb(132, 132, 132)";
  }

  const scale = Math.min(1, 1 / radius);
  const nx = x * scale;
  const ny = y * scale;
  const nz = z * scale;
  const lightness = clamp(62 + nz * 22, 35, 86);
  const a = nx * 72;
  const b = ny * 72;
  const rgb = cielabToSrgb(lightness, a, b);
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function oklchToSrgb(lightness, chroma, hueRadians) {
  const a = chroma * Math.cos(hueRadians);
  const b = chroma * Math.sin(hueRadians);
  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lPrime * lPrime * lPrime;
  const m = mPrime * mPrime * mPrime;
  const s = sPrime * sPrime * sPrime;
  return [
    srgbChannel(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    srgbChannel(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    srgbChannel(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function cielabToSrgb(lightness, a, b) {
  const fy = (lightness + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const x = 0.95047 * cielabPivotInverse(fx);
  const y = cielabPivotInverse(fy);
  const z = 1.08883 * cielabPivotInverse(fz);
  return [
    srgbChannel(3.2404542 * x - 1.5371385 * y - 0.4985314 * z),
    srgbChannel(-0.969266 * x + 1.8760108 * y + 0.041556 * z),
    srgbChannel(0.0556434 * x - 0.2040259 * y + 1.0572252 * z),
  ];
}

function cielabPivotInverse(value) {
  const cubed = value * value * value;
  return cubed > 0.008856451679035631 ? cubed : (value - 16 / 116) / 7.787037037037037;
}

function srgbChannel(linear) {
  const encoded = linear <= 0.0031308
    ? 12.92 * linear
    : 1.055 * Math.pow(Math.max(0, linear), 1 / 2.4) - 0.055;
  return Math.round(clamp(encoded, 0, 1) * 255);
}

function channel(value) {
  return Math.round((value * 0.5 + 0.5) * 255);
}

function frameDuration() {
  return frameDurationFor(dataset);
}

function frameDurationFor(value) {
  return value?.profile?.dt_seconds || 1 / 72;
}

function cycleDuration() {
  return Math.max(frameDuration(), frameDuration() * datasetFrameCount());
}

function naturalFrequencyRows(anchors, baseHz, spreadHz, seeds) {
  return anchors.map((anchor) =>
    seeds.map((seed) =>
      frequencyRadians(baseHz, spreadHz, naturalFrequencyNoise(anchor, seed)),
    ),
  );
}

function naturalFrequencyNoise(position, seed) {
  return perlin3(
    seed,
    position[0] * NATURAL_FREQUENCY_NOISE_FREQUENCY,
    position[1] * NATURAL_FREQUENCY_NOISE_FREQUENCY,
    position[2] * NATURAL_FREQUENCY_NOISE_FREQUENCY,
  );
}

function frequencyRadians(baseHz, spreadHz, value) {
  return Math.max(0, baseHz + spreadHz * value) * TAU;
}

function perlinDisplacement(position, frequency, amplitude, timeSeconds = 0, speedHz = 0, phaseCycles = 0) {
  if (!Number.isFinite(frequency) || !Number.isFinite(amplitude) || frequency <= 0 || amplitude <= 0) {
    return [0, 0, 0];
  }
  const phase = temporalPhase(timeSeconds, speedHz, phaseCycles);
  const sample = add3(scale3(position, frequency), temporalOffset(phase));
  const raw = [
    perlin3(0x234a712f, sample[0], sample[1], sample[2]),
    perlin3(0x9e3779b9, sample[0] + 19.17, sample[1] - 37.43, sample[2] + 11.29),
    perlin3(0xd1b54a32, sample[0] - 53.71, sample[1] + 7.31, sample[2] + 29.53),
  ];
  return scale3(clampVectorLength(raw, 1).vector, amplitude);
}

function movementNoiseOffset(axes, oscillatorWorld, localNormalized, movement, noiseSeconds) {
  if (movementNoiseSpaceParam(movement.noiseSpace) === "local") {
    return localVector(
      axes,
      perlinDisplacement(
        localNormalized,
        movement.noiseFrequency,
        movement.noiseAmplitude,
        noiseSeconds,
        movement.noiseSpeedHz,
        movement.noisePhase,
      ),
    );
  }
  return perlinDisplacement(
    oscillatorWorld,
    movement.noiseFrequency,
    movement.noiseAmplitude,
    noiseSeconds,
    movement.noiseSpeedHz,
    movement.noisePhase,
  );
}

function temporalPhase(timeSeconds, speedHz, phaseCycles) {
  if (!Number.isFinite(timeSeconds) || !Number.isFinite(speedHz) || !Number.isFinite(phaseCycles)) {
    return 0;
  }
  return (Math.max(0, timeSeconds) * Math.max(0, speedHz) + phaseCycles) * TAU;
}

function temporalOffset(phase) {
  if (phase === 0) {
    return [0, 0, 0];
  }
  return [
    Math.sin(phase) * 0.47 * NOISE_TEMPORAL_DOMAIN_SCALE,
    Math.sin(phase * 1.37) * 0.31 * NOISE_TEMPORAL_DOMAIN_SCALE,
    Math.sin(phase * 0.73) * 0.59 * NOISE_TEMPORAL_DOMAIN_SCALE,
  ];
}

function perlin3(seed, x, y, z) {
  const xFloor = Math.floor(x);
  const yFloor = Math.floor(y);
  const zFloor = Math.floor(z);
  const xi = xFloor | 0;
  const yi = yFloor | 0;
  const zi = zFloor | 0;
  const xf = x - xFloor;
  const yf = y - yFloor;
  const zf = z - zFloor;
  const u = fade(xf);
  const v = fade(yf);
  const w = fade(zf);
  const x00 = lerp(
    grad(hash3(seed, xi, yi, zi), xf, yf, zf),
    grad(hash3(seed, xi + 1, yi, zi), xf - 1, yf, zf),
    u,
  );
  const x10 = lerp(
    grad(hash3(seed, xi, yi + 1, zi), xf, yf - 1, zf),
    grad(hash3(seed, xi + 1, yi + 1, zi), xf - 1, yf - 1, zf),
    u,
  );
  const x01 = lerp(
    grad(hash3(seed, xi, yi, zi + 1), xf, yf, zf - 1),
    grad(hash3(seed, xi + 1, yi, zi + 1), xf - 1, yf, zf - 1),
    u,
  );
  const x11 = lerp(
    grad(hash3(seed, xi, yi + 1, zi + 1), xf, yf - 1, zf - 1),
    grad(hash3(seed, xi + 1, yi + 1, zi + 1), xf - 1, yf - 1, zf - 1),
    u,
  );
  return clamp(lerp(lerp(x00, x10, v), lerp(x01, x11, v), w), -1, 1);
}

function fade(value) {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function lerp(left, right, t) {
  return left + (right - left) * t;
}

function grad(hash, x, y, z) {
  switch (hash & 0x0f) {
    case 0: return x + y;
    case 1: return -x + y;
    case 2: return x - y;
    case 3: return -x - y;
    case 4: return x + z;
    case 5: return -x + z;
    case 6: return x - z;
    case 7: return -x - z;
    case 8: return y + z;
    case 9: return -y + z;
    case 10: return y - z;
    case 11: return -y - z;
    case 12: return x + y;
    case 13: return -x + y;
    case 14: return y - z;
    default: return -y - z;
  }
}

function hash3(seed, x, y, z) {
  let value = (seed ^
    Math.imul(x, 0x8da6b343) ^
    Math.imul(y, 0xd8163841) ^
    Math.imul(z, 0xcb1ab31f)) >>> 0;
  value = (value ^ (value >>> 16)) >>> 0;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value = (value ^ (value >>> 15)) >>> 0;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

function jerkPulse(phase) {
  return Math.pow(
    clamp(
      (Math.sin(phase) - dynamics.jerk.pulseThreshold) / (1 - dynamics.jerk.pulseThreshold),
      0,
      1,
    ),
    dynamics.jerk.pulseSharpness,
  );
}

function averageOrder(phases) {
  let total = 0;
  for (let axis = 0; axis < AXES; axis += 1) {
    let cos = 0;
    let sin = 0;
    for (const phase of phases) {
      cos += Math.cos(phase[axis]);
      sin += Math.sin(phase[axis]);
    }
    cos /= phases.length;
    sin /= phases.length;
    total += Math.sqrt(cos * cos + sin * sin);
  }
  return total / AXES;
}

function emptyDiagnostics(count) {
  return {
    coordinateCount: count,
    movementCoherence: 0,
    jerkCoherence: 0,
    jerkActivationMean: 0,
    jerkBoostRms: 0,
    combinedDriverRms: 0,
    clampRatio: 0,
    distanceClampRatio: 0,
    maxDriverLength: 0,
    maxTravelMeters: 0,
  };
}

function metric(value, digits = 3) {
  return Number.isFinite(value) ? value.toFixed(digits) : (0).toFixed(digits);
}

function safeMean(sum, count) {
  return count > 0 ? sum / count : 0;
}

function safeRms(sum, count) {
  return count > 0 ? Math.sqrt(sum / count) : 0;
}

function add3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale3(value, scale) {
  return [value[0] * scale, value[1] * scale, value[2] * scale];
}

function localVector(axes, local) {
  return add3(scale3(axes[0], local[0]), add3(scale3(axes[1], local[1]), scale3(axes[2], local[2])));
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalizeOr(value, fallback) {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (!Number.isFinite(length) || length <= 1.0e-10) {
    return fallback.slice();
  }
  return [value[0] / length, value[1] / length, value[2] / length];
}

function clampVectorLength(vector, maxLength) {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length <= maxLength || length <= 0) {
    return { vector, clamped: false };
  }
  const scale = maxLength / length;
  return {
    vector: [vector[0] * scale, vector[1] * scale, vector[2] * scale],
    clamped: true,
  };
}

function zeroDrivers(count) {
  return Array.from({ length: count }, () => [0, 0, 0]);
}

function cloneProfileObject(value) {
  return JSON.parse(JSON.stringify(value));
}

function createRng(seed) {
  let state = BigInt(seed) ^ 0x9e3779b97f4a7c15n;
  return () => {
    state = (state * 6364136223846793005n + 1442695040888963407n) & 0xffffffffffffffffn;
    return Number(state >> 40n) / 16777216;
  };
}

function wrap(value) {
  return ((value % TAU) + TAU) % TAU;
}

function clampInt(value, min, max) {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getPath(source, path) {
  return path.split(".").reduce((value, key) => value?.[key], source);
}

function setPath(source, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((current, key) => current[key], source);
  target[last] = value;
}
