import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordError } from '../src/lib/password-policy.mjs';

test('solo acepta contraseñas de 8 a 72 bytes para bcrypt', () => {
  assert.ok(passwordError('short'));
  assert.equal(passwordError('una contraseña segura'), null);
  assert.ok(passwordError('á'.repeat(37)));
  assert.ok(passwordError(undefined));
});
