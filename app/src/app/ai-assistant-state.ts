export enum AiAssistantState {
  Idle = 'idle',
  Submitting = 'submitting',
  Answered = 'answered',
  InvalidRequest = 'invalid-request',
  Unauthorized = 'unauthorized',
  Forbidden = 'forbidden',
  Unsupported = 'unsupported',
  ExecutionFailed = 'execution-failed',
  ModuleDisabled = 'module-disabled',
  Unavailable = 'unavailable',
  InvalidResponse = 'invalid-response',
}
