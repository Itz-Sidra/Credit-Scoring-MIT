# EC2 Deploy Guide — Step by Step

This guide walks through everything from creating an AWS account to having your app live at a public URL.
No prior AWS experience needed. Every command is copy-paste ready.

---

## Part 1 — AWS Account and EC2 Instance

### 1. Create AWS Account (skip if you have one)

1. Go to https://aws.amazon.com
2. Click "Create a Free Account"
3. Choose "Free Tier" — no credit card charge as long as you use t2/t3.micro

---

### 2. Launch an EC2 Instance

1. Log in to AWS Console → search "EC2" → click "EC2"
2. Click "Launch Instance"
3. Fill in:
   - **Name:** barclays-app (or anything)
   - **AMI:** Amazon Linux 2023 AMI (Free Tier eligible) — this is the **default**, leave it as-is
   - **Instance type:** t3.micro (Free Tier eligible)
   - **Key pair:** Click "Create new key pair"
     - Name: `barclays-key`
     - Type: RSA
     - Format: `.pem`
     - Click "Create key pair" — it will download `barclays-key.pem` to your Mac

---

### 3. Set Security Group (very important)

Still on the same Launch page, under "Network settings":

- Click "Edit"
- There will be one rule already (SSH port 22) — keep it
- Click "Add security group rule":
  - Type: HTTP
  - Port: 80
  - Source: Anywhere (0.0.0.0/0)

Then click **"Launch Instance"** at the bottom.

---

### 4. Get Your EC2 Public IP

1. In EC2 Console → click "Instances"
2. Click your new instance
3. Copy the **"Public IPv4 address"** — looks like `54.123.45.67`

---

## Part 2 — Connect to EC2 from Your Mac

### 5. Fix the Key File Permissions

Open Terminal on your Mac and run:

```bash
chmod 400 ~/Downloads/barclays-key.pem
```

### 6. SSH Into EC2

```bash
ssh -i ~/Downloads/barclays-key.pem ec2-user@YOUR_EC2_IP
```

Replace `YOUR_EC2_IP` with the actual IP you copied.

You should see a welcome message starting with "Amazon Linux..."

> Note: Amazon Linux uses `ec2-user`, not `ubuntu` or `root`.

---

## Part 3 — Bootstrap Docker on the Server

### 7. Install Docker (inside EC2 terminal)

Run these commands one by one:

```bash
sudo dnf install docker -y
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ec2-user
```

Then log out and log back in so the group permission takes effect:

```bash
exit
ssh -i ~/Downloads/barclays-key.pem ec2-user@YOUR_EC2_IP
```

Verify Docker works:

```bash
docker --version
docker compose version
```

Both should print version numbers. If they do, Docker is ready.

---

## Part 4 — Copy Your Project to EC2

### 8. Copy Project Files (run this on your Mac, NOT inside EC2)

Open a new Terminal tab on your Mac (not the SSH tab) and run:

```bash
rsync -avz \
  --exclude node_modules \
  --exclude .git \
  --exclude frontend/dist \
  --exclude backend/.env \
  -e "ssh -i ~/Downloads/barclays-key.pem" \
  /Users/shlokpalrecha/Desktop/BarclaysFinal/ \
  ec2-user@YOUR_EC2_IP:~/app/
```

This copies your whole project to `~/app/` on EC2. Excludes node_modules (Docker builds those).

---

## Part 5 — Set Up Environment File

### 9. Create the .env.docker File (inside EC2)

Switch back to your SSH Terminal tab (logged into EC2) and run:

```bash
cd ~/app
cp .env.docker.example .env.docker
nano .env.docker
```

Edit these values:

| Key | What to put |
|-----|-------------|
| `MONGO_URI` | Your MongoDB Atlas connection string |
| `JWT_SECRET` | Any random 32+ character string |
| `JWT_REFRESH_SECRET` | Another random 32+ character string |
| `EMAIL_USER` | Your Gmail address |
| `EMAIL_PASSWORD` | Your Gmail App Password |
| `ALLOWED_ORIGINS` | `http://YOUR_EC2_IP` |

To save in nano: press `Ctrl + X`, then `Y`, then Enter.

**Get MongoDB Atlas URI:**
1. Go to https://cloud.mongodb.com
2. Create free cluster → Connect → Drivers → copy the connection string
3. Replace `<password>` with your DB password

**Get Gmail App Password:**
1. Google Account → Security → 2-Step Verification (enable it first)
2. Then → App Passwords → create one for "Mail"
3. Copy the 16-character password

---

## Part 6 — Deploy

### 10. Run the Deploy Script (inside EC2)

```bash
cd ~/app
bash scripts/ec2-deploy.sh
```

This will:
- Build Docker images (takes 3–5 minutes first time)
- Start frontend, backend, redis containers
- Print health check result

### 11. Verify

```bash
curl http://localhost/api/health
```

Should return something like:
```json
{"status":"ok","checks":{"database":"up","model":"up"}}
```

---

## Part 7 — Open in Browser

### 12. Access App

Open browser on your Mac and go to:

```
http://YOUR_EC2_IP
```

Your full app is live. Share this link with anyone.

---

## Part 8 — Useful Commands (run inside EC2)

```bash
# See running containers
docker compose --env-file .env.docker ps

# View live logs
docker compose --env-file .env.docker logs -f

# Restart app
docker compose --env-file .env.docker restart

# Stop app
docker compose --env-file .env.docker down

# Update app after changes (repeat from step 8, then):
docker compose --env-file .env.docker up -d --build
```

---

## Troubleshooting

**"Connection refused" on SSH:**
- Wait 1–2 minutes after launching instance, it boots slowly

**"Permission denied (publickey)":**
- Make sure you ran `chmod 400` on the .pem file
- Make sure you're using `ec2-user@` not `root@` or `ubuntu@`

**App not loading in browser:**
- Check Security Group has port 80 open (Part 1, Step 3)
- Run `docker compose --env-file .env.docker ps` to confirm containers are Up

**Backend shows database: down:**
- Check `MONGO_URI` in `.env.docker` — connection string must be exact
- Make sure MongoDB Atlas IP whitelist includes `0.0.0.0/0` (allow all), or add the EC2 IP

**MongoDB Atlas IP Whitelist (important):**
1. Atlas Console → Network Access → Add IP Address
2. Click "Allow Access from Anywhere" → Confirm
