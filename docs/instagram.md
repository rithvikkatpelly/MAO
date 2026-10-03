# Setup: Instagram publishing

Creators connect an Instagram account under **Connections**, then post from the editor with
the **Post** button in the top bar. Aurea uses the Instagram API with Instagram Login, so it
works with Instagram **Business** and **Creator** accounts and needs no Facebook Page.
Personal accounts can switch for free in the Instagram app (Settings, Account type and tools).

## How it works

```
Editor  --render slides to JPEG-->  POST /api/instagram/media     (stored for at most a day)
        --caption + image ids---->  POST /api/instagram/publish
                                      creates a container per image (and a carousel container),
                                      waits for Instagram to process them, publishes, then
                                      deletes the staged images and logs the post on Insights
Instagram  --downloads images from-->  GET {PUBLIC_API_URL}/api/instagram/media/<token>.jpg
```

Instagram downloads post images from a public URL, which is why the API needs a public
HTTPS address (`PUBLIC_API_URL`), even in development. Access tokens last 60 days, are stored
encrypted with `SECRET_KEY`, and are renewed automatically when a post goes out in the last week.

## 1. Create the Meta app

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) and choose **Create app**.
2. Pick the use case **Manage messaging and content on Instagram**, then a **Business** app.
3. Open the use case, then **API setup with Instagram login**.
4. Copy the **Instagram app ID** and **Instagram app secret** from that page. These are
   different from the Meta app ID at the top of the dashboard.
5. Under **Set up Instagram business login**, open **Business login settings** and add this
   OAuth redirect URI (it must match exactly):
   ```
   {PUBLIC_API_URL}/api/instagram/callback
   ```
6. Make sure the permissions `instagram_business_basic` and
   `instagram_business_content_publish` are added.

While the app is in **Development** mode, only Instagram accounts added under
**App roles > Roles > Instagram testers** can connect. Each tester accepts the invite in the
Instagram app or on instagram.com under **Settings > Apps and websites > Tester invites**.
To let any creator connect, submit both permissions for **App Review** (Advanced access) and
complete **Business verification**.

## 2. Give the API a public HTTPS address

In production this is the API's own domain. In development, run a tunnel to port 8000:

```bash
# Cloudflare (free, no account needed for a quick tunnel)
brew install cloudflared
cloudflared tunnel --url http://localhost:8000

# or ngrok, which gives a free fixed domain
ngrok http 8000 --url=your-name.ngrok-free.app
```

A quick Cloudflare tunnel gets a new address every run, so `PUBLIC_API_URL` and the
redirect URI in step 1.5 must be updated each time. A fixed domain (ngrok static domain or
a named Cloudflare tunnel) avoids that.

Some networks block ngrok: the browser shows `ERR_SSL_PROTOCOL_ERROR` for the ngrok address
and the ngrok agent logs no requests. Xfinity's Advanced Security is a common cause. Allow
ngrok in the router's security settings, or use the Cloudflare tunnel instead.

The app itself stays on `http://localhost:5173`; only the API needs the public address.

## 3. Configure the backend

```bash
# backend/.env
INSTAGRAM_APP_ID=1234567890123456
INSTAGRAM_APP_SECRET=abc123...
PUBLIC_API_URL=https://your-name.ngrok-free.app
APP_URL=http://localhost:5173          # where to send creators back after connecting
SECRET_KEY=...                         # python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Restart the API. **Connections** shows anything still missing. Changing `SECRET_KEY`
makes saved tokens unreadable, so every creator has to connect again.

## What Instagram accepts

| Rule | Limit | What Aurea does |
|---|---|---|
| Image format | JPEG | Slides are rendered to JPEG in the browser |
| Aspect ratio | 4:5 to 1.91:1 | Blocks Story (9:16) and A4 poster sizes; switch to Portrait or Square |
| Images per post | 10 | Posts slides 1 to 10 and warns |
| Caption | 2,200 characters, 30 hashtags | Counted and enforced in the dialog |
| Posts per account | 100 through the API per 24 hours | Instagram's error is shown |

## Troubleshooting

- **"Instagram is not set up on the server"**: a setting in step 3 is missing, or
  `PUBLIC_API_URL` does not start with `https://`.
- **Instagram shows "Invalid redirect_uri"**: the URI in Business login settings does not
  exactly match `{PUBLIC_API_URL}/api/instagram/callback` (check for a new tunnel address).
- **"Insufficient developer role"** when connecting: the account is not an accepted
  Instagram tester while the app is in Development mode.
- **"Instagram could not process one of the images"** or a media download error: Instagram
  could not reach `PUBLIC_API_URL`. Check that the tunnel is still running.
- **Signed out errors when posting**: the token was revoked (for example, the password
  changed or the app was removed in Instagram). Connect the account again.
