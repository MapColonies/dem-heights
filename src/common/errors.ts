export class UpstreamUnavailableError extends Error {
  public constructor(message?: string) {
    super(message);
    this.name = 'UpstreamUnavailableError';
    Object.setPrototypeOf(this, UpstreamUnavailableError.prototype);
  }
}