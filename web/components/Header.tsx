import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight text-ink">
          Shui-WG
        </Link>
        <nav className="flex items-center gap-8 text-sm font-medium text-ink-soft">
          <Link href="/pricing" className="hover:text-ink">
            Pricing
          </Link>
          <Link href="/docs" className="hover:text-ink">
            Docs
          </Link>
          <Link href="/signin" className="hover:text-ink">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:bg-accent"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
