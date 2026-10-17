# UI sources

OfficeFlow's shared styles and components adapt the following sources. Layout,
palette, accessibility behavior, and product integration are specific to OfficeFlow.

- [Hairline](https://github.com/lucasmarkes/hairline), Lucas Marques, MIT.
  `@lucasmarkes/hairline` 0.5.1 is a runtime dependency. Its license is distributed
  with the package. Hub, Drawer, Loupe, and Cabinet figures are used as optional,
  lazy-loaded illustrations, with no autoplay and a reduced-motion fallback.
- [Recharts](https://github.com/recharts/recharts), Recharts Group, MIT.
  The admin dashboard uses the official React chart library. Its license is
  distributed with the installed package. Chart composition and layout reference
  the [shadcn/ui chart documentation](https://ui.shadcn.com/docs/components/radix/chart);
  OfficeFlow's chart components are authored for its own report contracts and theme.
- [Impeccable](https://github.com/pbakaus/impeccable), Apache-2.0.
  Its Operate, Polish, and Craft Floor playbooks informed the UI audit and design
  work. It is a design tool, not a runtime dependency. Its context launcher was
  unavailable locally; the playbooks were read directly from the source checkout.
- [Uiverse theme switch by alexruix](https://uiverse.io/alexruix/splendid-liger-23), MIT.
  The sun/moon slider idea is adapted in `theme-toggle.tsx` and `globals.css`.
  OfficeFlow uses a labeled, keyboard-operable button with switch semantics,
  system-theme detection, persistence, and cross-tab updates.
- [Uiverse loader by barisdogansutcu](https://uiverse.io/barisdogansutcu/light-rat-32), MIT.
  Its rotating SVG circle and dash animation are adapted in `loader.tsx` and
  `globals.css`, using currentColor and reduced-motion support.
- [Uiverse checkboxes](https://uiverse.io/checkboxes) informed the restrained
  checked-state feedback. OfficeFlow's native checkbox styling is authored locally.

## MIT notice for the adapted Uiverse elements

Copyright (c) 2026 Alex Ruiz (alexruix)

Copyright (c) 2026 Barış Doğan Sütçü (barisdogansutcu)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
