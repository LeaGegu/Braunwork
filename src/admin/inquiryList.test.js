import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatInquiryDate,
  formatInquiryDateTime,
  getInquiryAssigneeLabel,
  formatInquiryMessageType,
  formatInquiryStatus,
  loadInquiryAssignees,
  loadInquiryDetails,
  loadInquiryPage,
  loadInquirySummary,
  submitInternalNote,
  syncInquiryAssignment,
  syncInquiryStatus,
  updateInquiryAssignment,
  updateInquiryFollowUp,
  updateInquiryStatus,
} from './inquiryList.js'

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload
    },
  }
}

test('loads and validates the backend inquiry pagination shape', async () => {
  let requestedPath
  const result = await loadInquiryPage(async (path) => {
    requestedPath = path
    return jsonResponse(200, {
      success: true,
      data: [{ id: 'inquiry-1', subject: 'Renovation' }],
      pagination: { page: 2, limit: 20, total: 25, totalPages: 2 },
    })
  }, 2)

  assert.equal(requestedPath, '/api/admin/inquiries?page=2&limit=20')
  assert.deepEqual(result, {
    inquiries: [{ id: 'inquiry-1', subject: 'Renovation' }],
    pagination: { page: 2, limit: 20, total: 25, totalPages: 2 },
  })
})

test('sends supported list filters and sort order as query parameters', async () => {
  let requestedPath
  await loadInquiryPage(async (path) => {
    requestedPath = path
    return jsonResponse(200, {
      success: true,
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    })
  }, 1, 20, {
    search: 'kitchen',
    status: 'waiting',
    category: 'Modular Kitchen',
    assigned_to: 'unassigned',
    sort: 'oldest',
  })

  assert.equal(
    requestedPath,
    '/api/admin/inquiries?page=1&limit=20&search=kitchen&status=waiting&category=Modular+Kitchen&assigned_to=unassigned&sort=oldest',
  )
})

test('loads summary counts and eligible staff options', async () => {
  const summary = await loadInquirySummary(async (path) => {
    assert.equal(path, '/api/admin/inquiries/summary')
    return jsonResponse(200, {
      success: true,
      data: {
        total: 2,
        new: 1,
        in_progress: 0,
        waiting: 0,
        resolved: 1,
        archived: 0,
      },
    })
  })
  assert.equal(summary.total, 2)

  const assignees = await loadInquiryAssignees(async (path) => {
    assert.equal(path, '/api/admin/inquiries/assignees')
    return jsonResponse(200, {
      success: true,
      data: [{ id: 'staff-1', full_name: 'Staff Member' }],
    })
  })
  assert.deepEqual(assignees, [{ id: 'staff-1', full_name: 'Staff Member' }])
})

test('loads the latest directory assignee name when returning to the inquiry list', async () => {
  const updatedInquiry = {
    id: '00000000-0000-4000-8000-000000000001',
    assigned_to: '00000000-0000-4000-8000-000000000002',
    assigned_to_name: 'Current Staff Name',
  }
  const result = await loadInquiryPage(async (path) => {
    assert.equal(path, '/api/admin/inquiries?page=3&limit=20')
    return jsonResponse(200, {
      success: true,
      data: [updatedInquiry],
      pagination: { page: 3, limit: 20, total: 45, totalPages: 3 },
    })
  }, 3)

  assert.equal(result.inquiries[0].assigned_to_name, 'Current Staff Name')
  assert.equal(result.pagination.page, 3)
})

test('uses safe messages for authorization and server failures', async (t) => {
  await t.test('unauthorized', async () => {
    await assert.rejects(
      loadInquiryPage(async () => jsonResponse(401, {})),
      { message: 'Your session has expired. Please sign in again.' },
    )
  })

  await t.test('forbidden', async () => {
    await assert.rejects(
      loadInquiryPage(async () => jsonResponse(403, {})),
      { message: 'You do not have permission to view inquiries.' },
    )
  })

  await t.test('server error', async () => {
    await assert.rejects(
      loadInquiryPage(async () => jsonResponse(503, {
        message: 'private database details',
      })),
      { message: 'Unable to load inquiries right now. Please try again.' },
    )
  })
})

test('rejects malformed or incomplete inquiry responses', async () => {
  await assert.rejects(
    loadInquiryPage(async () => jsonResponse(200, {
      success: true,
      data: [],
      pagination: { page: 1, limit: 20 },
    })),
    { message: 'The inquiry response could not be read. Please try again.' },
  )
})

test('formats statuses and safely handles invalid dates', () => {
  assert.equal(formatInquiryStatus('in_progress'), 'In Progress')
  assert.equal(formatInquiryStatus('new'), 'New')
  assert.equal(formatInquiryDate('not-a-date'), 'Date unavailable')
  assert.equal(formatInquiryDateTime('not-a-date'), 'Date unavailable')
})

test('loads detail data and associated messages using the authenticated request', async () => {
  const inquiry = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Customer Example',
    email: 'customer@example.com',
    phone: null,
    category: 'Construction',
    subject: 'New project',
    message: 'Original request',
    status: 'new',
    assigned_to: null,
    created_at: '2026-01-01T00:00:00.000Z',
  }
  const messages = [{
    id: 'message-1',
    inquiry_id: inquiry.id,
    message_type: 'internal_note',
    body: 'Internal follow-up',
    created_at: '2026-01-02T00:00:00.000Z',
  }]
  const activities = [{
    id: 1,
    inquiry_id: inquiry.id,
    actor_name: 'Staff Member',
    activity_type: 'status_changed',
    previous_value: 'new',
    new_value: 'in_progress',
    created_at: '2026-01-03T00:00:00.000Z',
  }]
  let requestedPath
  const result = await loadInquiryDetails(async (path) => {
    requestedPath = path
    return jsonResponse(200, {
      success: true,
      inquiry,
      messages,
      activities,
    })
  }, inquiry.id)

  assert.equal(requestedPath, `/api/admin/inquiries/${inquiry.id}`)
  assert.deepEqual(result, { inquiry, messages, activities })
})

test('rejects invalid IDs without making a request', async () => {
  let called = false
  await assert.rejects(
    loadInquiryDetails(async () => {
      called = true
      return jsonResponse(200, {})
    }, 'not-a-uuid'),
    { message: 'This inquiry link is invalid. Return to the list and try again.' },
  )
  assert.equal(called, false)
})

test('uses safe detail errors for not-found and malformed responses', async () => {
  await assert.rejects(
    loadInquiryDetails(async () => jsonResponse(404, {}), '00000000-0000-4000-8000-000000000001'),
    { message: 'This inquiry could not be found.' },
  )
  await assert.rejects(
    loadInquiryDetails(async () => jsonResponse(200, {
      success: true,
      inquiry: { id: '00000000-0000-4000-8000-000000000001' },
      messages: {},
    }), '00000000-0000-4000-8000-000000000001'),
    { message: 'The inquiry response could not be read. Please try again.' },
  )
})

test('labels internal notes and inbound or outbound messages distinctly', () => {
  assert.equal(formatInquiryMessageType('internal_note'), 'Internal note')
  assert.equal(formatInquiryMessageType('inbound'), 'Inbound message')
  assert.equal(formatInquiryMessageType('outbound'), 'Outbound message')
})

test('submits only a trimmed note body to the inquiry messages endpoint', async () => {
  const inquiryId = '00000000-0000-4000-8000-000000000001'
  let requestArguments
  const note = {
    id: 'note-1',
    inquiry_id: inquiryId,
    sender_id: 'server-derived-user',
    message_type: 'internal_note',
    body: 'Private follow-up',
  }
  const result = await submitInternalNote(async (...args) => {
    requestArguments = args
    return jsonResponse(201, { success: true, message: note })
  }, inquiryId, '  Private follow-up  ')

  assert.deepEqual(requestArguments, [
    `/api/admin/inquiries/${inquiryId}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'Private follow-up' }),
    },
  ])
  assert.deepEqual(result, note)
})

test('does not send an empty internal note', async () => {
  let called = false
  await assert.rejects(
    submitInternalNote(async () => {
      called = true
      return jsonResponse(201, {})
    }, '00000000-0000-4000-8000-000000000001', ' \n\t '),
    { message: 'Enter a note before submitting.' },
  )
  assert.equal(called, false)
})

test('returns a safe note submission error without provider details', async () => {
  await assert.rejects(
    submitInternalNote(async () => jsonResponse(503, {
      message: 'private database detail',
    }), '00000000-0000-4000-8000-000000000001', 'Internal note'),
    { message: 'Unable to add the internal note right now. Please try again.' },
  )
})

test('updates inquiry status with only the selected status and verifies response', async () => {
  const inquiryId = '00000000-0000-4000-8000-000000000001'
  const updatedInquiry = { id: inquiryId, status: 'in_progress' }
  let requestArguments
  const result = await updateInquiryStatus(async (...args) => {
    requestArguments = args
    return jsonResponse(200, {
      success: true,
      inquiry: updatedInquiry,
    })
  }, inquiryId, 'in_progress')

  assert.deepEqual(requestArguments, [
    `/api/admin/inquiries/${inquiryId}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    },
  ])
  assert.deepEqual(result, updatedInquiry)
})

test('rejects unsupported status values without making a request', async () => {
  let called = false
  await assert.rejects(
    updateInquiryStatus(async () => {
      called = true
      return jsonResponse(200, {})
    }, '00000000-0000-4000-8000-000000000001', 'closed'),
    { message: 'Select a valid inquiry status.' },
  )
  assert.equal(called, false)
})

test('does not confirm a status update when the server response disagrees', async () => {
  await assert.rejects(
    updateInquiryStatus(async () => jsonResponse(200, {
      success: true,
      inquiry: {
        id: '00000000-0000-4000-8000-000000000001',
        status: 'new',
      },
    }), '00000000-0000-4000-8000-000000000001', 'resolved'),
    { message: 'The status update could not be confirmed. Please try again.' },
  )
})

test('shows safe errors when status updates are rejected', async () => {
  await assert.rejects(
    updateInquiryStatus(async () => jsonResponse(403, {
      message: 'private permission details',
    }), '00000000-0000-4000-8000-000000000001', 'resolved'),
    { message: 'You do not have permission to update this inquiry.' },
  )
})

test('assigns to the authenticated user and verifies the updated assignment', async () => {
  const inquiryId = '00000000-0000-4000-8000-000000000001'
  const updatedInquiry = { id: inquiryId, assigned_to: inquiryId }
  let requestArguments
  const result = await updateInquiryAssignment(async (...args) => {
    requestArguments = args
    return jsonResponse(200, {
      success: true,
      inquiry: updatedInquiry,
    })
  }, inquiryId, inquiryId, null)

  assert.deepEqual(requestArguments, [
    `/api/admin/inquiries/${inquiryId}/assignment`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assigned_to: inquiryId,
        expected_assigned_to: null,
      }),
    },
  ])
  assert.deepEqual(result, updatedInquiry)
})

test('unassigns an inquiry by sending assigned_to null', async () => {
  const inquiryId = '00000000-0000-4000-8000-000000000001'
  const updatedInquiry = { id: inquiryId, assigned_to: null }
  let requestBody
  const result = await updateInquiryAssignment(async (_path, options) => {
    requestBody = JSON.parse(options.body)
    return jsonResponse(200, { success: true, inquiry: updatedInquiry })
  }, inquiryId, null, inquiryId)

  assert.deepEqual(requestBody, {
    assigned_to: null,
    expected_assigned_to: inquiryId,
  })
  assert.deepEqual(result, updatedInquiry)
})

test('does not confirm assignment changes on failure or mismatched response', async () => {
  const inquiryId = '00000000-0000-4000-8000-000000000001'
  await assert.rejects(
    updateInquiryAssignment(async () => jsonResponse(503, {
      message: 'private assignment error',
    }), inquiryId, inquiryId, null),
    { message: 'Unable to update the assignment right now. Please try again.' },
  )

  await assert.rejects(
    updateInquiryAssignment(async () => jsonResponse(200, {
      success: true,
      inquiry: { id: inquiryId, assigned_to: null },
    }), inquiryId, inquiryId, null),
    { message: 'The assignment update could not be confirmed. Please try again.' },
  )
})

test('saves and clears a validated follow-up through the authenticated API', async () => {
  const inquiryId = '00000000-0000-4000-8000-000000000001'
  const followUpAt = '2026-03-01T10:00:00.000Z'
  const updatedInquiry = {
    id: inquiryId,
    follow_up_at: followUpAt,
    follow_up_note: 'Call customer',
  }
  let requestArguments
  const result = await updateInquiryFollowUp(async (...args) => {
    requestArguments = args
    return jsonResponse(200, { success: true, inquiry: updatedInquiry })
  }, inquiryId, followUpAt, ' Call customer ')

  assert.equal(requestArguments[0], `/api/admin/inquiries/${inquiryId}/follow-up`)
  assert.deepEqual(JSON.parse(requestArguments[1].body), {
    follow_up_at: followUpAt,
    follow_up_note: 'Call customer',
  })
  assert.deepEqual(result, updatedInquiry)

  const clearedInquiry = {
    id: inquiryId,
    follow_up_at: null,
    follow_up_note: null,
  }
  let clearRequestBody
  const clearedResult = await updateInquiryFollowUp(
    async (_path, options) => {
      clearRequestBody = JSON.parse(options.body)
      return jsonResponse(200, { success: true, inquiry: clearedInquiry })
    },
    inquiryId,
    null,
    null,
  )
  assert.deepEqual(clearedResult, clearedInquiry)
  assert.deepEqual(clearRequestBody, {
    follow_up_at: null,
    follow_up_note: null,
  })

  await assert.rejects(
    updateInquiryFollowUp(async () => jsonResponse(400, {}), inquiryId, null, 'leftover note'),
    { message: 'Enter a valid follow-up date and note.' },
  )
})

test('confirms create and edit follow-ups when timestamp representations differ', async (t) => {
  const inquiryId = '00000000-0000-4000-8000-000000000001'
  const cases = [
    {
      name: 'creating a follow-up with a different timezone offset',
      requestedAt: '2026-03-01T10:00:00.000Z',
      returnedAt: '2026-03-01T05:00:00-05:00',
      note: 'Create reminder',
    },
    {
      name: 'editing a follow-up with different fractional-second precision',
      requestedAt: '2026-03-02T10:00:00.123Z',
      returnedAt: '2026-03-02T10:00:00.123000+00:00',
      note: 'Edit reminder',
    },
  ]

  for (const { name, requestedAt, returnedAt, note } of cases) {
    await t.test(name, async () => {
      const result = await updateInquiryFollowUp(
        async () => jsonResponse(200, {
          success: true,
          inquiry: {
            id: inquiryId,
            follow_up_at: returnedAt,
            follow_up_note: note,
          },
        }),
        inquiryId,
        requestedAt,
        note,
      )

      assert.equal(result.follow_up_at, returnedAt)
    })
  }
})

test('does not confirm a different or invalid returned follow-up timestamp', async (t) => {
  const inquiryId = '00000000-0000-4000-8000-000000000001'
  for (const returnedAt of [
    '2026-03-01T10:00:00.001Z',
    'not-a-timestamp',
  ]) {
    await t.test(returnedAt, async () => {
      await assert.rejects(
        updateInquiryFollowUp(
          async () => jsonResponse(200, {
            success: true,
            inquiry: {
              id: inquiryId,
              follow_up_at: returnedAt,
              follow_up_note: 'Call customer',
            },
          }),
          inquiryId,
          '2026-03-01T10:00:00.000Z',
          'Call customer',
        ),
        { message: 'The follow-up update could not be confirmed.' },
      )
    })
  }

  await t.test('rejects an invalid requested timestamp without making a request', async () => {
    let requestMade = false
    await assert.rejects(
      updateInquiryFollowUp(async () => {
        requestMade = true
        return jsonResponse(200, {})
      }, inquiryId, 'not-a-timestamp', 'Call customer'),
      { message: 'Enter a valid follow-up date and note.' },
    )
    assert.equal(requestMade, false)
  })
})

test('synchronizes only assigned_to in the dashboard inquiry row', () => {
  const inquiry = {
    id: 'inquiry-1',
    subject: 'Project question',
    status: 'new',
    created_at: '2026-01-01T00:00:00.000Z',
  }
  const inquiries = [inquiry, { id: 'inquiry-2', assigned_to: null }]
  const updated = syncInquiryAssignment(inquiries, {
    id: inquiry.id,
    assigned_to: 'staff-1',
  })

  assert.deepEqual(updated, [
    { ...inquiry, assigned_to: 'staff-1', assigned_to_name: null },
    { id: 'inquiry-2', assigned_to: null },
  ])
  assert.equal(inquiry.assigned_to, undefined)
})

test('shows only verified assignee names and synchronizes assignment changes', () => {
  const inquiries = [
    {
      id: 'inquiry-1',
      assigned_to: 'staff-1',
      assigned_to_name: 'Verified Staff Name',
      status: 'new',
    },
    {
      id: 'inquiry-2',
      assigned_to: 'staff-2',
      assigned_to_name: null,
      status: 'waiting',
    },
    { id: 'inquiry-3', assigned_to: null, status: 'resolved' },
  ]

  assert.deepEqual(inquiries.map(getInquiryAssigneeLabel), [
    'Verified Staff Name',
    'Staff member unavailable',
    'Unassigned',
  ])
  assert.deepEqual(
    syncInquiryAssignment(inquiries, {
      id: 'inquiry-3',
      assigned_to: 'staff-3',
    }, 'New Staff Member'),
    [
      ...inquiries.slice(0, 2),
      {
        id: 'inquiry-3',
        assigned_to: 'staff-3',
        assigned_to_name: 'New Staff Member',
        status: 'resolved',
      },
    ],
  )
  assert.deepEqual(
    syncInquiryAssignment(inquiries, {
      id: 'inquiry-1',
      assigned_to: null,
      assigned_to_name: 'ignored',
    })[0],
    {
      ...inquiries[0],
      assigned_to: null,
      assigned_to_name: null,
    },
  )
})

test('synchronizes only a confirmed inquiry status without changing other fields', () => {
  const inquiry = {
    id: 'inquiry-1',
    name: 'Customer',
    subject: 'Project question',
    status: 'new',
    created_at: '2026-01-01T00:00:00.000Z',
  }
  const otherInquiry = {
    id: 'inquiry-2',
    status: 'waiting',
  }
  const inquiries = [inquiry, otherInquiry]
  const updated = syncInquiryStatus(inquiries, {
    id: inquiry.id,
    status: 'resolved',
  })

  assert.deepEqual(updated, [
    { ...inquiry, status: 'resolved' },
    otherInquiry,
  ])
  assert.notEqual(updated, inquiries)
  assert.equal(inquiry.status, 'new')
})
