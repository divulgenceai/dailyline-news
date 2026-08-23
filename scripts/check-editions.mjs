import { collectFeed, collectPalestine } from '../server.mjs'

const editions = ['AU', 'NZ', 'US', 'CA', 'GB', 'IE', 'IN', 'PK', 'SG', 'GLOBAL']
const failures = []

for (const code of editions) {
  try {
    const feed = await collectFeed(code, true)
    const localStories = feed.items.filter(item => item.isRegional)
    const localSources = [...new Set(localStories.map(item => item.source))]
    const failedLocalSources = feed.sources.filter(source => source.regional && !source.ok).map(source => source.name)
    console.log(`${code.padEnd(6)} ${String(feed.items.length).padStart(2)} stories | ${String(localStories.length).padStart(2)} local | ${localSources.join(', ') || 'global edition'}${failedLocalSources.length ? ` | unavailable: ${failedLocalSources.join(', ')}` : ''}`)
    if (code !== 'GLOBAL' && !localStories.length) failures.push(`${code} returned no local stories`)
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
