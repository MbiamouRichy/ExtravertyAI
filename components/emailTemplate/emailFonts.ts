// Same families as app/layout.tsx and app/globals.css: Bricolage Grotesque for
// headings and the wordmark, Roboto Mono for body text. Clients that block web
// fonts (Gmail, Outlook desktop) fall back to the site's own fallback stacks.
export const EMAIL_HEADING_FONT =
  "'Bricolage Grotesque','Arial Narrow','Helvetica Neue',Arial,sans-serif";
export const EMAIL_BODY_FONT =
  "'Roboto Mono','Cascadia Mono','SFMono-Regular',Consolas,'Liberation Mono',monospace";
export const EMAIL_FONT_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&amp;family=Roboto+Mono:wght@400;500;700&amp;display=swap" rel="stylesheet">`;
export const EMAIL_FONT_CSS = `body,table,td,p,a,span,li{font-family:${EMAIL_BODY_FONT}}h1,h2,.heading{font-family:${EMAIL_HEADING_FONT}!important}`;
