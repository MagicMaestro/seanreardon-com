import { defineCollection, z } from 'astro:content';

const writing = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    tags: z.array(z.string()).optional(),
    project: z.string().optional(),  // optional link to a /work/<slug> entry
    status: z.enum(['draft', 'published']).default('draft'),
  }),
});

const work = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    completed: z.coerce.date(),
    sh_desc: z.string(),                    // short description (card subtitle)
    projLink: z.string().url().optional(),  // external URL to live project
    mainImg: z.string().optional(),         // main image filename in /public/work/
    otherImg: z.string().optional(),
    projObjective: z.string().optional(),
    projLanguage: z.array(z.string()).optional(),
    featured: z.boolean().default(false),
    active: z.boolean().default(true),
    legacyProjID: z.number().optional(),    // original projID from MariaDB sreardon_seanreardon.projects
  }),
});

export const collections = { writing, work };
