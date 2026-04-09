import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';

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

// ── Main Research Handler (Enterprise-grade SSE streaming) ──

async function handleResearch(req, res) {
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
    // ── STEP 1: Deep website crawl (expanded page list) ──
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

    // Extract contact info and social links
    const contactInfo = extractContactInfo(allHtmlCombined || '');
    const socialLinks = extractSocialLinks(allHtmlCombined || '');

    send('progress', { phase: 'crawl', message: `Tech stack: ${techStack.length > 0 ? techStack.join(', ') : 'Could not determine'}` });

    // Extract business name hint
    let businessNameHint = '';
    if (homepageHtml) {
      const titleMatch = homepageHtml.match(/<title>(.*?)<\/title>/i);
      if (titleMatch) businessNameHint = titleMatch[1].replace(/\s*[\||\-|\u2013]\s*Home.*$/i, '').replace(/\s*[\||\-|\u2013]\s*Welcome.*$/i, '').trim();
    }
    if (!businessNameHint) {
      try { businessNameHint = new URL(url).hostname.replace('www.', '').split('.')[0].replace(/-/g, ' '); } catch {}
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

    // ── STEP 2: 7 parallel Perplexity deep searches ──
    send('progress', { phase: 'search', message: `Running 7 deep research searches for "${businessNameHint}"...` });

    let searchResults = { business: null, reviews: null, people: null, competitors: null, news: null, pricing: null, digital: null };

    if (perplexityKey) {
      const searches = await Promise.allSettled([
        // Search 1: Business deep dive
        perplexitySearch(perplexityKey,
          `Conduct an exhaustive investigation of "${businessNameHint}" funeral home (website: ${url}). I need VERIFIED facts only.

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

        // Search 4: Competitor analysis deep dive
        perplexitySearch(perplexityKey,
          `Map the complete competitive landscape around "${businessNameHint}" funeral home (${url}):

1. List the TOP 5-7 nearest competitor funeral homes with:
   - Business name and exact address
   - Website URL
   - Google rating and review count
   - Whether they have online booking, chat, or AI features
   - Whether they are family-owned or corporate (SCI/Dignity Memorial, NorthStar, Foundation Partners, etc.)
   - Their approximate price range if findable
   - Their tech stack (do they have modern websites? Mobile responsive? Online arrangements?)

2. LOCAL MARKET DATA:
   - County/metro population
   - Median age and demographic breakdown
   - Annual death rate for the county
   - Number of funeral homes in the service area
   - Cremation rate for the state/region
   - Average funeral service cost in this market

3. MARKET TRENDS:
   - Is this a growing or declining market?
   - Any new funeral homes opened recently?
   - Any consolidation activity?
   - Are competitors investing in technology?

Be specific with names, numbers, and sources.`,
          3000
        ),

        // Search 5: News and community presence
        perplexitySearch(perplexityKey,
          `Search for ALL recent news, press coverage, and community involvement for "${businessNameHint}" funeral home (${url}):

1. LOCAL NEWS: Any newspaper mentions in the last 2 years. Check local paper archives.
2. COMMUNITY EVENTS: Sponsorships, charity events, memorial services, grief support groups, holiday remembrance events.
3. SOCIAL MEDIA ACTIVITY: Facebook posting frequency, Instagram presence, LinkedIn company page. What kind of content do they share?
4. AWARDS AND RECOGNITION: Any recent awards, "Best of" lists, community recognition?
5. BUSINESS CHANGES: Any recent expansions, renovations, new services, staff changes?
6. LEGAL: Any lawsuits, complaints, regulatory actions? (Check state attorney general, FTC, state board of funeral directors)
7. OBITUARY VOLUME: Check their obituary page or Legacy.com. Approximately how many obituaries per month? This indicates case volume.
8. PRE-PLANNING EVENTS: Do they hold pre-planning seminars or workshops?

Cite specific articles, dates, and sources.`,
          2000
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
        ),

        // Search 7: Digital presence and technology audit
        perplexitySearch(perplexityKey,
          `Audit the digital presence and technology of "${businessNameHint}" funeral home (${url}):

1. WEBSITE ANALYSIS: Is their site mobile-responsive? What platform is it built on? When was it last updated? PageSpeed score if checkable?
2. SEO: Do they rank on first page of Google for "[city] funeral home"? What keywords do they rank for? Do they have a Google Business Profile? Is it claimed and optimized?
3. GOOGLE BUSINESS PROFILE: Hours listed, categories, photos count, Q&A section, posts frequency, booking link.
4. ONLINE BOOKING: Can families schedule consultations online? Is there a contact form? Do they have live chat?
5. CRM/TECH: Any evidence of GoHighLevel (GHL), Salesforce, HubSpot, or other CRM? Check for www1 subdomains, LeadConnectorHQ markers, or msgsndr CDN references.
6. EMAIL MARKETING: Any evidence of email newsletters, drip campaigns, Mailchimp, Constant Contact?
7. CONTENT MARKETING: Do they have a blog? Resource library? How frequently updated?
8. SOCIAL MEDIA: Platform presence, posting frequency, follower counts, engagement rates.
9. PARTING PRO / ARRANGEMENT SOFTWARE: Do they use any online arrangement tools?
10. COMPETITORS TECH: What are nearby competitors using for technology?

Be specific about what they DO and DO NOT have.`,
          2500
        ),
      ]);

      searchResults.business = searches[0]?.status === 'fulfilled' ? searches[0].value.content : null;
      searchResults.reviews = searches[1]?.status === 'fulfilled' ? searches[1].value.content : null;
      searchResults.people = searches[2]?.status === 'fulfilled' ? searches[2].value.content : null;
      searchResults.competitors = searches[3]?.status === 'fulfilled' ? searches[3].value.content : null;
      searchResults.news = searches[4]?.status === 'fulfilled' ? searches[4].value.content : null;
      searchResults.pricing = searches[5]?.status === 'fulfilled' ? searches[5].value.content : null;
      searchResults.digital = searches[6]?.status === 'fulfilled' ? searches[6].value.content : null;

      const foundCount = Object.values(searchResults).filter(v => v).length;
      send('progress', { phase: 'search', message: `Deep research complete. Got results from ${foundCount}/7 searches.` });
    } else {
      send('progress', { phase: 'search', message: 'No Perplexity API key available. Skipping web searches. Results will be limited to website crawl only.' });
    }

    // ── STEP 3: Enterprise-grade synthesis with Claude ──
    send('progress', { phase: 'compile', message: 'Analyzing all research data and compiling enterprise profile...' });

    const websiteContentStr = Object.entries(websiteContent)
      .map(([path, text]) => `=== PAGE: ${baseUrl}${path} ===\n${text}`)
      .join('\n\n');

    const synthesisPrompt = `You are a senior business intelligence analyst compiling a comprehensive prospect dossier. You have been given REAL data from actual website crawling, subdomain probing, and 7 parallel live web searches. Your job is to compile this into a thorough, verified research profile that a sales team can rely on for meeting preparation.

CRITICAL RULES:
- ONLY include information that is ACTUALLY found in the sources below.
- Do NOT fabricate, guess, or infer information that is not supported by the data.
- If something was not found, use "Not found" or omit it entirely.
- Every claim should trace back to something in the provided sources.
- Distinguish between CONFIRMED facts and INFERRED conclusions (mark inferences with "[inferred]").
- When you have conflicting information from different sources, note both and indicate which is more likely accurate.
- For any dollar amounts, ratings, or counts, only include if explicitly found in sources.

=== WEBSITE CONTENT (deep crawl of ${url}) ===
Pages found: ${foundPages.join(', ')}
Active subdomains: ${activeSubdomains.length > 0 ? activeSubdomains.join(', ') : 'None detected'}
GHL detected: ${ghlDetected ? 'YES' : 'No'}

${websiteContentStr || 'WARNING: Could not access any pages on this website.'}

=== TECH STACK (detected from HTML source code analysis) ===
${techStack.length > 0 ? techStack.join('\n') : 'Could not inspect source code'}

=== EXTRACTED CONTACT INFO ===
${JSON.stringify(contactInfo)}

=== EXTRACTED SOCIAL LINKS ===
${JSON.stringify(socialLinks)}

=== GPL/PRICING PAGE CONTENT ===
${gplContent || 'No pricing page found on website'}

=== PRE-PLANNING PAGE CONTENT ===
${prePlanContent || 'No pre-planning page found on website'}

=== WEB SEARCH 1: BUSINESS DEEP DIVE ===
${searchResults.business || 'No search results available'}

=== WEB SEARCH 2: REVIEWS & REPUTATION ===
${searchResults.reviews || 'No search results available'}

=== WEB SEARCH 3: PEOPLE & STAFF ===
${searchResults.people || 'No search results available'}

=== WEB SEARCH 4: COMPETITORS & MARKET ===
${searchResults.competitors || 'No search results available'}

=== WEB SEARCH 5: NEWS & COMMUNITY ===
${searchResults.news || 'No search results available'}

=== WEB SEARCH 6: PRICING INTELLIGENCE ===
${searchResults.pricing || 'No search results available'}

=== WEB SEARCH 7: DIGITAL PRESENCE AUDIT ===
${searchResults.digital || 'No search results available'}

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

Set boolean flags based on ACTUAL evidence found. Be thorough. Return ONLY the JSON.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
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
    researchData._raw_searches = {};
    Object.entries(searchResults).forEach(([key, val]) => {
      researchData._raw_searches[key] = val ? val.substring(0, 3000) : null;
    });

    // Attach raw website content for meeting prep
    researchData._raw_website_content = websiteContentStr.substring(0, 8000);

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

  const prompt = `You are a senior sales strategist at Mortem AI with 15 years of experience in funeral industry SaaS sales. You are creating the definitive meeting prep document for Tom Magee to use before a sales call. This document must be so thorough that Tom walks into the meeting knowing more about this funeral home's digital presence than the owner does.

CRITICAL: This is not a template. Every single section must contain REAL, SPECIFIC information drawn from the research data provided. If information was not found, say exactly what was not found and what that gap means strategically. Never fill sections with generic funeral industry boilerplate.

FUNERAL HOME RESEARCH DATA:
- Business: ${research.business_name}
- Contact: ${contact} (${role})
- Phone: ${research.phone || 'Not found'}
- Address: ${research.address || ''}, ${research.city || ''}, ${research.state || ''}
- Founded: ${research.founded || 'Not found'}
- Ownership: ${research.ownership_type || 'Not found'} ${research.ownership_details || ''}
- Services: ${(research.services || []).join(', ')}
- Locations: ${(research.locations || []).map(l => l.name + ' - ' + (l.address || l.area || '')).join('; ')}
- Service Area: ${research.service_area || 'local area'}
- Unique Points: ${research.unique_selling_points || 'N/A'}
- Website: ${research.website_url || ''}
- Tagline: ${research.tagline || ''}
${demoUrl ? '- Live Demo: ' + demoUrl : ''}

TECH STACK CONFIRMED:
${(research.tech_stack || []).join('\n')}
${research.tech_stack_gaps ? 'GAPS: ' + (research.tech_stack_gaps || []).join(', ') : ''}
GHL Detected: ${research.has_ghl || research.ghl_detected || false}
Active Subdomains: ${(research.active_subdomains || []).join(', ') || 'None'}
Has Online Booking: ${research.has_online_booking || false}
Has Chat Widget: ${research.has_chat_widget || false}
Has GPL Online: ${research.has_gpl_online || false}
Has Pre-Planning Page: ${research.has_pre_planning_page || false}
Has Email Nurture: ${research.has_email_nurture || false}

PEOPLE FOUND:
${(research.owners_and_directors || []).map(p => `- ${p.name} (${p.role}): ${p.background || 'No details'} [Source: ${p.source || 'research'}]`).join('\n') || 'None found'}

GOOGLE REVIEWS:
Rating: ${research.google_reviews?.rating || 'Not found'}
Count: ${research.google_reviews?.count || 'Not found'}
Positive themes: ${(research.google_reviews?.positive_themes || []).join(', ') || 'Not found'}
Negative themes: ${(research.google_reviews?.negative_themes || []).join(', ') || 'Not found'}

COMPETITORS:
${(research.competitors || []).map(c => `- ${c.name}: ${c.google_rating || '?'} stars (${c.review_count || '?'} reviews), ${c.ownership_type || 'unknown'}, chat: ${c.has_chat}, booking: ${c.has_booking}, AI: ${c.has_ai}`).join('\n') || 'None found'}

MARKET DATA:
${research.market_data ? JSON.stringify(research.market_data, null, 2) : 'Not available'}

PRICING:
${research.pricing ? JSON.stringify(research.pricing, null, 2) : 'Not available'}

PRE-PLANNING INFRASTRUCTURE:
${research.pre_planning_infrastructure ? JSON.stringify(research.pre_planning_infrastructure, null, 2) : 'Not available'}

DIGITAL ASSESSMENT:
Score: ${research.digital_presence_assessment?.score || 'Not rated'}/10
${research.digital_presence_assessment ? JSON.stringify(research.digital_presence_assessment, null, 2) : 'Not available'}

Sarah AI Fit Score: ${research.sarah_ai_fit_score || 'Not rated'}

RAW WEBSITE CONTENT (for context):
${research._raw_website_content || 'Not available'}

DESIGN REQUIREMENTS:
- Single complete HTML file with all CSS inline in a <style> block
- Fonts: Cormorant Garamond for headings (serif), DM Sans for body (sans-serif) via Google Fonts
- Use a CSS class prefix based on the business initials to namespace all classes
- All colors must use !important to ensure compatibility
- Color palette: dark navy primary (#0f1d2e), warm accent gold/bronze (#c8a96e), cream backgrounds (#faf8f5)
- No CSS variables, use direct color values with !important
- Clean, elegant, print-friendly layout
- Max width container around 900px, centered
- Mortem AI logo: https://storage.googleapis.com/msgsndr/KwHyQsuzPI6o5CiZfPfN/media/689ef6fa5dc21c2e15d6807f.png

DOCUMENT STRUCTURE (every section must have REAL content, not filler):

1. BRANDED HEADER
   - Mortem AI logo, document title, date, demo link if available

2. EXECUTIVE SUMMARY (3-4 sentences)
   - Who they are, what their current digital state is, why they are a good Sarah AI prospect, and the single most compelling angle for this meeting

3. CONTACT INTELLIGENCE
   - ${contact} (${role}) profile with everything found about them
   - Career path, likely motivations, communication style prediction
   - What keeps this person up at night? Be specific to their situation.
   - Relationship mapping: who else at the business might influence this decision?
   - Recommended approach angle for this specific person

4. COMPANY DEEP DIVE
   - Verified founding details, generation ownership
   - Community position and reputation (use actual review data)
   - Service portfolio analysis with specific services listed
   - Location details with actual addresses
   - Obituary/case volume estimates with methodology
   - Revenue estimate based on case volume and average service value

5. TECHNOLOGY AUDIT (this must be a detailed grid)
   - Create a table with columns: Category, Current State (Confirmed/Not Found), Gap Level (Critical/Moderate/Low), Sarah AI Solution
   - Categories: Website Platform, Mobile Responsiveness, SEO/Local Search, Google Business Profile, Online Booking, Live Chat/After-Hours, CRM/Lead Management, Email Marketing, Pre-Planning Digital Tools, Arrangement Software, Content Marketing, Social Media Management, Review Management, Analytics/Tracking
   - For each row, note what was ACTUALLY found vs what is missing
   - If GHL was detected, note specifically what they use it for and what they are NOT using it for
   - If Parting Pro or other arrangement software detected, note it

6. COMPETITIVE LANDSCAPE
   - Table of competitors with: Name, Distance, Google Rating, Reviews, Chat?, Booking?, AI?, Ownership Type
   - Use REAL competitor data from research
   - Identify which competitors are ahead digitally and which are behind
   - First-mover advantage analysis: is anyone in this market using AI yet?

7. GAP ANALYSIS TABLE
   - Columns: "What Families Need", "Current State at ${research.business_name}", "With Sarah AI", "Impact"
   - Rows must be specific to THIS funeral home based on the tech audit
   - At least 8 rows covering: after-hours response, pre-planning guidance, FAQ handling, appointment scheduling, grief resources, service information, pricing transparency, multilingual support

8. PRICING AND ROI
   - If GPL data was found, reference their actual pricing
   - Use their estimated case volume for calculations
   - Table: Conservative vs Moderate vs Optimistic scenarios
   - Columns: Monthly metric, Conservative, Moderate, Optimistic
   - Rows: After-hours inquiries captured, Conversion rate improvement, New cases/month, Avg service value, Monthly revenue impact, Sarah AI cost, Net monthly ROI
   - Show 12-month projection
   - Break-even analysis

9. TALK TRACKS (written as actual dialogue, not bullet points)

   OPENING (2-3 scripted options):
   - Option A: Lead with a specific observation about their business
   - Option B: Lead with a competitor insight
   - Option C: Lead with a family experience angle

   DISCOVERY QUESTIONS (as natural conversation flow):
   - "When a family calls at 2am on a Saturday, what happens right now?"
   - "How many calls or website visits do you think happen after hours that you never know about?"
   - "If I told you ${research.competitors?.[0]?.name || 'a competitor nearby'} is looking at AI tools, how would that change your timeline?"
   - Customize 3-4 more based on their specific gaps found in the audit

   OBJECTION HANDLING (scripted responses):
   - "We are traditional / our families expect a human touch" -- [specific response using their review data to show families already want digital options]
   - "We cannot afford this right now" -- [specific ROI response using their case volume]
   - "We already have a good website" -- [specific response referencing their actual tech gaps found]
   - "Our families are too old for AI" -- [response with demographic data about their market]
   - "We use GHL already" -- [response about how Sarah complements GHL, specific to what they use it for]
   - "This feels impersonal" -- [response using their own review themes about compassion]

   DEMO WALKTHROUGH SCRIPT:
   - Step-by-step script for walking through the live demo
   - What to show first, what questions to ask during the demo
   - How to connect each feature to their specific pain points

   CLOSING:
   - 2-3 closing approaches based on meeting dynamics
   - Specific next steps with timeline

10. PRE-MEETING CHECKLIST
    - Checkbox-styled list of 10-15 specific actions
    - Each item must be actionable and specific to this prospect
    - Include: review their latest Google reviews, check their social media this week, test their website on mobile, verify the demo works, prepare printed leave-behind, etc.

11. EMAIL SEQUENCE
    - Pre-meeting email (send 24 hours before)
    - Follow-up email template (send within 2 hours after meeting)
    - Second follow-up (send 3 days after if no response)
    - Each email must reference specific details about their business

12. APPENDIX: RAW RESEARCH NOTES
    - Summary of what was found and verified
    - Research gaps and what they mean
    - Confidence assessment
    - Recommendations for additional research before meeting

13. FOOTER
    - "Prepared by Mortem AI Sales Intelligence"
    - Mortem AI logo
    - Confidential notice
    - Contact: Tom Magee, Mortem AI
    - Date prepared

CRITICAL RULES:
- Never use em dashes anywhere (use commas, periods, colons, or "to" instead)
- Write like a senior strategist, not a template filler
- Every claim must be traceable to the research data
- If data was not found, say so explicitly and explain what that gap means
- The document must be at least 1200 lines of HTML
- Tables must have clean borders and alternating row colors
- Use checkmark and X icons (Unicode or SVG) in comparison tables
- Include a print stylesheet so this looks good when printed

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

  const prompt = `You are a senior sales strategist at Mortem AI. You previously generated a meeting prep document that has now been fact-checked with live internet research. Regenerate the COMPLETE document incorporating all verified facts, corrections, and new information discovered.

ORIGINAL CONTEXT:
- Business: ${research.business_name}
- Contact: ${contact} (${role})
- Phone: ${research.phone || 'Not found'}
- Address: ${research.address || ''}, ${research.city || ''}, ${research.state || ''}
- Services: ${(research.services || []).join(', ')}
- Website: ${research.website_url || ''}
${demoUrl ? '- Live Demo: ' + demoUrl : ''}

FACT-CHECK RESULTS (incorporate ALL of this new intelligence):
${factCheckSummary}

INSTRUCTIONS:
- Regenerate the COMPLETE meeting prep HTML document
- Replace incorrect claims with corrected information from fact-checking
- Add all new information discovered
- Update competitor analysis with real competitors found
- Update reviews data with current numbers
- Mark verified facts with a subtle green checkmark indicator
- Mark corrected items with a subtle indicator showing they were updated
- Keep the same design: Cormorant Garamond headings, DM Sans body, branded navy/gold colors
- Use CSS class prefix based on business initials
- All colors must use !important, no CSS variables
- Never use em dashes
- Document must be at least 1200 lines of HTML
- Include all sections from the original structure

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

  const ownerDetails = (research.owners_and_directors || []).map(p => `${p.name} (${p.role})`).join(', ') || research.owner_name || 'the team';
  const topGap = research.digital_presence_assessment?.critical_gaps?.[0] || 'after-hours response capability';
  const reviewInfo = research.google_reviews?.rating ? `${research.google_reviews.rating} stars from ${research.google_reviews.count} Google reviews` : '';
  const competitorMention = research.competitors?.[0]?.name || '';

  const prompt = `You are Tom Magee at Mortem AI, crafting hyper-personalized outreach messages for a funeral home prospect. These messages must demonstrate deep knowledge of their business. Generic messages get ignored. Specific, research-backed messages get meetings.

PROSPECT INTELLIGENCE:
- Business: ${research.business_name}
- Contact: ${research.owner_name || 'Owner'}
- People found: ${ownerDetails}
- Phone: ${research.phone}
- City/State: ${research.city || ''}, ${research.state || ''}
- Services: ${(research.services || []).join(', ')}
- Service Area: ${research.service_area || 'local area'}
- Demo URL: ${demoUrl}
- Google Reviews: ${reviewInfo || 'Not found'}
- Top Digital Gap: ${topGap}
- Main Competitor: ${competitorMention || 'local competitors'}
- Website Tech: ${(research.tech_stack || []).slice(0, 5).join(', ')}
- Has Chat: ${research.has_chat_widget || false}
- Has Booking: ${research.has_online_booking || false}
- Founded: ${research.founded || 'established'}
- Ownership: ${research.ownership_type || 'independent'}

OUTREACH RULES:
- Every message must reference at least 2 specific details about their business
- Never use em dashes
- Sound like a real person, not a template
- The demo URL is the hook, every message should drive to it
- Be respectful of the funeral industry, warm but professional
- Keep it brief, busy funeral directors do not read long emails
- Reference their specific digital gaps without being condescending

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
