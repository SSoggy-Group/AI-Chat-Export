const PAGE_URL = 'https://shareclaude.pages.dev'
const CLAUDE_API_URL = 'https://claude.ai/api/organizations'
let organizationId = ''

const artifactsCache = new Map()

async function getOrganizationId() {
	if (organizationId) return organizationId
	try {
		const response = await fetch(CLAUDE_API_URL, {
			credentials: 'include',
			headers: {
				accept: 'application/json',
				'content-type': 'application/json'
			}
		})

		if (!response.ok) {
			throw new Error('Failed to fetch organizations')
		}

		const data = await response.json()
		if (data?.length > 0) {
			const chatOrg = data.find((org) => org.capabilities?.includes('chat'))
			if (chatOrg) {
				return chatOrg.uuid
			}
		}

		throw new Error('No organization found')
	} catch (error) {
		console.error('Failed to get organization:', error)
		return null
	}
}

function getConversationId() {
	const match = window.location.href.match(/\/chat\/([^\/]+)/)
	return match?.[1] || null
}

function processAttachments({ attachments = [], files = [] }) {
	const formatAttachment = ({ file_type, file_name, extracted_content }) => {
		const fileType = file_type?.split('/')[1] || file_type
		const content = fileType
			? `\`\`\`${fileType}\n${extracted_content}\n\`\`\``
			: extracted_content

		return `\n\n${file_name}:\n\n${content}`
	}

	const formatFile = ({ file_name }) =>
		file_name ? `\n\n${file_name} (can't show blob content)\n\n` : ''

	return (
		attachments.map(formatAttachment).join('') + files.map(formatFile).join('')
	)
}

function processArtifact(item) {
	const { id, type, language, content, command, old_str, new_str, title } =
		item.input

	if (!id) return ''

	const artifactProps = {
		identifier: id,
		type: type || artifactsCache.get(id)?.artifactType,
		title: title || id,
		language: language || artifactsCache.get(id)?.language
	}

	const propString = Object.entries(artifactProps)
		.filter(([_, value]) => value)
		.map(([key, value]) => `${key}="${value}"`)
		.join(' ')

	// handle content updates
	if (command === 'update' && old_str && new_str) {
		const artifactData = artifactsCache.get(id)
		if (!artifactData?.content) return ''

		artifactData.content = artifactData.content.replace(old_str, new_str)
		artifactsCache.set(id, artifactData)
		return formatArtifactOutput(propString, artifactData.content)
	}

	// handle content creation/rewrite
	if (content) {
		const artifactData =
			command === 'rewrite'
				? { ...artifactsCache.get(id), content }
				: { content, artifactType: type, language }

		artifactsCache.set(id, artifactData)
		return formatArtifactOutput(propString, content)
	}

	return ''
}

function formatArtifactOutput(props, content) {
	return `\n<antArtifact ${props}>\n${content}\n</antArtifact>\n`
}

function processREPL({ input: { code = '' } }) {
	return code ? `\n\`\`\`javascript\n${code}\n\`\`\`\n` : ''
}

function processContentItem(item) {
	switch (item.type) {
		case 'text':
			return item.text
		case 'tool_use':
			if (item.name === 'artifacts') {
				return processArtifact(item)
			} else if (item.name === 'repl') {
				return processREPL(item)
			}
			// handle other tool_use items
			return ''
		default:
			return ''
	}
}

function processMessage(msg) {
	const { sender, content, attachments, files_v2 } = msg
	let message = ''

	// if content has only single item -> old message format else new message format
	if (content.length === 1) {
		message = content[0].text
	} else {
		message = content.map(processContentItem).join('')
	}

	if (sender === 'human') {
		message += processAttachments({ attachments, files: files_v2 })
	}

	return {
		source: sender === 'human' ? 'user' : 'claude',
		message: message.trim()
	}
}

async function getConversationMessages({ organizationId, conversationId }) {
	if (!organizationId || !conversationId) return null

	try {
		const response = await fetch(
			`${CLAUDE_API_URL}/${organizationId}/chat_conversations/${conversationId}?tree=True&rendering_mode=messages&render_all_tools=true`,
			{
				headers: {
					accept: '*/*',
					'content-type': 'application/json'
				},
				credentials: 'include'
			}
		)

		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status}`)
		}

		const data = await response.json()
		return {
			title: data.name,
			content: data.chat_messages.map(processMessage)
		}
	} catch (error) {
		console.error('Error fetching conversation:', error)
		return null
	}
}

async function getShareURL(messages) {
	try {
		const response = await fetch(`${PAGE_URL}/api/chats`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(messages)
		})

		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status}`)
		}

		const { id } = await response.json()
		artifactsCache.clear()
		return `${PAGE_URL}/c/${id}`
	} catch (error) {
		console.error('Error getting share URL:', error)
		return null
	}
}

// --- export conversion functions ---
const transformExcerptBlocks = (message, transformExcerpt) =>
	globalThis.ShareClaudeExcerptUtils.transformExcerptBlocks(
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
	let md = `# ${title}\n\n`
	messages.forEach(({ source, message }) => {
		const role = source === 'user' ? 'You' : 'Claude'
		md += `## ${role}\n\n${normalizeMessageMarkdown(message)}\n\n---\n\n`
	})
	return md
}

function convertToText(title, messages) {
	const result = [`${title}\n${'='.repeat(title.length)}\n\n`]
	messages.forEach(({ source, message }) => {
		const role = source === 'user' ? 'You' : 'Claude'
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

		function applyInline(s) {
			return s
				.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
				.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
				.replace(/\*(.+?)\*/g, '<em>$1</em>')
				.replace(/~~(.+?)~~/g, '<del>$1</del>')
				.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
				.replace(/\x00IC(\d+)\x00/g, (_, i) => `<code>${inlineCodes[parseInt(i)]}</code>`)
		}

		return text
	}

	let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 720px; margin: 0 auto; padding: 32px 16px; background: #2C2B28; color: #e0e0e0; line-height: 1.6; }
h1.title { font-size: 1.5rem; color: #f0f0f0; text-align: center; padding: 24px 0 16px; }
h1.title::after { content: ''; display: block; width: 48px; height: 2px; background: #D97757; margin: 12px auto 0; border-radius: 1px; }
article { margin: 16px 0; padding: 16px 20px; border-radius: 12px; }
article.human { background: #21201C; border: 1px solid rgba(100,100,100,0.3); }
article.claude { background: #333330; border: 1px solid rgba(100,100,100,0.2); }
.role { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
article.human .role { color: #999; }
article.claude .role { color: #D97757; }
.content p { margin: 6px 0; font-size: 15px; }
.content p:first-child { margin-top: 0; }
.content p:last-child { margin-bottom: 0; }
.content h1, .content h2, .content h3, .content h4, .content h5, .content h6 { color: #f0f0f0; margin: 16px 0 6px; font-weight: 600; }
.content h1 { font-size: 1.3rem; } .content h2 { font-size: 1.15rem; } .content h3 { font-size: 1rem; }
.content ul, .content ol { padding-left: 20px; margin: 6px 0; }
.content li { margin: 2px 0; font-size: 15px; }
.content strong { font-weight: 600; color: #f0f0f0; }
.content em { font-style: italic; }
.content del { text-decoration: line-through; color: #888; }
.content a { color: #7fb3f5; text-decoration: none; }
.content a:hover { text-decoration: underline; }
.content blockquote { border-left: 3px solid #555; padding-left: 12px; margin: 8px 0; color: #aaa; font-style: italic; }
pre { background: #1a1a18; padding: 12px 16px; border-radius: 8px; overflow-x: auto; margin: 8px 0; }
code { font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 13px; }
:not(pre) > code { background: #1a1a18; padding: 2px 5px; border-radius: 4px; font-size: 13px; }
table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 14px; }
th, td { padding: 8px 12px; border: 1px solid #444; text-align: left; }
th { background: #21201C; font-weight: 600; color: #f0f0f0; }
hr { border: none; border-top: 1px solid rgba(100,100,100,0.2); margin: 8px 0; }
.excerpt { border-left: 2px solid #D97757; padding: 6px 10px; margin: 8px 0; background: rgba(0,0,0,0.15); border-radius: 0 4px 4px 0; }
.excerpt-label { font-size: 11px; color: #D97757; font-weight: 600; margin-bottom: 4px; }
.excerpt-body { font-size: 13px; color: #aaa; white-space: pre-wrap; }
</style>
</head>
<body>
<h1 class="title">${esc(title)}</h1>\n`

	messages.forEach(({ source, message }) => {
		const role = source === 'user' ? 'You' : 'Claude'
		const cls = source === 'user' ? 'human' : 'claude'
		html += `<article class="${cls}" data-role="${source}">\n<div class="role">${role}</div>\n<div class="content">${markdownToHTML(message)}</div>\n</article>\n`
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

	messages.forEach(({ source, message }) => {
		const role = source === 'user' ? 'You' : 'Claude'
		const color = source === 'user' ? '666666' : 'D97757'

		// role header
		paragraphs += `<w:p><w:r><w:rPr><w:b/><w:color w:val="${color}"/><w:sz w:val="28"/></w:rPr><w:t>${escapeXML(role)}</w:t></w:r></w:p>`

		// message lines
		const lines = markdownToPlainText(message).split('\n')
		lines.forEach((line) => {
			paragraphs += `<w:p><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXML(line)}</w:t></w:r></w:p>`
		})

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

// --- ui injection ---

function injectStyles() {
	if (document.getElementById('sc-styles')) return
	const s = document.createElement('style')
	s.id = 'sc-styles'
	s.textContent = `
.sc-controls{display:inline-flex;align-items:center;flex-shrink:0}
.sc-divider{width:2px;height:22px;margin:0 8px 0 6px;background:currentColor;opacity:0.22;border-radius:999px;align-self:center;flex-shrink:0}
.sc-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border:none;border-radius:6px;background:transparent;color:inherit;cursor:pointer;transition:background 0.1s}
.sc-icon-btn:hover{background:var(--bg-200, rgba(128,128,128,0.1))}
.sc-icon-btn:active{transform:scale(0.95)}
.sc-icon-btn svg{width:16px;height:16px;opacity:0.65}
.sc-icon-btn:hover svg{opacity:1}
.sc-icon-btn.sc-loading{opacity:0.4;pointer-events:none}
.sc-export-wrap{position:relative;display:inline-flex;align-items:center}
.sc-menu{position:absolute;top:calc(100% + 6px);right:0;border-radius:12px;padding:4px;z-index:50001;min-width:200px;display:none;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
.sc-menu.sc-open{display:block}
.sc-menu[data-theme="light"]{background:rgba(255,255,255,0.95);border:1px solid rgba(0,0,0,0.1);box-shadow:0 8px 30px rgba(0,0,0,0.12);color:#333}
.sc-menu[data-theme="dark"]{background:rgba(40,40,40,0.95);border:1px solid rgba(255,255,255,0.1);box-shadow:0 8px 30px rgba(0,0,0,0.4);color:#e0e0e0}
.sc-item{display:flex;align-items:center;gap:10px;width:100%;padding:8px 12px;background:none;border:none;color:inherit;font-size:13px;text-align:left;cursor:pointer;border-radius:8px;font-family:inherit;line-height:1.4}
.sc-menu[data-theme="light"] .sc-item:hover{background:rgba(0,0,0,0.06)}
.sc-menu[data-theme="dark"] .sc-item:hover{background:rgba(255,255,255,0.08)}
.sc-item svg{width:16px;height:16px;flex-shrink:0;opacity:0.55}
`
	document.head.appendChild(s)
}

function detectTheme() {
	const bg = getComputedStyle(document.body).backgroundColor
	const m = bg.match(/(\d+),\s*(\d+),\s*(\d+)/)
	if (!m) return 'light'
	const lum = (parseInt(m[1]) * 299 + parseInt(m[2]) * 587 + parseInt(m[3]) * 114) / 1000
	return lum < 128 ? 'dark' : 'light'
}

function findActionsBar() {
	return (
		document.querySelector('[data-testid="wiggle-controls-actions"]') ||
		document.querySelector('[data-testid$="-controls-actions"]') ||
		document.querySelector('[data-testid*="controls-actions"]') ||
		document.querySelector('[data-testid*="message-actions"]') ||
		document.querySelector('[data-testid*="action-bar"]') ||
		null
	)
}

function ensureControlsPosition(actionsBar, controlsWrap) {
	if (!actionsBar || !controlsWrap) return
	if (controlsWrap.parentElement !== actionsBar) {
		actionsBar.appendChild(controlsWrap)
		return
	}
	if (actionsBar.lastElementChild !== controlsWrap) {
		actionsBar.appendChild(controlsWrap)
	}
}

function injectButtons() {
	const actionsBar = findActionsBar()
	if (!actionsBar) return

	console.debug('[ShareClaude] injecting into:', actionsBar.dataset.testid)
	injectStyles()

	const existingControls = document.querySelector('.sc-controls')
	if (existingControls) {
		ensureControlsPosition(actionsBar, existingControls)
		return
	}

	const shareSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>'
	const downloadSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>'

	const controlsWrap = document.createElement('div')
	controlsWrap.className = 'sc-controls'

	const divider = document.createElement('div')
	divider.className = 'sc-divider'

	// --- share button ---
	const shareBtn = document.createElement('button')
	shareBtn.type = 'button'
	shareBtn.className = 'sc-icon-btn'
	shareBtn.title = 'Share to ShareClaude'
	shareBtn.innerHTML = shareSVG

	shareBtn.addEventListener('click', async () => {
		const conversationId = getConversationId()
		if (!conversationId) { alert('Open a conversation first'); return }

		shareBtn.classList.add('sc-loading')
		const messages = await getConversationMessages({ organizationId, conversationId })
		if (!messages) { alert('Failed to get conversation messages'); shareBtn.classList.remove('sc-loading'); return }

		const shareURL = await getShareURL(messages)
		if (!shareURL) { alert('Failed to generate share URL'); shareBtn.classList.remove('sc-loading'); return }

		navigator.clipboard.writeText(shareURL)
		window.open(shareURL, '_blank')
		shareBtn.classList.remove('sc-loading')
	})

	// --- download button ---
	const exportWrap = document.createElement('div')
	exportWrap.className = 'sc-export-wrap'

	const dlBtn = document.createElement('button')
	dlBtn.type = 'button'
	dlBtn.className = 'sc-icon-btn'
	dlBtn.title = 'Export conversation'
	dlBtn.innerHTML = downloadSVG
	exportWrap.appendChild(dlBtn)

	const menu = document.createElement('div')
	menu.className = 'sc-menu'
	menu.dataset.theme = detectTheme()
	exportWrap.appendChild(menu)

	const formats = [
		{ label: 'Markdown (.md)', ext: 'md', convert: convertToMarkdown, mime: 'text/markdown' },
		{ label: 'Plain Text (.txt)', ext: 'txt', convert: convertToText, mime: 'text/plain' },
		{ label: 'JSON (.json)', ext: 'json', convert: convertToJSON, mime: 'application/json' },
		{ label: 'HTML (.html)', ext: 'html', convert: convertToHTML, mime: 'text/html' },
		{ label: 'Word (.docx)', ext: 'docx', convert: convertToDOCX, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
	]

	formats.forEach(({ label, ext, convert, mime }) => {
		const item = document.createElement('button')
		item.type = 'button'
		item.className = 'sc-item'
		item.innerHTML = downloadSVG + '<span>' + label + '</span>'
		item.addEventListener('click', async (e) => {
			e.stopPropagation()
			menu.classList.remove('sc-open')

			const conversationId = getConversationId()
			if (!conversationId) { alert('Open a conversation first'); return }

			dlBtn.classList.add('sc-loading')
			const messages = await getConversationMessages({ organizationId, conversationId })
			if (!messages) { alert('Failed to get conversation messages'); dlBtn.classList.remove('sc-loading'); return }

			const filename = sanitizeFilename(messages.title) + '.' + ext
			const content = convert(messages.title || 'Conversation', messages.content)
			downloadFile(content, filename, mime)
			dlBtn.classList.remove('sc-loading')
		})
		menu.appendChild(item)
	})

	dlBtn.addEventListener('click', (e) => {
		e.stopPropagation()
		menu.dataset.theme = detectTheme()
		menu.classList.toggle('sc-open')
	})

	document.addEventListener('click', (e) => {
		if (!exportWrap.contains(e.target)) menu.classList.remove('sc-open')
	})

	controlsWrap.appendChild(divider)
	controlsWrap.appendChild(shareBtn)
	controlsWrap.appendChild(exportWrap)
	ensureControlsPosition(actionsBar, controlsWrap)
}

function monitorPageChanges() {
	let debounceTimer = null
	const observer = new MutationObserver(() => {
		clearTimeout(debounceTimer)
		debounceTimer = setTimeout(injectButtons, 300)
	})
	observer.observe(document.body, { childList: true, subtree: true })
}

async function init() {
	organizationId = await getOrganizationId()
	injectButtons()
	monitorPageChanges()
}

if (document.readyState === 'complete') {
	init()
} else {
	window.addEventListener('load', init)
}
