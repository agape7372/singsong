# Static OG asset

The handler serves the already approved repository asset at
`public/og/ticket-1200x630.png`. Keep the Vercel project rooted at the repository
root so that file is included in the function trace. The production preflight
fails if the PNG signature is missing.
