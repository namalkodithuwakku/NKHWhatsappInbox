const baseUrl = () => {
  const value = process.env.SUPABASE_URL;
  if (!value) throw new Error("SUPABASE_URL is not configured");
  return value.replace(/\/$/, "");
};

const secretKey = () => {
  const value = process.env.SUPABASE_SECRET_KEY;
  if (!value) throw new Error("SUPABASE_SECRET_KEY is not configured");
  return value;
};

export async function supabaseRest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = secretKey();
  const response = await fetch(`${baseUrl()}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase ${response.status}: ${details}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
