export function applyTemplateSelectionToAssignment({
  assignments = [],
  index = -1,
  template = null
} = {}) {
  return (Array.isArray(assignments) ? assignments : []).map((item, currentIndex) => {
    if (currentIndex !== index) {
      return item
    }

    if (!template) {
      return {
        ...item,
        templateId: '',
        imageType: ''
      }
    }

    const templatePrompt = template.prompt || ''
    const nextBatchPrompts = item.differentialEnabled === true && Array.isArray(item.batchPrompts)
      ? item.batchPrompts.map(() => templatePrompt)
      : item.batchPrompts

    return {
      ...item,
      templateId: template.id || '',
      imageType: template.name || '',
      prompt: templatePrompt,
      batchPrompts: nextBatchPrompts
    }
  })
}
