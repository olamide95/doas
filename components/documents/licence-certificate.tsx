"use client"

import * as React from "react"
import QRCode from "qrcode"
import { BadgeCheck, Download, Loader2, Printer, ShieldAlert } from "lucide-react"
import {
  LICENCE_AUTHORITY,
  LICENCE_CATEGORY,
  LICENCE_DEPARTMENT,
  LICENCE_FOOTNOTE,
  LICENCE_SIGNATORY,
  LICENCE_SIGNATORY_NOTE,
  LICENCE_STATEMENT,
  LICENCE_TITLE,
  formatIssueDate,
  licenceVerifyUrl,
  type LicenceDocument,
} from "@/lib/practising-licence"

/**
 * The Practising Licence certificate, drawn as one SVG so it stays sharp at
 * any size: on a phone, in the registry preview, and printed on A4 landscape.
 *
 * Only three things change from one licence to the next — the practitioner's
 * name, the licence number and the date of issue — plus the QR code, which
 * opens the public verification page for this exact licence.
 */

/** A4 landscape proportions (297 × 210). */
export const CERT_W = 1280
export const CERT_H = 905

/** The department crest shown at the top. Lives in /public. */
export const LICENCE_LOGO = "/doas-logo.png"

const SERIF = "Georgia, 'Times New Roman', Times, serif"
const INK = "#16130c"
const GREEN_INK = "#0f3a1c"
/** Straight rules use a flat gold: a gradient has no box to fill on a hairline. */
const RULE_GOLD = "#c2932a"

export interface LicenceCertificateProps {
  holderName: string
  licenceNumber: string
  /** YYYY-MM-DD */
  issueDate: string
  /** Full address the QR code opens. Leave empty for a draft. */
  verifyUrl?: string
  /** Verification code, printed small at the foot for anyone without a scanner. */
  code?: string
  status?: "valid" | "revoked"
  /** Draft shown while staff are still typing: watermarked, no live QR. */
  preview?: boolean
  logoSrc?: string
  className?: string
  svgRef?: React.Ref<SVGSVGElement>
}

const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

/** Squeezes a line of text to `max` only if it would otherwise overflow. */
function useFitWidth(max: number, deps: React.DependencyList) {
  const ref = React.useRef<SVGTextElement>(null)
  useIsoLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.removeAttribute("textLength")
    el.removeAttribute("lengthAdjust")
    let width = 0
    try {
      width = el.getComputedTextLength()
    } catch {
      width = 0
    }
    if (width > max) {
      el.setAttribute("textLength", String(max))
      el.setAttribute("lengthAdjust", "spacingAndGlyphs")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return ref
}

const NAME_MAX_WIDTH = 1010
/** Average glyph width of bold serif capitals, as a share of the font size. */
const NAME_GLYPH = 0.7

function nameLayout(raw: string): { lines: string[]; size: number } {
  const name = raw.trim() || "PRACTITIONER NAME"
  const sizeFor = (text: string, max: number, min: number) => Math.max(min, Math.min(max, NAME_MAX_WIDTH / (Math.max(text.length, 1) * NAME_GLYPH)))
  if (name.length <= 58 || !name.includes(" ")) return { lines: [name], size: sizeFor(name, 46, 22) }

  // Long names break at the space nearest the middle.
  const mid = name.length / 2
  let cut = -1
  for (let i = 0; i < name.length; i += 1) {
    if (name[i] === " " && (cut === -1 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i
  }
  const lines = [name.slice(0, cut), name.slice(cut + 1)]
  const longest = lines[0].length >= lines[1].length ? lines[0] : lines[1]
  return { lines, size: sizeFor(longest, 33, 20) }
}

function qrModules(text: string) {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: "M" })
    const size = qr.modules.size
    const data = qr.modules.data
    let d = ""
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (data[r * size + c]) d += `M${c} ${r}h1v1h-1z`
      }
    }
    return { size, d }
  } catch {
    return null
  }
}

/** One corner of scrollwork, drawn for the top-left and mirrored for the rest. */
function Corner({ gold, transform }: { gold: string; transform: string }) {
  return (
    <g transform={transform}>
      <g fill="none" stroke={gold} strokeLinecap="round" strokeWidth={3.2}>
        <path d="M6 6 C 46 8 82 18 96 44 C 106 64 92 82 76 76 C 62 70 64 52 78 54" />
        <path d="M6 6 C 8 46 18 82 44 96 C 64 106 82 92 76 76 C 70 62 52 64 54 78" />
        <path d="M100 8 C 118 10 132 20 134 34 C 135 44 124 48 120 40" strokeWidth={2.4} />
        <path d="M8 100 C 10 118 20 132 34 134 C 44 135 48 124 40 120" strokeWidth={2.4} />
        <path d="M140 9 H 178" stroke={RULE_GOLD} strokeWidth={2} />
        <path d="M9 140 V 178" stroke={RULE_GOLD} strokeWidth={2} />
      </g>
      <g fill={gold} stroke="#7a5310" strokeWidth={0.6}>
        <path d="M4 4 C 30 14 50 30 60 60 C 30 50 14 30 4 4 Z" />
        <path d="M30 6 C 46 8 60 14 70 26 C 54 26 40 20 30 6 Z" />
        <path d="M6 30 C 8 46 14 60 26 70 C 26 54 20 40 6 30 Z" />
        <path d="M62 62 C 74 62 84 68 90 80 C 78 82 68 76 62 62 Z" opacity={0.9} />
        <circle cx={144} cy={9} r={3.2} />
        <circle cx={9} cy={144} r={3.2} />
        <circle cx={186} cy={9} r={2.2} />
        <circle cx={9} cy={186} r={2.2} />
      </g>
    </g>
  )
}

/** Small gold flourish used in the middle of the divider rules. */
function Knot({ x, y, gold, scale = 1 }: { x: number; y: number; gold: string; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill={gold} stroke="#7a5310" strokeWidth={0.5}>
      <path d="M0 -7 L7 0 L0 7 L-7 0 Z" />
      <path d="M-9 0 C -16 -8 -24 -6 -30 0 C -24 6 -16 8 -9 0 Z" />
      <path d="M9 0 C 16 -8 24 -6 30 0 C 24 6 16 8 9 0 Z" />
      <circle cx={0} cy={0} r={2.2} fill="#fff6cf" stroke="none" />
    </g>
  )
}

function starPoints(cx: number, cy: number, outer: number, inner: number, points: number, rotate = -90) {
  const out: string[] = []
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner
    const a = ((rotate + (i * 180) / points) * Math.PI) / 180
    out.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`)
  }
  return out.join(" ")
}

export function LicenceCertificate({
  holderName,
  licenceNumber,
  issueDate,
  verifyUrl,
  code,
  status = "valid",
  preview = false,
  logoSrc = LICENCE_LOGO,
  className,
  svgRef,
}: LicenceCertificateProps) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "")
  const id = (name: string) => `lic${uid}${name}`
  const url = (name: string) => `url(#${id(name)})`

  const { lines, size } = React.useMemo(() => nameLayout(holderName), [holderName])
  const number = licenceNumber.trim() || "—"
  const date = formatIssueDate(issueDate) || "—"
  const qr = React.useMemo(() => (verifyUrl && !preview ? qrModules(verifyUrl) : null), [verifyUrl, preview])

  const nameRef0 = useFitWidth(NAME_MAX_WIDTH, [lines[0], size])
  const nameRef1 = useFitWidth(NAME_MAX_WIDTH, [lines[1], size])
  const numberRef = useFitWidth(490, [number])
  const dateRef = useFitWidth(490, [date])

  const revoked = status === "revoked"
  const gold = url("gold")

  // QR panel geometry
  // QR panel geometry. The code keeps a clear white margin on every side —
  // scanners need that quiet zone, so nothing may be drawn closer than `pad`.
  const QR = { x: 988, y: 684, w: 160, h: 162, pad: 10, footer: 26 }
  const qrSize = QR.h - QR.footer - QR.pad * 2
  const qrX = QR.x + (QR.w - qrSize) / 2
  const qrY = QR.y + QR.pad

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox={`0 0 ${CERT_W} ${CERT_H}`}
      className={className}
      role="img"
      aria-label={`${LICENCE_TITLE} — ${holderName}, licence number ${number}, issued ${date}`}
      style={{ display: "block", width: "100%", height: "auto", background: "#fffdf5" }}
    >
      <defs>
        <linearGradient id={id("gold")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9a6a12" />
          <stop offset="0.22" stopColor="#f3d06a" />
          <stop offset="0.45" stopColor="#c08a1e" />
          <stop offset="0.68" stopColor="#fbe7a0" />
          <stop offset="1" stopColor="#a87416" />
        </linearGradient>
        <linearGradient id={id("goldText")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff0a8" />
          <stop offset="0.3" stopColor="#f0bf3f" />
          <stop offset="0.52" stopColor="#b8770f" />
          <stop offset="0.7" stopColor="#e9b53a" />
          <stop offset="1" stopColor="#8f5a08" />
        </linearGradient>
        <linearGradient id={id("green")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f8a3d" />
          <stop offset="1" stopColor="#0e5a22" />
        </linearGradient>
        <radialGradient id={id("paper")} cx="50%" cy="46%" r="70%">
          <stop offset="0" stopColor="#fffefb" />
          <stop offset="0.7" stopColor="#fdf9ef" />
          <stop offset="1" stopColor="#f8efd8" />
        </radialGradient>
        <radialGradient id={id("medal")} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#fff3b8" />
          <stop offset="0.45" stopColor="#f0c552" />
          <stop offset="1" stopColor="#b47b14" />
        </radialGradient>
        <filter id={id("lift")} x="-5%" y="-20%" width="110%" height="150%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.2" floodColor="#5a3a05" floodOpacity="0.38" />
        </filter>
        <filter id={id("soft")} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#3a2a05" floodOpacity="0.3" />
        </filter>

        {/* Woven green border */}
        <pattern id={id("weave")} width="46" height="34" patternUnits="userSpaceOnUse">
          <rect width="46" height="34" fill="#1e7a34" />
          <path d="M-2 6 L 11.5 28 L 23 6 L 34.5 28 L 48 6 V 34 H -2 Z" fill="#11612a" />
          <path d="M-2 6 L 11.5 28 L 23 6 L 34.5 28 L 48 6" fill="none" stroke="#a8de7a" strokeWidth="2.6" strokeLinejoin="round" />
          <path d="M-2 -6 L 11.5 16 L 23 -6 L 34.5 16 L 48 -6" fill="none" stroke="#5cb857" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M-2 18 L 11.5 40 L 23 18 L 34.5 40 L 48 18" fill="none" stroke="#3f9a45" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="11.5" cy="2" r="3.2" fill="#f4f2c4" />
          <circle cx="34.5" cy="2" r="3.2" fill="#f4f2c4" />
        </pattern>

        <clipPath id={id("logoClip")}>
          <circle cx={640} cy={104} r={97} />
        </clipPath>
        <clipPath id={id("tableClip")}>
          <rect x={107} y={605} width={1066} height={72} rx={7} />
        </clipPath>
        <clipPath id={id("qrClip")}>
          <rect x={QR.x + 2} y={QR.y + 2} width={QR.w - 4} height={QR.h - 4} rx={8} />
        </clipPath>
      </defs>

      {/* ---------- Border ---------- */}
      <rect width={CERT_W} height={CERT_H} fill="#1e7a34" />
      {/* One strip, placed four times so the weave always faces outwards. */}
      <rect x={0} y={0} width={CERT_W} height={34} fill={url("weave")} />
      <rect x={0} y={0} width={CERT_W} height={34} fill={url("weave")} transform={`translate(0 ${CERT_H}) scale(1 -1)`} />
      <rect x={0} y={0} width={CERT_H} height={34} fill={url("weave")} transform={`translate(0 ${CERT_H}) rotate(-90)`} />
      <rect x={0} y={0} width={CERT_H} height={34} fill={url("weave")} transform={`translate(${CERT_W} 0) rotate(90)`} />
      {[
        [0, 0],
        [CERT_W - 34, 0],
        [0, CERT_H - 34],
        [CERT_W - 34, CERT_H - 34],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width={34} height={34} fill="#11612a" />
          <path d={`M${x + 17} ${y + 5} L${x + 29} ${y + 17} L${x + 17} ${y + 29} L${x + 5} ${y + 17} Z`} fill="#a8de7a" />
          <circle cx={x + 17} cy={y + 17} r={4} fill="#f4f2c4" />
        </g>
      ))}

      {/* ---------- Paper and gold frames ---------- */}
      <rect x={30} y={30} width={CERT_W - 60} height={CERT_H - 60} fill="#f1e9a6" />
      <rect x={35} y={35} width={CERT_W - 70} height={CERT_H - 70} fill={url("paper")} stroke={gold} strokeWidth={5} />
      <rect x={41} y={41} width={CERT_W - 82} height={CERT_H - 82} fill="none" stroke="#8a5d10" strokeWidth={0.8} />
      <rect x={52} y={52} width={CERT_W - 104} height={CERT_H - 104} fill="none" stroke={gold} strokeWidth={1.6} />

      <Corner gold={gold} transform="translate(44 44)" />
      <Corner gold={gold} transform={`translate(${CERT_W - 44} 44) scale(-1 1)`} />
      <Corner gold={gold} transform={`translate(44 ${CERT_H - 44}) scale(1 -1)`} />
      <Corner gold={gold} transform={`translate(${CERT_W - 44} ${CERT_H - 44}) scale(-1 -1)`} />

      {/* ---------- Crest ---------- */}
      <g filter={url("soft")}>
        <circle cx={640} cy={104} r={102} fill={gold} />
        <circle cx={640} cy={104} r={98} fill="#fffdf5" />
      </g>
      <image
        href={logoSrc}
        x={543}
        y={7}
        width={194}
        height={194}
        preserveAspectRatio="xMidYMid meet"
        clipPath={url("logoClip")}
      />

      {/* ---------- Heading ---------- */}
      <text x={640} y={244} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={31} fill={INK} textLength={782} lengthAdjust="spacingAndGlyphs">
        {LICENCE_AUTHORITY.toUpperCase()}
      </text>
      <text x={640} y={272} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={19.5} fill={INK} textLength={738} lengthAdjust="spacingAndGlyphs">
        {LICENCE_DEPARTMENT.toUpperCase()}
      </text>
      <path d="M228 289 H 604 M 676 289 H 1052" stroke={RULE_GOLD} strokeWidth={2} />
      <Knot x={640} y={289} gold={gold} />

      <text
        x={640}
        y={365}
        textAnchor="middle"
        fontFamily={SERIF}
        fontWeight={700}
        fontSize={85}
        fill={url("goldText")}
        stroke="#5e3a06"
        strokeWidth={1.6}
        paintOrder="stroke"
        filter={url("lift")}
        textLength={912}
        lengthAdjust="spacingAndGlyphs"
      >
        {LICENCE_TITLE.toUpperCase()}
      </text>

      <path d="M246 386 H 318 M 962 386 H 1034" stroke={RULE_GOLD} strokeWidth={2} />
      <text x={640} y={395} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={24} fill={INK} textLength={616} lengthAdjust="spacingAndGlyphs">
        {LICENCE_CATEGORY.toUpperCase()}
      </text>

      {/* ---------- Body ---------- */}
      <text x={640} y={434} textAnchor="middle" fontFamily={SERIF} fontSize={20.5} fill={INK}>
        This is to certify that
      </text>

      {lines.length === 1 ? (
        <text ref={nameRef0} x={640} y={490 - (46 - size) * 0.3} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={size} fill={GREEN_INK} letterSpacing={size > 34 ? 1 : 0.4}>
          {lines[0]}
        </text>
      ) : (
        <>
          <text ref={nameRef0} x={640} y={470} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={size} fill={GREEN_INK} letterSpacing={0.3}>
            {lines[0]}
          </text>
          <text ref={nameRef1} x={640} y={470 + size * 1.14} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={size} fill={GREEN_INK} letterSpacing={0.3}>
            {lines[1]}
          </text>
        </>
      )}
      <path d="M438 521 H 842" stroke={INK} strokeWidth={1.6} />

      <text x={640} y={557} textAnchor="middle" fontFamily={SERIF} fontSize={20.5} fill={INK}>
        {LICENCE_STATEMENT[0]}
      </text>
      <text x={640} y={585} textAnchor="middle" fontFamily={SERIF} fontSize={20.5} fill={INK}>
        {LICENCE_STATEMENT[1]}
      </text>

      {/* ---------- Licence number and date ---------- */}
      <rect x={105} y={603} width={1070} height={76} rx={9} fill="#ffffff" stroke={gold} strokeWidth={3} />
      <g clipPath={url("tableClip")}>
        <rect x={107} y={605} width={1066} height={31} fill={url("green")} />
      </g>
      <path d="M640 605 V 677" stroke="#b98a22" strokeWidth={1.4} />
      <path d="M107 636 H 1173" stroke="#b98a22" strokeWidth={1} />
      <text x={372} y={628} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={21} fill="#fdf3ae">
        Licence No.:
      </text>
      <text x={908} y={628} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={21} fill="#ffffff">
        Date of Issue:
      </text>
      <text ref={numberRef} x={372} y={668} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={32} fill={GREEN_INK} letterSpacing={0.5}>
        {number}
      </text>
      <text ref={dateRef} x={908} y={668} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={32} fill={GREEN_INK} letterSpacing={0.5}>
        {date}
      </text>

      {/* ---------- Seal ---------- */}
      <g>
        <path d="M152 814 L 138 860 L 158 852 L 172 866 L 186 822 Z" fill={url("green")} stroke="#0b4a1b" strokeWidth={1} />
        <path d="M224 814 L 238 860 L 218 852 L 204 866 L 190 822 Z" fill={url("green")} stroke="#0b4a1b" strokeWidth={1} />
        <g filter={url("soft")}>
          <polygon points={starPoints(188, 770, 76, 67, 30)} fill={url("medal")} stroke="#946410" strokeWidth={1} />
        </g>
        <circle cx={188} cy={770} r={60} fill={url("medal")} stroke="#8a5d10" strokeWidth={1.4} />
        <circle cx={188} cy={770} r={53} fill="none" stroke="#fff3b8" strokeWidth={1.4} />
        <circle cx={188} cy={770} r={50} fill="none" stroke="#8a5d10" strokeWidth={0.8} />
        <polygon points={starPoints(188, 739, 7, 2.9, 5)} fill="#6d4708" />
        <polygon points={starPoints(188, 803, 7, 2.9, 5)} fill="#6d4708" />
        <path d="M150 758 H 226 M 150 786 H 226" stroke="#6d4708" strokeWidth={1.1} />
        <text x={188} y={781} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={27} fill="#2a1a02" letterSpacing={1}>
          DOAS
        </text>
      </g>

      {/* ---------- Signature ---------- */}
      <path d="M466 749 H 816" stroke={INK} strokeWidth={1.5} />
      <text x={640} y={771} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={17.5} fill={INK}>
        {LICENCE_SIGNATORY}
      </text>
      <text x={640} y={792} textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontSize={13.5} fill={INK}>
        {LICENCE_SIGNATORY_NOTE}
      </text>
      <path d="M924 716 V 800" stroke={RULE_GOLD} strokeWidth={2} />

      {/* ---------- Scan to verify ---------- */}
      <rect x={QR.x} y={QR.y} width={QR.w} height={QR.h} rx={10} fill="#ffffff" stroke={url("green")} strokeWidth={3} />
      <g clipPath={url("qrClip")}>
        <rect x={QR.x} y={QR.y + QR.h - QR.footer} width={QR.w} height={QR.footer} fill={url("green")} />
      </g>
      {qr ? (
        <g transform={`translate(${qrX} ${qrY}) scale(${qrSize / qr.size})`} shapeRendering="crispEdges">
          <path d={qr.d} fill="#000000" />
        </g>
      ) : (
        <g>
          <rect x={qrX} y={qrY} width={qrSize} height={qrSize} fill="#f1f1ee" stroke="#c9c9c2" strokeDasharray="5 4" />
          <text x={QR.x + QR.w / 2} y={qrY + qrSize / 2 - 2} textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize={12} fontWeight={700} fill="#77776f">
            QR CODE
          </text>
          <text x={QR.x + QR.w / 2} y={qrY + qrSize / 2 + 14} textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize={9.5} fill="#77776f">
            added when generated
          </text>
        </g>
      )}
      <text x={QR.x + QR.w / 2} y={QR.y + QR.h - 9} textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight={700} fontSize={12.5} fill="#ffffff" letterSpacing={0.6}>
        SCAN TO VERIFY
      </text>

      {/* ---------- Foot ---------- */}
      <path d="M336 816 H 606 M 674 816 H 944" stroke={RULE_GOLD} strokeWidth={1.6} />
      <Knot x={640} y={816} gold={gold} scale={0.8} />
      <text x={640} y={838} textAnchor="middle" fontFamily={SERIF} fontSize={13} fill={INK}>
        {LICENCE_FOOTNOTE}
      </text>
      {code && !preview ? (
        <text x={640} y={851.5} textAnchor="middle" fontFamily="'Courier New', Courier, monospace" fontSize={9.5} fill="#5d5a50" letterSpacing={0.4}>
          Verification code: {code}
        </text>
      ) : null}

      {/* ---------- Overlays ---------- */}
      {preview ? (
        <text
          x={640}
          y={470}
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontWeight={700}
          fontSize={120}
          fill="#1b1b1b"
          fillOpacity={0.07}
          transform="rotate(-22 640 452)"
          letterSpacing={10}
        >
          PREVIEW
        </text>
      ) : null}
      {revoked ? (
        <g transform="rotate(-20 640 452)">
          <rect x={330} y={380} width={620} height={150} rx={14} fill="#ffffff" fillOpacity={0.55} stroke="#c81e1e" strokeWidth={8} />
          <text x={640} y={492} textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight={900} fontSize={112} fill="#c81e1e" fillOpacity={0.82} letterSpacing={8}>
            REVOKED
          </text>
        </g>
      ) : null}
    </svg>
  )
}

/* ------------------------------------------------------------------ *
 * Saving the certificate as an image
 * ------------------------------------------------------------------ */

/** Loads the crest as a data URL so the certificate is self-contained when exported. */
export function useInlineLogo(src: string = LICENCE_LOGO) {
  const [data, setData] = React.useState<string>(src)
  React.useEffect(() => {
    let cancelled = false
    setData(src)
    if (src.startsWith("data:")) return
    fetch(src)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error("logo"))))
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(blob)
          }),
      )
      .then((url) => !cancelled && setData(url))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [src])
  return data
}

/** Renders the on-screen certificate to a PNG (2560 × 1810 by default) and downloads it. */
export async function downloadCertificatePng(svg: SVGSVGElement, fileName: string, scale = 2) {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute("width", String(CERT_W))
  clone.setAttribute("height", String(CERT_H))
  clone.removeAttribute("class")
  clone.removeAttribute("style")
  const markup = new XMLSerializer().serializeToString(clone)
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("The certificate could not be drawn. Use Print / save PDF instead."))
    img.src = source
  })

  const canvas = document.createElement("canvas")
  canvas.width = CERT_W * scale
  canvas.height = CERT_H * scale
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("This browser cannot export images. Use Print / save PDF instead.")
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
  if (!blob) throw new Error("The image could not be saved. Use Print / save PDF instead.")
  const href = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = href
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 4000)
}

export function licenceFileName(holderName: string, licenceNumber: string) {
  const safe = `${holderName} ${licenceNumber}`.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return `DOAS-Practising-Licence-${safe || "certificate"}.png`
}

/* ------------------------------------------------------------------ *
 * Full-page view — /documents/{code}
 * ------------------------------------------------------------------ */

/** Prints one A4 landscape page, edge to edge, with nothing else on it. */
const PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
  .licence-screen-only { display: none !important; }
  .licence-page { min-height: 0 !important; padding: 0 !important; background: #ffffff !important; }
  .licence-sheet { width: 297mm !important; max-width: none !important; height: 210mm !important; margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; overflow: hidden !important; break-inside: avoid; page-break-inside: avoid; }
  .licence-sheet svg { width: 297mm !important; height: 210mm !important; }
}
`

export function LicencePage({ document: d }: { document: LicenceDocument }) {
  const svgRef = React.useRef<SVGSVGElement>(null)
  const logo = useInlineLogo()
  const [saving, setSaving] = React.useState(false)
  const [problem, setProblem] = React.useState("")
  const revoked = d.status === "revoked"

  const save = async () => {
    if (!svgRef.current || saving) return
    setSaving(true)
    setProblem("")
    try {
      await downloadCertificatePng(svgRef.current, licenceFileName(d.holderName, d.licenceNumber))
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "The image could not be saved.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="licence-page min-h-screen bg-neutral-100 px-3 py-6 sm:py-8">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="licence-screen-only mx-auto mb-4 flex max-w-[1120px] flex-wrap items-center justify-between gap-3">
        <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${revoked ? "text-red-700" : "text-emerald-800"}`}>
          {revoked ? <ShieldAlert className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
          {revoked ? "This licence has been revoked" : "Genuine DOAS practising licence"}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-800 bg-white px-3 py-2 text-[13px] font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download image
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2 text-[13px] font-semibold text-white hover:bg-emerald-900"
          >
            <Printer className="h-4 w-4" /> Print / save PDF
          </button>
        </div>
      </div>
      {problem ? <p className="licence-screen-only mx-auto mb-3 max-w-[1120px] text-[12.5px] text-red-700">{problem}</p> : null}

      <div className="licence-sheet mx-auto w-full max-w-[1120px] overflow-hidden bg-white shadow-lg">
        <LicenceCertificate
          svgRef={svgRef}
          logoSrc={logo}
          holderName={d.holderName}
          licenceNumber={d.licenceNumber}
          issueDate={d.issueDate}
          verifyUrl={licenceVerifyUrl(d.code)}
          code={d.code}
          status={d.status}
        />
      </div>

      <p className="licence-screen-only mx-auto mt-3 max-w-[1120px] text-center text-[12px] text-neutral-500">
        Prints on one A4 landscape page. In the print dialog choose A4, Landscape, margins None, and turn on background graphics.
      </p>
    </div>
  )
}
