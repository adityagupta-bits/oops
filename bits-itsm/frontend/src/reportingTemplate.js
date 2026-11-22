export function applyReportingTemplate(previous, title, template, knownTitles, hintsEnabled) {
  return { ...previous,
    ...(template?.categoryCode && !previous.category ? {category:template.categoryCode} : {}),
    title: !previous.title || knownTitles.includes(previous.title) ? (title === 'Other IT problem' ? '' : title) : previous.title,
    affectedService: previous.affectedService || (hintsEnabled ? template?.serviceCode || '' : '') };
}
