/** Validates an Indian mobile number: +91 followed by 10 digits starting with 6–9 */
export function isValidIndianPhone(phone: string): boolean {
  return /^\+91[6-9]\d{9}$/.test(phone);
}

/** Masks phone for display: +916305784704 → +91 ******4704 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return phone;
  return `+91 ******${phone.slice(-4)}`;
}
