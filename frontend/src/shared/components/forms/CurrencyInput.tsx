import { forwardRef, useEffect, useRef, useState } from 'react'
import type { InputHTMLAttributes } from 'react'

type CurrencyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number | null | undefined
  onChange: (value: number | null) => void
}

const numberFormatter = new Intl.NumberFormat('es-CR', {
  useGrouping: true,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function displayValue(value: number | null | undefined): string {
  return value == null ? '' : numberFormatter.format(value)
}

function parseInput(input: string): { value: number | null; text: string } {
  const cleaned = input.replace(/[^\d.,\s]/g, '').replace(/\s/g, '')
  if (!cleaned) return { value: null, text: '' }

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  const dotParts = cleaned.split('.')
  const dotIsGrouping = lastComma < 0 && dotParts.length > 2 && dotParts.slice(1).every((part) => part.length === 3)
  const separatorIndex = lastComma >= 0 ? lastComma : dotIsGrouping ? -1 : lastDot
  const trailingDigits = separatorIndex < 0 ? '' : cleaned.slice(separatorIndex + 1)
  const isDecimal = separatorIndex >= 0 && (lastComma >= 0 || trailingDigits.length <= 2)
  const integerPart = separatorIndex >= 0 && isDecimal ? cleaned.slice(0, separatorIndex) : cleaned
  const decimalPart = separatorIndex >= 0 && isDecimal ? trailingDigits : ''
  const digits = integerPart.replace(/[.,]/g, '')
  if (!digits) return { value: null, text: '' }

  const value = Number(`${digits}.${decimalPart}`)
  if (!Number.isFinite(value) || decimalPart.length > 2) return { value: null, text: '' }

  const formattedInteger = numberFormatter.format(Number(digits))
  return { value, text: `${formattedInteger}${isDecimal ? `,${decimalPart}` : ''}` }
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput(
  { value, onChange, onBlur, onFocus, className, ...props },
  forwardedRef,
) {
  const [text, setText] = useState(() => displayValue(value))
  const focused = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const setInputRef = (node: HTMLInputElement | null) => {
    inputRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }

  useEffect(() => {
    if (!focused.current) setText(displayValue(value))
  }, [value])

  return <span className="currency-input">
    <span className="currency-input-prefix" aria-hidden="true">₡</span>
    <input
      {...props}
      ref={setInputRef}
      className={className}
      value={text}
      onFocus={(event) => { focused.current = true; onFocus?.(event) }}
      onChange={(event) => {
        const caret = event.target.selectionStart ?? event.target.value.length
        const digitsBeforeCaret = event.target.value.slice(0, caret).replace(/\D/g, '').length
        const parsed = parseInput(event.target.value)
        setText(parsed.text)
        onChange(parsed.value)
        requestAnimationFrame(() => {
          const input = inputRef.current
          if (!input || document.activeElement !== input) return
          if (caret === event.target.value.length) input.setSelectionRange(parsed.text.length, parsed.text.length)
          else {
            let seen = 0
            let position = 0
            while (position < parsed.text.length && seen < digitsBeforeCaret) {
              if (/\d/.test(parsed.text[position])) seen += 1
              position += 1
            }
            input.setSelectionRange(position, position)
          }
        })
      }}
      onBlur={(event) => {
        focused.current = false
        const parsed = parseInput(text)
        setText(parsed.value == null ? '' : displayValue(parsed.value))
        onChange(parsed.value)
        onBlur?.(event)
      }}
    />
  </span>
})
