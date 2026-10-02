import type { MatterDigest } from "@/lib/types";

export default function DigestFooter({ digest }: { digest: MatterDigest }) {
  const { usage, lastExtractedAt } = digest;
  return (
    <footer className="mt-10 border-t pt-3 text-xs text-neutral-500">
      {lastExtractedAt && <>Last extracted {new Date(lastExtractedAt).toLocaleString()} · </>}
      {usage.calls} model calls · {(usage.inputTokens + usage.outputTokens).toLocaleString()} tokens
      {usage.estimatedUsd !== null && <> · ≈ ${usage.estimatedUsd}</>}
    </footer>
  );
}
