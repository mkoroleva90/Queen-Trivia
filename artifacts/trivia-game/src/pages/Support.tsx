import { Link } from "wouter";
import { COPY } from "@workspace/copy";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/Footer";

export default function Support() {
  return (
    <div className="min-h-[100dvh] bg-[#0a0c12] text-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/">
            <button className="flex items-center gap-2 text-[#9aa6bc] hover:text-white transition-colors text-sm">
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-2">{COPY.footer.support}</h1>
        <p className="text-[#9aa6bc] text-sm mb-8">{COPY.legal.support.tagline}</p>

        <div className="space-y-8 text-[#c8d0df] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{COPY.legal.support.contactTitle}</h2>
            <p>
              {COPY.legal.support.contactBody}
            </p>
            <p className="mt-3">
              <span className="text-[#ff2d8e]">{COPY.legal.support.email}</span>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{COPY.legal.support.reportTitle}</h2>
            <p className="mb-3">
              {COPY.legal.support.reportBody}
            </p>
            <ul className="list-disc pl-6 space-y-2">
              {COPY.legal.support.reportChecklist.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{COPY.legal.support.hostAccountsTitle}</h2>
            <p>
              {COPY.legal.support.hostAccountsPrefix}{" "}
              <span className="text-[#ff2d8e]">{COPY.legal.support.email}</span>{" "}
              {COPY.legal.support.hostAccountsSuffix}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{COPY.legal.support.contentTitle}</h2>
            <p>
              {COPY.legal.support.contentPrefix}{" "}
              <span className="text-[#ff2d8e]">{COPY.legal.support.email}</span>{" "}
              {COPY.legal.support.contentSuffix}
            </p>
          </section>
        </div>

      </div>
      <Footer />
    </div>
  );
}
