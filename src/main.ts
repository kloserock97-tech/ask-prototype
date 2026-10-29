import '@fontsource/manrope/300.css'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import './styles/base.css'
import './styles/player.css'
import './styles/park.css'
import './styles/panel.css'
import './styles/pages.css'
import './styles/app.css'
import './styles/widget.css'
import './styles/grif.css'
import './styles/outside.css'
import './styles/board.css'
import './styles/visions.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import { AskApp } from './app/app'
import { GrifApp } from './grif/grif'
import { SCREENS } from './data/screens'
import { flow, guide, home, island, leaveGuide } from './pages/pages'
import { OutsidePage } from './grif/outside'
import { VisionsPage } from './grif/visions'
import { Player } from './player/player'

let askApp: AskApp | null = null
let grif: GrifApp | null = null
let widget: OutsidePage | null = null

const app = document.getElementById('app')!
const go = (hash: string) => {
  location.hash = hash
}
const player = new Player(go)
let inPlayer = false

function route() {
  const h = location.hash || '#/'
  const m = h.match(/^#\/p\/(\w+)/)
  leaveGuide()
  if (!(h === '#/' || h === '#')) {
    grif?.destroy()
    grif = null
  }
  widget?.destroy()
  widget = null
  if (h.startsWith('#/widget') || h.startsWith('#/outside')) {
    if (inPlayer) {
      player.unmount()
      inPlayer = false
    }
    askApp?.destroy()
    askApp = null
    widget = new OutsidePage(h.startsWith('#/widget') ? 'home' : h.split('/')[2])
    app.replaceChildren(widget.root)
    return
  }
  // Ась with the «В дороге» mode lives at the root; the previous voice-only app at #/v9
  if (h === '#/' || h === '#') {
    if (inPlayer) {
      player.unmount()
      inPlayer = false
    }
    askApp?.destroy()
    askApp = null
    grif?.destroy()
    grif = new GrifApp()
    app.replaceChildren(grif.root)
    return
  }
  if (h.startsWith('#/visions')) {
    askApp?.destroy()
    askApp = null
    app.replaceChildren(new VisionsPage().root)
    scrollTo(0, 0)
    return
  }
  if (h.startsWith('#/v9')) {
    askApp?.destroy()
    askApp = new AskApp()
    app.replaceChildren(askApp.root)
    return
  }
  askApp?.destroy()
  askApp = null
  if (m && SCREENS[m[1]]) {
    if (!inPlayer) {
      player.mount(app, m[1])
      inPlayer = true
      hintOnce()
    } else if (player.currentId !== m[1]) player.show(m[1], 1)
    return
  }
  if (inPlayer) {
    player.unmount()
    inPlayer = false
  }
  const page = h.startsWith('#/flow') ? flow() : h.startsWith('#/island') ? island() : h.startsWith('#/guide') ? guide() : home()
  app.replaceChildren(page)
  scrollTo(0, 0)
}

function hintOnce() {
  let seen = false
  try {
    seen = localStorage.getItem('ask-hint') === '1'
    localStorage.setItem('ask-hint', '1')
  } catch {
    /* storage may be unavailable — just show the hint */
  }
  if (seen || !inPlayer) return
  const t = document.createElement('div')
  t.className = 'hint'
  t.textContent = 'Свайп — следующий экран. Кнопки работают. Меню справа сверху — сценарии и голос.'
  document.body.append(t)
  t.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'both' })
  setTimeout(() => {
    const a = t.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' })
    a.onfinish = () => t.remove()
  }, 4200)
}

addEventListener('hashchange', route)
route()
