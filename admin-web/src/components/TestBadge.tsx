"use client";

/**
 * Handbook §2.1 L139: test records are labelled everywhere they appear.
 * Usage: `{row.isTest ? <TestBadge /> : null}` or `<TestBadge show={row.isTest} />`.
 */
export default function TestBadge({ show = true, className = "" }: { show?: boolean; className?: string }) {
  if (!show) return null;
  return (
    <span
      title="Test record — excluded from production metrics by default"
      className={`inline-flex items-center rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-violet-700 ring-1 ring-violet-200 ${className}`}
    >
      Test
    </span>
  );
}

export { TestBadge };
