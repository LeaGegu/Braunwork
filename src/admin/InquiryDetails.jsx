import { useState } from 'react'
import {
  formatInquiryDate,
  formatInquiryMessageType,
  formatInquiryStatus,
  inquiryStatuses,
  submitInternalNote,
  updateInquiryAssignment,
  updateInquiryStatus,
} from './inquiryList.js'

function InquiryDetails({
  inquiry,
  messages,
  currentUserId,
  onBack,
  onAssignmentUpdated,
  onNoteAdded,
  onStatusUpdated,
  request,
}) {
  const [noteBody, setNoteBody] = useState('')
  const [isSubmittingNote, setIsSubmittingNote] = useState(false)
  const [noteError, setNoteError] = useState('')
  const [selectedStatus, setSelectedStatus] = useState(inquiry.status)
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [statusSuccess, setStatusSuccess] = useState('')
  const [isUpdatingAssignment, setIsUpdatingAssignment] = useState(false)
  const [assignmentError, setAssignmentError] = useState('')
  const [assignmentSuccess, setAssignmentSuccess] = useState('')

  const handleSubmitNote = async (event) => {
    event.preventDefault()
    if (isSubmittingNote || !noteBody.trim()) {
      return
    }

    setIsSubmittingNote(true)
    setNoteError('')
    try {
      await submitInternalNote(request, inquiry.id, noteBody)
      setNoteBody('')
      await onNoteAdded()
    } catch (error) {
      setNoteError(error.message)
    } finally {
      setIsSubmittingNote(false)
    }
  }

  const handleSaveStatus = async (event) => {
    event.preventDefault()
    if (isSavingStatus || selectedStatus === inquiry.status) {
      return
    }

    setIsSavingStatus(true)
    setStatusError('')
    setStatusSuccess('')
    try {
      const updatedInquiry = await updateInquiryStatus(
        request,
        inquiry.id,
        selectedStatus,
      )
      onStatusUpdated(updatedInquiry)
      setStatusSuccess('Inquiry status updated successfully.')
    } catch (error) {
      setStatusError(error.message)
    } finally {
      setIsSavingStatus(false)
    }
  }

  const handleAssignment = async (assignedTo) => {
    if (isUpdatingAssignment) {
      return
    }

    setIsUpdatingAssignment(true)
    setAssignmentError('')
    setAssignmentSuccess('')
    try {
      const updatedInquiry = await updateInquiryAssignment(
        request,
        inquiry.id,
        assignedTo,
      )
      await onAssignmentUpdated(updatedInquiry)
      setAssignmentSuccess(
        assignedTo === null
          ? 'Inquiry unassigned successfully.'
          : 'Inquiry assigned to you.',
      )
    } catch (error) {
      setAssignmentError(error.message)
    } finally {
      setIsUpdatingAssignment(false)
    }
  }

  return (
    <section
      aria-labelledby="inquiry-details-heading"
      className="mt-8 border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-soft)]"
    >
      <div className="flex flex-col gap-4 border-b border-[var(--line)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <button
            className="mb-3 inline-flex items-center gap-2 text-xs font-medium text-[var(--brown)] hover:text-[var(--charcoal)]"
            onClick={onBack}
            type="button"
          >
            <span aria-hidden="true">←</span>
            Back to inquiries
          </button>
          <p className="eyebrow">Inquiry details</p>
          <h2
            className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl"
            id="inquiry-details-heading"
          >
            {inquiry.subject}
          </h2>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className="w-fit border border-[var(--line)] bg-[var(--bg-ivory)] px-3 py-1.5 text-xs font-medium text-[var(--brown)]">
            Current: {formatInquiryStatus(inquiry.status)}
          </span>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={handleSaveStatus}
          >
            <label className="sr-only" htmlFor="inquiry-status">
              Select inquiry status
            </label>
            <select
              className="min-h-10 border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--charcoal)]"
              disabled={isSavingStatus}
              id="inquiry-status"
              onChange={(event) => {
                setSelectedStatus(event.target.value)
                setStatusError('')
                setStatusSuccess('')
              }}
              value={selectedStatus}
            >
              {inquiryStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatInquiryStatus(status)}
                </option>
              ))}
            </select>
            <button
              className="min-h-10 border border-[var(--brown)] bg-[var(--brown)] px-3 py-2 text-xs font-medium text-[var(--bg-ivory)] hover:bg-[var(--charcoal)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSavingStatus || selectedStatus === inquiry.status}
              type="submit"
            >
              {isSavingStatus ? 'Saving…' : 'Save status'}
            </button>
          </form>
          {statusError && (
            <p className="text-xs text-[var(--brown)]" role="alert">
              {statusError}
            </p>
          )}
          {statusSuccess && (
            <p className="text-xs text-[var(--brown)]" role="status">
              {statusSuccess}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section aria-labelledby="customer-details-heading">
          <section
            aria-labelledby="inquiry-assignment-heading"
            className="mb-6 border border-[var(--line)] bg-[var(--bg-warm)] p-4 sm:p-5"
          >
            <h3
              className="text-sm font-semibold"
              id="inquiry-assignment-heading"
            >
              Assignment
            </h3>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {inquiry.assigned_to === null ||
              inquiry.assigned_to === undefined ? (
                <>
                  <p className="text-sm text-[var(--muted)]">Unassigned</p>
                  <button
                    className="w-fit border border-[var(--brown)] bg-[var(--brown)] px-4 py-2 text-xs font-medium text-[var(--bg-ivory)] hover:bg-[var(--charcoal)] disabled:cursor-wait disabled:opacity-50"
                    disabled={isUpdatingAssignment}
                    onClick={() => handleAssignment(currentUserId)}
                    type="button"
                  >
                    {isUpdatingAssignment ? 'Assigning…' : 'Assign to Me'}
                  </button>
                </>
              ) : inquiry.assigned_to === currentUserId ? (
                <>
                  <p className="text-sm font-medium text-[var(--brown)]">
                    Assigned to You
                  </p>
                  <button
                    className="w-fit border border-[var(--taupe)] px-4 py-2 text-xs font-medium text-[var(--brown)] hover:bg-[var(--panel)] disabled:cursor-wait disabled:opacity-50"
                    disabled={isUpdatingAssignment}
                    onClick={() => handleAssignment(null)}
                    type="button"
                  >
                    {isUpdatingAssignment ? 'Unassigning…' : 'Unassign'}
                  </button>
                </>
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  Assigned to another staff member
                </p>
              )}
            </div>
            {assignmentError && (
              <p className="mt-3 text-xs text-[var(--brown)]" role="alert">
                {assignmentError}
              </p>
            )}
            {assignmentSuccess && (
              <p className="mt-3 text-xs text-[var(--brown)]" role="status">
                {assignmentSuccess}
              </p>
            )}
          </section>
          <h3
            className="text-sm font-semibold"
            id="customer-details-heading"
          >
            Customer and submission
          </h3>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <dt className="text-xs text-[var(--muted)]">Full name</dt>
              <dd className="mt-1 break-words text-sm font-medium">
                {inquiry.name}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Email address</dt>
              <dd className="mt-1 break-all text-sm">
                <a
                  className="text-[var(--brown)] underline decoration-[var(--taupe)] underline-offset-2"
                  href={`mailto:${inquiry.email}`}
                >
                  {inquiry.email}
                </a>
              </dd>
            </div>
            {inquiry.phone && (
              <div>
                <dt className="text-xs text-[var(--muted)]">Phone number</dt>
                <dd className="mt-1 break-words text-sm">
                  <a
                    className="text-[var(--brown)] underline decoration-[var(--taupe)] underline-offset-2"
                    href={`tel:${inquiry.phone}`}
                  >
                    {inquiry.phone}
                  </a>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-[var(--muted)]">Category</dt>
              <dd className="mt-1 text-sm">{inquiry.category}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Submitted</dt>
              <dd className="mt-1 text-sm">
                {formatInquiryDate(inquiry.created_at)}
              </dd>
            </div>
          </dl>

          <div className="mt-7 border-t border-[var(--line)] pt-5">
            <h3 className="text-sm font-semibold">Original message</h3>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[var(--muted)]">
              {inquiry.message}
            </p>
          </div>
        </section>

        <section aria-labelledby="inquiry-conversation-heading">
          <div className="flex items-center justify-between gap-3">
            <h3
              className="text-sm font-semibold"
              id="inquiry-conversation-heading"
            >
              Messages and internal notes
            </h3>
            <span className="text-xs text-[var(--muted)]">
              {messages.length} {messages.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <form
            className="mt-4 border border-[var(--taupe)] bg-[var(--bg-warm)] p-4 sm:p-5"
            onSubmit={handleSubmitNote}
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <label
                className="text-sm font-semibold"
                htmlFor="inquiry-internal-note"
              >
                Add an internal note
              </label>
              <span className="w-fit border border-[var(--taupe)] px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--brown)]">
                Private · staff only
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              This note is for your team and will not be sent to the customer.
            </p>
            <textarea
              className="mt-3 min-h-28 w-full resize-y border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm leading-6 text-[var(--charcoal)] placeholder:text-[var(--muted)]"
              disabled={isSubmittingNote}
              id="inquiry-internal-note"
              maxLength={10000}
              onChange={(event) => {
                setNoteBody(event.target.value)
                if (noteError) setNoteError('')
              }}
              placeholder="Write a private note for your team…"
              value={noteBody}
            />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {noteError ? (
                <p className="text-xs text-[var(--brown)]" role="alert">
                  {noteError}
                </p>
              ) : (
                <span className="text-xs text-[var(--muted)]">
                  {noteBody.length}/10000
                </span>
              )}
              <button
                className="w-fit border border-[var(--brown)] bg-[var(--brown)] px-4 py-2 text-xs font-medium text-[var(--bg-ivory)] hover:bg-[var(--charcoal)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmittingNote || !noteBody.trim()}
                type="submit"
              >
                {isSubmittingNote ? 'Adding note…' : 'Add Note'}
              </button>
            </div>
          </form>
          {messages.length === 0 ? (
            <p className="mt-4 border border-dashed border-[var(--taupe)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              No associated messages or internal notes.
            </p>
          ) : (
            <ol className="mt-4 space-y-3">
              {messages.map((message) => {
                const isInternalNote = message.message_type === 'internal_note'
                return (
                  <li
                    className={`border p-4 ${
                      isInternalNote
                        ? 'border-[var(--taupe)] bg-[var(--bg-warm)]'
                        : 'border-[var(--line)] bg-[var(--bg-ivory)]'
                    }`}
                    key={message.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--brown)]">
                        {formatInquiryMessageType(message.message_type)}
                      </span>
                      <time
                        className="text-xs text-[var(--muted)]"
                        dateTime={message.created_at}
                      >
                        {formatInquiryDate(message.created_at)}
                      </time>
                    </div>
                    {message.sender_email && (
                      <p className="mt-2 break-all text-xs text-[var(--muted)]">
                        {message.sender_email}
                      </p>
                    )}
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">
                      {message.body}
                    </p>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>
    </section>
  )
}

export default InquiryDetails
