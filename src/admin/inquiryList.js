const defaultPageSize = 20
export const inquiryStatuses = [
  'new',
  'in_progress',
  'waiting',
  'resolved',
  'archived',
]
export const inquirySummaryFields = [
  'new',
  'in_progress',
  'waiting',
  'resolved',
  'archived',
]
const inquiryIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidPagination(pagination) {
  return Number.isSafeInteger(pagination?.page) &&
    pagination.page >= 1 &&
    Number.isSafeInteger(pagination.limit) &&
    pagination.limit >= 1 &&
    Number.isSafeInteger(pagination.total) &&
    pagination.total >= 0 &&
    Number.isSafeInteger(pagination.totalPages) &&
    pagination.totalPages >= 0
}

export async function loadInquiryPage(
  request,
  page = 1,
  limit = defaultPageSize,
  filters = {},
) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) })
  for (const field of [
    'search',
    'status',
    'category',
    'assigned_to',
    'sort',
  ]) {
    if (typeof filters[field] === 'string' && filters[field] !== '') {
      query.set(field, filters[field])
    }
  }
  const response = await request(`/api/admin/inquiries?${query}`)

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Your session has expired. Please sign in again.')
    }
    if (response.status === 403) {
      throw new Error('You do not have permission to view inquiries.')
    }
    throw new Error('Unable to load inquiries right now. Please try again.')
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error('The inquiry response could not be read. Please try again.')
  }

  if (
    payload?.success !== true ||
    !Array.isArray(payload.data) ||
    !isValidPagination(payload.pagination)
  ) {
    throw new Error('The inquiry response could not be read. Please try again.')
  }

  return { inquiries: payload.data, pagination: payload.pagination }
}

export async function loadInquirySummary(request) {
  const response = await request('/api/admin/inquiries/summary')
  if (!response.ok) {
    throw new Error('Unable to load inquiry statistics right now.')
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error('The inquiry statistics response could not be read.')
  }
  const summary = payload?.data
  if (
    payload?.success !== true ||
    !summary ||
    !['total', ...inquirySummaryFields].every((field) =>
      Number.isSafeInteger(summary[field]) && summary[field] >= 0
    )
  ) {
    throw new Error('The inquiry statistics response could not be read.')
  }

  return summary
}

export async function loadInquiryAssignees(request) {
  const response = await request('/api/admin/inquiries/assignees')
  if (!response.ok) {
    throw new Error('Unable to load eligible assignees right now.')
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error('The assignee response could not be read.')
  }
  if (
    payload?.success !== true ||
    !Array.isArray(payload.data) ||
    payload.data.some((assignee) =>
      typeof assignee.id !== 'string' ||
      typeof assignee.full_name !== 'string'
    )
  ) {
    throw new Error('The assignee response could not be read.')
  }

  return payload.data
}

export async function loadInquiryDetails(request, inquiryId) {
  if (typeof inquiryId !== 'string' || !inquiryIdPattern.test(inquiryId)) {
    throw new Error('This inquiry link is invalid. Return to the list and try again.')
  }

  const response = await request(
    `/api/admin/inquiries/${encodeURIComponent(inquiryId)}`,
  )

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Your session has expired. Please sign in again.')
    }
    if (response.status === 403) {
      throw new Error('You do not have permission to view this inquiry.')
    }
    if (response.status === 404) {
      throw new Error('This inquiry could not be found.')
    }
    throw new Error('Unable to load this inquiry right now. Please try again.')
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error('The inquiry response could not be read. Please try again.')
  }

  if (
    payload?.success !== true ||
    !payload.inquiry ||
    payload.inquiry.id !== inquiryId ||
    !Array.isArray(payload.messages) ||
    (payload.activities !== undefined && !Array.isArray(payload.activities))
  ) {
    throw new Error('The inquiry response could not be read. Please try again.')
  }

  return {
    inquiry: payload.inquiry,
    messages: payload.messages,
    activities: payload.activities ?? [],
  }
}

export async function submitInternalNote(request, inquiryId, body) {
  if (typeof inquiryId !== 'string' || !inquiryIdPattern.test(inquiryId)) {
    throw new Error('This inquiry link is invalid. Return to the list and try again.')
  }
  if (typeof body !== 'string' || body.trim().length === 0) {
    throw new Error('Enter a note before submitting.')
  }
  if (body.trim().length > 10000) {
    throw new Error('Notes must be 10000 characters or fewer.')
  }

  let response
  try {
    response = await request(
      `/api/admin/inquiries/${encodeURIComponent(inquiryId)}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() }),
      },
    )
  } catch {
    throw new Error('Unable to add the internal note right now. Please try again.')
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Your session has expired. Please sign in again.')
    }
    if (response.status === 403) {
      throw new Error('You do not have permission to add an internal note.')
    }
    if (response.status === 404) {
      throw new Error('This inquiry could not be found.')
    }
    if (response.status === 400) {
      throw new Error('The note could not be accepted. Check its length and try again.')
    }
    throw new Error('Unable to add the internal note right now. Please try again.')
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error('The note could not be confirmed. Please try again.')
  }

  if (
    payload?.success !== true ||
    payload.message?.message_type !== 'internal_note'
  ) {
    throw new Error('The note could not be confirmed. Please try again.')
  }

  return payload.message
}

export async function updateInquiryStatus(request, inquiryId, status) {
  if (typeof inquiryId !== 'string' || !inquiryIdPattern.test(inquiryId)) {
    throw new Error('This inquiry link is invalid. Return to the list and try again.')
  }
  if (!inquiryStatuses.includes(status)) {
    throw new Error('Select a valid inquiry status.')
  }

  let response
  try {
    response = await request(
      `/api/admin/inquiries/${encodeURIComponent(inquiryId)}/status`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      },
    )
  } catch {
    throw new Error('Unable to update the inquiry status right now. Please try again.')
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Your session has expired. Please sign in again.')
    }
    if (response.status === 403) {
      throw new Error('You do not have permission to update this inquiry.')
    }
    if (response.status === 404) {
      throw new Error('This inquiry could not be found.')
    }
    if (response.status === 400) {
      throw new Error('The selected status could not be accepted.')
    }
    throw new Error('Unable to update the inquiry status right now. Please try again.')
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error('The status update could not be confirmed. Please try again.')
  }

  if (
    payload?.success !== true ||
    payload.inquiry?.id !== inquiryId ||
    payload.inquiry.status !== status
  ) {
    throw new Error('The status update could not be confirmed. Please try again.')
  }

  return payload.inquiry
}

export async function updateInquiryAssignment(
  request,
  inquiryId,
  assignedTo,
  expectedAssignedTo,
) {
  if (typeof inquiryId !== 'string' || !inquiryIdPattern.test(inquiryId)) {
    throw new Error('This inquiry link is invalid. Return to the list and try again.')
  }
  if (
    (assignedTo !== null && (
      typeof assignedTo !== 'string' || !inquiryIdPattern.test(assignedTo)
    )) ||
    (expectedAssignedTo !== null && (
      typeof expectedAssignedTo !== 'string' ||
      !inquiryIdPattern.test(expectedAssignedTo)
    ))
  ) {
    throw new Error('The assignment could not be confirmed. Please try again.')
  }

  let response
  try {
    response = await request(
      `/api/admin/inquiries/${encodeURIComponent(inquiryId)}/assignment`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigned_to: assignedTo,
          expected_assigned_to: expectedAssignedTo,
        }),
      },
    )
  } catch {
    throw new Error('Unable to update the assignment right now. Please try again.')
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Your session has expired. Please sign in again.')
    }
    if (response.status === 403) {
      throw new Error('You do not have permission to update this assignment.')
    }
    if (response.status === 404) {
      throw new Error('This inquiry could not be found.')
    }
    if (response.status === 409) {
      throw new Error('The inquiry assignment changed. Refresh and try again.')
    }
    if (response.status === 400) {
      throw new Error('The assignment request could not be accepted.')
    }
    throw new Error('Unable to update the assignment right now. Please try again.')
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error('The assignment update could not be confirmed. Please try again.')
  }

  if (
    payload?.success !== true ||
    payload.inquiry?.id !== inquiryId ||
    payload.inquiry.assigned_to !== assignedTo
  ) {
    throw new Error('The assignment update could not be confirmed. Please try again.')
  }

  return payload.inquiry
}

export async function updateInquiryFollowUp(
  request,
  inquiryId,
  followUpAt,
  followUpNote,
) {
  if (typeof inquiryId !== 'string' || !inquiryIdPattern.test(inquiryId)) {
    throw new Error('This inquiry link is invalid. Return to the list and try again.')
  }
  const normalizedNote = typeof followUpNote === 'string'
    ? followUpNote.trim()
    : followUpNote
  if (
    (followUpAt !== null && (
      typeof followUpAt !== 'string' ||
      !Number.isFinite(Date.parse(followUpAt))
    )) ||
    (followUpAt === null && followUpNote !== null) ||
    (
      followUpNote !== null &&
      (
        typeof normalizedNote !== 'string' ||
        normalizedNote.length === 0 ||
        normalizedNote.length > 500
      )
    )
  ) {
    throw new Error('Enter a valid follow-up date and note.')
  }
  const requestedFollowUpTime = followUpAt === null
    ? null
    : Date.parse(followUpAt)

  let response
  try {
    response = await request(
      `/api/admin/inquiries/${encodeURIComponent(inquiryId)}/follow-up`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          follow_up_at: followUpAt,
          follow_up_note: normalizedNote,
        }),
      },
    )
  } catch {
    throw new Error('Unable to save follow-up details right now.')
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Your session has expired. Please sign in again.')
    }
    if (response.status === 403) {
      throw new Error('You do not have permission to update this inquiry.')
    }
    if (response.status === 400) {
      throw new Error('Enter a valid follow-up date and note.')
    }
    if (response.status === 404) {
      throw new Error('This inquiry could not be found.')
    }
    throw new Error('Unable to save follow-up details right now.')
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error('The follow-up update could not be confirmed.')
  }
  const returnedFollowUpAt = payload?.inquiry?.follow_up_at
  const returnedFollowUpTime = typeof returnedFollowUpAt === 'string'
    ? Date.parse(returnedFollowUpAt)
    : Number.NaN
  const followUpDateMatches = followUpAt === null
    ? returnedFollowUpAt === null
    : Number.isFinite(requestedFollowUpTime) &&
      Number.isFinite(returnedFollowUpTime) &&
      returnedFollowUpTime === requestedFollowUpTime

  if (
    payload?.success !== true ||
    payload.inquiry?.id !== inquiryId ||
    !followUpDateMatches ||
    payload.inquiry.follow_up_note !== normalizedNote
  ) {
    throw new Error('The follow-up update could not be confirmed.')
  }

  return payload.inquiry
}

export function syncInquiryStatus(inquiries, updatedInquiry) {
  if (!Array.isArray(inquiries) || typeof updatedInquiry?.id !== 'string') {
    return inquiries
  }

  return inquiries.map((inquiry) =>
    inquiry.id === updatedInquiry.id
      ? { ...inquiry, status: updatedInquiry.status }
      : inquiry,
  )
}

export function syncInquiryAssignment(
  inquiries,
  updatedInquiry,
  assignedToName = updatedInquiry?.assigned_to_name ?? null,
) {
  if (!Array.isArray(inquiries) || typeof updatedInquiry?.id !== 'string') {
    return inquiries
  }

  return inquiries.map((inquiry) =>
    inquiry.id === updatedInquiry.id
      ? {
          ...inquiry,
          assigned_to: updatedInquiry.assigned_to,
          assigned_to_name: updatedInquiry.assigned_to
            ? assignedToName
            : null,
        }
      : inquiry,
  )
}

export function getInquiryAssigneeLabel(inquiry) {
  if (!inquiry.assigned_to) {
    return 'Unassigned'
  }

  const fullName = typeof inquiry.assigned_to_name === 'string'
    ? inquiry.assigned_to_name.trim()
    : ''
  return fullName || 'Staff member unavailable'
}

export function formatInquiryStatus(status) {
  if (typeof status !== 'string' || status.trim() === '') {
    return 'Unknown'
  }

  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function formatInquiryMessageType(type) {
  if (type === 'internal_note') {
    return 'Internal note'
  }
  if (type === 'inbound') {
    return 'Inbound message'
  }
  if (type === 'outbound') {
    return 'Outbound message'
  }
  return formatInquiryStatus(type)
}

export function formatInquiryDate(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    return 'Date unavailable'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(date)
}

export function formatInquiryDateTime(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    return 'Date unavailable'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
