import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';

function getClient(overrideKey) {
  const apiKey = overrideKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('No Anthropic API key configured. Set ANTHROPIC_API_KEY env var or provide via Settings.');
  return new Anthropic({ apiKey });
}

// -- Deep Research Utilities --

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
  } catch { return null; }
}

function extractTextFromHtml(html, maxLength = 10000) {
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
  checks.forEach(([regex, label]) => {
    if (regex.test(html)) signals.push(label);
  });
  if (/name=["']viewport["']/i.test(html)) signals.push('Mobile viewport configured');
  else signals.push('NO mobile viewport tag (not mobile-responsive)');
  if (/<link[^>]*rel=["']canonical["']/i.test(html)) signals.push('Canonical URL set');
  if (/https?:\/\//i.test(html) && /ssl|https/i.test(html)) signals.push('HTTPS enabled');
  return signals;
}

// Extract all internal links from HTML to discover more pages
function extractInternalLinks(html, baseUrl) {
  if (!html) return [];
  const links = new Set();
  const linkRegex = /href=["'](\/[^"'#?]*)/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const path = match[1].replace(/\/+$/, '') || '/';
    if (path.length < 100 && !path.match(/\.(jpg|jpeg|png|gif|svg|css|js|pdf|doc|ico|woff|ttf|mp4|mp3)$/i)) {
      links.add(path);
    }
  }
  return Array.from(links).slice(0, 50);
}

// Extract structured data like emails, phones, addresses from text
function extractContactInfo(text) {
  const info = {};
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) info.email = emailMatch[0];
  const phoneMatch = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) info.phone = phoneMatch[0];import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';

function getClient(overrideKey) {
  const apiKey = overrideKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('No Anthropic API key configured. Set ANTHROPIC_API_KEY env var or provide via Settings.');
  return new Anthropic({ apiKey });
}

// -- Deep Research Utilities --

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
  } catch { return null; }
}

function extractTextFromHtml(html, maxLength = 10000) {
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
  checks.forEach(([regex, label]) => {
    if (regex.test(html)) signals.push(label);
  });
  if (/name=["']viewport["']/i.test(html)) signals.push('Mobile viewport configured');
  else signals.push('NO mobile viewport tag (not mobile-responsive)');
  if (/<link[^>]*rel=["']canonical["']/i.test(html)) signals.push('Canonical URL set');
  if (/https?:\/\//i.test(html) && /ssl|https/i.test(html)) signals.push('HTTPS enabled');
  return signals;
}

// Extract all internal links from HTML to discover more pages
function extractInternalLinks(html, baseUrl) {
  if (!html) return [];
  const links = new Set();
  const linkRegex = /href=["'](\/[^"'#?]*)/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const path = match[1].replace(/\/+$/, '') || '/';
    if (path.length < 100 && !path.match(/\.(jpg|jpeg|png|gif|svg|css|js|pdf|doc|ico|woff|ttf|mp4|mp3)$/i)) {
      links.add(path);
    }
  }
  return Array.from(links).slice(0, 50);
}

// Extract structured data like emails, phones, addresses from text
function extractContactInfo(text) {
  const info = {};
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) info.email = emailMatch[0];
  const phoneMatch = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) info.phone = phoneMatch[0];
  return info;
}

// Extract social media links from HTML
function extractSocialLinks(html) {
  if (!html) return {};
  const social = {};
  const fbMatch = html.match(/href=["'](https?:\/\/(www\.)?facebook\.com\/[^"']+)/i);
  if (fbMatch) social.facebook = fbMatch[1];
  const igMatch = html.match(/href=["'](https?:\/\/(www\.)?instagram\.com\/[^"']+)/i);
  if (igMatch) social.instagram = igMatch[1];
  const liMatch = html.match(/href=["'](https?:\/\/(www\.)?linkedin\.com\/[^"']+)/i);
  if (liMatch) social.linkedin = liMatch[1];
  const ytMatch = html.match(/href=["'](https?:\/\/(www\.)?youtube\.com\/[^"']+)/i);
  if (ytMatch) social.youtube = ytMatch[1];
  const twMatch = html.match(/href=["'](https?:\/\/(www\.)?(twitter|x)\.com\/[^"']+)/i);
  if (twMatch) social.twitter = twMatch[1];
  return social;
}

async function perplexitySearch(apiKey, query, maxTokens = 1500) {
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: 'You are a thorough research assistant. Provide detailed, factual information based on real web sources. Include specific names, dates, addresses, phone numbers, ratings, and URLs where available. If you cannot find specific information, say "NOT FOUND" clearly rather than guessing or speculating. Never use words like "likely", "probably", "appears to be", or "estimated" unless directly quoting a source.' },
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

// -- Main Research Handler (SSE streaming with progress) --

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
    // STEP 1: Crawl the website deeply, page by page
    send('progress', { phase: 'crawl', message: 'Crawling website pages...' });

    const pagePaths = [
      '/', '/about', '/about-us', '/our-story', '/history', '/who-we-are',
      '/services', '/our-services', '/funeral-services', '/what-we-offer',
      '/cremation', '/cremation-services', '/direct-cremation',
      '/pre-planning', '/pre-plan', '/plan-ahead', '/advance-planning', '/preneed',
      '/contact', '/contact-us',
      '/staff', '/our-team', '/our-staff', '/meet-our-team', '/meet-the-team', '/our-people', '/team', '/leadership',
      '/locations', '/our-locations', '/facilities', '/chapel', '/chapels',
      '/obituaries', '/tributes', '/recent-obituaries', '/obituary',
      '/resources', '/grief-support', '/grief-resources', '/support',
      '/faq', '/frequently-asked-questions',
      '/testimonials', '/reviews',
      '/pricing', '/prices', '/price-list', '/general-price-list',
      '/packages', '/service-packages',
      '/veterans', '/veteran-services', '/military',
      '/merchandise', '/caskets', '/urns',
      '/careers', '/jobs', '/employment',
      '/blog', '/news', '/community',
      '/memorial', '/memorials', '/celebration-of-life',
      '/pet', '/pet-services', '/pet-cremation',
      '/shipping', '/transfer', '/international',
      '/aftercare', '/after-care',
      '/flowers', '/sympathy-flowers',
    ];

    const pageResults = await Promise.allSettled(
      pagePaths.map(path => fetchWebPage(`${baseUrl}${path}`, 6000))
    );

    const websiteContent = {};
    let homepageHtml = null;
    let allSocialLinks = {};

    pagePaths.forEach((path, i) => {
      const result = pageResults[i];
      if (result.status === 'fulfilled' && result.value) {
        websiteContent[path] = extractTextFromHtml(result.value, 10000);
        if (path === '/') homepageHtml = result.value;
        // Extract social links from every page
        const socials = extractSocialLinks(result.value);
        Object.assign(allSocialLinks, socials);
      }
    });

    const foundPages = Object.keys(websiteContent);
    send('progress', { phase: 'crawl', message: `Found ${foundPages.length} accessible pages: ${foundPages.join(', ')}` });

    // Discover additional pages from internal links on homepage
    if (homepageHtml) {
      const discoveredLinks = extractInternalLinks(homepageHtml, baseUrl);
      const newLinks = discoveredLinks.filter(link => !pagePaths.includes(link) && !websiteContent[link]);
      if (newLinks.length > 0) {
        send('progress', { phase: 'crawl', message: `Discovered ${newLinks.length} additional internal links. Crawling...` });
        const extraResults = await Promise.allSettled(
          newLinks.slice(0, 20).map(path => fetchWebPage(`${baseUrl}${path}`, 5000))
        );
        newLinks.slice(0, 20).forEach((path, i) => {
          const result = extraResults[i];
          if (result.status === 'fulfilled' && result.value) {
            websiteContent[path] = extractTextFromHtml(result.value, 8000);
            const socials = extractSocialLinks(result.value);
            Object.assign(allSocialLinks, socials);
          }
        });
        const totalPages = Object.keys(websiteContent);
        send('progress', { phase: 'crawl', message: `Total pages crawled: ${totalPages.length}` });
      }
    }

    // Extract tech stack from homepage source
    const techStack = homepageHtml ? extractTechStack(homepageHtml) : [];
    send('progress', { phase: 'crawl', message: `Tech stack: ${techStack.length > 0 ? techStack.join(', ') : 'Could not determine'}` });

    if (Object.keys(allSocialLinks).length > 0) {
      send('progress', { phase: 'crawl', message: `Social media found: ${Object.entries(allSocialLinks).map(([k,v]) => k + ': ' + v).join(', ')}` });
    }

    // Extract business name hint from homepage title
    let businessNameHint = '';
    if (homepageHtml) {
      const titleMatch = homepageHtml.match(/<title>(.*?)<\/title>/i);
      if (titleMatch) businessNameHint = titleMatch[1].replace(/\s*[|\-]\s*Home.*$/i, '').replace(/\s*[|\-]\s*Welcome.*$/i, '').trim();
    }
    if (!businessNameHint) {
      try {
        const hostname = new URL(url).hostname.replace('www.', '');
        businessNameHint = hostname.split('.')[0].replace(/-/g, ' ');
      } catch {}
    }

    // STEP 2: Run Perplexity web searches in parallel (7 searches for maximum coverage)
    send('progress', { phase: 'search', message: `Searching the web for "${businessNameHint}" -- business info, owners, reviews, competitors, pricing, news...` });

    let searchResults = { business: null, reviews: null, people: null, competitors: null, news: null, pricing: null, deeper: null };

    if (perplexityKey) {
      const searches = await Promise.allSettled([
        perplexitySearch(perplexityKey,
          `Tell me everything you can find about "${businessNameHint}" funeral home. Their website is ${url}. I need ONLY confirmed, verifiable facts. Specifically find: Who owns this funeral home? (full legal name) Who are the licensed funeral directors? (full names and license numbers if available) When was it founded? (exact year) Is it family-owned, independently owned, or corporate-owned? (which corporation if corporate) How many locations? Full street address and phone number for each location. What specific services do they offer? What is their history? Are they affiliated with SCI/Dignity Memorial, NorthStar, Foundation Partners, Park Lawn, or any other corporation? Provide specific names, dates, and cite your sources. If you cannot find a piece of information, say "NOT FOUND" for that item.`, 3000
        ),
        perplexitySearch(perplexityKey,
          `Find ALL reviews and ratings for "${businessNameHint}" funeral home (website: ${url}). Check these specific sources: 1) Google Business Profile (exact star rating and exact number of reviews), 2) Yelp (rating and review count), 3) BBB (rating, accreditation status, number of complaints), 4) Facebook page (rating and review count), 5) Funeral.com or other funeral directories. For each platform, provide the EXACT numbers. Quote or closely paraphrase 2-3 specific review themes (what people praise, what they complain about). Do not guess at numbers. If a platform has no listing, say "No listing found on [platform]".`, 2500
        ),
        perplexitySearch(perplexityKey,
          `Search for every person who works at or is associated with "${businessNameHint}" funeral home (${url}). For each person found, provide: Full name, exact job title, how you found them (LinkedIn, obituary signatures, state licensing board, news article, company website, etc.). Check: 1) Their website staff/team page, 2) LinkedIn profiles mentioning this funeral home, 3) State funeral director licensing board records, 4) Obituaries they have directed or signed, 5) News articles mentioning them, 6) NFDA or state association membership directories. List every person you can confirm is associated with this business. Do not infer or guess roles.`, 2500
        ),
        perplexitySearch(perplexityKey,
          `What funeral homes compete with "${businessNameHint}" (${url}) in the same geographic area? List the top 5-7 competitors with these CONFIRMED details for each: 1) Business name, 2) Website URL, 3) Google review rating and count (exact numbers), 4) Key services offered, 5) Whether they have online chat or booking on their website, 6) Whether they are independent or corporate-owned. Also describe the local market: What is the population of the city/area? What is the approximate number of funeral homes serving this area? Are there any market trends specific to this region?`, 2500
        ),
        perplexitySearch(perplexityKey,
          `Search for recent news, press coverage, community involvement, events, or social media activity related to "${businessNameHint}" funeral home (${url}). Check: 1) Local newspaper articles mentioning them, 2) Community events they sponsor or participate in, 3) Their Facebook page activity and engagement, 4) Any awards or recognitions, 5) Any recent acquisitions, ownership changes, or expansions, 6) Pre-planning seminars or grief support groups they run, 7) Any legal issues, lawsuits, or regulatory actions. Report only what you can actually find with sources.`, 2000
        ),
        perplexitySearch(perplexityKey,
          `Search for pricing information for "${businessNameHint}" funeral home (${url}). Check: 1) Their website for a General Price List (GPL), 2) State funeral board price filings, 3) FuneralPriceInfo.com or similar comparison sites, 4) Any price ranges mentioned in reviews or news articles, 5) Whether they offer package pricing or itemized pricing. What are their approximate prices for: traditional funeral with burial, cremation with service, direct cremation, graveside service? Report ONLY prices you can actually find documented somewhere. Say "NOT FOUND" for anything you cannot verify.`, 2000
        ),
        perplexitySearch(perplexityKey,
          `Do a deep background search on "${businessNameHint}" funeral home (${url}). Find: 1) Their Google Business Profile URL and all photos/details listed there, 2) Their exact year of establishment, 3) Property records or business registration records, 4) Any DBA names or previous business names, 5) Professional memberships (NFDA, state associations, Selected Independent Funeral Homes, etc.), 6) Whether they own their building or lease, 7) Cemetery affiliations, 8) Religious or cultural specializations, 9) Any green/eco-friendly burial options, 10) Pre-need trust or insurance affiliations. Only report confirmed findings.`, 2000
        ),
      ]);

      searchResults.business = searches[0]?.status === 'fulfilled' ? searches[0].value.content : null;
      searchResults.reviews = searches[1]?.status === 'fulfilled' ? searches[1].value.content : null;
      searchResults.people = searches[2]?.status === 'fulfilled' ? searches[2].value.content : null;
      searchResults.competitors = searches[3]?.status === 'fulfilled' ? searches[3].value.content : null;
      searchResults.news = searches[4]?.status === 'fulfilled' ? searches[4].value.content : null;
      searchResults.pricing = searches[5]?.status === 'fulfilled' ? searches[5].value.content : null;
      searchResults.deeper = searches[6]?.status === 'fulfilled' ? searches[6].value.content : null;

      const foundCount = Object.values(searchResults).filter(v => v).length;
      send('progress', { phase: 'search', message: `Web search complete. Got results from ${foundCount}/7 searches.` });
    } else {
      send('progress', { phase: 'search', message: 'No Perplexity API key available. Skipping web searches. Results will be limited to website crawl only.' });
    }

    // STEP 3: Compile everything with Claude
    send('progress', { phase: 'compile', message: 'Analyzing all research data and compiling profile...' });

    const allFoundPages = Object.keys(websiteContent);
    const websiteContentStr = Object.entries(websiteContent)
      .map(([path, text]) => `=== PAGE: ${baseUrl}${path} ===\n${text}`)
      .join('\n\n');

    const synthesisPrompt = `You are an expert funeral home researcher compiling a detailed prospect profile.

You have been given REAL data from actual website crawling and live web searches. Your job is to compile this into a comprehensive, accurate research profile.

CRITICAL RULES:
- ONLY include information that is ACTUALLY found in the sources below.
- Do NOT fabricate, guess, infer, or speculate. No "likely", "probably", "appears to be", "estimated", "suggests", "presumably".
- If something was not found, use "Not found" or omit it entirely.
- Every claim MUST trace back to a specific source below.
- If you are uncertain about something, mark it as "Unverified" and note why.
- Prefer specific data (exact numbers, exact names, exact dates) over vague descriptions.

=== WEBSITE CONTENT (crawled from ${url}) ===
Pages found: ${allFoundPages.join(', ')}

${websiteContentStr || 'WARNING: Could not access any pages on this website.'}

=== TECH STACK (detected from HTML source code) ===
${techStack.length > 0 ? techStack.join('\n') : 'Could not inspect source code'}

=== SOCIAL MEDIA LINKS (extracted from website HTML) ===
${Object.keys(allSocialLinks).length > 0 ? Object.entries(allSocialLinks).map(([k,v]) => `${k}: ${v}`).join('\n') : 'None found in HTML'}

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

=== WEB SEARCH: PRICING INFORMATION ===
${searchResults.pricing || 'No search results available'}

=== WEB SEARCH: DEEP BACKGROUND ===
${searchResults.deeper || 'No search results available'}

Based ONLY on the above real data, compile and return a JSON object. Return ONLY valid JSON (no markdown, no code blocks, no explanation before or after).

Use this structure:

{
  "business_name": "official name as found on website or search results",
  "owner_name": "actual owner name if found, or 'Not found'",
  "owners_and_directors": [
    {"name": "full name", "role": "their title/role as stated", "background": "what was actually found about them", "source": "where this was found (website page, Google, LinkedIn, state board, etc.)"}
  ],
  "phone": "phone number from website or listings",
  "email": "email if found on contact page or listings",
  "address": "full street address",
  "city": "city",
  "state": "state abbreviation",
  "founded": "exact year if found, otherwise 'Not found'",
  "ownership_type": "family-owned, corporate-owned (name of corporation), independent, etc. based on confirmed data",
  "corporate_parent": "name of parent corporation if applicable, or null",
  "generation": "first/second/third generation if explicitly mentioned, otherwise 'Not found'",
  "services": ["list", "of", "actual", "services", "found", "on", "their", "website"],
  "services_detail": {
    "Service Name": "description as found on their services page"
  },
  "pricing": {
    "source": "where pricing was found (website GPL, state filing, comparison site, etc.)",
    "traditional_funeral": "price or range if found, or 'Not found'",
    "cremation_with_service": "price or range if found, or 'Not found'",
    "direct_cremation": "price or range if found, or 'Not found'",
    "other": "any other pricing data found"
  },
  "locations": [
    {"name": "location name", "address": "full address", "phone": "phone if different", "area": "service area mentioned"}
  ],
  "unique_selling_points": "actual differentiators found on their site, in reviews, or search results",
  "service_area": "geographic area they serve as stated on their website",
  "tagline": "actual tagline or motto from their website, or 'Not found'",
  "website_url": "${url}",
  "website_pages_found": ${JSON.stringify(allFoundPages)},
  "tech_stack": ${JSON.stringify(techStack)},
  "has_online_booking": false,
  "has_chat_widget": false,
  "has_mobile_responsive": ${techStack.some(t => t.includes('Mobile viewport')) ? 'true' : 'false'},
  "has_structured_data": ${techStack.some(t => t.includes('Schema.org')) ? 'true' : 'false'},
  "has_analytics": ${techStack.some(t => t.includes('Google Analytics')) ? 'true' : 'false'},
  "google_reviews": {
    "rating": "exact rating or 'Not found'",
    "count": "exact number or 'Not found'",
    "themes": "actual themes from reviews"
  },
  "yelp_reviews": {
    "rating": "exact rating or 'Not found'",
    "count": "exact number or 'Not found'"
  },
  "bbb_rating": "exact rating and accreditation status if found, or 'Not found'",
  "facebook_reviews": {
    "rating": "exact rating or 'Not found'",
    "count": "exact number or 'Not found'",
    "url": "Facebook page URL if found"
  },
  "competitors": [
    {"name": "competitor name", "url": "website", "google_rating": "exact rating", "review_count": "exact count", "key_differences": "confirmed differences", "has_chat": false, "has_booking": false, "ownership": "independent or corporate-owned"}
  ],
  "community_involvement": ["actual activities, sponsorships, or memberships confirmed by sources"],
  "recent_news": ["actual news items or press mentions with dates"],
  "social_media": ${JSON.stringify(allSocialLinks)},
  "professional_memberships": ["NFDA, state associations, etc. if confirmed"],
  "specializations": ["religious, cultural, green burial, pet, veteran, etc. if confirmed"],
  "staff_count_estimate": "based on staff page listing or 'Not found'",
  "obituary_volume": "any indication of volume from obituaries page or 'Not found'",
  "market_demographics": "local area demographics from search results or 'Not found'",
  "digital_presence_assessment": {
    "score": "1-10",
    "strengths": ["what they do well digitally, confirmed"],
    "weaknesses": ["what is missing or poor, confirmed"],
    "opportunities": ["where Sarah AI would add value based on confirmed gaps"]
  },
  "research_sources": ["list every source that provided information"],
  "research_gaps": ["list what could NOT be found or verified"],
  "confidence_level": "high/medium/low based on how much real data was found"
}

Set has_online_booking and has_chat_widget to true/false based on what you actually found on their website pages or in the tech stack signals.

Be thorough. Return ONLY the JSON.`;

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

    // Attach raw search data for downstream use (increased limits)
    researchData._raw_searches = {
      business: searchResults.business ? searchResults.business.substring(0, 3000) : null,
      reviews: searchResults.reviews ? searchResults.reviews.substring(0, 3000) : null,
      people: searchResults.people ? searchResults.people.substring(0, 3000) : null,
      competitors: searchResults.competitors ? searchResults.competitors.substring(0, 3000) : null,
      news: searchResults.news ? searchResults.news.substring(0, 2000) : null,
      pricing: searchResults.pricing ? searchResults.pricing.substring(0, 2000) : null,
      deeper: searchResults.deeper ? searchResults.deeper.substring(0, 2000) : null,
    };

    send('progress', { phase: 'complete', message: `Research complete. Found ${researchData.owners_and_directors?.length || 0} people, ${researchData.competitors?.length || 0} competitors, ${allFoundPages.length} website pages.` });
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
    const createResponse = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST', headers, body: JSON.stringify({ name: siteName })
    });
    if (!createResponse.ok) {
      const errBody = await createResponse.text();
      throw new Error(`Failed to create site (${createResponse.status}): ${errBody}`);
    }
    const siteData = await createResponse.json();
    siteId = siteData.id;
  }

  const htmlBuffer = Buffer.from(html, 'utf-8');
  const sha1 = crypto.createHash('sha1').update(htmlBuffer).digest('hex');

  const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
    method: 'POST', headers, body: JSON.stringify({ files: { '/index.html': sha1 } })
  });
  if (!deployResponse.ok) {
    const errBody = await deployResponse.text();
    throw new Error(`Failed to create deploy (${deployResponse.status}): ${errBody}`);
  }
  const deployData = await deployResponse.json();
  const deployId = deployData.id;

  const uploadResponse = await fetch(`https://api.netlify.com/api/v1/deploys/${deployId}/files/index.html`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${netlifyToken}`, 'Content-Type': 'application/octet-stream' },
    body: htmlBuffer
  });
  if (!uploadResponse.ok) {
    const errBody = await uploadResponse.text();
    throw new Error(`Failed to upload file (${uploadResponse.status}): ${errBody}`);
  }

  await new Promise(resolve => setTimeout(resolve, 2000));
  return res.status(200).json({ url: `https://${siteName}.netlify.app`, site_id: siteId, deploy_id: deployId });
}

async function handleMeetingPrep(req, res) {
  const { research, demoUrl, contactName, contactRole } = req.body;
  if (!research || !research.business_name) return res.status(400).json({ error: 'Research data with business_name is required' });

  const client = getClient(req.headers['x-api-key-override']);
  const contact = contactName || research.owner_name || 'the owner';
  const role = contactRole || 'Owner/Director';

  // Build a comprehensive confirmed-data block from the research object
  const confirmedData = {
    business_name: research.business_name,
    contact: contact,
    role: role,
    phone: research.phone || 'Not found',
    email: research.email || 'Not found',
    address: research.address || 'Not found',
    city: research.city || '',
    state: research.state || '',
    founded: research.founded || 'Not found',
    ownership_type: research.ownership_type || 'Not found',
    corporate_parent: research.corporate_parent || null,
    generation: research.generation || 'Not found',
    services: research.services || [],
    services_detail: research.services_detail || {},
    pricing: research.pricing || {},
    locations: research.locations || [],
    service_area: research.service_area || 'Not found',
    unique_selling_points: research.unique_selling_points || 'Not found',
    tagline: research.tagline || 'Not found',
    website_url: research.website_url || '',
    owners_and_directors: research.owners_and_directors || [],
    google_reviews: research.google_reviews || {},
    yelp_reviews: research.yelp_reviews || {},
    bbb_rating: research.bbb_rating || 'Not found',
    facebook_reviews: research.facebook_reviews || {},
    competitors: research.competitors || [],
    community_involvement: research.community_involvement || [],
    recent_news: research.recent_news || [],
    social_media: research.social_media || {},
    professional_memberships: research.professional_memberships || [],
    specializations: research.specializations || [],
    tech_stack: research.tech_stack || [],
    has_online_booking: research.has_online_booking || false,
    has_chat_widget: research.has_chat_widget || false,
    has_mobile_responsive: research.has_mobile_responsive || false,
    has_structured_data: research.has_structured_data || false,
    has_analytics: research.has_analytics || false,
    digital_presence_assessment: research.digital_presence_assessment || {},
    website_pages_found: research.website_pages_found || [],
    staff_count_estimate: research.staff_count_estimate || 'Not found',
    obituary_volume: research.obituary_volume || 'Not found',
    market_demographics: research.market_demographics || 'Not found',
    research_gaps: research.research_gaps || [],
    confidence_level: research.confidence_level || 'unknown',
  };

  // Include raw search data if available for maximum context
  const rawSearches = research._raw_searches || {};

  const prompt = `You are an expert sales strategist and HTML designer at Mortem AI. Create a comprehensive, beautifully designed meeting prep document as a single HTML file.

This document is for Tom at Mortem AI to prepare for a sales meeting with a funeral home prospect.

ABSOLUTE RULES (VIOLATIONS WILL MAKE THIS DOCUMENT USELESS):
1. NEVER use the words "likely", "probably", "appears to be", "estimated", "suggests", "presumably", "it seems", "we can assume", "reasonable to infer", "it is possible", "may have", "could be", "might be"
2. NEVER infer, guess, or speculate about ANYTHING not in the confirmed data below
3. If a data point says "Not found", write "Not found in research" in the document. Do NOT fill in a guess.
4. Every fact in this document MUST come from the CONFIRMED DATA section below
5. Never use em dashes anywhere in the document (use commas, periods, or "to" instead)
6. When data is missing, create a clear "RESEARCH GAP" callout box so Tom knows to investigate manually
7. For the ROI section, use industry averages and label them as "industry average" not as facts about this specific business

CONFIRMED DATA FROM RESEARCH:
${JSON.stringify(confirmedData, null, 2)}

RAW SEARCH RESULTS (use for additional confirmed details only):
${JSON.stringify(rawSearches, null, 2)}

DESIGN REQUIREMENTS:
- Single complete HTML file with all CSS inline in a <style> block
- Fonts: Cormorant Garamond for headings (serif), DM Sans for body (sans-serif) via Google Fonts
- Use a CSS class prefix based on the business initials to namespace all classes
- All colors must use !important to ensure compatibility
- Color palette: dark navy primary (#0f1d2e), warm accent gold/bronze (#c8a96e), cream backgrounds (#faf8f5)
- No CSS variables, use direct color values with !important
- Clean, elegant, print-friendly layout
- Max width container around 900px, centered
- Subtle borders and dividers between sections
- Research gap callout boxes should have a yellow/amber left border and light amber background
- Confirmed data should feel confident and specific
- Missing data should be clearly flagged, never filled with guesses

DOCUMENT STRUCTURE:

1. BRANDED HEADER
   - Mortem AI logo on the left: https://storage.googleapis.com/msgsndr/KwHyQsuzPI6o5CiZfPfN/media/689ef6fa5dc21c2e15d6807f.png
   - Document title: "Meeting Preparation: ${research.business_name}"
   - Date and subtitle
   - Research confidence level: ${confirmedData.confidence_level}
   - If a demo URL exists, include a prominent link: ${demoUrl || 'No demo URL'}

2. CONTACT PROFILE
   - Name: ${contact}
   - Role: ${role}
   - ONLY include background information that was actually found in the research data (LinkedIn, news, state board records, etc.)
   - If no background was found, display a RESEARCH GAP box saying "No personal background found. Check LinkedIn and state licensing board before the meeting."
   - List the specific people found in owners_and_directors with their confirmed roles and sources

3. COMPANY OVERVIEW
   - Business name, address, phone, email: from confirmed data
   - Founded: use the confirmed data value (if "Not found", show research gap)
   - Ownership type: from confirmed data
   - All locations with confirmed addresses
   - Services offered with details from the website crawl
   - Tagline from their website
   - Service area as stated on their site

4. CURRENT DIGITAL STATE AUDIT
   - Website pages that were actually crawled (list them)
   - Tech stack detected from HTML source code
   - Mobile responsive: confirmed yes/no from tech stack
   - Structured data: confirmed yes/no
   - Analytics: confirmed yes/no
   - Online booking: confirmed yes/no
   - Chat widget: confirmed yes/no
   - Social media presence: list confirmed profiles with URLs
   - Digital presence score from research

5. REVIEWS AND REPUTATION
   - Google Reviews: exact confirmed rating and count
   - Yelp: exact confirmed rating and count
   - BBB: confirmed rating
   - Facebook: confirmed rating and count
   - Review themes from confirmed data
   - For any platform where data is "Not found", show a research gap box

6. GAP ANALYSIS TABLE
   - Columns: "What Families Need", "Current State" (confirmed), "With Sarah AI"
   - Current State column must ONLY reference confirmed facts (has/doesn't have chat, has/doesn't have booking, etc.)
   - Use the actual tech stack data and digital assessment

7. COMPETITIVE LANDSCAPE
   - ONLY list competitors that were actually found in the research
   - For each competitor, show only confirmed data (name, URL, Google rating, review count, ownership)
   - If few competitors were found, show a research gap box

8. ROI PROJECTION
   - Use industry average funeral service value ($7,000 to $12,000, use $9,500 as midpoint)
   - Label all averages as "industry average"
   - Base calculations on confirmed data where possible (review count indicates business volume, etc.)
   - Monthly ROI table with conservative and optimistic scenarios
   - Include break-even analysis
   - Sarah AI cost: $297/month

9. TALK TRACKS
   OPENING:
   - Reference ONLY confirmed facts about their business (their actual tagline, their actual Google rating, their actual years in business)
   - If key facts are missing, provide a generic professional opener with a note to personalize after filling research gaps

   DISCOVERY QUESTIONS:
   - Written as natural dialogue
   - Tailored to their confirmed situation (if they lack chat, ask about after-hours inquiries; if reviews mention wait times, reference that)

   OBJECTION RESPONSES:
   - "We are traditional and our families want to speak with a real person"
   - "Your system is too expensive"
   - "We already have a website and a phone number"
   - "Our families are older and won't use AI"
   - "We don't have the technical capacity"

   CLOSING:
   - Reference the live demo if available
   - Clear next steps

10. PRE-MEETING ACTION ITEMS
    - Checklist format with checkbox styling
    - Include items to fill any RESEARCH GAPS identified in the document
    - Review their Google reviews
    - Check their social media
    - Test their website on mobile
    - Search for the contact on LinkedIn
    - Prepare demo walkthrough

11. EMAIL DRAFT
    - Ready-to-send intro email
    - Reference ONLY confirmed specifics from the research
    - Professional tone
    - Clear call to action for scheduling a demo

12. FOOTER
    - "Prepared by Mortem AI" with logo
    - Confidential notice
    - Contact: Tom Magee, Mortem AI
    - Date prepared

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
        { role: 'system', content: 'You are a fact-checker and research assistant. Your job is to verify claims made in a sales meeting prep document about a funeral home. Use your internet access to check facts, find additional information, and flag any inaccuracies. Be thorough but constructive. Never speculate. Only report what you can confirm with sources.' },
        { role: 'user', content: `Please fact-check and enhance this meeting prep document for ${research?.business_name || 'a funeral home'}.

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
  "corrections": [{"claim": "what was said", "reality": "what is actually true", "source": "where you found this"}],
  "new_information": [{"topic": "what this is about", "detail": "the new info", "source": "where you found this"}],
  "missing_competitors": [{"name": "competitor name", "url": "website if found", "notes": "what they offer"}],
  "owner_info": {"details": "any info found about the owner/contact", "source": "where found"},
  "market_data": {"details": "local market info, demographics, etc.", "source": "where found"},
  "overall_accuracy": "high/medium/low",
  "summary": "Brief overall assessment"
}

Return ONLY valid JSON.` }
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

  const prompt = `You are an expert sales strategist and HTML designer at Mortem AI. You previously generated a meeting prep document, and it has now been fact-checked with live internet research.

Your job is to regenerate the document incorporating all verified facts, corrections, and new information from the fact-check.

ABSOLUTE RULES:
1. NEVER use "likely", "probably", "appears to be", "estimated", "suggests", "presumably", "we can assume"
2. NEVER infer or guess. Only use confirmed data from the research and fact-check results
3. If something is still unknown after fact-checking, mark it as a RESEARCH GAP
4. Never use em dashes
5. Every claim must trace to either the original research or the fact-check findings

ORIGINAL RESEARCH DATA:
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
- Keep the same design (Cormorant Garamond headings, DM Sans body, branded colors)
- Use CSS class prefix based on business initials
- All colors must use !important, no CSS variables
- Mark fact-checked and verified claims with a subtle green checkmark or similar visual indicator
- Any remaining unknowns should show as RESEARCH GAP callout boxes
- The document should be comprehensive

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

RULES:
- Only reference confirmed facts from the data above
- Never use em dashes
- Do not guess or speculate about anything not in the data

Generate personalized outreach messages in this exact JSON format (and ONLY this JSON, no markdown):

{
  "email": {
  return info;
}

// Extract social media links from HTML
function extractSocialLinks(html) {
  if (!html) return {};
  const social = {};
  const fbMatch = html.match(/href=["'](https?:\/\/(www\.)?facebook\.com\/[^"']+)/i);
  if (fbMatch) social.facebook = fbMatch[1];
  const igMatch = html.match(/href=["'](https?:\/\/(www\.)?instagram\.com\/[^"']+)/i);
  if (igMatch) social.instagram = igMatch[1];
  const liMatch = html.match(/href=["'](https?:\/\/(www\.)?linkedin\.com\/[^"']+)/i);
  if (liMatch) social.linkedin = liMatch[1];
  const ytMatch = html.match(/href=["'](https?:\/\/(www\.)?youtube\.com\/[^"']+)/i);
  if (ytMatch) social.youtube = ytMatch[1];
  const twMatch = html.match(/href=["'](https?:\/\/(www\.)?(twitter|x)\.com\/[^"']+)/i);
  if (twMatch) social.twitter = twMatch[1];
  return social;
}

async function perplexitySearch(apiKey, query, maxTokens = 1500) {
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: 'You are a thorough research assistant. Provide detailed, factual information based on real web sources. Include specific names, dates, addresses, phone numbers, ratings, and URLs where available. If you cannot find specific information, say "NOT FOUND" clearly rather than guessing or speculating. Never use words like "likely", "probably", "appears to be", or "estimated" unless directly quoting a source.' },
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

// -- Main Research Handler (SSE streaming with progress) --

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
    // STEP 1: Crawl the website deeply, page by page
    send('progress', { phase: 'crawl', message: 'Crawling website pages...' });

    const pagePaths = [
      '/', '/about', '/about-us', '/our-story', '/history', '/who-we-are',
      '/services', '/our-services', '/funeral-services', '/what-we-offer',
      '/cremation', '/cremation-services', '/direct-cremation',
      '/pre-planning', '/pre-plan', '/plan-ahead', '/advance-planning', '/preneed',
      '/contact', '/contact-us',
      '/staff', '/our-team', '/our-staff', '/meet-our-team', '/meet-the-team', '/our-people', '/team', '/leadership',
      '/locations', '/our-locations', '/facilities', '/chapel', '/chapels',
      '/obituaries', '/tributes', '/recent-obituaries', '/obituary',
      '/resources', '/grief-support', '/grief-resources', '/support',
      '/faq', '/frequently-asked-questions',
      '/testimonials', '/reviews',
      '/pricing', '/prices', '/price-list', '/general-price-list',
      '/packages', '/service-packages',
      '/veterans', '/veteran-services', '/military',
      '/merchandise', '/caskets', '/urns',
      '/careers', '/jobs', '/employment',
      '/blog', '/news', '/community',
      '/memorial', '/memorials', '/celebration-of-life',
      '/pet', '/pet-services', '/pet-cremation',
      '/shipping', '/transfer', '/international',
      '/aftercare', '/after-care',
      '/flowers', '/sympathy-flowers',
    ];

    const pageResults = await Promise.allSettled(
      pagePaths.map(path => fetchWebPage(`${baseUrl}${path}`, 6000))
    );

    const websiteContent = {};
    let homepageHtml = null;
    let allSocialLinks = {};

    pagePaths.forEach((path, i) => {
      const result = pageResults[i];
      if (result.status === 'fulfilled' && result.value) {
        websiteContent[path] = extractTextFromHtml(result.value, 10000);
        if (path === '/') homepageHtml = result.value;
        // Extract social links from every page
        const socials = extractSocialLinks(result.value);
        Object.assign(allSocialLinks, socials);
      }
    });

    const foundPages = Object.keys(websiteContent);
    send('progress', { phase: 'crawl', message: `Found ${foundPages.length} accessible pages: ${foundPages.join(', ')}` });

    // Discover additional pages from internal links on homepage
    if (homepageHtml) {
      const discoveredLinks = extractInternalLinks(homepageHtml, baseUrl);
      const newLinks = discoveredLinks.filter(link => !pagePaths.includes(link) && !websiteContent[link]);
      if (newLinks.length > 0) {
        send('progress', { phase: 'crawl', message: `Discovered ${newLinks.length} additional internal links. Crawling...` });
        const extraResults = await Promise.allSettled(
          newLinks.slice(0, 20).map(path => fetchWebPage(`${baseUrl}${path}`, 5000))
        );
        newLinks.slice(0, 20).forEach((path, i) => {
          const result = extraResults[i];
          if (result.status === 'fulfilled' && result.value) {
            websiteContent[path] = extractTextFromHtml(result.value, 8000);
            const socials = extractSocialLinks(result.value);
            Object.assign(allSocialLinks, socials);
          }
        });
        const totalPages = Object.keys(websiteContent);
        send('progress', { phase: 'crawl', message: `Total pages crawled: ${totalPages.length}` });
      }
    }

    // Extract tech stack from homepage source
    const techStack = homepageHtml ? extractTechStack(homepageHtml) : [];
    send('progress', { phase: 'crawl', message: `Tech stack: ${techStack.length > 0 ? techStack.join(', ') : 'Could not determine'}` });

    if (Object.keys(allSocialLinks).length > 0) {
      send('progress', { phase: 'crawl', message: `Social media found: ${Object.entries(allSocialLinks).map(([k,v]) => k + ': ' + v).join(', ')}` });
    }

    // Extract business name hint from homepage title
    let businessNameHint = '';
    if (homepageHtml) {
      const titleMatch = homepageHtml.match(/<title>(.*?)<\/title>/i);
      if (titleMatch) businessNameHint = titleMatch[1].replace(/\s*[|\-]\s*Home.*$/i, '').replace(/\s*[|\-]\s*Welcome.*$/i, '').trim();
    }
    if (!businessNameHint) {
      try {
        const hostname = new URL(url).hostname.replace('www.', '');
        businessNameHint = hostname.split('.')[0].replace(/-/g, ' ');
      } catch {}
    }

    // STEP 2: Run Perplexity web searches in parallel (7 searches for maximum coverage)
    send('progress', { phase: 'search', message: `Searching the web for "${businessNameHint}" -- business info, owners, reviews, competitors, pricing, news...` });

    let searchResults = { business: null, reviews: null, people: null, competitors: null, news: null, pricing: null, deeper: null };

    if (perplexityKey) {
      const searches = await Promise.allSettled([
        perplexitySearch(perplexityKey,
          `Tell me everything you can find about "${businessNameHint}" funeral home. Their website is ${url}. I need ONLY confirmed, verifiable facts. Specifically find: Who owns this funeral home? (full legal name) Who are the licensed funeral directors? (full names and license numbers if available) When was it founded? (exact year) Is it family-owned, independently owned, or corporate-owned? (which corporation if corporate) How many locations? Full street address and phone number for each location. What specific services do they offer? What is their history? Are they affiliated with SCI/Dignity Memorial, NorthStar, Foundation Partners, Park Lawn, or any other corporation? Provide specific names, dates, and cite your sources. If you cannot find a piece of information, say "NOT FOUND" for that item.`, 3000
        ),
        perplexitySearch(perplexityKey,
          `Find ALL reviews and ratings for "${businessNameHint}" funeral home (website: ${url}). Check these specific sources: 1) Google Business Profile (exact star rating and exact number of reviews), 2) Yelp (rating and review count), 3) BBB (rating, accreditation status, number of complaints), 4) Facebook page (rating and review count), 5) Funeral.com or other funeral directories. For each platform, provide the EXACT numbers. Quote or closely paraphrase 2-3 specific review themes (what people praise, what they complain about). Do not guess at numbers. If a platform has no listing, say "No listing found on [platform]".`, 2500
        ),
        perplexitySearch(perplexityKey,
          `Search for every person who works at or is associated with "${businessNameHint}" funeral home (${url}). For each person found, provide: Full name, exact job title, how you found them (LinkedIn, obituary signatures, state licensing board, news article, company website, etc.). Check: 1) Their website staff/team page, 2) LinkedIn profiles mentioning this funeral home, 3) State funeral director licensing board records, 4) Obituaries they have directed or signed, 5) News articles mentioning them, 6) NFDA or state association membership directories. List every person you can confirm is associated with this business. Do not infer or guess roles.`, 2500
        ),
        perplexitySearch(perplexityKey,
          `What funeral homes compete with "${businessNameHint}" (${url}) in the same geographic area? List the top 5-7 competitors with these CONFIRMED details for each: 1) Business name, 2) Website URL, 3) Google review rating and count (exact numbers), 4) Key services offered, 5) Whether they have online chat or booking on their website, 6) Whether they are independent or corporate-owned. Also describe the local market: What is the population of the city/area? What is the approximate number of funeral homes serving this area? Are there any market trends specific to this region?`, 2500
        ),
        perplexitySearch(perplexityKey,
          `Search for recent news, press coverage, community involvement, events, or social media activity related to "${businessNameHint}" funeral home (${url}). Check: 1) Local newspaper articles mentioning them, 2) Community events they sponsor or participate in, 3) Their Facebook page activity and engagement, 4) Any awards or recognitions, 5) Any recent acquisitions, ownership changes, or expansions, 6) Pre-planning seminars or grief support groups they run, 7) Any legal issues, lawsuits, or regulatory actions. Report only what you can actually find with sources.`, 2000
        ),
        perplexitySearch(perplexityKey,
          `Search for pricing information for "${businessNameHint}" funeral home (${url}). Check: 1) Their website for a General Price List (GPL), 2) State funeral board price filings, 3) FuneralPriceInfo.com or similar comparison sites, 4) Any price ranges mentioned in reviews or news articles, 5) Whether they offer package pricing or itemized pricing. What are their approximate prices for: traditional funeral with burial, cremation with service, direct cremation, graveside service? Report ONLY prices you can actually find documented somewhere. Say "NOT FOUND" for anything you cannot verify.`, 2000
        ),
        perplexitySearch(perplexityKey,
          `Do a deep background search on "${businessNameHint}" funeral home (${url}). Find: 1) Their Google Business Profile URL and all photos/details listed there, 2) Their exact year of establishment, 3) Property records or business registration records, 4) Any DBA names or previous business names, 5) Professional memberships (NFDA, state associations, Selected Independent Funeral Homes, etc.), 6) Whether they own their building or lease, 7) Cemetery affiliations, 8) Religious or cultural specializations, 9) Any green/eco-friendly burial options, 10) Pre-need trust or insurance affiliations. Only report confirmed findings.`, 2000
        ),
      ]);

      searchResults.business = searches[0]?.status === 'fulfilled' ? searches[0].value.content : null;
      searchResults.reviews = searches[1]?.status === 'fulfilled' ? searches[1].value.content : null;
      searchResults.people = searches[2]?.status === 'fulfilled' ? searches[2].value.content : null;
      searchResults.competitors = searches[3]?.status === 'fulfilled' ? searches[3].value.content : null;
      searchResults.news = searches[4]?.status === 'fulfilled' ? searches[4].value.content : null;
      searchResults.pricing = searches[5]?.status === 'fulfilled' ? searches[5].value.content : null;
      searchResults.deeper = searches[6]?.status === 'fulfilled' ? searches[6].value.content : null;

      const foundCount = Object.values(searchResults).filter(v => v).length;
      send('progress', { phase: 'search', message: `Web search complete. Got results from ${foundCount}/7 searches.` });
    } else {
      send('progress', { phase: 'search', message: 'No Perplexity API key available. Skipping web searches. Results will be limited to website crawl only.' });
    }

    // STEP 3: Compile everything with Claude
    send('progress', { phase: 'compile', message: 'Analyzing all research data and compiling profile...' });

    const allFoundPages = Object.keys(websiteContent);
    const websiteContentStr = Object.entries(websiteContent)
      .map(([path, text]) => `=== PAGE: ${baseUrl}${path} ===\n${text}`)
      .join('\n\n');

    const synthesisPrompt = `You are an expert funeral home researcher compiling a detailed prospect profile.

You have been given REAL data from actual website crawling and live web searches. Your job is to compile this into a comprehensive, accurate research profile.

CRITICAL RULES:
- ONLY include information that is ACTUALLY found in the sources below.
- Do NOT fabricate, guess, infer, or speculate. No "likely", "probably", "appears to be", "estimated", "suggests", "presumably".
- If something was not found, use "Not found" or omit it entirely.
- Every claim MUST trace back to a specific source below.
- If you are uncertain about something, mark it as "Unverified" and note why.
- Prefer specific data (exact numbers, exact names, exact dates) over vague descriptions.

=== WEBSITE CONTENT (crawled from ${url}) ===
Pages found: ${allFoundPages.join(', ')}

${websiteContentStr || 'WARNING: Could not access any pages on this website.'}

=== TECH STACK (detected from HTML source code) ===
${techStack.length > 0 ? techStack.join('\n') : 'Could not inspect source code'}

=== SOCIAL MEDIA LINKS (extracted from website HTML) ===
${Object.keys(allSocialLinks).length > 0 ? Object.entries(allSocialLinks).map(([k,v]) => `${k}: ${v}`).join('\n') : 'None found in HTML'}

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

=== WEB SEARCH: PRICING INFORMATION ===
${searchResults.pricing || 'No search results available'}

=== WEB SEARCH: DEEP BACKGROUND ===
${searchResults.deeper || 'No search results available'}

Based ONLY on the above real data, compile and return a JSON object. Return ONLY valid JSON (no markdown, no code blocks, no explanation before or after).

Use this structure:

{
  "business_name": "official name as found on website or search results",
  "owner_name": "actual owner name if found, or 'Not found'",
  "owners_and_directors": [
    {"name": "full name", "role": "their title/role as stated", "background": "what was actually found about them", "source": "where this was found (website page, Google, LinkedIn, state board, etc.)"}
  ],
  "phone": "phone number from website or listings",
  "email": "email if found on contact page or listings",
  "address": "full street address",
  "city": "city",
  "state": "state abbreviation",
  "founded": "exact year if found, otherwise 'Not found'",
  "ownership_type": "family-owned, corporate-owned (name of corporation), independent, etc. based on confirmed data",
  "corporate_parent": "name of parent corporation if applicable, or null",
  "generation": "first/second/third generation if explicitly mentioned, otherwise 'Not found'",
  "services": ["list", "of", "actual", "services", "found", "on", "their", "website"],
  "services_detail": {
    "Service Name": "description as found on their services page"
  },
  "pricing": {
    "source": "where pricing was found (website GPL, state filing, comparison site, etc.)",
    "traditional_funeral": "price or range if found, or 'Not found'",
    "cremation_with_service": "price or range if found, or 'Not found'",
    "direct_cremation": "price or range if found, or 'Not found'",
    "other": "any other pricing data found"
  },
  "locations": [
    {"name": "location name", "address": "full address", "phone": "phone if different", "area": "service area mentioned"}
  ],
  "unique_selling_points": "actual differentiators found on their site, in reviews, or search results",
  "service_area": "geographic area they serve as stated on their website",
  "tagline": "actual tagline or motto from their website, or 'Not found'",
  "website_url": "${url}",
  "website_pages_found": ${JSON.stringify(allFoundPages)},
  "tech_stack": ${JSON.stringify(techStack)},
  "has_online_booking": false,
  "has_chat_widget": false,
  "has_mobile_responsive": ${techStack.some(t => t.includes('Mobile viewport')) ? 'true' : 'false'},
  "has_structured_data": ${techStack.some(t => t.includes('Schema.org')) ? 'true' : 'false'},
  "has_analytics": ${techStack.some(t => t.includes('Google Analytics')) ? 'true' : 'false'},
  "google_reviews": {
    "rating": "exact rating or 'Not found'",
    "count": "exact number or 'Not found'",
    "themes": "actual themes from reviews"
  },
  "yelp_reviews": {
    "rating": "exact rating or 'Not found'",
    "count": "exact number or 'Not found'"
  },
  "bbb_rating": "exact rating and accreditation status if found, or 'Not found'",
  "facebook_reviews": {
    "rating": "exact rating or 'Not found'",
    "count": "exact number or 'Not found'",
    "url": "Facebook page URL if found"
  },
  "competitors": [
    {"name": "competitor name", "url": "website", "google_rating": "exact rating", "review_count": "exact count", "key_differences": "confirmed differences", "has_chat": false, "has_booking": false, "ownership": "independent or corporate-owned"}
  ],
  "community_involvement": ["actual activities, sponsorships, or memberships confirmed by sources"],
  "recent_news": ["actual news items or press mentions with dates"],
  "social_media": ${JSON.stringify(allSocialLinks)},
  "professional_memberships": ["NFDA, state associations, etc. if confirmed"],
  "specializations": ["religious, cultural, green burial, pet, veteran, etc. if confirmed"],
  "staff_count_estimate": "based on staff page listing or 'Not found'",
  "obituary_volume": "any indication of volume from obituaries page or 'Not found'",
  "market_demographics": "local area demographics from search results or 'Not found'",
  "digital_presence_assessment": {
    "score": "1-10",
    "strengths": ["what they do well digitally, confirmed"],
    "weaknesses": ["what is missing or poor, confirmed"],
    "opportunities": ["where Sarah AI would add value based on confirmed gaps"]
  },
  "research_sources": ["list every source that provided information"],
  "research_gaps": ["list what could NOT be found or verified"],
  "confidence_level": "high/medium/low based on how much real data was found"
}

Set has_online_booking and has_chat_widget to true/false based on what you actually found on their website pages or in the tech stack signals.

Be thorough. Return ONLY the JSON.`;

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

    // Attach raw search data for downstream use (increased limits)
    researchData._raw_searches = {
      business: searchResults.business ? searchResults.business.substring(0, 3000) : null,
      reviews: searchResults.reviews ? searchResults.reviews.substring(0, 3000) : null,
      people: searchResults.people ? searchResults.people.substring(0, 3000) : null,
      competitors: searchResults.competitors ? searchResults.competitors.substring(0, 3000) : null,
      news: searchResults.news ? searchResults.news.substring(0, 2000) : null,
      pricing: searchResults.pricing ? searchResults.pricing.substring(0, 2000) : null,
      deeper: searchResults.deeper ? searchResults.deeper.substring(0, 2000) : null,
    };

    send('progress', { phase: 'complete', message: `Research complete. Found ${researchData.owners_and_directors?.length || 0} people, ${researchData.competitors?.length || 0} competitors, ${allFoundPages.length} website pages.` });
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
