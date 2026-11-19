# bot

The GitHoney GitHub App. GitHub delivers webhooks to `POST /webhooks`, where
each delivery's `X-Hub-Signature-256` is checked against
`GITHUB_WEBHOOK_SECRET` before any handler runs; a mismatch gets a 400.

## Development

```sh
npm install
npm run dev   # tsx watch src/index.ts, port 3001 by default
npm test      # node --test through tsx
```

The bot reads its settings from the environment (or a `.env` file); see
`src/config/app-config.ts`. GitHub cannot reach a laptop, so for local work
create a [smee.io](https://smee.io) channel, set it as the App's webhook URL
and set `WEBHOOK_PROXY_URL` to it: the bot then also reads deliveries from
that channel. `WEBHOOK_PROXY_URL` is for local development only; deployed
bots leave it unset and receive webhooks directly.

## Helm chart

`k8s/chart/` installs the bot as one Deployment (one replica) and a ClusterIP
Service on port 3001, with an optional Ingress that exposes only the exact
path `/webhooks`. The chart assumes no instance: the values below are empty
by default and the chart refuses to render without them.

| Value | Meaning |
|---|---|
| `image.tag`, `image.digest` | The image `ghcr.io/githoney-io/bot`, rendered as `repository:tag@digest`. CI tags each build `sha-<short commit>`. |
| `githubAppId` | The GitHub App's ID. |
| `backendUrl`, `frontendUrl`, `twBotUrl` | The GitHoney backend, the public website and the tw-bot API. |
| `existingSecret` | A Secret whose keys become environment variables: `GITHUB_WEBHOOK_SECRET`, `BACKEND_API_KEY`, `TW_SECRET_KEY`, `API_KEY` and `SOURCE`. |
| `privateKeySecretKey` | The key of that Secret holding the App's PEM private key (default `github-app.pem`). It is mounted as a file and `GITHUB_PRIVATE_KEY_PATH` points at it. |
| `env` | Extra plain environment variables. |
| `ingress.*` | `enabled`, `className`, `clusterIssuer`, `host`, `tlsSecretName` and `annotations`; `path` defaults to `/webhooks`. |

`resources`, `nodeSelector` and `tolerations` take the usual Kubernetes
shapes. To check a change to the chart:

```sh
helm lint k8s/chart -f k8s/chart/ci/test-values.yaml
helm template bot k8s/chart -f k8s/chart/ci/test-values.yaml
```

Once installed with the Ingress, set `https://<host>/webhooks` as the GitHub
App's webhook URL and send a ping from the App's settings.
