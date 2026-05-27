const JST = 'Asia/Tokyo'

/** YYYY/MM/DD HH:mm:ss (JST) */
export function formatDateTimeJST(date: Date | string): string {
  return new Date(date).toLocaleString('ja-JP', {
    timeZone: JST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

/** YYYY/MM/DD (JST) */
export function formatDateJST(date: Date | string): string {
  return new Date(date).toLocaleDateString('ja-JP', {
    timeZone: JST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}
