export interface MatanUser {
  /** Stable Cognito `sub` - the future DynamoDB ownership key (never email or name). */
  id: string;
  email: string;
  name?: string;
  pictureUrl?: string;
  provider?: "cognito" | "google";
}

export interface AuthState {
  loading: boolean;
  authenticated: boolean;
  user: MatanUser | null;
}

export function firstNameOf(user: MatanUser | null | undefined) {
  const n = user?.name?.trim();
  if (n) return n.split(/\s+/)[0];
  return user?.email?.split("@")[0] ?? "";
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local[0]}***@${domain}`;
}
