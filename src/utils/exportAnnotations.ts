import type { Annotation } from '../services/annotationService'

export function exportAnnotationsAsMarkdown(title: string, annotations: Annotation[]): void {
  const lines = [
    `# Notes — ${title}`,
    '',
    ...annotations.flatMap((a) => [
      a.type === 'chapter_note'
        ? `📝 Chapter note`
        : `> ${a.quote}`,
      '',
      a.note || '',
      `*${new Date(a.createdAt).toLocaleDateString()}*`,
      '',
    ]),
  ]
  downloadFile(lines.join('\n'), `${title} — Notes.md`, 'text/markdown')
}

export function exportAnnotationsAsJSON(title: string, annotations: Annotation[]): void {
  const data = annotations.map((a) => ({
    type: a.type,
    quote: a.quote,
    note: a.note || null,
    chapter: a.href,
    date: new Date(a.createdAt).toISOString(),
  }))
  downloadFile(JSON.stringify(data, null, 2), `${title} — Notes.json`, 'application/json')
}

function downloadFile(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const el = document.createElement('a')
  el.href = url
  el.download = filename
  el.click()
  URL.revokeObjectURL(url)
}
