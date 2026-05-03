import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('writing', ({ data }) => data.status === 'published');
  posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: 'Sean Reardon — writing',
    description:
      'Retrospective posts on shipped milestones, technical decisions, and AI-integration experiments by Sean Reardon.',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.summary,
      link: `/writing/${post.slug}/`,
    })),
    customData: '<language>en-us</language>',
    stylesheet: '/rss-styles.xsl',
  });
}
