/**
 * Production-only deterrents against casual inspection. They make DevTools
 * annoying, not impossible; the real protection is that every rule lives on
 * the server. The debugger trap itself is injected by the build obfuscator
 * (see vite.config.js → debugProtection).
 */
const isField = (target) => target?.closest?.('input, textarea, select, [contenteditable="true"]')

export function installGuards() {
  // 1. No right-click menu, except inside form fields (so phones can still paste).
  window.addEventListener(
    'contextmenu',
    (e) => {
      if (!isField(e.target)) e.preventDefault()
    },
    { capture: true },
  )

  // 2. Block the DevTools / view-source shortcuts.
  window.addEventListener(
    'keydown',
    (e) => {
      const mod = e.ctrlKey || e.metaKey
      const code = e.code
      const blocked =
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['KeyI', 'KeyJ', 'KeyC'].includes(code)) || // Ctrl+Shift+I / J / C
        (e.metaKey && e.altKey && ['KeyI', 'KeyJ', 'KeyC', 'KeyU'].includes(code)) || // Cmd+Opt+I / J / C / U
        (mod && !e.shiftKey && !e.altKey && code === 'KeyU') // Ctrl+U / Cmd+U
      if (blocked) {
        e.preventDefault()
        e.stopPropagation()
      }
    },
    { capture: true },
  )
}
