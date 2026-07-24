export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <div className="legal-eyebrow">
        <span className="dot" /> legal · privacy
      </div>
      <h1>Privacy Policy</h1>
      <p className="legal-meta">Last updated: July 24, 2026</p>

      <p>
        Whyl (“we”, “us”) provides a Chrome extension and dashboard that show short ads while you wait
        for AI tools to respond, and credits earnings to your account. This policy describes what we
        collect and why.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — email, name, password (hashed), optional company name, and
          role (earner / advertiser) when you create an account.
        </li>
        <li>
          <strong>Chat context for wait timing (on by default)</strong> — on supported AI chat sites
          (including ChatGPT), when <em>Improve wait timing</em> is enabled, we may collect chat
          context such as your prompts and the AI’s responses, plus related metadata (site/platform
          and timing). This setting is <strong>on by default</strong>. You can turn it off anytime on
          your Whyl dashboard. When it is off, we do not collect chat content.
        </li>
        <li>
          <strong>Extension session data</strong> — which supported AI site you are on, when an ad
          session starts/ends, which campaign was shown, and how long the ad was visible.
        </li>
        <li>
          <strong>Earnings &amp; referrals</strong> — credit balances, ad view history, and referral
          codes you use or share.
        </li>
        <li>
          <strong>Advertiser data</strong> — campaign creatives, budgets, and delivery stats you
          submit in the dashboard.
        </li>
      </ul>

      <h2>How we use data</h2>
      <ul>
        <li>Authenticate you and sync earnings between the extension and dashboard.</li>
        <li>Serve and measure ad views during AI wait times.</li>
        <li>
          Improve how well ads fit AI wait lengths and related product quality (only while
          <em>Improve wait timing</em> is on).
        </li>
        <li>Operate referral rewards and advertiser billing/delivery.</li>
        <li>Keep the service reliable (e.g. health checks, abuse prevention).</li>
      </ul>

      <h2>Improve wait timing (opt out)</h2>
      <p>
        Open your Whyl dashboard and turn off <strong>Improve wait timing</strong>. Ads and
        earnings still work. You may also request deletion of previously collected chat context by
        contacting us.
      </p>

      <h2>Permissions the extension uses</h2>
      <ul>
        <li>
          <strong>Host access</strong> on listed AI product sites plus our API/dashboard — to detect
          wait states, show the overlay, and (while Improve wait timing is on) use chat context for
          the purposes above.
        </li>
        <li>
          <strong>storage</strong> — save your login token and Improve wait timing preference locally.
        </li>
        <li>
          <strong>scripting / tabs / activeTab</strong> — inject Whyl into already-open AI tabs after
          install or reload.
        </li>
        <li>
          <strong>alarms</strong> — periodically wake the extension so the API stays responsive.
        </li>
      </ul>

      <h2>Sharing</h2>
      <p>
        We do not sell personal information. We may use infrastructure providers (e.g. hosting) that
        process data only to run Whyl. We may disclose information if required by law.
      </p>

      <h2>Retention &amp; deletion</h2>
      <p>
        Account, earnings, and (unless deleted earlier) chat-context records are kept while your
        account is active. Contact us to request deletion of your account and associated data.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about privacy:{' '}
        <a href="https://whyl-api-dashboard.onrender.com">whyl-api-dashboard.onrender.com</a>
      </p>
    </main>
  );
}
