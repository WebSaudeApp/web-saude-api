import { redactLogRecord } from './redact-log';

describe('redactLogRecord', () => {
  it('oculta senha, token e authorization', () => {
    expect(
      redactLogRecord({
        method: 'POST',
        password: 'senhaSegura1',
        accessToken: 'abc',
        authorization: 'Bearer xyz',
        email: 'maria@email.com',
      }),
    ).toEqual({
      method: 'POST',
      password: '[redacted]',
      accessToken: '[redacted]',
      authorization: '[redacted]',
      email: 'maria@email.com',
    });
  });
});
