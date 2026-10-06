const SITE_CONFIG = {
	'claude.ai': { name: 'Claude', source: 'claude', type: 'api' },
	'chatgpt.com': { name: 'ChatGPT', source: 'chatgpt', type: 'dom' },
	'chat.deepseek.com': { name: 'DeepSeek', source: 'deepseek', type: 'dom' },
	'chat.mistral.ai': { name: 'Mistral', source: 'mistral', type: 'dom' },
	'gemini.google.com': { name: 'Gemini', source: 'gemini', type: 'dom' },
	'chat.qwenlm.ai': { name: 'Qwen', source: 'qwen', type: 'dom' },
}

function getBotName(source) {
	if (!source || source === 'user' || source === 'human') return 'You'
	const entry = Object.values(SITE_CONFIG).find(c => c.source === source)
	return entry ? entry.name : 'Assistant'
}
// --- export conversion functions ---
const transformExcerptBlocks = (message, transformExcerpt) =>
	globalThis.AIChatExportExcerptUtils.transformExcerptBlocks(
		message,
		transformExcerpt
	)

function normalizeMessageMarkdown(message) {
	return transformExcerptBlocks(message, (excerptContent) => {
		if (!excerptContent) return ''
		const quotedLines = excerptContent
			.split(/\r?\n/)
			.map((line) => `> ${line}`)
			.join('\n')
		return `> **Quoted excerpt**\n>\n${quotedLines}`
	})
}

function markdownToPlainText(message) {
	return normalizeMessageMarkdown(message)
		.replace(/```[\w-]*\r?\n([\s\S]*?)\r?\n```/g, (_, code) => code.trim())
		.replace(/^>\s?/gm, '')
		.replace(/^#{1,6}\s+/gm, '')
		.replace(/\*\*\*(.+?)\*\*\*/g, '$1')
		.replace(/\*\*(.+?)\*\*/g, '$1')
		.replace(/\*(.+?)\*/g, '$1')
		.replace(/~~(.+?)~~/g, '$1')
		.replace(/`([^`]+)`/g, '$1')
		.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
		.replace(/^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)+$/gm, '')
		.replace(/\|/g, ' | ')
		.replace(/\n{3,}/g, '\n\n')
		.trim()
}

function convertToMarkdown(title, messages) {
	return [
		`# ${title}\n\n`,
		...messages.map(({ source, message, thinking }) => {
			const role = getBotName(source)
			const thinkingBlock = thinking ? `\n> **Thinking:**\n${thinking.split('\n').map(l => `> ${l}`).join('\n')}\n` : ''
			return `## ${role}\n\n${thinkingBlock}${normalizeMessageMarkdown(message)}\n\n---\n\n`
		})
	].join('')
}

function convertToText(title, messages) {
	const result = [`${title}\n${'='.repeat(title.length)}\n\n`]
	messages.forEach(({ source, message, thinking }) => {
		const role = getBotName(source)
		if (thinking) result.push(`[Thinking]\n${thinking}\n\n`)
		const plain = markdownToPlainText(message)
		result.push(`${role}:\n${plain}\n\n`)
	})
	return result.join('')
}

function convertToHTML(title, messages) {
	const esc = (str) =>
		str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

	function markdownToHTML(text) {
		text = normalizeMessageMarkdown(text)

		// 1. save fenced code blocks
		const codeBlocks = []
		text = text.replace(/```([\w-]*)\r?\n([\s\S]*?)\r?\n```/g, (_, lang, code) => {
			const idx = codeBlocks.push({ lang, code: esc(code) }) - 1
			return `\x00CODE${idx}\x00`
		})

		// 2. save inline code
		const inlineCodes = []
		text = text.replace(/`([^`\n]+)`/g, (_, code) => {
			const idx = inlineCodes.push(esc(code)) - 1
			return `\x00IC${idx}\x00`
		})

		// 3. tables
		text = text.replace(
			/((?:[^\n]*\|[^\n]*\n)+)/g,
			(block) => {
				const lines = block.trim().split('\n')
				if (lines.length < 2) return block
				const sep = lines[1]
				if (!/^[\s|:\-]+$/.test(sep)) return block

				const parseRegex = /[^|\s](?:[^|]*[^|\s])?/g
				const headers = lines[0].match(parseRegex) || []
				let theadInner = ''
				for (let i = 0; i < headers.length; i++) {
					theadInner += `<th>${applyInline(esc(headers[i]))}</th>`
				}
				const thead = `<thead><tr>${theadInner}</tr></thead>`

				let tbodyInner = ''
				for (let i = 2; i < lines.length; i++) {
					const rowMatch = lines[i].match(parseRegex)
					if (rowMatch) {
						let trInner = ''
						for (let j = 0; j < rowMatch.length; j++) {
							trInner += `<td>${applyInline(esc(rowMatch[j]))}</td>`
						}
						tbodyInner += `<tr>${trInner}</tr>\n`
					} else {
						tbodyInner += `<tr></tr>\n`
					}
				}
				const tbody = tbodyInner ? `<tbody>${tbodyInner.slice(0, -1)}</tbody>` : ''
				return `<table>${thead}${tbody}</table>`
			}
		)

		// 4. headings
		text = text.replace(/^(#{1,6})\s+(.+)$/gm, (_, h, content) =>
			`<h${h.length}>${applyInline(content)}</h${h.length}>`
		)

		// 5. blockquotes
		text = text.replace(/^((?:>.*\n?)+)/gm, (match) => {
			const inner = match.replace(/^>\s?/gm, '').trim()
			return `<blockquote>${applyInline(inner)}</blockquote>`
		})

		// 6. unordered lists
		text = text.replace(/^((?:[*\-]\s.+\n?)+)/gm, (block) => {
			const items = block.trim().split('\n').map(l => l.replace(/^[*\-]\s/, ''))
			return `<ul>${items.map(i => `<li>${applyInline(i)}</li>`).join('')}</ul>`
		})

		// 7. ordered lists
		text = text.replace(/^((?:\d+\.\s.+\n?)+)/gm, (block) => {
			const items = block.trim().split('\n').map(l => l.replace(/^\d+\.\s/, ''))
			return `<ol>${items.map(i => `<li>${applyInline(i)}</li>`).join('')}</ol>`
		})

		// 8. horizontal rules
		text = text.replace(/^[-*_]{3,}$/gm, '<hr>')

		// 9. paragraphs: wrap non-empty, non-block lines
		text = text
			.split(/\n{2,}/)
			.map((para) => {
				const t = para.trim()
				if (!t) return ''
				if (/^<(h[1-6]|ul|ol|li|table|blockquote|pre|hr|div)/.test(t)) return t
				if (t.startsWith('\x00CODE')) return t
				return `<p>${applyInline(t.replace(/\n/g, ' '))}</p>`
			})
			.join('\n')

		// 10. restore code blocks
		text = text.replace(/\x00CODE(\d+)\x00/g, (_, idx) => {
			const b = codeBlocks[parseInt(idx)]
			if (!b) return ''
			return `<pre><code${b.lang ? ` class="language-${b.lang}"` : ''}>${b.code}</code></pre>`
		})

		function sanitizeUrl(url) {
			if (!url) return "#"
			const cleanUrl = url.replace(/[\x00-\x1F\x7F-\x9F\s]/g, "")
			const colonIndex = cleanUrl.indexOf(":")
			if (colonIndex !== -1) {
				const candidateScheme = cleanUrl.substring(0, colonIndex)
				if (/^[a-zA-Z][a-zA-Z0-9+.-]*$/.test(candidateScheme)) {
					const scheme = candidateScheme.toLowerCase()
					if (!["http", "https", "mailto", "ftp", "tel"].includes(scheme)) {
						return "#"
					}
				}
			}
			return url
				.replace(/&/g, "&amp;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#39;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
		}

		function applyInline(s) {
			return s
				.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
				.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
				.replace(/\*(.+?)\*/g, "<em>$1</em>")
				.replace(/~~(.+?)~~/g, "<del>$1</del>")
				.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => `<a href="${sanitizeUrl(url)}">${text}</a>`)
				.replace(/\x00IC(\d+)\x00/g, (_, i) => `<code>${inlineCodes[parseInt(i)]}</code>`)
		}

		return text
	}

	const mainSource = messages.find(m => m.source !== 'user' && m.source !== 'human')?.source || 'assistant';
	const botName = getBotName(mainSource);

	let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; background: #121212; color: #e5e7eb; line-height: 1.6; }
h1.title { font-size: 1.8rem; color: #ffffff; text-align: center; padding: 0 0 8px; margin: 0; font-weight: 700; letter-spacing: -0.02em; }
p.subtitle { text-align: center; color: #9ca3af; font-size: 0.85rem; margin-bottom: 40px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
article { margin: 24px 0; padding: 24px; border-radius: 16px; transition: all 0.2s; }
article.human { background: #1e1e1e; border: 1px solid #333333; }
article.assistant { background: #1a1e24; border: 1px solid #2d3748; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
.role { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
article.human .role { color: #9ca3af; }
article.assistant .role { color: #60a5fa; }
.content p { margin: 12px 0; font-size: 15px; color: #d1d5db; }
.content p:first-child { margin-top: 0; }
.content p:last-child { margin-bottom: 0; }
.content h1, .content h2, .content h3, .content h4, .content h5, .content h6 { color: #ffffff; margin: 24px 0 12px; font-weight: 600; }
.content h1 { font-size: 1.4rem; } .content h2 { font-size: 1.2rem; } .content h3 { font-size: 1.1rem; }
.content ul, .content ol { padding-left: 24px; margin: 12px 0; color: #d1d5db; }
.content li { margin: 4px 0; font-size: 15px; }
.content strong { font-weight: 600; color: #ffffff; }
.content em { font-style: italic; }
.content del { text-decoration: line-through; color: #6b7280; }
.content a { color: #60a5fa; text-decoration: none; border-bottom: 1px solid transparent; transition: border-color 0.2s; }
.content a:hover { border-bottom-color: #60a5fa; }
.content blockquote { border-left: 4px solid #4b5563; padding: 8px 16px; margin: 16px 0; color: #9ca3af; font-style: italic; background: rgba(75, 85, 99, 0.1); border-radius: 0 8px 8px 0; }
pre { background: #0d1117; padding: 16px; border-radius: 12px; overflow-x: auto; margin: 16px 0; border: 1px solid #30363d; }
code { font-family: 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; }
:not(pre) > code { background: rgba(255, 255, 255, 0.1); padding: 3px 6px; border-radius: 6px; font-size: 13px; color: #e5e7eb; }
table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; border-radius: 8px; overflow: hidden; box-shadow: 0 0 0 1px #30363d; }
th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #30363d; color: #d1d5db; }
th { background: #161b22; font-weight: 600; color: #ffffff; }
tr:last-child td { border-bottom: none; }
hr { border: none; border-top: 1px solid #30363d; margin: 24px 0; }
.thinking { margin-bottom: 16px; border: 1px dashed #4b5563; border-radius: 8px; padding: 12px; background: rgba(0,0,0,0.2); }
.thinking summary { font-size: 12px; font-weight: 600; color: #9ca3af; cursor: pointer; text-transform: uppercase; letter-spacing: 0.05em; outline: none; }
.thinking div { margin-top: 12px; font-size: 13px; color: #9ca3af; font-style: italic; border-top: 1px solid #30363d; padding-top: 12px; line-height: 1.5; }
</style>
</head>
<body>
<h1 class="title">${esc(title)}</h1>
<p class="subtitle">AI Chat Export • ${esc(botName)}</p>
`

	messages.forEach(({ source, message, thinking }) => {
		const role = getBotName(source)
		const cls = source === 'user' ? 'human' : 'assistant'
		const thinkingHtml = thinking ? `<details class="thinking"><summary>Thinking process</summary><div>${esc(thinking).replace(/\n/g, '<br>')}</div></details>` : ''
		html += `<article class="${cls}" data-role="${source}">\n<div class="role">${esc(role)}</div>\n${thinkingHtml}<div class="content">${markdownToHTML(message)}</div>\n</article>\n`
	})
	html += `</body>\n</html>`
	return html
}

function convertToJSON(title, messages) {
	const normalizedMessages = messages.map(({ source, message }) => ({
		source,
		message: normalizeMessageMarkdown(message)
	}))

	return JSON.stringify(
		{
			title,
			exportedAt: new Date().toISOString(),
			messages: normalizedMessages
		},
		null,
		2
	)
}

// --- minimal zip builder for docx generation ---

let _crc32Table = null
function getCRC32Table() {
	if (_crc32Table) return _crc32Table
	_crc32Table = new Uint32Array(256)
	for (let i = 0; i < 256; i++) {
		let c = i
		for (let j = 0; j < 8; j++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
		}
		_crc32Table[i] = c
	}
	return _crc32Table
}

function crc32(data) {
	let crc = 0xffffffff
	const table = getCRC32Table()
	for (let i = 0; i < data.length; i++) {
		crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff]
	}
	return (crc ^ 0xffffffff) >>> 0
}

function createMinimalZip(files) {
	const encoder = new TextEncoder()
	const parts = []
	const centralHeaders = []
	let offset = 0

	files.forEach((file) => {
		const nameBytes = encoder.encode(file.name)
		const data = file.content
		const crc = crc32(data)

		// local file header (30 bytes + filename)
		const local = new Uint8Array(30 + nameBytes.length)
		const lv = new DataView(local.buffer)
		lv.setUint32(0, 0x04034b50, true)
		lv.setUint16(4, 20, true)
		lv.setUint16(6, 0, true)
		lv.setUint16(8, 0, true) // store
		lv.setUint16(10, 0, true)
		lv.setUint16(12, 0, true)
		lv.setUint32(14, crc, true)
		lv.setUint32(18, data.length, true)
		lv.setUint32(22, data.length, true)
		lv.setUint16(26, nameBytes.length, true)
		lv.setUint16(28, 0, true)
		local.set(nameBytes, 30)

		// central directory entry (46 bytes + filename)
		const central = new Uint8Array(46 + nameBytes.length)
		const cv = new DataView(central.buffer)
		cv.setUint32(0, 0x02014b50, true)
		cv.setUint16(4, 20, true)
		cv.setUint16(6, 20, true)
		cv.setUint16(8, 0, true)
		cv.setUint16(10, 0, true)
		cv.setUint16(12, 0, true)
		cv.setUint16(14, 0, true)
		cv.setUint32(16, crc, true)
		cv.setUint32(20, data.length, true)
		cv.setUint32(24, data.length, true)
		cv.setUint16(28, nameBytes.length, true)
		cv.setUint16(30, 0, true)
		cv.setUint16(32, 0, true)
		cv.setUint16(34, 0, true)
		cv.setUint16(36, 0, true)
		cv.setUint32(38, 0, true)
		cv.setUint32(42, offset, true)
		central.set(nameBytes, 46)

		centralHeaders.push(central)
		parts.push(local, data)
		offset += local.length + data.length
	})

	const centralStart = offset
	let centralSize = 0
	centralHeaders.forEach((h) => (centralSize += h.length))

	// end of central directory (22 bytes)
	const eocd = new Uint8Array(22)
	const ev = new DataView(eocd.buffer)
	ev.setUint32(0, 0x06054b50, true)
	ev.setUint16(4, 0, true)
	ev.setUint16(6, 0, true)
	ev.setUint16(8, files.length, true)
	ev.setUint16(10, files.length, true)
	ev.setUint32(12, centralSize, true)
	ev.setUint32(16, centralStart, true)
	ev.setUint16(20, 0, true)

	const totalLength = offset + centralSize + 22
	const result = new Uint8Array(totalLength)
	let pos = 0
	parts.forEach((p) => {
		result.set(p, pos)
		pos += p.length
	})
	centralHeaders.forEach((h) => {
		result.set(h, pos)
		pos += h.length
	})
	result.set(eocd, pos)

	return result
}

function convertToDOCX(title, messages) {
	const encoder = new TextEncoder()

	function escapeXML(str) {
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
	}

	let paragraphs = ''

	// title
	paragraphs += `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="48"/></w:rPr><w:t xml:space="preserve">${escapeXML(title)}</w:t></w:r></w:p>`

	messages.forEach(({ source, message, thinking }) => {
		const role = getBotName(source)
		const color = source === 'user' ? '666666' : 'D97757'

		// role header
		paragraphs += `<w:p><w:r><w:rPr><w:b/><w:color w:val="${color}"/><w:sz w:val="28"/></w:rPr><w:t>${escapeXML(role)}</w:t></w:r></w:p>`

		// message lines
		const lines = markdownToPlainText(message).split('\n')
		paragraphs += lines.map(line => `<w:p><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXML(line)}</w:t></w:r></w:p>`).join('')

		// separator
		paragraphs += `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="CCCCCC"/></w:pBdr></w:pPr></w:p>`
	})

	const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`

	const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`

	const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>`

	const wordRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`

	const files = [
		{ name: '[Content_Types].xml', content: encoder.encode(contentTypes) },
		{ name: '_rels/.rels', content: encoder.encode(rels) },
		{ name: 'word/document.xml', content: encoder.encode(documentXml) },
		{
			name: 'word/_rels/document.xml.rels',
			content: encoder.encode(wordRels)
		}
	]

	return createMinimalZip(files)
}

function sanitizeFilename(name) {
	return (
		name
			.replace(/[^a-z0-9_\-\s]/gi, '')
			.replace(/\s+/g, '_')
			.substring(0, 100) || 'conversation'
	)
}

function downloadFile(content, filename, mimeType) {
	const blob = new Blob([content], { type: mimeType })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = filename
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
	URL.revokeObjectURL(url)
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		convertToJSON,
		convertToMarkdown,
		convertToText,
		convertToHTML,
		convertToDOCX,
		sanitizeFilename,
		downloadFile
	}
}
