import { useId, useState } from 'react'
import ConfirmationDialog from '../components/ConfirmationDialog.jsx'
import {
  formatInquiryDateTime,
  formatInquiryMessageType,
  formatInquiryStatus,
  inquiryStatuses,
  submitInternalNote,
  updateInquiryAssignment,
  updateInquiryFollowUp,
  updateInquiryStatus,
} from './inquiryList.js'

const inquiryTabs = [
  { id: 'conversation', label: 'Conversation' },
  { id: 'follow-up', label: 'Follow-up' },
  { id: 'activity', label: 'Activity' },
]

function formatLocalDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

function formatActivityTitle(type) {
  const labels = {
    status_changed: 'Status changed',
    assignment_changed: 'Assignment changed',
    follow_up_created: 'Follow-up scheduled',
    follow_up_updated: 'Follow-up updated',
    follow_up_removed: 'Follow-up removed',
  }
  return labels[type] ?? formatInquiryStatus(type)
}

function formatActivityValue(activity, value, assignees) {
  if (value === null || value === undefined) return 'None'
  if (activity.activity_type === 'status_changed') {
    return formatInquiryStatus(value)
  }
  if (activity.activity_type === 'assignment_changed') {
    if (!value) return 'Unassigned'
    return assignees.find((assignee) => assignee.id === value)?.full_name ??
      'Staff member'
  }
  if (typeof value === 'object') {
    const date = value.follow_up_at
      ? formatInquiryDateTime(value.follow_up_at)
      : 'No date'
    return `${date}${value.follow_up_note ? ` · ${value.follow_up_note}` : ''}`
  }
  return String(value)
}

function getMessageAuthor(
  message,
  assignees,
  currentUserId,
  isInternalNote,
  currentUserName,
) {
  if (message.sender_id === currentUserId) {
    return isInternalNote ? currentUserName || 'You' : 'You'
  }

  return assignees.find((assignee) => assignee.id === message.sender_id)
    ?.full_name ??
    message.sender_email ??
    (isInternalNote ? 'Staff member' : 'Customer')
}

function InternalNoteEntry({ message, author }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const bodyId = useId()
  const isLong = message.body.length > 500 ||
    message.body.split(/\r?\n/).length > 6

  return (
    <li className="rounded-xl border border-[var(--line)] border-l-4 border-l-[var(--taupe)] bg-[var(--panel)] p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="break-words text-sm font-semibold">{author}</span>
          <span className="rounded-full bg-[var(--panel-strong)] px-2.5 py-1 text-[0.68rem] font-medium text-[var(--brown)]">
            Internal note
          </span>
        </div>
        <time
          className="text-xs text-[var(--muted)] sm:text-right"
          dateTime={message.created_at}
        >
          {formatInquiryDateTime(message.created_at)}
        </time>
      </div>
      <p
        className={`mt-3 whitespace-pre-wrap text-sm leading-7 [overflow-wrap:anywhere] ${
          isLong && !isExpanded ? 'line-clamp-6' : ''
        }`}
        id={bodyId}
      >
        {message.body}
      </p>
      {isLong && (
        <button
          aria-controls={bodyId}
          aria-expanded={isExpanded}
          className="mt-2 text-sm font-medium text-[var(--brown)] underline underline-offset-4 hover:text-[var(--charcoal)]"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          type="button"
        >
          {isExpanded ? 'Show less' : 'See more'}
        </button>
      )}
    </li>
  )
}

function InquiryDetails({
  activities = [],
  assignees = [],
  inquiry,
  messages,
  currentUserId,
  currentUserName,
  onBack,
  onAssignmentUpdated,
  onFollowUpUpdated,
  onNoteAdded,
  onRefresh,
  onStatusUpdated,
  request,
}) {
  const [activeTab, setActiveTab] = useState('conversation')
  const [noteBody, setNoteBody] = useState('')
  const [isSubmittingNote, setIsSubmittingNote] = useState(false)
  const [noteError, setNoteError] = useState('')
  const [selectedStatus, setSelectedStatus] = useState(inquiry.status)
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [selectedAssigneeId, setSelectedAssigneeId] = useState(
    inquiry.assigned_to ?? '',
  )
  const [isUpdatingAssignment, setIsUpdatingAssignment] = useState(false)
  const [assignmentError, setAssignmentError] = useState('')
  const [followUpAt, setFollowUpAt] = useState(
    formatLocalDateTime(inquiry.follow_up_at),
  )
  const [followUpNote, setFollowUpNote] = useState(inquiry.follow_up_note ?? '')
  const [isEditingFollowUp, setIsEditingFollowUp] = useState(false)
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false)
  const [followUpError, setFollowUpError] = useState('')
  const [followUpNotice, setFollowUpNotice] = useState('')
  const [isConfirmingFollowUpRemoval, setIsConfirmingFollowUpRemoval] =
    useState(false)

  const handleSubmitNote = async (event) => {
    event.preventDefault()
    if (isSubmittingNote || !noteBody.trim()) return

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
    if (isSavingStatus || selectedStatus === inquiry.status) return

    setIsSavingStatus(true)
    setStatusError('')
    try {
      const updatedInquiry = await updateInquiryStatus(
        request,
        inquiry.id,
        selectedStatus,
      )
      onStatusUpdated(updatedInquiry)
    } catch (error) {
      setStatusError(error.message)
    } finally {
      setIsSavingStatus(false)
    }
  }

  const handleAssignment = async (event) => {
    event.preventDefault()
    const assignedTo = selectedAssigneeId || null
    const expectedAssignedTo = inquiry.assigned_to ?? null
    if (isUpdatingAssignment || assignedTo === expectedAssignedTo) return

    setIsUpdatingAssignment(true)
    setAssignmentError('')
    try {
      const updatedInquiry = await updateInquiryAssignment(
        request,
        inquiry.id,
        assignedTo,
        expectedAssignedTo,
      )
      await onAssignmentUpdated(updatedInquiry)
    } catch (error) {
      setAssignmentError(error.message)
    } finally {
      setIsUpdatingAssignment(false)
    }
  }

  const openFollowUpForm = () => {
    setFollowUpAt(formatLocalDateTime(inquiry.follow_up_at))
    setFollowUpNote(inquiry.follow_up_note ?? '')
    setFollowUpError('')
    setFollowUpNotice('')
    setIsEditingFollowUp(true)
  }

  const handleSaveFollowUp = async (event) => {
    event.preventDefault()
    if (isSavingFollowUp || !followUpAt || !followUpNote.trim()) return

    setIsSavingFollowUp(true)
    setFollowUpError('')
    setFollowUpNotice('')
    try {
      const updatedInquiry = await updateInquiryFollowUp(
        request,
        inquiry.id,
        new Date(followUpAt).toISOString(),
        followUpNote.trim(),
      )
      await onFollowUpUpdated(updatedInquiry)
      setIsEditingFollowUp(false)
      setFollowUpNotice('Follow-up saved.')
    } catch (error) {
      setFollowUpError(error.message)
    } finally {
      setIsSavingFollowUp(false)
    }
  }

  const handleClearFollowUp = async () => {
    if (isSavingFollowUp) return

    setIsSavingFollowUp(true)
    setFollowUpError('')
    setFollowUpNotice('')
    try {
      const updatedInquiry = await updateInquiryFollowUp(
        request,
        inquiry.id,
        null,
        null,
      )
      await onFollowUpUpdated(updatedInquiry)
      setFollowUpAt('')
      setFollowUpNote('')
      setIsEditingFollowUp(false)
      setIsConfirmingFollowUpRemoval(false)
      setFollowUpNotice('Follow-up removed.')
    } catch (error) {
      setFollowUpError(error.message)
    } finally {
      setIsSavingFollowUp(false)
    }
  }

  const openFollowUpRemovalConfirmation = () => {
    setFollowUpError('')
    setFollowUpNotice('')
    setIsConfirmingFollowUpRemoval(true)
  }

  const cancelFollowUpRemoval = () => {
    if (isSavingFollowUp) return
    setIsConfirmingFollowUpRemoval(false)
    setFollowUpError('')
  }

  const activeAssignee = assignees.find(
    (assignee) => assignee.id === inquiry.assigned_to,
  )
  const internalNotes = messages.filter(
    (message) => message.message_type === 'internal_note',
  )
  const conversationMessages = messages.filter(
    (message) => message.message_type !== 'internal_note',
  )

  return (
    <section aria-labelledby="inquiry-details-heading" className="mt-4">
      <button
        className="mb-5 inline-flex min-h-10 items-center text-sm font-medium text-[var(--brown)] hover:text-[var(--charcoal)]"
        onClick={onBack}
        type="button"
      >
        <span aria-hidden="true" className="mr-2">←</span>
        Back to inquiries
      </button>

      <div className="border-y border-[var(--line)] py-5 sm:py-6">
        <p className="text-sm text-[var(--muted)]">{inquiry.name}</p>
        <h1
          className="mt-1 break-words text-2xl font-semibold tracking-tight sm:text-3xl"
          id="inquiry-details-heading"
        >
          {inquiry.subject}
        </h1>
      </div>

      <div className="grid gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10">
        <div className="min-w-0">
          <div
            aria-label="Inquiry sections"
            className="flex gap-5 overflow-x-auto border-b border-[var(--line)]"
            role="tablist"
          >
            {inquiryTabs.map((tab) => (
              <button
                aria-controls={`inquiry-panel-${tab.id}`}
                aria-selected={activeTab === tab.id}
                className={`min-h-11 shrink-0 border-b-2 px-1 text-sm ${
                  activeTab === tab.id
                    ? 'border-[var(--brown)] font-medium text-[var(--charcoal)]'
                    : 'border-transparent text-[var(--muted)] hover:text-[var(--charcoal)]'
                }`}
                id={`inquiry-tab-${tab.id}`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                type="button"
              >
                {tab.label}
                {tab.id === 'follow-up' && inquiry.follow_up_at && (
                  <span className="ml-2 text-xs text-[var(--muted)]">Scheduled</span>
                )}
              </button>
            ))}
          </div>

          <div
            aria-labelledby={`inquiry-tab-${activeTab}`}
            className="pt-6"
            id={`inquiry-panel-${activeTab}`}
            role="tabpanel"
            tabIndex={0}
          >
            {activeTab === 'conversation' && (
              <>
                <section aria-label="Customer conversation">
                  <article className="border-b border-[var(--line)] pb-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-sm font-semibold">Original inquiry</h2>
                      <time
                        className="text-xs text-[var(--muted)]"
                        dateTime={inquiry.created_at}
                      >
                        {formatInquiryDateTime(inquiry.created_at)}
                      </time>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">
                      {inquiry.message}
                    </p>
                  </article>

                  <div className="mt-6">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-semibold">Customer conversation</h2>
                      <span className="text-xs text-[var(--muted)]">
                        {conversationMessages.length}{' '}
                        {conversationMessages.length === 1 ? 'reply' : 'replies'}
                      </span>
                    </div>

                    {conversationMessages.length === 0 ? (
                      <p className="py-6 text-sm text-[var(--muted)]">
                        No customer replies yet.
                      </p>
                    ) : (
                      <ol className="divide-y divide-[var(--line)]">
                        {conversationMessages.map((message) => {
                          const author = getMessageAuthor(
                            message,
                            assignees,
                            currentUserId,
                            false,
                            currentUserName,
                          )
                          return (
                            <li className="py-5" key={message.id}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <span className="text-sm font-medium">{author}</span>
                                  {message.message_type && (
                                    <span className="ml-2 text-xs text-[var(--muted)]">
                                      {formatInquiryMessageType(message.message_type)}
                                    </span>
                                  )}
                                </div>
                                <time
                                  className="text-xs text-[var(--muted)]"
                                  dateTime={message.created_at}
                                >
                                  {formatInquiryDateTime(message.created_at)}
                                </time>
                              </div>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">
                                {message.body}
                              </p>
                            </li>
                          )
                        })}
                      </ol>
                    )}
                  </div>
                </section>

                <section
                  aria-label="Internal notes"
                  className="mt-8 rounded-xl border border-[var(--taupe)] bg-[var(--bg-warm)] p-4 sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold">Internal notes</h2>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Private to your team; not sent to the customer.
                      </p>
                    </div>
                    <span className="text-xs text-[var(--muted)]">
                      {internalNotes.length}{' '}
                      {internalNotes.length === 1 ? 'note' : 'notes'}
                    </span>
                  </div>

                  {internalNotes.length === 0 ? (
                    <p className="mt-5 text-sm text-[var(--muted)]">
                      No internal notes yet.
                    </p>
                  ) : (
                    <ol className="mt-5 space-y-3">
                      {internalNotes.map((message) => (
                        <InternalNoteEntry
                          author={getMessageAuthor(
                            message,
                            assignees,
                            currentUserId,
                            true,
                            currentUserName,
                          )}
                          key={message.id}
                          message={message}
                        />
                      ))}
                    </ol>
                  )}

                  <form
                    className="mt-6 border-t border-[var(--line)] pt-5"
                    onSubmit={handleSubmitNote}
                  >
                    <label
                      className="block text-sm font-medium"
                      htmlFor="inquiry-internal-note"
                    >
                      Add an internal note
                    </label>
                    <textarea
                      className="mt-3 min-h-24 w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm leading-6 placeholder:text-[var(--muted)] [overflow-wrap:anywhere]"
                      disabled={isSubmittingNote}
                      id="inquiry-internal-note"
                      maxLength={10000}
                      onChange={(event) => {
                        setNoteBody(event.target.value)
                        setNoteError('')
                      }}
                      placeholder="Write a note…"
                      value={noteBody}
                    />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
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
                        className="min-h-10 rounded-lg bg-[var(--charcoal)] px-4 text-xs font-medium text-white hover:bg-[var(--brown)] disabled:opacity-50"
                        disabled={isSubmittingNote || !noteBody.trim()}
                        type="submit"
                      >
                        {isSubmittingNote ? 'Saving…' : 'Add note'}
                      </button>
                    </div>
                  </form>
                </section>
              </>
            )}

            {activeTab === 'follow-up' && (
              <section aria-label="Follow-up">
                <div className="flex flex-col justify-between gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-start">
                  <div>
                    <h2 className="text-sm font-semibold">Scheduled follow-up</h2>
                    {inquiry.follow_up_at ? (
                      <>
                        <p className="mt-2 text-sm">
                          {formatInquiryDateTime(inquiry.follow_up_at)}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--muted)]">
                          {inquiry.follow_up_note}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        No follow-up is scheduled.
                      </p>
                    )}
                  </div>
                  {!isEditingFollowUp && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        className="min-h-10 border border-[var(--line)] px-3 text-xs font-medium hover:bg-[var(--bg-warm)]"
                        onClick={openFollowUpForm}
                        type="button"
                      >
                        {inquiry.follow_up_at ? 'Edit reminder' : 'Add reminder'}
                      </button>
                      {inquiry.follow_up_at && (
                        <button
                          className="min-h-10 px-2 text-xs text-[var(--muted)] hover:text-[var(--charcoal)] disabled:opacity-50"
                          disabled={isSavingFollowUp}
                          onClick={openFollowUpRemovalConfirmation}
                          type="button"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {followUpNotice && (
                  <p className="mt-4 text-sm text-[var(--brown)]" role="status">
                    {followUpNotice}
                  </p>
                )}
                {followUpError &&
                  !isEditingFollowUp &&
                  !isConfirmingFollowUpRemoval && (
                  <p className="mt-4 text-sm text-[var(--brown)]" role="alert">
                    {followUpError}
                  </p>
                )}

                {isEditingFollowUp && (
                  <form className="mt-5 max-w-xl" onSubmit={handleSaveFollowUp}>
                    <h3 className="text-sm font-semibold">
                      {inquiry.follow_up_at ? 'Edit reminder' : 'New reminder'}
                    </h3>
                    <label className="mt-4 block text-xs text-[var(--muted)]">
                      Date and time
                      <input
                        className="mt-1 min-h-11 w-full border border-[var(--line)] bg-[var(--panel)] px-3 text-sm text-[var(--charcoal)]"
                        disabled={isSavingFollowUp}
                        onChange={(event) => setFollowUpAt(event.target.value)}
                        required
                        type="datetime-local"
                        value={followUpAt}
                      />
                    </label>
                    <label className="mt-3 block text-xs text-[var(--muted)]">
                      Private reminder note
                      <textarea
                        className="mt-1 min-h-24 w-full border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--charcoal)]"
                        disabled={isSavingFollowUp}
                        maxLength={500}
                        onChange={(event) => setFollowUpNote(event.target.value)}
                        required
                        value={followUpNote}
                      />
                      <span className="mt-1 block text-right">
                        {followUpNote.length}/500
                      </span>
                    </label>
                    {followUpError && (
                      <p className="mt-3 text-sm text-[var(--brown)]" role="alert">
                        {followUpError}
                      </p>
                    )}
                    <div className="mt-4 flex gap-2">
                      <button
                        className="min-h-10 bg-[var(--charcoal)] px-4 text-xs font-medium text-white hover:bg-[var(--brown)] disabled:opacity-50"
                        disabled={
                          isSavingFollowUp ||
                          !followUpAt ||
                          !followUpNote.trim() ||
                          followUpNote.trim().length > 500
                        }
                        type="submit"
                      >
                        {isSavingFollowUp ? 'Saving…' : 'Save reminder'}
                      </button>
                      <button
                        className="min-h-10 px-3 text-xs text-[var(--muted)]"
                        disabled={isSavingFollowUp}
                        onClick={() => {
                          setIsEditingFollowUp(false)
                          setFollowUpError('')
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </section>
            )}

            {activeTab === 'activity' && (
              <section aria-label="Activity history">
                <h2 className="text-sm font-semibold">Inquiry activity</h2>
                {activities.length === 0 ? (
                  <p className="py-6 text-sm text-[var(--muted)]">
                    No status, assignment, or follow-up changes recorded.
                  </p>
                ) : (
                  <ol className="mt-4 divide-y divide-[var(--line)]">
                    {activities.map((activity) => (
                      <li className="py-4" key={activity.id}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-medium">
                            {formatActivityTitle(activity.activity_type)}
                          </p>
                          <time
                            className="text-xs text-[var(--muted)]"
                            dateTime={activity.created_at}
                          >
                            {formatInquiryDateTime(activity.created_at)}
                          </time>
                        </div>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {activity.actor_name || 'System'} ·{' '}
                          {formatActivityValue(
                            activity,
                            activity.previous_value,
                            assignees,
                          )}{' '}
                          →{' '}
                          {formatActivityValue(
                            activity,
                            activity.new_value,
                            assignees,
                          )}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}
          </div>
        </div>

        <aside className="border-t border-[var(--line)] pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Inquiry details
          </h2>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-xs text-[var(--muted)]">Customer</dt>
              <dd className="mt-1 text-sm font-medium">{inquiry.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Email</dt>
              <dd className="mt-1 break-all text-sm">
                <a className="underline decoration-[var(--taupe)] underline-offset-2" href={`mailto:${inquiry.email}`}>
                  {inquiry.email}
                </a>
              </dd>
            </div>
            {inquiry.phone && (
              <div>
                <dt className="text-xs text-[var(--muted)]">Phone</dt>
                <dd className="mt-1 text-sm">
                  <a className="underline decoration-[var(--taupe)] underline-offset-2" href={`tel:${inquiry.phone}`}>
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
              <dt className="text-xs text-[var(--muted)]">Received</dt>
              <dd className="mt-1 text-sm">{formatInquiryDateTime(inquiry.created_at)}</dd>
            </div>
          </dl>

          <div className="mt-6 border-t border-[var(--line)] pt-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Status
            </h2>
            <form className="mt-3" onSubmit={handleSaveStatus}>
              <label className="sr-only" htmlFor="inquiry-status">Status</label>
              <select
                className="min-h-10 w-full border border-[var(--line)] bg-[var(--panel)] px-3 text-sm"
                disabled={isSavingStatus}
                id="inquiry-status"
                onChange={(event) => {
                  setSelectedStatus(event.target.value)
                  setStatusError('')
                }}
                value={selectedStatus}
              >
                {inquiryStatuses.map((status) => (
                  <option key={status} value={status}>{formatInquiryStatus(status)}</option>
                ))}
              </select>
              {selectedStatus !== inquiry.status && (
                <button
                  className="mt-2 min-h-10 w-full bg-[var(--charcoal)] px-3 text-xs font-medium text-white hover:bg-[var(--brown)] disabled:opacity-50"
                  disabled={isSavingStatus}
                  type="submit"
                >
                  {isSavingStatus ? 'Saving…' : 'Save status'}
                </button>
              )}
              {statusError && <p className="mt-2 text-xs text-[var(--brown)]" role="alert">{statusError}</p>}
            </form>
          </div>

          <div className="mt-6 border-t border-[var(--line)] pt-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Assigned to
            </h2>
            <form className="mt-3" onSubmit={handleAssignment}>
              <label className="sr-only" htmlFor="inquiry-assignee">Assignee</label>
              <select
                className="min-h-10 w-full border border-[var(--line)] bg-[var(--panel)] px-3 text-sm"
                disabled={isUpdatingAssignment}
                id="inquiry-assignee"
                onChange={(event) => {
                  setSelectedAssigneeId(event.target.value)
                  setAssignmentError('')
                }}
                value={selectedAssigneeId}
              >
                <option value="">Unassigned</option>
                {inquiry.assigned_to && !activeAssignee && (
                  <option value={inquiry.assigned_to}>Current assignee unavailable</option>
                )}
                {assignees.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {assignee.full_name}{assignee.id === currentUserId ? ' (You)' : ''}
                  </option>
                ))}
              </select>
              {(selectedAssigneeId || null) !== (inquiry.assigned_to ?? null) && (
                <button
                  className="mt-2 min-h-10 w-full border border-[var(--line)] px-3 text-xs font-medium hover:bg-[var(--bg-warm)] disabled:opacity-50"
                  disabled={isUpdatingAssignment}
                  type="submit"
                >
                  {isUpdatingAssignment ? 'Saving…' : 'Save assignment'}
                </button>
              )}
              {assignmentError && (
                <div className="mt-2 text-xs text-[var(--brown)]" role="alert">
                  <p>{assignmentError}</p>
                  <button className="mt-1 underline" onClick={onRefresh} type="button">
                    Refresh inquiry
                  </button>
                </div>
              )}
            </form>
          </div>
        </aside>
      </div>
      <ConfirmationDialog
        cancelLabel="Keep follow-up"
        confirmLabel="Remove follow-up"
        description={`Remove the scheduled reminder for “${inquiry.subject}”?`}
        error={followUpError}
        isProcessing={isSavingFollowUp}
        onCancel={cancelFollowUpRemoval}
        onConfirm={handleClearFollowUp}
        open={isConfirmingFollowUpRemoval}
        processingLabel="Removing…"
        title="Remove scheduled follow-up?"
        warning="The scheduled date and private note will be cleared. You can add a new follow-up later."
      />
    </section>
  )
}

export default InquiryDetails
