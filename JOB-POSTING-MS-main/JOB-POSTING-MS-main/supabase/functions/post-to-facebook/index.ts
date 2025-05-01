
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { title, company, location, description, salary_range } = await req.json()

    const pageId = Deno.env.get('FACEBOOK_PAGE_ID')
    const pageAccessToken = Deno.env.get('FACEBOOK_PAGE_ACCESS_TOKEN')

    if (!pageId || !pageAccessToken) {
      throw new Error('Facebook configuration is missing')
    }

    // Create the post message
    const message = `🔥 New Job Opening!\n\n` +
      `Position: ${title}\n` +
      `Company: ${company}\n` +
      `Location: ${location}\n` +
      (salary_range ? `Salary Range: ${salary_range}\n\n` : '\n') +
      `${description}`

    // Post to Facebook
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}/feed`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          access_token: pageAccessToken,
        }),
      }
    )

    const data = await response.json()
    
    if (!response.ok) {
      console.error('Facebook API error:', data)
      throw new Error('Failed to post to Facebook')
    }

    return new Response(
      JSON.stringify({ success: true, facebook_post_id: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
