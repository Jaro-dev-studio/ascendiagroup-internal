import React from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Jaro.dev Studio",
};

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-lg bg-card p-8 text-foreground shadow-md">
          <h1 className="mb-2 text-4xl font-bold">Privacy Policy</h1>
          <p className="mb-8 text-sm text-muted-foreground">
            Last Updated: December 26, 2024
          </p>

          <p className="mb-6 text-base">
            Jaro.dev (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is
            committed to protecting and respecting your privacy. This Privacy
            Policy explains how we collect, use, disclose, and safeguard your
            information when you use Jaro.dev Studio, our internal project
            management and client services platform (&quot;Service&quot;). This
            Service is exclusively available to Jaro.dev clients, employees, and
            contractors.
          </p>

          <p className="mb-8 text-base">
            Please read this Privacy Policy carefully. By accessing or using the
            Service, you acknowledge that you have read, understood, and agree
            to be bound by the terms of this Privacy Policy.
          </p>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">
              1. Information We Collect
            </h2>

            <h3 className="mb-2 text-xl font-medium">
              1.1 Personal Information
            </h3>
            <p className="mb-4 text-base">
              When you use our Service, we may collect the following types of
              personal information:
            </p>
            <ul className="mb-4 list-inside list-disc space-y-2">
              <li>
                <strong>Contact Information:</strong> Name, email address, phone
                number, and mailing address.
              </li>
              <li>
                <strong>Account Information:</strong> Username, password, and
                authentication tokens.
              </li>
              <li>
                <strong>Profile Information:</strong> Profile picture,
                preferences, company affiliation, and role.
              </li>
              <li>
                <strong>Business Information:</strong> Company name, project
                details, and billing information.
              </li>
              <li>
                <strong>Payment Information:</strong> Credit card details,
                billing address, and transaction history processed through
                Stripe.
              </li>
            </ul>

            <h3 className="mb-2 text-xl font-medium">1.2 Usage Data</h3>
            <p className="mb-4 text-base">
              We automatically collect certain information when you access and
              use the Service:
            </p>
            <ul className="mb-4 list-inside list-disc space-y-2">
              <li>
                <strong>Log Data:</strong> IP address, browser type, operating
                system, access times, and pages viewed.
              </li>
              <li>
                <strong>Device Information:</strong> Device type, unique device
                identifiers, and mobile network information.
              </li>
              <li>
                <strong>Usage Patterns:</strong> Features accessed, actions
                taken, and time spent on the Service.
              </li>
            </ul>

            <h3 className="mb-2 text-xl font-medium">
              1.3 Third-Party Platform Data
            </h3>
            <p className="mb-4 text-base">
              When you connect third-party services to our platform, we may
              collect data from those services as described below.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">
              2. Meta (Facebook/Instagram) API Data
            </h2>
            <p className="mb-4 text-base">
              Our Service integrates with Meta platforms (Facebook and
              Instagram) through the Meta Marketing API and other Meta APIs to
              provide advertising and marketing services. When you authorize
              this integration, we may access and process:
            </p>

            <h3 className="mb-2 text-xl font-medium">
              2.1 Data We Access from Meta
            </h3>
            <ul className="mb-4 list-inside list-disc space-y-2">
              <li>
                <strong>Ad Account Information:</strong> Ad account IDs, names,
                permissions, and settings.
              </li>
              <li>
                <strong>Campaign Data:</strong> Campaign performance metrics,
                ad creative content, targeting parameters, budgets, and
                schedules.
              </li>
              <li>
                <strong>Page Information:</strong> Facebook Page details,
                Instagram business account information, and associated metrics.
              </li>
              <li>
                <strong>Lead Data:</strong> Information submitted through Lead
                Ads including names, email addresses, phone numbers, and custom
                form responses.
              </li>
              <li>
                <strong>Insights and Analytics:</strong> Engagement metrics,
                reach, impressions, conversions, and audience demographics.
              </li>
              <li>
                <strong>Ad Library Data:</strong> Publicly available information
                about active advertisements.
              </li>
            </ul>

            <h3 className="mb-2 text-xl font-medium">
              2.2 How We Use Meta Data
            </h3>
            <ul className="mb-4 list-inside list-disc space-y-2">
              <li>
                To create, manage, and optimize advertising campaigns on your
                behalf.
              </li>
              <li>
                To provide analytics and performance reporting for your
                marketing activities.
              </li>
              <li>
                To process and manage leads generated through Meta Lead Ads.
              </li>
              <li>
                To provide strategic recommendations for improving campaign
                performance.
              </li>
              <li>
                To facilitate client communication regarding advertising
                activities.
              </li>
            </ul>

            <h3 className="mb-2 text-xl font-medium">
              2.3 Meta Data Retention and Deletion
            </h3>
            <p className="mb-4 text-base">
              We retain Meta platform data only as long as necessary to provide
              our services and in accordance with Meta&apos;s Platform Terms. Upon
              termination of services or upon your request, we will delete or
              anonymize Meta platform data within 30 days, except where
              retention is required by law.
            </p>

            <h3 className="mb-2 text-xl font-medium">
              2.4 Compliance with Meta Policies
            </h3>
            <p className="mb-4 text-base">
              Our use of Meta APIs complies with Meta&apos;s Platform Terms, Data
              Use Terms, and Developer Policies. We do not:
            </p>
            <ul className="mb-4 list-inside list-disc space-y-2">
              <li>
                Sell, license, or purchase data obtained from Meta or its
                services.
              </li>
              <li>
                Transfer Meta data to any ad network, data broker, or other
                advertising or monetization-related service.
              </li>
              <li>
                Place Meta data in a search engine or directory without explicit
                permission.
              </li>
              <li>
                Use Meta data for purposes beyond what users have explicitly
                authorized.
              </li>
              <li>
                Use Meta data to discriminate against individuals based on
                protected characteristics.
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">
              3. Google API Services
            </h2>
            <p className="mb-4 text-base">
              Our Service may integrate with Google APIs for authentication and
              calendar functionality. Jaro.dev&apos;s use and transfer to any
              other app of information received from Google APIs will adhere to
              the{" "}
              <a
                className="text-primary underline"
                href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <p className="mb-4 text-base">
              Google Workspace APIs are not used to develop, improve, or train
              generalized AI and/or ML models.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">
              4. How We Use Your Information
            </h2>
            <p className="mb-4 text-base">
              We use the information we collect for the following purposes:
            </p>
            <ul className="mb-4 list-inside list-disc space-y-2">
              <li>
                <strong>Service Delivery:</strong> To provide, maintain, and
                improve our project management and client services.
              </li>
              <li>
                <strong>Authentication:</strong> To verify your identity and
                manage access to the Service.
              </li>
              <li>
                <strong>Communication:</strong> To send administrative notices,
                project updates, and respond to inquiries.
              </li>
              <li>
                <strong>Analytics:</strong> To understand usage patterns and
                improve the Service.
              </li>
              <li>
                <strong>Billing:</strong> To process payments and manage
                invoicing.
              </li>
              <li>
                <strong>Legal Compliance:</strong> To comply with applicable
                laws, regulations, and legal processes.
              </li>
              <li>
                <strong>Advertising Services:</strong> To manage and optimize
                advertising campaigns on Meta platforms and other advertising
                networks.
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">
              5. How We Share Your Information
            </h2>
            <p className="mb-4 text-base">
              We do not sell your personal information. We may share your
              information in the following circumstances:
            </p>
            <ul className="mb-4 list-inside list-disc space-y-2">
              <li>
                <strong>Service Providers:</strong> With trusted third-party
                vendors who perform services on our behalf (e.g., Stripe for
                payment processing, Vercel for hosting, analytics providers).
              </li>
              <li>
                <strong>Platform Integrations:</strong> With Meta, Google, and
                other platforms when you authorize integrations.
              </li>
              <li>
                <strong>Legal Requirements:</strong> When required by law, legal
                process, or to protect our rights and the safety of others.
              </li>
              <li>
                <strong>Business Transfers:</strong> In connection with a
                merger, acquisition, or sale of assets.
              </li>
              <li>
                <strong>With Your Consent:</strong> When you have given explicit
                consent to share specific information.
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">
              6. Cookies and Tracking Technologies
            </h2>
            <p className="mb-4 text-base">
              We use cookies and similar tracking technologies to enhance your
              experience:
            </p>
            <ul className="mb-4 list-inside list-disc space-y-2">
              <li>
                <strong>Essential Cookies:</strong> Required for authentication
                and core functionality.
              </li>
              <li>
                <strong>Analytics Cookies:</strong> Help us understand how you
                use the Service (Google Analytics, Microsoft Clarity).
              </li>
              <li>
                <strong>Performance Cookies:</strong> Monitor and improve
                Service performance.
              </li>
            </ul>
            <p className="mb-4 text-base">
              You can manage cookie preferences through your browser settings.
              Note that disabling certain cookies may affect Service
              functionality.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">7. Data Security</h2>
            <p className="mb-4 text-base">
              We implement industry-standard security measures to protect your
              information:
            </p>
            <ul className="mb-4 list-inside list-disc space-y-2">
              <li>Encryption of data in transit using TLS/SSL.</li>
              <li>Secure authentication mechanisms.</li>
              <li>Regular security assessments and updates.</li>
              <li>Access controls limiting data access to authorized personnel.</li>
            </ul>
            <p className="mb-4 text-base">
              While we strive to protect your information, no method of
              transmission or storage is 100% secure. We cannot guarantee
              absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">8. Data Retention</h2>
            <p className="mb-4 text-base">
              We retain personal information for as long as necessary to provide
              our services and fulfill the purposes outlined in this policy. For
              clients, we typically retain project-related data for the duration
              of our business relationship and a reasonable period thereafter
              for legal and administrative purposes. You may request deletion of
              your data at any time, subject to legal retention requirements.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">9. Your Rights</h2>
            <p className="mb-4 text-base">
              Depending on your location, you may have the following rights
              regarding your personal information:
            </p>
            <ul className="mb-4 list-inside list-disc space-y-2">
              <li>
                <strong>Access:</strong> Request a copy of the personal
                information we hold about you.
              </li>
              <li>
                <strong>Correction:</strong> Request correction of inaccurate or
                incomplete information.
              </li>
              <li>
                <strong>Deletion:</strong> Request deletion of your personal
                information.
              </li>
              <li>
                <strong>Portability:</strong> Request your data in a structured,
                machine-readable format.
              </li>
              <li>
                <strong>Restriction:</strong> Request that we limit processing
                of your information.
              </li>
              <li>
                <strong>Objection:</strong> Object to processing of your
                information in certain circumstances.
              </li>
              <li>
                <strong>Revoke Authorization:</strong> Revoke access to
                connected third-party accounts (Meta, Google, etc.) at any time.
              </li>
            </ul>
            <p className="mb-4 text-base">
              To exercise any of these rights, please contact us at{" "}
              <a
                className="text-primary underline"
                href="mailto:support@jaro.dev"
              >
                support@jaro.dev
              </a>
              .
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">
              10. California Privacy Rights
            </h2>
            <p className="mb-4 text-base">
              California residents have additional rights under the California
              Consumer Privacy Act (CCPA), including the right to know what
              personal information we collect and how it is used, the right to
              delete personal information, and the right to opt-out of the sale
              of personal information. We do not sell personal information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">
              11. International Data Transfers
            </h2>
            <p className="mb-4 text-base">
              Our Service is operated in the United States. If you are located
              outside the United States, please be aware that your information
              may be transferred to, stored, and processed in the United States.
              By using the Service, you consent to this transfer.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">
              12. Children&apos;s Privacy
            </h2>
            <p className="mb-4 text-base">
              The Service is not intended for individuals under the age of 18.
              We do not knowingly collect personal information from children. If
              you believe we have collected information from a child, please
              contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">
              13. Changes to This Privacy Policy
            </h2>
            <p className="mb-4 text-base">
              We may update this Privacy Policy from time to time. We will
              notify you of any material changes by posting the updated policy
              on the Service and updating the &quot;Last Updated&quot; date.
              Your continued use of the Service after any changes indicates your
              acceptance of the updated Privacy Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">14. Contact Us</h2>
            <p className="mb-4 text-base">
              If you have any questions about this Privacy Policy or our data
              practices, please contact us:
            </p>
            <ul className="mb-4 list-inside list-disc space-y-2">
              <li>
                Email:{" "}
                <a
                  className="text-primary underline"
                  href="mailto:support@jaro.dev"
                >
                  support@jaro.dev
                </a>
              </li>
              <li>
                Website:{" "}
                <a
                  className="text-primary underline"
                  href="https://jaro.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  https://jaro.dev
                </a>
              </li>
            </ul>
          </section>

          <div className="mt-8 border-t border-border pt-6">
            <p className="text-sm text-muted-foreground">
              By using Jaro.dev Studio, you acknowledge that you have read,
              understood, and agreed to the terms and conditions of this Privacy
              Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
