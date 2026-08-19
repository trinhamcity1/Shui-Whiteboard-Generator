import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-ink-faint sm:flex-row">
        <p>&copy; {new Date().getFullYear()} Shui-WG.</p>
        <div className="flex gap-6">
          <Link href="/pricing" className="hover:text-ink-soft">
            Pricing
          </Link>
          <Link href="/docs" className="hover:text-ink-soft">
            API docs
          </Link>
          <Link href="/signup" className="hover:text-ink-soft">
            Sign up
          </Link>
        </div>
      </div>
    </footer>
  );
}
