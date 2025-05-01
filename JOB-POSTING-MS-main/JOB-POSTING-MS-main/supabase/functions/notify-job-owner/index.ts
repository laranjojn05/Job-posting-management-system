
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

// For fetching files and database info
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Helper fetcher for Supabase (public anon key)
const supabaseFetcher = async (path: string, method = 'GET') => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${SUPABASE_ANON_KEY!}`,
    },
  });
  return res.json();
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { post_owner_id, applicant_id, job_post_id, resume_url, message } = await req.json();
    const resend = new Resend(RESEND_API_KEY);

    // Fetch job posting
    const [job] = await supabaseFetcher(`job_posts?id=eq.${job_post_id}&select=title,company,user_id`);
    if (!job) throw new Error("Job post not found");

    // Fetch email of job owner (assume email stored in auth.users) using Supabase admin API
    const userRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${post_owner_id}`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${SUPABASE_ANON_KEY!}`,
        }
      }
    );
    const userMeta = await userRes.json();
    if (!userMeta?.email) throw new Error("Job owner's email not found");

    // Get applicant email
    const applicantRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${applicant_id}`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${SUPABASE_ANON_KEY!}`,
        }
      }
    );
    const applicantMeta = await applicantRes.json();
    const applicantEmail = applicantMeta?.email || "a job seeker";

    // Prepare email
    let resumeText = "No resume attached.";
    if (resume_url) {
      resumeText = `
      Resume file (not public): <br>
      <code>${resume_url}</code>
      <br>
      (The admin panel can access this file in the resumes bucket.)
      `;
      // Optionally, could generate a signed URL here if storage bucket is private.
    }

    const result = await resend.emails.send({
      from: "JobPortal <onboarding@resend.dev>",
      to: [userMeta.email],
      subject: `New Application for "${job.title}" at ${job.company}`,
      html: `
        <p>Hello,</p>
        <p>You have a new job application from <b>${applicantEmail}</b> for your job post: <b>${job.title} at ${job.company}</b>.</p>
        <p><b>Message from applicant:</b></p>
        <p>${message}</p>
        <p>${resumeText}</p>
        <hr/>
        <small>This is an automated notification from the Job Board.</small>
      `,
    });

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Unexpected error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
