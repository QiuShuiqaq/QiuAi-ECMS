import studioMenuConfig from '../../../shared/studio-menu-config.json'

export const generatorViewMap = studioMenuConfig.generatorViews || {}

export const generatorShortcutOptions = Object.entries(generatorViewMap).map(([key, view]) => ({
  key,
  label: view?.shortcutLabel || view?.title || key
}))

export function resolveGeneratorView(menuKey) {
  return generatorViewMap[menuKey] || null
}
