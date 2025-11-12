# 🌐 Plexi Anti Nuke — Advanced Discord Protection Bot

Plexi Anti Nuke is an advanced **security and moderation bot** built to protect your Discord servers from malicious raids, unauthorized actions, and mass-destruction attempts.  
It ensures your community remains **safe, stable, and resilient** — even under coordinated attacks. (Adjust it if you wanna use it as a extension to the moderation bot)

---

## 🛡️ Features

### 🔒 Anti-Nuke Protection
- Detects and blocks unauthorized actions like:
  - Mass role deletions
  - Channel deletions or creations
  - Mass bans or kicks
  - Unapproved bot additions
  - Permission escalations

### ⚙️ Server Restoration
- Automatically restores deleted roles, channels, and permissions from backups.
- Maintains a **real-time sync** of server configurations.

### 👑 Owner Protection
- Ensures the server owner and whitelisted users are **immune** from automated punishment.
- All sensitive actions are verified against a **secure whitelist**.

### 🧰 Moderation Tools
- Ban, kick, mute, and warn commands with full audit logging.
- Message filtering and anti-spam functionality.
- Full event logging via Discord webhooks.

### 📊 Logging & Analytics
- Clean, modern logs for every event:
  - Executed commands
  - Security triggers
  - Detected nukes and offenders
- Webhook-based reporting system (configurable).

---

## ⚙️ Setup & Installation

### 🧩 Prerequisites
- Node.js 18+ or higher
- A valid Discord Bot Token
- (Optional) MongoDB for backups and persistent storage

### 📦 Installation
git clone [this repo](https://github.com/cosmonium0/Plexi-Anti-Nuke.git)
cd Plexi-Anti-Nuke
npm install

# 🚀 Start the Bot
`node index.js`

⚙️ Configuration

Create a .env file in your root directory:

🧾 Example Logs
`[SECURITY] Unauthorized bot detected — Removed automatically.
[PROTECTION] Channel deletion prevented by User: Unknown#0000 (ID: 112233445566)
[ACTION LOG] Admin banned user: @Spammer — Reason: Mass mentions`

💼 Permissions Required

Administrator (Recommended for full protection)

Manage Channels

Manage Roles

View Audit Log

Kick & Ban Members

Plexi is designed to run in secured, high-risk servers where reliability and instant reaction are critical.

⚠️ Disclaimer

Plexi Anti Nuke does not collect personal user data.
All actions are limited to what the Discord API allows for authorized bots.
Unauthorized or malicious use of Plexi is strictly prohibited.

💻 Contributing

Contributions are welcome!
Fork the repository and open a pull request to suggest improvements, new features, or optimizations.


💫 Protect your Discord. Stay secure with Plexi Anti Nuke.
