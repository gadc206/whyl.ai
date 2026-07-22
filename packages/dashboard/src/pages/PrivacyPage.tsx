export default function PrivacyPage() {
  return (
    <main className="privacy-page" style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px', lineHeight: 1.55 }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: 8 }}>WHYL Privacy Policy</h1>
      <p style={{ opacity: 0.7, marginBottom: 28 }}>Last updated: July 21, 2026</p>

      <p>
        WHYL (“we”, “us”) provides a Chrome extension and dashboard that show short ads while you wait
        for AI tools to respond, and credits earnings to your account. This policy describes what we
        collect and why.
      </p>

      <h2 style={{ fontSize: '1.15rem', marginTop: 28 }}>What we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — email, name, password (hashed), optional company name, and
          role (earner / advertiser) when you create an account.
        </li>
        <li>
          <strong>Extension session data</strong> — which supported AI site you are on (e.g. ChatGPT,
          Claude), when an ad session starts/ends, which campaign was shown, and how long the ad was
          visible. We do <em>not</em> upload your prompts, chat contents, or AI responses.
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

      <h2 style={{ fontSize: '1.15rem', marginTop: 28 }}>How we use data</h2>
      <ul>
        <li>Authenticate you and sync earnings between the extension and dashboard.</li>
        <li>Serve and measure ad views during AI wait times.</li>
        <li>Operate referral rewards and advertiser billing/delivery.</li>
        <li>Keep the service reliable (e.g. health checks, abuse prevention).</li>
      </ul>

      <h2 style={{ fontSize: '1.15rem', marginTop: 28 }}>Permissions the extension uses</h2>
      <ul>
        <li>
          <strong>Host access</strong> only on listed AI product sites plus our API/dashboard — to
          detect wait states and show the overlay.
        </li>
        <li>
          <strong>storage</strong> — save your login token locally in Chrome.
        </li>
        <li>
          <strong>scripting / tabs / activeTab</strong> — inject WHYL into already-open AI tabs after
          install or reload.
        </li>
        <li>
          <strong>alarms</strong> — periodically wake the extension so the API stays responsive.
        </li>
      </ul>

      <h2 style={{ fontSize: '1.15rem', marginTop: 28 }}>Sharing</h2>
      <p>
        We do not sell personal information. We may use infrastructure providers (e.g. hosting) that
        process data only to run WHYL. We may disclose information if required by law.
      </p>

      <h2 style={{ fontSize: '1.15rem', marginTop: 28 }}>Retention &amp; deletion</h2>
      <p>
        Account and earnings records are kept while your account is active. Contact us to request
        deletion of your account and associated data.
      </p>

      <h2 style={{ fontSize: '1.15rem', marginTop: 28 }}>Contact</h2>
      <p>
        Questions about privacy: use the contact option on{' '}
        <a href="https://whyl-api-dashboard.onrender.com">whyl-api-dashboard.onrender.com</a> or email
        the address listed on your Chrome Web Store listing.
      </p>
    </main>
  );
}
