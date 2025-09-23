import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

const { escapeHtml } = new MarkdownIt().utils

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight(code: string, language: string): string {
    if (language && hljs.getLanguage(language)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(code, { language }).value}</code></pre>`
      } catch (error) {
        console.error(error)
      }
    }
    const sanitized = escapeHtml(code)
    return `<pre class="hljs"><code>${sanitized}</code></pre>`
  },
})

export function renderMarkdown(content: string): string {
  return markdown.render(content)
}
