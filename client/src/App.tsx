import { useEffect, useState } from "react";

interface Health {
  status: string;
  uptime: number;
}

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        return res.json() as Promise<Health>;
      })
      .then(setHealth)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Request failed"),
      );
  }, []);

  return (
    <main>
      <h1>Help Desk</h1>
      {error && <p className="error">Cannot reach the API: {error}</p>}
      {!error && !health && <p>Checking the API…</p>}
      {health && (
        <p className="ok">
          API is <strong>{health.status}</strong> — up{" "}
          {Math.round(health.uptime)}s
        </p>
      )}
    </main>
  );
}
