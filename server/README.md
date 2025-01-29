# whirld-server

```bash
bun install  # Install dependencies
yarn dev     # Run server
```

This project was created using `bun init` in bun v1.2.1. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

# POST /api/scramble
## Client:
```json
{
    "lang": "en",  ISO-639 language code
    "text": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc quis vulputate leo, ac porttitor ex. Phasellus dignissim diam ac nulla aliquet dictum. Donec scelerisque, lectus sit amet pellentesque porta, nunc leo blandit felis, ut imperdiet nunc risus vitae nulla. Pellentesque feugiat vitae nisi ac pretium. Ut in dapibus arcu, ac hendrerit metus. Nulla tempus neque ultrices nulla laoreet facilisis. Donec id mi mattis, tincidunt diam non, molestie nisl. Vivamus bibendum libero ex, a tempor sapien vulputate laoreet. Nullam nisi mauris, ullamcorper et eleifend et, placerat sit amet libero.",
    "times": 100   Number of translations
}
```

## Server:
I Have Not Written This Part Yet