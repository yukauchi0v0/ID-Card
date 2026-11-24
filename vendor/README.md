# Vendored runtime

## fflate 0.8.2

- Source: https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js
- Project: https://github.com/101arrowz/fflate
- License: MIT

Used only by the studio page to build the downloadable static card package.
It exposes `window.fflate` and is loaded before `js/studio/main.js`.

## qrcode-generator 1.4.4

- Source: https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js
- Project: https://github.com/kazuhikoarase/qrcode-generator
- License: MIT

Used only by the studio share panel to render and download the viewer QR code.
It exposes `window.qrcode` and is loaded before `js/studio/main.js`.

## supabase-js 2.119.2

- Source: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2/dist/umd/supabase.js
- Project: https://github.com/supabase/supabase-js
- License: MIT

Used by the studio page for cloud sign-in, saving the draft and publishing.
It exposes `window.supabase.createClient` and is loaded before `js/studio/main.js`.

