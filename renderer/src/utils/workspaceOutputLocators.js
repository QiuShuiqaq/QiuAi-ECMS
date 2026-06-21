function stripFilename(filePath = '') {
  return filePath ? String(filePath).replace(/[\\/][^\\/]+$/, '') : ''
}

export function resolveLatestRun(project, projectRuns = [], run = null) {
  return run || projectRuns.find((item) => item.id === project?.latestRunId) || null
}

export function resolveImageOutputDirectory(project, latestRun) {
  return latestRun?.storage?.imageDirectory ||
    stripFilename(latestRun?.outputs?.images?.[0]?.savedPath) ||
    stripFilename(project?.assets?.generatedImages?.[0]?.savedPath) ||
    stripFilename(project?.assets?.generatedImages?.[0]?.path) ||
    ''
}

export function resolveVideoOutputDirectory(project, latestRun) {
  return latestRun?.storage?.videoDirectory ||
    stripFilename(latestRun?.outputs?.video?.savedPath) ||
    stripFilename(project?.assets?.generatedVideo?.savedPath) ||
    ''
}
