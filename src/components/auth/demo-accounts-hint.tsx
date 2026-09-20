import { DEFAULT_DEMO_PASSWORD, OWNER_PASSWORD, OWNER_USERNAME } from "@/lib/mock-data";

const DEMO_ACCOUNTS = [
  { role: "Admin", email: "avery.santos@remoteco.com" },
  { role: "Staff", email: "jonas.cruz@remoteco.com" },
];

export function DemoAccountsHint() {
  return (
    <div className="mt-5 flex flex-col gap-3">
      <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="mb-1.5 font-medium text-foreground">Demo accounts (mock data, no email yet)</p>
        {DEMO_ACCOUNTS.map((acc) => (
          <p key={acc.email}>
            <span className="font-medium text-foreground">{acc.role}:</span> {acc.email}
          </p>
        ))}
        <p className="mt-1">
          Password: <span className="font-medium text-foreground">{DEFAULT_DEMO_PASSWORD}</span>
        </p>
      </div>

      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-muted-foreground">
        <p className="mb-1.5 font-medium text-foreground">Owner access (master account)</p>
        <p>
          Username: <span className="font-medium text-foreground">{OWNER_USERNAME}</span>
        </p>
        <p>
          Password: <span className="font-medium text-foreground">{OWNER_PASSWORD}</span>
        </p>
        <p className="mt-1">Signs in as the system owner and is also the master password for edits/deletes.</p>
      </div>
    </div>
  );
}
