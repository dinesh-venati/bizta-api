export interface JwtPayload {
  sub: string; // userId
  email: string;
  orgId: string; // Primary/active organization
  role: string; // Role in the active org
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
  };
}
