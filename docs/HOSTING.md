# Private hosting on Cloudflare (free)

This guide puts the app online at a private address that only you (and anyone you choose) can open, on phone and PC, with nothing to download. It uses two free Cloudflare products:

- **Cloudflare Workers** (static assets) publishes the `app/` folder of your repository, and republishes it automatically every time the main branch changes.
- **Cloudflare Access** puts a login screen in front of it. You type your email, receive a one-time code, and you're in. Emails that aren't on your list never get a code.

You do this once. It takes about 20 to 30 minutes.

> **Not ready to host?** You don't have to. The app also runs straight from your computer: download the repository (on GitHub: **Code**, then **Download ZIP**, or `git clone`), unzip it, and open `app/index.html` in your browser. Everything works except installing it on a phone.

> **Why not GitHub Pages, Netlify or Vercel?** A GitHub Pages site is public even when the repository is private, and password protection on the other common hosts is a paid feature. The app contains your whole manuscript (`app/text.js` holds the chapter text for the reader view, and `app/db.js` thousands of quotes), so it must sit behind a login. Cloudflare does this for free.

These steps were checked against Cloudflare's documentation in October 2026. Cloudflare renames menus from time to time: if a label differs slightly, look for the closest match. Links to the relevant Cloudflare pages are at the end.

---

## What you need

- Your GitHub repository for this project, with the app built and **merged into the main branch** (Cloudflare publishes from that branch). If Claude worked on a separate branch, merge its pull request first.
- A free Cloudflare account: <https://dash.cloudflare.com/sign-up>.
- A payment card. Cloudflare asks for one when you activate the free Zero Trust plan (which provides Access). **The Free plan costs $0 and you won't be charged**, as long as you pick *Free*.

## Three privacy rules

1. **Only `app/` is published.** `wrangler.jsonc` in your repository says so (`"assets": { "directory": "./app" }`). `source/`, `text/`, `data/` and `planning/` never go online. But the app itself contains the manuscript, so treat the site as the manuscript.
2. **Set up the login before the site goes up**, and check it in a private browser window afterwards. This guide does the login first (Parts 1 and 2) and protects the site immediately after the first deploy (Part 4).
3. **The project name must match `wrangler.jsonc`.** Choose a name now: lowercase letters, digits and dashes, up to 63 characters, and hard to guess (for example `harbour-notes-7k2`, not your book's title). Put it in `wrangler.jsonc` as `"name"` and commit. Your address will be `https://<name>.<your-subdomain>.workers.dev`. If the names differ, the deploy fails with *"The name in your Wrangler configuration file … must match the name of your Worker"*.

---

## Part 1: Turn on Zero Trust (the login service)

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com/).
2. Open **Zero Trust** from the left menu. The first time, it starts an onboarding.
3. Choose a **team name** (anything, for example `harbour-team`). It becomes part of the login page's address.
4. Select the **Zero Trust Free** plan and enter the payment details it asks for. You won't be charged on the Free plan.

## Part 2: Decide who can log in

### Log in with an emailed code

New Zero Trust setups only allow logging in with a Cloudflare account. An emailed one-time code is easier, especially on a phone:

1. In **Zero Trust**, go to **Integrations** > **Identity providers**.
2. Under **Your identity providers**, select **Add new identity provider**, then **One-time PIN**, and save.

### Allow only your email addresses

1. In **Zero Trust**, go to **Access controls** > **Policies**, and select **Add a policy**.
2. Fill it in:
   - **Policy name**: `Allow my emails` (any name).
   - **Action**: **Allow**.
   - **Session duration**: **1 month** (how long you stay logged in), or *Same as application session timeout*.
   - Under **Rules**, **Include**: choose the selector **Emails**, and enter your email address. Add any others you want to let in (a co-author, an editor, beta readers).
3. **Save**.

**Never** use a rule like **Everyone**, or **Login Methods: One-time PIN** on its own, or **Emails ending in** a public mail domain such as `gmail.com`. Each of those lets strangers in.

### Stay logged in longer (optional)

In **Zero Trust**, go to **Access controls** > **Access settings**. Under **Set your global session duration**, select **Edit**, choose **1 month** (the maximum; the default is 24 hours), and **Save**.

## Part 3: Publish the app

1. In the dashboard, go to **Workers & Pages** and select **Create application**.
2. Choose **GitHub** (import a repository). If asked, connect your GitHub account (**+ Add account**, then **Install & Authorize**). When GitHub asks which repositories Cloudflare may see, choose **Only select repositories** and pick this project's repository.
3. Select the repository.
4. On the setup screen:
   - **Project name** (or Worker name): exactly the `name` from `wrangler.jsonc` (privacy rule 3).
   - **Build command**: leave it **empty**. The app is already built when it's committed.
   - **Deploy command**: `npx wrangler deploy` (the default). It reads `wrangler.jsonc`, which publishes only `app/`.
   - **Preview command**: leave the default.
   - **Advanced settings** > **Path** (root directory): leave the default (the repository root).
   - **API token**: leave the default (Cloudflare creates one). **Build variables**: none.
   - If the screen offers to protect the Worker with Cloudflare Access, turn it on and pick the `Allow my emails` policy. Part 4 checks it either way.
5. Select **Save and Deploy** (or **Deploy**). After a minute or two you'll see your address. **Go straight on to Part 4.**

## Part 4: Put the app behind the login

1. In **Workers & Pages**, select your Worker, then open its **Access** tab.
2. Select **Protect this Worker behind Access**.
3. Choose **All traffic**. This covers the `workers.dev` address, any custom domain and any preview links.
4. Under **Authentication policy**, select the existing policy **`Allow my emails`** from Part 2.

   The quick options offered here (*Cloudflare account*, *Email domain*) are not what you want: *Email domain* with a public domain such as `gmail.com` would let every Gmail user in.
5. Review the session duration if shown, then select **Apply Access**.
6. Make sure the emailed code is allowed for this login: in **Zero Trust**, go to **Access controls** > **Applications**, open the application Cloudflare just created for your Worker, select **Configure**, and in the identity-provider (login methods) section, enable **One-time PIN**. You can also set the application's **Session Duration** to 1 month there. Save.

### Preview links

`wrangler.jsonc` sets `"preview_urls": false`, so Cloudflare creates no extra preview or version addresses for other branches. Claude's working branches then don't get their own copy of the site, which is fewer places for the manuscript to leak. To stop Cloudflare running preview builds that have nowhere to go, open your Worker's **Settings** > **Build** > **Branch control** and untick **Enable Preview Builds**.

If you do want previews (to look at Claude's work before merging), set `"preview_urls": true` in `wrangler.jsonc`. They are covered by Part 4's *All traffic* protection, but check one in a private window (Part 5, step 4) before relying on it.

## Part 5: Check that it's really private

1. Open a **private/incognito** browser window and go to your address. You should see a Cloudflare login page, not the app.
2. Enter **your** email. A code arrives within a minute (from `noreply@notify.cloudflare.com`; check spam), valid for 10 minutes. Enter it, and the app opens.
3. In a new private window, try an email that is *not* on your list. The page still says a code was sent (it always does), but **no email arrives**, so there's no way in.
4. If you turned previews on, open one of their addresses (listed under the Worker's deployments) in a private window. It must ask for a login too.

If step 1 shows the app without a login, Part 4 isn't finished. Re-check it, then test again.

## Part 6: Install it on your phone

- **iPhone (Safari):** open the address, log in, tap **Share**, then **Add to Home Screen**. The app gets its own icon and opens full screen. The home-screen app keeps its own login separate from Safari, so you log in once more the first time you open it from the icon.
- **Android (Chrome):** open the address, log in, tap the **⋮** menu, then **Install app** (or **Add to Home screen**).
- **PC:** bookmark the address. In Chrome or Edge you can also use the install icon in the address bar to get a standalone window.

When your session expires (after the duration you set), the app shows the Cloudflare login again. Enter your email, then the new code. Once loaded, the app also works offline.

---

## Day to day

You don't do anything. Every time a reparse (Claude's `db:` commit) reaches the main branch, Cloudflare republishes the app within a minute or two. If Claude worked on another branch, the app updates when you merge that branch's pull request.

## Optional: your own domain

If your domain is on Cloudflare, you can serve the app from it (say `books.example.com`): in your Worker, go to **Settings** > **Domains & Routes** > **Add** > **Custom Domain**, enter it, and select **Add Custom Domain**. The hostname must not already have a DNS record. Part 4's *All traffic* protection covers custom domains too. Test it in a private window like Part 5.

## Optional: more people

To let someone else in, add their email to the `Allow my emails` policy (**Zero Trust** > **Access controls** > **Policies** > **Configure**). To lock someone out, remove it. The change applies within minutes.

## Troubleshooting

| Problem | Fix |
|---|---|
| The deploy fails: *"The name in your Wrangler configuration file … must match the name of your Worker"* | Make `name` in `wrangler.jsonc` exactly the Worker's name in the dashboard, commit, and redeploy. |
| The deploy fails because the `app` directory is not found | The branch Cloudflare deploys from doesn't contain the built app yet. Merge Claude's pull request into it. |
| The deploy fails because a file is too large | Each file can be at most 25 MiB on the Free plan. A very long series can make `app/db.js` that large. Ask Claude to look at the file sizes in `app/`. |
| The app opens without asking for a login | Part 4 isn't complete. Re-check it, and test in a private window. |
| No code arrives by email | Check spam. Make sure One-time PIN is added (Part 2) and enabled on the application (Part 4, step 6), and that your exact email is in the policy. |
| A login page appears but rejects you | Your email isn't in the policy, or the application uses a different policy. Open the application in **Access controls** > **Applications** and check which policy it has. |
| The app shows old data | The latest data commit hasn't reached the main branch (merge it), or the deploy is still running. Then reload the page. |

## Cloudflare documentation

- Workers Builds (deploying from GitHub): <https://developers.cloudflare.com/workers/ci-cd/builds/>
- Build settings and the name requirement: <https://developers.cloudflare.com/workers/ci-cd/builds/configuration/>, <https://developers.cloudflare.com/workers/ci-cd/builds/troubleshoot/>
- Static assets and limits: <https://developers.cloudflare.com/workers/static-assets/>, <https://developers.cloudflare.com/workers/platform/limits/>
- Protecting a Worker with Access: <https://developers.cloudflare.com/workers/configuration/cloudflare-access/>
- Preview URLs: <https://developers.cloudflare.com/workers/previews/>
- Zero Trust setup: <https://developers.cloudflare.com/cloudflare-one/setup/>
- One-time PIN login: <https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/>
- Access policies: <https://developers.cloudflare.com/cloudflare-one/access-controls/policies/>
- Session durations: <https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/>
- Custom domains: <https://developers.cloudflare.com/workers/configuration/routing/custom-domains/>
