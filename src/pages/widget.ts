// Outside the app: a home-screen widget and a Live Activity in the Dynamic Island.
// A web page can't put either on a real phone, so this page shows how the native
// version behaves: tap the widget → ась answers on top of the home screen
// (the app never opens) → the answer folds into the island and stays there.

import { icon, rateCard } from '../app/app'
import { assemble, dotFigure } from '../app/dotfig'
import { DotOrb } from '../app/dots'
import { REPLY } from '../app/script'
import { EASE_OUT, enter, reduced, spring } from '../motion'
import * as voice from '../voice'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// neutral app icons — a home screen, not anyone's brand
const APPS: [string, string][] = [
  ['карты', '<path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4zM9 4v13M15 6.5v13"/>'],
  ['музыка', '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'],
  ['погода', '<path d="M7 18a4 4 0 0 1-.6-8A6 6 0 0 1 18 10a4 4 0 0 1 0 8z"/>'],
  ['камера', '<rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.5" r="3.5"/><path d="M9 7l1.5-2.5h3L15 7"/>'],
  ['заметки', '<rect x="5" y="3.5" width="14" height="17" rx="3"/><path d="M9 9h6M9 13h6M9 17h3"/>'],
  ['часы', '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>'],
  ['фото', '<rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="m3.5 16 5-5 4 4 2.5-2.5 5 5"/>'],
  ['почта', '<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="m4 7 8 6 8-6"/>'],
]
const DOCK: [string, string][] = [
  ['телефон', '<path d="M6 3.5h3l1.5 4.5-2 1.5a11 11 0 0 0 6 6l1.5-2 4.5 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4 5.5a2 2 0 0 1 2-2z"/>'],
  ['сообщения', '<path d="M4 5.5h16v10H9l-5 4z"/>'],
  ['браузер', '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>'],
  ['навигатор', '<path d="m12 3 7 18-7-4-7 4z"/>'],
]
const appIcon = (p: string) => `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`

export class WidgetPage {
  readonly root = document.createElement('main')
  private orbs: DotOrb[] = []
  private busy = false
  private token = 0

  constructor() {
    document.documentElement.dataset.mode = 'night'
    this.root.className = 'w-page'
    this.root.innerHTML = `
      <div class="w-phone">
        <div class="w-home">
          <div class="w-status" aria-hidden="true"><b>9:41</b><svg width="66" height="14" viewBox="0 0 66 14" fill="currentColor"><rect x="0" y="9" width="3" height="5" rx="1"/><rect x="5" y="6" width="3" height="8" rx="1"/><rect x="10" y="3" width="3" height="11" rx="1"/><rect x="15" y="0" width="3" height="14" rx="1"/><path d="M30 12.5a1.6 1.6 0 1 0 0-.01zM25.5 8a6.4 6.4 0 0 1 9 0M22.5 5a10.6 10.6 0 0 1 15 0" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><rect x="42" y="1.5" width="21" height="11" rx="3.5" stroke="currentColor" stroke-width="1.2" fill="none" opacity=".5"/><rect x="44" y="3.5" width="15" height="7" rx="2"/><rect x="64" y="5" width="1.6" height="4" rx=".8" opacity=".5"/></svg></div>
          <div class="w-grid">
            <button class="w-widget press" aria-label="виджет ась: ставка ЦБ 14%, коснитесь, чтобы спросить">
              <span class="w-wtop"><canvas class="w-worb" aria-hidden="true"></canvas><b>ась?</b></span>
              <span class="w-wlabel">ставка ЦБ</span>
              <span class="w-wfig"></span>
              <span class="w-wfoot"><span>до 18 дек</span><span class="w-wmic">${icon('mic', 22)}</span></span>
            </button>
            <div class="w-cal" aria-hidden="true"><span>среда</span><b>28</b><i>М‑11 · 2 ч 40 мин</i></div>
            ${APPS.map(([n, p]) => `<span class="w-app" aria-hidden="true"><i>${appIcon(p)}</i>${n}</span>`).join('')}
          </div>
          <p class="w-note">коснитесь виджета — ась ответит, не открывая приложение<a href="#/">← назад в приложение</a></p>
          <div class="w-dock" aria-hidden="true">${DOCK.map(([, p]) => `<i>${appIcon(p)}</i>`).join('')}</div>
        </div>
        <button class="w-island" aria-label="Dynamic Island"><span class="w-iin"></span></button>
        <div class="w-over" hidden>
          <div class="w-sheet">
            <canvas class="w-orb" aria-hidden="true"></canvas>
            <p class="w-cap"></p>
            <div class="w-ans"></div>
          </div>
        </div>
      </div>
      <a class="w-back press" href="#/">${icon('arrow', 18)}<span>в приложение</span></a>`
    const fig = this.root.querySelector('.w-wfig')!
    fig.append(dotFigure('14%', '14 процентов', 0.84))
    this.orbs.push(new DotOrb(this.root.querySelector('.w-worb')!), new DotOrb(this.root.querySelector('.w-orb')!))
    this.orbs[0].setTheme('day') // the widget is a light card
    this.orbs[1].setTheme('night')
    this.root.querySelector('.w-widget')!.addEventListener('click', () => this.ask())
    this.root.querySelector('.w-island')!.addEventListener('click', () => this.toggleIsland())
    this.root.querySelector('.w-over')!.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.close()
    })
  }

  /** tap on the widget: ась answers over the home screen, the app stays closed */
  private async ask() {
    if (this.busy) return
    this.busy = true
    const tk = ++this.token
    voice.setOn(true) // this tap is the gesture that unlocks speech
    const over = this.root.querySelector<HTMLElement>('.w-over')!
    const sheet = this.root.querySelector<HTMLElement>('.w-sheet')!
    const home = this.root.querySelector<HTMLElement>('.w-home')!
    const w = this.root.querySelector('.w-widget')!.getBoundingClientRect()
    const cap = this.root.querySelector<HTMLElement>('.w-cap')!
    const ans = this.root.querySelector<HTMLElement>('.w-ans')!
    const orb = this.orbs[1]
    this.setIsland('')
    ans.innerHTML = ''
    cap.textContent = ''
    over.hidden = false
    // the sheet grows out of the widget; the home screen steps back
    const r = sheet.getBoundingClientRect()
    const s = spring(300, 26)
    if (!reduced()) {
      sheet.animate(
        [{ transform: `translate(${w.left - r.left}px, ${w.top - r.top}px) scale(${w.width / r.width}, ${w.height / r.height})`, opacity: 0.6 }, { transform: 'none', opacity: 1 }],
        { duration: s.duration, easing: s.easing },
      )
      home.animate([{ transform: 'none', filter: 'brightness(1)' }, { transform: 'scale(0.94)', filter: 'brightness(0.55)' }], { duration: 320, easing: EASE_OUT, fill: 'forwards' })
    }
    orb.setState('listening')
    const q = 'какая ставка ЦБ на месяц?'
    for (let i = 1; i <= q.length; i++) {
      if (tk !== this.token) return
      cap.textContent = q.slice(0, i)
      orb.level(0.4 + 0.3 * Math.abs(Math.sin(i)))
      await wait(34)
    }
    await wait(300)
    orb.setState('thinking')
    ans.innerHTML = `<div class="ph-box"><p class="ph-label">листаю пресс‑релизы ЦБ</p><span class="dots5 big"><i></i><i></i><i></i><i></i><i></i></span></div>`
    await wait(1200)
    if (tk !== this.token) return
    orb.setState('speaking')
    ans.innerHTML = rateCard()
    const svg = dotFigure('14%', '14 процентов', 0.84)
    ans.querySelector('.c-fig')!.append(svg)
    const sum = ans.querySelector('.c-sum')!
    if (!reduced()) {
      const sp = spring(300, 22)
      sum.animate([{ opacity: 0, transform: 'scale(0.96)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: sp.duration, easing: sp.easing, fill: 'backwards' })
      assemble(svg, 120)
    }
    const line = REPLY.rate.say.split('. ').slice(0, 2).join('. ') + '.'
    const t0 = performance.now()
    await voice.say(`«${line}»`, () => orb.pulse())
    // no voice in this browser: hold the answer as long as it would take to say it
    while (performance.now() - t0 < 2600) await wait(120)
    if (tk !== this.token) return
    await this.foldIntoIsland(sum as HTMLElement)
  }

  /** the answer flies up into the island and stays there as a Live Activity */
  private async foldIntoIsland(card: HTMLElement) {
    const island = this.root.querySelector<HTMLElement>('.w-island')!
    const a = card.getBoundingClientRect()
    this.setIsland('compact')
    const b = island.getBoundingClientRect()
    if (!reduced()) {
      const ghost = card.cloneNode(true) as HTMLElement
      ghost.classList.add('w-ghost')
      const home = this.root.querySelector('.w-phone')!.getBoundingClientRect()
      Object.assign(ghost.style, { left: `${a.left - home.left}px`, top: `${a.top - home.top}px`, width: `${a.width}px`, height: `${a.height}px` })
      this.root.querySelector('.w-phone')!.append(ghost)
      card.style.visibility = 'hidden'
      const fly = ghost.animate(
        [
          { transform: 'none', opacity: 1, borderRadius: '30px' },
          { transform: `translate(${b.left + b.width / 2 - (a.left + a.width / 2)}px, ${b.top + b.height / 2 - (a.top + a.height / 2)}px) scale(${b.width / a.width}, ${b.height / a.height})`, opacity: 0, borderRadius: '999px' },
        ],
        { duration: 480, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'forwards' },
      )
      this.close(true)
      await fly.finished
      ghost.remove()
    } else this.close(true)
    this.busy = false
  }

  private close(keepIsland = false) {
    this.token++
    voice.stop()
    const over = this.root.querySelector<HTMLElement>('.w-over')!
    const home = this.root.querySelector<HTMLElement>('.w-home')!
    home.getAnimations().forEach((a) => a.cancel())
    if (!reduced()) home.animate([{ transform: 'scale(0.94)', filter: 'brightness(0.55)' }, { transform: 'none', filter: 'brightness(1)' }], { duration: 260, easing: EASE_OUT })
    const sheet = over.querySelector<HTMLElement>('.w-sheet')!
    const out = reduced() ? null : sheet.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(16px) scale(0.98)' }], { duration: 180, easing: EASE_OUT, fill: 'forwards' })
    const done = () => {
      over.hidden = true
      out?.cancel()
    }
    if (out) out.onfinish = done
    else done()
    this.orbs[1].setState('idle')
    if (!keepIsland) this.setIsland('')
    this.busy = false
  }

  /** '' = the bare island, compact = «ась · 14%», expanded = the whole answer */
  private setIsland(mode: '' | 'compact' | 'expanded') {
    const island = this.root.querySelector<HTMLElement>('.w-island')!
    const inner = island.querySelector<HTMLElement>('.w-iin')!
    const before = island.getBoundingClientRect()
    island.dataset.mode = mode
    inner.innerHTML =
      mode === 'compact'
        ? `<span class="w-idot"></span><b>14%</b>`
        : mode === 'expanded'
          ? `<span class="w-ihead"><span class="w-idot"></span>ась · ставка ЦБ</span><span class="w-ibig"></span><span class="w-isub">до 18 декабря · ЦБ 23 окт</span>`
          : ''
    if (mode === 'expanded') inner.querySelector('.w-ibig')!.append(dotFigure('14%', '14 процентов', 0.84))
    const after = island.getBoundingClientRect()
    if (reduced() || !before.width) return
    // the island springs between sizes; contents cross-fade with a touch of blur
    const s = spring(380, 28)
    island.animate([{ transform: `scale(${before.width / after.width}, ${before.height / after.height})` }, { transform: 'none' }], { duration: s.duration, easing: s.easing })
    if (mode) enter(inner, 80, 0)
  }

  private toggleIsland() {
    const mode = this.root.querySelector<HTMLElement>('.w-island')!.dataset.mode
    if (mode === 'compact') this.setIsland('expanded')
    else if (mode === 'expanded') this.setIsland('compact')
  }

  destroy() {
    this.token++
    voice.stop()
    this.orbs.forEach((o) => o.destroy())
  }
}
