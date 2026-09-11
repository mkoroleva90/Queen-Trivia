import { Link } from "wouter";
import { COPY } from "@workspace/copy";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
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

        <h1 className="text-3xl font-bold mb-2">{COPY.footer.termsOfService}</h1>
        <p className="text-[#9aa6bc] text-sm mb-8">{COPY.legal.lastUpdated}</p>

        <div className="space-y-8 text-[#c8d0df] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{COPY.legal.terms.s1Title}</h2>
            <p>
              {COPY.legal.terms.s1Body}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{COPY.legal.terms.s2Title}</h2>
            <p>
              {COPY.legal.terms.s2Body}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{COPY.legal.terms.s3Title}</h2>
            <ul className="list-disc pl-6 space-y-2">
              {COPY.legal.terms.accounts.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{COPY.legal.terms.s4Title}</h2>
            <p className="mb-3">{COPY.legal.terms.s4Intro}</p>
            <ul className="list-disc pl-6 space-y-2">
              {COPY.legal.terms.acceptableUse.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{COPY.legal.terms.s5Title}</h2>
            <p>
              {COPY.legal.terms.s5Body}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{COPY.legal.terms.s6Title}</h2>
            <p>
              {COPY.legal.terms.s6Body}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{COPY.legal.terms.s7Title}</h2>
            <p>
              {COPY.legal.terms.s7Body}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{COPY.legal.terms.s8Title}</h2>
            <p>
              {COPY.legal.terms.s8Body}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{COPY.legal.terms.s9Title}</h2>
            <p>
              {COPY.legal.terms.s9Body}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{COPY.legal.terms.s10Title}</h2>
            <p>
              {COPY.legal.terms.s10Body}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{COPY.legal.terms.s11Title}</h2>
            <p>
              {COPY.legal.terms.s11Prefix}{" "}
              <span className="text-[#ff2d8e]">{COPY.legal.terms.email}</span>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-[#1b2740] text-sm text-[#9aa6bc]">
          <Link href="/privacy" className="text-[#ff2d8e] hover:underline">
            {COPY.footer.privacyPolicy}
          </Link>
        </div>
      </div>
    </div>
  );
}
