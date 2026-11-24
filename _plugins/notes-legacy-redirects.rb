# Notes used to live at /notes/:year/:title/ and now live at /notes/:title/ (see `permalink` in _config.yml).
# This generator writes a small redirect page at every note's old URL, so existing links keep working.
module Jekyll
  class NotesLegacyRedirectPage < Page
    def initialize(site, old_dir, target_url, hidden)
      @site = site
      @base = site.source
      @dir = old_dir
      @name = "index.html"
      process(@name)
      self.data = { "layout" => nil, "sitemap" => false }
      target = site.baseurl.to_s + target_url
      robots = hidden ? "noindex, nofollow" : "noindex"
      self.content = <<~HTML
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <title>Redirecting…</title>
            <link rel="canonical" href="#{site.config['url']}#{target}">
            <meta name="robots" content="#{robots}">
            <meta http-equiv="refresh" content="0; url=#{target}">
            <script>location.replace(#{target.to_json} + location.search + location.hash);</script>
          </head>
          <body>
            <p>This note has moved to <a href="#{target}">#{target}</a>.</p>
          </body>
        </html>
      HTML
    end
  end

  class NotesLegacyRedirects < Generator
    safe true
    priority :lowest

    def generate(site)
      site.posts.docs.each do |post|
        next if post.data["published"] == false
        old_dir = "/notes/#{post.date.strftime('%Y')}/#{post.data['slug']}/"
        next if old_dir == post.url
        site.pages << NotesLegacyRedirectPage.new(site, old_dir, post.url, post.data["hidden"])
      end
    end
  end
end
