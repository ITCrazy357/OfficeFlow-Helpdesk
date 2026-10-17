// Interactive transactions include network round trips to the hosted database.
// Keep the budget bounded while allowing more than Prisma's default 5 seconds.
export const LEAVE_TRANSACTION_TIMING = {
  maxWait: 10_000,
  timeout: 30_000,
} as const;
