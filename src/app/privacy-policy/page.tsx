import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - Quotation & Invoicing",
  description: "Privacy policy for the Quotation & Invoicing Management System",
};

export default function PrivacyPolicy() {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-6">
        Privacy Policy
      </h1>

      <div className="prose max-w-none text-slate-800">
        <p>
          Last updated: October 2026
        </p>

        <h2 className="text-2xl font-medium text-slate-800 mt-8 mb-4">
          Overview
        </h2>
        <p>
          Quotation & Invoicing Management System (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the
          Quotation & Invoicing Management System service. This page informs you of
          our policies regarding the collection, use, and disclosure of personal
          data when you use our service.
        </p>

        <h2 className="text-2xl font-medium text-slate-800 mt-8 mb-4">
          Information Collection and Use
        </h2>
        <p>
          For a better experience, while using our Service, we may require us to
          collect some personally identifiable information. The information we
          collect includes:
        </p>
        <ul>
          <li>
            <strong>Personal data:</strong> Email address, name, and company
            information provided during account creation.
          </li>
          <li>
            <strong>Usage data:</strong> Information about how the Service is
            accessed and used, such as browser type, IP address, time stamp,
 and pages visited.
          </li>
          <li>
            <strong>Cookies:</strong> We use cookies to enhance the user
            experience.
          </li>
        </ul>

        <h2 className="text-2xl font-medium text-slate-800 mt-8 mb-4">
          Use of Data
        </h2>
        <p>
          The data we collect is used for:
        </p>
        <ul>
          <li>Providing and maintaining the Service</li>
          <li>Notifying about changes to our Service</li>
          <li>Managing your account</li>
          <li>Performing analysis about how the Service is used</li>
          <li>Valuable data to improve the Service</li>
          <li>Monitoring the usage of the Service</li>
          <li>Detecting, preventing, and addressing technical issues</li>
        </ul>

        <h2 className="text-2xl font-medium text-slate-800 mt-8 mb-4">
          Data Retention
        </h2>
        <p>
          We will retain your personal data only as long as necessary for the
          purposes set out in this privacy policy. We will retain and use your
          information to the extent necessary to comply with our legal
          obligations, resolve disputes, and enforce our agreements.
        </p>

        <h2 className="text-2xl font-medium text-slate-800 mt-8 mb-4">
          Children&apos;s Privacy
        </h2>
        <p>
          Our Service does not address anyone under the age of 18. We do not
          knowingly collect personal identifiable information from children under
          18. If you are a parent or guardian and you are aware that your child
          has provided us with personal data, please contact us. If we become
          aware that we have collected personal data from children under 18
          without verifiable parental consent, we will remove that information
          from our servers immediately.
        </p>

        <h2 className="text-2xl font-medium text-slate-800 mt-8 mb-4">
          Changes to This Privacy Policy
        </h2>
        <p>
          We may update our Privacy Policy from time to time. We will notify you
          of any changes by posting the new Privacy Policy on this page. We
          advise you to review this Privacy Policy periodically for any changes.
          Changes to this Privacy Policy are effective when they are posted on
          this page.
        </p>

        <h2 className="text-2xl font-medium text-slate-800 mt-8 mb-4">
          Contact Us
        </h2>
        <p>
          If you have any questions about this Privacy Policy, you can contact
          us:
        </p>
        <ul>
          <li>Email: privacy@yourdomain.com</li>
          <li>Address: Your Company Address</li>
        </ul>
      </div>
    </div>
  );
}