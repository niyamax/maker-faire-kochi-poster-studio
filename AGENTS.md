# Production editor scope

`main` is the production poster editor. Keep it free of the held 3D and poster experiments.

Those experiments are checkpointed on the local-only branch `codex/3d-poster-experiments`, in the sibling checkout `../maker-faire-kochi-3d-lab`. Do not merge that branch, stage its files here, or copy its generated output into this checkout without explicit user approval. Do not publish the experimental branch while it is on hold.

Production builds must use `npm run build`. The production scope guard rejects experimental source paths and bundles, and each production build starts with an empty `dist`. Keep these guards enabled. Install the local main-push guard with `npm run protect:main` when setting up another checkout.

Use port 8800 for this editor and 8820 for the isolated experiment preview. Keep each checkout’s dependencies and generated output separate.
