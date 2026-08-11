import { Link } from "wouter";
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

        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-[#9aa6bc] text-sm mb-8">Last updated: August 11, 2026</p>

        <div className="space-y-8 text-[#c8d0df] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By creating an account or using Queen Trivia (the "Service"), you agree to be bound by
              these Terms of Service ("Terms"). If you do not agree, do not use the Service. These Terms
              apply to all hosts, players, and visitors.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. The Service</h2>
            <p>
              Queen Trivia provides a platform for creating and hosting live trivia games. Hosts create
              quizzes and manage game sessions; players join using a room code and participate via their
              device. We reserve the right to modify or discontinue the Service at any time with
              reasonable notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Accounts</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                You must provide a valid email address when registering and verify it before signing in.
              </li>
              <li>
                You are responsible for maintaining the confidentiality of your password and for all
                activity that occurs under your account.
              </li>
              <li>
                You must notify us immediately of any unauthorized use of your account.
              </li>
              <li>
                You must be at least 13 years old to create an account.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Acceptable Use</h2>
            <p className="mb-3">You agree not to use the Service to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Post or transmit content that is unlawful, harmful, threatening, abusive, defamatory, or otherwise objectionable</li>
              <li>Harass, intimidate, or discriminate against any person or group</li>
              <li>Violate any applicable law or regulation</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Use automated tools to scrape, crawl, or otherwise extract data from the Service without our consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Content</h2>
            <p>
              You retain ownership of any quiz content you create. By submitting content to the Service,
              you grant us a non-exclusive, royalty-free license to store, display, and deliver that
              content as necessary to operate the Service. You are solely responsible for ensuring your
              content does not infringe third-party intellectual property rights or violate applicable
              laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Termination</h2>
            <p>
              We may suspend or terminate your account at any time for violations of these Terms or for
              any other reason at our discretion. You may delete your account at any time by contacting
              us. Provisions of these Terms that by their nature should survive termination shall
              survive.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS
              OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR
              NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR
              FREE OF HARMFUL COMPONENTS.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR
              USE OF THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with applicable law. Any disputes
              arising under these Terms shall be resolved through binding arbitration or in a court of
              competent jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify registered hosts by email or
              in-app notice of material changes. Continued use of the Service after changes take effect
              constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Contact Us</h2>
            <p>
              Questions about these Terms? Contact us at{" "}
              <span className="text-[#ff2d8e]">legal@queen-trivia.com</span>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-[#1b2740] text-sm text-[#9aa6bc]">
          <Link href="/privacy" className="text-[#ff2d8e] hover:underline">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
