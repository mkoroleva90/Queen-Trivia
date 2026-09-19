import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { COPY } from "@workspace/copy";

/** Unmatched-route page. Same copy as the mobile +not-found screen. */
export default function NotFound() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-[#0a0c12] text-white px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#1b2740] bg-[#0a1019] p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="h-8 w-8 text-[#ff6b6b]" />
          <h1 className="text-2xl font-bold">{COPY.notFound.title}</h1>
        </div>
        <p className="text-sm text-[#9aa6bc]">{COPY.notFound.body}</p>
        <p className="mt-4">
          <Link href="/" className="text-sm font-medium text-[#ff2d8e] hover:underline">
            {COPY.notFound.link}
          </Link>
        </p>
      </div>
    </div>
  );
}
