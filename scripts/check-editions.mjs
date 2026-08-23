import { collectFeed, collectLive, collectPalestine } from '../server.mjs'

const editions = ['AU', 'NZ', 'US', 'CA', 'GB', 'IE', 'IN', 'PK', 'SG', 'GLOBAL']
const failures = []

for (const code of editions) {
  try {
    const [feed, live] = await Promise.all([collectFeed(code, true), collectLive(code, true)])
    const localStories = feed.items.filter(item => item.isRegional)
    const localSources = [...new Set(localStories.map(item => item.source))]
    const failedLocalSources = feed.sources.filter(source => source.regional && !source.ok).map(source => source.name)
    const liveSources = live.items.filter(channel => channel.liveNow).map(channel => channel.name)
    console.log(`${code.padEnd(6)} ${String(feed.items.length).padStart(3)} stories | ${String(localStories.length).padStart(2)} local | live now: ${liveSources.join(', ') || 'none'} | ${localSources.join(', ') || 'global edition'}${failedLocalSources.length ? ` | unavailable: ${failedLocalSources.join(', ')}` : ''}`)
    if (code !== 'GLOBAL' && !localStories.length) failures.push(`${code} returned no local stories`)
    if (!live.items.some(channel => channel.name === 'Al Jazeera English')) failures.push(`${code} live desk is missing Al Jazeera English`)
    if (code !== 'GLOBAL' && !live.items.some(channel => !channel.global)) failures.push(`${code} live desk has no regional broadcaster`)
  } catch (error) {
    failures.push(`${code}: ${error.message}`)
  }
}

try {
  const palestine = await collectPalestine(true)
  console.log(`PS      ${String(palestine.items.length).padStart(2)} Palestine reports | ${palestine.sources.filter(source => source.ok).map(source => source.name).join(', ')}`)
  if (!palestine.items.length) failures.push('Palestine returned no reports')
} catch (error) {
  failures.push(`Palestine: ${error.message}`)
}

if (failures.length) {
  console.error(`\nEdition check failed:\n- ${failures.join('\n- ')}`)
  process.exitCode = 1
} else {
  console.log('\nEvery listed edition has verified live coverage.')
}
