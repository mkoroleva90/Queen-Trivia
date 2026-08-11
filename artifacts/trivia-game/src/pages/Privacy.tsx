import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function Privacy() {
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

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-[#9aa6bc] text-sm mb-8">Last updated: August 11, 2026</p>

        <div className="space-y-8 text-[#c8d0df] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Introduction</h2>
            <p>
              Queen Trivia ("we", "us", or "our") operates the Queen Trivia mobile and web application
              (the "Service"). This Privacy Policy describes how we collect, use, and share information
              when you use our Service, and your choices regarding that information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Information We Collect</h2>
            <p className="mb-3">We collect the following types of information:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-white">Account information:</strong> When you register as a
                host, we collect your email address and a hashed version of your password. We never
                store your password in plain text.
              </li>
              <li>
                <strong className="text-white">Game data:</strong> Quizzes, questions, and game sessions
                you create or participate in, including player nicknames and answers submitted during
                games.
              </li>
              <li>
                <strong className="text-white">Usage data:</strong> Basic technical information such as
                device type, operating system version, and error logs to help us maintain and improve the
                Service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <p className="mb-3">We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide, operate, and maintain the Service</li>
              <li>Create and manage your host account</li>
              <li>Send account-related emails (verification, password reset)</li>
              <li>Diagnose technical issues and improve the Service</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Information Sharing</h2>
            <p className="mb-3">
              We do not sell your personal information. We may share your information only in these
              limited circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-white">Service providers:</strong> Third-party vendors who help
                us operate the Service (e.g. transactional email delivery), subject to confidentiality
                obligations.
              </li>
              <li>
                <strong className="text-white">Legal requirements:</strong> When required by law or to
                protect the rights and safety of our users or the public.
              </li>
            </ul>
            <p className="mt-3">
              Player nicknames and scores entered during a live game session are visible to other
              participants in that same game session.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Data Retention</h2>
            <p>
              We retain your account information for as long as your account is active. Game session data
              may be retained to provide score history and analytics to hosts. You may request deletion of
              your account and associated data by contacting us at the address below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Children's Privacy</h2>
            <p>
              The Service is not directed to children under the age of 13. We do not knowingly collect
              personal information from children under 13. If you believe a child has provided us
              personal information, please contact us so we can delete it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Security</h2>
            <p>
              We take reasonable technical and organizational measures to protect your information.
              Passwords are stored using industry-standard one-way hashing. However, no method of
              transmission or storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Your Rights</h2>
            <p className="mb-3">
              Depending on your location, you may have the right to access, correct, or delete your
              personal information. To exercise any of these rights, contact us at:
            </p>
            <p className="text-[#ff2d8e]">privacy@queen-trivia.com</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify registered hosts by
              email or in-app notice when we make material changes. Continued use of the Service after
              changes take effect constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us at{" "}
              <span className="text-[#ff2d8e]">privacy@queen-trivia.com</span>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-[#1b2740] text-sm text-[#9aa6bc]">
          <Link href="/terms" className="text-[#ff2d8e] hover:underline">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
