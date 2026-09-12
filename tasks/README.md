# Asky build tasks

Work from `tasks/00-contract.md` plus one owned task file. Do not invent features from the market scan. Product source of truth: `docs/self-host-product-requirements.md`.

| File | Owner writes | Depends on contract |
| --- | --- | --- |
| `01-scaffold.md` | tool config, `src/index.ts` router | yes |
| `02-data-security.md` | D1 schema, db + auth + rate-limit modules | yes |
| `03-public.md` | public pages + ask + permalink | yes |
| `04-admin.md` | hidden admin | yes |
| `05-og-ui-docs.md` | OG PNG, CSS, README | yes |

Rules:

- Write **only** the files listed as owned in your task. Do not "helpfully" edit another agent's files.
- If you need a symbol from another task, import it using the exact signature in the contract. If that file is not on disk yet, still import it.
- Keep it small. No frameworks beyond what the contract names. No Pages, Durable Objects, R2, KV, Queues, Workers AI.
- Do not commit, push, or deploy to a remote Cloudflare account.
