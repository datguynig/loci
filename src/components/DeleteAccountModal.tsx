import { useState, useRef, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { deleteAccount } from '../services/accountService'
import type { GetToken } from '../services/storageService'

interface DeleteAccountModalProps {
  supabase: SupabaseClient
  getStorageToken: GetToken
  onClose: () => void
}

const CONFIRM_WORD = 'DELETE'

export default function DeleteAccountModal({ supabase, getStorageToken, onClose }: DeleteAccountModalProps) {
  const { user } = useUser()
  const [confirmText, setConfirmText] = useState('')
  const [status, setStatus] = useState<'idle' | 'deleting' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const isConfirmed = confirmText === CONFIRM_WORD
  const isDeleting = status === 'deleting'

  // Focus input on open
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isDeleting, onClose])

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current && !isDeleting) onClose()
  }

  const handleDelete = async () => {
    if (!user || !isConfirmed || isDeleting) return
    setStatus('deleting')
    setErrorMsg('')
    try {
      await deleteAccount(supabase, getStorageToken, user.id, user)
      // deleteAccount calls clerkUser.delete() which signs the user out automatically.
      // No further action needed — the app will re-render to the signed-out state.
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.')
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdrop}
      role="dialog"
      aria-modal
      aria-labelledby="delete-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '28px 28px 24px',
        width: '100%',
        maxWidth: 420,
        boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
          <div style={{
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(220, 38, 38, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h2
              id="delete-modal-title"
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: '0 0 4px',
              }}
            >
              Delete your account
            </h2>
            <p style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 13,
              color: 'var(--text-secondary)',
              margin: 0,
              lineHeight: 1.5,
            }}>
              This is permanent. Your library, annotations, notes, flashcards, and all other data
              will be deleted and cannot be recovered.
            </p>
          </div>
        </div>

        {/* Confirm input */}
        <label style={{
          display: 'block',
          fontFamily: 'var(--font-ui)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginBottom: 6,
        }}>
          Type <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)', letterSpacing: '0.05em' }}>{CONFIRM_WORD}</strong> to confirm
        </label>
        <input
          ref={inputRef}
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          disabled={isDeleting}
          placeholder={CONFIRM_WORD}
          autoComplete="off"
          spellCheck={false}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            fontFamily: 'monospace',
            fontSize: 14,
            letterSpacing: '0.05em',
            padding: '9px 12px',
            border: `1.5px solid ${isConfirmed ? '#DC2626' : 'var(--border)'}`,
            borderRadius: 8,
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            outline: 'none',
            transition: 'border-color 150ms ease',
            marginBottom: 18,
          }}
        />

        {/* Error message */}
        {status === 'error' && (
          <div style={{
            background: 'var(--error-bg)',
            border: '1px solid var(--error-border)',
            borderRadius: 8,
            padding: '8px 12px',
            fontFamily: 'var(--font-ui)',
            fontSize: 13,
            color: 'var(--error)',
            marginBottom: 16,
            lineHeight: 1.5,
          }}>
            {errorMsg}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={isDeleting}
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 13,
              fontWeight: 500,
              padding: '8px 18px',
              border: '1.5px solid var(--border)',
              borderRadius: 8,
              background: 'transparent',
              color: 'var(--text-primary)',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 18px',
              border: 'none',
              borderRadius: 8,
              background: isConfirmed ? '#DC2626' : 'var(--bg-secondary)',
              color: isConfirmed ? '#fff' : 'var(--text-tertiary)',
              cursor: !isConfirmed || isDeleting ? 'not-allowed' : 'pointer',
              transition: 'background 150ms ease, color 150ms ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {isDeleting ? (
              <>
                <span style={{
                  width: 12,
                  height: 12,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid #fff',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                  display: 'inline-block',
                }} />
                Deleting…
              </>
            ) : (
              'Delete account'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
