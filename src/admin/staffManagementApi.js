const staffPath = '/api/admin/staff'

async function readResponse(response) {
  let payload
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok || payload?.success !== true) {
    throw new Error(
      typeof payload?.message === 'string'
        ? payload.message
        : 'Unable to complete the staff management request.',
    )
  }

  return payload
}

export async function loadStaffProfiles(request) {
  const payload = await readResponse(await request(staffPath))
  if (!Array.isArray(payload.data)) {
    throw new Error('The staff list response was invalid.')
  }
  return payload.data
}

export async function inviteStaffMember(request, staffMember) {
  const payload = await readResponse(await request(staffPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(staffMember),
  }))
  return payload.data
}

export async function updateStaffMember(request, userId, changes) {
  const payload = await readResponse(await request(
    `${staffPath}/${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    },
  ))
  return payload.data
}
