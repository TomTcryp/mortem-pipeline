import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';

// Meeting Prep HTML Template (CSS served from /meeting-prep.css)
function MEETING_PREP_HEADER(title) {
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + title + ' - Pre-Meeting Intelligence Brief</title>\n<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📋</text></svg>">\n<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet">\n<link rel="stylesheet" href="https://mortem-pipeline.vercel.app/meeting-prep.css">\n</head>\n<body>\n';
}

function getClient(overrideKey) {
  const apiKey = overrideKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('No Anthropic API key configured. Set ANTHROPIC_API_KEY env var or provide via Settings.');
  return new Anthropic({ apiKey });
} 

// ── Deep Research Utilities ──

async function fetchWebPage(url, timeout = 10000) {
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

function extractTextFromHtml(html, maxLength = 6000) {
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
    [/gohighlevel|leadconnectorhq|msgsndr/i, 'GoHighLevel (GHL) CRM platform'],
    [/www1\.|app\./i, 'Subdomain detected (possible GHL/CRM landing pages)'],
    [/partingpro|parting\.com/i, 'Parting Pro (arrangement software)'],
    [/passare/i, 'Passare (case management)'],
    [/crakrevenue|funeraltech\.com\/pricing/i, 'Funeral pricing tool detected'],
    [/cloudflare/i, 'Cloudflare CDN/protection'],
    [/shopify/i, 'Shopify (e-commerce)'],
    [/stripe|paypal/i, 'Payment processing detected'],
  ];
  checks.forEach(([regex, label]) => { if (regex.test(html)) signals.push(label); });
  if (/name=["']viewport["']/i.test(html)) signals.push('Mobile viewport configured');
  else signals.push('NO mobile viewport tag (not mobile-responsive)');
  if (/<link[^>]*rel=["']canonical["']/i.test(html)) signals.push('Canonical URL set');
  if (/https?:\/\//i.test(html) && /ssl|https/i.test(html)) signals.push('HTTPS enabled');
  // Check for GPL/pricing pages
  if (/general\s*price\s*list|GPL|price\s*list/i.test(html)) signals.push('General Price List (GPL) referenced on site');
  // Check for pre-planning forms
  if (/pre-?plan|plan.?ahead|advance.?plan/i.test(html)) signals.push('Pre-planning content detected');
  // Check for email nurture/drip
  if (/drip|nurture|autorespond|email.?series|follow.?up/i.test(html)) signals.push('Email nurture/drip sequence indicators');
  return signals;
}

function extractInternalLinks(html, baseUrl) {
  if (!html) return [];
  const links = [];
  const regex = /href=["'](\/[^"']*|https?:\/\/[^"']*?)["']/gi;
  let match;
  const hostname = new URL(baseUrl).hostname;
  while ((match = regex.exec(html)) !== null) {
    let href = match[1];
    if (href.startsWith('/')) href = new URL(href, baseUrl).href;
    try {
      const u = new URL(href);
      if (u.hostname === hostname || u.hostname.endsWith('.' + hostname.replace('www.', ''))) {
        links.push(u.pathname);
      }
    } catch {}
  }
  return [...new Set(links)].filter(p => p !== '/' && !p.match(/\.(jpg|png|gif|css|js|svg|ico|pdf|woff|ttf)$/i));
}

function extractContactInfo(html) {
  if (!html) return {};
  const info = {};
  const phoneMatch = html.match(/(?:tel:|phone|call).*?([\(]?\d{3}[\)]?[\s\.\-]?\d{3}[\s\.\-]?\d{4})/i) || html.match(/([\(]?\d{3}[\)]?[\s\.\-]\d{3}[\s\.\-]\d{4})/);
  if (phoneMatch) info.phone = phoneMatch[1];
  const emailMatch = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) info.email = emailMatch[0];
  return info;
}

function extractSocialLinks(html) {
  if (!html) return {};
  const social = {};
  const fbMatch = html.match(/https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9.\-_]+/i);
  if (fbMatch) social.facebook = fbMatch[0];
  const igMatch = html.match(/https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9.\-_]+/i);
  if (igMatch) social.instagram = igMatch[0];
  const liMatch = html.match(/https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9.\-_]+/i);
  if (liMatch) social.linkedin = liMatch[0];
  const ytMatch = html.match(/https?:\/\/(?:www\.)?youtube\.com\/(?:channel|@|c\/)[a-zA-Z0-9.\-_]+/i);
  if (ytMatch) social.youtube = ytMatch[0];
  return social;
}

async function perplexitySearch(apiKey, query, maxTokens = 2500) {
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: 'You are a thorough investigative research assistant. Provide extremely detailed, factual information based on real web sources. Include specific names, dates, addresses, phone numbers, ratings, dollar amounts, and URLs. Never guess or speculate. If you cannot find specific information, say "NOT FOUND" clearly. Cite your sources with URLs.' },
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

// ── Perplexity Deep Research: comprehensive single query for full business intelligence ──
async function perplexityDeepResearch(apiKey, businessUrl, businessNameHint) {
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: 'You are a top-tier business intelligence analyst. You MUST provide exhaustive, verifiable facts with sources. For every claim, include the source URL. Never fabricate. If a fact cannot be found, say "NOT FOUND". Be extremely thorough, this research will be used for a high-stakes sales meeting.' },
          { role: 'user', content: `Conduct an EXHAUSTIVE deep research investigation of the funeral home at ${businessUrl} (likely named "${businessNameHint}"). I need a complete business intelligence dossier. Search the web thoroughly and report EVERYTHING you can find.

SECTION 1 - VERIFIED BUSINESS IDENTITY:
- Exact legal business name (check state business filings)
- Full street address, city, state, ZIP
- Phone number(s)
- Email address
- Website URL (canonical)
- All locations with full addresses and phone numbers
- Hours of operation

SECTION 2 - OWNERSHIP AND HISTORY:
- Who owns this business? Full names and titles
- Is it family-owned, corporate (SCI/Dignity Memorial, NorthStar, Foundation Partners, Park Lawn, Carriage Services)?
- Founding year and history
- What generation runs it?
- Any recent ownership changes, acquisitions, or mergers?
- State business registration details if available

SECTION 3 - PEOPLE AND STAFF:
- ALL named individuals: owners, funeral directors, embalmers, office staff, pre-planning counselors
- Their titles, backgrounds, education (mortuary school?)
- LinkedIn profiles if found
- State funeral director license info
- Community roles, board memberships
- How long each person has been with the business

SECTION 4 - SERVICES AND PRICING:
- Complete list of services offered
- Cremation services and pricing if available
- Pre-planning options
- Do they publish a General Price List (GPL)?
- Price positioning (premium, mid-range, budget) based on any available info
- Payment plans, financing, insurance assignments
- Special programs (veterans, indigent, green burial)

SECTION 5 - REVIEWS AND REPUTATION:
- Google Business Profile: exact star rating, exact review count, recent review themes
- Quote 3-5 SPECIFIC reviews (the actual text families wrote)
- Yelp rating and count
- BBB rating, accreditation, complaints
- Facebook rating/recommendations
- Do they respond to reviews? How quickly? What tone?
- Any negative patterns?

SECTION 6 - DIGITAL PRESENCE:
- Website platform (WordPress, Squarespace, Frazer, FrontRunner, etc.)
- Is the site mobile-responsive?
- Do they have online booking/scheduling?
- Do they have a live chat widget?
- Do they have a blog?
- Google Business Profile optimization level
- Social media presence: Facebook (URL, followers, posting frequency), Instagram, LinkedIn, YouTube
- Email marketing (Mailchimp, Constant Contact, etc.)
- CRM (GoHighLevel, HubSpot, etc.)
- Any arrangement software (Parting Pro, Passare)?

Briefly note any major competitors and recent news mentions.

For EVERY fact, include the source URL. Be exhaustive. This is the primary research source for a sales meeting.` }
        ],
        max_tokens: 1200,
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

// ── Extract visual identity from homepage HTML for demo design matching ──
function extractVisualIdentity(html) {
  if (!html) return null;
  const identity = {};

  // Extract logo URL
  const logoPatterns = [
    /src=["']([^"']*logo[^"']*)/i,
    /class=["'][^"']*logo[^"']*["'][^>]*src=["']([^"']*)/i,
    /src=["']([^"']*)[^>]*class=["'][^"']*logo/i,
    /<link[^>]*rel=["']icon["'][^>]*href=["']([^"']*)/i,
  ];
  for (const pat of logoPatterns) {
    const m = html.match(pat);
    if (m) { identity.logoUrl = m[1]; break; }
  }

  // Extract colors from inline styles and CSS
  const colorCounts = {};
  const hexColors = html.match(/#[0-9a-fA-F]{6}/g) || [];
  hexColors.forEach(c => {
    const cl = c.toLowerCase();
    // Skip very common/generic colors
    if (['#000000', '#ffffff', '#333333', '#666666', '#999999', '#cccccc', '#f5f5f5', '#eeeeee', '#dddddd'].includes(cl)) return;
    colorCounts[cl] = (colorCounts[cl] || 0) + 1;
  });

  // Also check background-color and color CSS properties
  const rgbColors = html.match(/(?:background-color|background|color)\s*:\s*rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi) || [];
  rgbColors.forEach(match => {
    const nums = match.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (nums) {
      const hex = '#' + [nums[1], nums[2], nums[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
      if (!['#000000', '#ffffff', '#333333'].includes(hex)) {
        colorCounts[hex] = (colorCounts[hex] || 0) + 1;
      }
    }
  });

  // Sort by frequency and pick top colors
  const sorted = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0) identity.primaryColor = sorted[0][0];
  if (sorted.length > 1) identity.secondaryColor = sorted[1][0];
  if (sorted.length > 2) identity.accentColor = sorted[2][0];

  // Extract font families
  const fontMatches = html.match(/font-family\s*:\s*['"]?([^;"'\}]+)/gi) || [];
  const fonts = new Set();
  fontMatches.forEach(m => {
    const f = m.replace(/font-family\s*:\s*/i, '').trim().replace(/['"]/g, '').split(',')[0].trim();
    if (f && !['inherit', 'serif', 'sans-serif', 'monospace', 'Arial', 'Helvetica', 'Verdana', 'Georgia', 'Times New Roman'].includes(f)) {
      fonts.add(f);
    }
  });
  identity.fonts = [...fonts].slice(0, 3);

  // Extract Google Fonts links
  const gfMatch = html.match(/fonts\.googleapis\.com\/css2?\?[^"']+/gi);
  if (gfMatch) identity.googleFontsUrl = gfMatch[0];

  // Extract background image from hero/header
  const bgImgMatch = html.match(/background(?:-image)?\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/i);
  if (bgImgMatch) identity.heroImageUrl = bgImgMatch[1];

  // Extract tagline from meta description or h1/h2
  const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)/i);
  if (metaDesc) identity.tagline = metaDesc[1];

  return identity;
}

// ── Ground-Truth NAP Verification (runs BEFORE synthesis to prevent hallucination) ──
async function verifyGroundTruth(perplexityKey, businessUrl, websiteTitleHint) {
  if (!perplexityKey) return null;

  const prompt = `You are a verification agent. Return ONLY verified, current facts about the business at this exact URL: ${businessUrl}
${websiteTitleHint ? 'Website title suggests the business name is: ' + websiteTitleHint : ''}

CRITICAL RULES:
1. Visit the actual website and read the footer, contact page, and Google Business Profile.
2. Return ONLY information you can directly verify from the website, official directories, or Google Business Profile.
3. Do NOT infer location from area code alone. Do NOT guess. If something cannot be directly verified, return the string "UNVERIFIED" for that field.
4. If the domain or phone appears to match multiple businesses, prioritize what is shown on THIS exact website.
5. If there are multiple locations, list ALL of them in all_locations.

Return a JSON object with exactly these fields and nothing else:
{
  "exact_business_name": "the exact trading name as shown on their website homepage or footer",
  "street_address": "the exact primary street address",
  "city": "city name",
  "state": "2-letter state code",
  "zip": "zip/postal code",
  "country": "2-letter country code",
  "phone": "primary phone in exact format as shown",
  "email": "primary email if shown",
  "website_canonical": "the canonical URL with https://",
  "all_locations": [
    {"name": "location name if multi-location", "address": "full street address", "city_state_zip": "city state zip", "phone": "phone for this location"}
  ],
  "verification_sources": ["source URL 1", "source URL 2"],
  "confidence": "high/medium/low"
}

Return ONLY the JSON object, nothing else. No markdown, no code blocks, no commentary.`;

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${perplexityKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: 'You are a precise fact verification agent. You only return verified facts with source URLs. You never guess. You never infer location from phone area codes alone.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 800,
        temperature: 0,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  } catch { return null; }
}

// ── Main Research Handler (Enterprise-grade SSE streaming) ──

async function handleResearch(req, res) {
  const _startTime = Date.now();

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

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
    // Extract initial business name hint from URL
    let businessNameHint = '';
    let content = '';
    try { businessNameHint = new URL(url).hostname.replace('www.', '').split('.')[0].replace(/-/g, ' '); } catch {}

    // ── STEP 0: PERPLEXITY DEEP RESEARCH (PRIMARY DATA SOURCE) ──
    // Perplexity can access websites that block direct server-side fetches.
    // We use it FIRST as our primary intelligence source, then supplement with direct crawling.
    let deepResearchData = null;
    if (perplexityKey) {
      send('progress', { phase: 'research', message: `Starting deep research on ${url}...` });
      send('progress', { phase: 'research', message: 'Crawling website pages, searching Google, checking reviews, staff...' });
      const deepResult = await perplexityDeepResearch(perplexityKey, baseUrl, businessNameHint);
      if (deepResult.content) {
        deepResearchData = deepResult.content;
        send('progress', { phase: 'research', message: 'Deep research complete. Processing results...' });
      } else {
        send('progress', { phase: 'research', message: 'Deep research returned no results. Falling back to direct crawling...' });
      }
    }

    // ── STEP 1: Supplementary website crawl (runs in parallel with processing) ──
    // Even with Perplexity data, we still crawl for: tech stack detection, visual identity extraction, and raw HTML
    send('progress', { phase: 'crawl', message: 'Deep crawling website pages...' });

    const pagePaths = [
      '/',
      '/about', '/about-us', '/our-story', '/history', '/who-we-are', '/about/history',
      '/services', '/our-services', '/funeral-services', '/what-we-offer', '/services/funeral',
      '/cremation', '/cremation-services', '/services/cremation', '/direct-cremation',
      '/pre-planning', '/pre-plan', '/plan-ahead', '/advance-planning', '/pre-planning/options',
      '/pre-planning/checklist', '/preplanning', '/pre-need',
      '/contact', '/contact-us',
      '/staff', '/our-team', '/our-staff', '/meet-our-team', '/meet-the-team', '/our-people', '/team',
      '/locations', '/our-locations', '/facilities', '/chapels',
      '/obituaries', '/tributes', '/recent-obituaries', '/obituaries/current',
      '/resources', '/grief-support', '/faq', '/resources/grief',
      '/testimonials', '/reviews',
      '/pricing', '/price-list', '/general-price-list', '/gpl',
      '/merchandise', '/caskets', '/urns', '/products',
      '/veterans', '/veteran-services', '/military',
      '/aftercare', '/after-care', '/bereavement',
      '/flowers', '/send-flowers',
      '/blog', '/news', '/community',
      '/careers', '/employment', '/jobs',
      '/privacy', '/terms',
    ];

    // Also check common GHL/CRM subdomains
    let ghlDetected = false;
    const hostname = new URL(baseUrl).hostname;
    const baseDomain = hostname.replace('www.', '');
    const subdomainChecks = [
      `https://www1.${baseDomain}`,
      `https://app.${baseDomain}`,
      `https://book.${baseDomain}`,
      `https://schedule.${baseDomain}`,
      `https://portal.${baseDomain}`,
    ];

    const [pageResults, subdomainResults] = await Promise.all([
      Promise.allSettled(pagePaths.map(path => fetchWebPage(`${baseUrl}${path}`, 8000))),
      Promise.allSettled(subdomainChecks.map(u => fetchWebPage(u, 5000))),
    ]);

    const websiteContent = {};
    let homepageHtml = null;
    let allHtmlCombined = '';
    pagePaths.forEach((path, i) => {
      const result = pageResults[i];
      if (result.status === 'fulfilled' && result.value) {
        websiteContent[path] = extractTextFromHtml(result.value, 6000);
        if (path === '/') homepageHtml = result.value;
        allHtmlCombined += result.value.substring(0, 3000);
      }
    });

    // Check subdomains
    const activeSubdomains = [];
    subdomainChecks.forEach((u, i) => {
      if (subdomainResults[i].status === 'fulfilled' && subdomainResults[i].value) {
        activeSubdomains.push(u);
        const html = subdomainResults[i].value;
        if (/gohighlevel|leadconnectorhq|msgsndr/i.test(html)) ghlDetected = true;
      }
    });

    // Discover additional pages from internal links
    if (homepageHtml) {
      const discoveredLinks = extractInternalLinks(homepageHtml, baseUrl);
      const additionalPaths = discoveredLinks.filter(p => !pagePaths.includes(p)).slice(0, 15);
      if (additionalPaths.length > 0) {
        send('progress', { phase: 'crawl', message: `Discovered ${additionalPaths.length} additional pages from internal links...` });
        const extraResults = await Promise.allSettled(
          additionalPaths.map(path => fetchWebPage(`${baseUrl}${path}`, 6000))
        );
        additionalPaths.forEach((path, i) => {
          if (extraResults[i].status === 'fulfilled' && extraResults[i].value) {
            websiteContent[path] = extractTextFromHtml(extraResults[i].value, 4000);
            allHtmlCombined += extraResults[i].value.substring(0, 2000);
          }
        });
      }
    }

    const foundPages = Object.keys(websiteContent);
    send('progress', { phase: 'crawl', message: `Found ${foundPages.length} accessible pages: ${foundPages.join(', ')}` });

    // Extract tech stack from ALL crawled HTML
    const techStack = extractTechStack(allHtmlCombined || homepageHtml || '');
    if (ghlDetected) techStack.push('GoHighLevel (GHL) CONFIRMED via subdomain');
    if (activeSubdomains.length > 0) techStack.push(`Active subdomains: ${activeSubdomains.join(', ')}`);

    // Extract contact info, social links, and visual identity
    const contactInfo = extractContactInfo(allHtmlCombined || '');
    const socialLinks = extractSocialLinks(allHtmlCombined || '');
    const visualIdentity = extractVisualIdentity(homepageHtml || allHtmlCombined || '');

    send('progress', { phase: 'crawl', message: `Tech stack: ${techStack.length > 0 ? techStack.join(', ') : 'Could not determine'}` });

    // Update business name hint from homepage if crawl succeeded
    if (homepageHtml) {
      const titleMatch = homepageHtml.match(/<title>(.*?)<\/title>/i);
      if (titleMatch) {
        const extracted = titleMatch[1].replace(/\s*[\||\-|\u2013]\s*Home.*$/i, '').replace(/\s*[\||\-|\u2013]\s*Welcome.*$/i, '').trim();
        if (extracted) businessNameHint = extracted;
      }
    }

    // Check for GPL/pricing content specifically
    let gplContent = null;
    const gplPaths = ['/pricing', '/price-list', '/general-price-list', '/gpl'];
    for (const path of gplPaths) {
      if (websiteContent[path]) {
        gplContent = websiteContent[path];
        break;
      }
    }

    // Check for pre-planning infrastructure
    let prePlanContent = null;
    const prePlanPaths = ['/pre-planning', '/pre-plan', '/plan-ahead', '/advance-planning', '/preplanning', '/pre-need', '/pre-planning/checklist', '/pre-planning/options'];
    for (const path of prePlanPaths) {
      if (websiteContent[path]) {
        prePlanContent = websiteContent[path];
        break;
      }
    }

    // ── STEP 1.5: GROUND-TRUTH NAP VERIFICATION (prevents location hallucinations) ──
    let groundTruth = null;
    if (perplexityKey) {
      send('progress', { phase: 'verify', message: 'Locking ground-truth business name, address, and phone before synthesis...' });
      groundTruth = await verifyGroundTruth(perplexityKey, baseUrl, businessNameHint);
      if (groundTruth && groundTruth.exact_business_name && groundTruth.exact_business_name !== 'UNVERIFIED') {
        const loc = [groundTruth.city, groundTruth.state].filter(v => v && v !== 'UNVERIFIED').join(', ') || 'location unverified';
        send('progress', { phase: 'verify', message: `Ground truth locked: ${groundTruth.exact_business_name} in ${loc} (confidence: ${groundTruth.confidence || 'unknown'})` });
        businessNameHint = groundTruth.exact_business_name;
      } else {
        send('progress', { phase: 'verify', message: 'Ground truth verification returned no high-confidence NAP. Proceeding with website data only.' });
      }
    }

    // ── STEP 2: 7 parallel Perplexity deep searches (targeted follow-ups) ──
    const locationContext = groundTruth && groundTruth.city && groundTruth.state && groundTruth.city !== 'UNVERIFIED'
      ? ` located at ${groundTruth.street_address || ''}, ${groundTruth.city}, ${groundTruth.state} ${groundTruth.zip || ''}`
      : '';
    const _elapsed = Date.now() - _startTime;
    const _timeLeft = 55000 - _elapsed; // 55s budget (5s buffer before 60s limit)
    const _skipExtraSearches = _timeLeft < 25000; // If less than 25s left, reduce searches
    if (_skipExtraSearches) {
      send('progress', { phase: 'search', message: 'Time budget tight - running reduced searches...' });
    }
    send('progress', { phase: 'search', message: `Running deep research searches for "${businessNameHint}"${locationContext}...` });

    let searchResults = { business: null, reviews: null, people: null, competitors: null, news: null, pricing: null, digital: null };

    if (perplexityKey) {
      const bizRef = `"${businessNameHint}" funeral home${locationContext} (website: ${url})`;
      const searches = await Promise.allSettled([
        // Search 1: Business deep dive
        perplexitySearch(perplexityKey,
          `Conduct an exhaustive investigation of ${bizRef}. I need VERIFIED facts only. IMPORTANT: Do NOT research a different business with a similar name. The exact business is at ${url}${locationContext}.

Find and report:
1. OWNERSHIP: Who owns this funeral home? Is it family-owned or corporate-owned? Which generation? Is it part of a chain like SCI/Dignity Memorial, NorthStar, or Foundation Partners? Check state business filings if possible.
2. FOUNDING: Exact founding year. Any name changes over the years?
3. LOCATIONS: Every location with full addresses, phone numbers, and service areas.
4. LICENSING: State funeral director license numbers if publicly available.
5. AFFILIATIONS: NFDA membership, state association membership, Selected Independent Funeral Homes, any other affiliations.
6. CORPORATE STRUCTURE: LLC, Corporation, partnership? Any recent ownership transfers or acquisitions?
7. HISTORY: Major milestones, expansions, renovations, mergers.

Be extremely specific. Include sources/URLs for every claim.`,
          3000
        ),

        // Search 2: Reviews and reputation deep dive
        perplexitySearch(perplexityKey,
          `Find ALL review data for "${businessNameHint}" funeral home (${url}):

1. GOOGLE REVIEWS: Exact rating (e.g. 4.7), exact number of reviews, most recent review date. Quote 2-3 specific review themes (both positive and negative). What do families specifically praise? What complaints exist?
2. YELP: Rating and review count. Any notable reviews?
3. BBB: Rating, accreditation status, number of complaints in last 3 years, any resolved/unresolved complaints.
4. FACEBOOK: Page rating, number of recommendations, engagement level.
5. OTHER PLATFORMS: Check FuneralWise, Dignity Memorial, Ever Loved, Legacy.com for any reviews.
6. RESPONSE RATE: Does the business respond to Google reviews? How quickly? What tone?
7. REPUTATION TRENDS: Any pattern of improving or declining reviews?

Provide exact numbers and quote specific review themes. Cite sources.`,
          2500
        ),

        // Search 3: People and staff deep dive
        perplexitySearch(perplexityKey,
          `Find EVERY person associated with "${businessNameHint}" funeral home (${url}):

1. OWNERS AND PRINCIPALS: Full names, titles, how long they have been with the business, education (mortuary school?), licensing.
2. FUNERAL DIRECTORS: All licensed funeral directors. Check state licensing board databases.
3. MANAGEMENT: General managers, office managers, pre-planning counselors.
4. LINKEDIN PROFILES: Search for staff on LinkedIn. Note their career history, education, endorsements, connections.
5. COMMUNITY ROLES: Any civic involvement, board memberships, Rotary/Kiwanis, chamber of commerce?
6. OBITUARY SIGNATURES: Check recent obituaries, as they often list the attending funeral director.
7. INDUSTRY RECOGNITION: Any awards, speaking engagements, published articles?
8. PERSONAL DETAILS: Where did they go to school? Where did they work before? How long in the industry?

For each person found, provide: Full name, title, approximate tenure, source of information.`,
          2500
        ),
        // Search 6: Pricing intelligence
        perplexitySearch(perplexityKey,
          `Research pricing information for "${businessNameHint}" funeral home (${url}) and their local market:

1. Check if they publish a General Price List (GPL) online. Federal FTC Funeral Rule requires they provide one. Is it downloadable from their website?
2. If GPL is found, extract: basic services fee, embalming fee, viewing/visitation fee, funeral ceremony fee, cremation fee, direct cremation fee, casket price range.
3. If GPL is not online, search for any pricing references on their website or in reviews.
4. Compare to state/national averages: What is the average funeral cost in their state? Average cremation cost?
5. Are they positioned as premium, mid-range, or budget?
6. Do they offer payment plans or financing?
7. Do they partner with insurance companies for pre-need plans?
8. Check competitors' pricing if available for comparison.

Provide actual dollar amounts wherever possible. Cite sources.`,
          2000
        )
      ]);

      searchResults.business = searches[0]?.status === 'fulfilled' ? searches[0].value.content : null;
      searchResults.reviews = searches[1]?.status === 'fulfilled' ? searches[1].value.content : null;
      searchResults.people = searches[2]?.status === 'fulfilled' ? searches[2].value.content : null;
      searchResults.pricing = searches[3]?.status === 'fulfilled' ? searches[3].value.content : null;
      // Note: competitors, news, and digital searches were removed to save time budget.
      // Their slots remain null, which is handled gracefully in the synthesis prompt.

      const foundCount = Object.values(searchResults).filter(v => v).length;
      send('progress', { phase: 'search', message: `Deep research complete. Got results from ${foundCount}/7 searches.` });
    } else {
      send('progress', { phase: 'search', message: 'No Perplexity API key available. Skipping web searches. Results will be limited to website crawl only.' });
    }

    // ── STEP 3: Enterprise-grade synthesis with Claude ──
    send('progress', { phase: 'compile', message: 'Analyzing all research data and compiling enterprise profile...' });

    // Cap total website content to prevent synthesis prompt from exceeding Claude's
    // practical processing time. With 31+ pages at 6000 chars each, the prompt can
    // balloon to 200K+ chars and the API call exceeds Vercel's 60s timeout.
    const MAX_SYNTHESIS_CONTENT = 30000; // ~30K chars total for all page content
    const pageEntries = Object.entries(websiteContent);
    const perPageLimit = Math.max(800, Math.floor(MAX_SYNTHESIS_CONTENT / Math.max(pageEntries.length, 1)));
    const websiteContentStr = pageEntries
      .map(([path, text]) => `=== PAGE: ${baseUrl}${path} ===\n${text.substring(0, perPageLimit)}`)
      .join('\n\n')
      .substring(0, MAX_SYNTHESIS_CONTENT);

    const synthesisPrompt = `You are a senior business intelligence analyst compiling a comprehensive prospect dossier. You have been given REAL data from Perplexity deep research (your PRIMARY source), direct website crawling, subdomain probing, ground-truth verification, and 7 parallel live web searches. Your job is to compile this into a thorough, verified research profile that a sales team can rely on for meeting preparation.

CRITICAL RULES:
- ONLY include information that is ACTUALLY found in the sources below.
- Do NOT fabricate, guess, or infer information that is not supported by the data.
- If something was not found, use "Not found" or omit it entirely.
- Every claim should trace back to something in the provided sources.
- Distinguish between CONFIRMED facts and INFERRED conclusions (mark inferences with "[inferred]").
- When you have conflicting information from different sources, note both and indicate which is more likely accurate.
- For any dollar amounts, ratings, or counts, only include if explicitly found in sources.
- GROUND TRUTH takes absolute precedence. If any web search result disagrees with the GROUND TRUTH NAP block below, the ground truth is correct. Never place this business in a different city or state than the ground truth.
- The PERPLEXITY DEEP RESEARCH section below is your PRIMARY data source. It contains comprehensive web research including information from pages that the direct website crawler could not access. Prioritize its data, cross-referencing with direct crawl data where available.

=== GROUND TRUTH (VERIFIED NAP - USE THESE EXACT VALUES, DO NOT OVERRIDE) ===
${groundTruth ? JSON.stringify(groundTruth, null, 2) : 'Ground truth verification not available, use website data and flag low confidence'}

=== PERPLEXITY DEEP RESEARCH (PRIMARY SOURCE - comprehensive web intelligence) ===
${(deepResearchData || 'Deep research not available (no Perplexity key). Relying on direct crawl and targeted searches only.').substring(0, 8000)}

=== WEBSITE CONTENT (supplementary direct crawl of ${url}) ===
Pages found: ${foundPages.join(', ')}
${foundPages.length === 0 ? 'NOTE: Direct website crawling returned 0 accessible pages. This is common when sites block server-side requests. The Perplexity deep research above is the primary data source and CAN access these pages.' : ''}
Active subdomains: ${activeSubdomains.length > 0 ? activeSubdomains.join(', ') : 'None detected'}
GHL detected: ${ghlDetected ? 'YES' : 'No'}

${websiteContentStr || 'WARNING: Could not access any pages on this website directly. Use Perplexity deep research data instead.'}

=== TECH STACK (detected from HTML source code analysis) ===
${techStack.length > 0 ? techStack.join('\n') : 'Could not inspect source code (site blocked direct access)'}

=== EXTRACTED CONTACT INFO ===
${JSON.stringify(contactInfo)}

=== EXTRACTED SOCIAL LINKS ===
${JSON.stringify(socialLinks)}

=== VISUAL IDENTITY (extracted from homepage for demo design matching) ===
${visualIdentity ? JSON.stringify(visualIdentity, null, 2) : 'Could not extract visual identity (homepage not accessible)'}

=== GPL/PRICING PAGE CONTENT ===
${gplContent || 'No pricing page found on website'}

=== PRE-PLANNING PAGE CONTENT ===
${prePlanContent || 'No pre-planning page found on website'}

=== WEB SEARCH 1: BUSINESS DEEP DIVE ===
${(searchResults.business || 'No search results available').substring(0, 2500)}

=== WEB SEARCH 2: REVIEWS & REPUTATION ===
${(searchResults.reviews || 'No search results available').substring(0, 2500)}

=== WEB SEARCH 3: PEOPLE & STAFF ===
${(searchResults.people || 'No search results available').substring(0, 2500)}

=== WEB SEARCH 4: COMPETITORS & MARKET ===
${(searchResults.competitors || 'No search results available').substring(0, 2500)}

=== WEB SEARCH 5: NEWS & COMMUNITY ===
${(searchResults.news || 'No search results available').substring(0, 2000)}

=== WEB SEARCH 6: PRICING INTELLIGENCE ===
${(searchResults.pricing || 'No search results available').substring(0, 2000)}

=== WEB SEARCH 7: DIGITAL PRESENCE AUDIT ===
${(searchResults.digital || 'No search results available').substring(0, 2000)}

Based ONLY on the above real data, compile and return a JSON object. Return ONLY valid JSON (no markdown, no code blocks, no explanation before or after). Use this structure:

{
  "business_name": "official name as found on website or search results",
  "owner_name": "actual owner name if found, or 'Not found'",
  "owners_and_directors": [
    {"name": "full name", "role": "their title/role", "background": "what was found about them including career history, education, tenure", "linkedin": "LinkedIn URL if found", "source": "where this was found"}
  ],
  "phone": "phone number",
  "email": "email if found",
  "address": "full street address",
  "city": "city",
  "state": "state abbreviation",
  "founded": "year if found, or 'Not found'",
  "ownership_type": "family-owned/corporate-owned/independent with specifics",
  "ownership_details": "detailed ownership info: generation, parent company if any, recent transfers",
  "corporate_parent": "parent company name if corporate, or null",
  "generation": "first/second/third generation if mentioned, or 'Not found'",
  "services": ["list", "of", "actual", "services"],
  "services_detail": {
    "Service Name": "detailed description as found"
  },
  "locations": [
    {"name": "location name", "address": "full address", "phone": "phone", "area": "service area"}
  ],
  "unique_selling_points": "actual differentiators found",
  "service_area": "geographic area they serve",
  "tagline": "actual tagline from website, or 'Not found'",
  "website_url": "${url}",
  "website_pages_found": ${JSON.stringify(foundPages)},
  "active_subdomains": ${JSON.stringify(activeSubdomains)},
  "ghl_detected": ${ghlDetected},
  "tech_stack": ${JSON.stringify(techStack)},
  "tech_stack_confirmed": ["only items verified from multiple sources"],
  "tech_stack_gaps": ["technology they are notably MISSING"],
  "has_online_booking": false,
  "has_chat_widget": false,
  "has_mobile_responsive": ${techStack.some(t => t.includes('Mobile viewport')) ? 'true' : 'false'},
  "has_structured_data": ${techStack.some(t => t.includes('Schema.org')) ? 'true' : 'false'},
  "has_analytics": ${techStack.some(t => t.includes('Google Analytics')) ? 'true' : 'false'},
  "has_ghl": ${ghlDetected},
  "has_parting_pro": false,
  "has_gpl_online": ${gplContent ? 'true' : 'false'},
  "has_pre_planning_page": ${prePlanContent ? 'true' : 'false'},
  "has_email_nurture": false,
  "has_blog": false,
  "pricing": {
    "gpl_available": ${gplContent ? 'true' : 'false'},
    "basic_services_fee": "dollar amount or 'Not found'",
    "traditional_funeral_range": "range or 'Not found'",
    "cremation_range": "range or 'Not found'",
    "direct_cremation": "price or 'Not found'",
    "payment_plans": "yes/no/not found",
    "pre_need_insurance": "yes/no/not found",
    "price_positioning": "premium/mid-range/budget/not determinable"
  },
  "google_reviews": {
    "rating": "X.X or 'Not found'",
    "count": "number or 'Not found'",
    "response_rate": "estimated or 'Not found'",
    "positive_themes": ["specific themes families praise"],
    "negative_themes": ["specific complaints if any"],
    "recent_trend": "improving/stable/declining/not enough data"
  },
  "yelp_reviews": {
    "rating": "X.X or 'Not found'",
    "count": "number or 'Not found'"
  },
  "bbb_rating": "rating if found or 'Not found'",
  "bbb_complaints": "complaint count and status or 'Not found'",
  "facebook_reviews": {
    "rating": "X.X or 'Not found'",
    "recommendations": "number or 'Not found'"
  },
  "competitors": [
    {
      "name": "competitor name",
      "url": "website",
      "distance": "approximate distance",
      "google_rating": "rating",
      "review_count": "count",
      "ownership_type": "family/corporate",
      "key_differences": "how they compare",
      "has_chat": false,
      "has_booking": false,
      "has_ai": false,
      "price_positioning": "premium/mid/budget",
      "tech_assessment": "brief tech stack assessment"
    }
  ],
  "market_data": {
    "county_population": "population or 'Not found'",
    "median_age": "age or 'Not found'",
    "annual_deaths": "count or 'Not found'",
    "funeral_homes_in_area": "count or 'Not found'",
    "cremation_rate": "percentage or 'Not found'",
    "avg_funeral_cost_local": "dollar amount or 'Not found'",
    "market_trend": "growing/stable/declining or 'Not found'"
  },
  "community_involvement": ["actual activities found with dates/details"],
  "recent_news": ["actual news items with dates and sources"],
  "social_media": {
    "facebook": "URL or 'Not found'",
    "facebook_followers": "count or 'Not found'",
    "facebook_posting_frequency": "description or 'Not found'",
    "instagram": "URL or 'Not found'",
    "linkedin": "URL or 'Not found'",
    "youtube": "URL or 'Not found'"
  },
  "obituary_volume": "estimated monthly count and source, or 'Not found'",
  "estimated_annual_cases": "estimated case count based on all data, or 'Not found'",
  "staff_count_estimate": "based on staff page and research, or 'Not found'",
  "pre_planning_infrastructure": {
    "has_page": ${prePlanContent ? 'true' : 'false'},
    "has_forms": false,
    "has_checklist": false,
    "has_downloadable_guide": false,
    "has_seminars": false,
    "pre_need_partners": "insurance company names if found"
  },
  "email_marketing": {
    "platform_detected": "Mailchimp/Constant Contact/none/not found",
    "evidence_of_nurture": false,
    "newsletter_signup": false
  },
  "digital_presence_assessment": {
    "score": "1-10",
    "google_business_optimized": true,
    "seo_ranking_estimate": "description of local SEO presence",
    "website_last_updated": "estimate or 'Not found'",
    "mobile_experience": "good/poor/not tested",
    "strengths": ["specific digital strengths"],
    "weaknesses": ["specific digital gaps"],
    "critical_gaps": ["the most important things they are missing"],
    "opportunities": ["where Sarah AI would add immediate, specific value"]
  },
  "sarah_ai_fit_score": "1-10 with brief justification",
  "research_sources": ["every source that provided information"],
  "research_gaps": ["what could NOT be found or verified"],
  "confidence_level": "high/medium/low based on data quality",
  "data_freshness": "assessment of how current the data is"
}

Set boolean flags based on ACTUAL evidence found. Be thorough. Return ONLSet boolean flags based on ACTUAL evidence found. Be thorough. Return ONLY the JSON.`;

    // ── TIME BUDGET CHECK ──
    // Vercel Hobby has a hard 60s limit. Reserve time for synthesis API call.
    const _synthElapsed = Date.now() - _startTime;
    const _synthTimeLeft = 55000 - _synthElapsed; // 5s safety buffer
    let synthesisMaxTokens = 3000;

    if (_synthTimeLeft < 12000) {
      // Less than 12s left - not enough time for synthesis. Build minimal profile
      // from ground truth and search data without calling Claude.
      send('progress', { phase: 'compile', message: `Time budget critical (${Math.round(_synthTimeLeft / 1000)}s left). Building profile from raw data...` });
      content = JSON.stringify({
        business_name: businessNameHint || 'Unknown',
        phone: contactInfo?.phone || groundTruth?.phone || 'Not found',
        email: contactInfo?.email || groundTruth?.email || 'Not found',
        address: groundTruth?.street_address || 'Not found',
        city: groundTruth?.city || 'Not found',
        state: groundTruth?.state || 'Not found',
        website_url: url,
        website_pages_found: foundPages,
        services: ['Funeral Services', 'Cremation Services'],
        confidence_level: 'low',
        research_gaps: ['Synthesis skipped due to time constraints - raw data available'],
        _time_budget_exceeded: true,
      });
    } else {
      // Enough time - run synthesis, but reduce max_tokens if tight on time
      if (_synthTimeLeft < 25000) {
        synthesisMaxTokens = 2000; // Faster response with fewer tokens
        send('progress', { phase: 'compile', message: `Time budget tight (${Math.round(_synthTimeLeft / 1000)}s left). Running fast synthesis...` });
      }

      // Send keepalive pings during synthesis to prevent SSE/Vercel timeout
      const keepalive = setInterval(() => {
        send('progress', { phase: 'compile', message: 'Still compiling research profile...' });
      }, 8000);

      try {
        const message = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: synthesisMaxTokens,
          messages: [{ role: 'user', content: synthesisPrompt }],
        });
        content = message.content[0].type === 'text' ? message.content[0].text : '';
      } finally {
        clearInterval(keepalive);
      }
    }
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

    // ── GROUND TRUTH OVERRIDE: lock NAP fields to verified values ──
    // This is the final safeguard. Even if Claude hallucinated, we overwrite with verified truth.
    if (groundTruth) {
      const gt = groundTruth;
      const isValid = (v) => v && v !== 'UNVERIFIED' && v !== 'Not found';
      if (isValid(gt.exact_business_name)) researchData.business_name = gt.exact_business_name;
      if (isValid(gt.street_address)) researchData.address = gt.street_address;
      if (isValid(gt.city)) researchData.city = gt.city;
      if (isValid(gt.state)) researchData.state = gt.state;
      if (isValid(gt.zip)) researchData.zip = gt.zip;
      if (isValid(gt.phone)) researchData.phone = gt.phone;
      if (isValid(gt.email)) researchData.email = gt.email;
      if (isValid(gt.website_canonical)) researchData.website_url = gt.website_canonical;
      if (Array.isArray(gt.all_locations) && gt.all_locations.length > 0) {
        // Prefer verified locations over synthesized ones
        researchData.locations = gt.all_locations.map(l => ({
          name: l.name || researchData.business_name,
          address: l.address || '',
          area: l.city_state_zip || '',
          phone: l.phone || '',
        }));
      }
      researchData._ground_truth = {
        verified: true,
        confidence: gt.confidence || 'unknown',
        sources: gt.verification_sources || [],
      };
    } else {
      researchData._ground_truth = { verified: false, confidence: 'none', sources: [] };
    }

    // Attach raw search data for downstream use (bumped from 3000 -> 4500 chars per search for richer quotes)
    researchData._raw_searches = {};
    Object.entries(searchResults).forEach(([key, val]) => {
      researchData._raw_searches[key] = val ? val.substring(0, 4500) : null;
    });

    // Attach raw website content for meeting prep (bumped from 8000 -> 12000 for quote richness)
    researchData._raw_website_content = websiteContentStr.substring(0, 12000);

    // Attach deep research data for meeting prep (this is the richest source)
    researchData._deep_research = deepResearchData ? deepResearchData.substring(0, 15000) : null;

    // Attach visual identity for demo page design matching
    researchData._visual_identity = visualIdentity;

    send('progress', { phase: 'complete', message: `Research complete. Found ${researchData.owners_and_directors?.length || 0} people, ${researchData.competitors?.length || 0} competitors, ${foundPages.length} website pages.${deepResearchData ? ' Perplexity deep research enriched all sections.' : ''}` });
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
    max_tokens: 1200,
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

  // Extract visual identity from research data (populated during research phase)
  const vi = research._visual_identity || {};
  const primaryColor = vi.primaryColor || '#1e3a5f';
  const secondaryColor = vi.secondaryColor || '#142842';
  const accentColor = vi.accentColor || '#BD8656';
  const logoUrl = vi.logoUrl || '';
  const clientFonts = vi.fonts && vi.fonts.length > 0 ? vi.fonts : [];
  const headingFont = clientFonts[0] || 'Cormorant Garamond';
  const bodyFont = clientFonts[1] || clientFonts[0] || 'Lato';
  const googleFontsUrl = vi.googleFontsUrl || '';

  // Build a logo instruction
  let logoInstruction = '';
  if (logoUrl) {
    // Make logo URL absolute if relative
    const absoluteLogo = logoUrl.startsWith('http') ? logoUrl : `${research.website_url || ''}${logoUrl}`;
    logoInstruction = `- Use the client's actual logo from: ${absoluteLogo} (display it in the header, sized appropriately)`;
  } else {
    logoInstruction = '- Use the business name as text logo in the header (elegant serif font)';
  }

  const htmlPrompt = `You are an expert HTML/CSS designer creating a beautiful funeral home website demo that CLOSELY MIRRORS the client's own website aesthetic.

Based on this funeral home information, generate a complete, single-file HTML page with embedded Sarah AI chatbot:

Business: ${research.business_name}
Owner: ${research.owner_name}
Phone: ${research.phone}
Address: ${research.address}, ${research.city}, ${research.state}
Services: ${(research.services || []).join(', ')}
Locations: ${(research.locations || []).map(l => l.name + ' - ' + l.address).join('; ')}
Tagline: ${research.tagline}
Website: ${research.website_url}

CRITICAL DESIGN REQUIREMENT: MIRROR THE CLIENT'S HOMEPAGE
The demo page should feel like a polished, upgraded version of the client's own website. A funeral home owner visiting this page should immediately feel it "looks like us, but better."

Design requirements:
- Single, complete HTML file with inline CSS and inline JavaScript
- Color scheme extracted from client's website: primary ${primaryColor}, secondary ${secondaryColor}, accent ${accentColor}
  If these are generic fallbacks, create a tasteful, dignified funeral home palette that complements the business name.
- Heading font: "${headingFont}", Body font: "${bodyFont}"
  ${googleFontsUrl ? 'Google Fonts URL detected: ' + googleFontsUrl : 'Load appropriate Google Fonts for the heading and body fonts.'}
${logoInstruction}
- Header with the funeral home's branding prominently displayed, plus a subtle "Powered by Mortem AI" badge (small, bottom-right corner or footer)
- Navigation bar with Home, Services, About, Contact
- Hero section with their tagline and embedded Sarah chat widget as the centerpiece
- Services section listing all their services with icons
- About/Location section with address and contact info
- Footer with contact info, copyright, and small Mortem AI attribution
- Sarah chat widget that:
  a. Appears prominently in the hero section as a beautiful, inviting chat panel
  b. Has a message input field and scrollable chat history display
  c. Sends messages to the pipeline API chat proxy endpoint:
     POST to the SAME ORIGIN at /api/pipeline with body: { "action": "chat", "message": userMessage, "history": conversationHistory, "systemPrompt": SARAH_SYSTEM_PROMPT }
     The response JSON has { "reply": "Sarah's response text" }
  d. Does NOT call the Anthropic API directly from the browser. All AI calls go through /api/pipeline.
  e. Store the system prompt as a JavaScript constant in the page
  f. Show a typing indicator while waiting for response
  g. Handle errors gracefully with a friendly retry message
  h. Style the chat to match the funeral home's color scheme
- Responsive design for mobile and desktop
- Smooth animations and transitions
- The overall look should be warm, compassionate, and professional, matching the dignity of a funeral home website

Return ONLY the complete, valid HTML string. No markdown, no code blocks, no explanations. Start with <!DOCTYPE html> and end with </html>.

Sarah AI System Prompt: You MUST include a JavaScript constant in the page. Use exactly this code:
const SARAH_SYSTEM_PROMPT = "__SARAH_PROMPT_PLACEHOLDER__";
The placeholder will be replaced server-side with the real prompt after generation.

Sarah is a warm, empathetic funeral home assistant chatbot. Design the chat UI accordingly.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 5000,
    messages: [{ role: 'user', content: htmlPrompt }],
  });

  let html = message.content[0].type === 'text' ? message.content[0].text : '';
  if (html.includes('```html')) html = html.replace(/```html\n?/, '').replace(/\n?```/, '');
  else if (html.includes('```')) html = html.replace(/```\n?/, '').replace(/\n?```/, '');
  html = html.trim();

  // Inject the full sarahPrompt, replacing the placeholder
  const safePrompt = sarahPrompt.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
  html = html.replace('__SARAH_PROMPT_PLACEHOLDER__', safePrompt);
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

  // ── IMMUTABLE GROUND TRUTH BLOCK (locked NAP to prevent hallucinations) ──
  const gt = research._ground_truth || { verified: false, confidence: 'none', sources: [] };
  const groundTruthBlock = `
==================================================================
IMMUTABLE GROUND TRUTH (VERIFIED NAP, DO NOT CONTRADICT ANYWHERE)
==================================================================
Business Name: ${research.business_name}
Street Address: ${research.address || 'Not verified'}
City: ${research.city || 'Not verified'}
State: ${research.state || 'Not verified'}
ZIP: ${research.zip || 'Not verified'}
Phone: ${research.phone || 'Not verified'}
Website: ${research.website_url || 'Not verified'}
All Locations: ${(research.locations || []).map(l => `${l.name || ''} at ${l.address || l.area || ''} ${l.phone ? '(' + l.phone + ')' : ''}`).join(' | ') || 'Single location or not verified'}
Verification Confidence: ${gt.confidence}
Verification Sources: ${(gt.sources || []).join(', ') || 'Website direct crawl'}

RULE: Every mention of location, phone, or address in this document MUST match the ground truth above exactly. Never place this business in a different city or state. Never mix up locations. If ground truth says "Washington, NC", never write "Washington, CT" or "North Haven, CT" anywhere in this document. This is non-negotiable.
==================================================================
`;

  // ── RAW SEARCH EXCERPTS (for direct quoting) ──
  const rawSearches = research._raw_searches || {};
  const rawSearchBlock = Object.entries(rawSearches)
    .filter(([, v]) => v)
    .map(([k, v]) => `--- RAW SEARCH: ${k.toUpperCase()} ---\n${v}`)
    .join('\n\n');

  // ── DEEP RESEARCH (richest data source from Perplexity) ──
  const deepResearchBlock = research._deep_research || '';

  const prompt = `You are the senior sales strategist at Mortem AI. You are producing a pre-meeting briefing document for Tom Magee to read in the 20 minutes before a live sales call with a funeral home. Tom must walk into that meeting knowing more about this specific business than the owner knows about their own digital presence. This document will also be used as the foundation for a formal proposal, so it must read at the quality level of a top-tier management consulting pre-read.

${groundTruthBlock}

============================================================
PERPLEXITY DEEP RESEARCH (PRIMARY INTELLIGENCE SOURCE)
============================================================
This is the most comprehensive research data available. It was gathered by Perplexity AI doing a deep web search including pages the direct crawler could not access. Use this as your primary source for all named specifics, review quotes, staff names, history, and competitive intelligence.

${deepResearchBlock || 'Deep research not available for this prospect.'}

============================================================
QUALITY BAR: HOWARD K. HILL FUNERAL SERVICES REFERENCE STANDARD
============================================================
The benchmark you must match is the Mortem AI proposal for Howard K. Hill Funeral Services. That document demonstrates the level of named-specificity required in every single section. Study the patterns below and replicate the density level exactly:

PATTERN 1: Named people, not generic roles.
BAD:  "The owner has been running the business for many years"
GOOD: "Anthony White, alongside founder Howard K. Hill, has led the group since the Hartford expansion"

PATTERN 2: Real dates and history, not vague references.
BAD:  "Established funeral home with a long tradition"
GOOD: "Operating for over 150 years, including the Henry L. Fuqua brand in Bloomfield acquired in 2015"

PATTERN 3: Specific integrations by name, not generic tech.
BAD:  "They use a CRM and a calendar system"
GOOD: "They run GoHighLevel (GHL) for email nurture plus four separate Outlook calendars: at-need and pre-need for New Haven, and at-need and pre-need for Hartford/Bloomfield"

PATTERN 4: Proof points with real names and numbers.
BAD:  "Other clients have seen results with Sarah"
GOOD: "Matt Thompson at Chippewa Valley Cremation saw 2 pre-need arrangements plus 3 at-need calls in his first 6 months with Sarah"

PATTERN 5: Direct review quotes in quotation marks, attributed to source.
BAD:  "Families appreciate their care"
GOOD: "'They were still calling to check in three months after my husband's funeral. That is not something you can buy anywhere else.' (Google Review, Hartford Location)"

PATTERN 6: Location-aware breakdown for multi-location operators.
BAD:  "They have multiple locations"
GOOD: "Three locations: 1240 Albany Avenue Hartford, 1 Simsbury Road Bloomfield (Henry L. Fuqua brand), and 1287 Chapel Street New Haven"

PATTERN 7: Specific dollar amounts and scenarios, not vague ROI.
BAD:  "Strong ROI potential"
GOOD: "Setup $1,495 one-time. Monthly $797 (base $397 + $200 Hartford + $200 New Haven). Break-even at one at-need call. Conservative model: 500 families per year across three locations."

PATTERN 8: Specific objection responses that quote the prospect's own review themes.
BAD:  "Handle the 'we're traditional' objection"
GOOD: "Objection: 'Our families are traditional and expect a human touch.' Response: 'Your own five-star review from the Hartford family who said they received a check-in call three months after the funeral is exactly what Sarah protects and extends. She does not replace that moment. She guarantees it reaches every family who looks for you at 11pm before they ever dial.'"

EVERY section of your document must contain AT LEAST 3 facts at the specificity level above. Count them before finalizing each section. If a section cannot reach 3 named specifics, write "GAP: [exact missing data point]" in that section and explain the strategic implication of the gap. Do not pad with generic funeral industry filler under any circumstances.

============================================================
RESEARCH DATA
============================================================

CORE BUSINESS FACTS:
- Business: ${research.business_name}
- Contact: ${contact} (${role})
- Phone: ${research.phone || 'GAP: phone not verified'}
- Address: ${research.address || ''}, ${research.city || ''}, ${research.state || ''} ${research.zip || ''}
- Founded: ${research.founded || 'GAP: founding year not verified'}
- Ownership Type: ${research.ownership_type || 'GAP: ownership not verified'}
- Ownership Details: ${research.ownership_details || ''}
- Corporate Parent: ${research.corporate_parent || 'None detected (likely independent)'}
- Generation: ${research.generation || 'GAP: generation not verified'}
- Services: ${(research.services || []).join(', ') || 'GAP: services not verified'}
- Service Detail: ${research.services_detail ? JSON.stringify(research.services_detail) : 'Not extracted'}
- Locations: ${(research.locations || []).map(l => `${l.name || ''} at ${l.address || l.area || ''} ${l.phone ? '(' + l.phone + ')' : ''}`).join(' | ') || 'Single location assumed'}
- Service Area: ${research.service_area || 'Local area'}
- Unique Selling Points: ${research.unique_selling_points || 'GAP: differentiation not clear'}
- Website: ${research.website_url || ''}
- Tagline: ${research.tagline || 'GAP: no tagline found'}
${demoUrl ? '- Live Demo URL: ' + demoUrl : '- Live Demo: not yet provisioned'}

PEOPLE FOUND:
${(research.owners_and_directors || []).map(p => `- ${p.name} (${p.role}): ${p.background || 'No details'} [LinkedIn: ${p.linkedin || 'not found'}] [Source: ${p.source || 'research'}]`).join('\n') || 'GAP: No named people found in research. The contact for this meeting is ' + contact + ' (' + role + '), but their specific background could not be verified. Flag as a discovery question for the call.'}

TECH STACK DETECTED:
${(research.tech_stack || []).join('\n') || 'GAP: no tech stack detected'}
Tech Stack Confirmed: ${(research.tech_stack_confirmed || []).join(', ') || 'None'}
Tech Stack Gaps: ${(research.tech_stack_gaps || []).join(', ') || 'Not assessed'}
GHL Detected: ${research.has_ghl || research.ghl_detected || false}
Parting Pro Detected: ${research.has_parting_pro || false}
Active Subdomains: ${(research.active_subdomains || []).join(', ') || 'None detected'}
Has Online Booking: ${research.has_online_booking || false}
Has Chat Widget: ${research.has_chat_widget || false}
Has GPL Online: ${research.has_gpl_online || false}
Has Pre-Planning Page: ${research.has_pre_planning_page || false}
Has Email Nurture: ${research.has_email_nurture || false}
Has Blog: ${research.has_blog || false}
Has Analytics: ${research.has_analytics || false}
Has Structured Data: ${research.has_structured_data || false}
Mobile Responsive: ${research.has_mobile_responsive || 'not tested'}

GOOGLE REVIEWS:
Rating: ${research.google_reviews?.rating || 'Not found'}
Count: ${research.google_reviews?.count || 'Not found'}
Response Rate: ${research.google_reviews?.response_rate || 'Not found'}
Positive Themes: ${(research.google_reviews?.positive_themes || []).join(' | ') || 'Not found'}
Negative Themes: ${(research.google_reviews?.negative_themes || []).join(' | ') || 'None flagged'}
Recent Trend: ${research.google_reviews?.recent_trend || 'Not enough data'}

OTHER REVIEWS:
Yelp: ${research.yelp_reviews?.rating || 'Not found'} (${research.yelp_reviews?.count || '0'} reviews)
BBB: ${research.bbb_rating || 'Not found'} (${research.bbb_complaints || 'no complaints'})
Facebook: ${research.facebook_reviews?.rating || 'Not found'}

PRICING INTELLIGENCE:
${research.pricing ? JSON.stringify(research.pricing, null, 2) : 'Not available'}

PRE-PLANNING INFRASTRUCTURE:
${research.pre_planning_infrastructure ? JSON.stringify(research.pre_planning_infrastructure, null, 2) : 'Not assessed'}

MARKET DATA:
${research.market_data ? JSON.stringify(research.market_data, null, 2) : 'Not available'}

COMPETITORS:
${(research.competitors || []).map(c => `- ${c.name} (${c.url || 'no URL'}): ${c.distance || '?'} away, ${c.google_rating || '?'} stars across ${c.review_count || '?'} reviews, ${c.ownership_type || 'unknown ownership'}. Chat: ${c.has_chat ? 'yes' : 'no'}. Booking: ${c.has_booking ? 'yes' : 'no'}. AI: ${c.has_ai ? 'yes' : 'no'}. Price: ${c.price_positioning || '?'}. Tech: ${c.tech_assessment || 'not assessed'}`).join('\n') || 'GAP: No competitors found in research. Flag as a pre-meeting research task.'}

DIGITAL PRESENCE ASSESSMENT:
Score: ${research.digital_presence_assessment?.score || 'Not rated'}/10
Strengths: ${(research.digital_presence_assessment?.strengths || []).join(' | ') || 'Not identified'}
Weaknesses: ${(research.digital_presence_assessment?.weaknesses || []).join(' | ') || 'Not identified'}
Critical Gaps: ${(research.digital_presence_assessment?.critical_gaps || []).join(' | ') || 'Not identified'}
Opportunities: ${(research.digital_presence_assessment?.opportunities || []).join(' | ') || 'Not identified'}

SARAH AI FIT SCORE: ${research.sarah_ai_fit_score || 'Not rated'}

SOCIAL MEDIA:
${research.social_media ? JSON.stringify(research.social_media, null, 2) : 'Not assessed'}

COMMUNITY INVOLVEMENT:
${(research.community_involvement || []).join(' | ') || 'GAP: no community involvement found'}

RECENT NEWS:
${(research.recent_news || []).join(' | ') || 'GAP: no recent news found'}

ESTIMATED CASE VOLUME: ${research.estimated_annual_cases || 'Not estimated'}
ESTIMATED STAFF COUNT: ${research.staff_count_estimate || 'Not estimated'}
OBITUARY VOLUME: ${research.obituary_volume || 'Not counted'}

RESEARCH GAPS:
${(research.research_gaps || []).join(' | ') || 'None flagged'}
Confidence Level: ${research.confidence_level || 'Not stated'}

============================================================
RAW WEBSITE CONTENT (for direct quotes, pull language from here)
============================================================
${(research._raw_website_content || 'Not available').substring(0, 8000)}

============================================================
RAW SEARCH EXCERPTS (for direct quotes, citations, named facts)
============================================================
${rawSearchBlock ? rawSearchBlock.substring(0, 12000) : 'Not available'}

============================================================
OUTPUT FORMAT
============================================================
Generate ONLY the inner HTML content for the <body> tag. Do NOT include <!DOCTYPE>, <html>, <head>, <style>, or <body> tags. The CSS stylesheet is pre-built and will be wrapped around your output automatically.

Use these CSS class names in your HTML:

COVER: <div class="cover"><div class="cover-topbar">...</div><div class="cover-body"><div class="cover-eyebrow">...</div><h1 class="cover-title">... <em>italic angle</em></h1><p class="cover-subtitle">...</p><div class="cover-meta"><div class="cover-meta-item"><span class="label">...</span><span class="value">...</span></div>...</div></div></div>
SECTIONS: <div class="content-wrap"><hr><div class="section-label">LABEL</div><h2 class="section-title">Title <em>italic</em></h2>...</div>
CARDS: <div class="card-grid card-grid-3"><div class="card"><h4>Title</h4><p>Content</p></div>...</div> (use card-grid-2 for 2 columns)
DARK BOX: <div class="dark-box"><div class="dark-box-label">Label</div><p>Content</p></div>
BURGUNDY BOX: <div class="burgundy-box"><p>Strategic narrative content</p></div>
QUOTE: <div class="quote-block"><p>"Quote text"</p><cite>Attribution</cite></div>
TABLE: <table class="scope-table"><thead><tr><th>Col</th></tr></thead><tbody><tr><td>Data</td></tr></tbody></table>
PRICING: <div class="pricing-grid"><div class="pricing-box"><h3>Title</h3><div class="price">$X</div></div><div class="pricing-box pricing-featured"><span class="pricing-tag">Your Plan</span>...</div></div>
ROI: <div class="roi-strip"><div class="roi-cell"><span class="roi-label">Label</span><span class="roi-value">Value</span></div><div class="roi-cell roi-highlight">...</div></div><p class="roi-note">Note</p>
INTRO BLOCK: <div class="intro-block"><p>Content</p></div>
CALLOUT: <div class="callout"><p>Content</p></div>
GAP: <div class="gap-note">GAP: specific missing data</div>
PROOF: <div class="proof-grid"><div class="proof-card"><div class="proof-stars">stars</div><blockquote>"Quote"</blockquote><cite>SOURCE</cite></div></div>
STEPS: <ol class="steps-list"><li class="step">Action</li></ol>
SIGNOFF: <div class="signoff"><div class="signoff-left"><h3>Tom Magee</h3><p class="signoff-role">Co-Founder, Mortem AI</p></div><div class="signoff-badge">Mortem AI</div></div>
LOGO: https://storage.googleapis.com/msgsndr/KwHyQsuzPI6o5CiZfPfN/media/689ef6fa5dc21c2e15d6807f.png

============================================================
DOCUMENT SECTIONS (generate all 17, each with 3+ named specifics)
============================================================
1. COVER HEADER: eyebrow, H1, subtitle, 4-item meta row (Contact, Location, Prepared by Tom Magee, Date)
2. STRATEGIC OPENING (intro-block): 3-4 sentences with specific review/website/strategic details
3. GROUND TRUTH PANEL: verified NAP card
4. THE OPPORTUNITY: 3-card grid + burgundy quote block
5. COMPANY DEEP DIVE: narrative + 3-card grid (case volume, revenue, staff)
6. CONTACT INTELLIGENCE: dark box with contact details or discovery questions
7. WHY SARAH FITS: burgundy box 2-paragraph narrative
8. DIGITAL AUDIT: scope table, min 14 rows
9. COMPETITIVE LANDSCAPE: scope table 5-7 competitors
10. FAMILY-NEED GAP ANALYSIS: scope table, min 10 rows
11. PRICING AND ROI: pricing grid + ROI strip (setup $1,495, monthly $397+ per location)
12. TALK TRACKS: scripted openings, 8 discovery Qs, 6 objection responses, demo walkthrough, closing
13. PROOF POINTS: proof grid 4 review quote cards + burgundy interpretation
14. PRE-MEETING CHECKLIST: steps list, 12-15 specific actions
15. EMAIL SEQUENCE: 3 emails (pre-meeting, follow-up, second follow-up)
16. RESEARCH SOURCES: intro-block summary
17. SIGNOFF: Tom Magee, Co-Founder, Mortem AI, tom@mortemai.com

============================================================
RULES
============================================================
1. Every section: 3+ named specifics (people, dates, dollars, quotes, URLs). No generic filler.
2. All claims trace to research data. Do NOT fabricate.
3. Quotes in quotation marks with source attribution.
4. Location must match ground truth. Never use em dashes.
5. If section lacks 3 specifics, write a gap-note.
6. Write as a senior strategist, not a template filler.
7. Use <hr> between major sections.

Return ONLY body HTML. No DOCTYPE, no head, no style. Start with <div class="cover"> end with signoff </div>.`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send the HTML template header as the first chunk
  const templateHeader = MEETING_PREP_HEADER(research.business_name || 'Meeting Prep');
  res.write(`data: ${JSON.stringify({ type: 'chunk', text: templateHeader })}\n\n`);

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

  // Send template footer to close the HTML document
  const templateFooter = '\n</body>\n</html>';
  res.write(`data: ${JSON.stringify({ type: 'chunk', text: templateFooter })}\n\n`);
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
          content: 'You are a fact-checker and investigative research assistant. Your job is to verify every factual claim in a sales meeting prep document about a funeral home. Use your internet access to check facts, find additional information, and flag any inaccuracies. Be extremely thorough. Check ownership, addresses, phone numbers, reviews, staff names, competitor details, and pricing claims.'
        },
        {
          role: 'user',
          content: `Fact-check this meeting prep document for ${research?.business_name || 'a funeral home'} (${research?.website_url || ''}).

The document text:
${textContent.substring(0, 15000)}

For EVERY factual claim:
1. VERIFY: Is this accurate? Check Google, business listings, state records, review sites.
2. CORRECT: What needs to be fixed? Include the correct information with sources.
3. ADD: What important information is missing? Search for:
   - Updated Google review count and rating
   - Any new staff members or changes
   - Recent obituaries (indicates current case volume)
   - Competitor updates
   - Any new technology they have adopted
   - Recent community events or news
   - Updated pricing if findable

Return findings as structured JSON:
{
  "verified_facts": ["fact 1 that checks out", "fact 2 that checks out"],
  "corrections": [{"claim": "what was said", "reality": "what is actually true", "source": "URL or source"}],
  "new_information": [{"topic": "category", "detail": "the new info found", "source": "URL or source"}],
  "missing_competitors": [{"name": "name", "url": "website", "notes": "key details found"}],
  "owner_info": {"details": "any new info about the owner/contact", "source": "where found"},
  "market_data": {"details": "updated local market info", "source": "where found"},
  "review_update": {"google_rating": "current rating", "google_count": "current count", "new_reviews_summary": "themes from recent reviews"},
  "overall_accuracy": "high/medium/low",
  "summary": "Brief assessment of document accuracy and completeness"
}

Return ONLY valid JSON.`
        }
      ],
      max_tokens: 1200,
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

  const gt = research._ground_truth || { verified: false, confidence: 'none', sources: [] };
  const groundTruthBlock = `
==================================================================
IMMUTABLE GROUND TRUTH (VERIFIED NAP, DO NOT CONTRADICT ANYWHERE)
==================================================================
Business Name: ${research.business_name}
Street Address: ${research.address || 'Not verified'}
City: ${research.city || 'Not verified'}
State: ${research.state || 'Not verified'}
ZIP: ${research.zip || 'Not verified'}
Phone: ${research.phone || 'Not verified'}
Website: ${research.website_url || 'Not verified'}
All Locations: ${(research.locations || []).map(l => `${l.name || ''} at ${l.address || l.area || ''} ${l.phone ? '(' + l.phone + ')' : ''}`).join(' | ') || 'Single location'}
Verification Confidence: ${gt.confidence}

RULE: Every mention of location, phone, or address MUST match the ground truth above. Never place this business in a different city or state. If the fact-check results below disagree with ground truth, ground truth wins.
==================================================================
`;

  const prompt = `You are the senior sales strategist at Mortem AI. You previously generated a meeting prep document for ${research.business_name} that has now been fact-checked with live internet research. Regenerate the COMPLETE document incorporating all verified facts and corrections, while maintaining the Howard K. Hill reference quality bar (real named specifics in every section, direct review quotes, no generic filler).

${groundTruthBlock}

ORIGINAL CONTEXT:
- Business: ${research.business_name}
- Contact: ${contact} (${role})
- Phone: ${research.phone || 'Not found'}
- Address: ${research.address || ''}, ${research.city || ''}, ${research.state || ''} ${research.zip || ''}
- Services: ${(research.services || []).join(', ')}
- Website: ${research.website_url || ''}
${demoUrl ? '- Live Demo: ' + demoUrl : ''}

FACT-CHECK RESULTS (incorporate ALL corrections and new intelligence):
${factCheckSummary}

INSTRUCTIONS:
- Regenerate the COMPLETE meeting prep HTML document using the original 17-section HKH-style structure (cover, strategic opening, locked NAP panel, opportunity, company deep dive, contact intelligence, why Sarah fits, digital audit, competitive landscape, family-need gap analysis, ROI model, talk tracks, proof points, pre-meeting checklist, email sequence, sources and confidence, signoff)
- Replace incorrect claims with corrected information from fact-checking
- Add ALL new information discovered
- Update competitor analysis with real competitors found
- Update reviews data with current numbers and direct quotes where available
- Mark verified facts with a subtle green checkmark indicator (✓) next to the claim
- Mark corrected items with a subtle update indicator (↻) next to the claim
- Use the HKH design system: EB Garamond headings + Poppins body, dark primary #1a1818, gold #c4922a, burgundy narrative accent #9a3236, cream background #f7f3ef
- All colors use direct hex values with !important, no CSS variables in output
- Mortem logo URL: https://storage.googleapis.com/msgsndr/KwHyQsuzPI6o5CiZfPfN/media/689ef6fa5dc21c2e15d6807f.png
- Never use em dashes, use commas, periods, colons, or "to" instead
- Every section must contain at least 3 named specifics (person, place, date, dollar amount, quote, integration, URL, rating number, or count). No generic filler.
- Document must be at least 1600 lines of HTML

Return ONLY the complete HTML. Start with <!DOCTYPE html> and end with </html>.`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 20000,
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

  const ownerDetails = (research.owners_and_directors || []).map(p => `${p.name} (${p.role})`).join(', ') || research.owner_name || 'the team';
  // Sarah AI is the product being pitched
  const reviewInfo = research.google_reviews?.rating ? `${research.google_reviews.rating} stars from ${research.google_reviews.count} Google reviews` : '';
  const competitorMention = research.competitors?.[0]?.name || '';

  const prompt = `You are Tom Magee at Mortem AI, crafting hyper-personalized outreach messages for a funeral home prospect. You are pitching SARAH AI, a 24/7 AI assistant chatbot built specifically for their funeral home. The demo link shows Sarah already customized with their branding, services, and information.

WHAT SARAH AI DOES:
- Answers families' questions 24/7 (after-hours calls are a huge pain point for funeral homes)
- Handles pre-planning inquiries, service questions, and initial arrangements
- Trained on the specific funeral home's services, pricing, staff, and values
- Captures lead info (name, phone, needs) and routes to the funeral director
- Compassionate, professional tone that matches the funeral home's brand

PROSPECT INTELLIGENCE:
- Business: ${research.business_name}
- Contact: ${research.owner_name || 'Owner'}
- People found: ${ownerDetails}
- Phone: ${research.phone}
- City/State: ${research.city || ''}, ${research.state || ''}
- Services: ${(research.services || []).join(', ')}
- Founded: ${research.founded || 'established'}
- Ownership: ${research.ownership_type || 'independent'}
- Google Reviews: ${reviewInfo || 'Not found'}
- Demo URL: ${demoUrl}
- Currently has chat widget: ${research.has_chat_widget || false}
- Currently has online booking: ${research.has_online_booking || false}

OUTREACH RULES:
- The pitch is SARAH AI, not website redesign or mobile optimization
- Every message must reference at least 2 specific details about their business
- Never use em dashes
- Sound like a real person, not a template
- The demo URL shows Sarah already built for their funeral home, that is the hook
- Be respectful of the funeral industry, warm but professional
- Keep it brief, busy funeral directors do not read long emails
- Focus on the value of 24/7 family support and lead capture, not tech gaps

Generate messages in this exact JSON format (ONLY JSON, no markdown):
{
  "email": {
    "subject": "subject line that references their business specifically (under 50 chars)",
    "body": "full email body, 150 words max, references their specific situation, includes demo link, clear CTA"
  },
  "linkedin": "LinkedIn connection message, under 200 characters, references something specific about them or their business",
  "voicemail": "25-second voicemail script that sounds natural and references their business by name and a specific detail",
  "sms": "under 140 characters, casual but professional, includes demo link"
}

Return ONLY valid JSON.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
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

// ── Sarah Chat Proxy (allows demo pages to chat without exposing API keys) ──
async function handleChat(req, res) {
  const { message, history, systemPrompt } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });
  if (!systemPrompt) return res.status(400).json({ error: 'System prompt is required' });

  // Allow CORS from any Netlify demo subdomain
  const origin = req.headers.origin || '';
  if (origin.includes('.netlify.app') || origin.includes('localhost') || origin.includes('mortem-pipeline')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  const client = getClient(req.headers['x-api-key-override']);

  // Build message history for the conversation
  const messages = [];
  if (Array.isArray(history)) {
    history.forEach(h => {
      if (h.role && h.content) {
        messages.push({ role: h.role, content: h.content });
      }
    });
  }
  messages.push({ role: 'user', content: message });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: systemPrompt,
    messages: messages,
  });

  const reply = response.content[0]?.type === 'text' ? response.content[0].text : 'I apologize, I was unable to process your message. Please try again.';
  return res.status(200).json({ reply });
}

export default async function handler(req, res) {
  // Handle CORS preflight for chat endpoint
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin || '';
    if (origin.includes('.netlify.app') || origin.includes('localhost') || origin.includes('mortem-pipeline')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    return res.status(200).end();
  }

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
      case 'chat': return await handleChat(req, res);
      default: return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error(`Pipeline API error (${action}):`, error);
    return res.status(500).json({ error: error.message || 'Pipeline action failed' });
  }
}

export const config = { maxDuration: 300, api: { bodyParser: { sizeLimit: '10mb' } } };
