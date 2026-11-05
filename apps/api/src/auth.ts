import type { RequestHandler } from "express";
import { HttpError } from "./errors.js";

export type AuthenticatedApiUser = {
  id: string;
  email: string | null;
  emailConfirmedAt: string | null;
  createdAt: string;
};

export type TokenVerification =
  | { status: "verified"; user: AuthenticatedApiUser }
  | { status: "invalid" }
  | { status: "unavailable" };

export type TokenVerifier = (token: string) => Promise<TokenVerification>;

export function createRequireAuthenticatedUser(
  verifyToken: TokenVerifier | null,
): RequestHandler {
  return async (request, response, next) => {
    const authorization = request.get("authorization");
    const match = authorization?.match(/^Bearer\s+(\S+)$/i);
    const accessToken = match?.[1];
    if (!accessToken || accessToken.length > 8192) {
      next(new HttpError(401, "authentication_required", "A valid bearer token is required."));
      return;
    }

    if (!verifyToken) {
      next(
        new HttpError(
          503,
          "auth_not_configured",
          "Authentication is not configured on this API.",
        ),
      );
      return;
    }

    try {
      const verification = await verifyToken(accessToken);
      if (verification.status === "invalid") {
        next(new HttpError(401, "invalid_bearer_token", "The bearer token is invalid or expired."));
        return;
      }
      if (verification.status === "unavailable") {
        next(
          new HttpError(
            503,
            "auth_verification_unavailable",
            "Authentication could not be verified right now.",
          ),
        );
        return;
      }

      response.locals.authenticatedUser = verification.user;
      response.locals.authenticatedAccessToken = accessToken;
      next();
    } catch {
      next(
        new HttpError(
          503,
          "auth_verification_unavailable",
          "Authentication could not be verified right now.",
        ),
      );
    }
  };
}
