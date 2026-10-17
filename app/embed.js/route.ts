import { NextRequest, NextResponse } from "next/server";

/**
 * Lightweight, zero-dependency embed loader script for WordPress, Webflow, Squarespace, etc.
 * Usage:
 * <script src="https://your-domain.com/embed.js" data-salon="atelier-lumiere" data-mode="inline" async></script>
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  const script = `(function() {
  if (window.__SILENT_SALON_LOADED__) return;
  window.__SILENT_SALON_LOADED__ = true;

  var currentScript = document.currentScript || document.querySelector('script[data-salon]');
  var salonSlug = (currentScript && currentScript.getAttribute('data-salon')) || 'atelier-lumiere';
  var mode = (currentScript && currentScript.getAttribute('data-mode')) || 'inline';
  var targetId = (currentScript && currentScript.getAttribute('data-target')) || 'silent-salon-widget';
  var brandColor = (currentScript && currentScript.getAttribute('data-color')) || '#9A6B4C';
  var widgetUrl = '${origin}/embed/' + encodeURIComponent(salonSlug) + '?embedded=1';

  function createIsolatedIframe() {
    var iframe = document.createElement('iframe');
    iframe.src = widgetUrl;
    iframe.title = 'Online Terminbuchung – ' + salonSlug;
    iframe.allow = 'payment *';
    iframe.style.cssText = 'width:100%;min-height:680px;border:0;border-radius:20px;background:transparent;display:block;transition:height 0.2s ease;';
    return iframe;
  }

  window.addEventListener('message', function(e) {
    if (!e.data || e.data.source !== 'silent-salon-widget') return;
    var iframes = document.querySelectorAll('iframe[src*="/embed/"]');
    if (e.data.type === 'RESIZE' && typeof e.data.height === 'number') {
      for (var i = 0; i < iframes.length; i++) {
        iframes[i].style.height = Math.max(580, e.data.height) + 'px';
      }
    }
  });

  if (mode === 'floating') {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.innerText = 'Termin online buchen';
    btn.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483640;background:' + brandColor + ';color:#fff;border:0;border-radius:999px;padding:14px 24px;font-family:system-ui,-apple-system,sans-serif;font-size:15px;font-weight:600;box-shadow:0 12px 32px rgba(0,0,0,0.22);cursor:pointer;';
    document.body.appendChild(btn);
  } else {
    var container = document.getElementById(targetId);
    if (!container && currentScript && currentScript.parentNode) {
      container = document.createElement('div');
      container.id = targetId;
      currentScript.parentNode.insertBefore(container, currentScript.nextSibling);
    }
    if (container) {
      var shadow = container.attachShadow ? container.attachShadow({ mode: 'open' }) : container;
      shadow.appendChild(createIsolatedIframe());
    }
  }
})();`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
