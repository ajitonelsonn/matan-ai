export type AuthErrorCode =
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_USER_NOT_CONFIRMED"
  | "AUTH_USER_EXISTS"
  | "AUTH_USER_NOT_FOUND"
  | "AUTH_INVALID_PASSWORD"
  | "AUTH_INVALID_CODE"
  | "AUTH_CODE_EXPIRED"
  | "AUTH_TOO_MANY_ATTEMPTS"
  | "AUTH_OAUTH_CANCELLED"
  | "AUTH_OAUTH_UNAVAILABLE"
  | "AUTH_NOT_CONFIGURED"
  | "AUTH_NETWORK"
  | "AUTH_UNKNOWN";

export interface FriendlyAuthError {
  code: AuthErrorCode;
  title: string;
  message: string;
}

const copy: Record<AuthErrorCode, { title: string; message: string }> = {
  AUTH_INVALID_CREDENTIALS: { title: "Unable to sign in", message: "The email or password is incorrect." },
  AUTH_USER_NOT_CONFIRMED: { title: "Verify your email", message: "Your account needs email verification." },
  AUTH_USER_EXISTS: { title: "Account already exists", message: "An account with this email already exists. Try signing in instead." },
  AUTH_USER_NOT_FOUND: { title: "Unable to sign in", message: "The email or password is incorrect." },
  AUTH_INVALID_PASSWORD: { title: "Password doesn't meet the policy", message: "Use at least 8 characters with upper and lower case letters, a number and a symbol." },
  AUTH_INVALID_CODE: { title: "Invalid code", message: "That verification code isn't right. Check your email and try again." },
  AUTH_CODE_EXPIRED: { title: "Code expired", message: "That verification code has expired. Request a new one." },
  AUTH_TOO_MANY_ATTEMPTS: { title: "Too many attempts", message: "Please wait a moment before trying again." },
  AUTH_OAUTH_CANCELLED: { title: "Google sign-in was cancelled", message: "You can try again or use email and password." },
  AUTH_OAUTH_UNAVAILABLE: { title: "Google sign-in is temporarily unavailable", message: "Try email and password or try again later." },
  AUTH_NOT_CONFIGURED: { title: "Authentication isn't configured", message: "The Cognito user pool or app client for this deployment is missing or wrong." },
  AUTH_NETWORK: { title: "Connection problem", message: "We couldn't reach the sign-in service. Check your connection and try again." },
  AUTH_UNKNOWN: { title: "Something went wrong", message: "Please try again." },
};

export function friendlyAuthError(code: AuthErrorCode): FriendlyAuthError {
  return { code, ...copy[code] };
}

/** Map Amplify/Cognito errors to friendly copy. Never surfaces raw AWS messages or stack traces. */
export function mapAuthError(e: unknown): FriendlyAuthError {
  const name = (e as { name?: string })?.name ?? "";
  const msg = (e as { message?: string })?.message ?? "";
  if (/NotAuthorizedException/i.test(name)) return friendlyAuthError(/attempts exceeded/i.test(msg) ? "AUTH_TOO_MANY_ATTEMPTS" : "AUTH_INVALID_CREDENTIALS");
  if (/UserNotConfirmedException/i.test(name)) return friendlyAuthError("AUTH_USER_NOT_CONFIRMED");
  if (/UsernameExistsException/i.test(name)) return friendlyAuthError("AUTH_USER_EXISTS");
  if (/UserNotFoundException/i.test(name)) return friendlyAuthError("AUTH_USER_NOT_FOUND");
  if (/InvalidPasswordException/i.test(name) || (/InvalidParameterException/i.test(name) && /password/i.test(msg))) return friendlyAuthError("AUTH_INVALID_PASSWORD");
  if (/CodeMismatchException/i.test(name)) return friendlyAuthError("AUTH_INVALID_CODE");
  if (/ExpiredCodeException/i.test(name)) return friendlyAuthError("AUTH_CODE_EXPIRED");
  if (/LimitExceededException|TooManyRequestsException|TooManyFailedAttemptsException/i.test(name)) return friendlyAuthError("AUTH_TOO_MANY_ATTEMPTS");
  if (/NetworkError|Network/i.test(name) || /Failed to fetch|network/i.test(msg)) return friendlyAuthError("AUTH_NETWORK");
  if (/OAuthSignInException|signInWithRedirect/i.test(name + msg)) return friendlyAuthError(/cancel|denied/i.test(msg) ? "AUTH_OAUTH_CANCELLED" : "AUTH_OAUTH_UNAVAILABLE");
  if (/ResourceNotFoundException|AuthUserPoolException|Auth UserPool not configured/i.test(name + msg)) return friendlyAuthError("AUTH_NOT_CONFIGURED");
  return friendlyAuthError("AUTH_UNKNOWN");
}
