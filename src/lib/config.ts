function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name} (add it to .env.local)`);
  return value;
}

export const config = {
  clioBase: process.env.CLIO_BASE_URL ?? "https://app.clio.com",
  clientId: () => required("CLIO_CLIENT_ID"),
  clientSecret: () => required("CLIO_CLIENT_SECRET"),
  redirectUri: () => required("CLIO_REDIRECT_URI"),
};
