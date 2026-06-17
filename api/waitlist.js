const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email, role, company } = req.body || {};

  if (!email || (role !== "watcher" && role !== "advertiser")) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  if (role === "advertiser" && !company) {
    res.status(400).json({ error: "Company name required for advertisers" });
    return;
  }

  const { error } = await supabase.from("waitlist").insert({
    email,
    role,
    company: role === "advertiser" ? company : null,
  });

  if (error) {
    if (error.code === "23505") {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }
    res.status(500).json({ error: "Could not save signup" });
    return;
  }

  res.status(200).json({ ok: true });
};
