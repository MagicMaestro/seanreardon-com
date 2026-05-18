import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('writing', ({ data }) => data.status === 'published');
  posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: 'Sean Reardon — Lessons Learned',
    description:
      'Short retrospective articles on the lessons I\'ve learned from AI-focused experiments and the technical choices behind rebuilding this AI-integrated site.',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.summary,
      link: `/lessons-learned/${post.slug}/`,
    })),
    customData: '<language>en-us</language>',
    stylesheet: '/rss-styles.xsl',
  });
}
