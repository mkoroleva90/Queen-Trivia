import { Link } from "wouter";
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

        <h1 className="text-3xl font-bold mb-2">Support</h1>
        <p className="text-[#9aa6bc] text-sm mb-8">We're here to help</p>

        <div className="space-y-8 text-[#c8d0df] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Contact Us</h2>
            <p>
              For any questions, issues, or feedback about Queen Trivia, reach out to us directly
              by email. We aim to respond within one business day.
            </p>
            <p className="mt-3">
              <span className="text-[#ff2d8e]">support@queen-trivia.com</span>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">How to Report a Problem</h2>
            <p className="mb-3">
              If you've encountered a bug, an unexpected error, or inappropriate content in a game,
              please include the following in your message so we can investigate quickly:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>A brief description of what happened and what you expected to happen</li>
              <li>The game code or topic name, if relevant</li>
              <li>The device and browser (or app version) you were using</li>
              <li>Any error messages you saw on screen</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Host Accounts</h2>
            <p>
              If you're having trouble with your host account — such as a missing verification email,
              a password reset that didn't arrive, or difficulty signing in — email us at{" "}
              <span className="text-[#ff2d8e]">support@queen-trivia.com</span> with your registered
              email address and we'll get you sorted.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Content Concerns</h2>
            <p>
              Queen Trivia includes a content filter to prevent offensive material from appearing in
              games. If you see something that slipped through, please report it to{" "}
              <span className="text-[#ff2d8e]">support@queen-trivia.com</span> and we'll review it
              promptly.
            </p>
          </section>
        </div>

      </div>
      <Footer />
    </div>
  );
}
