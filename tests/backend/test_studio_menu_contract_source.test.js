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
      'title-generate',
      'description-generate',
      'series-generate',
      'video-generate'
    ])
    expect(config.runtimeTaskMenuItems.map((item) => item.key)).toEqual([
      'workspace',
      'title-generate',
      'description-generate',
      'series-generate',
      'video-generate'
    ])
    expect(config.primaryMenuItems.map((item) => item.key)).toEqual([
      'work-center',
      'selection-center',
      'data-center',
      'template-center',
      'publish-center',
      'title-generate',
      'description-generate',
      'series-generate',
      'video-generate',
      'prompt-library',
      'account-device'
    ])
    expect(Object.keys(config.generatorViews)).toEqual([
      'title-generate',
      'description-generate',
      'series-generate',
      'video-generate'
    ])
    expect(config.generatorViews['title-generate'].textKind).toBe('title')
    expect(config.generatorViews['description-generate'].textKind).toBe('description')
    expect(config.generatorViews['series-generate'].shortcutLabel).toBeTruthy()
    expect(config.generatorViews['video-generate'].shortcutLabel).toBeTruthy()

    expect(appSource).toContain("import studioMenuConfig from '../../shared/studio-menu-config.json'")
    expect(appSource).toContain('const menuItems = Array.isArray(studioMenuConfig.primaryMenuItems)')
    expect(appSource).toContain("const activeMenu = ref('work-center')")
    expect(appSource).toContain("v-else-if=\"activeMenu === 'selection-center'\"")
    expect(generatorViewsSource).toContain("import studioMenuConfig from '../../../shared/studio-menu-config.json'")
    expect(generatorViewsSource).toContain('export const generatorViewMap = studioMenuConfig.generatorViews || {}')
    expect(generatorViewsSource).toContain('export const generatorShortcutOptions = Object.entries(generatorViewMap).map')
    expect(workspaceServiceSource).toContain("require('../../../shared/studio-menu-config.json')")
    expect(workspaceServiceSource).toContain('const runtimeStateMenuItems = Array.isArray(studioMenuConfig.runtimeTaskMenuItems)')
    expect(workspaceServiceSource).toContain('studioMenuConfig.runtimeTaskMenuKeys.includes(item.key)')
    expect(workspaceServiceSource).toContain('const menuItems = primaryMenuItems')
    expect(lifecycleSource).toContain("require('../../../shared/studio-menu-config.json')")
    expect(lifecycleSource).toContain('const supportedTaskMenuKeys = new Set(studioMenuConfig.runtimeTaskMenuKeys ||')
  })
})
