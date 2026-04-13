export type ShareThemeColors = {
    background: string
    hover: { message: string; subtle: string }
    text: { primary: string; secondary: string; tertiary: string; link: string }
    surfaceHighlight: string
    border: { subtle: string }
    overlay: { gradient: string }
}

/** Share card PNG — same pipeline as web.tsx MessageBubble `handleShare`. */
export async function shareAiMessageAsPng(opts: {
    msg: { text: string }
    previousMsg?: { role: string; text?: string } | null
    themeColors: ShareThemeColors
}): Promise<void> {
    const { msg, previousMsg, themeColors } = opts
    const isSharing = { current: false }

    if (
        typeof window === "undefined" ||
        typeof document === "undefined"
    )
        return
    if (isSharing.current) return
    isSharing.current = true

    // 1. Setup Canvas (2x Resolution for Retina/High DPI)
    const SCALE = 2
    const WIDTH = 320 * SCALE
    const HEIGHT = 400 * SCALE

    const canvas = document.createElement("canvas")
    canvas.width = WIDTH
    canvas.height = HEIGHT
    const ctx = canvas.getContext("2d")

    if (!ctx) return

    // Scale all context operations
    ctx.scale(SCALE, SCALE)

    // 2. Constants & Helpers
    const PADDING = 24
    const BUBBLE_PADDING_X = 12
    const BUBBLE_PADDING_Y = 8
    const MAX_BUBBLE_WIDTH = 224

    // Draw Background
    ctx.fillStyle = themeColors.background
    ctx.fillRect(0, 0, 320, 400) // Logical coords

    // Helper: Rounded Rect
    const roundRect = (
        x: number,
        y: number,
        w: number,
        h: number,
        r: number
    ) => {
        if (w < 2 * r) r = w / 2
        if (h < 2 * r) r = h / 2
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.arcTo(x + w, y, x + w, y + h, r)
        ctx.arcTo(x + w, y + h, x, y + h, r)
        ctx.arcTo(x, y + h, x, y, r)
        ctx.arcTo(x, y, x + w, y, r)
        ctx.closePath()
        ctx.fillStyle = themeColors.hover.message
        ctx.fill()
    }

    // Helper: Text Wrapping with return metrics
    const measureTextWrapped = (
        text: string,
        maxWidth: number,
        font: string
    ) => {
        ctx.font = font
        const words = text.split(" ")
        let line = ""
        const lines: string[] = []
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + " "
            const metrics = ctx.measureText(testLine)
            if (metrics.width > maxWidth && n > 0) {
                lines.push(line)
                line = words[n] + " "
            } else {
                line = testLine
            }
        }
        lines.push(line)
        return {
            lines,
            width: Math.min(
                maxWidth,
                Math.max(...lines.map((l) => ctx.measureText(l).width))
            ),
        }
    }

    // 3. Prepare Content
    const rawUserText =
        (previousMsg?.role === "user"
            ? previousMsg.text
            : "User Query") || "User Query"

    // 4. Render User Bubble (Truncate to 3 lines max)
    ctx.font = "400 15px Inter, sans-serif"
    const userMetrics = measureTextWrapped(
        rawUserText,
        MAX_BUBBLE_WIDTH - BUBBLE_PADDING_X * 2,
        "400 15px Inter, sans-serif"
    )

    const maxLines = 3
    const displayLines = userMetrics.lines.slice(0, maxLines)
    const isTruncated = userMetrics.lines.length > maxLines

    // Add ellipsis to last line if truncated
    if (isTruncated && displayLines.length === maxLines) {
        displayLines[maxLines - 1] =
            displayLines[maxLines - 1].trim() + "..."
    }

    const lineHeight = 22.5
    const bubbleW = userMetrics.width + BUBBLE_PADDING_X * 2

    // Use consistent padding for top and bottom
    const topPadding = BUBBLE_PADDING_Y
    const bottomPadding = BUBBLE_PADDING_Y

    // Calculate bubble height: number of lines * line height + top padding + bottom padding
    const bubbleH =
        displayLines.length * lineHeight + topPadding + bottomPadding
    const bubbleX = 320 - PADDING - bubbleW
    const bubbleY = PADDING

    roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 24)

    // Draw text with proper top-left alignment
    ctx.fillStyle = themeColors.text.primary
    ctx.textAlign = "left"
    ctx.textBaseline = "top"

    // Position first line exactly at bubbleY + top padding
    // Ensure text is properly aligned at the top
    const fontSize = 15
    const verticalOffset = (lineHeight - fontSize) / 2 // Center text within line height
    const textStartY = bubbleY + topPadding + verticalOffset

    displayLines.forEach((line, i) => {
        const textY = textStartY + i * lineHeight
        ctx.fillText(line.trim(), bubbleX + BUBBLE_PADDING_X, textY)
    })

    const renderMarkdownToCanvas = (
        text: string,
        startX: number,
        startY: number,
        maxWidth: number
    ) => {
        let currentY = startY
        const baseFont = "400 16px Inter, sans-serif"
        const baseColor = themeColors.text.primary
        const lineHeight = 24
        ctx.textAlign = "left"
        ctx.textBaseline = "top"

        // Inline formatting parser with comprehensive regex matching the React component
        const processInlineFormatting = (
            textSegment: string,
            x: number,
            maxW: number,
            isBullet = false
        ) => {
            const combinedRegex =
                /(\*\*([\s\S]*?)\*\*|__([\s\S]*?)__|<strong>([\s\S]*?)<\/strong>|<b>([\s\S]*?)<\/b>|\`([^`]+)\`|~~([\s\S]*?)~~|(\*|_)([\s\S]*?)\8|<em>([\s\S]*?)<\/em>|<i>([\s\S]*?)<\/i>|\[([^\]]+?)\]\(([^)]+?)\))/gi

            let currentX = isBullet ? x + 12 : x // Indent for bullet items
            const lineStartX = isBullet ? x + 12 : x
            let lastIndex = 0
            let match

            const renderWords = (txt: string, xPos: number) => {
                if (!txt) return xPos
                const words = txt.split(/(\s+)/)
                let cx = xPos

                words.forEach((word) => {
                    if (!word) return
                    const metrics = ctx.measureText(word)

                    if (
                        cx + metrics.width >
                            lineStartX + maxW - (isBullet ? 12 : 0) &&
                        cx !== lineStartX
                    ) {
                        currentY += lineHeight
                        cx = lineStartX
                    }

                    ctx.fillText(word, cx, currentY)
                    cx += metrics.width
                })

                return cx
            }

            while ((match = combinedRegex.exec(textSegment)) !== null) {
                // Render plain text before match
                if (match.index > lastIndex) {
                    const plainText = textSegment.substring(
                        lastIndex,
                        match.index
                    )
                    ctx.font = baseFont
                    ctx.fillStyle = baseColor
                    currentX = renderWords(plainText, currentX)
                }

                const [
                    fullMatch,
                    ,
                    boldInner,
                    boldInner2,
                    strongInner,
                    bInner,
                    codeInner,
                    strikeInner,
                    ,
                    italicInner,
                    emInner,
                    iInner,
                    linkText,
                    linkUrl,
                ] = match

                // Determine content and style
                let content = ""
                let font = baseFont
                let color = baseColor

                if (
                    boldInner !== undefined ||
                    boldInner2 !== undefined ||
                    strongInner !== undefined ||
                    bInner !== undefined
                ) {
                    content =
                        boldInner || boldInner2 || strongInner || bInner
                    font = "600 16px Inter, sans-serif"
                } else if (codeInner !== undefined) {
                    content = codeInner
                    font = "400 14px 'Courier New', monospace"
                    color = themeColors.text.primary
                } else if (strikeInner !== undefined) {
                    content = strikeInner
                    // Strikethrough not easily rendered on canvas, render as normal
                } else if (
                    italicInner !== undefined ||
                    emInner !== undefined ||
                    iInner !== undefined
                ) {
                    content = italicInner || emInner || iInner
                    font = "italic 16px Inter, sans-serif"
                } else if (
                    linkText !== undefined &&
                    linkUrl !== undefined
                ) {
                    content = linkText
                    color = themeColors.text.link
                }

                ctx.font = font
                ctx.fillStyle = color
                currentX = renderWords(content, currentX)

                lastIndex = match.index + fullMatch.length
            }

            // Render remaining text
            if (lastIndex < textSegment.length) {
                ctx.font = baseFont
                ctx.fillStyle = baseColor
                currentX = renderWords(
                    textSegment.substring(lastIndex),
                    currentX
                )
            }

            currentY += lineHeight
        }

        // Process code blocks first
        const codeBlockRegex = /(```[\s\S]*?```)/g
        const segments = text.split(codeBlockRegex)

        segments.forEach((segment) => {
            if (segment.startsWith("```")) {
                // Code block
                const content = segment
                    .replace(/^```\w*\n?/, "")
                    .replace(/```$/, "")
                const lines = content.split("\n")
                const blockHeight = lines.length * 20 + 8
                ctx.fillStyle = themeColors.surfaceHighlight
                ctx.fillRect(startX, currentY, maxWidth, blockHeight)
                ctx.font = "400 14px 'Courier New', monospace"
                ctx.fillStyle = baseColor
                lines.forEach((line) => {
                    ctx.fillText(line, startX + 8, currentY + 4)
                    currentY += 20
                })
                currentY += 8
            } else {
                // Process blocks (paragraphs, lists, etc.)
                const blocks = segment.split(/\n{2,}/)

                blocks.forEach((block) => {
                    const trimmed = block.trim()
                    if (!trimmed) return

                    // Heading
                    const headingMatch =
                        trimmed.match(/^(#{1,6})\s+(.*)/)
                    if (headingMatch) {
                        const level = headingMatch[1].length
                        const content = headingMatch[2]
                        const sizes = [24, 20, 18, 16, 14, 12]
                        const fontSize = Math.max(sizes[level - 1], 14)
                        const headingFont = `600 ${fontSize}px Inter, sans-serif`
                        ctx.font = headingFont
                        ctx.fillStyle = baseColor
                        const headingMetrics = measureTextWrapped(
                            content,
                            maxWidth,
                            headingFont
                        )
                        headingMetrics.lines.forEach((line) => {
                            ctx.fillText(line.trim(), startX, currentY)
                            currentY += fontSize * 1.5
                        })
                        currentY += 8
                        return
                    }

                    // Horizontal rule
                    if (/^---+$|^\*\*\*+$/.test(trimmed)) {
                        ctx.strokeStyle = themeColors.border.subtle
                        ctx.lineWidth = 1
                        ctx.beginPath()
                        ctx.moveTo(startX, currentY + 8)
                        ctx.lineTo(startX + maxWidth, currentY + 8)
                        ctx.stroke()
                        currentY += 24
                        return
                    }

                    // Blockquote
                    if (trimmed.startsWith(">")) {
                        const content = trimmed
                            .replace(/^>\s?/gm, "")
                            .trim()
                        ctx.fillStyle = themeColors.surfaceHighlight
                        ctx.fillRect(startX, currentY, 4, 24)
                        ctx.font = baseFont
                        ctx.fillStyle = themeColors.text.secondary
                        processInlineFormatting(
                            content,
                            startX + 12,
                            maxWidth - 12
                        )
                        currentY += 8
                        return
                    }

                    // Bullet list
                    if (/^[-*]\s/.test(trimmed)) {
                        const items = trimmed
                            .split("\n")
                            .map((l) => l.replace(/^[-*]\s+/, ""))
                        items.forEach((item) => {
                            if (!item.trim()) return
                            // Draw bullet
                            ctx.fillStyle = baseColor
                            ctx.beginPath()
                            ctx.arc(
                                startX + 4,
                                currentY + 8,
                                2,
                                0,
                                Math.PI * 2
                            )
                            ctx.fill()
                            // Draw item text with formatting
                            processInlineFormatting(
                                item,
                                startX,
                                maxWidth,
                                true
                            )
                            currentY += 4
                        })
                        currentY += 4
                        return
                    }

                    // Numbered list
                    if (/^\d+\.\s/.test(trimmed)) {
                        const items = trimmed.split("\n").map((l) => ({
                            num: l.match(/^(\d+)\./)?.[1] || "1",
                            text: l.replace(/^\d+\.\s+/, ""),
                        }))
                        items.forEach((item) => {
                            if (!item.text.trim()) return
                            ctx.font = baseFont
                            ctx.fillStyle = baseColor
                            ctx.fillText(
                                `${item.num}.`,
                                startX,
                                currentY
                            )
                            processInlineFormatting(
                                item.text,
                                startX + 20,
                                maxWidth - 20
                            )
                            currentY += 4
                        })
                        currentY += 4
                        return
                    }

                    // Table
                    const tableRegex = /^\|.*\|$/m
                    if (tableRegex.test(trimmed)) {
                        const lines = trimmed
                            .split("\n")
                            .filter((l) => l.trim().length > 0)
                        if (lines.length >= 2) {
                            const headerLine = lines[0]
                            const separatorLine = lines[1]
                            const bodyLines = lines.slice(2)

                            if (
                                separatorLine.includes("-") &&
                                separatorLine.includes("|")
                            ) {
                                const headers = headerLine
                                    .split("|")
                                    .filter((h) => h.trim().length > 0)
                                    .map((h) => h.trim())
                                const rows = bodyLines.map((line) =>
                                    line
                                        .split("|")
                                        .filter(
                                            (c) => c.trim().length > 0
                                        )
                                        .map((c) => c.trim())
                                )

                                // Basic layout: equal width columns
                                const colCount = headers.length
                                if (colCount > 0) {
                                    const cellPadding = 8
                                    const colWidth =
                                        (maxWidth -
                                            cellPadding *
                                                2 *
                                                colCount) /
                                        colCount

                                    // Draw headers
                                    let tableX = startX
                                    const headerHeight = 32 // Approximate header height

                                    // Draw header background
                                    ctx.fillStyle =
                                        themeColors.surfaceHighlight
                                    ctx.fillRect(
                                        startX,
                                        currentY,
                                        maxWidth,
                                        headerHeight
                                    )

                                    // Draw header text
                                    ctx.font =
                                        "600 14px Inter, sans-serif"
                                    ctx.fillStyle = baseColor
                                    headers.forEach((header) => {
                                        ctx.fillText(
                                            header,
                                            tableX + cellPadding,
                                            currentY + 8
                                        )
                                        tableX +=
                                            colWidth + cellPadding * 2
                                    })

                                    currentY += headerHeight

                                    // Draw rows
                                    ctx.font =
                                        "400 14px Inter, sans-serif"
                                    rows.forEach((row, i) => {
                                        tableX = startX
                                        // Alternating row background
                                        if (i % 2 === 1) {
                                            ctx.fillStyle =
                                                themeColors.hover.subtle
                                            ctx.fillRect(
                                                startX,
                                                currentY,
                                                maxWidth,
                                                24
                                            )
                                        }
                                        ctx.fillStyle = baseColor

                                        row.forEach((cell, j) => {
                                            if (j < colCount) {
                                                // Simple truncation for cell text
                                                let cellText = cell
                                                const maxCellW =
                                                    colWidth
                                                if (
                                                    ctx.measureText(
                                                        cellText
                                                    ).width > maxCellW
                                                ) {
                                                    while (
                                                        ctx.measureText(
                                                            cellText +
                                                                "..."
                                                        ).width >
                                                            maxCellW &&
                                                        cellText.length >
                                                            0
                                                    ) {
                                                        cellText =
                                                            cellText.slice(
                                                                0,
                                                                -1
                                                            )
                                                    }
                                                    cellText += "..."
                                                }
                                                ctx.fillText(
                                                    cellText,
                                                    tableX +
                                                        cellPadding,
                                                    currentY + 4
                                                )
                                                tableX +=
                                                    colWidth +
                                                    cellPadding * 2
                                            }
                                        })
                                        currentY += 24
                                    })

                                    // Draw table border
                                    ctx.strokeStyle =
                                        themeColors.border.subtle
                                    ctx.lineWidth = 1
                                    ctx.strokeRect(
                                        startX,
                                        currentY -
                                            rows.length * 24 -
                                            headerHeight,
                                        maxWidth,
                                        rows.length * 24 + headerHeight
                                    )

                                    currentY += 16
                                    return
                                }
                            }
                        }
                    }

                    // Regular paragraph with inline formatting
                    processInlineFormatting(trimmed, startX, maxWidth)
                    currentY += 8
                })
            }
        })

        return currentY
    }

    renderMarkdownToCanvas(
        msg.text,
        PADDING,
        bubbleY + bubbleH + 24,
        320 - PADDING * 2
    )

    // 6. Draw Gradient
    const grad = ctx.createLinearGradient(0, 400, 0, 250) // Bottom up to 250
    grad.addColorStop(0, themeColors.background)
    grad.addColorStop(0.35, themeColors.background)
    grad.addColorStop(1, themeColors.overlay.gradient)
    ctx.fillStyle = grad
    ctx.fillRect(0, 250, 320, 150)

    // 7. Process & Finish
    const finishShare = () => {
        canvas.toBlob(async (blob) => {
            if (!blob) {
                isSharing.current = false
                return
            }
            let filenameSuffix = (msg.text || "")
                .replace(/[^\w\s-]/g, "")
                .trim()
                .split(/\s+/)
                .slice(0, 10)
                .join("_")

            if (!filenameSuffix) {
                filenameSuffix = Math.floor(
                    10000 + Math.random() * 90000
                ).toString()
            }

            const filename = `chat-share_${filenameSuffix}.png`
            const file = new File([blob], filename, {
                type: "image/png",
            })
            const downloadFallback = () => {
                const link = document.createElement("a")
                link.href = URL.createObjectURL(blob)
                link.download = filename
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                isSharing.current = false
            }

            if (
                navigator.share &&
                navigator.canShare &&
                navigator.canShare({ files: [file] })
            ) {
                try {
                    await navigator.share({ files: [file] })
                    isSharing.current = false
                } catch (e: any) {
                    if (e.name !== "AbortError") {
                        downloadFallback()
                    } else {
                        isSharing.current = false
                    }
                }
            } else {
                downloadFallback()
            }
        }, "image/png")
    }

    finishShare()
}

/** Matches `theme.css` light tokens — used for canvas share export. */
export const LIGHT_SHARE_THEME: ShareThemeColors = {
    background: "hsl(0, 0%, 100%)",
    hover: {
        message: "hsla(0, 0%, 0%, 0.04)",
        subtle: "hsla(0, 0%, 0%, 0.02)",
    },
    text: {
        primary: "hsla(0, 0%, 10%, 1)",
        secondary: "hsla(0, 0%, 40%, 1)",
        tertiary: "hsla(0, 0%, 60%, 1)",
        link: "hsl(210, 100%, 50%)",
    },
    surfaceHighlight: "hsl(0, 0%, 96%)",
    border: { subtle: "hsla(0, 0%, 0%, 0.2)" },
    overlay: { gradient: "hsla(0, 0%, 98%, 0)" },
}
