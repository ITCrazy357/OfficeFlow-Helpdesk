export class PasswordResetRequestedEvent {
  constructor(
    public readonly userId: number,
    public readonly rawToken: string,
    public readonly expiresAt: Date,
  ) {}
}
