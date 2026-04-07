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

  const prompt = `You are an expert sales strategist and HTML designer at Mortem AI. Create a comprehensive, beautifully designed meeting prep document as a single HTML file.

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
   - Include talking points specific to this person

3. COMPANY OVERVIEW
   - Business history and background (infer from available data)
   - All locations with addresses
   - Services offered
   - Service area coverage
   - Key differentiators

4. CURRENT DIGITAL STATE AUDIT
   - Analyze what you can infer about their current website
   - Note strengths and weaknesses
   - Current online presence assessment
   - Areas where AI chatbot would add value

5. GAP ANALYSIS
   - What families searching for funeral services in their area need
   - Where the current digital experience falls short
   - How Sarah AI fills these gaps (24/7 availability, compassionate responses, appointment booking, FAQ handling)

6. COMPETITIVE CONTEXT
   - Other funeral homes in ${research.city || ''}, ${research.state || ''} area
   - How competitors are using technology
   - Opportunity to be an early adopter of AI

7. ROI MATH
   - Average funeral service value ($7,000-$12,000)
   - Estimated missed after-hours inquiries
   - Conversion rate improvements with 24/7 AI response
   - Monthly ROI projection showing clear value
   - Use a clean table format

8. TALK TRACKS
   - Opening lines personalized to ${contact}
   - Key questions to ask
   - Objection handling (price, "we are traditional", "families want humans", "we already have a website")
   - Closing approach
   - Each talk track should be a distinct subsection with a header

9. PRE-MEETING ACTION ITEMS
   - Checklist format with checkbox styling
   - Items like: review their Google reviews, check their social media, test their current website response time, prepare demo walkthrough

10. FOOTER
    - "Prepared by Mortem AI" with logo
    - Confidential notice
    - Contact: Tom Magee, Mortem AI

CRITICAL RULES:
- Never use em dashes (use commas, periods, or "to" instead)
- Write naturally, not like marketing copy
- Be specific and data-driven where possible
- Make it feel like a senior sales strategist wrote this, not a generic AI
- The document should be comprehensive, at least 800 lines of HTML
- Every section should have real, substantive content

Return ONLY the complete HTML. Start with <!DOCTYPE html> and end with </html>. No markdown, no code blocks, no explanation.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  let html = message.content[0].type === 'text' ? message.content[0].text : '';
  if (html.includes('```html')) html = html.replace(/```html\n?/, '').replace(/\n?```/, '');
  else if (html.includes('```')) html = html.replace(/```\n?/, '').replace(/\n?```/, '');
  html = html.trim();
  if (!html.startsWith('<!DOCTYPE')) throw new Error('Generated meeting prep HTML does not start with <!DOCTYPE');
  return res.status(200).json({ html });
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
      case 'outreach': return await handleOutreach(req, res);
      default: return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error(`Pipeline API error (${action}):`, error);
    return res.status(500).json({ error: error.message || 'Pipeline action failed' });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };
