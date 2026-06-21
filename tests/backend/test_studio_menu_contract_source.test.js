import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

function readSource(relativePath) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

describe('studio menu contract source', () => {
  it('keeps renderer navigation, generator views, and runtime task menus aligned through shared config', () => {
    const configPath = path.resolve(process.cwd(), 'shared/studio-menu-config.json')
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    const appSource = readSource('renderer/src/App.vue')
    const generatorViewsSource = readSource('renderer/src/utils/generatorViews.js')
    const workspaceServiceSource = readSource('main/src/services/studioWorkspaceService.js')
    const lifecycleSource = readSource('main/src/services/workspaceTaskLifecycleService.js')

    expect(config.runtimeTaskMenuKeys).toEqual([
      'workspace',
      'series-generate',
      'video-generate'
    ])
    expect(config.runtimeTaskMenuItems.map((item) => item.key)).toEqual([
      'workspace',
      'series-generate',
      'video-generate'
    ])
    expect(config.primaryMenuItems.map((item) => item.key)).toEqual([
      'workspace',
      'purchase-center',
      'account-usage',
      'prompt-library'
    ])
    expect(Object.keys(config.generatorViews)).toEqual([
      'series-generate',
      'video-generate'
    ])
    expect(config.generatorViews['series-generate'].shortcutLabel).toBeTruthy()
    expect(config.generatorViews['video-generate'].shortcutLabel).toBeTruthy()

    expect(appSource).toContain("import studioMenuConfig from '../../shared/studio-menu-config.json'")
    expect(appSource).toContain('const menuItems = Array.isArray(studioMenuConfig.primaryMenuItems)')
    expect(generatorViewsSource).toContain("import studioMenuConfig from '../../../shared/studio-menu-config.json'")
    expect(generatorViewsSource).toContain('export const generatorViewMap = studioMenuConfig.generatorViews || {}')
    expect(generatorViewsSource).toContain('export const generatorShortcutOptions = Object.entries(generatorViewMap).map')
    expect(workspaceServiceSource).toContain("require('../../../shared/studio-menu-config.json')")
    expect(workspaceServiceSource).toContain('const runtimeStateMenuItems = Array.isArray(studioMenuConfig.runtimeTaskMenuItems)')
    expect(workspaceServiceSource).toContain('studioMenuConfig.runtimeTaskMenuKeys.includes(item.key)')
    expect(lifecycleSource).toContain("require('../../../shared/studio-menu-config.json')")
    expect(lifecycleSource).toContain('const supportedTaskMenuKeys = new Set(studioMenuConfig.runtimeTaskMenuKeys ||')
  })
})
