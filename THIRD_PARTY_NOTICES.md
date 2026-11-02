# Third-party notices

The shipped site contains these third-party components.

## Manrope (font)

Copyright 2018 The Manrope Project Authors (https://github.com/sharanda/manrope).
Licensed under the SIL Open Font License, Version 1.1 — https://openfontlicense.org.
Delivered through the `@fontsource/manrope` package. The app's main face.

## Inter (font)

Copyright 2020 The Inter Project Authors (https://github.com/rsms/inter).
Licensed under the SIL Open Font License, Version 1.1 — https://openfontlicense.org.
Delivered through the `@fontsource/inter` package. Used by the drive-mode stand (`#/drive`).

## Onest (font)

Copyright 2021 The Onest Project Authors (https://github.com/simpals/onest).
Licensed under the SIL Open Font License, Version 1.1 — https://openfontlicense.org.
Delivered through the `@fontsource/onest` package.

Everything else — code, shaders, the scene and its liquid glass, 3D models and
renders, texts, icons — is original work by Nikita Gorbachev and is covered by `LICENSE`.
Build tools (Vite, TypeScript) are not shipped with the site.

## Recorded voice (public/voice)

The reply recordings are generated with Piper (https://github.com/rhasspy/piper, MIT) using
the `ru_RU-dmitri-medium` voice and, in `public/voice/denis`, the `ru_RU-denis-medium` voice (rhasspy/piper-voices, MIT), trained on a CC0 dataset
(https://github.com/OHF-Voice/voice-datasets). Piper itself is not shipped with the site.

## Assistant character (public/grif)

The character renders are made from a squishmoji "pebble" shape
(@usespaceui/squishmoji, https://github.com/usespaceui) — MIT License, Copyright (c) 2026 Space UI.
Recoloured and lit for the assistant; only the rendered WebP images are shipped.

## Bubble cat (#/drive)

The drive-mode stand draws its character live with the squishmoji engine, "cat" shape
(`@usespaceui/squishmoji`, https://github.com/usespaceui/squishmoji) — MIT License, Copyright (c) 2026 Space UI.
The iridescent fill, blinking and voice swell are our own.
