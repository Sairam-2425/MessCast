import type { ConfirmationResult } from 'firebase/auth';

let _pending: ConfirmationResult | null = null;

export function setPending(result: ConfirmationResult): void { _pending = result; }
export function getPending(): ConfirmationResult | null      { return _pending; }
export function clearPending(): void                         { _pending = null; }
