# Tmplet

A compact, high-performance and full-featured template engine. References and
thanks [doT](https://github.com/olado/doT),
[EasyTemplateJS](https://github.com/ushelp/EasyTemplateJS).

## Imports

```
npm i tmplet

// CommonJS
const tmplet = require("tmplet");
const { init, compile, render, view } = require("tmplet");

// ES Module
import * as tmplet from "tmplet";
import { init, compile, render, view } from "tmplet";

// Deno
import * as tmplet from "https://esm.sh/tmplet/tmplet.ts";
import { init, compile, render, view } from "https://esm.sh/tmplet/tmplet.ts";
```

## Syntax

- `{{ }}` Evaluate code snippet in javascript end with a semicolon, note that
  variables do not need to be declared. ex. `{{ result = 60*60; }}`

- `{{= }}` Interpolation. ex. `{{= username }}`

- `{{? }} {{?? }} {{? }}` Conditional statement. ex.

```
{{? gender == 0 }}
  <div>Female</div>
{{?? gender == 1 }}
  <div>Male</div>
{{?? }}
  <div>Unknown</div>
{{? }}
```

- `{{~ }} {{~ }}` Iterative statement. ex.

```
<ul>
{{~ users:user:index }}
  <li>{{= index+1 }} - {{= user.name }}<li>
{{~ }}
</ul>
```

- `{{> }}` Block placeholder.
- `{{< }}` Block content definition.

```
{{> content }}

{{< content }}
  <h1>Hello tmplet.</h1>
{{< }}
```

- `{{@ }}` Partial including in layout mode. You must be rendered by
  `view(file, data)` method.

```
// index.html
{{@ header.html }}

// header.html
<h1>Hello tmplet.</h1>
```

## Reserved

- `{{! }}`
- `{{# }}`
- `{{$ }}`
- `{{% }}`
- `{{^ }}`
- `{{& }}`
- `{{+ }}`
- `{{- }}`
- `{{* }}`

## Methods

- `init(options)` Initialize custom options（not necessary).

```
init({
  root: "template", // relative to the project root, default ""
  imports: { // Custom global properties or functions, default {}
    name: "",
    calc: () => {}
  }
})
```

- `compile(tmpl)` Compile the specify template text to a function.
- `render(tmpl, data)` Compile and render the template with data.
- `view(file, data)` Render the template file with data (using cache).
