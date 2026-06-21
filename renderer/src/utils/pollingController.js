export function createIntervalPoller({
  intervalMs = 5000,
  shouldRun,
  shouldStop,
  onTick
}) {
  let timer = null

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function start() {
    stop()
    timer = setInterval(() => {
      if (typeof shouldRun === 'function' && !shouldRun()) {
        return
      }

      if (typeof shouldStop === 'function' && shouldStop()) {
        stop()
        return
      }

      void onTick()
    }, intervalMs)
  }

  return {
    start,
    stop
  }
}
