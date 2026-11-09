import { Link } from "react-router-dom";
import LegalLayout from "../components/LegalLayout";

const CONTACT = "founder@syncagency.org";
const Mail = () => <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;

const SECTIONS = [
  {
    id: "who-we-are",
    title: "Who we are and what this policy covers",
    body: (
      <>
        <p>
          This Privacy Policy explains how Sync Agency ("Sync Agency", "we", "us" or "our"), an
          Australian business, collects, holds, uses, discloses and protects personal information. It
          applies to:
        </p>
        <ul>
          <li>our website at syncagency.org and any of its subdomains (the "Website");</li>
          <li>
            the Sync member portal and admin areas, including the dashboard, pathway, product slots,
            checkout, wallet, achievements, support and store connection features (the "Portal");
          </li>
          <li>our mobile apps for iOS and Android (the "App");</li>
          <li>
            our coaching, education, product supply and order fulfilment services, the Sync Plus
            subscription, and any related communications, including by email and in any
            member community channels we run (together, the "Services").
          </li>
        </ul>
        <p>
          "Personal information" has the meaning given in the <em>Privacy Act 1988</em> (Cth): information
          or an opinion about an identified individual, or an individual who is reasonably
          identifiable, whether true or not and whether recorded in a material form or not.
        </p>
        <p>
          We handle personal information in line with the Australian Privacy Principles ("APPs") in the
          Privacy Act. Where we are not legally required to comply with the Privacy Act (for example,
          because of the small business exemption), we choose to follow the APPs anyway as a standard
          of good practice.
        </p>
        <p>
          This policy should be read together with our <Link to="/terms">Terms of Service</Link>. By
          using the Services you acknowledge that you have read and understood this policy.
        </p>
      </>
    ),
  },
  {
    id: "summary",
    title: "Summary",
    body: (
      <>
        <div className="legal-callout">
          <ul>
            <li>We collect only what we need to provide the Services, take payment and fulfil orders.</li>
            <li>
              Card payments are handled by Stripe. We never see or store your full card number, expiry
              date or security code.
            </li>
            <li>
              We do not sell, rent or trade your personal information, and we do not use it for
              third-party advertising.
            </li>
            <li>
              We do not currently use advertising pixels, analytics trackers or marketing cookies on the
              Website, Portal or App.
            </li>
            <li>
              When you place a stock order, you give us the name and shipping address of your own
              customer so the item can be delivered to them. Section 5 explains how we handle that.
            </li>
            <li>
              You can access, correct or delete your information. You can delete your account at any time
              from the Portal (More &rarr; Delete account) or by emailing <Mail />.
            </li>
          </ul>
        </div>
      </>
    ),
  },
  {
    id: "what-we-collect",
    title: "The personal information we collect",
    body: (
      <>
        <p>
          The types of information we collect depend on how you interact with us. We collect the
          following categories.
        </p>

        <h3>3.1 Account and identity information</h3>
        <ul>
          <li>Your email address and password when you create an account. Passwords are stored by our authentication provider in hashed form; we cannot see your password.</li>
          <li>Your name, if you provide it to us or it is supplied through payment.</li>
          <li>Your account identifier, role (member or administrator), the date your account was created and the date and time you last signed in.</li>
          <li>Email confirmation status and authentication session tokens, which keep you signed in.</li>
        </ul>

        <h3>3.2 Purchase, membership and billing information</h3>
        <ul>
          <li>
            The plan or tier you purchased (for example Pro Accelerator, Elite Scale, VIP Inner Circle or
            Executive Partner), the billing type, the price you paid, the date of purchase, and whether
            your access is active, paused or ended.
          </li>
          <li>
            For purchases made on the Website before you have an account, a purchase record containing
            the email address you entered at checkout, the plan, the amount paid and a Stripe session
            reference. We use the email address to link the purchase to your account when you sign up
            with the same address.
          </li>
          <li>
            Stripe identifiers such as your Stripe customer ID, checkout session IDs, payment references
            and, if you subscribe to Sync Plus, your subscription ID, status, current billing period end
            date and whether it is set to cancel.
          </li>
          <li>
            Payment information you enter at checkout (such as card details, billing name, billing address
            and email) is collected and processed directly by Stripe, not by us. Stripe may share limited
            details with us, such as the last four digits of a card, card brand, country, and whether a
            payment succeeded, failed, was refunded or was disputed.
          </li>
          <li>Any promotion or discount codes you apply.</li>
        </ul>

        <h3>3.3 Wallet information</h3>
        <ul>
          <li>Your wallet balance, top-ups, bonus credit, debits, refunds and adjustments, with the date, amount, reason, related order and Stripe reference for each transaction.</li>
          <li>Any low-balance alert threshold you set, and when a low-balance alert was triggered.</li>
          <li>Holds placed on your balance for pending orders, and any promotional discounts you claim.</li>
        </ul>

        <h3>3.4 Order and fulfilment information</h3>
        <ul>
          <li>The products you order, quantities, prices, order totals, order status, payment method and tracking numbers.</li>
          <li>
            <strong>Your customer's details.</strong> For each item you order, the name and shipping
            address (address lines, city, state or region, postcode and country) of the person the item
            is being delivered to, who is usually a buyer from your own Depop store. See section 5.
          </li>
          <li>Notes and records created by our team when an order needs attention, such as supplier issues, delays, cancellations, refunds or delivery problems.</li>
        </ul>

        <h3>3.5 Portal activity and progress</h3>
        <ul>
          <li>Your progress through the pathway, including which steps are completed and when.</li>
          <li>The products assigned to your product slots, including bonus products.</li>
          <li>
            Achievements you submit and their status, including any screenshots or images you upload as
            proof. These images may themselves contain personal information, such as sales figures,
            usernames or your customers' details. Please crop or hide information that is not needed
            before uploading.
          </li>
          <li>Records of whether you have dismissed tutorials, pop-ups and notices.</li>
        </ul>

        <h3>3.6 Communications and support</h3>
        <ul>
          <li>Support tickets you open, including the subject, every message in the conversation, and timestamps.</li>
          <li>Emails you send us and our replies, including any refund requests and the evidence you provide with them.</li>
          <li>
            Messages and content you post in any member community channel we run, or send us on social
            media. These platforms are operated by third parties under their own privacy policies; we
            see what you choose to share with us there.
          </li>
          <li>Information you share during coaching calls. We do not record calls without telling you first.</li>
        </ul>

        <h3>3.7 Connected store information</h3>
        <p>
          Where the store connection feature is available to you and you choose to use it, we collect your
          store domain, connection status and health check times, the mapping between your store's
          products and Sync products, and the access credentials (API access token and secret) you
          provide. Credentials are stored encrypted and are not displayed back to you or to other members.
          Depending on the permissions granted, a connected store can give us access to your store's
          orders, including your customers' names and shipping addresses, so that we can fulfil those
          orders. We do not ask for, and you must never give us, your Depop password.
        </p>

        <h3>3.8 Referral information</h3>
        <p>
          If you arrive at the Website through a referral or affiliate link containing a code, that code
          is saved in your browser for 30 days and attached to any checkout you start, so that the
          referrer can be credited. The code identifies the referrer, not you.
        </p>

        <h3>3.9 Technical information</h3>
        <ul>
          <li>
            Information stored in your browser or app storage that the Services need to work: your sign-in
            session, your cart (including any shipping addresses entered before you pay), referral code,
            and display preferences.
          </li>
          <li>
            Standard server and security logs created automatically by our hosting, database and payment
            providers, which can include IP address, browser and device type, the pages or functions
            requested, and the date and time of the request.
          </li>
        </ul>

        <h3>3.10 Information we do not collect</h3>
        <p>
          We do not intentionally collect sensitive information (such as health information, racial or
          ethnic origin, political opinions, religious beliefs, sexual orientation, criminal records,
          biometric data or tax file numbers). Please do not send it to us. We do not collect your Depop
          password or your full payment card details.
        </p>
      </>
    ),
  },
  {
    id: "how-we-collect",
    title: "How we collect personal information",
    body: (
      <>
        <p>We collect personal information:</p>
        <ul>
          <li><strong>directly from you</strong>, when you create an account, buy a plan, top up your wallet, place an order, submit an achievement, contact support, email us, take part in a call, or post in our community;</li>
          <li><strong>from Stripe</strong>, when a payment, subscription, refund or dispute occurs;</li>
          <li><strong>from your connected store</strong>, if you connect one;</li>
          <li><strong>from you about other people</strong>, namely the customers whose shipping details you enter when ordering (see section 5);</li>
          <li><strong>automatically</strong>, through browser storage and the logs kept by our service providers when you use the Services.</li>
        </ul>
        <p>
          You can browse the public Website without giving us any personal information. You may choose to
          deal with us anonymously or under a pseudonym when making general enquiries. However, we cannot sell you a plan, run your account or fulfil orders without the
          information described in section 3.
        </p>
      </>
    ),
  },
  {
    id: "customer-information",
    title: "Information about your customers",
    body: (
      <>
        <p>
          When you place a stock order, you give us the name and shipping address of the person the item
          should be delivered to. That person is usually a buyer who purchased from your own store and has
          not dealt with Sync Agency directly.
        </p>
        <p>When you provide this information, you confirm that:</p>
        <ul>
          <li>you obtained it lawfully in the course of a genuine sale through your store;</li>
          <li>
            you are entitled to give it to us for the purpose of delivering that customer's order, and
            doing so is consistent with the terms of the platform you sold on and with any privacy notice
            you or that platform gave the customer;
          </li>
          <li>it is accurate and limited to what is needed for delivery.</li>
        </ul>
        <p>
          We use your customers' information <strong>only</strong> to source, pack, ship and track their
          order, to resolve delivery problems, and to keep records required by law or needed to handle
          disputes. We never contact your customers for marketing, never sell or share their information
          for anyone else's marketing, and never add them to any list. We share it only with the suppliers,
          logistics partners and carriers needed to deliver the order (section 7). If one of your
          customers contacts us about their information, we will handle the request under this policy and
          may let you know.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "How we use personal information",
    body: (
      <>
        <p>We use personal information for the following purposes:</p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr><th>Purpose</th><th>Information used</th></tr>
            </thead>
            <tbody>
              <tr><td>Creating and securing your account, signing you in, and confirming your email</td><td>Account and technical information</td></tr>
              <tr><td>Processing payments, linking purchases to your account, managing your plan, upgrades, and Sync Plus subscription</td><td>Account, purchase and billing information</td></tr>
              <tr><td>Providing coaching, the pathway, product slots, achievements and support</td><td>Account, portal activity, communications</td></tr>
              <tr><td>Operating your wallet, applying bonuses, discounts and promotions</td><td>Wallet and purchase information</td></tr>
              <tr><td>Sourcing, shipping, tracking and resolving issues with orders</td><td>Order information, including your customers' details</td></tr>
              <tr><td>Crediting referrers</td><td>Referral codes and purchase information</td></tr>
              <tr><td>Responding to enquiries, support tickets, refund requests and complaints</td><td>Communications and any related records</td></tr>
              <tr><td>Sending service messages (e.g. account confirmation, receipts, order updates, low-balance alerts, changes to our terms)</td><td>Email address and relevant records</td></tr>
              <tr><td>Preventing, detecting and investigating fraud, chargebacks, misuse and breaches of our terms</td><td>All relevant categories</td></tr>
              <tr><td>Improving the Services, fixing errors and planning new features</td><td>Usage and progress information, usually in aggregate</td></tr>
              <tr><td>Meeting legal, tax, accounting and regulatory obligations, and establishing or defending legal claims</td><td>All relevant categories</td></tr>
            </tbody>
          </table>
        </div>
        <h3>Marketing</h3>
        <p>
          We may send you news and offers about our own Services by email if you are a member or have
          bought from us, or if you have otherwise consented. Every marketing email will identify us and
          include a working way to unsubscribe, as required by the <em>Spam Act 2003</em> (Cth). You can
          opt out at any time by using the unsubscribe link or emailing <Mail />. You will still receive
          service messages that are necessary to run your account.
        </p>
        <h3>Use of your screenshots, achievements and feedback in marketing</h3>
        <p>
          We will <strong>not</strong> publish your name, image, screenshots, results, messages or feedback
          in any marketing, testimonial or public post unless you have given us express, specific consent
          for that use. Before publishing anything, we will remove or obscure your customers' personal
          information and any other information you ask us to remove. You can withdraw consent at any time
          by emailing <Mail />, and we will stop future use and remove the material from channels we
          control where reasonably possible.
        </p>
        <h3>Automated decisions</h3>
        <p>
          We do not make decisions that significantly affect you using only automated processing. Some
          features are automated (for example, distributing products between members' product slots), but
          they do not involve profiling you.
        </p>
      </>
    ),
  },
  {
    id: "disclosure",
    title: "Who we share personal information with",
    body: (
      <>
        <p>
          We do not sell, rent or trade personal information. We disclose it only as set out below, and
          only to the extent needed for the relevant purpose.
        </p>
        <h3>Service providers</h3>
        <ul>
          <li><strong>Stripe</strong> (payment processing, subscriptions, refunds and dispute handling). Stripe acts under its own privacy policy and is certified to PCI DSS Level 1.</li>
          <li><strong>Supabase</strong> (database, authentication, file storage and server functions), which hosts our account, order, wallet and portal data.</li>
          <li><strong>Our website hosting provider</strong>, which serves the Website and keeps standard access logs.</li>
          <li><strong>Email delivery providers</strong> used to send account confirmation and service emails.</li>
          <li>
            <strong>Suppliers, dropshipping and fulfilment partners</strong> (which may include CJ
            Dropshipping) and <strong>carriers</strong> (such as Australia Post and other couriers), which
            receive your customer's name and shipping address and the order contents so they can deliver
            the item.
          </li>
          <li>
            <strong>Professional advisers</strong>, such as accountants, lawyers and insurers, where
            needed.
          </li>
        </ul>
        <p>
          We require our service providers to use personal information only to provide services to us,
          and to keep it secure.
        </p>
        <h3>Other disclosures</h3>
        <ul>
          <li><strong>Referrers:</strong> if you purchase through a referral link, the referrer may be told that a purchase was made through their link. We do not give them your payment details.</li>
          <li><strong>Your connected store:</strong> if you connect a store, we send fulfilment and tracking information back to it.</li>
          <li><strong>Legal and safety:</strong> where required or authorised by law (for example, a court order, subpoena or a request from a regulator or law enforcement body), or where we reasonably believe disclosure is necessary to prevent a serious threat to someone's life, health or safety, or to investigate unlawful activity or serious misconduct.</li>
          <li><strong>Payment disputes:</strong> if you dispute a payment, we may give Stripe and the card issuer relevant records, such as your purchase, account activity, the access and materials provided to you, and our communications with you.</li>
          <li><strong>Business transfers:</strong> if all or part of our business is sold, restructured or merged, personal information may be transferred to the new owner, who will be required to handle it consistently with this policy.</li>
          <li><strong>With your consent:</strong> in any other case where you have agreed.</li>
        </ul>
      </>
    ),
  },
  {
    id: "overseas",
    title: "Overseas disclosure",
    body: (
      <>
        <p>
          Some of our service providers store or process information outside Australia. As a result, your
          personal information may be stored or accessed in countries including India (where our main
          database is hosted), the United States, the European Union, Singapore, and, for supplier and fulfilment purposes, China and other countries
          where products are manufactured, stored or shipped from. The location depends on the provider
          and on where the relevant data centre, supplier or carrier is located.
        </p>
        <p>
          Before disclosing personal information overseas, we take reasonable steps to ensure the recipient
          handles it in a way consistent with the APPs, such as by using reputable providers with
          contractual data protection commitments. Overseas recipients may be subject to foreign laws that
          could compel disclosure of information to foreign authorities.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies, local storage and tracking",
    body: (
      <>
        <p>
          We do not currently use advertising cookies, tracking pixels (such as Meta or TikTok pixels), or
          third-party analytics tools on the Website, Portal or App. We use your browser's local storage
          (or the equivalent storage in the App) only for things the Services need, namely:
        </p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead><tr><th>Item</th><th>Purpose</th><th>How long</th></tr></thead>
            <tbody>
              <tr><td>Sign-in session</td><td>Keeps you securely signed in</td><td>Until you sign out or the session expires</td></tr>
              <tr><td>Cart</td><td>Remembers items and shipping details before you pay</td><td>Until checkout is completed or the cart is cleared</td></tr>
              <tr><td>Referral code</td><td>Credits the person who referred you</td><td>30 days</td></tr>
              <tr><td>Display preferences</td><td>Remembers dismissed tutorials, pop-ups and notices</td><td>Until you clear your browser storage</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Stripe sets its own cookies on its checkout pages to process payments and prevent fraud, under
          Stripe's privacy and cookie policies. You can clear local storage and cookies through your
          browser settings, but the Services may not work properly without them.
        </p>
        <p>
          If we introduce analytics or advertising tools in the future, we will update this policy before
          doing so and, where required, ask for your consent.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "How we store and protect personal information",
    body: (
      <>
        <p>We take reasonable steps to protect personal information from misuse, interference, loss, and unauthorised access, modification or disclosure. These include:</p>
        <ul>
          <li>encryption of data in transit (HTTPS/TLS) across the Website, Portal and App;</li>
          <li>card payments handled entirely by Stripe, so card details never touch our systems;</li>
          <li>database access rules that restrict each member to their own records, with administrative access limited to authorised people;</li>
          <li>private storage for achievement screenshots, viewable by administrators only through short-lived links;</li>
          <li>encryption of stored store-connection credentials;</li>
          <li>hashed passwords managed by our authentication provider;</li>
          <li>limiting access to personal information to people who need it to do their job.</li>
        </ul>
        <p>
          No method of transmission or storage is completely secure, and we cannot guarantee absolute
          security. You are responsible for keeping your password confidential, using a strong, unique
          password, and telling us straight away if you suspect your account has been compromised.
        </p>
        <h3>Data breaches</h3>
        <p>
          If we become aware of a data breach that is likely to result in serious harm to anyone, we will
          act promptly to contain and assess it and, where the <em>Notifiable Data Breaches</em> scheme
          applies, notify affected individuals and the Office of the Australian Information Commissioner
          ("OAIC").
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep personal information",
    body: (
      <>
        <p>We keep personal information only for as long as we need it for the purposes in this policy, or as required by law. In general:</p>
        <ul>
          <li><strong>Account and portal information</strong> is kept while your account is open, and deleted when you delete your account, except as set out below.</li>
          <li><strong>Payment, purchase, wallet and order records</strong> are kept for at least 5 years after the transaction (and up to 7 years) because Australian tax and corporations laws require us to keep financial records.</li>
          <li><strong>Your customers' shipping details</strong> are kept only as long as reasonably needed to deliver the order and deal with returns, delivery problems, refunds and payment disputes, after which we delete or de-identify them, except where they form part of financial records we must keep.</li>
          <li><strong>Support conversations and refund correspondence</strong> are kept for as long as needed to resolve the matter and for a reasonable period afterwards to deal with any follow-up, complaint or dispute.</li>
          <li><strong>Referral codes</strong> stored in your browser expire after 30 days.</li>
          <li><strong>Server and security logs</strong> are kept by our providers for their standard retention periods.</li>
        </ul>
        <p>
          When information is no longer needed, we take reasonable steps to destroy or de-identify it.
          Copies may persist in backups for a limited period until they are overwritten.
        </p>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "Accessing, correcting and deleting your information",
    body: (
      <>
        <h3>Access</h3>
        <p>
          You can ask for access to the personal information we hold about you by emailing <Mail />. We
          will respond within a reasonable period, usually within 30 days. We will not charge you for
          making a request, but may charge a reasonable fee to cover the cost of providing access where
          the request is large or repeated. We may need to verify your identity first. In limited cases
          permitted by the Privacy Act we may refuse access (for example, where giving access would
          unreasonably affect another person's privacy or relates to a legal dispute), and we will tell
          you why in writing.
        </p>
        <h3>Correction</h3>
        <p>
          If you believe information we hold is inaccurate, out of date, incomplete, irrelevant or
          misleading, email <Mail /> and we will take reasonable steps to correct it. If we disagree, we
          will tell you why and, on request, note your view alongside the information.
        </p>
        <h3>Deletion</h3>
        <p>
          You can permanently delete your account at any time from the Portal under More &rarr; Delete
          account, or by emailing <Mail />. Deleting your account removes your access and erases your
          account, pathway progress, product slots, orders, support tickets and related portal data,
          except for records we must keep by law (such as financial and transaction records) or
          reasonably need to keep to resolve an outstanding dispute, chargeback, refund or suspected
          misuse. Deletion cannot be undone. If you have unused paid wallet credit, ask us to refund it before
          you delete your account, as set out in our <Link to="/terms">Terms of Service</Link>.
        </p>
        <h3>Marketing opt-out</h3>
        <p>You can unsubscribe from marketing emails at any time using the link in the email or by contacting us.</p>
        <h3>If you are outside Australia</h3>
        <p>
          The Services are designed for people in Australia. If you live elsewhere, you may have additional
          rights under your local law (for example, under the GDPR in the EU and UK, or state privacy laws
          in the United States). Contact us and we will respond in line with the law that applies to you.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        The Services are not directed at children. You must be at least 18 years old to buy a plan or
        create an account, or have the consent and supervision of a parent or guardian as set out in our
        Terms of Service. We do not knowingly collect personal information from children under 16. If you
        believe a child has given us personal information without appropriate consent, contact us and we
        will delete it.
      </p>
    ),
  },
  {
    id: "third-party-links",
    title: "Third-party sites and platforms",
    body: (
      <p>
        The Services link to and work with third-party platforms, including Depop, Stripe, social
        media and community platforms, and online stores. We are not affiliated with or endorsed by Depop. These
        platforms have their own privacy policies and we are not responsible for how they handle your
        information. Please read their policies before using them.
      </p>
    ),
  },
  {
    id: "complaints",
    title: "Questions and complaints",
    body: (
      <>
        <p>
          If you have a question about this policy or a complaint about how we have handled your personal
          information, please email <Mail /> with details. We will acknowledge your complaint within 7
          days and aim to resolve it within 30 days.
        </p>
        <p>
          If you are not satisfied with our response, you can complain to the Office of the Australian
          Information Commissioner (OAIC) at <a href="https://www.oaic.gov.au" target="_blank" rel="noreferrer">www.oaic.gov.au</a> or
          by phone on 1300 363 992.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        We may update this policy from time to time, for example when we add features, change service
        providers or when the law changes. The updated policy will be posted on this page with a new "Last
        updated" date. If a change materially affects how we handle your personal information, we will
        notify members by email or through the Portal before it takes effect.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    body: (
      <p>
        Sync Agency · Email: <Mail />. Please include "Privacy" in the subject line so we can direct your
        request quickly.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      updated="9 November 2026"
      intro={
        <p>
          Your privacy matters to us. This policy sets out, in plain English, what personal information
          Sync Agency collects, why we collect it, who we share it with, how long we keep it, and the
          choices and rights you have.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
