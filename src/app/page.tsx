import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6">
      <main className="max-w-md w-full text-center space-y-8 animate-fade-in">
        <div className="space-y-3">
          <h1 className="text-4xl font-serif font-bold tracking-tight text-[var(--foreground)]">
            Goon Squad
          </h1>
          <p className="text-lg text-[var(--muted)] font-serif italic">
            &ldquo;Time&rsquo;s a goon, right?&rdquo;
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/signup"
            className="block w-full py-3 px-6 rounded-lg bg-coral text-white font-medium text-center transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="block w-full py-3 px-6 rounded-lg border border-[var(--border)] text-[var(--foreground)] font-medium text-center transition-colors hover:bg-[var(--surface)]"
          >
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
