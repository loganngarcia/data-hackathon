import React from "react"
import type { CSSProperties } from "react"
import { cleanDisplayUrl, ensureProtocol, removeUtmParams } from "./urls"

export const applyInlineFormatting = (
    textSegment: string,
    keyPrefix: string,
    linkStyle: CSSProperties
): (string | React.JSX.Element)[] => {
    if (!textSegment) return []
    const parts: (string | React.JSX.Element)[] = []
    let lastIndex = 0

    // Improved regex with simplified URL capture (validation/trimming handled in logic)
    // Removed capture groups for specific URL parts to avoid regex engine confusion
    const combinedRegex =
        /(\*\*(.*?)\*\*|__(.*?)__|<strong>(.*?)<\/strong>|<b>(.*?)<\/b>|\`([^`]+)\`|~~(.*?)~~|(\*|_)(.*?)\8|<em>(.*?)<\/em>|<i>(.*?)<\/i>|\[([^\]]+?)\]\(([^)]+?)\)|<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63})|(https?:\/\/[^\s<>"{}|\\^`\[\]]+)|((?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?))/gi

    let match
    while ((match = combinedRegex.exec(textSegment)) !== null) {
        if (match.index > lastIndex) {
            parts.push(textSegment.substring(lastIndex, match.index))
        }

        const [
            fullMatch,
            _matchText,
            boldInner,
            boldInner2,
            strongInner,
            bInner,
            codeInner,
            strikeInner,
            _italicDelim,
            italicInner,
            emInner,
            iInner,
            linkText,
            linkUrl,
            htmlLinkUrl,
            htmlLinkText,
            email,
            httpUrl,
            plainUrl,
        ] = match

        if (
            boldInner !== undefined ||
            boldInner2 !== undefined ||
            strongInner !== undefined ||
            bInner !== undefined
        ) {
            parts.push(
                <strong key={`${keyPrefix}-${match.index}-b`}>
                    {applyInlineFormatting(
                        boldInner || boldInner2 || strongInner || bInner,
                        `${keyPrefix}-${match.index}-b-inner`,
                        linkStyle
                    )}
                </strong>
            )
        } else if (codeInner !== undefined) {
            parts.push(
                <span
                    key={`${keyPrefix}-${match.index}-code`}
                    className="chat-markdown-inline-code"
                >
                    {codeInner}
                </span>
            )
        } else if (strikeInner !== undefined) {
            parts.push(
                <del key={`${keyPrefix}-${match.index}-del`}>
                    {applyInlineFormatting(
                        strikeInner,
                        `${keyPrefix}-${match.index}-del-inner`,
                        linkStyle
                    )}
                </del>
            )
        } else if (
            italicInner !== undefined ||
            emInner !== undefined ||
            iInner !== undefined
        ) {
            parts.push(
                <em key={`${keyPrefix}-${match.index}-em`}>
                    {applyInlineFormatting(
                        italicInner || emInner || iInner,
                        `${keyPrefix}-${match.index}-em-inner`,
                        linkStyle
                    )}
                </em>
            )
        } else if (linkText !== undefined && linkUrl !== undefined) {
            parts.push(
                <a
                    key={`${keyPrefix}-${match.index}-a`}
                    href={ensureProtocol(removeUtmParams(linkUrl))}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={linkStyle}
                >
                    {applyInlineFormatting(
                        cleanDisplayUrl(linkText),
                        `${keyPrefix}-${match.index}-a-inner`,
                        linkStyle
                    )}
                </a>
            )
        } else if (htmlLinkText !== undefined && htmlLinkUrl !== undefined) {
            parts.push(
                <a
                    key={`${keyPrefix}-${match.index}-html-a`}
                    href={ensureProtocol(removeUtmParams(htmlLinkUrl))}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={linkStyle}
                >
                    {applyInlineFormatting(
                        cleanDisplayUrl(htmlLinkText),
                        `${keyPrefix}-${match.index}-html-a-inner`,
                        linkStyle
                    )}
                </a>
            )
        } else if (email !== undefined) {
            parts.push(
                <a
                    key={`${keyPrefix}-${match.index}-mail`}
                    href={`mailto:${email}`}
                    style={linkStyle}
                >
                    {email}
                </a>
            )
        } else if (httpUrl !== undefined || plainUrl !== undefined) {
            const rawUrl = httpUrl || plainUrl
            let url = rawUrl
            let tail = ""

            // Trim trailing punctuation and unbalanced parens
            while (url.length > 0) {
                const lastChar = url[url.length - 1]
                // Punctuation that shouldn't end a URL
                if (/[.,;:!?]/.test(lastChar)) {
                    url = url.slice(0, -1)
                    tail = lastChar + tail
                    continue
                }
                // Parentheses balance check
                if (lastChar === ")") {
                    const openCount = (url.match(/\(/g) || []).length
                    const closeCount = (url.match(/\)/g) || []).length
                    if (closeCount > openCount) {
                        url = url.slice(0, -1)
                        tail = lastChar + tail
                        continue
                    }
                }
                // Special case for query param quotes - keep them if balanced or part of query
                if (lastChar === '"') {
                    const quoteCount = (url.match(/"/g) || []).length
                    if (quoteCount % 2 !== 0) {
                        url = url.slice(0, -1)
                        tail = lastChar + tail
                        continue
                    }
                }
                break
            }

            parts.push(
                <a
                    key={`${keyPrefix}-${match.index}-url`}
                    href={ensureProtocol(removeUtmParams(url))}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={linkStyle}
                >
                    {cleanDisplayUrl(url)}
                </a>
            )
            if (tail) {
                parts.push(tail)
            }
        } else {
            parts.push(fullMatch)
        }

        lastIndex = match.index + fullMatch.length
    }

    if (lastIndex < textSegment.length) {
        parts.push(textSegment.substring(lastIndex))
    }

    return parts
}

export const renderTable = (
    block: string,
    key: string,
    _baseStyle: CSSProperties,
    linkStyle: CSSProperties
) => {
    const lines = block.trim().split("\n")
    if (lines.length < 2) return null

    const headerLine = lines[0]
    const separatorLine = lines[1]
    const bodyLines = lines.slice(2)

    if (!separatorLine.includes("-") || !separatorLine.includes("|"))
        return null

    const headers = headerLine
        .split("|")
        .filter((h) => h.trim().length > 0)
        .map((h) => h.trim())
    const rows = bodyLines.map((line) =>
        line
            .split("|")
            .filter((c) => c.trim().length > 0)
            .map((c) => c.trim())
    )

    return (
        <div
            key={key}
            style={{ overflowX: "auto", width: "100%", display: "block" }}
        >
            <table className="chat-markdown-table">
                <thead>
                    <tr>
                        {headers.map((h, i) => (
                            <th key={`th-${i}`}>
                                {applyInlineFormatting(
                                    h,
                                    `${key}-th-${i}`,
                                    linkStyle
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={`tr-${i}`}>
                            {row.map((cell, j) => (
                                <td key={`td-${i}-${j}`}>
                                    {applyInlineFormatting(
                                        cell,
                                        `${key}-td-${i}-${j}`,
                                        linkStyle
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

export const renderSimpleMarkdown = (
    markdownText: string,
    baseTextStyle: CSSProperties,
    linkStyle: CSSProperties
): React.JSX.Element => {
    if (!markdownText) return <React.Fragment />

    const codeBlockRegex = /(```[\s\S]*?```)/g
    const segments = markdownText.split(codeBlockRegex)

    const renderedSegments = segments.map((segment, segIndex) => {
        if (segment.startsWith("```")) {
            const content = segment
                .replace(/^```\w*\n?/, "")
                .replace(/```$/, "")
            return (
                <div
                    key={`codeblock-${segIndex}`}
                    className="chat-markdown-code-block"
                >
                    {content}
                </div>
            )
        }

        // Split by lines to handle mixed content better
        const lines = segment.split("\n")
        const nodes: React.JSX.Element[] = []

        let currentListType: "ul" | "ol" | null = null
        let currentListItems: string[] = []
        let currentTableLines: string[] = []

        const flushList = () => {
            if (!currentListType || currentListItems.length === 0) return
            const ListTag = currentListType === "ul" ? "ul" : "ol"
            const key = `list-${segIndex}-${nodes.length}`
            nodes.push(
                <ListTag
                    key={key}
                    style={{
                        paddingLeft: 20,
                        margin: "0.5em 0",
                        listStyleType:
                            currentListType === "ul" ? "disc" : "decimal",
                    }}
                >
                    {currentListItems.map((item, i) => (
                        <li key={`${key}-li-${i}`} style={baseTextStyle}>
                            {applyInlineFormatting(
                                item,
                                `${key}-li-${i}`,
                                linkStyle
                            )}
                        </li>
                    ))}
                </ListTag>
            )
            currentListItems = []
            currentListType = null
        }

        const flushTable = () => {
            if (currentTableLines.length === 0) return
            // Basic validation: needs at least header and separator
            if (
                currentTableLines.length >= 2 &&
                currentTableLines[1].includes("---")
            ) {
                const key = `table-${segIndex}-${nodes.length}`
                const tableBlock = currentTableLines.join("\n")
                const table = renderTable(
                    tableBlock,
                    key,
                    baseTextStyle,
                    linkStyle
                )
                if (table) nodes.push(table)
                else {
                    // Fallback: render as text lines if table parsing failed
                    currentTableLines.forEach((line, i) => {
                        nodes.push(
                            <div
                                key={`p-tbl-${segIndex}-${nodes.length}-${i}`}
                                style={{ ...baseTextStyle, margin: "0.2em 0" }}
                            >
                                {applyInlineFormatting(
                                    line,
                                    `p-tbl-${segIndex}-${nodes.length}-${i}`,
                                    linkStyle
                                )}
                            </div>
                        )
                    })
                }
            } else {
                // Not a valid table, render as text lines
                currentTableLines.forEach((line, i) => {
                    nodes.push(
                        <div
                            key={`p-badtbl-${segIndex}-${nodes.length}-${i}`}
                            style={{
                                ...baseTextStyle,
                                margin: 0,
                                minHeight: "1.2em",
                            }}
                        >
                            {applyInlineFormatting(
                                line,
                                `p-badtbl-${segIndex}-${nodes.length}-${i}`,
                                linkStyle
                            )}
                        </div>
                    )
                })
            }
            currentTableLines = []
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            const trimmed = line.trim()

            // Table handling
            if (trimmed.includes("|")) {
                flushList() // Close list if we enter a table
                currentTableLines.push(line)
                continue
            } else {
                flushTable() // Close table if we hit a non-table line
            }

            // List handling
            const ulMatch = trimmed.match(/^[-*]\s+(.*)/)
            const olMatch = trimmed.match(/^(\d+)\.\s+(.*)/)

            if (ulMatch) {
                if (currentListType !== "ul") flushList()
                currentListType = "ul"
                currentListItems.push(ulMatch[1])
                continue
            } else if (olMatch) {
                if (currentListType !== "ol") flushList()
                currentListType = "ol"
                currentListItems.push(olMatch[2])
                continue
            } else {
                flushList()
            }

            // if (!trimmed) continue

            // Headings
            const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)/)
            if (headingMatch) {
                const level = headingMatch[1].length
                const content = headingMatch[2]
                const sizes = [24, 20, 18, 16, 14, 12]
                nodes.push(
                    <div
                        key={`h-${segIndex}-${i}`}
                        style={{
                            ...baseTextStyle,
                            fontSize: `${Math.max(sizes[level - 1], 14)}px`,
                            fontWeight: "bold",
                            margin: "0.5em 0",
                        }}
                    >
                        {applyInlineFormatting(
                            content,
                            `h-${segIndex}-${i}`,
                            linkStyle
                        )}
                    </div>
                )
                continue
            }

            // Blockquote
            if (trimmed.startsWith(">")) {
                const content = trimmed.replace(/^>\s?/gm, "").trim()
                nodes.push(
                    <blockquote
                        key={`qt-${segIndex}-${i}`}
                        className="chat-markdown-blockquote"
                    >
                        {applyInlineFormatting(
                            content,
                            `qt-${segIndex}-${i}`,
                            linkStyle
                        )}
                    </blockquote>
                )
                continue
            }

            // Horizontal Rule
            if (/^---+$|^\*\*\*+$/.test(trimmed)) {
                nodes.push(
                    <hr
                        key={`hr-${segIndex}-${i}`}
                        className="chat-markdown-hr"
                    />
                )
                continue
            }

            // Regular Paragraph Line
            nodes.push(
                <div
                    key={`p-${segIndex}-${i}`}
                    style={{ ...baseTextStyle, margin: 0, minHeight: "1.2em" }}
                >
                    {applyInlineFormatting(
                        trimmed,
                        `p-${segIndex}-${i}`,
                        linkStyle
                    )}
                </div>
            )
        }

        flushList()
        flushTable()

        return <React.Fragment key={`seg-${segIndex}`}>{nodes}</React.Fragment>
    })

    return <React.Fragment>{renderedSegments}</React.Fragment>
}
