import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-label="Loading page"
    >
      <Loader2
        aria-hidden="true"
        className="h-8 w-8 animate-spin text-slate-500 motion-reduce:animate-none"
      />
      <span className="sr-only">Loading page</span>
    </div>
  );
}
