'use strict';
// Shared CSS for the guide, slides and video. Brand samples use only the token variables;
// the guide's own art direction is derived from the same tokens.

const SLOTS = ['hero', 'horizon', 'object', 'street', 'sky', 'glass', 'grid', 'tokens', 'subject'];

// Gradient fallbacks, composed from the colour tokens so they follow the brand.
const FALLBACK = {
  hero: 'radial-gradient(120% 90% at 15% 20%, color-mix(in oklab, var(--color-action) 85%, white) 0%, transparent 55%), radial-gradient(90% 80% at 85% 80%, color-mix(in oklab, var(--color-accent) 70%, var(--color-surface-inverse)) 0%, transparent 60%), var(--gradient-brand)',
  horizon: 'linear-gradient(180deg, color-mix(in oklab, var(--color-surface-inverse) 92%, var(--color-action)) 0%, color-mix(in oklab, var(--color-action) 55%, var(--color-surface-inverse)) 62%, color-mix(in oklab, var(--color-action) 70%, white) 100%)',
  object: 'radial-gradient(45% 45% at 50% 52%, color-mix(in oklab, var(--color-action) 90%, white) 0%, var(--color-action) 38%, transparent 39%), radial-gradient(70% 60% at 50% 85%, color-mix(in oklab, var(--color-surface-inverse) 70%, black) 0%, transparent 70%), linear-gradient(160deg, color-mix(in oklab, var(--color-surface-inverse) 80%, white), var(--color-surface-inverse))',
  street: 'linear-gradient(115deg, color-mix(in oklab, var(--color-accent) 35%, var(--color-surface)) 0%, color-mix(in oklab, var(--color-action) 25%, var(--color-surface)) 55%, color-mix(in oklab, var(--color-surface-inverse) 40%, var(--color-surface)) 100%)',
  sky: 'linear-gradient(180deg, color-mix(in oklab, var(--color-surface) 70%, var(--color-accent)) 0%, var(--color-surface) 70%, var(--color-background) 100%)',
  glass: 'repeating-linear-gradient(90deg, color-mix(in oklab, var(--color-surface-inverse) 85%, white) 0 2px, transparent 2px 64px), linear-gradient(135deg, var(--color-surface-inverse), color-mix(in oklab, var(--color-action) 45%, var(--color-surface-inverse)))',
  grid: 'repeating-linear-gradient(0deg, color-mix(in oklab, var(--color-border) 80%, transparent) 0 1px, transparent 1px 48px), repeating-linear-gradient(90deg, color-mix(in oklab, var(--color-border) 80%, transparent) 0 1px, transparent 1px 48px), var(--color-surface)',
  tokens: 'conic-gradient(from 210deg at 70% 40%, var(--color-action), var(--color-accent), var(--color-action-alt), var(--color-surface-inverse), var(--color-action))',
  subject: 'linear-gradient(200deg, color-mix(in oklab, var(--color-surface) 60%, white) 0%, color-mix(in oklab, var(--color-action) 18%, var(--color-surface)) 60%, color-mix(in oklab, var(--color-surface-inverse) 30%, var(--color-surface)) 100%)',
};

function imageCss(manifest) {
  return SLOTS.map((s) => {
    const m = manifest && manifest[s];
    if (m && m.dataUri) return `.img-${s}{background-image:url(${m.dataUri});background-color:var(--color-surface-inverse)}`;
    return `.img-${s}{background-image:${FALLBACK[s]}}`;
  }).join('\n');
}

function baseCss(tokensCss, manifest) {
  return `${tokensCss}
:root{--ground-light:var(--color-background);--ground-dark:var(--color-surface-inverse);--ink-light:var(--color-text);--ink-dark:var(--color-text-inverse);--gutter-x:clamp(16px,4vw,var(--space-base) * 6)}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--color-background);color:var(--color-text);font-family:var(--font-body);font-size:var(--type-body-size);line-height:var(--type-body-leading);letter-spacing:var(--type-body-tracking);overflow-x:hidden}
h1,h2,h3,h4,p{margin:0}
a{color:inherit}
.t-display{font-family:var(--type-display-family);font-size:var(--type-display-size);font-weight:var(--type-display-weight);line-height:var(--type-display-leading);letter-spacing:var(--type-display-tracking)}
.t-h1{font-family:var(--type-h1-family);font-size:var(--type-h1-size);font-weight:var(--type-h1-weight);line-height:var(--type-h1-leading);letter-spacing:var(--type-h1-tracking)}
.t-h2{font-family:var(--type-h2-family);font-size:var(--type-h2-size);font-weight:var(--type-h2-weight);line-height:var(--type-h2-leading);letter-spacing:var(--type-h2-tracking)}
.t-h3{font-family:var(--type-h3-family);font-size:var(--type-h3-size);font-weight:var(--type-h3-weight);line-height:var(--type-h3-leading);letter-spacing:var(--type-h3-tracking)}
.t-h4{font-family:var(--type-h4-family);font-size:var(--type-h4-size);font-weight:var(--type-h4-weight);line-height:var(--type-h4-leading);letter-spacing:var(--type-h4-tracking)}
.t-lead{font-family:var(--type-lead-family);font-size:var(--type-lead-size);font-weight:var(--type-lead-weight);line-height:var(--type-lead-leading);letter-spacing:var(--type-lead-tracking)}
.t-body{font-family:var(--type-body-family);font-size:var(--type-body-size);font-weight:var(--type-body-weight);line-height:var(--type-body-leading);letter-spacing:var(--type-body-tracking)}
.t-small{font-family:var(--type-small-family);font-size:var(--type-small-size);font-weight:var(--type-small-weight);line-height:var(--type-small-leading);letter-spacing:var(--type-small-tracking)}
.rb-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5em;min-height:var(--button-height);padding:var(--button-pad-y) var(--button-pad-x);border-radius:var(--radius-button);border:var(--button-border-width) solid var(--button-primary-border);background:var(--button-primary-bg);color:var(--button-primary-fg);font-family:var(--font-body);font-size:var(--button-font-size);font-weight:var(--button-font-weight);letter-spacing:var(--button-tracking);line-height:1;text-decoration:none;cursor:pointer;white-space:nowrap;transition:transform var(--motion-duration) var(--motion-ease),filter var(--motion-duration) var(--motion-ease),background-color var(--motion-duration) var(--motion-ease)}
.rb-btn:hover{filter:brightness(1.06)}.rb-btn:active{transform:scale(.98)}
.rb-btn:focus-visible{outline:2px solid var(--color-accent);outline-offset:3px}
.rb-btn--secondary{background:var(--button-secondary-bg);color:var(--button-secondary-fg);border-color:var(--button-secondary-border)}
.rb-btn--outline{background:var(--button-outline-bg);color:var(--button-outline-fg);border-color:var(--button-outline-border)}
.rb-btn--translucent{background:var(--button-translucent-bg);color:var(--button-translucent-fg);border-color:var(--button-translucent-border);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.on-dark .rb-btn--outline{color:var(--color-text-inverse);border-color:var(--color-text-inverse)}
.rb-card{background:var(--card-bg);border-radius:var(--card-radius);padding:var(--card-padding);box-shadow:var(--card-shadow);color:var(--color-text);overflow:hidden}
.rb-card__media{aspect-ratio:16/10;border-radius:calc(var(--card-radius) - var(--card-padding) / 2);background-size:cover;background-position:center;margin-bottom:var(--space-2,16px);position:relative;overflow:hidden}
.rb-glass{background:var(--card-glass);-webkit-backdrop-filter:var(--card-backdrop);backdrop-filter:var(--card-backdrop);border:1px solid rgb(255 255 255 / .28);border-radius:var(--card-radius);color:var(--color-text-inverse)}
.rb-input{display:block;width:100%;height:var(--input-height);padding:0 var(--input-pad-x);border-radius:var(--radius-input);border:var(--input-border-width) solid var(--input-border);background:var(--input-bg);color:var(--color-text);font-family:var(--font-body);font-size:var(--input-font-size)}
.img{background-size:cover;background-position:center;background-repeat:no-repeat}
${imageCss(manifest)}
.ai-label{position:absolute;left:12px;bottom:12px;z-index:3;font:600 11px/1 var(--font-body);letter-spacing:.02em;padding:6px 9px;border-radius:999px;background:rgb(0 0 0 / .55);color:#fff;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.unofficial{display:inline-flex;align-items:center;gap:6px;font:600 12px/1 var(--font-body);letter-spacing:.04em;text-transform:uppercase;padding:7px 12px;border-radius:999px;border:1px dashed currentColor;white-space:nowrap}
.unofficial::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--color-action)}
`;
}

module.exports = { SLOTS, FALLBACK, baseCss, imageCss };
