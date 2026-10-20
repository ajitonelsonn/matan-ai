# Run MATAN AI yourself

Everything here is reproducible with your own AWS account and a free Ring Developer Playground session. Demo Mode needs only Cognito, so you can see the whole product before wiring any AI or Ring service.

**Prerequisites:** Node 22, pnpm 10, an AWS account (region `us-east-1` by default), and — for Real Mode — a [Ring Developer Playground](https://developer.ring.com) login.

## 1. Clone and install

```bash
git clone https://github.com/ajitonelsonn/matan-ai.git
cd matan-ai
pnpm install
cp .env.example .env
```

## 2. AWS credentials for local development

Create an IAM user (or SSO profile) for local work only — production uses a role, never keys. Minimum policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["bedrock:InvokeModel"], "Resource": "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-pro-v1:0" },
    { "Effect": "Allow", "Action": ["dynamodb:GetItem","dynamodb:PutItem","dynamodb:UpdateItem","dynamodb:DeleteItem","dynamodb:Query"], "Resource": "arn:aws:dynamodb:us-east-1:<account-id>:table/MatanAI" },
    { "Effect": "Allow", "Action": ["s3:GetObject","s3:PutObject","s3:DeleteObject"], "Resource": "arn:aws:s3:::<your-bucket>/*" },
    { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::<your-bucket>" },
    { "Effect": "Allow", "Action": ["ses:SendEmail","ses:SendRawEmail"], "Resource": ["arn:aws:ses:us-east-1:<account-id>:identity/<your-domain>","arn:aws:ses:us-east-1:<account-id>:configuration-set/matan-ai"] }
  ]
}
```

Put `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_REGION=us-east-1` in `.env`. Never commit it — `.env` is git-ignored.

## 3. Provision the resources

| Step | Command | Creates |
| --- | --- | --- |
| Identity | `pnpm cognito:provision` | User pool + app client, writes the `NEXT_PUBLIC_COGNITO_*` values into `.env` |
| Database | `pnpm dynamodb:check` | Verifies the `MatanAI` table (PK/SK string keys, on-demand) |
| Media | `pnpm s3:provision` | Private bucket with Block Public Access and SSE-S3, writes `S3_MEDIA_BUCKET` |
| Email | `pnpm ses:check` | Reports the verified identity and configuration set |
| Model access | AWS console → Bedrock → *Model access* | Enable **Amazon Nova Pro** in `us-east-1` |

Then generate the cookie-sealing secret (any 32+ random characters):

```bash
echo "RING_SESSION_SECRET=$(openssl rand -base64 48)" >> .env
```

### Optional: Google sign-in and email delivery

- **Google** — follow [GOOGLE_OAUTH_COGNITO_SETUP.md](GOOGLE_OAUTH_COGNITO_SETUP.md); the callback URL is the Cognito domain, and your app origins go in the app client's *Allowed callback / sign-out URLs* (`http://localhost:3000/auth/callback` and `http://localhost:3000/`, trailing slash included).
- **SES** — verify a domain (DKIM) and set `SES_FROM_EMAIL`. While SES is in sandbox, recipients must be verified too; set `SMTP_*` for the fallback described in [SES_NOTIFICATIONS_IMPLEMENTATION.md](SES_NOTIFICATIONS_IMPLEMENTATION.md).

## 4. Run

```bash
pnpm dev        # http://localhost:3000  (also builds the /docs pages)
pnpm test       # unit tests
pnpm build      # production build
```

Sign up, confirm the emailed code, then pick an experience:

- **Demo Mode** — the full product on a sample dataset. No Ring, Bedrock or SES needed.
- **Real Mode** — open the [Ring Developer Playground](https://developer.amazon.com/ring/console/playground), copy the 30-minute token, paste it into *Add Ring Device*, and the app switches to your real device, events and media.

## 5. Try the real flow

1. In the Playground, trigger a **Package**, **Vehicle** or **Motion** simulation.
2. Within seconds the event appears in **Events**; Matan captures the snapshot, Nova Pro analyses it, the Decision Engine and your Smart Rules decide.
3. If the decision is *Notify* or *Escalate*, the alert email arrives with the analyzed frame and the reason.
4. **Settings → Care & Rules** changes the outcome: quiet hours, sensitivity, or your own rule.

## 6. Deploy to AWS Amplify

Push the repo, connect it in Amplify Hosting, then:

1. Add the environment variables from `.env.example` (the build copies an allow-list into the server bundle — see [AWS_DEPLOYMENT.md](AWS_DEPLOYMENT.md)).
2. Attach a compute role with the same permissions as above — **no access keys**.
3. Add your production origin to the Cognito app client's callback and sign-out URLs.
4. Redeploy and check the `runtime_config` log line: `s3`, `ses`, `smtp`, `ringSessionSecret` should all be `true`.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Images missing on Events | `S3_MEDIA_BUCKET` not reaching the server runtime — see [AWS_DEPLOYMENT.md](AWS_DEPLOYMENT.md) |
| “Session expired” right after connecting Ring | `RING_SESSION_SECRET` missing in a multi-instance deployment |
| `SES_ACCESS_DENIED` | The role lacks `ses:SendEmail` on **both** the identity and the configuration set |
| Google sign-in shows *Invalid request* | The origin's callback / sign-out URLs are not registered on the app client (the sign-out URL ends with `/`) |
| Analysis stuck at “Capturing evidence” | Ring token expired — reconnect; the Playground token lasts 30 minutes |
