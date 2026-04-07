import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';

function getClient(overrideKey) {
  const apiKey = overrideKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('No Anthropic API key configured. Set ANTHROPIC_API_KEY env var or provide via Settings.');
  return new Anthropic({ apiKey });
}

async function handleResearch(req, res) {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const client = getClient(req.headers['x-api-key-override']);
  const prompt = `You are an expert funeral home researcher. Analyze the provided funeral home website and extract key information.

Website URL: ${url}

Visit and research this funeral home website. Extract and return ONLY valid JSON (no markdown, no extra text) with this exact structure:
{
  "business_name": "funeral home name",
  "owner_name": "owner name if found, otherwise just 'the team'",
  "phone": "phone number",
  "address": "street address",
  "city": "city",
  "state": "state abbreviation",
  "services": ["service1", "service2", "service3"],
  "locations": [{"name": "location name", "address": "address", "area": "service area"}],
  "unique_selling_points": "key differentiators or specialties",
  "service_area": "geographic service area",
  "tagline": "a brief tagline or motto",
  "website_url": "${url}"
}

Extract real information from the website. If you cannot access the website, make reasonable inferences based on the URL and best practices for funeral homes in that region.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse JSON response from Claude');
  return res.status(200).json(JSON.parse(jsonMatch[0]));
}

async function handleGeneratePrompt(req, res) {
  const research = req.body.research || req.body;
  if (!research || !research.business_name) return res.status(400).json({ error: 'Research data with business_name is required' });

  const client = getClient(req.headers['x-api-key-override']);
  const prompt = `You are creating a system prompt for Sarah AI, a compassionate funeral home assistant chatbot.

Create a complete system prompt for a funeral home chatbot based on this information:
- Business: ${research.business_name}
- Owner/Team: ${research.owner_name || 'the team'}
- Phone: ${research.phone}
- Address: ${research.address}, ${research.city}, ${research.state}
- Services: ${(research.services || []).join(', ')}
- Service Area: ${research.service_area || 'local area'}
- Locations: ${(research.locations || []).map(l => l.name).join(', ')}
- Unique Points: ${research.unique_selling_points}
- Website: ${research.website_url}

Generate a comprehensive system prompt that:
1. Establishes identity as Sarah, the funeral home assistant for ${research.business_name}
2. Sets a tone that is natural, empathetic, clear, and direct
3. Includes strict style rules: never use emojis, never use em dashes, never use markdown, avoid marketing jargon, use simple compassionate language
4. Defines conversation paths: immediate_need, pre_planning, obituary, general
5. Establishes scope guardrails: keep conversations focused on funeral services and grief support
6. Info capture discipline: collect name, phone, and service needs when helping with arrangements
7. Refusal/abuse protection: politely decline non-funeral topics

Return ONLY the system prompt text, nothing else. No markdown, no code blocks, just the plain prompt.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const sarahPrompt = message.content[0].type === 'text' ? message.content[0].text : '';
  if (!sarahPrompt || sarahPrompt.length < 100) throw new Error('Generated prompt is too short or empty');
  return res.status(200).json({ prompt: sarahPrompt });
}

async function handleGenerateDemo(req, res) {
  const { research, sarahPrompt } = req.body;
  if (!research || !sarahPrompt) return res.status(400).json({ error: 'Research data and sarahPrompt are required' });

  const client = getClient(req.headers['x-api-key-override']);
  const htmlPrompt = `You are an expert HTML/CSS designer creating a beautiful funeral home website demo.

Based on this funeral home information, generate a complete, single-file HTML page with embedded Sarah AI chatbot:

Business: ${research.business_name}
Owner: ${research.owner_name}
Phone: ${research.phone}
Address: ${research.address}, ${research.city}, ${research.state}
Services: ${(research.services || []).join(', ')}
Locations: ${(research.locations || []).map(l => l.name + ' - ' + l.address).join('; ')}
Tagline: ${research.tagline}
Website: ${research.website_url}

Design requirements:
- Single, complete HTML file with inline CSS and inline JavaScript
- Modern, elegant design for a funeral home
- Color scheme: primary #1e3a5f, dark #142842, accent #BD8656
- Fonts: Cormorant Garamond for headings, Lato for body
- Header with Mortem AI demo banner (subtle, top-right corner)
- Navigation bar with Home, Services, Locations, Contact
- Hero section with tagline and embedded Sarah chat widget
- Services section listing all services
- Locations section with map placeholders
- Footer with contact info and copyright
- Sarah chat widget that:
  a. Appears in the hero section as a beautiful chat panel
  b. Has a message input and chat history display
  c. Calls the Anthropic API directly from the browser using fetch
  d. Uses the header 'anthropic-dangerous-direct-browser-access': 'true'
  e. Uses model 'claude-sonnet-4-20250514'
  f. Replaces DEMO_KEY_PLACEHOLDER with actual API key during deployment
  g. Uses the provided system prompt for Sarah
- Responsive design for mobile and desktop
- Smooth animations and transitions

Return ONLY the complete, valid HTML string. No markdown, no code blocks, no explanations. Start with <!DOCTYPE html> and end with </html>.

Sarah AI System Prompt:
${sarahPrompt}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: htmlPrompt }],
  });

  let html = message.content[0].type === 'text' ? message.content[0].text : '';
  if (html.includes('```html')) html = html.replace(/```html\n?/, '').replace(/\n?```/, '');
  else if (html.includes('```')) html = html.replace(/```\n?/, '').replace(/\n?```/, '');
  html = html.trim();
  if (!html.startsWith('<!DOCTYPE')) throw new Error('Generated HTML does not start with <!DOCTYPE');
  return res.status(200).json({ html });
}

async function handleDeploy(req, res) {
  const { html, siteName } = req.body;
  if (!html || !siteName) return res.status(400).json({ error: 'HTML content and siteName are required' });

  const netlifyToken = req.headers['x-netlify-token-override'] || process.env.NETLIFY_TOKEN;
  if (!netlifyToken) return res.status(500).json({ error: 'Netlify token not configured. Add it in Settings or set NETLIFY_TOKEN env var.' });

  const headers = { Authorization: `Bearer ${netlifyToken}`, 'Content-Type': 'application/json' };

  let siteId;
  const listResponse = await fetch(`https://api.netlify.com/api/v1/sites?name=${siteName}&filter=all`, { method: 'GET', headers });
  if (listResponse.ok) {
    const sites = await listResponse.json();
    const existingSite = sites.find(s => s.name === siteName);
    if (existingSite) siteId = existingSite.id;
  }

  if (!siteId) {
    const createResponse = await fetch('https://api.netlify.com/api/v1/sites', { method: 'POST', headers, body: JSON.stringify({ name: siteName }) });
    if (!createResponse.ok) { const errBody = await createResponse.text(); throw new Error(`Failed to create site (${createResponse.status}): ${errBody}`); }
    const siteData = await createResponse.json();
    siteId = siteData.id;
  }

  const htmlBuffer = Buffer.from(html, 'utf-8');
  const sha1 = crypto.createHash('sha1').update(htmlBuffer).digest('hex');

  const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, { method: 'POST', headers, body: JSON.stringify({ files: { '/index.html': sha1 } }) });
  if (!deployResponse.ok) { const errBody = await deployResponse.text(); throw new Error(`Failed to create deploy (${deployResponse.status}): ${errBody}`); }
  const deployData = await deployResponse.json();
  const deployId = deployData.id;

  const uploadResponse = await fetch(`https://api.netlify.com/api/v1/deploys/${deployId}/files/index.html`, { method: 'PUT', headers: { Authorization: `Bearer ${netlifyToken}`, 'Content-Type': 'application/octet-stream' }, body: htmlBuffer });
  if (!uploadResponse.ok) { const errBody = await uploadResponse.text(); throw new Error(`Failed to upload file (${uploadResponse.status}): ${errBody}`); }

  await new Promise(resolve => setTimeout(resolve, 2000));
  return res.status(200).json({ url: `https://${siteName}.netlify.app`, site_id: siteId, deploy_id: deployId });
}

async function handleMeetingPrep(req, res) {
  const { research, demoUrl, contactName, contactRole } = req.body;
  if (!research || !research.business_name) return res.status(400).json({ error: 'Research data with business_name is required' });

  const client = getClient(req.headers['x-api-key-override']);
  const contact = contactName || research.owner_name || 'the owner';
  const role = contactRole || 'Owner/Director';

  const prompt = `You are an expert sales strategist and HTML designer at Mortem AI. Create a comprehensive, beautifully designed meeting prep document as a single HTML file. Write this like a senior sales strategist who has deeply researched this prospect, not like a template filler. Include specific details you can infer. Be bold with reasonable inferences rather than vague.

This document is for Tom at Mortem AI to prepare for a sales meeting with a funeral home prospect.

FUNERAL HOME DATA:
- Business: ${research.business_name}
- Contact: ${contact} (${role})
- Phone: ${research.phone || 'Not found'}
- Address: ${research.address || ''}, ${research.city || ''}, ${research.state || ''}
- Services: ${(research.services || []).join(', ')}
- Locations: ${(research.locations || []).map(l => l.name + ' - ' + (l.address || l.area || '')).join('; ')}
- Service Area: ${research.service_area || 'local area'}
- Unique Points: ${research.unique_selling_points || 'N/A'}
- Website: ${research.website_url || ''}
- Tagline: ${research.tagline || ''}
${demoUrl ? '- Live Demo: ' + demoUrl : ''}

DESIGN REQUIREMENTS:
- Single complete HTML file with all CSS inline in a <style> block
- Fonts: Cormorant Garamond for headings (serif), DM Sans for body (sans-serif) via Google Fonts
- Use a CSS class prefix based on the business initials (e.g. .mm- for Mission Memorials) to namespace all classes
- All colors must use !important to ensure compatibility
- Color palette: derive a professional palette from the funeral home brand. Use a dark navy primary (#0f1d2e or similar), a warm accent gold/bronze (#c8a96e or similar), cream backgrounds (#faf8f5 or similar)
- No CSS variables - use direct color values with !important
- Clean, elegant, print-friendly layout
- Max width container around 900px, centered
- Subtle borders and dividers between sections

DOCUMENT STRUCTURE (follow this exactly):

1. BRANDED HEADER
   - Mortem AI logo on the left: https://storage.googleapis.com/msgsndr/KwHyQsuzPI6o5CiZfPfN/media/689ef6fa5dc21c2e15d6807f.png
   - Document title: "Meeting Preparation: ${research.business_name}"
   - Date and subtitle
   - If a demo URL exists, include a prominent link to it

2. CONTACT PROFILE
   - Name: ${contact}
   - Role: ${role}
   - Research their likely background for a funeral home professional in ${research.city || ''}, ${research.state || ''}
   - Infer their likely career path. What matters to someone in their position? What keeps them up at night? (staffing costs, family succession planning, digital literacy, competing with chain funeral homes, maintaining tradition while modernizing?)
   - Include detailed talking points specific to this person and their likely concerns
   - What would resonate with someone at their career stage?

3. COMPANY OVERVIEW
   - Infer the founding decade and generation ownership (family business? second gen? third gen?)
   - Community ties and reputation (how long have they been serving this community?)
   - Estimated growth trajectory and company size
   - All locations with addresses and service areas
   - Services offered with details
   - Key differentiators compared to chains
   - Why would a family choose them over competitors?

4. CURRENT DIGITAL STATE AUDIT
   - Deep analysis of their current website: mobile responsiveness, page load times, user experience
   - SEO signals: are they ranking for local searches? Do they have Google Business profile?
   - Online booking capability: can families schedule consultations online?
   - Chat functionality: do they have any 24/7 contact options?
   - Google Business profile completeness: reviews count, response rate, photos
   - Current gaps in digital presence
   - Where AI chatbot would add immediate value for them

5. GAP ANALYSIS
   - Structure as a comparison table with columns: "What Families Need", "Current State", "With Sarah AI"
   - What families searching for funeral services in their area actually need
   - Where the current digital experience falls short
   - How Sarah AI fills these gaps (24/7 availability, compassionate responses, appointment booking, FAQ handling, immediate answers to common questions, contact capture after hours)
   - Make each row specific to their business

6. COMPETITIVE CONTEXT
   - Name 3-5 real or likely competitors in ${research.city || ''}, ${research.state || ''} area
   - Research what you can infer about their digital presence
   - Are they using technology? Do they have online booking? Chat features?
   - Opportunity for ${research.business_name} to be an early adopter of AI
   - Competitive advantage analysis

7. ROI MATH
   - Provide specific formulas and detailed calculations
   - Average funeral service value: $7,000-$12,000 (use $9,500 as middle estimate)
   - Estimated missed after-hours inquiries per month (infer from business size)
   - Current conversion rate for inquiries, projected improvement with 24/7 AI response
   - Monthly ROI projection with both conservative and optimistic scenarios in table format
   - Table columns: Month, New Leads, Conversion Rate, Avg Service Value, Revenue, Sarah Cost, Net ROI
   - Show clear payback period
   - Include break-even analysis

8. TALK TRACKS
   - These should be extremely specific and conversational, not generic
   - Each subsection with clear header

   OPENING:
   - Exact opening lines referencing the prospect's specifics
   - Something that shows you've done homework on their business
   - Reference to their community presence or reputation

   DISCOVERY QUESTIONS:
   - Real dialogue, not bulleted questions
   - What are they currently using for after-hours inquiries?
   - How do families currently reach them at 11pm on a Saturday?
   - What feedback do they hear from families about contacting them?
   - How much time do staff spend on routine FAQ questions?

   OBJECTION RESPONSES (feel like real dialogue):
   - "We are traditional and our families want to speak with a real person"
   - "Your system is too expensive"
   - "We already have a website and a phone number"
   - "Our families are older and won't use AI"
   - "We don't have the technical capacity"
   - "This feels impersonal"

   CLOSING:
   - Specific next steps
   - Reference to the live demo
   - Clear call to action

9. PRE-MEETING ACTION ITEMS
   - Checklist format with checkbox styling
   - Specific, actionable items tied to the prospect
   - Review their Google reviews and note trends
   - Check their social media presence
   - Test their current website response time and mobile experience
   - Review their Google Business profile completeness
   - Prepare demo walkthrough (mention specific features relevant to their pain points)
   - Research their leadership team on LinkedIn
   - Note any staff changes or company news

10. EMAIL THREAD STARTER
    - A ready-to-send intro email draft
    - Personalized to their business
    - References specific details from their website
    - Clear value proposition for their funeral home
    - Call to action for scheduling a demo
    - Professional but not corporate

11. FOOTER
    - "Prepared by Mortem AI" with logo
    - Confidential notice
    - Contact: Tom Magee, Mortem AI
    - Include date prepared

CRITICAL RULES:
- Never use em dashes (use commas, periods, or "to" instead)
- Write naturally, not like marketing copy
- Be specific and data-driven where possible
- Make it feel like a senior sales strategist wrote this, not a generic AI
- The document should be comprehensive, at least 1000 lines of HTML
- Every section should have real, substantive content
- Include specific details you can infer from the funeral home data provided
- Be confident and bold with reasonable inferences rather than vague generalizations

Return ONLY the complete HTML. Start with <!DOCTYPE html> and end with </html>. No markdown, no code blocks, no explanation.`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      res.write(`data: ${JSON.stringify({ type: 'chunk', text: event.delta.text })}\n\n`);
    }
  }
  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
}

async function handleFactCheck(req, res) {
  const { html, research } = req.body;
  if (!html) return res.status(400).json({ error: 'Meeting prep HTML is required' });

  const perplexityKey = req.headers['x-perplexity-key-override'] || process.env.PERPLEXITY_API_KEY;
  if (!perplexityKey) return res.status(500).json({ error: 'Perplexity API key not configured. Add it in Settings or set PERPLEXITY_API_KEY env var.' });

  const textContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${perplexityKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        {
          role: 'system',
          content: 'You are a fact-checker and research assistant. Your job is to verify claims made in a sales meeting prep document about a funeral home. Use your internet access to check facts, find additional information, and flag any inaccuracies. Be thorough but constructive.'
        },
        {
          role: 'user',
          content: `Please fact-check and enhance this meeting prep document for ${research?.business_name || 'a funeral home'}.

The document text:
${textContent.substring(0, 12000)}

For each claim or data point:
1. VERIFY: Is this accurate based on what you can find online?
2. ENHANCE: What additional real information can you find about this business, its owners, competitors, and market?
3. CORRECT: What needs to be fixed or updated?
4. ADD: What important information is missing that you found in your research?

Return your findings as a structured JSON object:
{
  "verified_facts": ["fact 1 that checks out", "fact 2 that checks out"],
  "corrections": [{"claim": "what was said", "reality": "what's actually true", "source": "where you found this"}],
  "new_information": [{"topic": "what this is about", "detail": "the new info", "source": "where you found this"}],
  "missing_competitors": [{"name": "competitor name", "url": "website if found", "notes": "what they offer"}],
  "owner_info": {"details": "any info found about the owner/contact", "source": "where found"},
  "market_data": {"details": "local market info, demographics, etc.", "source": "where found"},
  "overall_accuracy": "high/medium/low",
  "summary": "Brief overall assessment"
}

Return ONLY valid JSON.`
        }
      ],
      max_tokens: 4000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Perplexity API error (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return res.status(200).json({ raw: content, parsed: null });

  try {
    return res.status(200).json({ parsed: JSON.parse(jsonMatch[0]), raw: content });
  } catch {
    return res.status(200).json({ raw: content, parsed: null });
  }
}

async function handleRegeneratePrep(req, res) {
  const { research, demoUrl, contactName, contactRole, factCheckResults, originalHtml } = req.body;
  if (!research || !research.business_name) return res.status(400).json({ error: 'Research data is required' });
  if (!factCheckResults) return res.status(400).json({ error: 'Fact-check results are required' });

  const client = getClient(req.headers['x-api-key-override']);
  const contact = contactName || research.owner_name || 'the owner';
  const role = contactRole || 'Owner/Director';

  const factCheckSummary = typeof factCheckResults === 'string' ? factCheckResults : JSON.stringify(factCheckResults, null, 2);

  const prompt = `You are an expert sales strategist and HTML designer at Mortem AI. You previously generated a meeting prep document, and it has now been fact-checked with live internet research. Your job is to regenerate the document incorporating all verified facts, corrections, and new information.

ORIGINAL CONTEXT:
- Business: ${research.business_name}
- Contact: ${contact} (${role})
- Phone: ${research.phone || 'Not found'}
- Address: ${research.address || ''}, ${research.city || ''}, ${research.state || ''}
- Services: ${(research.services || []).join(', ')}
- Website: ${research.website_url || ''}
${demoUrl ? '- Live Demo: ' + demoUrl : ''}

FACT-CHECK RESULTS (incorporate ALL of this):
${factCheckSummary}

INSTRUCTIONS:
- Regenerate the COMPLETE meeting prep HTML document
- Replace any incorrect claims with the corrected information from fact-checking
- Add all new information discovered during fact-checking
- Update competitor analysis with real competitors found
- Update owner/contact info with any new details found
- Keep the same beautiful HTML/CSS design (Cormorant Garamond headings, DM Sans body, branded colors)
- Use CSS class prefix based on business initials
- All colors must use !important, no CSS variables
- Never use em dashes
- The document should be comprehensive, at least 1000 lines of HTML
- Mark any fact-checked and verified claims with a subtle green checkmark icon or similar visual indicator

Return ONLY the complete HTML. Start with <!DOCTYPE html> and end with </html>.`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      res.write(`data: ${JSON.stringify({ type: 'chunk', text: event.delta.text })}\n\n`);
    }
  }
  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
}

async function handleOutreach(req, res) {
  const { research, demoUrl } = req.body;
  if (!research || !demoUrl) return res.status(400).json({ error: 'Research data and demoUrl are required' });

  const client = getClient(req.headers['x-api-key-override']);
  const prompt = `You are Tom at Mortem AI, creating personalized outreach messages for a funeral home.

Funeral Home Information:
- Business: ${research.business_name}
- Owner/Team: ${research.owner_name}
- Phone: ${research.phone}
- Services: ${(research.services || []).join(', ')}
- Locations: ${(research.locations || []).map(l => l.name).join(', ')}
- Service Area: ${research.service_area}
- Demo URL: ${demoUrl}

Generate personalized outreach messages in this exact JSON format (and ONLY this JSON, no markdown):
{
  "email": { "subject": "subject line", "body": "full email body" },
  "linkedin": "short linkedin message",
  "voicemail": "30-second voicemail script",
  "sms": "under 160 character SMS message"
}

All messages should be from "Tom at Mortem AI", reference the live demo URL, feel personal and specific, use simple respectful language, and include a clear call to action.
Return ONLY valid JSON. No markdown, no code blocks.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse JSON response from Claude');
  const outreachData = JSON.parse(jsonMatch[0]);
  if (!outreachData.email || !outreachData.email.subject || !outreachData.email.body) throw new Error('Invalid outreach data structure: missing email fields');
  if (!outreachData.linkedin || !outreachData.voicemail || !outreachData.sms) throw new Error('Invalid outreach data structure: missing message types');
  return res.status(200).json(outreachData);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.body;

  try {
    switch (action) {
      case 'research': return await handleResearch(req, res);
      case 'generate-prompt': return await handleGeneratePrompt(req, res);
      case 'generate-demo': return await handleGenerateDemo(req, res);
      case 'deploy': return await handleDeploy(req, res);
      case 'meeting-prep': return await handleMeetingPrep(req, res);
      case 'fact-check': return await handleFactCheck(req, res);
      case 'regenerate-prep': return await handleRegeneratePrep(req, res);
      case 'outreach': return await handleOutreach(req, res);
      default: return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error(`Pipeline API error (${action}):`, error);
    return res.status(500).json({ error: error.message || 'Pipeline action failed' });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };
