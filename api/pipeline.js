import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';

function getClient(overrideKey) {
  const apiKey = overrideKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('No Anthropic API key configured. Set ANTHROPIC_API_KEY env var or provide via Settings.');
  return new Anthropic({ apiKey });
}

// ââ Deep Research Utilities ââ

async function fetchWebPage(url, timeout = 8000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml')) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function extractTextFromHtml(html, maxLength = 4000) {
  if (!html) return '';
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  const titleMatch = text.match(/<title>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  const description = metaDesc ? metaDesc[1].trim() : '';
  text = text.replace(/<[^>]*>/g, ' ');
  text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > maxLength) text = text.substring(0, maxLength) + '...';
  let result = '';
  if (title) result += `[Page Title: ${title}]\n`;
  if (description) result += `[Meta Description: ${description}]\n`;
  result += text;
  return result;
}

function extractTechStack(html) {
  if (!html) return [];
  const signals = [];
  const checks = [
    [/wp-content|wordpress/i, 'WordPress'],
    [/squarespace/i, 'Squarespace'],
    [/wix\.com/i, 'Wix'],
    [/weebly/i, 'Weebly'],
    [/frazer|FrazerConsultants/i, 'Frazer Consultants (funeral industry CMS)'],
    [/funeraltech|FuneralTech/i, 'FuneralTech'],
    [/tributetech|TributeTech/i, 'TributeTech'],
    [/frontrunner|FrontRunner/i, 'FrontRunner Professional (funeral industry CMS)'],
    [/cfsweb|cfs\.com/i, 'CFS (Consolidated Funeral Services)'],
    [/batesville/i, 'Batesville technology'],
    [/tributeprint/i, 'TributePrint'],
    [/srs-computing|SRS Computing/i, 'SRS Computing (funeral industry)'],
    [/funeralOne|funeral[_-]?one/i, 'funeralOne (funeral industry CMS)'],
    [/jquery/i, 'jQuery'],
    [/react/i, 'React'],
    [/bootstrap/i, 'Bootstrap CSS'],
    [/tailwind/i, 'Tailwind CSS'],
    [/livechat|tawk\.to|intercom|drift|chatbot|chat-widget|zendesk/i, 'Live chat widget detected'],
    [/google-analytics|gtag|googletagmanager|GA4/i, 'Google Analytics/Tag Manager'],
    [/facebook\.net|fbq\(|fb-pixel/i, 'Facebook Pixel'],
    [/schema\.org/i, 'Schema.org structured data'],
    [/og:title|og:description/i, 'OpenGraph meta tags'],
    [/recaptcha/i, 'reCAPTCHA (form protection)'],
    [/mailchimp|constant.?contact|hubspot/i, 'Email marketing integration'],
    [/calendly|acuity|bookings/i, 'Online scheduling/booking'],
  ];
  checks.forEach(([regex, label]) => { if (regex.test(html)) signals.push(label); });
  if (/name=["']viewport["']/i.test(html)) signals.push('Mobile viewport configured');
  else signals.push('NO mobile viewport tag (not mobile-responsive)');
  if (/<link[^>]*rel=["']canonical["']/i.test(html)) signals.push('Canonical URL set');
  if (/https?:\/\//i.test(html) && /ssl|https/i.test(html)) signals.push('HTTPS enabled');
  return signals;
}

async function perplexitySearch(apiKey, query, maxTokens = 1500) {
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: 'You are a thorough research assistant. Provide detailed, factual information based on real web sources. Include specific names, dates, addresses, phone numbers, ratings, and URLs where available. If you cannot find specific information, say so clearly rather than guessing.' },
          { role: 'user', content: query }
        ],
        max_tokens: maxTokens,
        temperature: 0.1,
      }),
    });
    if (!response.ok) return { content: null, error: `HTTP ${response.status}` };
    const data = await response.json();
    return { content: data.choices?.[0]?.message?.content || null };
  } catch (err) {
    return { content: null, error: err.message };
  }
}

// ââ Main Research Handler (SSE streaming with progress) ââ

async function handleResearch(req, res) {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  // Set up SSE for progress reporting
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (type, payload) => {
    res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
  };

  const perplexityKey = req.headers['x-perplexity-key-override'] || process.env.PERPLEXITY_API_KEY;
  const client = getClient(req.headers['x-api-key-override']);
  const baseUrl = url.replace(/\/+$/, '');

  try {
    // ââ STEP 1: Crawl the website page by page ââ
    send('progress', { phase: 'crawl', message: 'Crawling website pages...' });

    const pagePaths = [
      '/',
      '/about', '/about-us', '/our-story', '/history', '/who-we-are',
      '/services', '/our-services', '/funeral-services', '/what-we-offer',
      '/cremation', '/cremation-services',
      '/pre-planning', '/pre-plan', '/plan-ahead', '/advance-planning',
      '/contact', '/contact-us',
      '/staff', '/our-team', '/our-staff', '/meet-our-team', '/meet-the-team', '/our-people',
      '/locations', '/our-locations', '/facilities',
      '/obituaries', '/tributes', '/recent-obituaries',
      '/resources', '/grief-support', '/faq',
      '/testimonials', '/reviews',
    ];

    const pageResults = await Promise.allSettled(
      pagePaths.map(path => fetchWebPage(`${baseUrl}${path}`, 6000))
    );

    const websiteContent = {};
    let homepageHtml = null;
    pagePaths.forEach((path, i) => {
      const result = pageResults[i];
      if (result.status === 'fulfilled' && result.value) {
        websiteContent[path] = extractTextFromHtml(result.value);
        if (path === '/') homepageHtml = result.value;
      }
    });

    const foundPages = Object.keys(websiteContent);
    send('progress', { phase: 'crawl', message: `Found ${foundPages.length} accessible pages: ${foundPages.join(', ')}` });

    // Extract tech stack from homepage source
    const techStack = homepageHtml ? extractTechStack(homepageHtml) : [];
    send('progress', { phase: 'crawl', message: `Tech stack: ${techStack.length > 0 ? techStack.join(', ') : 'Could not determine'}` });

    // Extract business name hint from homepage title
    let businessNameHint = '';
    if (homepageHtml) {
      const titleMatch = homepageHtml.match(/<title>(.*?)<\/title>/i);
      if (titleMatch) businessNameHint = titleMatch[1].replace(/\s*[\||\-|â]\s*Home.*$/i, '').replace(/\s*[\||\-|â]\s*Welcome.*$/i, '').trim();
    }
    if (!businessNameHint) {
      try {
        const hostname = new URL(url).hostname.replace('www.', '');
        businessNameHint = hostname.split('.')[0].replace(/-/g, ' ');
      } catch {}
    }

    // ââ STEP 2: Run Perplexity web searches in parallel ââ
    send('progress', { phase: 'search', message: `Searching Google for "${businessNameHint}" -- business info, owners, reviews, competitors...` });

    let searchResults = { business: null, reviews: null, people: null, competitors: null, news: null };

    if (perplexityKey) {
      const searches = await Promise.allSettled([
        perplexitySearch(perplexityKey,
          `Tell me everything about "${businessNameHint}" funeral home. Their website is ${url}. Specifically: Who owns this funeral home? Who are the funeral directors? When was it founded? Is it family-owned or corporate? How many locations do they have? What is their full address and phone number? What services do they offer? What is their history? Are they affiliated with any larger organizations? Provide specific names, dates, and cite your sources.`,
          2500
        ),
        perplexitySearch(perplexityKey,
          `Find reviews and reputation information for "${businessNameHint}" funeral home (website: ${url}). Check: Google Reviews (rating and number of reviews), Yelp reviews, BBB rating and any complaints, Facebook reviews, and any other review platforms. What do customers commonly praise? What complaints exist? Quote specific review themes. Provide numbers and ratings.`,
          2000
        ),
        perplexitySearch(perplexityKey,
          `Search for the key people who work at "${businessNameHint}" funeral home (${url}). Find: owners, funeral directors, embalmers, and management. For each person, search LinkedIn profiles, obituaries they have signed or directed, news articles mentioning them, community involvement, professional awards, and memberships in organizations like NFDA or state funeral directors associations. How long have they been in the funeral industry? What is their educational background? Provide specific names and details.`,
          2000
        ),
        perplexitySearch(perplexityKey,
          `What are the main competitor funeral homes near "${businessNameHint}" (${url})? List the top 5 competitors with: business name, website URL, Google review rating and count, services offered, whether they have online booking or chat features, and how they compare. Also describe the local funeral services market: population demographics, death rate trends, number of funeral homes in the area, and any market trends.`,
          2000
        ),
        perplexitySearch(perplexityKey,
          `Search for recent news, press coverage, community involvement, events, or social media activity related to "${businessNameHint}" funeral home (${url}). Check: local newspaper mentions, community events they sponsor or participate in, social media presence (Facebook, Instagram, LinkedIn pages), any awards or recognitions, and any recent changes to the business. Also check if they have pre-planning seminars, grief support groups, or other community programs.`,
          1500
        ),
      ]);

      searchResults.business = searches[0]?.status === 'fulfilled' ? searches[0].value.content : null;
      searchResults.reviews = searches[1]?.status === 'fulfilled' ? searches[1].value.content : null;
      searchResults.people = searches[2]?.status === 'fulfilled' ? searches[2].value.content : null;
      searchResults.competitors = searches[3]?.status === 'fulfilled' ? searches[3].value.content : null;
      searchResults.news = searches[4]?.status === 'fulfilled' ? searches[4].value.content : null;

      const foundCount = Object.values(searchResults).filter(v => v).length;
      send('progress', { phase: 'search', message: `Web search complete. Got results from ${foundCount}/5 searches.` });
    } else {
      send('progress', { phase: 'search', message: 'No Perplexity API key available. Skipping web searches. Results will be limited to website crawl only.' });
    }

    // ââ STEP 3: Compile everything with Claude ââ
    send('progress', { phase: 'compile', message: 'Analyzing all research data and compiling profile...' });

    const websiteContentStr = Object.entries(websiteContent)
      .map(([path, text]) => `=== PAGE: ${baseUrl}${path} ===\n${text}`)
      .join('\n\n');

    const synthesisPrompt = `You are an expert funeral home researcher compiling a detailed prospect profile. You have been given REAL data from actual website crawling and live web searches. Your job is to compile this into a comprehensive, accurate research profile.

CRITICAL RULES:
- ONLY include information that is ACTUALLY found in the sources below.
- Do NOT fabricate, guess, or infer information that is not supported by the data.
- If something was not found, use "Not found" or omit it entirely.
- Every claim should trace back to something in the provided sources.
- Distinguish between confirmed facts and reasonable inferences (mark inferences as such).

=== WEBSITE CONTENT (crawled from ${url}) ===
Pages found: ${foundPages.join(', ')}

${websiteContentStr || 'WARNING: Could not access any pages on this website.'}

=== TECH STACK (detected from HTML source code) ===
${techStack.length > 0 ? techStack.join('\n') : 'Could not inspect source code'}

=== WEB SEARCH: BUSINESS INFO & OWNERSHIP ===
${searchResults.business || 'No search results available (Perplexity API key may not be configured)'}

=== WEB SEARCH: REVIEWS & REPUTATION ===
${searchResults.reviews || 'No search results available'}

=== WEB SEARCH: KEY PEOPLE & DIRECTORS ===
${searchResults.people || 'No search results available'}

=== WEB SEARCH: COMPETITORS & LOCAL MARKET ===
${searchResults.competitors || 'No search results available'}

=== WEB SEARCH: NEWS & COMMUNITY INVOLVEMENT ===
${searchResults.news || 'No search results available'}

Based ONLY on the above real data, compile and return a JSON object. Return ONLY valid JSON (no markdown, no code blocks, no explanation before or after). Use this structure:

{
  "business_name": "official name as found on website or search results",
  "owner_name": "actual owner name if found, or 'Not found'",
  "owners_and_directors": [
    {"name": "full name", "role": "their title/role", "background": "what was found about them", "source": "where this was found (website page, Google, LinkedIn, etc.)"}
  ],
  "phone": "phone number from website or listings",
  "email": "email if found on contact page or listings",
  "address": "full street address",
  "city": "city",
  "state": "state abbreviation",
  "founded": "year or decade if found, otherwise 'Not found'",
  "ownership_type": "family-owned, corporate-owned, independent, etc. based on what was found",
  "generation": "first/second/third generation if mentioned, otherwise 'Not found'",
  "services": ["list", "of", "actual", "services", "found", "on", "their", "website"],
  "services_detail": {
    "Service Name": "detailed description as found on their services page"
  },
  "locations": [
    {"name": "location name", "address": "full address", "phone": "phone if different", "area": "service area mentioned"}
  ],
  "unique_selling_points": "actual differentiators found on their site, in reviews, or search results",
  "service_area": "geographic area they serve as stated on their website",
  "tagline": "actual tagline or motto from their website, or 'Not found'",
  "website_url": "${url}",
  "website_pages_found": ${JSON.stringify(foundPages)},
  "tech_stack": ${JSON.stringify(techStack)},
  "has_online_booking": false,
  "has_chat_widget": false,
  "has_mobile_responsive": ${techStack.some(t => t.includes('Mobile viewport')) ? 'true' : 'false'},
  "has_structured_data": ${techStack.some(t => t.includes('Schema.org')) ? 'true' : 'false'},
  "has_analytics": ${techStack.some(t => t.includes('Google Analytics')) ? 'true' : 'false'},
  "google_reviews": {
    "rating": "X.X or 'Not found'",
    "count": "number or 'Not found'",
    "themes": "common themes from reviews"
  },
  "yelp_reviews": {
    "rating": "X.X or 'Not found'",
    "count": "number or 'Not found'"
  },
  "bbb_rating": "rating if found or 'Not found'",
  "competitors": [
    {"name": "competitor name", "url": "website", "google_rating": "rating", "review_count": "count", "key_differences": "how they compare", "has_chat": false, "has_booking": false}
  ],
  "community_involvement": ["actual activities, sponsorships, or memberships found"],
  "recent_news": ["actual news items or press mentions found"],
  "social_media": {
    "facebook": "URL or 'Not found'",
    "instagram": "URL or 'Not found'",
    "linkedin": "URL or 'Not found'"
  },
  "staff_count_estimate": "based on staff page content or 'Not found'",
  "obituary_volume": "any indication of volume from obituaries page or 'Not found'",
  "market_demographics": "local area demographics from search results or 'Not found'",
  "digital_presence_assessment": {
    "score": "1-10",
    "strengths": ["what they do well digitally"],
    "weaknesses": ["what is missing or poor"],
    "opportunities": ["where Sarah AI would add value"]
  },
  "research_sources": ["list every source that provided information: URLs, search queries, page paths"],
  "research_gaps": ["list what could NOT be found or verified"],
  "confidence_level": "high/medium/low based on how much real data was found"
}

Set has_online_booking and has_chat_widget to true/false based on what you actually found on their website pages or in the tech stack signals. Be thorough. Return ONLY the JSON.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: synthesisPrompt }],
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      send('error', { message: 'Could not parse research results from Claude' });
      res.end();
      return;
    }

    let researchData;
    try {
      researchData = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      send('error', { message: 'JSON parse error: ' + parseErr.message });
      res.end();
      return;
    }

    // Attach raw search data for downstream use
    researchData._raw_searches = {
      business: searchResults.business ? searchResults.business.substring(0, 2000) : null,
      reviews: searchResults.reviews ? searchResults.reviews.substring(0, 2000) : null,
      people: searchResults.people ? searchResults.people.substring(0, 2000) : null,
      competitors: searchResults.competitors ? searchResults.competitors.substring(0, 2000) : null,
      news: searchResults.news ? searchResults.news.substring(0, 2000) : null,
    };

    send('progress', { phase: 'complete', message: `Research complete. Found ${researchData.owners_and_directors?.length || 0} people, ${researchData.competitors?.length || 0} competitors, ${foundPages.length} website pages.` });
    send('result', { data: researchData });
    send('done', {});
    res.end();

  } catch (err) {
    send('error', { message: err.message || 'Research failed' });
    res.end();
  }
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
