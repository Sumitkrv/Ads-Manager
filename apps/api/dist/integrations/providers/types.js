export class ProviderError extends Error {
    code;
    retryable;
    constructor(code, retryable = false) {
        super("The advertising provider could not complete the request.");
        this.code = code;
        this.retryable = retryable;
        this.name = "ProviderError";
    }
}
