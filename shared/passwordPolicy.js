const passwordRequirements = [
  {
    id: 'minLength',
    label: 'At least 8 characters',
    isSatisfied: (password) => password.length >= 8,
  },
  {
    id: 'uppercase',
    label: 'One uppercase letter',
    isSatisfied: (password) => /[A-Z]/.test(password),
  },
  {
    id: 'lowercase',
    label: 'One lowercase letter',
    isSatisfied: (password) => /[a-z]/.test(password),
  },
  {
    id: 'number',
    label: 'One number',
    isSatisfied: (password) => /[0-9]/.test(password),
  },
  {
    id: 'special',
    label: 'One special character',
    isSatisfied: (password) => /[^A-Za-z0-9\s]/.test(password),
  },
]

export function getPasswordRequirements(password) {
  const candidate = typeof password === 'string' ? password : ''
  return passwordRequirements.map(({ id, label, isSatisfied }) => ({
    id,
    label,
    isSatisfied: isSatisfied(candidate),
  }))
}

export function isPasswordValid(password) {
  return getPasswordRequirements(password).every(
    (requirement) => requirement.isSatisfied,
  )
}

export function passwordsMatch(password, confirmation) {
  return typeof password === 'string' &&
    typeof confirmation === 'string' &&
    confirmation.length > 0 &&
    password === confirmation
}
