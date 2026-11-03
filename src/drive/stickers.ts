// Stickers for the car: our own die-cut drawings. Each is given once, only after the car stops,
// and only for calm, safe behaviour (research/31: no speed, no ratings, no streaks, no popups on the road).

export type StickerId = 'hello' | 'voice' | 'early' | 'hands' | 'hands25' | 'limits' | 'rest' | 'home' | 'park' | 'owl' | 'hundred' | 'tree'

export interface Sticker { id: StickerId; name: string; how: string; svg: string }

// a die-cut sticker: white edge, a colour field, a white glyph drawn in a 64 box
const cut = (fill: string, glyph: string, shape: 'circle' | 'square' = 'circle') => {
  const edge = shape === 'circle' ? '<circle cx="32" cy="32" r="31" fill="#fff"/>' : '<rect x="1" y="1" width="62" height="62" rx="18" fill="#fff"/>'
  const field = shape === 'circle' ? `<circle cx="32" cy="32" r="26.5" fill="${fill}"/>` : `<rect x="5.5" y="5.5" width="53" height="53" rx="14" fill="${fill}"/>`
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${edge}${field}<g fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${glyph}</g></svg>`
}

export const STICKERS: Sticker[] = [
  { id: 'hello', name: 'Привет, Ась', how: 'первая поездка в режиме «В дороге»', svg: cut('#3D7BFF', '<path d="M18 22h28a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H30l-8 6v-6h-4a4 4 0 0 1-4-4V26a4 4 0 0 1 4-4z"/><path d="M24 32h.01M32 32h.01M40 32h.01" stroke-width="4.5"/>') },
  { id: 'voice', name: 'Голосом', how: 'первый вопрос голосом на ходу', svg: cut('#9B6BFF', '<rect x="27" y="16" width="10" height="20" rx="5"/><path d="M21 31a11 11 0 0 0 22 0M32 42v6"/>') },
  { id: 'early', name: 'Заранее', how: 'маршрут построен до выезда', svg: cut('#3DD9B0', '<path d="M32 48s-12-11-12-20a12 12 0 0 1 24 0c0 9-12 20-12 20z"/><path d="M27 28l4 4 7-7"/>') },
  { id: 'hands', name: 'Руки на руле', how: '5 поездок без касаний Ась и Карт на ходу', svg: cut('#FF8A3D', '<circle cx="32" cy="32" r="14"/><circle cx="32" cy="32" r="3.5"/><path d="M18.5 29h10M35.5 29h10M32 35.5V46"/>') },
  { id: 'hands25', name: 'Руки на руле ×25', how: '25 поездок без касаний на ходу', svg: cut('#FFC83D', '<circle cx="32" cy="30" r="12"/><circle cx="32" cy="30" r="3"/><path d="M20.5 27.5h8.5M35 27.5h8.5M32 33v8"/><path d="M24 48h16" stroke-width="3"/>', 'square') },
  { id: 'limits', name: 'В рамках', how: 'поездка без превышений, если Карты знают ограничения', svg: cut('#E5484D', '<circle cx="32" cy="32" r="13"/><path d="M26 32l4.5 4.5L39 28"/>') },
  { id: 'rest', name: 'Привал', how: 'в долгой поездке остановка от 15 минут', svg: cut('#B07A4F', '<path d="M19 27h22v8a10 10 0 0 1-10 10h-2a10 10 0 0 1-10-10z"/><path d="M41 30h3a4 4 0 0 1 0 8h-4M25 17v4M31 15v6M37 17v4"/>') },
  { id: 'home', name: 'Доехал, сообщил', how: 'отправил близким «я доехал»', svg: cut('#FF7AB8', '<path d="M18 31l14-12 14 12v15H18z"/><path d="M32 43s-6-4-6-8a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 4-6 8-6 8z" stroke-width="3"/>', 'square') },
  { id: 'park', name: 'Парковщик', how: 'сохранил место парковки', svg: cut('#2F6BFF', '<path d="M26 46V18h9a8 8 0 0 1 0 16h-9"/>', 'square') },
  { id: 'owl', name: 'Сова', how: 'спокойная ночная поездка без касаний', svg: cut('#3A3F6B', '<circle cx="25" cy="31" r="6"/><circle cx="39" cy="31" r="6"/><path d="M30 39l2 3 2-3M19 22l6 3M45 22l-6 3"/>') },
  { id: 'hundred', name: 'Сотка', how: '100 км с Ась', svg: cut('#16A37F', '<path d="M17 26l3-2v16M28 32a4 6 0 1 0 8 0 4 6 0 1 0-8 0M40 32a4 6 0 1 0 8 0 4 6 0 1 0-8 0" stroke-width="3"/>') },
  { id: 'tree', name: 'Ёлка', how: 'зимой дарится всем', svg: cut('#1F8F5F', '<path d="M32 15l9 12h-5l7 9h-6l6 8H21l6-8h-6l7-9h-5z"/><path d="M32 44v5"/>') },
]

export const sticker = (id: StickerId) => STICKERS.find((s) => s.id === id)!
