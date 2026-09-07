import { useSession } from "@/lib/auth-client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATS = [
  { label: "Open", hint: "Awaiting an agent" },
  { label: "Resolved", hint: "Answered this week" },
  { label: "Closed", hint: "No further action" },
];

export default function HomePage() {
  const { data: session } = useSession();
  const name = session?.user.name ?? "there";

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <main className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back, {name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's the state of the queue.
        </p>

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {STATS.map((s) => (
            <Card key={s.label}>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">—</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Ticket data isn't wired up yet — these are placeholders.
        </p>
      </main>
    </div>
  );
}
