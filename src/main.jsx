import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowRight, ArrowUpRight, Bookmark, LocateFixed, MapPin, Menu, Play, Radio, RefreshCw, Search, X } from 'lucide-react'
import './styles.css'

const topics = [
  { label: 'Latest', value: 'All' },
  { label: 'Local', value: 'Local' },
  { label: 'Palestine', value: 'Palestine' },
  { label: 'Technology', value: 'Tech' },
  { label: 'Gaming', value: 'Gaming' },
  { label: 'World', value: 'World' },
  { label: 'Culture', value: 'Culture' },
  { label: 'History', value: 'History' },
  { label: 'Blogs', value: 'Blogs' },
  { label: 'Live', value: 'Live' },
  { label: 'Watch', value: 'Watch' },
]

const editionOptions = [
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IN', name: 'India' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'SG', name: 'Singapore' },
  { code: 'GLOBAL', name: 'Global' },
]

const editionByCode = new Map(editionOptions.map(edition => [edition.code, edition]))

const blogTopics = [
  { label: 'All posts', value: 'All' },
  { label: 'Technology', value: 'Tech' },
  { label: 'Gaming', value: 'Gaming' },
  { label: 'World', value: 'World' },
  { label: 'Culture', value: 'Culture' },
  { label: 'History', value: 'History' },
]

const HOUR_MS = 60 * 60 * 1000
const HALF_HOUR_MS = 30 * 60 * 1000
const LIVE_REFRESH_MS = 2 * 60 * 1000
const browserLocale = navigator.language || 'en-AU'
const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const fullDate = new Intl.DateTimeFormat(browserLocale, { weekday: 'long', day: 'numeric', month: 'long' })
const shortDate = new Intl.DateTimeFormat(browserLocale, { day: 'numeric', month: 'short' })
const localTime = new Intl.DateTimeFormat(browserLocale, { hour: 'numeric', minute: '2-digit' })
const localZoneName = new Intl.DateTimeFormat(browserLocale, { timeZoneName: 'short' }).formatToParts(new Date()).find(part => part.type === 'timeZoneName')?.value || localTimeZone
const publishedDate = new Intl.DateTimeFormat(browserLocale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
const sourceDetailsCache = new Map()

const fetchJson = async (url, timeoutMs = 26_000) => {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    const body = await response.text()
    let data
    try {
      data = JSON.parse(body)
    } catch {
      throw new Error(response.ok ? 'The server returned an unreadable response.' : `The news service returned ${response.status}.`)
    }
    if (!response.ok) throw new Error(data.error || `The news service returned ${response.status}.`)
    return data
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The live sources took too long to respond. Please try again.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

const relativeTime = value => {
  const seconds = Math.max(1, Math.round((Date.now() - Date.parse(value)) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

const isBreaking = story => Date.now() - Date.parse(story.publishedAt) < 2 * HOUR_MS

const interleaveStoriesBySource = stories => {
  const buckets = new Map()
  for (const story of stories) {
    if (!buckets.has(story.source)) buckets.set(story.source, [])
    buckets.get(story.source).push(story)
  }
  const ordered = []
  let added = true
  while (added) {
    added = false
    for (const bucket of buckets.values()) {
      if (bucket.length) {
        ordered.push(bucket.shift())
        added = true
      }
    }
  }
  return ordered
}

const toParagraphs = value => {
  const suppliedParagraphs = String(value || '').split(/\n{2,}/).map(paragraph => paragraph.trim()).filter(Boolean)
  if (suppliedParagraphs.length > 1) return suppliedParagraphs
  const sentences = String(value || '').split(/(?<=[.!?])\s+/).filter(Boolean)
  const paragraphs = []
  for (let index = 0; index < sentences.length; index += 3) paragraphs.push(sentences.slice(index, index + 3).join(' '))
  return paragraphs.length ? paragraphs : [value]
}

const formatDuration = value => {
  const match = String(value || '').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i)
  if (!match) return ''
  const hours = Number(match[1] || 0)
  const minutes = Number(match[2] || 0)
  const seconds = Number(match[3] || 0)
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`
}

const millisecondsUntilTomorrow = () => {
  const tomorrow = new Date()
  tomorrow.setHours(24, 0, 5, 0)
  return Math.max(1000, tomorrow.getTime() - Date.now())
}

const readSaved = () => {
  try {
    const value = JSON.parse(localStorage.getItem('dailyline-feed-saved') || localStorage.getItem('dayline-feed-saved') || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

const readEdition = () => {
  try {
    const savedEdition = JSON.parse(localStorage.getItem('dailyline-edition-v1') || localStorage.getItem('dayline-edition-v1') || 'null')
    return editionByCode.get(savedEdition?.code) || null
  } catch {
    return null
  }
}

function QualityImage({ story, className = '', eager = false }) {
  const original = story.image
  const fallback = story.videoId ? `https://i.ytimg.com/vi/${story.videoId}/hqdefault.jpg` : ''
  const [source, setSource] = useState(original)

  useEffect(() => setSource(original), [original])
  if (!source) return null

  return (
    <img
      className={className}
      src={source}
      alt=""
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={eager ? 'high' : 'auto'}
      onError={() => setSource(current => fallback && current !== fallback ? fallback : '')}
    />
  )
}

function SourceMedia({ story, details }) {
  const [playing, setPlaying] = useState(false)
  const media = details?.media
  const poster = media?.poster || story.image

  useEffect(() => setPlaying(false), [story.url])

  if (!media) return poster ? <QualityImage story={{ ...story, image: poster }} className="detail-image" eager /> : null

  if (media.embeddable && media.embedUrl && playing) {
    return (
      <div className="source-video-frame">
        <iframe
          src={`${media.embedUrl}${media.embedUrl.includes('?') ? '&' : '?'}autoplay=1`}
          title={media.title || story.title}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  const videoCard = (
    <>
      {poster ? <QualityImage story={{ ...story, image: poster }} eager /> : <span className="source-video-placeholder" />}
      <span className="source-video-shade" aria-hidden="true" />
      <span className="source-video-play" aria-hidden="true"><Play size={28} fill="currentColor" /></span>
      <span className="source-video-label">
        <b>{media.embeddable ? 'Play video' : `Watch on ${story.source}`}</b>
        {formatDuration(media.duration) ? <small>{formatDuration(media.duration)}</small> : null}
      </span>
    </>
  )

  return media.embeddable
    ? <button className="source-video" type="button" onClick={() => setPlaying(true)} aria-label={`Play ${story.title}`}>{videoCard}</button>
    : <a className="source-video" href={details.canonicalUrl || story.url} target="_blank" rel="noreferrer" aria-label={`Watch ${story.title} on ${story.source}`}>{videoCard}</a>
}

function ReaderBody({ blocks, source, wordCount, media }) {
  if (!blocks?.length) return null
  return (
    <section className="reader-article">
      <header>
        <div>
          <span>Reader view</span>
          <h2>{media ? 'Report notes' : 'Full article'}</h2>
        </div>
        {wordCount ? <small>{wordCount.toLocaleString(browserLocale)} words</small> : null}
      </header>
      <p className="reader-credit">Imported from the public {source} {media ? 'video' : 'article'} page with its original order and attribution.</p>
      <div className="reader-body">
        {blocks.map((block, index) => {
          const key = `${block.type}-${index}`
          if (block.type === 'heading') return <h3 key={key}>{block.text}</h3>
          if (block.type === 'quote') return <blockquote key={key}>{block.text}</blockquote>
          if (block.type === 'list-item') return <p className="reader-list-item" key={key}>{block.text}</p>
          if (block.type === 'image') return (
            <figure key={key}>
              <img src={block.src} alt={block.alt || ''} loading="lazy" decoding="async" />
              {block.caption ? <figcaption>{block.caption}</figcaption> : null}
            </figure>
          )
          return <p key={key}>{block.text}</p>
        })}
      </div>
    </section>
  )
}

function LocalDateTime() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <time className="edition-date" dateTime={now.toISOString()} title={localTimeZone}>
      <span className="full-local-date">{fullDate.format(now)}</span>
      <span className="short-local-date">{shortDate.format(now)}</span>
      <b>{localTime.format(now)}</b>
      <small>{localZoneName}</small>
    </time>
  )
}

function Header({ active, setActive, blogTopic, setBlogTopic, query, setQuery, refresh, loading, menuOpen, setMenuOpen, edition, locating, openEditionPicker }) {
  const selectTopic = value => {
    setActive(value)
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <header className="header">
      <div className="header-primary">
        <a className="brand" href="#top">Dailyline<span>.</span></a>
        <LocalDateTime />
        <div className="header-actions">
          <button className="edition-button" onClick={openEditionPicker} aria-label={`Change local edition. Current edition: ${edition?.name || 'not selected'}`}>
            <MapPin size={19} aria-hidden="true" />
            <span>{locating ? 'Locating…' : edition?.name || 'Choose country'}</span>
          </button>
          <label className={query ? 'search-control active' : 'search-control'}>
            <Search size={21} aria-hidden="true" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search" aria-label="Search stories" />
          </label>
          <button className="refresh-button" onClick={refresh} disabled={loading}>
            <RefreshCw size={20} className={loading ? 'spin' : ''} aria-hidden="true" />
            <span>Refresh</span>
          </button>
          <button className="menu-button" onClick={() => setMenuOpen(current => !current)} aria-label="Toggle topics" aria-expanded={menuOpen}>
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </div>
      <nav className={menuOpen ? 'topic-nav open' : 'topic-nav'} aria-label="News topics">
        {topics.map(topic => (
          <button key={topic.value} className={`${active === topic.value ? 'active' : ''}${topic.value === 'Palestine' ? ' palestine-topic' : ''}${topic.value === 'Live' ? ' live-topic' : ''}`} onClick={() => selectTopic(topic.value)}>
            {topic.label}
          </button>
        ))}
      </nav>
      {active === 'Blogs' ? (
        <div className="blog-nav-shell">
          <nav className="blog-topic-nav" aria-label="Blog topics">
            <strong>Browse blogs</strong>
            {blogTopics.map(topic => (
              <button key={topic.value} className={blogTopic === topic.value ? 'active' : ''} onClick={() => { setBlogTopic(topic.value); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                {topic.label}
              </button>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  )
}

function SourceLine({ story, light = false }) {
  return (
    <div className={light ? 'source-line light' : 'source-line'}>
      <b>{story.source}</b>
      <span>·</span>
      <time dateTime={story.publishedAt}>{relativeTime(story.publishedAt)}</time>
      {isBreaking(story) ? <em>Breaking</em> : null}
    </div>
  )
}

function StoryActions({ story, saved, toggleSaved, light = false }) {
  const active = saved.includes(story.id)
  return (
    <div className={light ? 'story-actions light' : 'story-actions'}>
      <a href={story.url} target="_blank" rel="noreferrer">Read report <ArrowUpRight size={17} /></a>
      <button onClick={() => toggleSaved(story.id)} aria-label={active ? 'Remove saved story' : 'Save story'} className={active ? 'saved' : ''}>
        <Bookmark size={19} fill={active ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}

function SectionHeading({ title, status }) {
  return <div className="section-heading"><h1>{title}</h1><span>{status}</span></div>
}

function LeadStory({ story, saved, toggleSaved, openStory }) {
  return (
    <article className="lead-story story-enter">
      {story.image ? (
        <button className="lead-media media-button" onClick={() => openStory(story)} aria-label={`Open: ${story.title}`}>
          <QualityImage story={story} eager />
        </button>
      ) : null}
      <div className="lead-content">
        <SourceLine story={story} />
        <button className="headline-button" onClick={() => openStory(story)}><h2>{story.title}</h2></button>
        {story.description ? <p>{story.description}</p> : null}
        <StoryActions story={story} saved={saved} toggleSaved={toggleSaved} />
      </div>
    </article>
  )
}

function SupportingStory({ story, saved, toggleSaved, openStory, index = 0 }) {
  return (
    <article className="supporting-story story-enter" style={{ '--story-delay': `${Math.min(index, 8) * 45}ms` }}>
      {story.image ? (
        <button className="supporting-media media-button" onClick={() => openStory(story)} aria-label={`Open: ${story.title}`}>
          <QualityImage story={story} />
        </button>
      ) : null}
      <div className="supporting-copy">
        <SourceLine story={story} />
        <button className="headline-button" onClick={() => openStory(story)}><h2>{story.title}</h2></button>
        {story.description ? <p>{story.description}</p> : null}
      </div>
      <button className="open-story" onClick={() => openStory(story)} aria-label={`Open details: ${story.title}`}><ArrowRight size={24} /></button>
      <StoryActions story={story} saved={saved} toggleSaved={toggleSaved} />
    </article>
  )
}

function VideoStory({ story, saved, toggleSaved }) {
  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!playing || ready) return undefined
    const readyFallback = window.setTimeout(() => setReady(true), 6000)
    return () => window.clearTimeout(readyFallback)
  }, [playing, ready])
  const startVideo = () => {
    setReady(false)
    setPlaying(true)
  }
  return (
    <article className="video-story story-enter">
      <div className="video-frame">
        {playing ? (
          <div className={`video-embed${ready ? ' is-ready' : ''}`}>
            {!ready ? <div className="video-loading" role="status"><span aria-hidden="true" />Loading video…</div> : null}
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${story.videoId}?autoplay=1&playsinline=1&rel=0`}
              title={story.title}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => setReady(true)}
              allowFullScreen
            />
          </div>
        ) : (
          <button className="video-poster" onClick={startVideo} aria-label={`Play ${story.title}`}>
            <QualityImage story={story} />
            <span><Play size={26} fill="currentColor" /></span>
          </button>
        )}
      </div>
      <div className="video-copy">
        <SourceLine story={story} />
        <h2>{story.title}</h2>
        {playing ? <a className="video-fallback-link" href={story.url} target="_blank" rel="noreferrer">Having trouble? Watch on YouTube</a> : null}
        <StoryActions story={story} saved={saved} toggleSaved={toggleSaved} />
      </div>
    </article>
  )
}

function LiveChannelCard({ channel, index }) {
  const [playing, setPlaying] = useState(false)
  const playable = channel.liveNow && channel.videoId
  const initials = channel.name.split(/\s+/).map(word => word[0]).join('').slice(0, 3)

  return (
    <article className={`live-channel-card${channel.global ? ' global-live' : ''}`} style={{ '--story-delay': `${Math.min(index, 6) * 55}ms` }}>
      <div className="live-channel-media">
        {playing && playable ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${channel.videoId}?autoplay=1&playsinline=1&rel=0`}
            title={`${channel.name} live stream`}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : playable ? (
          <button onClick={() => setPlaying(true)} aria-label={`Play ${channel.name} live`}>
            <img src={channel.image} alt="" loading={index < 2 ? 'eager' : 'lazy'} decoding="async" />
            <span className="live-play"><Play size={28} fill="currentColor" /></span>
          </button>
        ) : (
          <div className="live-channel-placeholder" aria-hidden="true"><span>{initials}</span></div>
        )}
        <span className={playable ? 'live-badge is-live' : 'live-badge'}><i />{playable ? 'Live now' : 'Channel'}</span>
      </div>
      <div className="live-channel-copy">
        <div><strong>{channel.name}</strong>{channel.global ? <em>Always included</em> : null}</div>
        <h2>{channel.title}</h2>
        <p>{playable ? 'Broadcasting from the publisher’s verified YouTube channel.' : 'Not broadcasting right now. Its official live page remains available.'}</p>
        {playing && playable
          ? <a href={channel.watchUrl} target="_blank" rel="noreferrer">Open on YouTube <ArrowUpRight size={17} /></a>
          : playable
            ? <button className="watch-live-button" onClick={() => setPlaying(true)}>Watch live <Radio size={17} /></button>
            : <a href={channel.livePageUrl} target="_blank" rel="noreferrer">Open live channel <ArrowUpRight size={17} /></a>}
      </div>
    </article>
  )
}

function LiveDesk({ channels, fetchedAt, loading, error, refresh, edition }) {
  const liveCount = channels.filter(channel => channel.liveNow && channel.videoId).length
  return (
    <section className="live-desk" aria-labelledby="live-page-title">
      <div className="live-page-heading">
        <div className="live-kicker"><span />Verified broadcaster streams</div>
        <h1 id="live-page-title">LIVE</h1>
        <p>{edition?.code === 'GLOBAL' ? 'Worldwide news channels' : `${edition?.name} broadcasters`} with Al Jazeera English included in every edition.</p>
        <div className="live-page-status">
          <strong>{liveCount} broadcasting now</strong>
          <span>{fetchedAt ? `Checked ${relativeTime(fetchedAt)}` : 'Checking channels'}</span>
          <button onClick={refresh} disabled={loading}><RefreshCw size={18} className={loading ? 'spin' : ''} /> Check again</button>
        </div>
      </div>
      {loading && !channels.length ? <div className="live-loading" role="status"><span />Checking official live channels…</div> : null}
      {error && !channels.length ? <div className="error-state"><h2>Live channels are temporarily unavailable.</h2><p>{error}</p></div> : null}
      <div className="live-channel-grid">{channels.map((channel, index) => <LiveChannelCard key={channel.channelId} channel={channel} index={index} />)}</div>
      <p className="live-methodology">Live status is checked against each broadcaster’s official YouTube live page every two minutes. A channel marked “Channel” is genuine but is not broadcasting at that moment.</p>
    </section>
  )
}

function PalestineTeaser({ stories, fetchedAt, openDesk, openStory }) {
  const lead = stories[0]
  return (
    <section className="palestine-teaser" aria-labelledby="palestine-teaser-title">
      <div>
        <h2 id="palestine-teaser-title">Palestine</h2>
        <p>{fetchedAt ? `Coverage checked ${relativeTime(fetchedAt)}` : 'Updated every 30 minutes'}</p>
      </div>
      {lead ? <button className="palestine-lead-link" onClick={() => openStory(lead)}>{lead.title}</button> : null}
      <button className="evidence-desk-link" onClick={openDesk}>Open evidence desk <ArrowRight size={22} /></button>
    </section>
  )
}

function HomeView({ stories, palestineStories, palestineFetchedAt, saved, toggleSaved, openStory, openPalestine, edition }) {
  const articles = stories.filter(story => story.type === 'article')
  const regionalArticles = articles.filter(story => story.isRegional)
  const lead = regionalArticles.find(story => story.image) || regionalArticles[0] || articles.find(story => story.image) || articles[0]
  const supportingCandidates = [
    ...regionalArticles.filter(story => story.id !== lead?.id),
    ...articles.filter(story => !story.isRegional && story.id !== lead?.id),
  ]
  const supporting = []
  const featuredSources = new Set([lead?.source])
  for (const story of supportingCandidates) {
    if (!featuredSources.has(story.source)) {
      supporting.push(story)
      featuredSources.add(story.source)
    }
    if (supporting.length === 2) break
  }
  if (supporting.length < 2) {
    for (const story of supportingCandidates) {
      if (!supporting.some(featured => featured.id === story.id)) supporting.push(story)
      if (supporting.length === 2) break
    }
  }
  const used = new Set([lead?.id, ...supporting.map(story => story.id)])
  const remaining = stories.filter(story => !used.has(story.id)).slice(0, 18)

  return (
    <>
      <SectionHeading title={edition?.code === 'GLOBAL' ? 'Today’s briefing' : `Today in ${edition?.name}`} status={edition?.code === 'GLOBAL' ? 'Updated hourly' : 'Local + global · Updated hourly'} />
      {lead ? <LeadStory story={lead} saved={saved} toggleSaved={toggleSaved} openStory={openStory} /> : null}
      <div className="supporting-list">
        {supporting.map((story, index) => <SupportingStory key={story.id} story={story} saved={saved} toggleSaved={toggleSaved} openStory={openStory} index={index} />)}
      </div>
      <PalestineTeaser stories={palestineStories} fetchedAt={palestineFetchedAt} openDesk={openPalestine} openStory={openStory} />
      {remaining.length ? <div className="more-heading"><h2>More from today</h2></div> : null}
      <div className="supporting-list secondary-list">
        {remaining.map((story, index) => story.type === 'video'
          ? <VideoStory key={story.id} story={story} saved={saved} toggleSaved={toggleSaved} />
          : <SupportingStory key={story.id} story={story} saved={saved} toggleSaved={toggleSaved} openStory={openStory} index={index} />)}
      </div>
    </>
  )
}

function TopicView({ title, stories, saved, toggleSaved, openStory, status = 'Latest reporting' }) {
  const articles = stories.filter(story => story.type === 'article')
  const lead = articles.find(story => story.image) || articles[0]
  const remaining = stories.filter(story => story.id !== lead?.id).slice(0, 22)
  return (
    <>
      <SectionHeading title={title} status={status} />
      {lead ? <LeadStory story={lead} saved={saved} toggleSaved={toggleSaved} openStory={openStory} /> : null}
      <div className="supporting-list">
        {remaining.map((story, index) => story.type === 'video'
          ? <VideoStory key={story.id} story={story} saved={saved} toggleSaved={toggleSaved} />
          : <SupportingStory key={story.id} story={story} saved={saved} toggleSaved={toggleSaved} openStory={openStory} index={index} />)}
      </div>
    </>
  )
}

function EvidenceRow({ story, openStory, index }) {
  const excerpt = story.description || story.content
  return (
    <article className="evidence-row story-enter" style={{ '--story-delay': `${Math.min(index, 8) * 55}ms` }}>
      <div className="evidence-source"><b>{story.source}</b><time dateTime={story.publishedAt}>{publishedDate.format(new Date(story.publishedAt))}</time></div>
      <div className="evidence-copy">
        <h2>{story.title}</h2>
        {excerpt
          ? <p><strong>Source excerpt</strong> — {excerpt}</p>
          : <p className="feed-record"><strong>Source record</strong> — This publisher feed supplied a headline and original link, but no text excerpt.</p>}
      </div>
      <div className="evidence-actions">
        <a href={story.url} target="_blank" rel="noreferrer">Read report <ArrowUpRight size={18} /></a>
        <button onClick={() => openStory(story)}>Open details <ArrowRight size={18} /></button>
      </div>
    </article>
  )
}

function PalestineDesk({ stories, fetchedAt, loading, error, refresh, openStory }) {
  const publisherCount = new Set(stories.map(story => story.source)).size
  return (
    <section className="palestine-desk" aria-labelledby="palestine-page-title">
      <div className="palestine-page-heading">
        <h1 id="palestine-page-title">Palestine</h1>
        <p>Live reporting from multiple publishers. Updated every 30 minutes.</p>
        <div><span>{stories.length} reports</span><span>·</span><span>{publisherCount} publishers</span><button onClick={refresh} disabled={loading}><RefreshCw size={18} className={loading ? 'spin' : ''} /> Refresh coverage</button></div>
      </div>
      <div className="evidence-title"><h2>Evidence desk</h2><span>{fetchedAt ? `Checked ${relativeTime(fetchedAt)}` : 'Connecting to sources'}</span></div>
      {error && !stories.length ? <div className="error-state"><h2>Coverage is temporarily unavailable.</h2><p>{error}</p></div> : null}
      <div className="evidence-list">{stories.map((story, index) => <EvidenceRow key={story.id} story={story} openStory={openStory} index={index} />)}</div>
      <p className="methodology-note">Evidence shown here comes directly from publisher feeds. Follow each original report for full context, corrections, and continuing updates.</p>
    </section>
  )
}

function StoryDetail({ story, close, saved, toggleSaved }) {
  const [sourceDetails, setSourceDetails] = useState(() => sourceDetailsCache.get(story.url) || null)
  const [detailsLoading, setDetailsLoading] = useState(() => !sourceDetailsCache.has(story.url))
  const [detailsError, setDetailsError] = useState('')
  useEffect(() => {
    const onKeyDown = event => event.key === 'Escape' && close()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [close])

  useEffect(() => {
    const cached = sourceDetailsCache.get(story.url)
    if (cached) {
      setSourceDetails(cached)
      setDetailsLoading(false)
      return undefined
    }
    const controller = new AbortController()
    const loadSourceDetails = async () => {
      setDetailsLoading(true)
      setDetailsError('')
      try {
        const response = await fetch(`/api/story-details?url=${encodeURIComponent(story.url)}`, { signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Source details are temporarily unavailable.')
        sourceDetailsCache.set(story.url, data)
        setSourceDetails(data)
      } catch (reason) {
        if (reason.name !== 'AbortError') setDetailsError(reason.message)
      } finally {
        if (!controller.signal.aborted) setDetailsLoading(false)
      }
    }
    void loadSourceDetails()
    return () => controller.abort()
  }, [story.url])

  const enrichedStory = {
    ...story,
    author: sourceDetails?.author || story.author,
    updatedAt: sourceDetails?.updatedAt || story.updatedAt,
    image: sourceDetails?.image || story.image,
  }
  const excerpt = sourceDetails?.description || story.description || story.content
  const detail = story.content && !String(excerpt || '').includes(story.content) ? story.content : ''
  return (
    <div className="detail-overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && close()}>
      <article className="detail-panel" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className="drawer-handle" aria-hidden="true" />
        <button className="detail-close" onClick={close} aria-label="Close story"><X size={25} /></button>
        <SourceLine story={enrichedStory} />
        <h1 id="detail-title">{story.title}</h1>
        <div className="access-note"><span aria-hidden="true">✓</span>{story.access || 'Free to read'} original source</div>
        <SourceMedia story={enrichedStory} details={sourceDetails} />
        {detailsLoading ? <div className="source-detail-status" role="status"><span aria-hidden="true" />Collecting details from {story.source}…</div> : null}
        {detailsError ? <p className="source-detail-error">The live source details could not be reached, so the publisher feed information is shown instead.</p> : null}
        {excerpt ? (
          <section className="source-excerpt">
            <h2>{sourceDetails?.description ? 'Full source-page description' : 'Publisher-provided summary'} — <span>{story.source}</span></h2>
            <blockquote>{excerpt}</blockquote>
          </section>
        ) : (
          <section className="source-excerpt source-record">
            <h2>Source record — <span>{story.source}</span></h2>
            <p>This publisher feed supplied a headline and original link, but no text excerpt. Open the report for its full evidence and context.</p>
          </section>
        )}
        {detail && !sourceDetails?.body?.length ? (
          <section className="publisher-briefing">
            <h2>Available publisher detail</h2>
            {toParagraphs(detail).map((paragraph, index) => <p key={`${story.id}-paragraph-${index}`}>{paragraph}</p>)}
            <small>{story.feedTextStatus || 'Publisher-supplied feed text'}. Dailyline preserves attribution and links to the complete original.</small>
          </section>
        ) : null}
        <ReaderBody blocks={sourceDetails?.body} source={story.source} wordCount={sourceDetails?.bodyWordCount} media={sourceDetails?.media} />
        <section className="evidence-trail">
          <h2>Evidence trail</h2>
          <dl>
            <div><dt>Publisher</dt><dd>{story.source}</dd></div>
            {enrichedStory.author ? <div><dt>Byline</dt><dd>{enrichedStory.author}</dd></div> : null}
            <div><dt>Published</dt><dd>{publishedDate.format(new Date(sourceDetails?.publishedAt || story.publishedAt))}</dd></div>
            {enrichedStory.updatedAt ? <div><dt>Updated</dt><dd>{publishedDate.format(new Date(enrichedStory.updatedAt))}</dd></div> : null}
            <div><dt>Topic</dt><dd>{sourceDetails?.section || story.category}</dd></div>
            {sourceDetails?.keywords?.length ? <div><dt>Keywords</dt><dd>{sourceDetails.keywords.join(' · ')}</dd></div> : null}
            {sourceDetails?.language ? <div><dt>Language</dt><dd>{sourceDetails.language.toUpperCase()}</dd></div> : null}
            {sourceDetails?.retrievedAt ? <div><dt>Checked</dt><dd>{publishedDate.format(new Date(sourceDetails.retrievedAt))}</dd></div> : null}
            <div><dt>Format</dt><dd>{sourceDetails?.media ? 'Video report' : 'Article'}</dd></div>
            {sourceDetails?.bodyWordCount ? <div><dt>Reader text</dt><dd>{sourceDetails.bodyWordCount.toLocaleString(browserLocale)} words</dd></div> : null}
            <div><dt>Access</dt><dd>{story.access || 'Free to read'}</dd></div>
            {story.sourceHomepage ? <div><dt>Publisher site</dt><dd><a href={story.sourceHomepage} target="_blank" rel="noreferrer">Visit publisher <ArrowUpRight size={16} /></a></dd></div> : null}
            {story.sourceFeed ? <div><dt>Feed</dt><dd><a href={story.sourceFeed} target="_blank" rel="noreferrer">View source feed <ArrowUpRight size={16} /></a></dd></div> : null}
            <div><dt>Source record</dt><dd><a href={sourceDetails?.canonicalUrl || story.url} target="_blank" rel="noreferrer">Open original URL <ArrowUpRight size={16} /></a></dd></div>
          </dl>
        </section>
        <div className="detail-actions">
          <a href={story.url} target="_blank" rel="noreferrer">{sourceDetails?.media ? 'Watch on publisher' : 'Read the full original'} <ArrowRight size={20} /></a>
          <StoryActions story={story} saved={saved} toggleSaved={toggleSaved} />
        </div>
      </article>
    </div>
  )
}

function Skeleton() {
  return <div className="skeleton" aria-label="Loading live stories"><div /><div /><div /></div>
}

function EditionPicker({ open, edition, locating, message, chooseEdition, detectLocation, close }) {
  if (!open) return null
  return (
    <div className="edition-overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && edition && close()}>
      <section className="edition-dialog" role="dialog" aria-modal="true" aria-labelledby="edition-title">
        {edition ? <button className="edition-close" onClick={close} aria-label="Close country picker"><X size={23} /></button> : null}
        <MapPin className="edition-mark" size={30} aria-hidden="true" />
        <h2 id="edition-title">Choose your local edition</h2>
        <p>Dailyline uses your country only to prioritise relevant reporting. Palestine coverage stays available in every edition.</p>
        {message ? <p className="edition-message" role="status">{message}</p> : null}
        <div className="edition-grid" aria-label="Available country editions">
          {editionOptions.map(option => (
            <button
              key={option.code}
              className={edition?.code === option.code ? 'selected' : ''}
              onClick={() => chooseEdition(option)}
            >
              <span>{option.name}</span>
              {edition?.code === option.code ? <span aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>
        <button className="detect-location" onClick={detectLocation} disabled={locating}>
          <LocateFixed size={19} className={locating ? 'spin' : ''} aria-hidden="true" />
          {locating ? 'Finding your country…' : 'Use my current location'}
        </button>
        <small>Your browser sends the coordinates once to BigDataCloud for country detection. Dailyline does not store them.</small>
      </section>
    </div>
  )
}

function App() {
  const [stories, setStories] = useState([])
  const [sources, setSources] = useState([])
  const [fetchedAt, setFetchedAt] = useState(null)
  const [palestineStories, setPalestineStories] = useState([])
  const [palestineFetchedAt, setPalestineFetchedAt] = useState(null)
  const [liveChannels, setLiveChannels] = useState([])
  const [liveFetchedAt, setLiveFetchedAt] = useState(null)
  const [active, setActive] = useState('All')
  const [blogTopic, setBlogTopic] = useState('All')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [palestineLoading, setPalestineLoading] = useState(true)
  const [liveLoading, setLiveLoading] = useState(true)
  const [error, setError] = useState('')
  const [palestineError, setPalestineError] = useState('')
  const [liveError, setLiveError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedStory, setSelectedStory] = useState(null)
  const [saved, setSaved] = useState(readSaved)
  const [edition, setEdition] = useState(readEdition)
  const [editionPickerOpen, setEditionPickerOpen] = useState(false)
  const [locating, setLocating] = useState(() => !readEdition())
  const [locationMessage, setLocationMessage] = useState('')
  const editionCode = edition?.code || ''

  const chooseEdition = useCallback(option => {
    setLoading(true)
    setEdition(option)
    setEditionPickerOpen(false)
    setLocationMessage('')
    setStories([])
    setSources([])
    setFetchedAt(null)
    setLiveChannels([])
    setLiveFetchedAt(null)
    setLiveLoading(true)
    localStorage.setItem('dailyline-edition-v1', JSON.stringify(option))
  }, [])

  const detectLocation = useCallback(() => {
    setLocating(true)
    setLocationMessage('')
    if (!navigator.geolocation) {
      setLocating(false)
      setLocationMessage('Automatic location is unavailable in this browser. Please choose your country.')
      setEditionPickerOpen(true)
      return
    }
    navigator.geolocation.getCurrentPosition(async position => {
      try {
        const { latitude, longitude } = position.coords
        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&localityLanguage=en`)
        if (!response.ok) throw new Error('Country lookup failed.')
        const location = await response.json()
        const matchedEdition = editionByCode.get(String(location.countryCode || '').toUpperCase())
        if (!matchedEdition) {
          setLocationMessage(`We found ${location.countryName || 'your country'}, but a dedicated live-source edition is not available yet. Please choose the closest edition.`)
          setEditionPickerOpen(true)
          return
        }
        chooseEdition(matchedEdition)
      } catch {
        setLocationMessage('We found your position but could not identify the country. Please choose it below.')
        setEditionPickerOpen(true)
      } finally {
        setLocating(false)
      }
    }, () => {
      setLocating(false)
      setLocationMessage('We could not access your location. Please choose your country below.')
      setEditionPickerOpen(true)
    }, { enableHighAccuracy: false, timeout: 9000, maximumAge: 24 * HOUR_MS })
  }, [chooseEdition])

  const loadFeed = useCallback(async force => {
    if (!editionCode) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ country: editionCode })
      if (force) params.set('refresh', '1')
      const data = await fetchJson(`/api/feed?${params}`)
      setStories(data.items)
      setSources(data.sources)
      setFetchedAt(data.fetchedAt)
    } catch (reason) {
      setError(reason.message)
    } finally {
      setLoading(false)
    }
  }, [editionCode])

  const loadPalestine = useCallback(async force => {
    setPalestineLoading(true)
    setPalestineError('')
    try {
      const data = await fetchJson(`/api/palestine${force ? '?refresh=1' : ''}`)
      setPalestineStories(data.items)
      setPalestineFetchedAt(data.fetchedAt)
    } catch (reason) {
      setPalestineError(reason.message)
    } finally {
      setPalestineLoading(false)
    }
  }, [])

  const loadLive = useCallback(async force => {
    if (!editionCode) return
    setLiveLoading(true)
    setLiveError('')
    try {
      const params = new URLSearchParams({ country: editionCode })
      if (force) params.set('refresh', '1')
      const data = await fetchJson(`/api/live?${params}`, 18_000)
      setLiveChannels(data.items)
      setLiveFetchedAt(data.fetchedAt)
    } catch (reason) {
      setLiveError(reason.message)
    } finally {
      setLiveLoading(false)
    }
  }, [editionCode])

  useEffect(() => { if (!edition) detectLocation() }, [detectLocation, edition])
  useEffect(() => { if (edition) void loadFeed(false) }, [edition, loadFeed])
  useEffect(() => { if (edition) void loadLive(false) }, [edition, loadLive])
  useEffect(() => { void loadPalestine(false) }, [loadPalestine])
  useEffect(() => {
    const hourlyTimer = window.setInterval(() => void loadFeed(false), HOUR_MS)
    const palestineTimer = window.setInterval(() => void loadPalestine(false), HALF_HOUR_MS)
    const liveTimer = window.setInterval(() => void loadLive(false), LIVE_REFRESH_MS)
    return () => { window.clearInterval(hourlyTimer); window.clearInterval(palestineTimer); window.clearInterval(liveTimer) }
  }, [loadFeed, loadLive, loadPalestine])
  useEffect(() => {
    let dailyTimer
    const scheduleDailyEdition = () => {
      dailyTimer = window.setTimeout(() => {
        void Promise.all([edition ? loadFeed(true) : Promise.resolve(), edition ? loadLive(true) : Promise.resolve(), loadPalestine(true)])
        scheduleDailyEdition()
      }, millisecondsUntilTomorrow())
    }
    scheduleDailyEdition()
    return () => window.clearTimeout(dailyTimer)
  }, [edition, loadFeed, loadLive, loadPalestine])
  useEffect(() => localStorage.setItem('dailyline-feed-saved', JSON.stringify(saved)), [saved])

  const visibleStories = useMemo(() => {
    const dataset = active === 'Palestine' ? palestineStories : stories
    const loweredQuery = query.trim().toLowerCase()
    const filtered = dataset.filter(story => {
      const topicMatch = active === 'Blogs'
        ? story.type === 'article' && (blogTopic === 'All' || story.category === blogTopic)
        : active === 'Local'
          ? story.isRegional
          : active === 'Watch'
            ? story.type === 'video'
            : active === 'All' || active === 'Palestine' || story.category === active
      const queryMatch = !loweredQuery || `${story.title} ${story.description} ${story.source}`.toLowerCase().includes(loweredQuery)
      return topicMatch && queryMatch
    })
    return active === 'Local' ? interleaveStoriesBySource(filtered) : filtered
  }, [active, blogTopic, palestineStories, query, stories])

  const toggleSaved = useCallback(id => setSaved(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]), [])
  const closeStory = useCallback(() => setSelectedStory(null), [])
  const openPalestine = useCallback(() => {
    setActive('Palestine')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])
  const refreshAll = useCallback(() => void Promise.all([edition ? loadFeed(true) : Promise.resolve(), edition ? loadLive(true) : Promise.resolve(), loadPalestine(true)]), [edition, loadFeed, loadLive, loadPalestine])
  const activeLabel = topics.find(topic => topic.value === active)?.label || active
  const activeBlogLabel = blogTopics.find(topic => topic.value === blogTopic)?.label || blogTopic
  const healthyCount = sources.filter(source => source.ok).length
  const localHealthyCount = sources.filter(source => source.ok && source.regional).length

  return (
    <>
      <Header active={active} setActive={setActive} blogTopic={blogTopic} setBlogTopic={setBlogTopic} query={query} setQuery={setQuery} refresh={refreshAll} loading={loading || palestineLoading || liveLoading} menuOpen={menuOpen} setMenuOpen={setMenuOpen} edition={edition} locating={locating} openEditionPicker={() => setEditionPickerOpen(true)} />
      <main className="feed-shell" id="top">
        {loading && !stories.length ? <Skeleton /> : null}
        {error && !stories.length ? <section className="error-state"><h1>We couldn’t reach the live sources.</h1><p>{error}</p><button onClick={() => loadFeed(true)}>Try again</button></section> : null}
        {!loading && !error && !visibleStories.length && active !== 'Palestine' && active !== 'Live' ? <section className="error-state"><h1>No matching stories.</h1><p>Try another topic or search.</p></section> : null}
        {!query && active === 'All' && stories.length ? (
          <HomeView stories={stories} palestineStories={palestineStories} palestineFetchedAt={palestineFetchedAt} saved={saved} toggleSaved={toggleSaved} openStory={setSelectedStory} openPalestine={openPalestine} edition={edition} />
        ) : null}
        {active === 'Palestine' ? (
          <PalestineDesk stories={visibleStories} fetchedAt={palestineFetchedAt} loading={palestineLoading} error={palestineError} refresh={() => loadPalestine(true)} openStory={setSelectedStory} />
        ) : null}
        {active === 'Live' ? <LiveDesk channels={liveChannels} fetchedAt={liveFetchedAt} loading={liveLoading} error={liveError} refresh={() => loadLive(true)} edition={edition} /> : null}
        {(query || (active !== 'All' && active !== 'Palestine' && active !== 'Live')) && visibleStories.length ? (
          <TopicView
            title={query ? `Results for “${query}”` : active === 'Local' ? `${edition?.name || 'Local'} news` : active === 'Blogs' ? activeBlogLabel === 'All posts' ? 'Blogs' : `${activeBlogLabel} blogs` : activeLabel}
            stories={visibleStories}
            saved={saved}
            toggleSaved={toggleSaved}
            openStory={setSelectedStory}
            status={query ? `${visibleStories.length} matching reports` : active === 'Local' ? `${localHealthyCount} local sources online` : active === 'Blogs' ? `${visibleStories.length} posts from free sources` : `${healthyCount} sources online`}
          />
        ) : null}
        {fetchedAt ? <footer><p>Current edition complete</p><span>{edition?.name || 'Local'} edition · Last checked {relativeTime(fetchedAt)} · Hourly updates · Palestine every 30 minutes · Free original sources</span></footer> : null}
      </main>
      <EditionPicker open={editionPickerOpen} edition={edition} locating={locating} message={locationMessage} chooseEdition={chooseEdition} detectLocation={detectLocation} close={() => setEditionPickerOpen(false)} />
      {selectedStory ? <StoryDetail story={selectedStory} close={closeStory} saved={saved} toggleSaved={toggleSaved} /> : null}
    </>
  )
}

const rootElement = document.getElementById('root')
const appRoot = import.meta.hot?.data.appRoot || createRoot(rootElement)
if (import.meta.hot) import.meta.hot.data.appRoot = appRoot
appRoot.render(<App />)
