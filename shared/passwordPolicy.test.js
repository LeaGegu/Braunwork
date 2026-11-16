import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getPasswordRequirements,
  isPasswordValid,
  passwordsMatch,
} from './passwordPolicy.js'

test('accepts a password meeting every requirement at the eight-character minimum', () => {
  assert.equal(isPasswordValid('Abcdef1!'), true)
})

test('rejects a password shorter than eight characters', () => {
  assert.equal(isPasswordValid('Ab1!xyz'), false)
  assert.equal(
    getPasswordRequirements('Ab1!xyz')[0].isSatisfied,
    false,
  )
})

test('rejects a password with no uppercase letter', () => {
  assert.equal(isPasswordValid('abcdef1!'), false)
})

test('rejects a password with no lowercase letter', () => {
  assert.equal(isPasswordValid('ABCDEF1!'), false)
})

test('rejects a password with no number', () => {
  assert.equal(isPasswordValid('Abcdefg!'), false)
})

test('rejects a password with no special character', () => {
  assert.equal(isPasswordValid('Abcdefg1'), false)
})

test('password confirmation matches only when nonempty and identical', () => {
  assert.equal(passwordsMatch('Abcdef1!', 'Abcdef1!'), true)
  assert.equal(passwordsMatch('Abcdef1!', 'Abcdef1?'), false)
  assert.equal(passwordsMatch('Abcdef1!', ''), false)
})

test('live requirement states update as a password is typed or changed', () => {
  const incomplete = getPasswordRequirements('')
  assert.deepEqual(
    incomplete.map((requirement) => requirement.isSatisfied),
    [false, false, false, false, false],
  )

  const complete = getPasswordRequirements('Abcdef1!')
  assert.deepEqual(
    complete.map((requirement) => requirement.isSatisfied),
    [true, true, true, true, true],
  )

  const changed = getPasswordRequirements('abcdef1!')
  assert.deepEqual(
    changed.map((requirement) => requirement.isSatisfied),
    [true, false, true, true, true],
  )
})
