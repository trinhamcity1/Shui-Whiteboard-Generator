import Link from "next/link";
import type { AccountResponse } from "@/lib/api";

export function AccountCard({ account }: { account: AccountResponse }) {
  return (
    <div className="rounded-2xl border border-line bg-paper-raised p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">Plan</p>
          <p className="font-display mt-1 text-2xl font-semibold text-ink">{account.tierName}</p>
        </div>
        <Link href="/pricing" className="text-sm font-semibold text-ink underline underline-offset-4">
          Change plan
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-6">
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">Credit balance</p>
          <p className="mt-1 text-xl font-semibold text-ink">{account.creditBalance.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">Max video length</p>
          <p className="mt-1 text-xl font-semibold text-ink">{account.maxLengthMinutes} min</p>
        </div>
      </div>

      <ul className="mt-6 flex flex-wrap gap-2 text-xs">
        <li className="rounded-full bg-paper px-3 py-1 text-ink-soft">
          Own script: ${account.baseCreditsPerMinute.toFixed(2)}/min
        </li>
        <li className="rounded-full bg-paper px-3 py-1 text-ink-soft">
          {account.topicCreditsPerMinute === null
            ? "Topic mode not included"
            : `Topic mode: $${account.topicCreditsPerMinute.toFixed(2)}/min`}
        </li>
        {account.verticalOnly && <li className="rounded-full bg-paper px-3 py-1 text-ink-soft">Vertical only</li>}
        {account.echoAccess && (
          <li className="rounded-full bg-accent-soft px-3 py-1 font-semibold text-ink">Echo style included</li>
        )}
      </ul>
    </div>
  );
}
