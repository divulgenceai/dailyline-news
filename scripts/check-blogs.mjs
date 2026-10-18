import { collectBlogs } from '../server.mjs'

const topics = ['All', 'Palestine', 'Tech', 'Gaming', 'World', 'Culture', 'History']
const deploymentUrl = process.argv[2]?.replace(/\/$/, '')
const failures = []

for (const topic of topics) {
  try {
    const data = deploymentUrl
      ? await (async () => {
          const response = await fetch(`${deploymentUrl}/api/blogs?country=AU&topic=${encodeURIComponent(topic)}`)
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          return response.json()
        })()
      : await collectBlogs('AU', topic)
    const incomplete = data.items.filter(story =>
      !story.sourceDetails?.body?.length ||
      story.sourceDetails.bodyWordCount < 180 ||
      story.sourceDetails.accessRestricted ||
      /\/live\//i.test(story.url),
    )
    console.log(`${topic.padEnd(10)} ${String(data.items.length).padStart(2)} readable articles | ${data.checkedCount} checked | ${[...new Set(data.items.map(story => story.source))].join(', ') || 'none'}`)
    if (!data.items.length) failures.push(`${topic} has no readable articles`)
    if (incomplete.length) failures.push(`${topic} includes ${incomplete.length} incomplete or restricted articles`)
  } catch (error) {
    failures.push(`${topic}: ${error.message}`)
  }
}

if (failures.length) {
  console.error(`\nBlog check failed:\n- ${failures.join('\n- ')}`)
  process.exitCode = 1
} else {
  console.log('\nEvery blog topic has public reader text.')
}
