import type { CSSProperties } from "react"

/**
 * Skeleton blocks aligned with web.tsx JobSkeleton, BigJobCard, StackedJobCard,
 * RowJobCard, and MapDrawerJobRowSkeleton (light theme via CSS variables).
 */

function Sk({
    className,
    style,
}: {
    className?: string
    style?: CSSProperties
}) {
    return <div className={`hp-sk ${className ?? ""}`} style={style} />
}

/** Big featured card (loading) — mirrors BigJobCard with job === null */
export function BigJobCardSkeleton({
    borderRadius = 36,
    style,
    minHeight,
    isMobile = false,
    className,
}: {
    borderRadius?: number
    style?: CSSProperties
    minHeight?: number
    isMobile?: boolean
    className?: string
}) {
    const pad = isMobile ? 20 : 24
    const logoSz = isMobile ? 20 : 32
    const companyFs = isMobile ? 12 : 14
    const titleFs = isMobile ? 16 : 21
    const timeFs = isMobile ? 12 : 14
    return (
        <div
            className={`hp-card hp-card-big ${className ?? ""}`}
            style={{
                padding: pad,
                background: "var(--surface-highlight)",
                borderRadius,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                alignItems: "flex-start",
                minHeight: minHeight ?? (isMobile ? 164 : undefined),
                ...style,
            }}
        >
            <div
                style={{
                    alignSelf: "stretch",
                    display: "flex",
                    flexDirection: "column",
                    gap: isMobile ? 16 : 24,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: isMobile ? 8 : 12,
                        alignSelf: "stretch",
                    }}
                >
                    <Sk
                        style={{
                            width: logoSz,
                            height: logoSz,
                            borderRadius: "50%",
                            flexShrink: 0,
                        }}
                    />
                    <Sk
                        style={{
                            width: 72,
                            height: companyFs,
                            borderRadius: 6,
                        }}
                    />
                </div>
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        alignSelf: "stretch",
                    }}
                >
                    <Sk
                        style={{
                            height: Math.max(18, titleFs - 2),
                            borderRadius: 6,
                            alignSelf: "stretch",
                        }}
                    />
                    <Sk
                        style={{
                            height: Math.max(18, titleFs - 2),
                            width: "60%",
                            borderRadius: 6,
                        }}
                    />
                </div>
            </div>
            <Sk style={{ width: 72, height: timeFs, borderRadius: 6 }} />
        </div>
    )
}

/** Stacked job card (loading) */
export function StackedJobCardSkeleton({ isMobile = false }) {
    const px = isMobile ? 20 : 24
    const py = isMobile ? 16 : 20
    const titleFs = isMobile ? 15 : 16
    const metaFs = isMobile ? 12 : 14
    return (
        <div
            className="hp-card hp-card-stacked"
            style={{
                alignSelf: "stretch",
                paddingLeft: px,
                paddingRight: px,
                paddingTop: py,
                paddingBottom: py,
                background: "var(--surface-highlight)",
                borderRadius: 28,
                display: "flex",
                flexDirection: "column",
                gap: 12,
            }}
        >
            <Sk
                style={{
                    width: "70%",
                    height: titleFs,
                    borderRadius: 6,
                }}
            />
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                }}
            >
                <Sk
                    style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        flexShrink: 0,
                    }}
                />
                <Sk
                    style={{
                        width: 96,
                        height: metaFs,
                        borderRadius: 6,
                    }}
                />
                <Sk
                    style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        flexShrink: 0,
                        alignSelf: "center",
                    }}
                />
                <Sk
                    style={{
                        width: 120,
                        height: metaFs,
                        borderRadius: 6,
                    }}
                />
            </div>
        </div>
    )
}

/** Single horizontal row (loading) — RowJobCard */
export function RowJobCardSkeleton({ isMobile = false }) {
    const titleFs = isMobile ? 15 : 16
    const metaFs = isMobile ? 12 : 14
    return (
        <div
            className="hp-card hp-card-row"
            style={{
                alignSelf: "stretch",
                minWidth: 0,
                height: 56,
                paddingLeft: 24,
                paddingRight: 24,
                boxSizing: "border-box",
                background: "var(--surface-highlight)",
                borderRadius: 48,
                display: "flex",
                alignItems: "center",
                gap: 8,
                overflow: "hidden",
            }}
        >
            <Sk
                style={{
                    flex: "1 1 0",
                    height: titleFs,
                    borderRadius: 6,
                    minWidth: 0,
                }}
            />
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                }}
            >
                <Sk
                    style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                    }}
                />
                <Sk style={{ width: 72, height: metaFs, borderRadius: 6 }} />
            </div>
        </div>
    )
}

/** Map drawer style row */
export function MapDrawerRowSkeleton() {
    const h = "var(--hover-default)"
    return (
        <div
            style={{
                background: "var(--surface-highlight)",
                borderRadius: 28,
                padding: "16px 20px",
                flexShrink: 0,
            }}
        >
            <div
                style={{
                    height: 18,
                    width: "65%",
                    background: h,
                    borderRadius: 6,
                    marginBottom: 10,
                    animation: "homepageSkeleton 1.4s ease-in-out infinite",
                }}
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div
                    style={{
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        background: h,
                        flexShrink: 0,
                        animation: "homepageSkeleton 1.4s ease-in-out infinite",
                    }}
                />
                <div
                    style={{
                        height: 13,
                        width: "40%",
                        background: h,
                        borderRadius: 6,
                        animation: "homepageSkeleton 1.4s ease-in-out infinite",
                    }}
                />
            </div>
        </div>
    )
}
