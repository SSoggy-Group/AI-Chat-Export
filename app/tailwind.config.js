/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';

export default {
	content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
	theme: {
		extend: {
			colors: {
				aiChatExport: {
					background: '#2C2B28',
					userChat: '#21201C',
					claudeChat: '#333330',
					codeBox: '#21201C',
					accent: '#D97757',
					backgroundLight: '#393937'
				},
				bot: {
					claude: { accent: '#D97757', chat: '#333330', bg: '#3d2e27' },
					chatgpt: { accent: '#10A37F', chat: '#2d3339', bg: '#1a2f2a' },
					deepseek: { accent: '#4D6BFE', chat: '#2a2d3d', bg: '#1e2140' },
					mistral: { accent: '#FF7000', chat: '#352d24', bg: '#3a2a1a' },
					gemini: { accent: '#1DA1F2', chat: '#2d323b', bg: '#1f2530' },
					qwen: { accent: '#615ced', chat: '#2f2c3b', bg: '#232130' }
				}
			}
		}
	},
	plugins: [typography]
}
