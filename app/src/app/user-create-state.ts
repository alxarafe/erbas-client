export enum UserCreateState {
  Idle = 'idle',
  Submitting = 'submitting',
  Created = 'created',
  InvalidRequest = 'invalid-request',
  Unauthorized = 'unauthorized',
  Forbidden = 'forbidden',
  EmailConflict = 'email-conflict',
  Unavailable = 'unavailable',
  InvalidResponse = 'invalid-response',
}
