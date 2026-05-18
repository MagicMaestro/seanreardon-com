import { defineCollection, z } from 'astro:content';

const writing = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    tags: z.array(z.string()).optional(),
    project: z.string().optional(),  // optional link to a /projects/<slug> entry
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
    mainImg: z.string().optional(),         // CF Images URL — set once the image is uploaded
    otherImg: z.string().optional(),        // CF Images URL — secondary image
    legacyMainImg: z.string().optional(),   // original filename in old public_html/projectImages/ — TODO marker until uploaded to CF Images
    legacyOtherImg: z.string().optional(),
    projLanguage: z.array(z.string()).optional(),
    featured: z.boolean().default(false),
    active: z.boolean().default(true),
    legacyProjID: z.number().optional(),    // original projID from MariaDB sreardon_seanreardon.projects
  }),
});

export const collections = { writing, work };
