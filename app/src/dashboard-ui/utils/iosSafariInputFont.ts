/** iOS Safari auto-zooms focused inputs when font-size is below 16px — matches web.tsx */
export function iosSafariInputFontPx(): 14 | 16 {
    if (typeof navigator === "undefined") return 14
    return /iPhone|iPad|iPod/.test(navigator.userAgent) ? 16 : 14
}
