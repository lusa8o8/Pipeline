import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

type AppNavProps = {
  email?: string | null;
};

export function AppNav({ email }: AppNavProps) {
  return (
    <nav className="flex items-center justify-between border-b border-gray-200 p-4 text-sm">
      <div className="flex items-center gap-4">
        <Link href="/today" className="underline">
          Today
        </Link>
        <Link href="/dashboard" className="underline">
          Dashboard
        </Link>
      </div>
      <div className="flex items-center gap-4">
        {email ? <span>{email}</span> : null}
        <SignOutButton />
      </div>
    </nav>
  );
}
