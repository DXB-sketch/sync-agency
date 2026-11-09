import { Link } from "react-router-dom";
import LegalLayout from "../components/LegalLayout";

const CONTACT = "founder@syncagency.org";
const Mail = () => <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;

const SECTIONS = [
  {
    id: "agreement",
    title: "About these terms",
    body: (
      <>
        <p>
          These Terms of Service ("Terms") are a legally binding agreement between you and Sync Agency
          ("Sync Agency", "we", "us" or "our"), an Australian business. They govern your access to and
          use of our website at syncagency.org (the "Website"), the Sync member portal (the "Portal"), our
          iOS and Android apps (the "App"), and all coaching, education, product supply, order
          fulfilment, wallet, subscription and related services we provide (together, the "Services").
        </p>
        <p>
          By creating an account, making a purchase, or otherwise using the Services, you confirm that you
          have read, understood and agree to these Terms and to our{" "}
          <Link to="/privacy">Privacy Policy</Link>. If you do not agree, do not use the Services.
        </p>
        <p>
          Nothing in these Terms excludes, restricts or modifies any right or remedy you have under the
          Australian Consumer Law in Schedule 2 of the <em>Competition and Consumer Act 2010</em> (Cth)
          (the "ACL") or any other law that cannot lawfully be excluded, restricted or modified. Every
          clause in these Terms must be read subject to this paragraph.
        </p>
      </>
    ),
  },
  {
    id: "definitions",
    title: "Definitions",
    body: (
      <ul>
        <li><strong>"Plan"</strong> means a coaching tier you purchase, currently Pro Accelerator, Elite Scale, VIP Inner Circle or Executive Partner, and any other tier we offer from time to time.</li>
        <li><strong>"Access Period"</strong> means the period during which you can use the Plan you purchased, as described in clause 7.2.</li>
        <li><strong>"Member"</strong> means a person with a Sync account who has purchased a Plan.</li>
        <li><strong>"Materials"</strong> means all content we make available, including the pathway, lessons, guides, frameworks, templates, product research, product drops, product lists, supplier information, videos, call content, community content, and the design and software of the Website, Portal and App.</li>
        <li><strong>"Products"</strong> means physical goods you order from us through the Portal for delivery to your customers.</li>
        <li><strong>"Your Store"</strong> means any online store or marketplace account you operate, including a Depop shop.</li>
        <li><strong>"Your Customer"</strong> means a person who buys from Your Store.</li>
        <li><strong>"Wallet"</strong> means the prepaid store-credit balance in your Portal account.</li>
        <li><strong>"Sync Plus"</strong> means our optional monthly subscription described in clause 10.</li>
        <li><strong>"Business day"</strong> means a day other than a Saturday, Sunday or public holiday in Queensland.</li>
      </ul>
    ),
  },
  {
    id: "eligibility",
    title: "Eligibility and your account",
    body: (
      <>
        <p>To use the Services you must:</p>
        <ul>
          <li>be at least 18 years old, or be at least 16 years old and have a parent or legal guardian who has read and agreed to these Terms on your behalf and who supervises your use of the Services and any purchases;</li>
          <li>be legally able to enter into a binding contract;</li>
          <li>meet the age and eligibility rules of Depop and any other platform you use to sell; and</li>
          <li>not have previously had an account suspended or terminated by us for breach of these Terms.</li>
        </ul>
        <p>You agree to:</p>
        <ul>
          <li>give us accurate, current and complete information, and keep it up to date;</li>
          <li>keep your password secure and not share your login with anyone;</li>
          <li>use the same email address at checkout and when creating your account so your purchase can be linked to you;</li>
          <li>tell us immediately at <Mail /> if you believe your account has been accessed without permission.</li>
        </ul>
        <p>
          Accounts are personal to you. You must not share, sell, transfer or lend your account or access to
          any other person. You are responsible for everything that happens under your account.
        </p>
      </>
    ),
  },
  {
    id: "services",
    title: "What Sync Agency provides",
    body: (
      <>
        <p>
          Sync Agency provides <strong>education, coaching, tools and product supply</strong> to help you
          learn how to start and run a dropshipping store, primarily on Depop. Depending on your Plan, the
          Services may include:
        </p>
        <ul>
          <li>access to the Portal, including the step-by-step pathway, achievements and support;</li>
          <li>product slots stocked by our team, product research and product drops;</li>
          <li>one-on-one calls, messaging support and store setup guidance;</li>
          <li>listing creation, store audits, pricing and strategy input and other hands-on help, as described for your Plan on the Website at the time of purchase;</li>
          <li>the ability to order Products through the Portal for delivery to Your Customers;</li>
          <li>access to any member community channels we run from time to time.</li>
        </ul>
        <p>
          The features included in each Plan are described on the Website at the time you purchase. We will
          provide the Services with due care and skill. Where a Plan describes support as "unlimited",
          "on-demand", "daily" or "priority", this means we will provide it reasonably and in good faith
          during our normal operating hours, subject to fair use, availability and our scheduling. It does not
          mean round-the-clock availability or that we will act on demands that are excessive, abusive or
          outside the scope of the Services.
        </p>
        <h3>Where we help run or manage your store</h3>
        <p>
          Where your Plan includes us creating listings, adjusting prices, overseeing daily operations or
          otherwise helping to run Your Store, we act on your behalf and at your direction. You remain the
          owner and operator of Your Store and are legally responsible for it, including for everything listed
          or sold, your dealings with Your Customers, and compliance with platform rules and the law. You
          must not give us your Depop password or any other platform login if doing so would breach that
          platform's rules, and we will never ask you to.
        </p>
        <h3>What we are not</h3>
        <p>Sync Agency is not:</p>
        <ul>
          <li>a financial, investment, tax, accounting or legal adviser. Nothing we provide is financial, investment, tax or legal advice, and you should get independent professional advice about your own circumstances;</li>
          <li>an employer, partner, franchisor or business opportunity. Buying a Plan does not make you our employee, contractor, partner, agent or franchisee, and does not entitle you to any income, wages, commission or share of profits;</li>
          <li>affiliated with, endorsed by, sponsored by or connected to Depop, Shopify, Stripe or any marketplace or supplier, unless we say so expressly. All trade marks belong to their respective owners.</li>
        </ul>
      </>
    ),
  },
  {
    id: "no-guarantee",
    title: "No guarantee of results or income",
    body: (
      <>
        <div className="legal-callout">
          <p>
            <strong>
              We do not promise, guarantee, represent or imply that you will make any sales, income or
              profit, that you will recover the cost of your Plan, or that you will achieve any particular
              result by using the Services.
            </strong>
          </p>
        </div>
        <p>You acknowledge and agree that:</p>
        <ul>
          <li>running any business involves risk. Many people who start a dropshipping or reselling business make little or no profit, and some lose money, including on Plans, Products, platform fees, shipping, returns and other costs;</li>
          <li>your results depend on many factors outside our control, including your own effort, time, skills, decisions and consistency, the products you choose, how you price and list them, competition, demand, seasonality, supplier performance, shipping times, platform fees and algorithms, platform policy changes and enforcement, and general economic conditions;</li>
          <li>any examples, figures, prices, margins or calculations shown on the Website, in the Portal, in the Materials or in calls (for example, an example sale price compared with a supplier cost) are illustrations only. They are not typical, expected or average results, and they usually do not account for every fee and cost;</li>
          <li>a product appearing in your product slots, in a product drop, or in any research we provide is not a promise that it will sell, will sell at a particular price, or will remain available or in demand;</li>
          <li>you are making your own decision to purchase, based on your own assessment, and you have not relied on any statement about earnings or results.</li>
        </ul>
        <p>
          Any statement about what members have done or may do is not a representation that you will achieve
          the same.
        </p>
      </>
    ),
  },
  {
    id: "platforms",
    title: "Depop and other third-party platforms",
    body: (
      <>
        <p>
          You are solely responsible for complying with the terms of service, seller policies, prohibited
          items lists, community guidelines and any other rules of Depop and every other platform, payment
          provider or marketplace you use ("Platform Rules"). Platform Rules can change at any time and are
          enforced by the platform, not by us.
        </p>
        <p>
          We do not control and are not responsible for any action a platform takes in relation to your
          account, including limiting visibility, removing listings, withholding or delaying payouts,
          suspending or banning your account, or changing its fees or features. We are not liable for any
          loss that results from such action, except to the extent it was caused by our own breach of these
          Terms or negligence.
        </p>
        <p>
          Guidance we give about selling on any platform reflects our understanding at the time and is
          general in nature. It is your responsibility to read and follow the current Platform Rules.
        </p>
      </>
    ),
  },
  {
    id: "plans-payment",
    title: "Plans, pricing, payment and access",
    body: (
      <>
        <h3>7.1 Prices and payment</h3>
        <ul>
          <li>All prices are in Australian dollars (AUD) and include GST where applicable.</li>
          <li>Payments are processed securely by Stripe. By paying, you also agree to Stripe's terms. We do not receive or store your full card details.</li>
          <li>Unless stated otherwise, Plans are a single one-off payment for the Access Period. Payment must be made in full before access is provided.</li>
          <li>Your bank or card issuer may charge fees (for example, international transaction fees). These are your responsibility.</li>
          <li>We may change our prices at any time. Price changes do not affect a Plan you have already paid for.</li>
          <li>Promotion and discount codes are subject to any conditions stated with them, can only be used once unless stated otherwise, have no cash value and cannot be applied retrospectively.</li>
        </ul>
        <h3>7.2 Lifetime access</h3>
        <p>
          Plans are sold as a single one-off payment with <strong>lifetime access</strong>. "Lifetime" means
          the lifetime of the Plan and of the Services, not your lifetime: you keep access to your Plan for as
          long as Sync Agency continues to offer that Plan and operate the Services, unless your access ends
          earlier under clause 14 (for example, because you delete your account or seriously breach these
          Terms). There is no recurring fee for a Plan.
        </p>
        <p>
          If we stop offering a Plan, we may move you to a replacement Plan with substantially equivalent or
          better features. If we stop operating the Services altogether, we will give you at least 30 days'
          notice and the protections in clause 14 apply.
        </p>
        <h3>7.3 Getting access</h3>
        <p>
          Access is normally available as soon as your payment is confirmed and you create (or sign in to) an
          account using the same email address you used at checkout. If your purchase does not appear in your
          account, contact us and we will link it once we have verified the purchase.
        </p>
        <h3>7.4 Upgrades</h3>
        <p>
          You may upgrade to a higher Plan through the Portal. The upgrade price, including any credit for the
          Plan you already hold, is shown before you pay. Upgrades take effect once payment is confirmed. You
          cannot downgrade to a lower Plan for a refund of the difference.
        </p>
        <h3>7.5 Changes to the Services</h3>
        <p>
          We continually improve the Services and may add, change or remove features, Materials, suppliers,
          products and tools over time. We will not make changes that materially reduce the core features of
          the Plan you paid for during your Access Period without a valid reason, such as changes required by
          law, by a platform or supplier, or for security. If we do, we will tell you, and you may be entitled
          to a remedy under clause 13 or the ACL.
        </p>
      </>
    ),
  },
  {
    id: "orders",
    title: "Product orders and fulfilment",
    body: (
      <>
        <h3>8.1 How ordering works</h3>
        <p>
          When one of Your Customers buys an item from Your Store, you may order the matching Product from us
          through the Portal and provide Your Customer's delivery details. We (or our suppliers and
          fulfilment partners) then source, pack and ship the Product directly to Your Customer. You pay us the
          price shown in the Portal at the time of your order, by card through Stripe or from your Wallet.
        </p>
        <h3>8.2 Your responsibilities as the seller</h3>
        <ul>
          <li>You, not Sync Agency, are the seller to Your Customer. You are responsible for your listings, descriptions, photos, prices, customer service, returns and refunds to Your Customer, and your obligations to Your Customer under the ACL and Platform Rules.</li>
          <li>You must describe Products accurately and must not make claims about a Product (for example, about its brand, materials, origin, condition, authenticity or delivery time) that are false or misleading.</li>
          <li>You must provide complete and accurate delivery details. We are not responsible for delays, non-delivery or extra costs caused by incorrect, incomplete or undeliverable details you provide, and re-shipping costs may be charged to you.</li>
          <li>You are responsible for any taxes, duties, income reporting and business registration that apply to your sales.</li>
          <li>You must have the right to give us Your Customer's personal information for delivery purposes, as described in our <Link to="/privacy">Privacy Policy</Link>.</li>
        </ul>
        <h3>8.3 Availability, pricing and delivery</h3>
        <ul>
          <li>Product availability, supplier costs and shipping times change frequently. Product prices in the Portal may change at any time before you place an order. An order is accepted only once it is paid for and confirmed.</li>
          <li>If a Product becomes unavailable after you order it, we will tell you and either offer a suitable alternative (only with your agreement) or cancel that item and refund the amount you paid for it, to your Wallet or original payment method.</li>
          <li>Delivery times shown are estimates only. Delays can occur due to suppliers, customs, carriers, weather, peak periods and other events outside our control.</li>
          <li>Tracking numbers are provided when available. Once a Product is handed to the carrier, we will help you deal with the carrier about any delivery issue.</li>
        </ul>
        <h3>8.4 Damaged, faulty, incorrect or lost Products</h3>
        <p>
          If a Product arrives damaged, faulty or not as ordered, or is lost in transit, you must tell us
          within <strong>14 days</strong> of the expected or actual delivery date, through Portal support or at{" "}
          <Mail />, with your order details and supporting evidence (such as clear photos of the item and
          packaging, the label, and Your Customer's message). Once verified, we will, at our option and
          consistent with the ACL, replace the Product, re-ship it, or refund the amount you paid for it.
          Change-of-mind returns by Your Customer are your responsibility.
        </p>
        <h3>8.5 Prohibited goods and intellectual property</h3>
        <p>
          We do not supply, and you must not use the Services to sell, counterfeit, replica or imitation
          branded goods, or any item that infringes anyone's trade mark, copyright, design or other
          intellectual property, or any item prohibited by law or by Platform Rules. You must not list any
          Product as being of a brand it is not. We may cancel any order and suspend your account if we
          reasonably believe you are doing so.
        </p>
      </>
    ),
  },
  {
    id: "wallet",
    title: "Wallet and store credit",
    body: (
      <>
        <ul>
          <li>The Wallet lets you prepay credit to use for Product orders and other purchases in the Portal. Top-ups are processed by Stripe.</li>
          <li><strong>Wallet funds are store credit only.</strong> They are not a bank account or deposit, do not earn interest, have no cash value, and cannot be withdrawn, transferred to another person, or exchanged for cash, except where we are required by law to do so.</li>
          <li>From time to time we may offer bonus credit, bonus percentages or discounts on top-ups or Wallet payments. Bonus credit and promotional credit are given free of charge, have no cash value, are not refundable in any circumstance, may be subject to conditions or expiry stated with the offer, and are used before or after paid credit as we determine.</li>
          <li>If an order paid from your Wallet is cancelled or refunded, the refund is credited back to your Wallet.</li>
          <li>While your account is open, paid Wallet top-ups are not refundable for change of mind. If you believe a top-up was charged in error, contact us at <Mail />.</li>
          <li>If you want to close your account, you can ask us at <Mail /> to refund your unused <em>paid</em> credit (not bonus or promotional credit) to your original payment method. Please do this before you delete your account, because deleting it removes your Wallet records from the Portal; any request must be made within 30 days of deletion.</li>
          <li>If we terminate your account under clause 14, we will refund your unused paid credit, less any amount you owe us (for example, from a reversed or disputed payment). Bonus and promotional credit ends when your account ends.</li>
          <li>We may correct any Wallet balance that is wrong because of an error, a reversed or disputed payment, or misuse.</li>
        </ul>
      </>
    ),
  },
  {
    id: "sync-plus",
    title: "Sync Plus subscription",
    body: (
      <>
        <h3>10.1 What it is</h3>
        <p>
          Sync Plus is an optional monthly subscription available to Members with an active Plan. Its
          current benefits, and its monthly price in AUD, are shown in the Portal before you subscribe. We may
          change the benefits or price with at least 30 days' notice; a price change applies from your next
          billing period after the notice period, and you may cancel before it takes effect.
        </p>
        <h3>10.2 Billing and renewal</h3>
        <p>
          <strong>
            Sync Plus renews automatically each month and your payment method will be charged the then-current
            price at the start of each billing period until you cancel.
          </strong>{" "}
          If a payment fails, we may retry it and may pause your Sync Plus benefits until payment succeeds.
        </p>
        <h3>10.3 Cancelling</h3>
        <p>
          You can cancel Sync Plus at any time from the Sync Plus page in the Portal or by emailing <Mail />.
          Cancellation stops future renewals. Your benefits continue until the end of the billing period you
          have already paid for, and you will not be charged again. We do not provide refunds or credits for
          partial billing periods, except where required by law or under clause 13.
        </p>
      </>
    ),
  },
  {
    id: "conduct",
    title: "Acceptable use",
    body: (
      <>
        <p>You must not, and must not help anyone else to:</p>
        <ul>
          <li>copy, record, download, screenshot for distribution, share, sell, resell, sublicense, publish or otherwise distribute the Materials, or share your account or login;</li>
          <li>use the Materials to create a competing course, coaching programme, product list or service;</li>
          <li>sell counterfeit, replica or infringing goods, or anything prohibited by law or Platform Rules;</li>
          <li>use the Services for any unlawful, fraudulent, deceptive or misleading purpose, including making false or misleading claims to Your Customers;</li>
          <li>harass, abuse, threaten or discriminate against our staff, other Members or anyone in our community;</li>
          <li>post spam, advertising, referral links or solicitations in our community without permission;</li>
          <li>interfere with, scrape, reverse engineer, overload or attempt to gain unauthorised access to the Website, Portal, App or our systems, or another Member's account;</li>
          <li>submit false or manipulated information or evidence, including in achievements, refund requests, delivery claims or payment disputes;</li>
          <li>misrepresent your relationship with Sync Agency, or make any claim on our behalf about income or results.</li>
        </ul>
      </>
    ),
  },
  {
    id: "ip",
    title: "Intellectual property",
    body: (
      <>
        <p>
          We (or our licensors) own all intellectual property rights in the Materials, the Website, the Portal,
          the App and our name and branding. Subject to these Terms and payment, we grant you a personal,
          limited, non-exclusive, non-transferable, revocable licence to access and use the Materials during
          your Access Period, solely to learn from them and to operate your own store. No other rights are
          granted.
        </p>
        <p>
          You keep ownership of the content you create, such as your listings and your achievement
          submissions. You grant us a non-exclusive licence to use that content as needed to provide the
          Services to you. We will only use your content, name, likeness or results in marketing with your
          express consent, as described in our <Link to="/privacy">Privacy Policy</Link>.
        </p>
        <p>
          If you send us suggestions or feedback about the Services, we may use them without any obligation to
          you.
        </p>
      </>
    ),
  },
  {
    id: "refunds",
    title: "Refund policy",
    body: (
      <>
        <div className="legal-callout">
          <p>
            <strong>
              All purchases are final and non-refundable, except as set out in this clause 13 or as required
              by the Australian Consumer Law.
            </strong>{" "}
            Because Plans give immediate access to our Materials, Portal, product slots and coaching,
            refunds are only granted in limited, genuine circumstances, and only after you contact us,
            discuss the request with us, and provide verifiable evidence that supports it.
          </p>
        </div>

        <h3>13.1 Your rights under the Australian Consumer Law</h3>
        <p>
          Our Services come with guarantees that cannot be excluded under the ACL. For services, you are
          entitled to a refund or other remedy if there is a major failure to provide the services with due
          care and skill, as described, or within a reasonable time, and to have other failures fixed or be
          compensated for them. For goods, you are entitled to a replacement or refund for a major failure and
          compensation for any other reasonably foreseeable loss or damage, and to have goods repaired or
          replaced if they fail to be of acceptable quality and the failure does not amount to a major failure.
          Nothing in this refund policy limits those rights.
        </p>

        <h3>13.2 What is not a valid reason for a refund</h3>
        <p>
          To the extent permitted by law, we do not give refunds, partial refunds or credits for any of the
          following:
        </p>
        <ul>
          <li><strong>Change of mind</strong>, including deciding the Services are not for you, no longer wanting them, or finding a cheaper alternative.</li>
          <li><strong>Not achieving the results you hoped for</strong>, including making no sales or less income or profit than you expected, or not recovering the cost of your Plan. As explained in clause 5, results are not guaranteed.</li>
          <li><strong>Claiming the method "doesn't work"</strong> without verifiable evidence that we failed to provide what your Plan included.</li>
          <li><strong>Not using the Services</strong>, or not completing the pathway, attending calls, following guidance or putting in the necessary time and effort.</li>
          <li><strong>Your personal circumstances changing</strong>, such as lack of time, finances, a new job or study commitments.</li>
          <li><strong>Action taken by Depop or any other platform</strong> against Your Store or account, including bans, restrictions, holds on payouts or listing removals, unless caused by our own breach or negligence.</li>
          <li><strong>Your breach of these Terms or Platform Rules</strong>, including sharing your account or Materials.</li>
          <li><strong>Unused portions of an Access Period</strong>, or the remainder of a Sync Plus billing period after cancellation.</li>
          <li><strong>Upgrading and then wanting to return to a lower Plan.</strong></li>
          <li><strong>Bonus or promotional credit</strong>, in any circumstance. (Unused <em>paid</em> Wallet credit is dealt with under clause 9.)</li>
        </ul>

        <h3>13.3 When a refund may be granted</h3>
        <p>A full or partial refund may be granted where you show, with verifiable evidence, that:</p>
        <ul>
          <li>we failed to provide a feature or service that was expressly included in your Plan at the time of purchase, and did not fix the failure within a reasonable time after you told us about it;</li>
          <li>you were charged twice, charged the wrong amount, or charged without authorisation;</li>
          <li>a Product you ordered was not delivered, or arrived damaged, faulty or not as ordered, under clause 8.4;</li>
          <li>you are otherwise entitled to a refund under the ACL.</li>
        </ul>

        <h3>13.4 How to request a refund</h3>
        <p>Refunds are only considered if you follow this process:</p>
        <ol>
          <li><strong>Email us</strong> at <Mail /> from the email address linked to your account, with the subject line "Refund request".</li>
          <li><strong>Include</strong> your full name, account email, the purchase or order concerned, the date of purchase, the amount, and a clear explanation of why you believe you are entitled to a refund.</li>
          <li><strong>Provide verifiable evidence</strong> supporting your claim, such as screenshots, dates and details of what was not provided, copies of messages showing you raised the issue with us, bank or card statements (for billing errors), or photos and tracking details (for Product issues). Statements without supporting evidence are not sufficient.</li>
          <li><strong>Discuss the request with us.</strong> We may ask questions, ask for more information, or ask to speak with you. In many cases we can fix the underlying issue, which is often the fastest outcome for you.</li>
        </ol>
        <p>
          We will acknowledge your request within 3 business days and aim to give you a decision within 14
          business days of receiving all the information we need. We will explain our decision in writing. If
          approved, refunds are made to the original payment method (or to your Wallet for Wallet payments)
          and may take 5 to 10 business days to appear, depending on your bank. Where we approve a partial
          refund, the amount will reflect the Services already provided and the nature of the failure. If a
          refund is approved for a Plan, your access to that Plan ends.
        </p>

        <h3>13.5 Payment disputes and chargebacks</h3>
        <p>
          Before disputing a charge with your bank or card issuer, please contact us at <Mail /> so we can try
          to resolve the issue directly. This does not limit any right you have to dispute a charge. If a
          chargeback or payment dispute is raised, we may suspend your access while it is investigated, and we
          will provide Stripe and your card issuer with relevant records, including evidence of your purchase,
          your acceptance of these Terms, your account activity, and the Services provided to you. If a
          dispute is resolved in our favour, you must pay any amount owing before access is restored. Raising
          a dispute you know to be false may be treated as a serious breach of these Terms.
        </p>
      </>
    ),
  },
  {
    id: "suspension",
    title: "Suspension and termination",
    body: (
      <>
        <p>
          <strong>By you:</strong> you may stop using the Services at any time and delete your account from
          the Portal (More &rarr; Delete account). Deleting your account ends your access permanently and does
          not entitle you to a refund, except under clause 13 or the ACL. Cancelling Sync Plus is covered by
          clause 10.3.
        </p>
        <p><strong>By us:</strong> we may suspend or terminate your access to all or part of the Services, with notice where reasonably practicable, if:</p>
        <ul>
          <li>you breach these Terms, including clause 11, and (if the breach can be fixed) do not fix it within 7 days of our notice;</li>
          <li>you commit a serious breach, such as sharing or reselling Materials, selling counterfeit goods, fraud, submitting false evidence, or abusing our staff or community, in which case we may act immediately;</li>
          <li>a payment is reversed, disputed or not completed;</li>
          <li>we are required to do so by law, a court, a regulator, a payment provider or a platform; or</li>
          <li>we reasonably believe your use of the Services creates a legal, security or reputational risk to us or others.</li>
        </ul>
        <p>
          If we terminate your access because of your breach, you are not entitled to a refund except where
          required by law. If we terminate your access for a reason that is not your fault, or stop operating
          the Services altogether within 2 years of your purchase, we will give you reasonable notice and a
          fair partial refund of the price you paid for your Plan, calculated pro rata over that 2-year
          period, and refund any unused paid Wallet credit.
        </p>
        <p>
          Clauses that by their nature should survive termination, including clauses 5, 9, 12, 13, 15, 16 and
          19, continue to apply after termination.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "Disclaimers and limitation of liability",
    body: (
      <>
        <p>
          Subject to clause 1 and the ACL, and to the maximum extent permitted by law:
        </p>
        <ul>
          <li>the Services are provided on an "as available" basis. We do not warrant that the Website, Portal or App will be uninterrupted, error-free or free of harmful components, although we take reasonable care to keep them secure and working;</li>
          <li>all terms, conditions, warranties and guarantees that are not expressly set out in these Terms and that may lawfully be excluded are excluded;</li>
          <li>we are not liable for any indirect or consequential loss, or for any loss of profits, revenue, income, business, opportunity, goodwill or data, however arising;</li>
          <li>we are not liable for any loss caused by third parties, including Depop or other platforms, suppliers, carriers, payment providers or other Members, except to the extent caused by our own breach or negligence;</li>
          <li>our total liability to you for all claims arising out of or in connection with the Services or these Terms is limited to the total amount you paid us in the 12 months before the event giving rise to the claim.</li>
        </ul>
        <p>
          Where our liability for failing to comply with a consumer guarantee under the ACL can lawfully be
          limited, and the goods or services are not of a kind ordinarily acquired for personal, domestic or
          household use, our liability is limited (at our option) to supplying the services again or paying
          the cost of having them supplied again, or replacing or repairing the goods or paying the cost of
          doing so.
        </p>
        <p>Our liability is reduced to the extent any loss is caused or contributed to by you.</p>
      </>
    ),
  },
  {
    id: "indemnity",
    title: "Indemnity",
    body: (
      <p>
        To the extent permitted by law, you indemnify us against any claim, loss, liability, cost or expense
        (including reasonable legal costs) that we incur arising from: your breach of these Terms or of
        Platform Rules; any listing, statement or sale you make to Your Customers; any claim by Your Customer
        or a platform relating to Your Store; your sale of counterfeit or infringing goods; or your unlawful,
        fraudulent or negligent conduct. Your liability under this clause is reduced to the extent the loss
        was caused by our own breach or negligence.
      </p>
    ),
  },
  {
    id: "communications",
    title: "Communications",
    body: (
      <p>
        You agree to receive communications from us electronically, by email, and in the Portal or App. Notices we send to the email address linked to your account are taken to be received
        when sent, unless we receive a delivery failure. Notices to us must be sent to <Mail />. You can
        opt out of marketing emails at any time, but not service messages needed to run your account.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these Terms",
    body: (
      <p>
        We may update these Terms from time to time. The updated Terms will be posted on this page with a new
        "Last updated" date. If a change materially and adversely affects you, we will notify you by email or
        in the Portal at least 14 days before it takes effect. Changes do not apply retrospectively to
        purchases already made, except where needed to comply with the law. If you do not agree with a
        change, you should stop using the Services before it takes effect; your continued use after that
        date means you accept the updated Terms.
      </p>
    ),
  },
  {
    id: "disputes",
    title: "Complaints, disputes and governing law",
    body: (
      <>
        <p>
          If you have a complaint, please email <Mail /> first. We will try in good faith to resolve it with
          you within 30 days. This does not prevent either of us seeking urgent relief from a court, or you
          contacting a consumer protection agency such as the Office of Fair Trading Queensland, your local
          fair trading agency, or the ACCC.
        </p>
        <p>
          These Terms are governed by the laws of Queensland, Australia. Each party submits to the
          non-exclusive jurisdiction of the courts of Queensland and the courts entitled to hear appeals from
          them.
        </p>
      </>
    ),
  },
  {
    id: "general",
    title: "General",
    body: (
      <ul>
        <li><strong>Entire agreement:</strong> these Terms, the Privacy Policy and the Plan description shown at the time of purchase are the entire agreement between you and us about the Services.</li>
        <li><strong>Severability:</strong> if any part of these Terms is invalid or unenforceable, it is read down or severed to the extent needed, and the rest continues in effect.</li>
        <li><strong>No waiver:</strong> a failure or delay in enforcing a right is not a waiver of that right.</li>
        <li><strong>Assignment:</strong> you may not transfer your rights under these Terms. We may assign them as part of a sale or restructure of our business, provided your rights are not adversely affected.</li>
        <li><strong>Events outside our control:</strong> we are not liable for delay or failure caused by events beyond our reasonable control, such as platform outages, supplier or carrier failures, natural disasters, pandemics or government action, but we will take reasonable steps to minimise the effect.</li>
        <li><strong>Interpretation:</strong> headings are for convenience only. "Including" and similar words do not limit what else may be included.</li>
      </ul>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    body: (
      <p>
        Sync Agency · Email: <Mail />. For refunds, use the subject line "Refund request" and follow clause
        13.4.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      updated="9 November 2026"
      intro={
        <p>
          Please read these Terms carefully. They explain what Sync Agency provides, what we don't promise,
          how payments and access work, and our refund policy (clause 13). In short:{" "}
          <strong>
            Sync Agency is education and coaching. Results and income are not guaranteed, and purchases are
            non-refundable except in the limited cases in clause 13 or as required by the Australian Consumer
            Law.
          </strong>
        </p>
      }
      sections={SECTIONS}
    />
  );
}
