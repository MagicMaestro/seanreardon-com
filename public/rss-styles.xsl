<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" doctype-system="about:legacy-compat" indent="yes" encoding="UTF-8"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title><xsl:value-of select="/rss/channel/title"/> — RSS feed</title>
        <meta name="robots" content="noindex"/>
        <style>
          :root {
            --color-bg: #0d1117;
            --color-fg: #f0f6fc;
            --color-muted: #8b949e;
            --color-accent: #d4a017;
            --color-accent-hot: #b8860b;
            --space-sm: 1rem;
            --space-md: 1.5rem;
            --space-lg: 2.5rem;
            --radius: 0.375rem;
          }
          * { box-sizing: border-box; }
          html { background: var(--color-bg); color: var(--color-fg); }
          body {
            margin: 0;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.6;
          }
          .wrap {
            max-width: 60rem;
            margin: 0 auto;
            padding: var(--space-lg) var(--space-md);
          }
          a { color: var(--color-accent); text-decoration: underline; text-underline-offset: 0.2em; }
          a:hover { color: var(--color-accent-hot); }
          h1 { font-size: 2rem; font-weight: 600; margin: 0 0 var(--space-sm); }
          h2 { font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem; }
          .lead {
            color: var(--color-muted);
            margin: 0 0 var(--space-md);
            max-width: 50rem;
          }
          .feed-info {
            background: rgba(212, 160, 23, 0.08);
            border: 1px solid rgba(212, 160, 23, 0.3);
            border-radius: var(--radius);
            padding: var(--space-md);
            margin-bottom: var(--space-lg);
          }
          .feed-info p { margin: 0 0 0.5rem; }
          .feed-info p:last-child { margin-bottom: 0; }
          .feed-info code {
            font-family: ui-monospace, 'Cascadia Code', 'JetBrains Mono', Menlo, monospace;
            background: rgba(255,255,255,0.06);
            padding: 0.1em 0.4em;
            border-radius: 0.2em;
            font-size: 0.9em;
          }
          .item {
            border-top: 1px solid rgba(255,255,255,0.08);
            padding: var(--space-md) 0;
          }
          .item:last-child { border-bottom: 1px solid rgba(255,255,255,0.08); }
          .item-meta {
            color: var(--color-muted);
            font-size: 0.875rem;
            margin: 0 0 0.5rem;
          }
          .item-desc { margin: 0; max-width: 50rem; }
          .home-link {
            display: inline-block;
            margin-top: var(--space-lg);
            color: var(--color-muted);
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1><xsl:value-of select="/rss/channel/title"/></h1>
          <p class="lead"><xsl:value-of select="/rss/channel/description"/></p>

          <div class="feed-info">
            <p><strong>This is an RSS feed.</strong> RSS lets you subscribe to a site's writing in a feed reader and get new posts as they're published — no email signup, no algorithm, no ads.</p>
            <p>To subscribe, copy the URL of this page (<code><xsl:value-of select="/rss/channel/link"/>rss.xml</code>) and paste it into a feed reader like <a href="https://feedly.com/">Feedly</a>, <a href="https://netnewswire.com/">NetNewsWire</a>, or <a href="https://www.inoreader.com/">Inoreader</a>.</p>
          </div>

          <h2>Recent posts</h2>
          <xsl:for-each select="/rss/channel/item">
            <div class="item">
              <h2>
                <a>
                  <xsl:attribute name="href"><xsl:value-of select="link"/></xsl:attribute>
                  <xsl:value-of select="title"/>
                </a>
              </h2>
              <p class="item-meta">
                <xsl:value-of select="pubDate"/>
              </p>
              <p class="item-desc"><xsl:value-of select="description"/></p>
            </div>
          </xsl:for-each>

          <a class="home-link">
            <xsl:attribute name="href"><xsl:value-of select="/rss/channel/link"/></xsl:attribute>
            ← Back to <xsl:value-of select="/rss/channel/link"/>
          </a>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
