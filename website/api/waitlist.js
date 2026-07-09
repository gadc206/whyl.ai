const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "waitlist: missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY env vars"
    );
    res.status(500).json({ error: "Server misconfigured: Supabase env vars not set" });
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

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

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
    console.error("waitlist: supabase insert failed:", error);
    res.status(500).json({ error: "Could not save signup" });
    return;
  }

  res.status(200).json({ ok: true });
};
