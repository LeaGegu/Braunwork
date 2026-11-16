import { useEffect, useId, useRef } from 'react'

function ConfirmationDialog({
  open,
  title,
  description,
  warning,
  error,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isProcessing = false,
  processingLabel = 'Working…',
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null)
  const confirmationInProgressRef = useRef(false)
  const dialogId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined

    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }

    return () => {
      if (dialog.open) dialog.close()
    }
  }, [open])

  const requestClose = () => {
    if (isProcessing) return
    onCancel()
    if (dialogRef.current?.open) dialogRef.current.close()
  }

  const handleCancel = (event) => {
    event.preventDefault()
    requestClose()
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      requestClose()
    }
  }

  const handleConfirm = async () => {
    if (isProcessing || confirmationInProgressRef.current) return
    confirmationInProgressRef.current = true
    try {
      await onConfirm()
    } finally {
      confirmationInProgressRef.current = false
    }
  }

  return (
    <dialog
      aria-describedby={`${dialogId}-description ${dialogId}-warning`}
      aria-labelledby={`${dialogId}-title`}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-0 text-[var(--charcoal)] shadow-[0_24px_70px_rgba(39,37,34,0.22)] backdrop:bg-[rgba(39,37,34,0.42)] backdrop:backdrop-blur-[2px]"
      onCancel={handleCancel}
      onKeyDown={handleKeyDown}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
      ref={dialogRef}
    >
      <div className="p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--taupe)] bg-[var(--bg-warm)] text-lg font-semibold text-[var(--brown)]"
          >
            !
          </span>
          <div className="min-w-0">
            <p className="eyebrow">Confirmation required</p>
            <h2
              className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl"
              id={`${dialogId}-title`}
            >
              {title}
            </h2>
            <p
              className="mt-3 break-words text-sm leading-6 text-[var(--muted)]"
              id={`${dialogId}-description`}
            >
              {description}
            </p>
          </div>
        </div>

        <p
          className="mt-5 rounded-lg border border-[var(--line)] bg-[var(--bg-warm)] px-4 py-3 text-sm text-[var(--charcoal)]"
          id={`${dialogId}-warning`}
        >
          {warning}
        </p>

        {error && (
          <p className="mt-4 text-sm text-[var(--brown)]" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            autoFocus
            className="min-h-11 rounded-lg border border-[var(--line)] px-5 text-sm font-medium hover:bg-[var(--bg-warm)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isProcessing}
            onClick={requestClose}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className="min-h-11 rounded-lg bg-[#8f3428] px-5 text-sm font-semibold text-white hover:bg-[#76291f] disabled:cursor-wait disabled:opacity-60"
            disabled={isProcessing}
            onClick={handleConfirm}
            type="button"
          >
            {isProcessing ? processingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}

export default ConfirmationDialog
