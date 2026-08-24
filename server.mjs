import express from 'express'
import { XMLParser } from 'fast-xml-parser'
import { load } from 'cheerio'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const port = Number(process.env.PORT || 8787)
const root = path.dirname(fileURLToPath(import.meta.url))
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true, trimValues: true })

const articleFeeds = [
  { name: 'BBC News', category: 'World', url: 'https://feeds.bbci.co.uk/news/rss.xml', homepage: 'https://www.bbc.com/news' },
  { name: 'BBC Technology', category: 'Tech', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', homepage: 'https://www.bbc.com/news/technology' },
  { name: 'BBC Culture', category: 'Culture', url: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', homepage: 'https://www.bbc.com/culture' },
  { name: 'TechCrunch', category: 'Tech', url: 'https://techcrunch.com/feed/', homepage: 'https://techcrunch.com' },
  { name: 'IGN', category: 'Gaming', url: 'https://feeds.feedburner.com/ign/all', homepage: 'https://www.ign.com' },
  { name: 'Smithsonian Magazine', category: 'History', url: 'https://www.smithsonianmag.com/rss/smart-news/', homepage: 'https://www.smithsonianmag.com' },
]

const regionalArticleFeeds = {
  AU: [
    { name: '7NEWS', category: 'Local', url: 'https://7news.com.au/news/rss', homepage: 'https://7news.com.au/news', regional: true },
    { name: 'SBS News', category: 'Local', url: 'https://www.sbs.com.au/news/topic/australia/feed', homepage: 'https://www.sbs.com.au/news/topic/australia', regional: true },
    { name: 'Guardian Australia', category: 'Local', url: 'https://www.theguardian.com/australia-news/rss', homepage: 'https://www.theguardian.com/au', regional: true },
    { name: 'The Conversation', category: 'Local', url: 'https://theconversation.com/au/articles.atom', homepage: 'https://theconversation.com/au', regional: true },
  ],
  NZ: [
    { name: 'RNZ', category: 'Local', url: 'https://www.rnz.co.nz/rss/national.xml', homepage: 'https://www.rnz.co.nz/news/national', regional: true },
  ],
  US: [
    { name: 'NPR', category: 'Local', url: 'https://feeds.npr.org/1001/rss.xml', homepage: 'https://www.npr.org', regional: true },
  ],
  CA: [
    { name: 'CBC News', category: 'Local', url: 'https://www.cbc.ca/cmlink/rss-topstories', homepage: 'https://www.cbc.ca/news', regional: true },
    { name: 'Global News Canada', category: 'Local', url: 'https://globalnews.ca/canada/feed/', homepage: 'https://globalnews.ca/canada/', regional: true },
  ],
  GB: [
    { name: 'BBC UK', category: 'Local', url: 'https://feeds.bbci.co.uk/news/uk/rss.xml', homepage: 'https://www.bbc.com/news/uk', regional: true },
    { name: 'Guardian UK', category: 'Local', url: 'https://www.theguardian.com/uk-news/rss', homepage: 'https://www.theguardian.com/uk-news', regional: true },
  ],
  IE: [
    { name: 'RTÉ News', category: 'Local', url: 'https://www.rte.ie/feeds/rss/?index=/news/', homepage: 'https://www.rte.ie/news/', regional: true },
  ],
  IN: [
    { name: 'NDTV', category: 'Local', url: 'https://feeds.feedburner.com/ndtvnews-top-stories', homepage: 'https://www.ndtv.com', regional: true },
  ],
  PK: [
    { name: 'Dawn', category: 'Local', url: 'https://www.dawn.com/feeds/home', homepage: 'https://www.dawn.com', regional: true },
  ],
  SG: [
    { name: 'CNA', category: 'Local', url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml', homepage: 'https://www.channelnewsasia.com', regional: true },
  ],
}

const editionNames = {
  AU: 'Australia', NZ: 'New Zealand', US: 'United States', CA: 'Canada', GB: 'United Kingdom',
  IE: 'Ireland', IN: 'India', PK: 'Pakistan', SG: 'Singapore', GLOBAL: 'Global',
}

const videoFeeds = [
  { name: 'BBC News', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC16niRr50-MSBwiO3YDb3RA', homepage: 'https://www.youtube.com/@BBCNews' },
  { name: 'IGN', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCKy1dAqELo0zrOtPkf0eTMw', homepage: 'https://www.youtube.com/@IGN' },
]

const regionalVideoFeeds = {
  AU: [
    { name: '9News', category: 'Local', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCIYLOcEUX6TbBo7HQVF2PKA', homepage: 'https://www.youtube.com/@9NewsAUS', regional: true },
  ],
}

const alJazeeraLive = {
  name: 'Al Jazeera English',
  channelId: 'UCNye-wNBqNL5ZzHSJj3l8Bg',
  websiteUrl: 'https://www.aljazeera.com/',
  brandColor: '#d7a229',
  global: true,
}

const regionalLiveChannels = {
  AU: [
    { name: '7NEWS', channelId: 'UC5T7D-Dh1eDGtsAFCuwv_Sw', websiteUrl: 'https://7news.com.au/', brandColor: '#e21b2d' },
    { name: '9News', channelId: 'UCIYLOcEUX6TbBo7HQVF2PKA', websiteUrl: 'https://www.9news.com.au/', brandColor: '#1556a2' },
    { name: 'ABC News Australia', channelId: 'UCVgO39Bk5sMo66-6o6Spn6Q', websiteUrl: 'https://www.abc.net.au/news/', brandColor: '#111111' },
  ],
  NZ: [
    { name: '1News', channelId: 'UCxPAYgO8OpFev3PUTKbsxNw', websiteUrl: 'https://www.1news.co.nz/', brandColor: '#c9002b' },
    { name: 'RNZ', channelId: 'UCp4OXwfZE1SaCQ4jRAuaoXQ', websiteUrl: 'https://www.rnz.co.nz/news/', brandColor: '#c8102e' },
  ],
  US: [
    { name: 'ABC News', channelId: 'UCBi2mrWuNuyYy4gbM6fU18Q', websiteUrl: 'https://abcnews.go.com/', brandColor: '#151515' },
    { name: 'NBC News', channelId: 'UCeY0bbntWzzVIaj2z3QigXg', websiteUrl: 'https://www.nbcnews.com/', brandColor: '#552583' },
  ],
  CA: [
    { name: 'CBC News', channelId: 'UCuFFtHWoLl5fauMMD5Ww2jA', websiteUrl: 'https://www.cbc.ca/news', brandColor: '#d71920' },
    { name: 'Global News', channelId: 'UChLtXXpo4Ge1ReTEboVvTDg', websiteUrl: 'https://globalnews.ca/', brandColor: '#d91e2b' },
  ],
  GB: [
    { name: 'Sky News', channelId: 'UCoMdktPbSTixAyNGwb-UYkQ', websiteUrl: 'https://news.sky.com/', brandColor: '#d0021b' },
    { name: 'BBC News', channelId: 'UC16niRr50-MSBwiO3YDb3RA', websiteUrl: 'https://www.bbc.com/news', brandColor: '#b80000' },
  ],
  IE: [{ name: 'RTÉ News', channelId: 'UC8urSFTmQDxaPDEIZ2Fd63Q', websiteUrl: 'https://www.rte.ie/news/', brandColor: '#143d64' }],
  IN: [{ name: 'NDTV', channelId: 'UCZFMm1mMw0F81Z37aaEzTUA', websiteUrl: 'https://www.ndtv.com/', brandColor: '#b3192e' }],
  PK: [{ name: 'DawnNews', channelId: 'UCaxR-D8FjZ-2otbU0_Y2grg', websiteUrl: 'https://www.dawn.com/', brandColor: '#b50016' }],
  SG: [{ name: 'CNA', channelId: 'UC83jt4dlz1Gjl58fzQrrKZg', websiteUrl: 'https://www.channelnewsasia.com/', brandColor: '#8f263d' }],
  GLOBAL: [
    { name: 'Sky News', channelId: 'UCoMdktPbSTixAyNGwb-UYkQ', websiteUrl: 'https://news.sky.com/', brandColor: '#d0021b' },
    { name: 'BBC News', channelId: 'UC16niRr50-MSBwiO3YDb3RA', websiteUrl: 'https://www.bbc.com/news', brandColor: '#b80000' },
  ],
}

const palestineFeeds = [
  { name: 'Al Jazeera', category: 'Palestine', url: 'https://www.aljazeera.com/xml/rss/all.xml', homepage: 'https://www.aljazeera.com/where/palestine/', filter: /palestin|gaza|west bank|israel/i },
  { name: 'BBC Middle East', category: 'Palestine', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', homepage: 'https://www.bbc.com/news/world/middle_east', filter: /palestin|gaza|west bank|israel/i },
  { name: 'UN News', category: 'Palestine', url: 'https://news.un.org/feed/subscribe/en/news/region/middle-east/feed/rss.xml', homepage: 'https://news.un.org/en/news/region/middle-east', filter: /palestin|gaza|west bank|israel/i },
]

const allowedArticleHosts = [
  'aljazeera.com',
  '7news.com.au',
  'bbc.co.uk',
  'bbc.com',
  'cbc.ca',
  'channelnewsasia.com',
  'dawn.com',
  'globalnews.ca',
  'ign.com',
  'ndtv.com',
  'news.un.org',
  'npr.org',
  'rnz.co.nz',
  'rte.ie',
  'sbs.com.au',
  'smithsonianmag.com',
  'techcrunch.com',
  'theconversation.com',
  'theguardian.com',
]

const textOf = value => {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return value['#text'] || value['@_href'] || ''
}

const asArray = value => Array.isArray(value) ? value : value ? [value] : []

const escapeRegExp = value => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const cleanText = value => String(value || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/\s+/g, ' ')
  .trim()

const cleanRichText = value => cleanText(String(value || '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>|<\/li>|<\/h[1-6]>/gi, '\n\n'))

const decodeAttribute = value => cleanText(String(value || '')
  .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16))))

const metaValue = (html, key) => {
  const escapedKey = escapeRegExp(key)
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escapedKey}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escapedKey}["']`, 'i'),
  ]
  for (const pattern of patterns) {
    const value = html.match(pattern)?.[1]
    if (value) return decodeAttribute(value)
  }
  return ''
}

const classText = (html, names) => {
  const classNames = names.map(escapeRegExp).join('|')
  const pattern = new RegExp(`<([a-z][a-z0-9]*)[^>]+class=["'][^"']*(?:${classNames})[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`, 'i')
  return cleanText(html.match(pattern)?.[2] || '')
}

const asList = value => Array.isArray(value) ? value : value ? [value] : []

const jsonLdRecords = html => {
  const records = []
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1])
      const values = asList(parsed).flatMap(value => asList(value?.['@graph'] || value))
      records.push(...values)
    } catch {
      // Some publishers emit incomplete analytics JSON-LD; other metadata is still usable.
    }
  }
  return records
}

const authorName = value => asList(value).map(author => cleanText(typeof author === 'string' ? author : author?.name)).filter(Boolean).join(', ')

const isAllowedArticleUrl = value => {
  try {
    const parsed = new URL(value)
    return ['http:', 'https:'].includes(parsed.protocol) && allowedArticleHosts.some(host => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))
  } catch {
    return false
  }
}

const sourceDetailCache = new Map()
const sourceDetailCacheMs = 30 * 60 * 1000

const safeEmbedUrl = value => {
  try {
    const parsed = new URL(value)
    const allowedEmbedHosts = ['players.brightcove.net', 'www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com']
    return parsed.protocol === 'https:' && allowedEmbedHosts.includes(parsed.hostname) ? parsed.href : ''
  } catch {
    return ''
  }
}

const largestSource = value => String(value || '').split(',').map(candidate => candidate.trim().split(/\s+/)[0]).filter(Boolean).at(-1) || ''

const absoluteMediaUrl = (value, baseUrl) => {
  const raw = decodeAttribute(value)
  if (!raw || raw.startsWith('data:')) return ''
  try {
    return upgradeImageUrl(new URL(raw, baseUrl).href)
  } catch {
    return ''
  }
}

const readerSelectorsFor = hostname => {
  if (hostname.endsWith('7news.com.au')) return ['article', '[class*="articleBody"]']
  if (hostname.endsWith('bbc.co.uk') || hostname.endsWith('bbc.com')) return ['article', '[data-testid="rich-text"]']
  if (hostname.endsWith('sbs.com.au')) return ['article', '[class*="article-body"]']
  if (hostname.endsWith('theguardian.com')) return ['article', '[data-gu-name="body"]']
  if (hostname.endsWith('theconversation.com')) return ['.content-body', 'article']
  if (hostname.endsWith('rnz.co.nz')) return ['article', '.article__body']
  if (hostname.endsWith('cbc.ca')) return ['article', '.story']
  if (hostname.endsWith('globalnews.ca')) return ['article', '.l-article__body', '.story-telling-content']
  if (hostname.endsWith('npr.org')) return ['article', '#storytext']
  if (hostname.endsWith('dawn.com')) return ['article', '.story__content']
  if (hostname.endsWith('ndtv.com')) return ['article', '.Art-exp_wr']
  if (hostname.endsWith('channelnewsasia.com')) return ['article', '.text-long']
  if (hostname.endsWith('rte.ie')) return ['article', '.article-body']
  if (hostname.endsWith('techcrunch.com')) return ['.entry-content']
  if (hostname.endsWith('ign.com')) return ['.article-content', '.article-page']
  if (hostname.endsWith('smithsonianmag.com')) return ['article']
  if (hostname.endsWith('aljazeera.com')) return ['.wysiwyg--all-content']
  if (hostname.endsWith('news.un.org')) return ['.text-formatted', 'main']
  return ['article', 'main']
}

const readerBlocks = (html, pageUrl, mainImage) => {
  const $ = load(html)
  const hostname = new URL(pageUrl).hostname
  const candidates = readerSelectorsFor(hostname).map(selector => $(selector).first()).filter(node => node.length)
  const rootNode = candidates.sort((a, b) => cleanText(b.text()).length - cleanText(a.text()).length)[0]
  if (!rootNode?.length) return []

  const blocks = []
  const seenText = new Set()
  let totalCharacters = 0
  const excludedSelector = [
    'aside', 'nav', 'footer', 'form', 'script', 'style', 'noscript',
    '[class*="advert"]', '[class*="ad-unit"]', '[class*="newsletter"]',
    '[class*="related"]', '[class*="promo"]', '[class*="share"]',
    '[data-testid*="related"]', '[data-testid*="recommend"]',
  ].join(',')
  const unwantedText = /^(advertisement|related content|read more|sign up|follow us|share this|save this article|know the news with the 7news app:.*|download (?:the app|today).*)$/i
  const endOfArticleText = /^(related topics|more on this story|recommended stories|recommended for you|more from (?:the )?[^.]+)$/i
  const imageKey = value => String(value || '').replace(/^https?:\/\/[^/]+/i, '').replace(/\?.*$/, '').replace(/\/(?:\d+|standard\/\d+)\//g, '/')
  const mainImageKey = imageKey(mainImage)

  rootNode.find('h2, h3, p, blockquote, ul > li, ol > li, figure').each((_index, element) => {
    if (blocks.length >= 140 || totalCharacters >= 70_000) return false
    const node = $(element)
    if (node.closest(excludedSelector).length) return undefined
    const tag = String(element.tagName || '').toLowerCase()

    if (tag === 'figure') {
      const image = node.find('img').first()
      const src = absoluteMediaUrl(image.attr('src') || image.attr('data-src') || image.attr('data-lazy-src') || largestSource(image.attr('srcset') || image.attr('data-srcset')), pageUrl)
      if (!src || imageKey(src) === mainImageKey) return undefined
      const caption = cleanText(node.find('figcaption').first().text()).replace(/^image caption,?\s*/i, '')
      if (caption) seenText.add(caption.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 180))
      blocks.push({ type: 'image', src, alt: cleanText(image.attr('alt')), caption })
      return undefined
    }

    if (tag === 'p' && node.closest('blockquote, li').length) return undefined
    if (tag === 'li' && node.parents('li').length) return undefined
    const clone = node.clone()
    clone.find('script, style, .visually-hidden, [aria-hidden="true"]').remove()
    const text = cleanText(clone.text())
    if ((tag === 'h2' || tag === 'h3') && endOfArticleText.test(text)) return false
    const minimumLength = tag === 'h2' || tag === 'h3' ? 3 : 24
    const key = text.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 180)
    if (text.length < minimumLength || unwantedText.test(text) || seenText.has(key)) return undefined
    seenText.add(key)
    const type = tag === 'h2' || tag === 'h3' ? 'heading' : tag === 'blockquote' ? 'quote' : tag === 'li' ? 'list-item' : 'paragraph'
    blocks.push({ type, text: text.slice(0, 7000) })
    totalCharacters += text.length
    return undefined
  })

  return blocks
}

const collectSourceDetails = async url => {
  const cached = sourceDetailCache.get(url)
  if (cached && Date.now() - cached.fetchedAt < sourceDetailCacheMs) return cached.data
  const response = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; Dailyline/1.0; source detail reader)' },
    redirect: 'follow',
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) throw new Error(`The publisher returned ${response.status}.`)
  if (!String(response.headers.get('content-type') || '').includes('text/html')) throw new Error('The publisher did not return an article page.')
  const html = (await response.text()).slice(0, 4_000_000)
  const structuredData = jsonLdRecords(html)
  const articleData = structuredData.find(record => /NewsArticle|Article|BlogPosting/i.test(asList(record?.['@type']).join(' '))) || {}
  const videoData = structuredData.find(record => /VideoObject/i.test(asList(record?.['@type']).join(' '))) || {}
  const jsonLd = Object.keys(articleData).length ? articleData : videoData
  const descriptionCandidates = [
    classText(html, ['article__subhead', 'article-subhead', 'article__dek', 'article-dek', 'subheadline', 'story-subtitle']),
    cleanText(jsonLd.description),
    metaValue(html, 'og:description'),
    metaValue(html, 'description'),
    metaValue(html, 'twitter:description'),
  ].filter(Boolean)
  const description = descriptionCandidates.sort((a, b) => b.length - a.length)[0]?.slice(0, 1800) || ''
  const keywordValue = jsonLd.keywords || metaValue(html, 'keywords') || ''
  const keywords = asList(keywordValue).flatMap(value => String(value).split(',')).map(value => cleanText(value)).filter(Boolean).slice(0, 12)
  const image = upgradeImageUrl(typeof jsonLd.image === 'string' ? jsonLd.image : jsonLd.image?.url || asList(jsonLd.image)[0]?.url || asList(videoData.thumbnailUrl)[0] || metaValue(html, 'og:image'))
  const body = readerBlocks(html, response.url, image)
  const isVideoPage = /\/videos?\//i.test(new URL(response.url).pathname) || /video/i.test(metaValue(html, 'og:type'))
  const embedUrl = isVideoPage ? safeEmbedUrl(videoData.embedUrl || metaValue(html, 'og:video:url') || metaValue(html, 'og:video')) : ''
  const embeddingFlag = html.match(/"isEmbeddingAllowed":(true|false)/i)?.[1]
  const bodyWordCount = body.filter(block => block.text).reduce((total, block) => total + block.text.split(/\s+/).filter(Boolean).length, 0)
  const data = {
    title: cleanText(jsonLd.headline || metaValue(html, 'og:title')),
    description,
    author: authorName(jsonLd.author) || metaValue(html, 'author') || metaValue(html, 'article:author'),
    publishedAt: jsonLd.datePublished || metaValue(html, 'article:published_time') || null,
    updatedAt: jsonLd.dateModified || metaValue(html, 'article:modified_time') || null,
    section: cleanText(jsonLd.articleSection || metaValue(html, 'article:section')),
    keywords,
    siteName: cleanText(metaValue(html, 'og:site_name')),
    language: cleanText(jsonLd.inLanguage || html.match(/<html[^>]+lang=["']([^"']+)/i)?.[1]),
    image,
    body,
    bodyWordCount,
    media: isVideoPage ? {
      type: 'video',
      title: cleanText(videoData.name || jsonLd.headline || metaValue(html, 'og:title')),
      duration: cleanText(videoData.duration),
      poster: upgradeImageUrl(asList(videoData.thumbnailUrl)[0] || image),
      embedUrl,
      embeddable: Boolean(embedUrl) && embeddingFlag !== 'false',
      provider: new URL(response.url).hostname.replace(/^www\./, ''),
    } : null,
    canonicalUrl: response.url,
    retrievedAt: new Date().toISOString(),
  }
  sourceDetailCache.set(url, { data, fetchedAt: Date.now() })
  return data
}

const upgradeImageUrl = value => {
  const original = String(value || '')
  const smithsonianOriginal = original.match(/th-thumbnailer\.cdn-si-edu\.com\/.+\/(https?:\/\/.+)$/i)?.[1]
  return (smithsonianOriginal || original)
    .replace(/ichef\.bbci\.co\.uk\/ace\/standard\/\d+\//i, 'ichef.bbci.co.uk/ace/standard/1024/')
    .replace(/i\d\.ytimg\.com\/vi\/([^/]+)\/hqdefault\.jpg/i, 'i.ytimg.com/vi/$1/maxresdefault.jpg')
}

const firstImage = item => {
  const candidates = [
    ...asArray(item.content),
    ...asArray(item.enclosure),
    ...asArray(item.thumbnail),
  ].map(value => ({
    url: value?.['@_url'],
    width: Number(value?.['@_width'] || 0),
  })).filter(candidate => candidate.url)
    .sort((a, b) => b.width - a.width)
  if (candidates[0]) return upgradeImageUrl(candidates[0].url)
  const html = textOf(item.encoded) || textOf(item.description) || ''
  return upgradeImageUrl(html.match(/<img[^>]+src=["']([^"']+)/i)?.[1] || '')
}

const fetchXml = async url => {
  let lastError
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
          'user-agent': 'Mozilla/5.0 (compatible; Dailyline/1.0; +https://github.com/divulgenceai/dailyline-news)',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
      })
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      return parser.parse(await response.text())
    } catch (error) {
      lastError = error
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 180))
    }
  }
  throw lastError
}

const parseArticleFeed = async source => {
  const data = await fetchXml(source.url)
  const items = asArray(data?.rss?.channel?.item || data?.feed?.entry)
  return items.slice(0, 14).map((item, index) => {
    const linkValue = asArray(item.link).find(link => link?.['@_rel'] === 'alternate') || item.link
    const url = textOf(linkValue) || item.guid?.['#text'] || textOf(item.guid)
    const publishedAt = textOf(item.pubDate || item.published || item.updated || item.date)
    const publisher = source.name
    const rawTitle = cleanText(textOf(item.title))
    const title = rawTitle.replace(new RegExp(`\\s+-\\s+${escapeRegExp(publisher)}$`, 'i'), '').trim()
    const rawDescription = cleanText(textOf(item.description || item.summary || item.encoded || item.content))
      .replace(/Get our breaking news email\s*,?\s*free app or daily news podcast/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 520)
    const description = rawDescription === rawTitle || rawDescription === `${title} ${publisher}` ? '' : rawDescription
    const publisherText = cleanRichText(textOf(item.encoded || item.content || item.description || item.summary))
    const rawContent = publisherText.slice(0, 3200)
    const fullContent = rawContent === rawTitle || rawContent === `${title} ${publisher}` ? '' : rawContent
    const authorValue = item.author?.name || item.author || item.creator
    const updatedValue = textOf(item.updated || item.modified)
    return {
      id: `${source.name}-${item.guid?.['#text'] || textOf(item.guid) || url || index}`,
      type: 'article',
      source: publisher,
      category: source.category,
      isRegional: Boolean(source.regional),
      title,
      description,
      content: fullContent,
      url,
      image: firstImage(item),
      publishedAt: new Date(publishedAt).toISOString(),
      updatedAt: updatedValue && !Number.isNaN(Date.parse(updatedValue)) ? new Date(updatedValue).toISOString() : null,
      author: cleanText(textOf(authorValue)),
      access: 'Free to read',
      sourceHomepage: source.homepage,
      sourceFeed: source.url,
      feedTextStatus: publisherText.length > 3200 ? 'Extended publisher excerpt' : publisherText ? 'Publisher-supplied feed text' : 'Headline and source link',
    }
  }).filter(item => item.title && item.url && !Number.isNaN(Date.parse(item.publishedAt)) && (!source.filter || source.filter.test(`${item.title} ${item.description}`)))
}

const parseVideoFeed = async source => {
  const data = await fetchXml(source.url)
  return asArray(data?.feed?.entry).slice(0, 8).map((entry, index) => {
    const videoId = textOf(entry.videoId)
    const group = entry.group || {}
    return {
      id: `${source.name}-video-${videoId || index}`,
      type: 'video',
      source: source.name,
      category: source.category || 'Watch',
      isRegional: Boolean(source.regional),
      title: cleanText(textOf(entry.title)),
      description: cleanText(textOf(group.description)).slice(0, 260),
      url: `https://www.youtube.com/watch?v=${videoId}`,
      image: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      videoId,
      publishedAt: new Date(textOf(entry.published || entry.updated)).toISOString(),
      updatedAt: textOf(entry.updated) ? new Date(textOf(entry.updated)).toISOString() : null,
      author: source.name,
      access: 'Free to watch',
      sourceHomepage: source.homepage,
      sourceFeed: source.url,
      feedTextStatus: 'Publisher-supplied video description',
    }
  }).filter(item => item.videoId && item.title && !Number.isNaN(Date.parse(item.publishedAt)))
}

const fetchYouTubePage = async url => {
  const response = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; Dailyline/1.0 live status)' },
    redirect: 'follow',
    signal: AbortSignal.timeout(7000),
  })
  if (!response.ok) throw new Error(`YouTube returned ${response.status}`)
  return (await response.text()).slice(0, 3_000_000)
}

const resolveLiveChannel = async channel => {
  const livePageUrl = `https://www.youtube.com/channel/${channel.channelId}/live`
  const channelPageUrl = `https://www.youtube.com/channel/${channel.channelId}`
  const [liveResult, channelResult] = await Promise.allSettled([
    fetchYouTubePage(livePageUrl),
    fetchYouTubePage(channelPageUrl),
  ])
  const html = liveResult.status === 'fulfilled' ? liveResult.value : ''
  const channelHtml = channelResult.status === 'fulfilled' ? channelResult.value : ''
  if (!html && !channelHtml) throw new Error(liveResult.reason?.message || channelResult.reason?.message || 'Channel metadata unavailable')
  const canonicalUrl = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1]
    || livePageUrl
  const videoId = canonicalUrl.match(/[?&]v=([a-zA-Z0-9_-]{6,})/)?.[1] || ''
  const liveNow = Boolean(videoId) && html.includes('"isLiveContent":true')
  const sourceTitle = metaValue(html, 'og:title').replace(/\s+-\s+YouTube$/i, '')
  const logo = metaValue(channelHtml, 'og:image') || (!liveNow ? metaValue(html, 'og:image') : '')
  return {
    ...channel,
    title: liveNow && sourceTitle ? sourceTitle : `${channel.name} live channel`,
    liveNow,
    videoId: liveNow ? videoId : '',
    watchUrl: liveNow ? `https://www.youtube.com/watch?v=${videoId}` : livePageUrl,
    livePageUrl,
    logo,
    image: liveNow ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : '',
    error: html ? null : liveResult.reason?.message || 'Live status unavailable',
  }
}

const feedCaches = new Map()
let palestineCache = { items: [], fetchedAt: 0, sources: [] }
const liveCaches = new Map()
const feedInFlight = new Map()
let palestineInFlight = null
const liveInFlight = new Map()
const cacheForMs = 60 * 60 * 1000
const palestineCacheForMs = 30 * 60 * 1000
const liveCacheForMs = 2 * 60 * 1000

const normalizeEdition = value => {
  const code = String(value || '').toUpperCase()
  return code === 'GLOBAL' || regionalArticleFeeds[code] || regionalVideoFeeds[code] ? code : 'GLOBAL'
}

export const collectFeed = async (editionValue, force) => {
  const edition = normalizeEdition(editionValue)
  const cached = feedCaches.get(edition)
  if (!force && cached?.items.length && Date.now() - cached.fetchedAt < cacheForMs) return cached
  if (feedInFlight.has(edition)) return feedInFlight.get(edition)
  const collection = (async () => {
    const editionArticleFeeds = regionalArticleFeeds[edition] || []
    const editionVideoFeeds = regionalVideoFeeds[edition] || []
    const requests = [
      ...[...editionArticleFeeds, ...articleFeeds].map(source => parseArticleFeed(source).then(items => ({ source: source.name, regional: Boolean(source.regional), items })).catch(error => ({ source: source.name, regional: Boolean(source.regional), items: [], error: error.message }))),
      ...[...editionVideoFeeds, ...videoFeeds].map(source => parseVideoFeed(source).then(items => ({ source: `${source.name} Video`, regional: Boolean(source.regional), items })).catch(error => ({ source: `${source.name} Video`, regional: Boolean(source.regional), items: [], error: error.message }))),
    ]
    const results = await Promise.all(requests)
    const seen = new Set()
    const items = results.flatMap(result => result.items)
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
      .filter(item => {
        const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    if (!items.length) throw new Error('No publishers returned readable stories.')
    const data = {
      items,
      fetchedAt: Date.now(),
      edition,
      editionName: editionNames[edition] || editionNames.GLOBAL,
      sources: results.map(result => ({ name: result.source, regional: result.regional, ok: !result.error, error: result.error || null })),
    }
    feedCaches.set(edition, data)
    return data
  })()
  feedInFlight.set(edition, collection)
  try {
    return await collection
  } finally {
    feedInFlight.delete(edition)
  }
}

export const collectPalestine = async force => {
  if (!force && palestineCache.items.length && Date.now() - palestineCache.fetchedAt < palestineCacheForMs) return palestineCache
  if (palestineInFlight) return palestineInFlight
  palestineInFlight = (async () => {
    const results = await Promise.all(palestineFeeds.map(source => parseArticleFeed(source)
      .then(items => ({ source: source.name, items }))
      .catch(error => ({ source: source.name, items: [], error: error.message }))))
    const seen = new Set()
    const items = results.flatMap(result => result.items)
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
      .filter(item => {
        const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 12)
    if (!items.length) throw new Error('No Palestine coverage is currently available from the configured feeds.')
    palestineCache = {
      items,
      fetchedAt: Date.now(),
      sources: results.map(result => ({ name: result.source, ok: !result.error, error: result.error || null })),
    }
    return palestineCache
  })()
  try {
    return await palestineInFlight
  } finally {
    palestineInFlight = null
  }
}

export const collectLive = async (editionValue, force) => {
  const edition = normalizeEdition(editionValue)
  const cached = liveCaches.get(edition)
  if (!force && cached?.items.length && Date.now() - cached.fetchedAt < liveCacheForMs) return cached
  if (liveInFlight.has(edition)) return liveInFlight.get(edition)
  const collection = (async () => {
    const regional = regionalLiveChannels[edition] || regionalLiveChannels.GLOBAL
    const channels = [...regional, alJazeeraLive]
    const items = await Promise.all(channels.map(channel => resolveLiveChannel(channel).catch(error => ({
      ...channel,
      title: `${channel.name} live channel`,
      liveNow: false,
      videoId: '',
      watchUrl: `https://www.youtube.com/channel/${channel.channelId}/live`,
      livePageUrl: `https://www.youtube.com/channel/${channel.channelId}/live`,
      logo: '',
      image: '',
      error: error.message,
    }))))
    const data = { items, fetchedAt: Date.now(), edition, editionName: editionNames[edition] || editionNames.GLOBAL }
    liveCaches.set(edition, data)
    return data
  })()
  liveInFlight.set(edition, collection)
  try {
    return await collection
  } finally {
    liveInFlight.delete(edition)
  }
}

const queryValue = (request, key) => {
  const directValue = request.query?.[key]
  if (directValue != null) return Array.isArray(directValue) ? directValue[0] : directValue
  return new URL(request.url || '/', 'http://dailyline.local').searchParams.get(key)
}

const cacheHeader = (seconds, staleSeconds) => `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${staleSeconds}`

export const handleFeed = async (request, response) => {
  const edition = normalizeEdition(queryValue(request, 'country'))
  const force = queryValue(request, 'refresh') === '1'
  try {
    const feed = await collectFeed(edition, force)
    response.setHeader('Cache-Control', force ? 'no-store' : cacheHeader(3600, 300))
    response.json({ ...feed, fetchedAt: new Date(feed.fetchedAt).toISOString() })
  } catch (error) {
    const staleFeed = feedCaches.get(edition)
    if (staleFeed?.items.length) {
      response.setHeader('Cache-Control', 'no-store')
      return response.json({
        ...staleFeed,
        fetchedAt: new Date(staleFeed.fetchedAt).toISOString(),
        stale: true,
        warning: 'Some publishers could not be refreshed, so the latest verified edition is shown.',
      })
    }
    response.status(503).json({ error: error.message })
  }
}

export const handlePalestine = async (request, response) => {
  const force = queryValue(request, 'refresh') === '1'
  try {
    const feed = await collectPalestine(force)
    response.setHeader('Cache-Control', force ? 'no-store' : cacheHeader(1800, 120))
    response.json({ ...feed, fetchedAt: new Date(feed.fetchedAt).toISOString() })
  } catch (error) {
    if (palestineCache.items.length) {
      response.setHeader('Cache-Control', 'no-store')
      return response.json({
        ...palestineCache,
        fetchedAt: new Date(palestineCache.fetchedAt).toISOString(),
        stale: true,
        warning: 'Palestine sources could not be refreshed, so the latest verified coverage is shown.',
      })
    }
    response.status(503).json({ error: error.message })
  }
}

export const handleLive = async (request, response) => {
  const edition = normalizeEdition(queryValue(request, 'country'))
  const force = queryValue(request, 'refresh') === '1'
  try {
    const live = await collectLive(edition, force)
    response.setHeader('Cache-Control', force ? 'no-store' : cacheHeader(120, 60))
    response.json({ ...live, fetchedAt: new Date(live.fetchedAt).toISOString() })
  } catch (error) {
    const staleLive = liveCaches.get(edition)
    if (staleLive?.items.length) {
      response.setHeader('Cache-Control', 'no-store')
      return response.json({ ...staleLive, fetchedAt: new Date(staleLive.fetchedAt).toISOString(), stale: true })
    }
    response.status(503).json({ error: error.message })
  }
}

export const handleStoryDetails = async (request, response) => {
  const url = String(queryValue(request, 'url') || '')
  if (!isAllowedArticleUrl(url)) return response.status(400).json({ error: 'This source is not in Dailyline’s approved publisher list.' })
  try {
    const details = await collectSourceDetails(url)
    response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=1800, stale-while-revalidate=300')
    return response.json(details)
  } catch (error) {
    return response.status(502).json({ error: error.message })
  }
}

export const handleHealth = (_request, response) => response.json({
  ok: true,
  refreshIntervals: { feedMinutes: cacheForMs / 60000, palestineMinutes: palestineCacheForMs / 60000, liveMinutes: liveCacheForMs / 60000 },
  dailyEdition: true,
  cache: {
    feedEditions: [...feedCaches.entries()].map(([edition, feed]) => ({ edition, fetchedAt: new Date(feed.fetchedAt).toISOString() })),
    palestineFetchedAt: palestineCache.fetchedAt ? new Date(palestineCache.fetchedAt).toISOString() : null,
    liveEditions: [...liveCaches.entries()].map(([edition, live]) => ({ edition, fetchedAt: new Date(live.fetchedAt).toISOString() })),
  },
})

app.get('/api/feed', handleFeed)
app.get('/api/palestine', handlePalestine)
app.get('/api/live', handleLive)
app.get('/api/story-details', handleStoryDetails)
app.get('/api/health', handleHealth)

const refreshInBackground = (label, collector) => {
  void collector(true).catch(error => console.error(`${label} refresh failed:`, error.message))
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  app.use(express.static(path.join(root, 'dist')))
  app.get('*', (_request, response) => response.sendFile(path.join(root, 'dist', 'index.html')))
  app.use((error, _request, response, _next) => {
    console.error('Unhandled server error:', error)
    response.status(500).json({ error: 'Dailyline could not complete this request.' })
  })
  app.listen(port, '0.0.0.0', () => {
    console.log(`Dailyline feed server listening on http://localhost:${port}`)
    void collectPalestine(false)
    const feedTimer = setInterval(() => {
      for (const edition of feedCaches.keys()) refreshInBackground(`${edition} feed`, () => collectFeed(edition, true))
    }, cacheForMs)
    const palestineTimer = setInterval(() => refreshInBackground('Palestine feed', collectPalestine), palestineCacheForMs)
    feedTimer.unref()
    palestineTimer.unref()
  })
}

export default app
