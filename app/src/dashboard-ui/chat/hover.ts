export function isHoverCapable(): boolean {
    if (typeof window === "undefined") return false
    return window.matchMedia("(hover: hover)").matches
}
