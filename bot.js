/**
 * bot.js — Plexi Anti Nuke (rebranded, polished messages)
 *
 * Dependencies: discord.js, better-sqlite3, dotenv, node-fetch (or use global fetch in Node 18+)
 * npm i discord.js better-sqlite3 dotenv node-fetch
 *
 * Configure via .env: DISCORD_TOKEN, BOT_OWNER_ID (optional), LOG_WEBHOOK_URL (optional), PREFIX (optional)
 *
 * This single-file starter is rebranded and uses professional messaging for mod logs and replies.
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, AuditLogEvent, PermissionsBitField } from 'discord.js';
import Database from 'better-sqlite3';
import fetch from 'node-fetch';

// ====== CONFIG / DEFAULTS (edit these) ======
const DEFAULTS = {
  PREFIX: process.env.PREFIX || 'k!',
  THRESHOLDS: {
    bans: { count: 3, windowSec: 10 },
    kicks: { count: 5, windowSec: 10 },
    roleDeletes: { count: 2, windowSec: 10 },
    channelDeletes: { count: 2, windowSec: 10 },
    roleCreates: { count: 6, windowSec: 10 },
  },
  DEFAULT_PUNISHMENT: 'ban',
  AUTO_RESTORE: true,
  MAX_AUTO_BANS: 5,
  BRAND_NAME: 'Plexi Anti Nuke',
  BRAND_COLOR: 0x2E8B57 // a professional teal-ish color
};
// ============================================

// ENV
const TOKEN = process.env.DISCORD_TOKEN;
const BOT_OWNER = process.env.BOT_OWNER_ID || null;
const LOG_WEBHOOK = process.env.LOG_WEBHOOK_URL || null;
const PREFIX = DEFAULTS.PREFIX;

if (!TOKEN) {
  console.error('Set DISCORD_TOKEN in .env');
  process.exit(1);
}

// DB init
const db = new Database('./plexi.db');
db.pragma('journal_mode = WAL');
db.prepare(`CREATE TABLE IF NOT EXISTS whitelist (guild_id TEXT, user_id TEXT, PRIMARY KEY(guild_id, user_id))`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS guild_config (guild_id TEXT PRIMARY KEY, punishment TEXT)`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS role_backups (guild_id TEXT, role_id TEXT, name TEXT, perms INTEGER, color TEXT, hoist INTEGER, position INTEGER, managed INTEGER)`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS channel_backups (guild_id TEXT, channel_id TEXT, data TEXT)`).run();

// client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.MessageContent,
  ],
  partials: [ Partials.Channel ],
});

client.once('ready', () => {
  console.log(`${DEFAULTS.BRAND_NAME} started as ${client.user.tag}`);
});

// professional mod-log helper: sends embed to webhook if configured, otherwise console
async function modLog(guild, title, description, fields = []) {
  const embed = {
    title,
    description,
    color: DEFAULTS.BRAND_COLOR,
    timestamp: new Date().toISOString(),
    footer: { text: `${DEFAULTS.BRAND_NAME} • Guild ID: ${guild?.id || 'unknown'}` },
    fields: fields,
  };
  const payload = { embeds: [embed] };

  if (LOG_WEBHOOK) {
    try {
      await fetch(LOG_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return;
    } catch (e) {
      console.warn('Webhook logging failed — falling back to console.', e);
    }
  }

  // console fallback
  console.log(`[${DEFAULTS.BRAND_NAME}] ${title} — ${description}`);
  if (fields.length) console.log('Fields:', fields);
}

// whitelist check
function isWhitelisted(guildId, userId) {
  const row = db.prepare('SELECT 1 FROM whitelist WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
  if (row) return true;
  if (BOT_OWNER && userId === BOT_OWNER) return true;
  return false;
}

// role backup & restore
function backupRole(role) {
  const stmt = db.prepare(`INSERT OR REPLACE INTO role_backups (guild_id, role_id, name, perms, color, hoist, position, managed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  stmt.run(role.guild.id, role.id, role.name, role.permissions.bitfield, role.hexColor, role.hoist ? 1 : 0, role.position, role.managed ? 1 : 0);
}

async function restoreRole(guild, roleId) {
  const row = db.prepare('SELECT * FROM role_backups WHERE guild_id = ? AND role_id = ?').get(guild.id, roleId);
  if (!row) return null;
  try {
    const created = await guild.roles.create({
      name: row.name,
      permissions: BigInt(row.perms),
      color: row.color,
      hoist: !!row.hoist,
      reason: `${DEFAULTS.BRAND_NAME}: Automated role restore.`,
    });
    await modLog(guild, 'Role restored', `Restored role **${created.name}** (${created.id}).`);
    return created;
  } catch (e) {
    await modLog(guild, 'Role restore failed', `Could not restore role ID ${roleId}. Error: ${e.message}`);
    return null;
  }
}

// channel backup & restore
function backupChannel(channel) {
  try {
    const minimal = {
      id: channel.id,
      name: channel.name,
      type: channel.type,
      topic: channel.topic,
      position: channel.position,
      parentId: channel.parentId || null,
      nsfw: channel.nsfw || false,
    };
    db.prepare(`INSERT OR REPLACE INTO channel_backups (guild_id, channel_id, data) VALUES (?, ?, ?)`)
      .run(channel.guild.id, channel.id, JSON.stringify(minimal));
  } catch (e) {
    console.warn('Channel backup failed', e);
  }
}

async function restoreChannel(guild, channelId) {
  const row = db.prepare('SELECT data FROM channel_backups WHERE guild_id = ? AND channel_id = ?').get(guild.id, channelId);
  if (!row) return null;
  const data = JSON.parse(row.data);
  try {
    const created = await guild.channels.create({
      name: data.name,
      type: data.type,
      topic: data.topic,
      position: data.position,
      parent: data.parentId || null,
      nsfw: !!data.nsfw,
      reason: `${DEFAULTS.BRAND_NAME}: Automated channel restore.`,
    });
    await modLog(guild, 'Channel restored', `Restored channel **${created.name}** (${created.id}).`);
    return created;
  } catch (e) {
    await modLog(guild, 'Channel restore failed', `Could not restore channel ID ${channelId}. Error: ${e.message}`);
    return null;
  }
}

// offense tracking (in-memory)
const offenseTrackers = new Map();

function pushOffense(guildId, type, executorId) {
  if (!offenseTrackers.has(guildId)) offenseTrackers.set(guildId, {});
  const obj = offenseTrackers.get(guildId);
  if (!obj[type]) obj[type] = [];
  obj[type].push({ executorId, ts: Date.now() });
}

function countOffenses(guildId, type, executorId, windowMs) {
  const obj = offenseTrackers.get(guildId);
  if (!obj || !obj[type]) return 0;
  const cutoff = Date.now() - windowMs;
  obj[type] = obj[type].filter(o => o.ts >= cutoff);
  return obj[type].filter(o => o.executorId === executorId).length;
}

// punishment handler
async function punishExecutor(guild, executorId, note = '') {
  try {
    const punishmentRow = db.prepare('SELECT punishment FROM guild_config WHERE guild_id = ?').get(guild.id);
    const punish = (punishmentRow && punishmentRow.punishment) || DEFAULTS.DEFAULT_PUNISHMENT;

    const member = await guild.members.fetch(executorId).catch(() => null);
    if (!member) {
      await modLog(guild, 'Action skipped', `Could not fetch executor (${executorId}). ${note}`);
      return;
    }

    if (isWhitelisted(guild.id, executorId)) {
      await modLog(guild, 'Action skipped', `Executor <@${executorId}> is whitelisted; no punitive action taken.`);
      return;
    }

    if (punish === 'ban') {
      await member.ban({ reason: `${DEFAULTS.BRAND_NAME}: Automated enforcement. ${note}` }).catch(e => {
        modLog(guild, 'Auto-ban failed', `Failed to ban <@${executorId}>: ${e.message}`);
      });
      await modLog(guild, 'Automated ban applied', `Executor <@${executorId}> was banned by automated enforcement.`);
    } else if (punish === 'kick') {
      await member.kick(`${DEFAULTS.BRAND_NAME}: Automated enforcement. ${note}`).catch(e => {
        modLog(guild, 'Auto-kick failed', `Failed to kick <@${executorId}>: ${e.message}`);
      });
      await modLog(guild, 'Automated kick applied', `Executor <@${executorId}> was kicked by automated enforcement.`);
    } else if (punish === 'demote' || punish === 'removeRoles') {
      const rolesToRemove = member.roles.cache.filter(r => r.id !== guild.id).map(r => r.id);
      for (const rid of rolesToRemove) {
        await member.roles.remove(rid, `${DEFAULTS.BRAND_NAME}: Role removal as enforcement.`).catch(() => null);
      }
      await modLog(guild, 'Roles removed', `All elevated roles removed from <@${executorId}> by automated enforcement.`);
    } else {
      await modLog(guild, 'Unknown enforcement', `Guild configuration specified an unknown action: ${punish}.`);
    }
  } catch (e) {
    console.error('punishExecutor error', e);
  }
}

// suspicious action handler
async function handleSuspiciousAction(guild, actionType, targetId, executorId) {
  pushOffense(guild.id, actionType, executorId);
  const conf = DEFAULTS.THRESHOLDS[actionType];
  if (!conf) return;
  const windowMs = conf.windowSec * 1000;
  const count = countOffenses(guild.id, actionType, executorId, windowMs);

  await modLog(guild,
    `Recorded activity — ${actionType}`,
    `User <@${executorId}> performed **${actionType}**. Current count in ${conf.windowSec}s: **${count}/${conf.count}**.`,
    [{ name: 'Target ID', value: `${targetId || 'N/A'}`, inline: true }]);

  if (count >= conf.count) {
    await modLog(guild,
      `Enforcement triggered — ${actionType}`,
      `User <@${executorId}> exceeded the configured threshold for **${actionType}**. Initiating automated enforcement and mitigation.`);

    await punishExecutor(guild, executorId, `Threshold exceeded for action type: ${actionType}`);

    if (DEFAULTS.AUTO_RESTORE) {
      if (actionType === 'roleDeletes') {
        await restoreRole(guild, targetId);
      } else if (actionType === 'channelDeletes') {
        await restoreChannel(guild, targetId);
      }
    }

    // clear recorded offenses for that executor & action
    const obj = offenseTrackers.get(guild.id);
    if (obj && obj[actionType]) {
      obj[actionType] = obj[actionType].filter(o => o.executorId !== executorId);
    }
  }
}

// Event listeners (backups, detection)
client.on('roleCreate', role => backupRole(role));
client.on('channelCreate', channel => { if (channel.guild) backupChannel(channel); });

client.on('roleDelete', async (role) => {
  const guild = role.guild;
  try {
    const logs = await guild.fetchAuditLogs({ limit: 6, type: AuditLogEvent.RoleDelete });
    const entry = logs.entries.find(e => e.targetId === role.id);
    const executor = entry?.executor?.id;
    if (executor) {
      await handleSuspiciousAction(guild, 'roleDeletes', role.id, executor);
    } else {
      await modLog(guild, 'Role deleted', `Role **${role.name}** (${role.id}) was deleted — executor not identified.`);
    }
  } catch (e) {
    console.error('roleDelete handler error', e);
  }
});

client.on('channelDelete', async (channel) => {
  if (!channel.guild) return;
  const guild = channel.guild;
  try {
    const logs = await guild.fetchAuditLogs({ limit: 6, type: AuditLogEvent.ChannelDelete });
    const entry = logs.entries.find(e => e.targetId === channel.id);
    const executor = entry?.executor?.id;
    if (executor) {
      await handleSuspiciousAction(guild, 'channelDeletes', channel.id, executor);
    } else {
      await modLog(guild, 'Channel deleted', `Channel **${channel.name}** (${channel.id}) was deleted — executor not identified.`);
    }
  } catch (e) {
    console.error('channelDelete handler error', e);
  }
});

client.on('guildBanAdd', async (ban) => {
  const guild = ban.guild;
  try {
    const logs = await guild.fetchAuditLogs({ limit: 6, type: AuditLogEvent.MemberBanAdd });
    const entry = logs.entries.find(e => e.targetId === ban.user.id);
    const executor = entry?.executor?.id;
    if (executor) {
      await handleSuspiciousAction(guild, 'bans', ban.user.id, executor);
    } else {
      await modLog(guild, 'Member banned', `User **${ban.user.tag}** was banned — executor not identified.`);
    }
  } catch (e) {
    console.error('guildBanAdd handler', e);
  }
});

client.on('guildMemberRemove', async (member) => {
  const guild = member.guild;
  try {
    const logs = await guild.fetchAuditLogs({ limit: 6, type: AuditLogEvent.MemberKick });
    const entry = logs.entries.find(e => e.targetId === member.id);
    const executor = entry?.executor?.id;
    if (executor) {
      await handleSuspiciousAction(guild, 'kicks', member.id, executor);
    }
  } catch (e) {
    console.error('guildMemberRemove handler', e);
  }
});

client.on('roleCreate', async (role) => {
  const guild = role.guild;
  try {
    const logs = await guild.fetchAuditLogs({ limit: 6, type: AuditLogEvent.RoleCreate });
    const entry = logs.entries.find(e => e.targetId === role.id);
    const executor = entry?.executor?.id;
    if (executor) {
      pushOffense(guild.id, 'roleCreates', executor);
      const windowMs = DEFAULTS.THRESHOLDS.roleCreates.windowSec * 1000;
      const cnt = countOffenses(guild.id, 'roleCreates', executor, windowMs);
      await modLog(guild, 'Role created', `Executor <@${executor}> created role **${role.name}**. Count in window: ${cnt}.`);
      if (cnt >= DEFAULTS.THRESHOLDS.roleCreates.count) {
        await modLog(guild, 'Enforcement triggered — role creation', `Executor <@${executor}> exceeded role creation threshold.`);
        await punishExecutor(guild, executor, 'Exceeded role creation threshold');
      }
    }
  } catch (e) { console.error('roleCreate handler', e); }
});

// Prefix command handling for whitelist and config
client.on('messageCreate', async (msg) => {
  if (!msg.guild || msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift()?.toLowerCase();

  const isOwner = BOT_OWNER && msg.author.id === BOT_OWNER;
  const canManage = msg.member.permissions.has(PermissionsBitField.Flags.ManageGuild);

  if (!isOwner && !canManage) {
    return msg.reply({ content: 'You must be the server owner or have Manage Server permission to run Plexi configuration commands.' });
  }

  if (cmd === 'whitelist') {
    const sub = args.shift();
    if (!sub) return msg.reply('Usage: k!whitelist add|remove @user | k!whitelist list');
    if (sub === 'add') {
      const u = msg.mentions.users.first();
      if (!u) return msg.reply('Please mention the user to whitelist.');
      db.prepare('INSERT OR IGNORE INTO whitelist (guild_id, user_id) VALUES (?, ?)').run(msg.guild.id, u.id);
      return msg.reply({ content: `✅ ${u.tag} has been added to the whitelist for this server.` });
    } else if (sub === 'remove') {
      const u = msg.mentions.users.first();
      if (!u) return msg.reply('Please mention the user to remove from the whitelist.');
      db.prepare('DELETE FROM whitelist WHERE guild_id = ? AND user_id = ?').run(msg.guild.id, u.id);
      return msg.reply({ content: `✅ ${u.tag} has been removed from the whitelist for this server.` });
    } else if (sub === 'list') {
      const rows = db.prepare('SELECT user_id FROM whitelist WHERE guild_id = ?').all(msg.guild.id);
      if (rows.length === 0) return msg.reply({ content: 'The whitelist for this server is currently empty.' });
      const mentions = rows.map(r => `<@${r.user_id}>`).join(', ');
      return msg.reply({ content: `Whitelisted users: ${mentions}` });
    }
  } else if (cmd === 'setpunish') {
    const arg = args[0];
    if (!arg || !['ban', 'kick', 'demote', 'removeRoles'].includes(arg)) {
      return msg.reply('Usage: k!setpunish ban|kick|demote|removeRoles — sets the enforcement action Plexi will take.');
    }
    db.prepare('INSERT OR REPLACE INTO guild_config (guild_id, punishment) VALUES (?, ?)').run(msg.guild.id, arg);
    return msg.reply({ content: `✅ Enforcement action set to **${arg}** for this server.` });
  } else if (cmd === 'backupnow') {
    const roles = msg.guild.roles.cache.filter(r => !r.managed && r.id !== msg.guild.id);
    for (const role of roles.values()) backupRole(role);
    for (const ch of msg.guild.channels.cache.values()) backupChannel(ch);
    return msg.reply({ content: '✅ Immediate backup completed for roles and channels (stored locally).' });
  } else if (cmd === 'help') {
    return msg.reply({
      content:
        `${DEFAULTS.BRAND_NAME} — administrative commands:\n` +
        `• \`${PREFIX}whitelist add @user\` — Add a user to the whitelist.\n` +
        `• \`${PREFIX}whitelist remove @user\` — Remove a user from the whitelist.\n` +
        `• \`${PREFIX}whitelist list\` — List whitelisted users.\n` +
        `• \`${PREFIX}setpunish <ban|kick|demote|removeRoles>\` — Select automated enforcement.\n` +
        `• \`${PREFIX}backupnow\` — Create immediate backups of roles & channels.\n` +
        `Only Server Owners or users with Manage Server permission may use these commands.`
    });
  } else {
    return msg.reply({ content: 'Unknown command. Use k!help for a list of administrative commands.' });
  }
});

client.login(TOKEN);
